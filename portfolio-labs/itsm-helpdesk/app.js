// ITSM Helpdesk — agent app logic (real backend via D1)

let tickets = [];
let currentFilter = "all";
let currentPriFilter = null;
let selectedTicketId = null;

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
  document.getElementById("count-new").textContent = tickets.filter((t) => t.status === "new").length;
  document.getElementById("count-investigating").textContent = tickets.filter((t) => t.status === "investigating").length;
  document.getElementById("count-resolved").textContent = tickets.filter((t) => t.status === "resolved").length;
  document.getElementById("count-high").textContent = tickets.filter((t) => t.priority === "high").length;
  document.getElementById("count-medium").textContent = tickets.filter((t) => t.priority === "medium").length;
  document.getElementById("count-low").textContent = tickets.filter((t) => t.priority === "low").length;
}

function getFilteredTickets() {
  let list = [...tickets];
  if (currentFilter !== "all") list = list.filter((t) => t.status === currentFilter);
  if (currentPriFilter) list = list.filter((t) => t.priority === currentPriFilter);
  return list;
}

function renderTable() {
  const list = getFilteredTickets();
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No tickets match this filter.</div></td></tr>`;
    return;
  }

  for (const t of list) {
    const sla = slaStatus(t.sla_due, t.status);
    const tr = document.createElement("tr");
    tr.className = t.id === selectedTicketId ? "selected" : "";
    tr.innerHTML = `
      <td><span class="badge badge-${t.priority === "high" ? "critical" : t.priority === "medium" ? "medium" : "low"}">${t.priority}</span></td>
      <td>
        <div class="ticket-title-cell">
          <span class="ticket-title-main">${t.subject}</span>
          <span class="ticket-title-id mono">${t.id} · ${t.department}</span>
        </div>
      </td>
      <td>${t.requester}</td>
      <td>${t.category}</td>
      <td><span class="badge badge-${statusBadgeClass(t.status)}">${statusLabel(t.status)}</span></td>
      <td><span class="sla-countdown ${sla.cls}">${sla.label}</span></td>
    `;
    tr.addEventListener("click", () => openDrawer(t.id));
    tbody.appendChild(tr);
  }
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
  drawerBody.innerHTML = renderDrawerContent(res.ticket, res.messages);
  attachDrawerHandlers(res.ticket);
  drawer.classList.add("open");
  drawerOverlay.classList.add("open");
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawerOverlay.classList.remove("open");
  selectedTicketId = null;
  renderTable();
}

function renderDrawerContent(t, messages) {
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
  `;
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

// ---- Auth init ----
async function init() {
  if (!requireAuthOrRedirect()) return;

  const ok = await refreshTickets();
  if (!ok) {
    // Session token invalid/expired — clear it and send back to login.
    clearSessionToken();
    clearStoredUser();
    window.location.href = "login.html";
    return;
  }

  document.getElementById("loading-state").style.display = "none";
  document.getElementById("queue-panel").style.display = "block";

  const user = getStoredUser();
  if (user) document.getElementById("user-email").textContent = user.email;
}

document.getElementById("logout-btn").onclick = async () => {
  await ticketApi("/auth/logout", { method: "POST", authed: true });
  clearSessionToken();
  clearStoredUser();
  window.location.href = "login.html";
};

init();
