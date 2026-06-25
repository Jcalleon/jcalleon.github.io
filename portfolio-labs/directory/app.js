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

// Named distinctly from ai-client.js's WORKER_URL (loaded on this same page)
// to avoid a duplicate `const` declaration — same value, different name.
const DIRECTORY_API_BASE = "https://portfolio-ai-proxy.jcalleon.workers.dev";

async function directoryApi(path, { method = "GET", body } = {}) {
  try {
    const res = await fetch(`${DIRECTORY_API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": getSessionToken(),
      },
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
    anomalyVerdict: u.anomaly_verdict,
    anomalyConfidence: u.anomaly_confidence,
    anomalyAnalysis: u.anomaly_analysis,
    anomalyNextStep: u.anomaly_next_step,
    anomalyAnalyzedAt: u.anomaly_analyzed_at,
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
let currentView = "users"; // "users" | "groups"
let groups = [];
let selectedGroupId = null; // used to distinguish a group drawer from a user drawer, since both reuse #drawer

const tbody = document.getElementById("user-tbody");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const drawerBody = document.getElementById("drawer-body");
const drawerUserId = document.getElementById("drawer-user-id");
const mainPanel = document.getElementById("table-panel");

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

async function loadGroups() {
  const res = await directoryApi("/directory/groups");
  if (!res.ok) return false;
  groups = res.groups;
  return true;
}

// ---- View switching (Phase E3) ----

function switchView(view) {
  currentView = view;
  document.querySelectorAll("[data-view]").forEach((n) => n.classList.remove("active"));
  document.querySelector(`[data-view="${view}"]`)?.classList.add("active");

  const groupsPanel = document.getElementById("groups-panel");
  const tablePanel = document.getElementById("table-panel");
  const scanAllPanel = document.getElementById("scan-all-btn")?.closest(".panel");

  if (view === "groups") {
    if (groupsPanel) groupsPanel.style.display = "block";
    if (tablePanel) tablePanel.style.display = "none";
    if (scanAllPanel) scanAllPanel.style.display = "none";
    renderGroupsTable();
  } else {
    if (groupsPanel) groupsPanel.style.display = "none";
    if (tablePanel) tablePanel.style.display = "block";
    if (scanAllPanel) scanAllPanel.style.display = "block";
    renderTable();
  }
}

function renderGroupsTable() {
  const tbody = document.getElementById("groups-tbody");
  if (!tbody) return;

  if (groups.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No groups yet.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  for (const group of [...groups].sort((a, b) => a.name.localeCompare(b.name))) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${escapeHtml(group.name)}</td>
      <td style="color:var(--text-dim); font-size:12px;">${escapeHtml(group.description || "—")}</td>
      <td class="mono">${group.member_count}</td>
      <td></td>
    `;
    tr.addEventListener("click", () => openGroupDrawer(group.id));
    tbody.appendChild(tr);
  }
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
  attachDrawerHandlers(user, radius, tacacs);
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawerOverlay.classList.remove("open");
  if (selectedGroupId) {
    selectedGroupId = null;
    renderGroupsTable();
  } else {
    selectedUserId = null;
    renderTable();
  }
}

async function openGroupDrawer(groupId) {
  selectedGroupId = groupId;
  const group = groups.find((g) => g.id === groupId);
  drawerUserId.textContent = group.name;
  drawerBody.innerHTML = `<div class="demo-note">Loading members...</div>`;
  drawer.classList.add("open");
  drawerOverlay.classList.add("open");

  const res = await directoryApi(`/directory/groups/${encodeURIComponent(groupId)}`);
  if (!res.ok) {
    drawerBody.innerHTML = `<div class="empty-state">Couldn't load this group. ${escapeHtml(res.message || "")}</div>`;
    return;
  }

  drawerBody.innerHTML = renderGroupDrawerContent(res.group, res.members);
  attachGroupDrawerHandlers(res.group, res.members);
}

function renderGroupDrawerContent(group, members) {
  const isDomainUsers = group.name === "Domain Users";

  const memberRows = members.length === 0
    ? `<div class="demo-note">No members yet.</div>`
    : members
        .map(
          (m) => `<div class="history-entry">
            <div class="history-entry-top">
              <span class="badge badge-${statusBadgeClass(m.status)}">${m.status}</span>
              <span class="mono" style="font-size:11px; color:var(--text-dim);">${escapeHtml(m.id)}</span>
            </div>
            <div class="history-entry-detail">${escapeHtml(m.display_name)} — ${escapeHtml(m.title)}, ${escapeHtml(m.department)}</div>
            ${
              isDomainUsers
                ? ""
                : `<button class="btn-secondary remove-member-btn" data-user-id="${m.id}" style="margin-top:6px; padding:4px 10px; font-size:11px;">Remove from group</button>`
            }
          </div>`
        )
        .join("");

  return `
    <div class="detail-section">
      <div class="detail-label">Group</div>
      <div style="font-size:14px; font-weight:600; margin-bottom:4px;">${escapeHtml(group.name)}</div>
      <div style="font-size:12px; color:var(--text-dim);">${escapeHtml(group.description || "No description.")}</div>
    </div>

    <div class="detail-section">
      <button class="copilot-trigger" id="rename-group-btn" style="padding:6px 14px; margin-right:8px;">Rename / edit description</button>
      ${
        isDomainUsers
          ? ""
          : `<button class="btn-secondary" id="delete-group-btn" style="padding:6px 14px;">Delete group</button>`
      }
      ${isDomainUsers ? `<div class="demo-note" style="margin-top:8px;">Domain Users can't be deleted — every account must remain in it.</div>` : ""}
    </div>

    <div class="detail-section">
      <div class="detail-label">Add member</div>
      <select class="status-select" id="add-member-select" style="width:100%;">
        <option value="">Select a user...</option>
        ${users
          .filter((u) => !members.some((m) => m.id === u.id))
          .map((u) => `<option value="${u.id}">${escapeHtml(u.displayName)} (${u.id})</option>`)
          .join("")}
      </select>
      <button class="copilot-trigger" id="add-member-btn" style="margin-top:8px; padding:6px 14px;">Add to group</button>
    </div>

    <div class="detail-section">
      <div class="detail-label">Members (${members.length})</div>
      ${memberRows}
    </div>
  `;
}

function attachGroupDrawerHandlers(group, members) {
  document.getElementById("drawer-close").onclick = closeDrawer;

  document.getElementById("rename-group-btn").onclick = () => openGroupModal(group);

  const deleteBtn = document.getElementById("delete-group-btn");
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      const confirmed = window.confirm(`Delete "${group.name}"? This can't be undone.`);
      if (!confirmed) return;
      const res = await directoryApi(`/directory/groups/${encodeURIComponent(group.id)}`, { method: "DELETE" });
      if (!res.ok) {
        window.alert(res.message || "Couldn't delete that group.");
        return;
      }
      closeDrawer();
      await loadGroups();
      renderGroupsTable();
    };
  }

  document.getElementById("add-member-btn").onclick = async () => {
    const select = document.getElementById("add-member-select");
    const userId = select.value;
    if (!userId) return;
    const res = await directoryApi(`/directory/groups/${encodeURIComponent(group.id)}/members`, {
      method: "POST",
      body: { userId },
    });
    if (!res.ok) {
      window.alert(res.message || "Couldn't add that member.");
      return;
    }
    await loadUsers(); // a user's groups JSON changed, keep the in-memory copy fresh
    await loadGroups(); // member_count changed
    openGroupDrawer(group.id); // re-fetch to show the updated member list
  };

  document.querySelectorAll(".remove-member-btn").forEach((btn) => {
    btn.onclick = async () => {
      const userId = btn.dataset.userId;
      const res = await directoryApi(`/directory/groups/${encodeURIComponent(group.id)}/members/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        window.alert(res.message || "Couldn't remove that member.");
        return;
      }
      await loadUsers();
      await loadGroups();
      openGroupDrawer(group.id);
    };
  });
}

function renderDrawerContent(user, radius, tacacs, auditLog) {
  // Saved anomaly-analysis result, if this user was analyzed in a previous
  // session — mirrors SOC's savedTriage pattern exactly, including the
  // lesson already learned there: persist it, don't lose it on drawer close.
  const savedAnalysis = user.anomalyVerdict
    ? `<div class="copilot-output">VERDICT: ${escapeHtml(user.anomalyVerdict)}
CONFIDENCE: ${escapeHtml(user.anomalyConfidence || "—")}

ANALYSIS: ${escapeHtml(user.anomalyAnalysis || "")}

RECOMMENDED NEXT STEP: ${escapeHtml(user.anomalyNextStep || "")}</div>
       <div class="demo-note">Analyzed ${user.anomalyAnalyzedAt ? formatTime(user.anomalyAnalyzedAt) : ""} — saved to this user.</div>`
    : "";

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
      <div class="detail-label">AI anomaly analysis</div>
      <button class="copilot-trigger" id="analyze-btn">✦ ${user.anomalyVerdict ? "Re-analyze access patterns" : "Analyze access patterns"}</button>
      <div class="demo-note">Live call to Claude via a rate-limited proxy. Capped per visitor/day. Results are saved to this user.</div>
      <div id="analysis-result" style="margin-top:12px;">${savedAnalysis}</div>
    </div>

    <div class="detail-section">
      <div class="detail-label">Audit trail</div>
      ${auditRows}
    </div>
  `;
}

function attachDrawerHandlers(user, radius, tacacs) {
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

  document.getElementById("analyze-btn").onclick = () => runAnalysis(user, radius, tacacs);
}

// ---- AI anomaly analysis ----

async function runAnalysis(user, radius, tacacs) {
  const btn = document.getElementById("analyze-btn");
  const resultEl = document.getElementById("analysis-result");

  btn.disabled = true;
  resultEl.innerHTML = `<div class="copilot-loading">
    <span class="copilot-dot"></span><span class="copilot-dot"></span><span class="copilot-dot"></span>
    Analyzing access patterns...
  </div>`;

  const system = `You are a security analyst's AI co-pilot embedded in an identity & access console. You will be given one user's AD profile and their full RADIUS (network/VPN auth) and TACACS+ (device admin) event history. Decide whether this access pattern looks normal for this person's role, or shows signs of compromise or misuse — rapid failed-then-successful logins, access attempts outside their normal role/privilege level, unusual timing, or device-admin attempts on systems they have no business touching.

Respond in this exact format, plain text, no markdown headers:

VERDICT: [Normal Activity / Needs Review / Likely Compromised]
CONFIDENCE: [Low/Medium/High]

ANALYSIS: 2-3 sentences explaining the reasoning, referencing the specific events given.

RECOMMENDED NEXT STEP: One concrete action.

Be specific to the actual events provided. Do not be generic. Keep total response under 150 words.`;

  const prompt = `User: ${user.displayName} (${user.id})
Title: ${user.title}, Department: ${user.department}
Account status: ${user.status}
Groups: ${user.groups.join(", ")}

RADIUS events (most recent first):
${radius.map((e) => `${e.timestamp} — ${e.result} via ${e.nas} (${e.authType}) from ${e.sourceIp}${e.rejectReason ? " — " + e.rejectReason : ""}`).join("\n") || "none"}

TACACS+ events (most recent first):
${tacacs.map((e) => `${e.timestamp} — ${e.result} on ${e.device} at privilege level ${e.privilegeLevel}${e.command ? " — ran: " + e.command : ""}${e.rejectReason ? " — " + e.rejectReason : ""}`).join("\n") || "none"}`;

  const res = await callAI({ app: "directory", system, prompt });
  btn.disabled = false;

  if (!res.ok) {
    resultEl.innerHTML = `<div class="copilot-error">${escapeHtml(res.message || "Demo limit reached.")}</div>`;
    return;
  }

  resultEl.innerHTML = `<div class="copilot-output">${escapeHtml(res.text)}</div>`;

  const parsed = parseAnalysisResponse(res.text);
  if (parsed) {
    const saveRes = await directoryApi(`/directory/users/${encodeURIComponent(user.id)}/analyze`, {
      method: "POST",
      body: parsed,
    });
    if (saveRes.ok) {
      const updated = normalizeUser(saveRes.user);
      Object.assign(user, updated);
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx !== -1) users[idx] = updated;
      btn.textContent = "✦ Re-analyze access patterns";
      resultEl.innerHTML = `<div class="copilot-output">${escapeHtml(res.text)}</div>
        <div class="demo-note">Analyzed just now — saved to this user.</div>`;
    }
    // If saving fails, the AI result is still shown above — same tradeoff
    // SOC's triage makes: don't block the visible result on a save failure.
  }
}

// Parses the model's plain-text response back into fields, same approach
// SOC's parseTriageResponse uses — the system prompt fixes this exact
// format, so a line-based parse is reliable here, not arbitrary free text.
function parseAnalysisResponse(text) {
  const verdictMatch = text.match(/VERDICT:\s*(.+)/i);
  const confidenceMatch = text.match(/CONFIDENCE:\s*(.+)/i);
  const analysisMatch = text.match(/ANALYSIS:\s*([\s\S]*?)(?=\n\s*RECOMMENDED NEXT STEP:|$)/i);
  const nextStepMatch = text.match(/RECOMMENDED NEXT STEP:\s*([\s\S]*)/i);

  if (!verdictMatch || !analysisMatch) return null;

  return {
    verdict: verdictMatch[1].trim(),
    confidence: confidenceMatch ? confidenceMatch[1].trim() : null,
    analysis: analysisMatch[1].trim(),
    nextStep: nextStepMatch ? nextStepMatch[1].trim() : null,
  };
}

// ---- Scan all users (one batched AI call, not one per user) ----

async function runScanAll() {
  const btn = document.getElementById("scan-all-btn");
  const resultEl = document.getElementById("scan-all-result");

  btn.disabled = true;
  resultEl.innerHTML = `<div class="copilot-loading">
    <span class="copilot-dot"></span><span class="copilot-dot"></span><span class="copilot-dot"></span>
    Scanning ${users.length} users for anomalies...
  </div>`;

  // Fetch full history for every user first — the bulk AI call needs each
  // user's RADIUS/TACACS+ events, not just the directory-listing summary.
  const histories = await Promise.all(
    users.map(async (u) => {
      const res = await directoryApi(`/directory/users/${encodeURIComponent(u.id)}`);
      if (!res.ok) return { user: u, radius: [], tacacs: [] };
      return {
        user: u,
        radius: res.radiusEvents.map(normalizeRadiusEvent),
        tacacs: res.tacacsEvents.map(normalizeTacacsEvent),
      };
    })
  );

  const system = `You are a security analyst's AI co-pilot embedded in an identity & access console. You will be given a batch of users, each with their AD profile and RADIUS/TACACS+ event history. For EACH user, decide if their access pattern looks normal, needs review, or looks like likely compromise/misuse.

Respond with one line per user, in EXACTLY this format, no other text:
<username>: NORMAL | <one short reason>
<username>: NEEDS_REVIEW | <one short reason>
<username>: LIKELY_COMPROMISED | <one short reason>

One line per user given, nothing else.`;

  const prompt = histories
    .map(
      ({ user, radius, tacacs }) => `User: ${user.id} (${user.title}, ${user.department}, status: ${user.status})
RADIUS: ${radius.map((e) => `${e.result}${e.rejectReason ? "(" + e.rejectReason + ")" : ""}`).join(", ") || "none"}
TACACS+: ${tacacs.map((e) => `${e.result}${e.rejectReason ? "(" + e.rejectReason + ")" : ""}`).join(", ") || "none"}`
    )
    .join("\n\n---\n\n");

  const res = await callAI({ app: "directory", system, prompt });
  btn.disabled = false;

  if (!res.ok) {
    resultEl.innerHTML = `<div class="copilot-error">${escapeHtml(res.message || "Demo limit reached — couldn't run the batch scan.")}</div>`;
    return;
  }

  const decisions = parseScanAllResponse(res.text, users.map((u) => u.id));
  const flagged = decisions.filter((d) => d.verdict !== "NORMAL");

  if (decisions.length === 0) {
    resultEl.innerHTML = `<div class="copilot-error">Couldn't parse the scan results. Try again.</div>`;
    return;
  }

  // Persist results for users that got a real decision, mapped into the
  // same verdict vocabulary saveAnomalyAnalysis/bulkSaveAnomalyAnalysis
  // expects (matching the per-user analyze flow's verdict strings).
  const VERDICT_LABELS = { NORMAL: "Normal Activity", NEEDS_REVIEW: "Needs Review", LIKELY_COMPROMISED: "Likely Compromised" };
  const bulkResults = decisions.map((d) => ({
    userId: d.id,
    verdict: VERDICT_LABELS[d.verdict] || d.verdict,
    confidence: "Medium",
    analysis: d.reason,
    nextStep: d.verdict === "LIKELY_COMPROMISED" ? "Disable the account and investigate immediately." : null,
  }));

  const saveRes = await directoryApi("/directory/users/bulk-analyze", {
    method: "POST",
    body: { results: bulkResults },
  });

  if (!saveRes.ok) {
    resultEl.innerHTML = `<div class="copilot-error">Scan completed but saving results failed: ${escapeHtml(saveRes.message || "unknown error")}</div>`;
    return;
  }

  resultEl.innerHTML = `<div class="copilot-output">Scanned ${decisions.length} user(s). ${
    flagged.length > 0
      ? `${flagged.length} flagged for review: ${flagged.map((f) => `${escapeHtml(f.id)} (${f.verdict.replace(/_/g, " ").toLowerCase()})`).join(", ")}.`
      : "No anomalies found."
  }</div>`;

  await loadUsers();
  renderTable();
  updateCounts();
}

function parseScanAllResponse(text, expectedIds) {
  const decisions = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9-]+):\s*(NORMAL|NEEDS_REVIEW|LIKELY_COMPROMISED)\s*\|?\s*(.*)$/i);
    if (!match) continue;
    const [, id, verdict, reason] = match;
    if (expectedIds.includes(id)) {
      decisions.push({ id, verdict: verdict.toUpperCase(), reason: reason || "" });
    }
  }
  return decisions;
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

