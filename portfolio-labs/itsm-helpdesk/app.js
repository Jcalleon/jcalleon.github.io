// ITSM Helpdesk — agent app logic (real backend via D1)

let tickets = [];
let agents = [];
let currentFilter = "all";
let currentPriFilter = null;
let selectedTicketId = null;
let searchQuery = "";
let selectedTicketIds = new Set();
let currentUser = null;

const tbody = document.getElementById("ticket-tbody");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const drawerBody = document.getElementById("drawer-body");
const drawerTicketId = document.getElementById("drawer-ticket-id");

function formatTime(iso) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function slaStatus(slaIso, status) {
  if (status === "resolved") return { label: "Met", cls: "sla-ok" };
  const now = new Date();
  const sla = new Date(slaIso);
  const diffHrs = (sla - now) / (1000 * 60 * 60);
  if (diffHrs < 0) return { label: `Breached ${Math.abs(diffHrs).toFixed(1)}h ago`, cls: "sla-breach" };
  if (diffHrs < 3) return { label: `${diffHrs.toFixed(1)}h left`, cls: "sla-warn" };
  return { label: `${diffHrs.toFixed(1)}h left`, cls: "sla-ok" };
}

function updateCounts() {
  document.getElementById("count-all").textContent = tickets.length;
  document.getElementById("count-mine").textContent = currentUser
    ? tickets.filter((t) => t.assigned_to === currentUser.id).length
    : 0;
  document.getElementById("count-new").textContent = tickets.filter((t) => t.status === "new").length;
  document.getElementById("count-investigating").textContent = tickets.filter((t) => t.status === "investigating").length;
  document.getElementById("count-resolved").textContent = tickets.filter((t) => t.status === "resolved").length;
  document.getElementById("count-high").textContent = tickets.filter((t) => t.priority === "high").length;
  document.getElementById("count-medium").textContent = tickets.filter((t) => t.priority === "medium").length;
  document.getElementById("count-low").textContent = tickets.filter((t) => t.priority === "low").length;
}

function getFilteredTickets() {
  let list = [...tickets];
  if (currentFilter === "mine") {
    list = list.filter((t) => currentUser && t.assigned_to === currentUser.id);
  } else if (currentFilter !== "all") {
    list = list.filter((t) => t.status === currentFilter);
  }
  if (currentPriFilter) list = list.filter((t) => t.priority === currentPriFilter);

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    list = list.filter((t) =>
      t.subject.toLowerCase().includes(q) ||
      t.requester.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    );
  }

  return list;
}

