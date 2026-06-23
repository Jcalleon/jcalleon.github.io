/**
 * Shared Cloudflare Worker — Claude API proxy + ITSM ticket API
 * Used by: SOC Dashboard, ITSM Helpdesk, CRM (portfolio labs for jcalleon.github.io)
 *
 * Two responsibilities, routed by path:
 *   POST /              -> AI proxy (unchanged behavior, used by all 3 apps)
 *   /tickets/*          -> Real ITSM ticket API, backed by D1 (see schema.sql)
 *
 * Required setup (see DEPLOY.md):
 *   wrangler secret put ANTHROPIC_API_KEY
 *   wrangler secret put AGENT_PASSWORD
 *   wrangler d1 create itsm-db   (then bind as DB in wrangler.toml)
 *   wrangler kv namespace create RATE_LIMIT_KV  (bind as RATE_LIMIT_KV)
 */

// ---- Hard caps for the AI proxy. Tune these, but never remove them. ----
const GLOBAL_DAILY_CAP = 300;
const PER_VISITOR_DAILY_CAP = 15;
const MAX_TOKENS = 400;
const MODEL = "claude-sonnet-4-6";

const ALLOWED_ORIGINS = [
  "https://jcalleon.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Agent-Password",
    "Vary": "Origin",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getCount(kv, key) {
  const v = await kv.get(key);
  return v ? parseInt(v, 10) : 0;
}

async function incrCount(kv, key) {
  const current = await getCount(kv, key);
  await kv.put(key, String(current + 1), { expirationTtl: 60 * 60 * 26 });
  return current + 1;
}

function genId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function isAgentAuthed(request, env) {
  const supplied = request.headers.get("X-Agent-Password") || "";
  return env.AGENT_PASSWORD && supplied === env.AGENT_PASSWORD;
}

// ============================================================
// AI PROXY (original behavior — used by SOC, ITSM AI triage, CRM)
// ============================================================
async function handleAIProxy(request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const { app, system, prompt } = body;
  if (!app || !prompt) {
    return json({ error: "Missing app or prompt" }, 400, headers);
  }

  const day = todayKey();
  const visitorId = request.headers.get("CF-Connecting-IP") || "unknown-visitor";
  const visitorKey = `v:${day}:${visitorId}`;
  const globalKey = `g:${day}`;

  const [globalCount, visitorCount] = await Promise.all([
    getCount(env.RATE_LIMIT_KV, globalKey),
    getCount(env.RATE_LIMIT_KV, visitorKey),
  ]);

  if (globalCount >= GLOBAL_DAILY_CAP) {
    return json(
      { error: "demo_limit_reached", message: "This demo has hit its daily AI request cap. Please try again tomorrow." },
      429, headers
    );
  }
  if (visitorCount >= PER_VISITOR_DAILY_CAP) {
    return json(
      { error: "visitor_limit_reached", message: "You've hit the per-visitor demo limit for today. Thanks for trying it out!" },
      429, headers
    );
  }

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
      return json({ error: "upstream_error", message: errText }, 502, headers);
    }

    const data = await claudeRes.json();
    await Promise.all([
      incrCount(env.RATE_LIMIT_KV, globalKey),
      incrCount(env.RATE_LIMIT_KV, visitorKey),
    ]);

    const text = (data.content || [])
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    return json({ text }, 200, headers);
  } catch (err) {
    return json({ error: "worker_error", message: String(err) }, 500, headers);
  }
}

// ============================================================
// TICKET API (real persistence via D1)
// ============================================================

// POST /tickets — create a ticket. Public. No auth required.
async function createTicket(request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const { requester, department, subject, message } = body;
  if (!requester || !subject || !message) {
    return json({ error: "Missing requester, subject, or message" }, 400, headers);
  }

  const id = genId("TKT");
  const now = new Date().toISOString();
  const slaDue = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO tickets (id, requester, department, subject, body, category, priority, status, created_at, sla_due)
     VALUES (?, ?, ?, ?, ?, 'Other', 'medium', 'new', ?, ?)`
  ).bind(id, requester, department || "Unspecified", subject, message, now, slaDue).run();

  return json({ ticket: { id, requester, department: department || "Unspecified", subject, body: message, category: "Other", priority: "medium", status: "new", created_at: now, sla_due: slaDue } }, 201, headers);
}

// GET /tickets — list all tickets. Agent-only.
async function listTickets(request, env, headers) {
  if (!isAgentAuthed(request, env)) {
    return json({ error: "unauthorized" }, 401, headers);
  }
  const { results } = await env.DB.prepare(
    `SELECT * FROM tickets ORDER BY
       CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
       sla_due ASC`
  ).all();
  return json({ tickets: results }, 200, headers);
}

// GET /tickets/:id — get one ticket + its messages + rating.
// Agent (authed) can fetch any. Requester can fetch their own if they supply ?requester=name matching.
async function getTicket(id, request, env, headers) {
  const ticket = await env.DB.prepare(`SELECT * FROM tickets WHERE id = ?`).bind(id).first();
  if (!ticket) return json({ error: "not_found" }, 404, headers);

  const authed = isAgentAuthed(request, env);
  const url = new URL(request.url);
  const claimedRequester = url.searchParams.get("requester") || "";

  if (!authed && claimedRequester.trim().toLowerCase() !== ticket.requester.trim().toLowerCase()) {
    return json({ error: "unauthorized" }, 401, headers);
  }

  const { results: messages } = await env.DB.prepare(
    `SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at ASC`
  ).bind(id).all();

  const rating = await env.DB.prepare(`SELECT * FROM ratings WHERE ticket_id = ?`).bind(id).first();

  return json({ ticket, messages, rating: rating || null }, 200, headers);
}

// PATCH /tickets/:id — update status/priority/category. Agent-only.
async function updateTicket(id, request, env, headers) {
  if (!isAgentAuthed(request, env)) {
    return json({ error: "unauthorized" }, 401, headers);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const fields = [];
  const values = [];
  for (const key of ["status", "priority", "category"]) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  if (fields.length === 0) return json({ error: "No updatable fields supplied" }, 400, headers);

  values.push(id);
  await env.DB.prepare(`UPDATE tickets SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();

  const ticket = await env.DB.prepare(`SELECT * FROM tickets WHERE id = ?`).bind(id).first();
  return json({ ticket }, 200, headers);
}