const scanAllBtn = document.getElementById("scan-all-btn");
if (scanAllBtn) scanAllBtn.addEventListener("click", runScanAll);

drawerOverlay.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

// ---- New user creation (Phase E2) ----

// Mirrors the backend's generateUsername exactly, so the form shows the
// same auto-generated value the server would compute if the field were
// left untouched — the person can still edit it before submitting.
function generateUsernamePreview(displayName) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const first = parts[0][0].toLowerCase();
  const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${first}${last}`;
}

let usernameManuallyEdited = false;
let cachedGroups = [];

async function openNewUserModal() {
  const modal = document.getElementById("new-user-modal");
  modal.classList.add("open");

  // Reset the form every time it opens, so a previous attempt's input
  // doesn't linger if the person cancels and reopens it later.
  document.getElementById("nu-display-name").value = "";
  document.getElementById("nu-username").value = "";
  document.getElementById("nu-email").value = "";
  document.getElementById("nu-department").value = "";
  document.getElementById("nu-title").value = "";
  document.getElementById("new-user-error").innerHTML = "";
  usernameManuallyEdited = false;

  const groupList = document.getElementById("nu-group-list");
  if (cachedGroups.length === 0) {
    const res = await directoryApi("/directory/groups");
    if (res.ok) cachedGroups = res.groups;
  }

  if (cachedGroups.length === 0) {
    groupList.innerHTML = `<div class="demo-note">Couldn't load groups.</div>`;
  } else {
    groupList.innerHTML = cachedGroups
      .map(
        (g) => `<label class="group-checkbox-row">
          <input type="checkbox" value="${g.id}" data-group-name="${escapeHtml(g.name)}" ${g.name === "Domain Users" ? "checked disabled" : ""} />
          ${escapeHtml(g.name)}
        </label>`
      )
      .join("");
  }
}

