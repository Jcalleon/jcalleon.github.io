/**
 * Shared auth client — centralized login across SOC, ITSM, CRM, and Directory.
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
 * @param {string} [loginPath] - defaults to "login.html"; override for pages
 *   at a different folder depth (launcher, admin panel).
 * @returns {boolean} true if a session token exists (does NOT guarantee it's
 *   still valid server-side — pair with requireValidSessionOrRedirect for that).
 */
function requireAuthOrRedirect(loginPath) {
  if (!getSessionToken()) {
    window.location.href = loginPath || "login.html";
    return false;
  }
  return true;
}

/**
 * Stronger check: actually verifies the session against the server (catches
 * expired/revoked tokens, not just "a token exists locally"), and — if
 * appRole is given — enforces that this app's role isn't "none" before
 * letting the page proceed.
 * @param {string} [appRole] - "itsm_role" | "crm_role" | "soc_role". If
 *   omitted, only session validity is checked (used by the launcher/admin
 *   panel, which aren't gated by any single app's role).
 * @param {Object} [paths] - { login, noAccess } overrides for pages at a
 *   different folder depth than a single app (launcher, admin panel).
 * @returns {Promise<Object|null>} the user object if valid, otherwise null
 *   (and redirects as a side effect — to login.html if not logged in, or to
 *   no-access.html if logged in but this app's role is "none").
 */
async function requireValidSessionOrRedirect(appRole, paths) {
  const loginPath = (paths && paths.login) || "login.html";
  const noAccessPath = (paths && paths.noAccess) || "no-access.html";

  if (!getSessionToken()) {
    window.location.href = loginPath;
    return null;
  }
  const res = await authApi("/auth/me", { authed: true });
  if (!res.ok) {
    clearSessionToken();
    clearStoredUser();
    window.location.href = loginPath;
    return null;
  }
  setStoredUser(res.user); // refresh local copy in case the superadmin changed roles since last login

  if (appRole && res.user[appRole] === "none") {
    window.location.href = noAccessPath;
    return null;
  }

  return res.user;
}

/**
 * Logs out and redirects.
 * @param {string} [redirectTo] - defaults to "login.html" (correct for pages
 *   inside an app folder like crm/ or soc-dashboard/). Pages at a different
 *   depth (the launcher, the admin panel) should pass their own relative path.
 */
async function doLogout(redirectTo) {
  await authApi("/auth/logout", { method: "POST", authed: true });
  clearSessionToken();
  clearStoredUser();
  window.location.href = redirectTo || "login.html";
}
