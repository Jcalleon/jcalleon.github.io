/**
 * Shared client for calling the portfolio AI proxy Worker.
 * Used identically by soc-dashboard, itsm-helpdesk, and crm.
 *
 * IMPORTANT: replace WORKER_URL below with your deployed Worker URL
 * after running `wrangler deploy` (see /worker/DEPLOY.md).
 */

const WORKER_URL = "https://portfolio-ai-proxy.jcalleon.workers.dev";

/**
 * Calls the shared Claude proxy.
 * @param {Object} opts
 * @param {string} opts.app - which app is calling ("soc" | "itsm" | "crm"), for logging
 * @param {string} opts.system - system prompt
 * @param {string} opts.prompt - user prompt
 * @returns {Promise<{ok: boolean, text?: string, error?: string, message?: string}>}
 */
async function callAI({ app, system, prompt, maxTokens }) {
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app, system, prompt, maxTokens }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: data.error || "unknown_error", message: data.message };
    }

    return { ok: true, text: data.text };
  } catch (err) {
    return {
      ok: false,
      error: "network_error",
      message: "Couldn't reach the AI service right now.",
    };
  }
}
