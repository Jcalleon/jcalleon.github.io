/**
 * Client for the real ITSM ticket + auth API (backed by D1 via the Worker).
 * Used by itsm-helpdesk/index.html, submit.html, check-status.html,
 * dashboard.html, login.html, signup.html, admin.html.
 *
 * IMPORTANT: must match WORKER_URL in ../shared/ai-client.js
 */
const TICKETS_API_BASE = "https://portfolio-ai-proxy.jcalleon.workers.dev";

function getSessionToken() {
  return localStorage.getItem("itsm_session_token") || "";
}
function setSessionToken(token) {
  localStorage.setItem("itsm_session_token", token);
}
function clearSessionToken() {
  localStorage.removeItem("itsm_session_token");
}
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("itsm_user") || "null"); } catch { return null; }
}
function setStoredUser(user) {
  localStorage.setItem("itsm_user", JSON.stringify(user));
}
function clearStoredUser() {
  localStorage.removeItem("itsm_user");
}

/**
 * Calls the ticket/auth API.
 * @param {string} path
 * @param {Object} opts
 * @param {string} opts.method
 * @param {Object} opts.body
 * @param {boolean} opts.authed - if true, attaches the session token header
 */
async function ticketApi(path, { method = "GET", body, authed = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authed) {
    headers["X-Session-Token"] = getSessionToken();
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

/** Redirects to login.html if no session is present. Call at the top of agent-only pages. */
function requireAuthOrRedirect() {
  if (!getSessionToken()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}