function renderTable() {
  const list = getFilteredTickets();
  tbody.innerHTML = "";
  updateBulkBar();

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No tickets match this filter.</div></td></tr>`;
    return;
  }

  for (const t of list) {
    const sla = slaStatus(t.sla_due, t.status);
    const tr = document.createElement("tr");
    tr.className = t.id === selectedTicketId ? "selected" : "";
    tr.innerHTML = `
      <td><input type="checkbox" class="row-checkbox" data-id="${t.id}" ${selectedTicketIds.has(t.id) ? "checked" : ""} /></td>
      <td><span class="badge badge-${t.priority === "high" ? "critical" : t.priority === "medium" ? "medium" : "low"}">${t.priority}</span></td>
      <td>
        <div class="ticket-title-cell">
          <span class="ticket-title-main">${t.has_unread_reply ? '<span class="unread-dot" title="New reply"></span>' : ""}${t.subject}</span>
          <span class="ticket-title-id mono">${t.id} · ${t.department}</span>
        </div>
      </td>
      <td>${t.requester}</td>
      <td>${t.category}</td>
      <td style="font-size:12px; color:var(--text-secondary);">${t.assigned_email || "—"}</td>
      <td><span class="badge badge-${statusBadgeClass(t.status)}">${statusLabel(t.status)}</span></td>
      <td><span class="sla-countdown ${sla.cls}">${sla.label}</span></td>
    `;
    tr.querySelector(".row-checkbox").addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target.checked) selectedTicketIds.add(t.id);
      else selectedTicketIds.delete(t.id);
      updateBulkBar();
    });
    tr.addEventListener("click", () => openDrawer(t.id));
    tbody.appendChild(tr);
  }
}

function updateBulkBar() {
  const bar = document.getElementById("bulk-action-bar");
  const count = selectedTicketIds.size;
  if (count === 0) {
    bar.style.display = "none";
  } else {
    bar.style.display = "flex";
    document.getElementById("bulk-count").textContent = `${count} selected`;
  }

  // Keep the header checkbox in sync with actual selection state for the visible list.
  const visible = getFilteredTickets();
  const allSelected = visible.length > 0 && visible.every((t) => selectedTicketIds.has(t.id));
  document.getElementById("select-all-checkbox").checked = allSelected;
}

function statusBadgeClass(status) {
  if (status === "new") return "info";
  if (status === "investigating") return "medium";
  if (status === "resolved") return "success";
  return "info";
}

function statusLabel(status) {
  return status === "investigating" ? "in progress" : status;
}

async function refreshTickets() {
  const res = await ticketApi("/tickets", { authed: true });
  if (!res.ok) return false;
  tickets = res.tickets;
  updateCounts();
  renderTable();
  return true;
}

async function openDrawer(ticketId) {
  selectedTicketId = ticketId;
  renderTable();
  const res = await ticketApi(`/tickets/${encodeURIComponent(ticketId)}`, { authed: true });
  if (!res.ok) return;

  drawerTicketId.textContent = res.ticket.id;
  drawerBody.innerHTML = renderDrawerContent(res.ticket, res.messages, res.auditLog, res.assignedEmail);
  attachDrawerHandlers(res.ticket);
  drawer.classList.add("open");
  drawerOverlay.classList.add("open");

  // Refresh the list in the background so the unread dot clears immediately.
  refreshTickets();
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawerOverlay.classList.remove("open");
  selectedTicketId = null;
  renderTable();
}

function renderDrawerContent(t, messages, auditLog, assignedEmail) {
  const sla = slaStatus(t.sla_due, t.status);
  return `
    <div class="detail-section">
      <div class="detail-label">Subject</div>
      <div style="font-size:14px; font-weight:600; margin-bottom:8px;">${t.subject}</div>
      <span class="badge badge-${t.priority === "high" ? "critical" : t.priority === "medium" ? "medium" : "low"}">${t.priority} priority</span>
    </div>

    <div class="detail-section">
      <div class="detail-grid">
        <div>
          <div class="detail-field-label">Requester</div>
          <div class="detail-field-value">${t.requester} · ${t.department}</div>
        </div>
        <div>
          <div class="detail-field-label">Created</div>
          <div class="detail-field-value mono">${formatTime(t.created_at)}</div>
        </div>
        <div>
          <div class="detail-field-label">Category</div>
          <select class="status-select" id="category-select">
            ${["Network","Hardware","Software","Software Request","Access / Account","Other"].map(c =>
              `<option value="${c}" ${t.category === c ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
        <div>
          <div class="detail-field-label">Priority</div>
          <select class="priority-select" id="priority-select">
            <option value="high" ${t.priority === "high" ? "selected" : ""}>High</option>
            <option value="medium" ${t.priority === "medium" ? "selected" : ""}>Medium</option>
            <option value="low" ${t.priority === "low" ? "selected" : ""}>Low</option>
          </select>
        </div>
        <div>
          <div class="detail-field-label">SLA</div>
          <div class="detail-field-value ${sla.cls}">${sla.label}</div>
        </div>
        <div>
          <div class="detail-field-label">Status</div>
          <select class="status-select" id="status-select">
            <option value="new" ${t.status === "new" ? "selected" : ""}>New</option>
            <option value="investigating" ${t.status === "investigating" ? "selected" : ""}>In progress</option>
            <option value="resolved" ${t.status === "resolved" ? "selected" : ""}>Resolved</option>
          </select>
        </div>
        <div style="grid-column: 1 / -1;">
          <div class="detail-field-label">Assigned to</div>
          <select class="status-select" id="assigned-select" style="width:100%;">
            <option value="">Unassigned</option>
            ${agents.map((a) => `<option value="${a.id}" ${t.assigned_to === a.id ? "selected" : ""}>${a.email}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">Request</div>
      <div class="detail-narrative">${t.body}</div>
    </div>

    <div class="detail-section">
      <div class="detail-label">AI triage</div>
      <button class="copilot-trigger" id="triage-btn">✦ Triage with AI</button>
      <div class="demo-note">Live call to Claude via a rate-limited proxy. Capped per visitor/day.</div>
      <div id="triage-result" style="margin-top:12px;"></div>
    </div>

    <div class="detail-section">
      <div class="detail-label">Conversation</div>
      <div class="thread" id="thread" style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;">
        ${messages.map(m => `
          <div class="msg-bubble msg-${m.sender}" style="padding:10px 12px; border-radius:8px; font-size:13px; line-height:1.5; max-width:90%;
            ${m.sender === "agent" ? "background:var(--accent-dim); border:1px solid var(--accent); align-self:flex-end;" : "background:var(--panel-raised); border:1px solid var(--border); align-self:flex-start;"}">
            ${m.body}
            <div style="font-size:10px; color:var(--text-dim); margin-top:4px;">${m.sender === "agent" ? "You" : t.requester} · ${formatTime(m.created_at)}</div>
          </div>
        `).join("") || '<div class="empty-state" style="padding:14px;">No messages yet.</div>'}
      </div>
      <textarea class="draft-textarea" id="reply-textarea" placeholder="Type a reply to send to ${t.requester}..."></textarea>
      <div id="reply-error" style="margin-top:8px;"></div>
      <button class="copilot-trigger" id="send-reply-btn" style="margin-top:8px;">Send reply</button>
    </div>

    <div class="detail-section">
      <div class="detail-label">History</div>
      <div class="audit-log">
        ${(auditLog || []).length === 0
          ? '<div class="empty-state" style="padding:14px;">No changes recorded yet.</div>'
          : auditLog.map(a => `
            <div class="audit-entry">
              <span class="mono" style="color:var(--text-dim);">${formatTime(a.created_at)}</span>
              <span>${a.actor_email} changed <strong>${fieldLabel(a.field)}</strong> from "${displayValue(a.field, a.old_value)}" to "${displayValue(a.field, a.new_value)}"</span>
            </div>
          `).join("")}
      </div>
    </div>
  `;
}

function fieldLabel(field) {
  if (field === "assigned_to") return "assignment";
  return field;
}

function displayValue(field, value) {
  if (field === "assigned_to") {
    if (!value) return "Unassigned";
    const agent = agents.find((a) => a.id === value);
    return agent ? agent.email : value;
  }
  return value || "—";
}

function attachDrawerHandlers(t) {
  document.getElementById("drawer-close").onclick = closeDrawer;

  document.getElementById("status-select").onchange = async (e) => {
    await ticketApi(`/tickets/${encodeURIComponent(t.id)}`, { method: "PATCH", authed: true, body: { status: e.target.value } });
    t.status = e.target.value;
    await refreshTickets();
  };
  document.getElementById("priority-select").onchange = async (e) => {
    await ticketApi(`/tickets/${encodeURIComponent(t.id)}`, { method: "PATCH", authed: true, body: { priority: e.target.value } });
    t.priority = e.target.value;
    await refreshTickets();
  };
  document.getElementById("category-select").onchange = async (e) => {
    await ticketApi(`/tickets/${encodeURIComponent(t.id)}`, { method: "PATCH", authed: true, body: { category: e.target.value } });
    await refreshTickets();
  };
  document.getElementById("assigned-select").onchange = async (e) => {
    await ticketApi(`/tickets/${encodeURIComponent(t.id)}`, { method: "PATCH", authed: true, body: { assigned_to: e.target.value || null } });
    await refreshTickets();
  };

  document.getElementById("triage-btn").onclick = () => runTriage(t);

  document.getElementById("send-reply-btn").onclick = async () => {
    const textarea = document.getElementById("reply-textarea");
    const text = textarea.value.trim();
    const errorEl = document.getElementById("reply-error");
    errorEl.innerHTML = "";
    if (!text) {
      errorEl.innerHTML = '<div class="copilot-error">Type a reply first.</div>';
      return;
    }
    const res = await ticketApi(`/tickets/${encodeURIComponent(t.id)}/messages`, {
      method: "POST", authed: true, body: { sender: "agent", message: text },
    });
    if (!res.ok) {
      errorEl.innerHTML = `<div class="copilot-error">${res.message || "Couldn't send reply."}</div>`;
      return;
    }
    textarea.value = "";
    openDrawer(t.id);
  };
}

async function runTriage(t) {
  const btn = document.getElementById("triage-btn");
  const resultEl = document.getElementById("triage-result");

  btn.disabled = true;
  resultEl.innerHTML = `
    <div class="copilot-loading">
      <span class="copilot-dot"></span><span class="copilot-dot"></span><span class="copilot-dot"></span>
      Triaging ticket...
    </div>`;

  const system = `You are an IT helpdesk AI co-pilot embedded in a ticketing system. Given a ticket, respond in this exact plain-text format, no markdown headers:

CATEGORY: [one of: Network, Hardware, Software, Software Request, Access / Account, Other]
PRIORITY: [High/Medium/Low]
REASONING: 1-2 sentences on why, referencing specifics from the ticket.

DRAFT FIRST RESPONSE:
[A short, professional first-response message to the requester, 2-4 sentences, written for the helpdesk agent to send as-is or lightly edit.]

Keep total response under 160 words.`;

  const prompt = `Ticket ID: ${t.id}
Requester: ${t.requester} (${t.department})
Subject: ${t.subject}
Current category (agent-set): ${t.category}
Current priority (agent-set): ${t.priority}
Body: ${t.body}`;

  const res = await callAI({ app: "itsm", system, prompt });

  btn.disabled = false;

  if (!res.ok) {
    resultEl.innerHTML = `<div class="copilot-error">${res.message || "Demo limit reached."}</div>`;
    return;
  }

  resultEl.innerHTML = `<div class="copilot-output">${escapeHtml(res.text)}</div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---- New ticket modal (agent-created) ----
const modalOverlay = document.createElement("div");
modalOverlay.className = "modal-overlay";
modalOverlay.id = "new-ticket-modal";
modalOverlay.innerHTML = `
  <div class="modal">
    <div class="drawer-title" style="margin-bottom:16px;">New ticket</div>
    <div class="form-row">
      <label class="form-label">Requester name</label>
      <input class="form-input" id="nt-requester" placeholder="J. Smith" />
    </div>
    <div class="form-row">
      <label class="form-label">Subject</label>
      <input class="form-input" id="nt-subject" placeholder="Briefly describe the issue" />
    </div>
    <div class="form-row">
      <label class="form-label">Details</label>
      <textarea class="form-textarea" id="nt-body" placeholder="What's happening?"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="nt-cancel">Cancel</button>
      <button class="copilot-trigger" id="nt-submit">Submit ticket</button>
    </div>
  </div>
`;
document.body.appendChild(modalOverlay);

document.getElementById("new-ticket-btn").onclick = () => modalOverlay.classList.add("open");
document.getElementById("nt-cancel").onclick = () => modalOverlay.classList.remove("open");
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) modalOverlay.classList.remove("open"); });