function closeNewUserModal() {
  document.getElementById("new-user-modal").classList.remove("open");
}

async function submitNewUser() {
  const displayName = document.getElementById("nu-display-name").value.trim();
  const username = document.getElementById("nu-username").value.trim();
  const email = document.getElementById("nu-email").value.trim();
  const department = document.getElementById("nu-department").value.trim();
  const title = document.getElementById("nu-title").value.trim();
  const errorEl = document.getElementById("new-user-error");
  const submitBtn = document.getElementById("nu-submit");

  errorEl.innerHTML = "";
  if (!displayName || !department || !title) {
    errorEl.innerHTML = `<div class="copilot-error">Display name, department, and title are required.</div>`;
    return;
  }

  const groupIds = Array.from(document.querySelectorAll("#nu-group-list input[type=checkbox]:checked"))
    .map((cb) => cb.value);

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating...";
  const res = await directoryApi("/directory/users", {
    method: "POST",
    body: { displayName, username, email: email || null, department, title, groupIds },
  });
  submitBtn.disabled = false;
  submitBtn.textContent = "Create user";

  if (!res.ok) {
    errorEl.innerHTML = `<div class="copilot-error">${escapeHtml(res.message || "Couldn't create that user.")}</div>`;
    return;
  }

  closeNewUserModal();
  await loadUsers();
  updateCounts();
  renderTable();
  openDrawer(res.user.id);
}

