/**
 * Shared Cloudflare Worker — Claude API proxy + ITSM ticket API + Auth
 * Used by: SOC Dashboard, ITSM Helpdesk, CRM (portfolio labs for jcalleon.github.io)
 *
 * Responsibilities, routed by path:
 *   POST /                    -> AI proxy (unchanged, used by all 3 apps)
 *   /auth/*                   -> signup, login, logout, session check, admin approval
 *   /tickets/*                -> Real ITSM ticket API, backed by D1
 *   /stats                    -> Dashboard aggregate stats
 *
 * Required setup (see DEPLOY.md / DEPLOY_AUTH.md):
 *   wrangler secret put ANTHROPIC_API_KEY
 *   wrangler d1 create itsm-db   (bind as DB)
 *   wrangler kv namespace create RATE_LIMIT_KV  (bind as RATE_LIMIT_KV)
 *   wrangler d1 execute itsm-db --remote --file=schema.sql
 *   wrangler d1 execute itsm-db --remote --file=schema_auth.sql
 *   Email Routing configured + your address verified as destination (see DEPLOY_AUTH.md)
 *   send_email binding named NOTIFY_EMAIL in wrangler.toml
 */
import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

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

// Where ticket notification emails get sent. Must be a verified destination
// address in your Cloudflare Email Routing setup (see DEPLOY_AUTH.md).
const NOTIFY_TO_EMAIL = "jcalleon@outlook.com";
const NOTIFY_FROM_EMAIL = "notifications@jcalleon.github.io"; // display-only if using MailChannels-style sending

// The one account with full control across all 3 apps: approving signups,
// and granting admin status (in any app) to anyone else. This is checked by
// email, not by a role column, so it can never be edited away by accident
// through the admin panel itself.
const SUPERADMIN_EMAIL = "jcalleon@outlook.com";

function isSuperadmin(user) {
  return !!user && user.email === SUPERADMIN_EMAIL;
}

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token",
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

// ============================================================
// PASSWORD HASHING (Web Crypto PBKDF2 — built into Workers runtime)
// ============================================================
function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes;
}

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex ? hexToBuf(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: bufToHex(derived), salt: bufToHex(salt) };
}

async function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = await hashPassword(password, storedSalt);
  return hash === storedHash;
}

function genToken() {
  return bufToHex(crypto.getRandomValues(new Uint8Array(32)));
}

// ============================================================
// SESSION HELPERS
// ============================================================
async function getSessionUser(request, env) {
  const token = request.headers.get("X-Session-Token") || "";
  if (!token) return null;

  const session = await env.DB.prepare(
    `SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')`
  ).bind(token).first();
  if (!session) return null;

  const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(session.user_id).first();
  if (!user || !user.approved) return null;

  return user;
}

// ============================================================
// EMAIL NOTIFICATIONS (Cloudflare Email Routing — free to verified address)
// ============================================================
async function sendNotificationEmail(env, subject, bodyText) {
  if (!env.NOTIFY_EMAIL) return; // binding not configured, skip silently
  try {
    const msg = createMimeMessage();
    msg.setSender({ name: "Helpdesk Notifications", addr: NOTIFY_FROM_EMAIL });
    msg.setRecipient(NOTIFY_TO_EMAIL);
    msg.setSubject(subject);
    msg.addMessage({ contentType: "text/plain", data: bodyText });

    const message = new EmailMessage(NOTIFY_FROM_EMAIL, NOTIFY_TO_EMAIL, msg.asRaw());
    await env.NOTIFY_EMAIL.send(message);
  } catch (err) {
    console.error("Email notification failed:", err);
  }
}

// ============================================================
// AI PROXY (unchanged behavior — used by SOC, ITSM AI triage, CRM)
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
    return json({ error: "demo_limit_reached", message: "This demo has hit its daily AI request cap. Please try again tomorrow." }, 429, headers);
  }
  if (visitorCount >= PER_VISITOR_DAILY_CAP) {
    return json({ error: "visitor_limit_reached", message: "You've hit the per-visitor demo limit for today. Thanks for trying it out!" }, 429, headers);
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
// AUTH ENDPOINTS
// ============================================================

// POST /auth/signup — create a new account, starts unapproved.
async function signup(request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!email || !email.includes("@")) return json({ error: "Valid email required" }, 400, headers);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400, headers);

  const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first();
  if (existing) return json({ error: "email_taken", message: "An account with this email already exists." }, 409, headers);

  const { hash, salt } = await hashPassword(password);
  const id = genId("USR");
  const now = new Date().toISOString();

  // First-ever user becomes admin + auto-approved (bootstrap). Everyone after needs approval.
  const userCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM users`).first();
  const isFirstUser = userCount.count === 0;

  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, salt, role, crm_role, soc_role, directory_role, approved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, email, hash, salt,
    isFirstUser ? "admin" : "agent",
    isFirstUser ? "admin" : "agent",
    isFirstUser ? "admin" : "agent",
    isFirstUser ? "admin" : "agent",
    isFirstUser ? 1 : 0,
    now
  ).run();

  if (!isFirstUser) {
    await sendNotificationEmail(
      env,
      "New signup pending approval",
      `${email} just signed up and is waiting for approval. One approval grants access to ITSM, CRM, SOC, and Directory.\n\nApprove them from the admin panel: https://jcalleon.github.io/portfolio-labs/itsm-helpdesk/admin.html`
    );
  }

  return json({
    message: isFirstUser ? "Account created as admin." : "Account created. An admin needs to approve your access before you can log in — once approved, you'll have access to all three apps.",
    approved: isFirstUser,
  }, 201, headers);
}

