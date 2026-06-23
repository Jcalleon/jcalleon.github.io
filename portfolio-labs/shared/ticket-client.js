/**
 * Client for the real ITSM ticket API (backed by D1 via the Worker).
 * Used by itsm-helpdesk/index.html (agent), itsm-helpdesk/submit.html (public),
 * and itsm-helpdesk/dashboard.html (agent stats).
 *
 * IMPORTANT: must match WORKER_URL in ../shared/ai-client.js
 */
const TICKETS_API_BASE = "https://portfolio-ai-proxy.jcalleon.workers.dev";

function getStoredAgentPassword() {
  return sessionStorage.getItem("itsm_agent_password") || "";
}
function setStoredAgentPassword(pw) {
  sessionStorage.setItem("itsm_agent_password", pw);
}
function clearStoredAgentPassword() {
  sessionStorage.removeItem("itsm_agent_password");
}

async function ticketApi(path, { method = "GET", body, asAgent = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (asAgent) {
    headers["X-Agent-Password"] = getStoredAgentPassword();
  }
  try {
    const res = await fetch(`${TICKETS_API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error, message: data.message };
    }
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: "network_error", message: "Couldn't reach the server right now." };
  }
}