document.getElementById("nt-submit").onclick = async () => {
  const requester = document.getElementById("nt-requester").value.trim() || "Anonymous";
  const subject = document.getElementById("nt-subject").value.trim();
  const message = document.getElementById("nt-body").value.trim();
  if (!subject || !message) return;

  const res = await ticketApi("/tickets", { method: "POST", body: { requester, department: "Unspecified", subject, message } });

  modalOverlay.classList.remove("open");
  document.getElementById("nt-requester").value = "";
  document.getElementById("nt-subject").value = "";
  document.getElementById("nt-body").value = "";

  await refreshTickets();
  if (res.ok) openDrawer(res.ticket.id);
};

// ---- Nav filtering ----
document.querySelectorAll("[data-filter]").forEach((el) => {
  el.addEventListener("click", () => {
    currentFilter = el.dataset.filter;
    currentPriFilter = null;
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    el.classList.add("active");
    renderTable();
  });
});

document.querySelectorAll("[data-pri-filter]").forEach((el) => {
  el.addEventListener("click", () => {
    currentPriFilter = el.dataset.priFilter;
    currentFilter = "all";
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    el.classList.add("active");
    renderTable();
  });
});

drawerOverlay.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

// ---- Search ----
document.getElementById("search-input").addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderTable();
});