// POST /auth/login — verify credentials, create a session.
async function login(request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  const user = await env.DB.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).first();
  if (!user) return json({ error: "invalid_credentials", message: "Email or password is incorrect." }, 401, headers);

  const valid = await verifyPassword(password, user.password_hash, user.salt);
  if (!valid) return json({ error: "invalid_credentials", message: "Email or password is incorrect." }, 401, headers);

  if (!user.approved) {
    return json({ error: "not_approved", message: "Your account is pending admin approval." }, 403, headers);
  }

  const token = genToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DURATION_MS);
  await env.DB.prepare(
    `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(token, user.id, now.toISOString(), expires.toISOString()).run();

  return json({
    token,
    user: {
      id: user.id,
      email: user.email,
      itsm_role: user.role,
      crm_role: user.crm_role,
      soc_role: user.soc_role,
      directory_role: user.directory_role,
      is_superadmin: isSuperadmin(user),
    },
  }, 200, headers);
}

// POST /auth/logout
async function logout(request, env, headers) {
  const token = request.headers.get("X-Session-Token") || "";
  if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
  return json({ message: "Logged out" }, 200, headers);
}

// GET /auth/me — check current session
async function me(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  return json({
    user: {
      id: user.id,
      email: user.email,
      itsm_role: user.role,
      crm_role: user.crm_role,
      soc_role: user.soc_role,
      directory_role: user.directory_role,
      is_superadmin: isSuperadmin(user),
    },
  }, 200, headers);
}

// GET /auth/pending — list unapproved users. Superadmin-only: only
// jcalleon@outlook.com can approve signups.
async function listPending(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!isSuperadmin(user)) return json({ error: "unauthorized" }, 401, headers);

  const { results } = await env.DB.prepare(
    `SELECT id, email, role, crm_role, soc_role, directory_role, created_at FROM users WHERE approved = 0 ORDER BY created_at ASC`
  ).all();
  return json({ pending: results }, 200, headers);
}

// GET /auth/users — list all users. Superadmin-only.
async function listUsers(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!isSuperadmin(user)) return json({ error: "unauthorized" }, 401, headers);

  const { results } = await env.DB.prepare(
    `SELECT id, email, role, crm_role, soc_role, directory_role, approved, created_at FROM users ORDER BY created_at DESC`
  ).all();
  return json({ users: results }, 200, headers);
}

// PATCH /auth/users/:id — approve/reject (account-wide, superadmin-only), or
// change a per-app role (action: "set_role", app: "itsm"|"crm"|"soc",
// role: "admin"|"agent"|"none"). Setting role to "admin" in any app is
// superadmin-only; setting "agent"/"none" is also currently restricted to
// the superadmin, since no other admin tier exists yet in this app's model.
async function updateUser(id, request, env, headers) {
  const admin = await getSessionUser(request, env);
  if (!isSuperadmin(admin)) return json({ error: "unauthorized" }, 401, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const ROLE_COLUMN_BY_APP = { itsm: "role", crm: "crm_role", soc: "soc_role", directory: "directory_role" };
  const VALID_ROLES = ["admin", "agent", "none"];

  // The superadmin account itself can't be rejected or demoted through this
  // panel — avoids ever locking yourself out by accident.
  if (id === admin.id && (body.action === "reject" || (body.action === "set_role" && body.role !== "admin"))) {
    return json({ error: "cannot_modify_self", message: "You can't remove or demote your own account." }, 400, headers);
  }

  if (body.action === "approve") {
    // Single approval gate — unlocks ITSM, CRM, and SOC at agent level at once.
    await env.DB.prepare(`UPDATE users SET approved = 1 WHERE id = ?`).bind(id).run();
  } else if (body.action === "reject") {
    await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
  } else if (body.action === "set_role" && VALID_ROLES.includes(body.role)) {
    const app = body.app || "itsm"; // default to itsm for backward compatibility with old callers
    const column = ROLE_COLUMN_BY_APP[app];
    if (!column) return json({ error: "Invalid app" }, 400, headers);
    await env.DB.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).bind(body.role, id).run();
  } else {
    return json({ error: "Invalid action" }, 400, headers);
  }

  return json({ message: "Updated" }, 200, headers);
}

// ============================================================
// TICKET API (now session-based instead of shared password)
// ============================================================

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

  await sendNotificationEmail(
    env,
    `New ticket: ${subject}`,
    `${requester} (${department || "Unspecified"}) submitted a new ticket.\n\nSubject: ${subject}\n\n${message}\n\nTicket ID: ${id}\nView it in your queue: https://jcalleon.github.io/portfolio-labs/itsm-helpdesk/index.html`
  );

  return json({ ticket: { id, requester, department: department || "Unspecified", subject, body: message, category: "Other", priority: "medium", status: "new", created_at: now, sla_due: slaDue } }, 201, headers);
}

