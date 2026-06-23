/**
 * Shared Cloudflare Worker — Claude API proxy + rate limiter
 * Used by: SOC Dashboard, ITSM Helpdesk, CRM (portfolio labs for jcalleon.github.io)
 *
 * Why this exists: the Anthropic API key can never live in client-side JS.
 * This Worker holds the key as a secret, forwards requests to Claude,
 * and enforces hard caps so a free-tier demo can never run up a bill.
 *
 * Required setup (see DEPLOY.md):
 *   wrangler secret put ANTHROPIC_API_KEY
 *   Create a KV namespace and bind it as RATE_LIMIT_KV in wrangler.toml
 */

// ---- Hard caps. Tune these, but never remove them. ----
const GLOBAL_DAILY_CAP = 300;      // total requests/day across all visitors, all apps
const PER_VISITOR_DAILY_CAP = 15;  // requests/day per visitor (cookie-based id)
const MAX_TOKENS = 400;            // cap Claude's response length per call
const MODEL = "claude-sonnet-4-6";

// Only these origins may call this Worker.
const ALLOWED_ORIGINS = [
  "https://jcalleon.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, resets daily naturally
}

async function getCount(kv, key) {
  const v = await kv.get(key);
  return v ? parseInt(v, 10) : 0;
}

async function incrCount(kv, key) {
  const current = await getCount(kv, key);
  // 26h expiry so keys self-clean without a cron job
  await kv.put(key, String(current + 1), { expirationTtl: 60 * 60 * 26 });
  return current + 1;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { app, system, prompt } = body;
    if (!app || !prompt) {
      return new Response(JSON.stringify({ error: "Missing app or prompt" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // ---- Rate limiting ----
    const day = todayKey();
    const visitorId =
      request.headers.get("CF-Connecting-IP") || "unknown-visitor";
    const visitorKey = `v:${day}:${visitorId}`;
    const globalKey = `g:${day}`;

    const [globalCount, visitorCount] = await Promise.all([
      getCount(env.RATE_LIMIT_KV, globalKey),
      getCount(env.RATE_LIMIT_KV, visitorKey),
    ]);

    if (globalCount >= GLOBAL_DAILY_CAP) {
      return new Response(
        JSON.stringify({
          error: "demo_limit_reached",
          message:
            "This demo has hit its daily AI request cap. Please try again tomorrow, or check the fallback sample response in the app.",
        }),
        { status: 429, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    if (visitorCount >= PER_VISITOR_DAILY_CAP) {
      return new Response(
        JSON.stringify({
          error: "visitor_limit_reached",
          message:
            "You've hit the per-visitor demo limit for today. Thanks for trying it out!",
        }),
        { status: 429, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // ---- Call Claude ----
    try {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: system || undefined,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        return new Response(
          JSON.stringify({ error: "upstream_error", message: errText }),
          { status: 502, headers: { ...headers, "Content-Type": "application/json" } }
        );
      }

      const data = await claudeRes.json();

      // Only increment counters on a successful upstream call
      await Promise.all([
        incrCount(env.RATE_LIMIT_KV, globalKey),
        incrCount(env.RATE_LIMIT_KV, visitorKey),
      ]);

      const text = (data.content || [])
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim();

      return new Response(JSON.stringify({ text }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "worker_error", message: String(err) }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }
  },
};