const newUserBtn = document.getElementById("new-user-btn");
if (newUserBtn) newUserBtn.addEventListener("click", openNewUserModal);

const nuCancelBtn = document.getElementById("nu-cancel");
if (nuCancelBtn) nuCancelBtn.addEventListener("click", closeNewUserModal);

const nuSubmitBtn = document.getElementById("nu-submit");
if (nuSubmitBtn) nuSubmitBtn.addEventListener("click", submitNewUser);

const newUserModal = document.getElementById("new-user-modal");
if (newUserModal) {
  newUserModal.addEventListener("click", (e) => {
    if (e.target === newUserModal) closeNewUserModal();
  });
}

const nuDisplayNameInput = document.getElementById("nu-display-name");
if (nuDisplayNameInput) {
  nuDisplayNameInput.addEventListener("input", (e) => {
    if (usernameManuallyEdited) return; // don't fight someone who already edited the username field
    document.getElementById("nu-username").value = generateUsernamePreview(e.target.value);
  });
}

const nuUsernameInput = document.getElementById("nu-username");
if (nuUsernameInput) {
  nuUsernameInput.addEventListener("input", () => {
    usernameManuallyEdited = true;
  });
}

// ---- Group create/rename modal (Phase E3) ----
// Reused for both "create" and "rename" — editingGroup tracks which mode
// the modal is in, since the form fields and submit behavior are nearly
// identical, just targeting a different endpoint (POST vs PATCH).

