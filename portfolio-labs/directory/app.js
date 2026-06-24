// Directory — app logic
//
// Phase B: fetches AD users + RADIUS/TACACS+ history from the real
// Worker/D1 backend instead of static data.js. Account status changes
// (enable/disable/lock) now persist, with an audit trail.
//
// Deliberately NOT auth-gated yet — these API calls don't send a session
// token. Phase D wires this app into the same centralized auth as
// SOC/ITSM/CRM; until then, the backend routes are intentionally open
// (see worker.js comments) so this app works standalone.

const WORKER_URL = "https://portfolio-ai-proxy.jcalleon.workers.dev";

async function directoryApi(path, { method = "GET", body } = {}) {
  try {
    const res = await fetch(`${WORKER_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
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

// D1 returns snake_case columns directly from SELECT * — normalize once
// here at the boundary rather than rewrite every reference throughout the
// rest of this file to snake_case.
function normalizeUser(u) {
  return {
    id: u.id,
    displayName: u.display_name,
    email: u.email,
    department: u.department,
    ou: u.ou,
    title: u.title,
    status: u.status,
    groups: Array.isArray(u.groups) ? u.groups : JSON.parse(u.groups || "[]"),
    lastLogon: u.last_logon,
    created: u.created_at,
    mfaEnrolled: !!u.mfa_enrolled,
  };
}

function normalizeRadiusEvent(e) {
  return {
    id: e.id,
    userId: e.user_id,
    timestamp: e.timestamp,
    nas: e.nas,
    result: e.result,
    authType: e.auth_type,
    sourceIp: e.source_ip,
    rejectReason: e.reject_reason,
  };
}

function normalizeTacacsEvent(e) {
  return {
    id: e.id,
    userId: e.user_id,
    timestamp: e.timestamp,
    device: e.device,
    privilegeLevel: e.privilege_level,
    result: e.result,
    command: e.command,
    rejectReason: e.reject_reason,
  };
}

let users = [];
let currentFilter = "all";
let currentDeptFilter = null;
let searchQuery = "";
let selectedUserId = null;

const tbody = document.getElementById("user-tbody");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const drawerBody = document.getElementById("drawer-body");
const drawerUserId = document.getElementById("drawer-user-id");
const mainPanel = document.querySelector(".main .panel");

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toISOString().slice(0, 19).replace("T", " ") + "Z";
}

function relativeTime(iso) {
  if (!iso) return "—";
  const now = new Date("2026-06-23T09:30:00Z"); // fixed "now" matching the seed data's timeframe
  const then = new Date(iso);
  const mins = Math.round((now - then) / 60000);
  if (mins < 0) return formatTime(iso);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / (60 * 24))}d ago`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function statusBadgeClass(status) {
  if (status === "enabled") return "success";
  if (status === "disabled") return "info";
  if (status === "locked") return "critical";
  return "info";
}

const AD_STATUS_ORDER = { locked: 0, disabled: 1, enabled: 2 };

// ---- Data loading ----

async function loadUsers() {
  const res = await directoryApi("/directory/users");
  if (!res.ok) {
    mainPanel.innerHTML = `<div class="empty-state">Couldn't load the directory. ${escapeHtml(res.message || "Try refreshing the page.")}</div>`;
    return false;
  }
  users = res.users.map(normalizeUser);
  return true;
}

function updateCounts() {
  document.getElementById("count-all").textContent = users.length;
  document.getElementById("count-enabled").textContent = users.filter((u) => u.status === "enabled").length;
  document.getElementById("count-disabled").textContent = users.filter((u) => u.status === "disabled").length;
  document.getElementById("count-locked").textContent = users.filter((u) => u.status === "locked").length;

  const deptCounts = {
    "count-dept-finance": "Finance",
    "count-dept-engineering": "Engineering",
    "count-dept-marketing": "Marketing",
    "count-dept-hr": "Human Resources",
    "count-dept-sales": "Sales",
    "count-dept-itops": "IT Operations",
  };
  for (const [elId, dept] of Object.entries(deptCounts)) {
    document.getElementById(elId).textContent = users.filter((u) => u.department === dept).length;
  }
}

function getFilteredUsers() {
  let list = [...users];
  if (currentFilter !== "all") {
    list = list.filter((u) => u.status === currentFilter);
  }
  if (currentDeptFilter) {
    list = list.filter((u) => u.department === currentDeptFilter);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    list = list.filter((u) =>
      [u.displayName, u.id, u.email, u.department, u.title]
        .some((field) => (field || "").toLowerCase().includes(q))
    );
  }
  return list.sort((a, b) => {
    const statusDiff = (AD_STATUS_ORDER[a.status] ?? 9) - (AD_STATUS_ORDER[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    return a.displayName.localeCompare(b.displayName);
  });
}

function renderTable() {
  const list = getFilteredUsers();
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No users match this filter.</div></td></tr>`;
    return;
  }

  for (const user of list) {
    const tr = document.createElement("tr");
    tr.className = user.id === selectedUserId ? "selected" : "";
    tr.innerHTML = `
      <td><span class="badge badge-${statusBadgeClass(user.status)}">${user.status}</span></td>
      <td>
        <div class="user-title-cell">
          <span class="user-title-main">${escapeHtml(user.displayName)}</span>
          <span class="user-title-sub mono">${escapeHtml(user.email || "no email — service account")}</span>
        </div>
      </td>
      <td class="mono">${escapeHtml(user.id)}</td>
      <td>${escapeHtml(user.department)}</td>
      <td>${escapeHtml(user.title)}</td>
      <td>${user.mfaEnrolled ? '<span class="badge badge-success">enrolled</span>' : '<span class="badge badge-info">not enrolled</span>'}</td>
      <td class="mono" style="color:var(--text-dim); font-size:11px;">${relativeTime(user.lastLogon)}</td>
    `;
    tr.addEventListener("click", () => openDrawer(user.id));
    tbody.appendChild(tr);
  }
}

// ---- Drawer ----

async function openDrawer(userId) {
  selectedUserId = userId;
  renderTable();
  const user = users.find((u) => u.id === userId);
  drawerUserId.textContent = user.displayName;
  drawerBody.innerHTML = `<div class="demo-note">Loading history...</div>`;
  drawer.classList.add("open");
  drawerOverlay.classList.add("open");

  const res = await directoryApi(`/directory/users/${encodeURIComponent(userId)}`);
  if (!res.ok) {
    drawerBody.innerHTML = `<div class="empty-state">Couldn't load this user's history. ${escapeHtml(res.message || "")}</div>`;
    return;
  }

  const radius = res.radiusEvents.map(normalizeRadiusEvent);
  const tacacs = res.tacacsEvents.map(normalizeTacacsEvent);

  drawerBody.innerHTML = renderDrawerContent(user, radius, tacacs, res.auditLog || []);
  attachDrawerHandlers(user);
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawerOverlay.classList.remove("open");
  selectedUserId = null;
  renderTable();
}

function renderDrawerContent(user, radius, tacacs, auditLog) {
  const radiusRows = radius.length === 0
    ? `<div class="demo-note">No RADIUS authentication events for this user.</div>`
    : radius
        .map(
          (e) => `<div class="history-entry ${e.result === "reject" ? "history-entry-reject" : ""}">
            <div class="history-entry-top">
              <span class="badge badge-${e.result === "accept" ? "success" : "critical"}">${e.result}</span>
              <span class="mono" style="font-size:11px; color:var(--text-dim);">${formatTime(e.timestamp)}</span>
            </div>
            <div class="history-entry-detail">NAS: ${escapeHtml(e.nas)} · ${escapeHtml(e.authType)} · ${escapeHtml(e.sourceIp)}</div>
            ${e.rejectReason ? `<div class="history-entry-reason">${escapeHtml(e.rejectReason.replace(/_/g, " "))}</div>` : ""}
          </div>`
        )
        .join("");

  const tacacsRows = tacacs.length === 0
    ? `<div class="demo-note">No TACACS+ device admin events for this user.</div>`
    : tacacs
        .map(
          (e) => `<div class="history-entry ${e.result === "reject" ? "history-entry-reject" : ""}">
            <div class="history-entry-top">
              <span class="badge badge-${e.result === "accept" ? "success" : "critical"}">${e.result}</span>
              <span class="mono" style="font-size:11px; color:var(--text-dim);">${formatTime(e.timestamp)}</span>
            </div>
            <div class="history-entry-detail">${escapeHtml(e.device)} · privilege level ${e.privilegeLevel}</div>
            ${e.command ? `<div class="history-entry-command mono">$ ${escapeHtml(e.command)}</div>` : ""}
            ${e.rejectReason ? `<div class="history-entry-reason">${escapeHtml(e.rejectReason.replace(/_/g, " "))}</div>` : ""}
          </div>`
        )
        .join("");

  const auditRows = auditLog.length === 0
    ? `<div class="demo-note">No status changes logged yet.</div>`
    : auditLog
        .map(
          (a) => `<div class="demo-note" style="margin-bottom:4px;">
            ${formatTime(a.created_at)} — ${escapeHtml(a.actor_email)} changed ${a.field}:
            ${escapeHtml(a.old_value || "—")} → ${escapeHtml(a.new_value || "—")}
          </div>`
        )
        .join("");

  return `
    <div class="detail-section">
      <div class="detail-label">User</div>
      <div style="font-size:14px; font-weight:600; margin-bottom:4px;">${escapeHtml(user.displayName)}</div>
      <div style="font-size:12px; color:var(--text-dim);">${escapeHtml(user.title)} · ${escapeHtml(user.department)}</div>
    </div>

    <div class="detail-section">
      <div class="detail-grid">
        <div>
          <div class="detail-field-label">Username</div>
          <div class="detail-field-value">${escapeHtml(user.id)}</div>
        </div>
        <div>
          <div class="detail-field-label">Email</div>
          <div class="detail-field-value">${escapeHtml(user.email || "—")}</div>
        </div>
        <div>
          <div class="detail-field-label">OU</div>
          <div class="detail-field-value" style="font-size:11px;">${escapeHtml(user.ou)}</div>
        </div>
        <div>
          <div class="detail-field-label">MFA</div>
          <div class="detail-field-value">${user.mfaEnrolled ? "Enrolled" : "Not enrolled"}</div>
        </div>
        <div>
          <div class="detail-field-label">Account created</div>
          <div class="detail-field-value">${formatTime(user.created)}</div>
        </div>
        <div>
          <div class="detail-field-label">Last logon</div>
          <div class="detail-field-value">${formatTime(user.lastLogon)}</div>
        </div>
        <div>
          <div class="detail-field-label">Account status</div>
          <select class="status-select" id="status-select">
            <option value="enabled" ${user.status === "enabled" ? "selected" : ""}>Enabled</option>
            <option value="disabled" ${user.status === "disabled" ? "selected" : ""}>Disabled</option>
            <option value="locked" ${user.status === "locked" ? "selected" : ""}>Locked</option>
          </select>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">Group memberships</div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        ${user.groups.map((g) => `<span class="badge badge-info">${escapeHtml(g)}</span>`).join("")}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">RADIUS — network &amp; VPN authentication (${radius.length})</div>
      ${radiusRows}
    </div>

    <div class="detail-section">
      <div class="detail-label">TACACS+ — device administration (${tacacs.length})</div>
      ${tacacsRows}
    </div>

    <div class="detail-section">
      <div class="detail-label">Audit trail</div>
      ${auditRows}
    </div>
  `;
}

function attachDrawerHandlers(user) {
  document.getElementById("drawer-close").onclick = closeDrawer;

  document.getElementById("status-select").onchange = async (e) => {
    const newStatus = e.target.value;
    const select = e.target;
    select.disabled = true;
    const res = await directoryApi(`/directory/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      body: { status: newStatus },
    });
    select.disabled = false;
    if (!res.ok) {
      window.alert(res.message || "Couldn't save that status change.");
      select.value = user.status; // revert the dropdown to the last known-good value
      return;
    }
    const updated = normalizeUser(res.user);
    Object.assign(user, updated);
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx !== -1) users[idx] = updated;
    updateCounts();
    renderTable();
    openDrawer(user.id); // re-fetch to show the new audit log entry
  };
}

// ---- Nav filtering ----
document.querySelectorAll("[data-filter]").forEach((el) => {
  el.addEventListener("click", () => {
    currentFilter = el.dataset.filter;
    currentDeptFilter = null;
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    el.classList.add("active");
    renderTable();
  });
});

document.querySelectorAll("[data-dept-filter]").forEach((el) => {
  el.addEventListener("click", () => {
    currentDeptFilter = el.dataset.deptFilter;
    currentFilter = "all";
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    el.classList.add("active");
    renderTable();
  });
});

const searchInput = document.getElementById("search-input");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderTable();
  });
}

drawerOverlay.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

// ---- Init ----
async function initDirectory() {
  const loaded = await loadUsers();
  if (!loaded) return;
  updateCounts();
  renderTable();
}

initDirectory();