// ---- Select all ----
document.getElementById("select-all-checkbox").addEventListener("change", (e) => {
  const list = getFilteredTickets();
  if (e.target.checked) {
    list.forEach((t) => selectedTicketIds.add(t.id));
  } else {
    list.forEach((t) => selectedTicketIds.delete(t.id));
  }
  renderTable();
});

// ---- Bulk actions ----
document.getElementById("bulk-status-select").addEventListener("change", async (e) => {
  const value = e.target.value;
  if (!value) return;
  await ticketApi("/tickets/bulk-update", {
    method: "POST", authed: true,
    body: { ticketIds: [...selectedTicketIds], field: "status", value },
  });
  selectedTicketIds.clear();
  e.target.value = "";
  await refreshTickets();
});

document.getElementById("bulk-assign-select").addEventListener("change", async (e) => {
  const value = e.target.value;
  if (!value) return;
  await ticketApi("/tickets/bulk-update", {
    method: "POST", authed: true,
    body: { ticketIds: [...selectedTicketIds], field: "assigned_to", value },
  });
  selectedTicketIds.clear();
  e.target.value = "";
  await refreshTickets();
});

async function loadAgentsIntoDropdown() {
  const res = await ticketApi("/auth/agents", { authed: true });
  if (!res.ok) return;
  agents = res.agents;
  const select = document.getElementById("bulk-assign-select");
  select.innerHTML = `<option value="">Assign to...</option>` +
    agents.map((a) => `<option value="${a.id}">${a.email}</option>`).join("");
}

// ---- Auth init ----
async function init() {
  if (!requireAuthOrRedirect()) return;

  const ok = await refreshTickets();
  if (!ok) {
    clearSessionToken();
    clearStoredUser();
    window.location.href = "login.html";
    return;
  }

  document.getElementById("loading-state").style.display = "none";
  document.getElementById("queue-panel").style.display = "block";

  currentUser = getStoredUser();
  if (currentUser) document.getElementById("user-email").textContent = currentUser.email;

  await loadAgentsIntoDropdown();
  updateCounts();
}

document.getElementById("logout-btn").onclick = async () => {
  await ticketApi("/auth/logout", { method: "POST", authed: true });
  clearSessionToken();
  clearStoredUser();
  window.location.href = "login.html";
};

init();
