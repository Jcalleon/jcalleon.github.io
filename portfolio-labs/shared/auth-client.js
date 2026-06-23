/**
 * Shared auth client — centralized login across SOC, ITSM, and CRM.
 * Used by: soc-dashboard, crm (and conceptually itsm-helpdesk, which already
 * has its own copy of this logic baked into ticket-client.js).
 *
 * SSO mechanism: all three apps live under the same origin
 * (https://jcalleon.github.io), and localStorage is shared per-origin in the
 * browser. By using the exact same keys ITSM already uses (itsm_session_token,
 * itsm_user), a login in any one app is automatically recognized by the
 * other two — no cookies, no extra CORS config, no separate token store needed.
 *
 * IMPORTANT: must match AUTH_API_BASE in ../shared/ticket-client.js and
 * WORKER_URL in ../shared/ai-client.js — all three point at the same Worker.
 */
const AUTH_API_BASE = "https://portfolio-ai-proxy.jcalleon.workers.dev";

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
 * Calls the shared auth API (signup/login/logout/me).
 * @param {string} path
 * @param {Object} opts
 * @param {string} opts.method
 * @param {Object} opts.body
 * @param {boolean} opts.authed - if true, attaches the session token header
 */
async function authApi(path, { method = "GET", body, authed = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authed) {
    headers["X-Session-Token"] = getSessionToken();
  }
  try {
    const res = await fetch(`${AUTH_API_BASE}${path}`, {
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

/**
 * Redirects to login.html if no session is present. Call at the top of
 * any agent-only page, before rendering real content.
 * @returns {boolean} true if a session token exists (does NOT guarantee it's
 *   still valid server-side — pair with requireValidSessionOrRedirect for that).
 */
function requireAuthOrRedirect() {
  if (!getSessionToken()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

/**
 * Stronger check: actually verifies the session against the server (catches
 * expired/revoked tokens, not just "a token exists locally"). Call this once
 * on page load for pages where stale access is unacceptable.
 * @param {string} appRole - "itsm_role" | "crm_role" | "soc_role"
 * @returns {Promise<Object|null>} the user object if valid, otherwise null
 *   (and redirects to login.html as a side effect).
 */
async function requireValidSessionOrRedirect(appRole) {
  if (!getSessionToken()) {
    window.location.href = "login.html";
    return null;
  }
  const res = await authApi("/auth/me", { authed: true });
  if (!res.ok) {
    clearSessionToken();
    clearStoredUser();
    window.location.href = "login.html";
    return null;
  }
  setStoredUser(res.user); // refresh local copy in case an admin changed roles since last login
  return res.user;
}

/** Logs out and redirects to this app's login page. */
async function doLogout() {
  await authApi("/auth/logout", { method: "POST", authed: true });
  clearSessionToken();
  clearStoredUser();
  window.location.href = "login.html";
}