// POST /tickets/:id/messages — add a reply. Agent (authed) or requester (matching name).
async function addMessage(id, request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const { sender, message, requester } = body;
  if (!sender || !message || !["agent", "requester"].includes(sender)) {
    return json({ error: "Missing or invalid sender/message" }, 400, headers);
  }

  const ticket = await env.DB.prepare(`SELECT * FROM tickets WHERE id = ?`).bind(id).first();
  if (!ticket) return json({ error: "not_found" }, 404, headers);

  const authed = isAgentAuthed(request, env);
  if (sender === "agent" && !authed) {
    return json({ error: "unauthorized" }, 401, headers);
  }
  if (sender === "requester" && !authed) {
    const claimed = (requester || "").trim().toLowerCase();
    if (claimed !== ticket.requester.trim().toLowerCase()) {
      return json({ error: "unauthorized" }, 401, headers);
    }
  }

  const msgId = genId("MSG");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO messages (id, ticket_id, sender, body, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(msgId, id, sender, message, now).run();

  return json({ message: { id: msgId, ticket_id: id, sender, body: message, created_at: now } }, 201, headers);
}

// POST /tickets/:id/rating — submit a star rating + comment. Public, but only on resolved tickets.
async function submitRating(id, request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const { stars, comment } = body;
  const starsNum = parseInt(stars, 10);
  if (!starsNum || starsNum < 1 || starsNum > 5) {
    return json({ error: "stars must be 1-5" }, 400, headers);
  }

  const ticket = await env.DB.prepare(`SELECT * FROM tickets WHERE id = ?`).bind(id).first();
  if (!ticket) return json({ error: "not_found" }, 404, headers);
  if (ticket.status !== "resolved") {
    return json({ error: "ticket_not_resolved", message: "Feedback can only be left on resolved tickets." }, 400, headers);
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO ratings (ticket_id, stars, comment, created_at) VALUES (?, ?, ?, ?)`
  ).bind(id, starsNum, comment || "", now).run();

  return json({ rating: { ticket_id: id, stars: starsNum, comment: comment || "", created_at: now } }, 201, headers);
}

// GET /stats — aggregate dashboard data. Agent-only.
async function getStats(request, env, headers) {
  if (!isAgentAuthed(request, env)) {
    return json({ error: "unauthorized" }, 401, headers);
  }

  const byStatus = await env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM tickets GROUP BY status`
  ).all();
  const byPriority = await env.DB.prepare(
    `SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority`
  ).all();
  const byCategory = await env.DB.prepare(
    `SELECT category, COUNT(*) as count FROM tickets GROUP BY category`
  ).all();
  const slaBreaches = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM tickets WHERE status != 'resolved' AND sla_due < datetime('now')`
  ).first();
  const ratings = await env.DB.prepare(
    `SELECT AVG(stars) as avg_stars, COUNT(*) as count FROM ratings`
  ).first();
  const recentRatings = await env.DB.prepare(
    `SELECT r.*, t.subject FROM ratings r JOIN tickets t ON t.id = r.ticket_id ORDER BY r.created_at DESC LIMIT 10`
  ).all();

  return json({
    byStatus: byStatus.results,
    byPriority: byPriority.results,
    byCategory: byCategory.results,
    slaBreaches: slaBreaches.count,
    avgRating: ratings.avg_stars,
    ratingCount: ratings.count,
    recentRatings: recentRatings.results,
  }, 200, headers);
}

// ============================================================
// ROUTER
// ============================================================
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: "Origin not allowed" }, 403, headers);
    }

    // Root path: original AI proxy behavior, unchanged
    if (path === "/" || path === "") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);
      return handleAIProxy(request, env, headers);
    }

    // Ticket API
    if (path === "/tickets" && request.method === "POST") {
      return createTicket(request, env, headers);
    }
    if (path === "/tickets" && request.method === "GET") {
      return listTickets(request, env, headers);
    }
    if (path === "/stats" && request.method === "GET") {
      return getStats(request, env, headers);
    }

    const ticketMatch = path.match(/^\/tickets\/([^\/]+)$/);
    if (ticketMatch && request.method === "GET") {
      return getTicket(ticketMatch[1], request, env, headers);
    }
    if (ticketMatch && request.method === "PATCH") {
      return updateTicket(ticketMatch[1], request, env, headers);
    }

    const messagesMatch = path.match(/^\/tickets\/([^\/]+)\/messages$/);
    if (messagesMatch && request.method === "POST") {
      return addMessage(messagesMatch[1], request, env, headers);
    }

    const ratingMatch = path.match(/^\/tickets\/([^\/]+)\/rating$/);
    if (ratingMatch && request.method === "POST") {
      return submitRating(ratingMatch[1], request, env, headers);
    }

    return json({ error: "not_found" }, 404, headers);
  },
};