async function listTickets(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);

  const { results } = await env.DB.prepare(
    `SELECT t.*, u.email as assigned_email,
       (SELECT MAX(created_at) FROM messages m WHERE m.ticket_id = t.id AND m.sender = 'requester') as last_requester_msg_at
     FROM tickets t
     LEFT JOIN users u ON u.id = t.assigned_to
     ORDER BY
       CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
       t.sla_due ASC`
  ).all();

  const tickets = results.map((t) => ({
    ...t,
    has_unread_reply: !!(t.last_requester_msg_at && (!t.agent_last_viewed_at || t.last_requester_msg_at > t.agent_last_viewed_at)),
  }));

  return json({ tickets }, 200, headers);
}

async function getTicket(id, request, env, headers) {
  const ticket = await env.DB.prepare(`SELECT * FROM tickets WHERE id = ?`).bind(id).first();
  if (!ticket) return json({ error: "not_found" }, 404, headers);

  const user = await getSessionUser(request, env);
  const url = new URL(request.url);
  const claimedRequester = url.searchParams.get("requester") || "";

  if (!user && claimedRequester.trim().toLowerCase() !== ticket.requester.trim().toLowerCase()) {
    return json({ error: "unauthorized" }, 401, headers);
  }

  const { results: messages } = await env.DB.prepare(
    `SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at ASC`
  ).bind(id).all();

  const rating = await env.DB.prepare(`SELECT * FROM ratings WHERE ticket_id = ?`).bind(id).first();

  const { results: auditLog } = await env.DB.prepare(
    `SELECT * FROM audit_log WHERE ticket_id = ? ORDER BY created_at DESC`
  ).bind(id).all();

  let assignedEmail = null;
  if (ticket.assigned_to) {
    const assignee = await env.DB.prepare(`SELECT email FROM users WHERE id = ?`).bind(ticket.assigned_to).first();
    assignedEmail = assignee ? assignee.email : null;
  }

  // Agent viewing the ticket marks it as seen (used for the unread-reply indicator).
  if (user) {
    await env.DB.prepare(`UPDATE tickets SET agent_last_viewed_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), id).run();
  }

  return json({ ticket, messages, rating: rating || null, auditLog, assignedEmail }, 200, headers);
}

async function updateTicket(id, request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const current = await env.DB.prepare(`SELECT * FROM tickets WHERE id = ?`).bind(id).first();
  if (!current) return json({ error: "not_found" }, 404, headers);

  const fields = [];
  const values = [];
  const auditEntries = [];

  for (const key of ["status", "priority", "category", "assigned_to"]) {
    if (body[key] !== undefined && body[key] !== current[key]) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
      auditEntries.push({ field: key, old: current[key], new: body[key] });
    }
  }
  if (fields.length === 0) return json({ error: "No updatable fields supplied" }, 400, headers);

  values.push(id);
  await env.DB.prepare(`UPDATE tickets SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();

  for (const entry of auditEntries) {
    await env.DB.prepare(
      `INSERT INTO audit_log (id, ticket_id, actor_email, field, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(genId("AUD"), id, user.email, entry.field, entry.old, entry.new, new Date().toISOString()).run();
  }

  const ticket = await env.DB.prepare(`SELECT * FROM tickets WHERE id = ?`).bind(id).first();
  return json({ ticket }, 200, headers);
}

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

  const user = await getSessionUser(request, env);
  if (sender === "agent" && !user) {
    return json({ error: "unauthorized" }, 401, headers);
  }
  if (sender === "requester" && !user) {
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

  if (sender === "requester") {
    await sendNotificationEmail(
      env,
      `New reply on ${id}: ${ticket.subject}`,
      `${ticket.requester} replied:\n\n${message}\n\nView it in your queue: https://jcalleon.github.io/portfolio-labs/itsm-helpdesk/index.html`
    );
  }

  return json({ message: { id: msgId, ticket_id: id, sender, body: message, created_at: now } }, 201, headers);
}

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

// POST /tickets/bulk-update — apply the same status/priority/assigned_to change
// to multiple tickets at once. Agent-only.
async function bulkUpdateTickets(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const { ticketIds, field, value } = body;
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return json({ error: "ticketIds must be a non-empty array" }, 400, headers);
  }
  if (!["status", "priority", "assigned_to"].includes(field)) {
    return json({ error: "Invalid field for bulk update" }, 400, headers);
  }

  let updated = 0;
  for (const ticketId of ticketIds) {
    const current = await env.DB.prepare(`SELECT * FROM tickets WHERE id = ?`).bind(ticketId).first();
    if (!current || current[field] === value) continue;

    await env.DB.prepare(`UPDATE tickets SET ${field} = ? WHERE id = ?`).bind(value, ticketId).run();
    await env.DB.prepare(
      `INSERT INTO audit_log (id, ticket_id, actor_email, field, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(genId("AUD"), ticketId, user.email, field, current[field], value, new Date().toISOString()).run();
    updated++;
  }

  return json({ message: `Updated ${updated} ticket(s).`, updated }, 200, headers);
}

// POST /alerts/bulk-dismiss — marks multiple alerts resolved with
// resolution_reason = 'ai_bulk_dismissed', after the frontend's single AI
// call has already assessed the batch as likely false positives. This
// endpoint does NOT call the AI itself — same division of responsibility
// as saveTriage: the AI call happens client-side via the existing proxy,
// this just persists the resulting decision.
// POST /alerts/bulk-update — manual bulk status or assignment change,
// human-driven (no AI involved). Distinct from /alerts/bulk-dismiss, which
// requires the AI to assess each alert first. This is the direct
// equivalent of ITSM's bulkUpdateTickets — select alerts you've already
// reviewed yourself, change them all at once.
async function bulkUpdateAlerts(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  if (user.soc_role === "none") return json({ error: "unauthorized" }, 401, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const { alertIds, field, value } = body;
  if (!Array.isArray(alertIds) || alertIds.length === 0) {
    return json({ error: "alertIds must be a non-empty array" }, 400, headers);
  }
  if (!["status", "assigned_to"].includes(field)) {
    return json({ error: "Invalid field for bulk update" }, 400, headers);
  }

  let updated = 0;
  const now = new Date().toISOString();
  for (const alertId of alertIds) {
    const current = await env.DB.prepare(`SELECT * FROM alerts WHERE id = ?`).bind(alertId).first();
    if (!current || current[field] === value) continue;

    if (field === "status" && value === "resolved") {
      // Manual resolve gets resolution_reason = 'manual' — keeps it
      // distinguishable from AI-dismissed alerts in the table and in
      // investigation-view counts, same reasoning as the v6 migration.
      await env.DB.prepare(`UPDATE alerts SET status = ?, resolution_reason = 'manual' WHERE id = ?`).bind(value, alertId).run();
    } else if (field === "status") {
      // Reopening or moving to investigating clears any stale resolution
      // tag from a previous resolve/dismiss cycle.
      await env.DB.prepare(`UPDATE alerts SET status = ?, resolution_reason = NULL WHERE id = ?`).bind(value, alertId).run();
    } else {
      await env.DB.prepare(`UPDATE alerts SET ${field} = ? WHERE id = ?`).bind(value, alertId).run();
    }

    await env.DB.prepare(
      `INSERT INTO alert_audit_log (id, alert_id, actor_email, field, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(genId("AAUD"), alertId, user.email, field, current[field], value, now).run();
    updated++;
  }

  return json({ message: `Updated ${updated} alert(s).`, updated }, 200, headers);
}

async function bulkDismissAlerts(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  if (user.soc_role === "none") return json({ error: "unauthorized" }, 401, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const { alertIds } = body;
  if (!Array.isArray(alertIds) || alertIds.length === 0) {
    return json({ error: "alertIds must be a non-empty array" }, 400, headers);
  }

  let dismissed = 0;
  const now = new Date().toISOString();
  for (const alertId of alertIds) {
    const current = await env.DB.prepare(`SELECT * FROM alerts WHERE id = ?`).bind(alertId).first();
    if (!current || current.status === "resolved") continue; // skip already-resolved, nothing to do

    await env.DB.prepare(
      `UPDATE alerts SET status = 'resolved', resolution_reason = 'ai_bulk_dismissed' WHERE id = ?`
    ).bind(alertId).run();

    await env.DB.prepare(
      `INSERT INTO alert_audit_log (id, alert_id, actor_email, field, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(genId("AAUD"), alertId, user.email, "status", current.status, "resolved (AI bulk dismiss)", now).run();

    dismissed++;
  }

  return json({ message: `Dismissed ${dismissed} alert(s) as false positives.`, dismissed }, 200, headers);
}

// GET /auth/agents — list approved agents (for assignment dropdown). Any logged-in user.
async function listAlerts(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);

  const { results } = await env.DB.prepare(
    `SELECT a.*, u.email as assigned_email
     FROM alerts a
     LEFT JOIN users u ON u.id = a.assigned_to
     ORDER BY
       CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       a.created_at DESC`
  ).all();

  return json({ alerts: results }, 200, headers);
}

async function getAlert(id, request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);

  const alert = await env.DB.prepare(`SELECT * FROM alerts WHERE id = ?`).bind(id).first();
  if (!alert) return json({ error: "not_found" }, 404, headers);

  const { results: auditLog } = await env.DB.prepare(
    `SELECT * FROM alert_audit_log WHERE alert_id = ? ORDER BY created_at DESC`
  ).bind(id).all();

  const { results: notes } = await env.DB.prepare(
    `SELECT * FROM alert_notes WHERE alert_id = ? ORDER BY created_at ASC`
  ).bind(id).all();

  let assignedEmail = null;
  if (alert.assigned_to) {
    const assignee = await env.DB.prepare(`SELECT email FROM users WHERE id = ?`).bind(alert.assigned_to).first();
    assignedEmail = assignee ? assignee.email : null;
  }

  return json({ alert, auditLog, notes, assignedEmail }, 200, headers);
}

async function updateAlert(id, request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  if (user.soc_role === "none") return json({ error: "unauthorized" }, 401, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const current = await env.DB.prepare(`SELECT * FROM alerts WHERE id = ?`).bind(id).first();
  if (!current) return json({ error: "not_found" }, 404, headers);

  const fields = [];
  const values = [];
  const auditEntries = [];

  for (const key of ["status", "assigned_to"]) {
    if (body[key] !== undefined && body[key] !== current[key]) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
      auditEntries.push({ field: key, old: current[key], new: body[key] });
    }
  }
  if (fields.length === 0) return json({ error: "No updatable fields supplied" }, 400, headers);

  values.push(id);
  await env.DB.prepare(`UPDATE alerts SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();

  for (const entry of auditEntries) {
    await env.DB.prepare(
      `INSERT INTO alert_audit_log (id, alert_id, actor_email, field, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(genId("AAUD"), id, user.email, entry.field, entry.old, entry.new, new Date().toISOString()).run();
  }

  const alert = await env.DB.prepare(`SELECT * FROM alerts WHERE id = ?`).bind(id).first();
  return json({ alert }, 200, headers);
}

// POST /alerts/:id/triage — saves an AI triage result onto the alert so it
// survives a page reload / drawer close instead of being lost the moment
// the response leaves the drawer. Does NOT call the AI itself — the
// frontend still calls the existing AI proxy directly, then POSTs the
// parsed result here to persist it.
async function saveTriage(id, request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  if (user.soc_role === "none") return json({ error: "unauthorized" }, 401, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const { verdict, confidence, analysis, nextStep } = body;
  if (!verdict || !analysis) {
    return json({ error: "verdict and analysis are required" }, 400, headers);
  }

  const current = await env.DB.prepare(`SELECT * FROM alerts WHERE id = ?`).bind(id).first();
  if (!current) return json({ error: "not_found" }, 404, headers);

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE alerts SET triage_verdict = ?, triage_confidence = ?, triage_analysis = ?, triage_next_step = ?, triaged_at = ? WHERE id = ?`
  ).bind(verdict, confidence || null, analysis, nextStep || null, now, id).run();

  await env.DB.prepare(
    `INSERT INTO alert_audit_log (id, alert_id, actor_email, field, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(genId("AAUD"), id, user.email, "triage", current.triage_verdict || null, verdict, now).run();

  const alert = await env.DB.prepare(`SELECT * FROM alerts WHERE id = ?`).bind(id).first();
  return json({ alert }, 200, headers);
}

// POST /alerts/:id/notes — adds an analyst investigation note. Single
// author type (always an authenticated analyst), unlike ITSM's messages
// which distinguish agent vs requester — that distinction doesn't apply
// here since there's no second party on an alert.
async function addNote(id, request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  if (user.soc_role === "none") return json({ error: "unauthorized" }, 401, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const noteBody = (body.body || "").trim();
  if (!noteBody) return json({ error: "Note body is required" }, 400, headers);
  if (noteBody.length > 4000) return json({ error: "Note is too long (max 4000 characters)" }, 400, headers);

  const alert = await env.DB.prepare(`SELECT id FROM alerts WHERE id = ?`).bind(id).first();
  if (!alert) return json({ error: "not_found" }, 404, headers);

  const now = new Date().toISOString();
  const noteId = genId("NOTE");
  await env.DB.prepare(
    `INSERT INTO alert_notes (id, alert_id, actor_email, body, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(noteId, id, user.email, noteBody, now).run();

  return json({ note: { id: noteId, alert_id: id, actor_email: user.email, body: noteBody, created_at: now } }, 201, headers);
}

async function listAgents(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);

  const { results } = await env.DB.prepare(
    `SELECT id, email FROM users WHERE approved = 1 ORDER BY email ASC`
  ).all();
  return json({ agents: results }, 200, headers);
}

// GET /soc/agents — list users with SOC access (soc_role != 'none'), for
// the alert-assignment dropdown. Mirrors listAgents but scoped to SOC.
async function listSocAgents(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);

  const { results } = await env.DB.prepare(
    `SELECT id, email FROM users WHERE approved = 1 AND soc_role != 'none' ORDER BY email ASC`
  ).all();
  return json({ agents: results }, 200, headers);
}

// ============================================================
// DIRECTORY APP (AD users + RADIUS/TACACS+ history)
// ============================================================
// Phase D: now gated on directory_role, same pattern as SOC's soc_role.

async function listAdUsers(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  if (user.directory_role === "none") return json({ error: "unauthorized" }, 401, headers);

  const { results } = await env.DB.prepare(
    `SELECT * FROM ad_users ORDER BY
       CASE status WHEN 'locked' THEN 0 WHEN 'disabled' THEN 1 ELSE 2 END,
       display_name ASC`
  ).all();

  // groups is stored as JSON text — parse it back into a real array for
  // the frontend rather than making every caller do this themselves.
  const users = results.map((u) => ({ ...u, groups: JSON.parse(u.groups) }));
  return json({ users }, 200, headers);
}

async function getAdUser(id, request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  if (user.directory_role === "none") return json({ error: "unauthorized" }, 401, headers);

  const adUser = await env.DB.prepare(`SELECT * FROM ad_users WHERE id = ?`).bind(id).first();
  if (!adUser) return json({ error: "not_found" }, 404, headers);
  adUser.groups = JSON.parse(adUser.groups);

  const { results: radiusEvents } = await env.DB.prepare(
    `SELECT * FROM radius_events WHERE user_id = ? ORDER BY timestamp DESC`
  ).bind(id).all();

  const { results: tacacsEvents } = await env.DB.prepare(
    `SELECT * FROM tacacs_events WHERE user_id = ? ORDER BY timestamp DESC`
  ).bind(id).all();

  const { results: auditLog } = await env.DB.prepare(
    `SELECT * FROM directory_audit_log WHERE user_id = ? ORDER BY created_at DESC`
  ).bind(id).all();

  return json({ user: adUser, radiusEvents, tacacsEvents, auditLog }, 200, headers);
}

// PATCH /directory/users/:id — change account status (enabled/disabled/
// locked). Mirrors updateAlert's diff-and-audit-log pattern.
async function updateAdUserStatus(id, request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  if (user.directory_role === "none") return json({ error: "unauthorized" }, 401, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const { status } = body;
  if (!["enabled", "disabled", "locked"].includes(status)) {
    return json({ error: "Invalid status" }, 400, headers);
  }

  const current = await env.DB.prepare(`SELECT * FROM ad_users WHERE id = ?`).bind(id).first();
  if (!current) return json({ error: "not_found" }, 404, headers);
  if (current.status === status) {
    return json({ error: "No change — already in that state" }, 400, headers);
  }

  await env.DB.prepare(`UPDATE ad_users SET status = ? WHERE id = ?`).bind(status, id).run();

  await env.DB.prepare(
    `INSERT INTO directory_audit_log (id, user_id, actor_email, field, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(genId("DAUD"), id, user.email, "status", current.status, status, new Date().toISOString()).run();

  const updated = await env.DB.prepare(`SELECT * FROM ad_users WHERE id = ?`).bind(id).first();
  updated.groups = JSON.parse(updated.groups);
  return json({ user: updated }, 200, headers);
}

// POST /directory/users/:id/analyze — saves an AI anomaly-analysis result
// onto the user so it persists past the drawer closing. Mirrors SOC's
// saveTriage exactly: the AI call itself happens client-side via the
// existing proxy, this endpoint just persists the resulting verdict.
async function saveAnomalyAnalysis(id, request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  if (user.directory_role === "none") return json({ error: "unauthorized" }, 401, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const { verdict, confidence, analysis, nextStep } = body;
  if (!verdict || !analysis) {
    return json({ error: "verdict and analysis are required" }, 400, headers);
  }

  const current = await env.DB.prepare(`SELECT id FROM ad_users WHERE id = ?`).bind(id).first();
  if (!current) return json({ error: "not_found" }, 404, headers);

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE ad_users SET anomaly_verdict = ?, anomaly_confidence = ?, anomaly_analysis = ?, anomaly_next_step = ?, anomaly_analyzed_at = ? WHERE id = ?`
  ).bind(verdict, confidence || null, analysis, nextStep || null, now, id).run();

  const updated = await env.DB.prepare(`SELECT * FROM ad_users WHERE id = ?`).bind(id).first();
  updated.groups = JSON.parse(updated.groups);
  return json({ user: updated }, 200, headers);
}

// POST /directory/users/bulk-analyze — saves AI anomaly-analysis results
// for multiple users at once, after the frontend's single batched AI call
// has already assessed all of them together. Mirrors SOC's
// bulkDismissAlerts: this endpoint persists, it doesn't call the AI.
async function bulkSaveAnomalyAnalysis(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  if (user.directory_role === "none") return json({ error: "unauthorized" }, 401, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const { results } = body; // [{ userId, verdict, confidence, analysis, nextStep }, ...]
  if (!Array.isArray(results) || results.length === 0) {
    return json({ error: "results must be a non-empty array" }, 400, headers);
  }

  let saved = 0;
  const now = new Date().toISOString();
  for (const r of results) {
    if (!r.userId || !r.verdict || !r.analysis) continue; // skip malformed entries rather than fail the whole batch
    const current = await env.DB.prepare(`SELECT id FROM ad_users WHERE id = ?`).bind(r.userId).first();
    if (!current) continue;

    await env.DB.prepare(
      `UPDATE ad_users SET anomaly_verdict = ?, anomaly_confidence = ?, anomaly_analysis = ?, anomaly_next_step = ?, anomaly_analyzed_at = ? WHERE id = ?`
    ).bind(r.verdict, r.confidence || null, r.analysis, r.nextStep || null, now, r.userId).run();
    saved++;
  }

  return json({ message: `Saved analysis for ${saved} user(s).`, saved }, 200, headers);
}

// GET /directory/groups — list all groups, for the new-user form's group
// checkboxes and (later) group management itself.
async function listGroups(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  if (user.directory_role === "none") return json({ error: "unauthorized" }, 401, headers);

  const { results } = await env.DB.prepare(
    `SELECT * FROM directory_groups ORDER BY name ASC`
  ).all();
  return json({ groups: results }, 200, headers);
}

// Generates a username from a display name the same way the seed data's
// usernames look (e.g. "Jane Doe" -> "jdoe"... but the existing convention
// is actually "first initial + last name" with NO separator for regular
// users (jalvarez, mosei, dpatel) and "svc-" prefix for service accounts.
// This mirrors that exact convention so new users fit the existing pattern.
function generateUsername(displayName) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const first = parts[0][0].toLowerCase();
  const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${first}${last}`;
}

// POST /directory/users — create a new AD user. Username can be supplied
// directly (the frontend auto-generates one from the display name and
// lets the person override it before submitting) or omitted, in which case
// this generates one server-side as a fallback.
async function createAdUser(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);
  if (user.directory_role === "none") return json({ error: "unauthorized" }, 401, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const displayName = (body.displayName || "").trim();
  const department = (body.department || "").trim();
  const title = (body.title || "").trim();
  const email = body.email ? body.email.trim() : null;
  const groupIds = Array.isArray(body.groupIds) ? body.groupIds : [];
  let username = (body.username || "").trim().toLowerCase();

  if (!displayName) return json({ error: "Display name is required" }, 400, headers);
  if (!department) return json({ error: "Department is required" }, 400, headers);
  if (!title) return json({ error: "Title is required" }, 400, headers);

  if (!username) username = generateUsername(displayName);
  if (!username) return json({ error: "Couldn't determine a username — provide one directly" }, 400, headers);

  const existing = await env.DB.prepare(`SELECT id FROM ad_users WHERE id = ?`).bind(username).first();
  if (existing) return json({ error: "username_taken", message: `Username "${username}" is already in use.` }, 409, headers);

  // groups (the legacy JSON column) is kept in sync with the real
  // directory_group_members rows below, so every existing page that reads
  // ad_users.groups directly (the table, the drawer) keeps working
  // without modification — the join table is the source of truth, this
  // column is a derived cache of it.
  const now = new Date().toISOString();
  const groupNames = [];
  if (groupIds.length > 0) {
    const { results: groupRows } = await env.DB.prepare(
      `SELECT id, name FROM directory_groups WHERE id IN (${groupIds.map(() => "?").join(",")})`
    ).bind(...groupIds).all();
    for (const g of groupRows) groupNames.push(g.name);
  }
  // Every user is in Domain Users by convention, matching every existing
  // seed user — add it automatically if it wasn't explicitly selected.
  if (!groupNames.includes("Domain Users")) {
    const domainUsersGroup = await env.DB.prepare(`SELECT id, name FROM directory_groups WHERE name = 'Domain Users'`).first();
    if (domainUsersGroup) {
      groupIds.push(domainUsersGroup.id);
      groupNames.push(domainUsersGroup.name);
    }
  }

  const ou = `OU=${department.replace(/[^a-zA-Z0-9 ]/g, "")},OU=Users,DC=corp,DC=internal`;

  await env.DB.prepare(
    `INSERT INTO ad_users (id, display_name, email, department, ou, title, status, groups, last_logon, created_at, mfa_enrolled) VALUES (?, ?, ?, ?, ?, ?, 'enabled', ?, NULL, ?, 0)`
  ).bind(username, displayName, email, department, ou, title, JSON.stringify(groupNames), now).run();

  for (const groupId of groupIds) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO directory_group_members (group_id, user_id, added_at) VALUES (?, ?, ?)`
    ).bind(groupId, username, now).run();
  }

  await env.DB.prepare(
    `INSERT INTO directory_audit_log (id, user_id, actor_email, field, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(genId("DAUD"), username, user.email, "created", null, "account created", now).run();

  const created = await env.DB.prepare(`SELECT * FROM ad_users WHERE id = ?`).bind(username).first();
  created.groups = JSON.parse(created.groups);
  return json({ user: created }, 201, headers);
}

// GET /stats — aggregate dashboard data. Agent-only.
async function getStats(request, env, headers) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401, headers);

  const byStatus = await env.DB.prepare(`SELECT status, COUNT(*) as count FROM tickets GROUP BY status`).all();
  const byPriority = await env.DB.prepare(`SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority`).all();
  const byCategory = await env.DB.prepare(`SELECT category, COUNT(*) as count FROM tickets GROUP BY category`).all();
  const slaBreaches = await env.DB.prepare(`SELECT COUNT(*) as count FROM tickets WHERE status != 'resolved' AND sla_due < datetime('now')`).first();
  const ratings = await env.DB.prepare(`SELECT AVG(stars) as avg_stars, COUNT(*) as count FROM ratings`).first();
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

    if (path === "/" || path === "") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);
      return handleAIProxy(request, env, headers);
    }

    // ---- Auth routes ----
    if (path === "/auth/signup" && request.method === "POST") return signup(request, env, headers);
    if (path === "/auth/login" && request.method === "POST") return login(request, env, headers);
    if (path === "/auth/logout" && request.method === "POST") return logout(request, env, headers);
    if (path === "/auth/me" && request.method === "GET") return me(request, env, headers);
    if (path === "/auth/pending" && request.method === "GET") return listPending(request, env, headers);
    if (path === "/auth/users" && request.method === "GET") return listUsers(request, env, headers);

    const userMatch = path.match(/^\/auth\/users\/([^\/]+)$/);
    if (userMatch && request.method === "PATCH") return updateUser(userMatch[1], request, env, headers);

    // ---- Ticket routes ----
    if (path === "/tickets" && request.method === "POST") return createTicket(request, env, headers);
    if (path === "/tickets" && request.method === "GET") return listTickets(request, env, headers);
    if (path === "/tickets/bulk-update" && request.method === "POST") return bulkUpdateTickets(request, env, headers);
    if (path === "/auth/agents" && request.method === "GET") return listAgents(request, env, headers);
    if (path === "/stats" && request.method === "GET") return getStats(request, env, headers);

    // ---- SOC alert routes ----
    if (path === "/alerts" && request.method === "GET") return listAlerts(request, env, headers);
    if (path === "/alerts/bulk-update" && request.method === "POST") return bulkUpdateAlerts(request, env, headers);
    if (path === "/alerts/bulk-dismiss" && request.method === "POST") return bulkDismissAlerts(request, env, headers);
    if (path === "/soc/agents" && request.method === "GET") return listSocAgents(request, env, headers);

    // ---- Directory app routes ----
    if (path === "/directory/users" && request.method === "GET") return listAdUsers(request, env, headers);
    if (path === "/directory/users" && request.method === "POST") return createAdUser(request, env, headers);
    if (path === "/directory/users/bulk-analyze" && request.method === "POST") return bulkSaveAnomalyAnalysis(request, env, headers);
    if (path === "/directory/groups" && request.method === "GET") return listGroups(request, env, headers);

    const ticketMatch = path.match(/^\/tickets\/([^\/]+)$/);
    if (ticketMatch && request.method === "GET") return getTicket(ticketMatch[1], request, env, headers);
    if (ticketMatch && request.method === "PATCH") return updateTicket(ticketMatch[1], request, env, headers);

    const messagesMatch = path.match(/^\/tickets\/([^\/]+)\/messages$/);
    if (messagesMatch && request.method === "POST") return addMessage(messagesMatch[1], request, env, headers);

    const ratingMatch = path.match(/^\/tickets\/([^\/]+)\/rating$/);
    if (ratingMatch && request.method === "POST") return submitRating(ratingMatch[1], request, env, headers);

    const alertTriageMatch = path.match(/^\/alerts\/([^\/]+)\/triage$/);
    if (alertTriageMatch && request.method === "POST") return saveTriage(alertTriageMatch[1], request, env, headers);

    const alertNotesMatch = path.match(/^\/alerts\/([^\/]+)\/notes$/);
    if (alertNotesMatch && request.method === "POST") return addNote(alertNotesMatch[1], request, env, headers);

    const alertMatch = path.match(/^\/alerts\/([^\/]+)$/);
    if (alertMatch && request.method === "GET") return getAlert(alertMatch[1], request, env, headers);
    if (alertMatch && request.method === "PATCH") return updateAlert(alertMatch[1], request, env, headers);

    const directoryUserMatch = path.match(/^\/directory\/users\/([^\/]+)$/);
    if (directoryUserMatch && request.method === "GET") return getAdUser(directoryUserMatch[1], request, env, headers);
    if (directoryUserMatch && request.method === "PATCH") return updateAdUserStatus(directoryUserMatch[1], request, env, headers);

    const directoryAnalyzeMatch = path.match(/^\/directory\/users\/([^\/]+)\/analyze$/);
    if (directoryAnalyzeMatch && request.method === "POST") return saveAnomalyAnalysis(directoryAnalyzeMatch[1], request, env, headers);

    return json({ error: "not_found" }, 404, headers);
  },
};