let editingGroup = null;

function openGroupModal(group) {
  editingGroup = group || null;
  const modal = document.getElementById("group-modal");
  const title = document.getElementById("group-modal-title");
  const submitBtn = document.getElementById("grp-submit");

  document.getElementById("grp-name").value = group ? group.name : "";
  document.getElementById("grp-description").value = group ? group.description || "" : "";
  document.getElementById("group-modal-error").innerHTML = "";

  title.textContent = group ? "Rename group" : "New group";
  submitBtn.textContent = group ? "Save changes" : "Create group";

  modal.classList.add("open");
}

function closeGroupModal() {
  document.getElementById("group-modal").classList.remove("open");
  editingGroup = null;
}

async function submitGroupModal() {
  const name = document.getElementById("grp-name").value.trim();
  const description = document.getElementById("grp-description").value.trim();
  const errorEl = document.getElementById("group-modal-error");
  const submitBtn = document.getElementById("grp-submit");

  errorEl.innerHTML = "";
  if (!name) {
    errorEl.innerHTML = `<div class="copilot-error">Group name is required.</div>`;
    return;
  }

  submitBtn.disabled = true;
  const res = editingGroup
    ? await directoryApi(`/directory/groups/${encodeURIComponent(editingGroup.id)}`, {
        method: "PATCH",
        body: { name, description },
      })
    : await directoryApi("/directory/groups", {
        method: "POST",
        body: { name, description },
      });
  submitBtn.disabled = false;

  if (!res.ok) {
    errorEl.innerHTML = `<div class="copilot-error">${escapeHtml(res.message || "Couldn't save that group.")}</div>`;
    return;
  }

  const wasEditing = !!editingGroup;
  closeGroupModal();
  await loadGroups();
  renderGroupsTable();
  if (wasEditing) {
    await loadUsers(); // a rename may have changed every member's groups JSON
    openGroupDrawer(res.group.id);
  }
}

const newGroupBtn = document.getElementById("new-group-btn");
if (newGroupBtn) newGroupBtn.addEventListener("click", () => openGroupModal(null));

const grpCancelBtn = document.getElementById("grp-cancel");
if (grpCancelBtn) grpCancelBtn.addEventListener("click", closeGroupModal);

const grpSubmitBtn = document.getElementById("grp-submit");
if (grpSubmitBtn) grpSubmitBtn.addEventListener("click", submitGroupModal);

const groupModal = document.getElementById("group-modal");
if (groupModal) {
  groupModal.addEventListener("click", (e) => {
    if (e.target === groupModal) closeGroupModal();
  });
}

// ---- View toggle wiring ----
document.querySelectorAll("[data-view]").forEach((el) => {
  el.addEventListener("click", () => switchView(el.dataset.view));
});

// ---- Init ----
async function initDirectory() {
  const loaded = await loadUsers();
  if (!loaded) return;
  await loadGroups();
  updateCounts();
  renderTable();
}

window.initDirectory = initDirectory;
