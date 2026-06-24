// SOC Dashboard — app logic
//
// Phase 2 rewrite: alerts now come from the real Worker/D1 backend
// (GET /alerts) instead of the static data.js array. Status changes and
// assignment persist via PATCH /alerts/:id, and AI triage results are
// saved via POST /alerts/:id/triage so they survive a page reload instead
// of vanishing the moment the drawer closes.
//
// Entry point is initSocDashboard(user), called by index.html only after
// the auth check (requireValidSessionOrRedirect) confirms a valid session —
// this file no longer self-initializes at the bottom, since it now has
// real async work to do before there's anything to render.

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

let alerts = [];
let currentUser = null;
let currentFilter = "all";
let currentSevFilter = null;
let selectedAlertId = null;
let socAgents = []; // users with soc_role != "none", for the assignment dropdown

const tbody = document.getElementById("alert-tbody");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const drawerBody = document.getElementById("drawer-body");
const drawerAlertId = document.getElementById("drawer-alert-id");
const mainPanel = document.querySelector(".main .panel");

function formatTime(iso) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 19).replace("T", " ") + "Z";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function statusBadgeClass(status) {
  if (status === "new") return "info";
  if (status === "investigating") return "medium";
  if (status === "resolved") return "success";
  return "info";
}

// ---- Data loading ----

async function loadAlerts() {
  const res = await authApi("/alerts", { authed: true });
  if (!res.ok) {
    mainPanel.innerHTML = `<div class="empty-state">Couldn't load alerts. ${escapeHtml(res.message || "Try refreshing the page.")}</div>`;
    return false;
  }
  alerts = res.alerts;
  return true;
}

async function loadSocAgents() {
  const res = await authApi("/soc/agents", { authed: true });
  socAgents = res.ok ? res.agents : [];
}

// ---- Rendering ----

function updateCounts() {
  document.getElementById("count-all").textContent = alerts.length;
  document.getElementById("count-new").textContent = alerts.filter((a) => a.status === "new").length;
  document.getElementById("count-investigating").textContent = alerts.filter((a) => a.status === "investigating").length;
  document.getElementById("count-resolved").textContent = alerts.filter((a) => a.status === "resolved").length;
  document.getElementById("count-critical").textContent = alerts.filter((a) => a.severity === "critical").length;
  document.getElementById("count-high").textContent = alerts.filter((a) => a.severity === "high").length;
  document.getElementById("count-medium").textContent = alerts.filter((a) => a.severity === "medium").length;
  document.getElementById("count-low").textContent = alerts.filter((a) => a.severity === "low").length;
}

function getFilteredAlerts() {
  let list = [...alerts];
  if (currentFilter !== "all") {
    list = list.filter((a) => a.status === currentFilter);
  }
  if (currentSevFilter) {
    list = list.filter((a) => a.severity === currentSevFilter);
  }
  return list.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function renderTable() {
  const list = getFilteredAlerts();
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No alerts match this filter.</div></td></tr>`;
    return;
  }

  for (const alert of list) {
    const tr = document.createElement("tr");
    tr.className = alert.id === selectedAlertId ? "selected" : "";
    tr.innerHTML = `
      <td><span class="badge badge-${alert.severity}">${alert.severity}</span></td>
      <td>
        <div class="alert-title-cell">
          <span class="alert-title-main">${escapeHtml(alert.title)}</span>
          <span class="alert-title-id mono">${alert.id} · ${escapeHtml(alert.mitre)}</span>
        </div>
      </td>
      <td class="mono">${escapeHtml(alert.host)}</td>
      <td>${escapeHtml(alert.source)}</td>
      <td><span class="badge badge-${statusBadgeClass(alert.status)}">${alert.status}</span></td>
      <td class="mono" style="color:var(--text-dim); font-size:11px;">${formatTime(alert.created_at)}</td>
    `;
    tr.addEventListener("click", () => openDrawer(alert.id));
    tbody.appendChild(tr);
  }
}

function openDrawer(alertId) {
  selectedAlertId = alertId;
  renderTable();
  const alert = alerts.find((a) => a.id === alertId);
  drawerAlertId.textContent = alert.id;
  drawerBody.innerHTML = renderDrawerContent(alert);
  attachDrawerHandlers(alert);
  drawer.classList.add("open");
  drawerOverlay.classList.add("open");
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawerOverlay.classList.remove("open");
  selectedAlertId = null;
  renderTable();
}

function assigneeOptionsHtml(alert) {
  const options = ['<option value="">Unassigned</option>']
    .concat(socAgents.map((a) => `<option value="${a.id}" ${alert.assigned_to === a.id ? "selected" : ""}>${escapeHtml(a.email)}</option>`));
  return options.join("");
}

function renderDrawerContent(alert) {
  // Saved triage result, if this alert was triaged in a previous session —
  // this is the piece that didn't exist before Phase 2: triage used to be
  // lost the moment the drawer closed, now it's read back from the alert
  // row itself.
  const savedTriage = alert.triage_verdict
    ? `<div class="copilot-output">VERDICT: ${escapeHtml(alert.triage_verdict)}
CONFIDENCE: ${escapeHtml(alert.triage_confidence || "—")}

ANALYSIS: ${escapeHtml(alert.triage_analysis || "")}

RECOMMENDED NEXT STEP: ${escapeHtml(alert.triage_next_step || "")}</div>
       <div class="demo-note">Triaged ${alert.triaged_at ? formatTime(alert.triaged_at) : ""} — saved to this alert.</div>`
    : "";

  return `
    <div class="detail-section">
      <div class="detail-label">Alert</div>
      <div style="font-size:14px; font-weight:600; margin-bottom:8px;">${escapeHtml(alert.title)}</div>
      <span class="badge badge-${alert.severity}">${alert.severity}</span>
    </div>

    <div class="detail-section">
      <div class="detail-grid">
        <div>
          <div class="detail-field-label">Host</div>
          <div class="detail-field-value">${escapeHtml(alert.host)}</div>
        </div>
        <div>
          <div class="detail-field-label">User / Process Context</div>
          <div class="detail-field-value">${escapeHtml(alert.user_context)}</div>
        </div>
        <div>
          <div class="detail-field-label">Source</div>
          <div class="detail-field-value">${escapeHtml(alert.source)}</div>
        </div>
        <div>
          <div class="detail-field-label">MITRE ATT&amp;CK</div>
          <div class="detail-field-value">${escapeHtml(alert.mitre)}</div>
        </div>
        <div>
          <div class="detail-field-label">Timestamp</div>
          <div class="detail-field-value">${formatTime(alert.created_at)}</div>
        </div>
        <div>
          <div class="detail-field-label">Status</div>
          <select class="status-select" id="status-select">
            <option value="new" ${alert.status === "new" ? "selected" : ""}>New</option>
            <option value="investigating" ${alert.status === "investigating" ? "selected" : ""}>Investigating</option>
            <option value="resolved" ${alert.status === "resolved" ? "selected" : ""}>Resolved</option>
          </select>
        </div>
        <div>
          <div class="detail-field-label">Assigned to</div>
          <select class="status-select" id="assignee-select">
            ${assigneeOptionsHtml(alert)}
          </select>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">Raw detail</div>
      <div class="detail-narrative">${escapeHtml(alert.details)}</div>
    </div>

    <div class="detail-section">
      <div class="detail-label">AI triage</div>
      <button class="copilot-trigger" id="triage-btn">✦ ${alert.triage_verdict ? "Re-triage with AI" : "Triage with AI"}</button>
      <div class="demo-note">Live call to Claude via a rate-limited proxy. Capped per visitor/day. Results are saved to this alert.</div>
      <div id="triage-result" style="margin-top:12px;">${savedTriage}</div>
    </div>

    <div class="detail-section">
      <div class="detail-label">Audit trail</div>
      <div id="audit-log-section">
        <div class="demo-note">Loading...</div>
      </div>
    </div>
  `;
}

function attachDrawerHandlers(alert) {
  document.getElementById("drawer-close").onclick = closeDrawer;

  document.getElementById("status-select").onchange = async (e) => {
    const newStatus = e.target.value;
    const select = e.target;
    select.disabled = true;
    const res = await authApi(`/alerts/${encodeURIComponent(alert.id)}`, {
      method: "PATCH",
      authed: true,
      body: { status: newStatus },
    });
    select.disabled = false;
    if (!res.ok) {
      alert_failedUpdate(res, select, alert.status);
      return;
    }
    Object.assign(alert, res.alert);
    updateCounts();
    renderTable();
    refreshAuditLog(alert.id);
  };

  document.getElementById("assignee-select").onchange = async (e) => {
    const newAssignee = e.target.value || null;
    const select = e.target;
    select.disabled = true;
    const res = await authApi(`/alerts/${encodeURIComponent(alert.id)}`, {
      method: "PATCH",
      authed: true,
      body: { assigned_to: newAssignee },
    });
    select.disabled = false;
    if (!res.ok) {
      alert_failedUpdate(res, select, alert.assigned_to || "");
      return;
    }
    Object.assign(alert, res.alert);
    refreshAuditLog(alert.id);
  };

  document.getElementById("triage-btn").onclick = () => runTriage(alert);

  refreshAuditLog(alert.id);
}

// Small helper so a failed PATCH visibly reverts the dropdown instead of
// silently leaving it on a value the server rejected.
function alert_failedUpdate(res, selectEl, revertValue) {
  window.alert(res.message || "That update couldn't be saved. Reverting.");
  selectEl.value = revertValue;
}

async function refreshAuditLog(alertId) {
  const section = document.getElementById("audit-log-section");
  if (!section) return; // drawer may have closed while this was in flight

  const res = await authApi(`/alerts/${encodeURIComponent(alertId)}`, { authed: true });
  if (!res.ok || !res.auditLog || res.auditLog.length === 0) {
    section.innerHTML = `<div class="demo-note">No changes logged yet.</div>`;
    return;
  }

  section.innerHTML = res.auditLog
    .map((entry) => {
      const fieldLabel = entry.field === "assigned_to" ? "assignment" : entry.field;
      return `<div class="demo-note" style="margin-bottom:4px;">
        ${formatTime(entry.created_at)} — ${escapeHtml(entry.actor_email)} changed ${fieldLabel}:
        ${escapeHtml(entry.old_value || "—")} → ${escapeHtml(entry.new_value || "—")}
      </div>`;
    })
    .join("");
}

// ---- AI triage ----

async function runTriage(alert) {
  const btn = document.getElementById("triage-btn");
  const resultEl = document.getElementById("triage-result");

  btn.disabled = true;
  resultEl.innerHTML = `
    <div class="copilot-loading">
      <span class="copilot-dot"></span><span class="copilot-dot"></span><span class="copilot-dot"></span>
      Analyzing alert...
    </div>`;

  const system = `You are a senior SOC analyst's AI co-pilot embedded in a detection and response console. You will be given a structured security alert. Respond with a concise triage in this exact format, plain text, no markdown headers:

VERDICT: [Likely True Positive / Likely False Positive / Needs Investigation]
CONFIDENCE: [Low/Medium/High]

ANALYSIS: 2-3 sentences explaining the reasoning a SOC analyst would use, referencing the specific details given.

RECOMMENDED NEXT STEP: 1-2 concrete actions the analyst should take next.

Be specific to the alert details provided. Do not be generic. Keep total response under 150 words.`;

  const prompt = `Alert ID: ${alert.id}
Title: ${alert.title}
Severity (as flagged by SIEM): ${alert.severity}
Host: ${alert.host}
User/process context: ${alert.user_context}
Source tool: ${alert.source}
MITRE ATT&CK mapping: ${alert.mitre}
Detail: ${alert.details}`;

  const res = await callAI({ app: "soc", system, prompt });

  btn.disabled = false;

  if (!res.ok) {
    resultEl.innerHTML = renderAIFallback(res, alert);
    return;
  }

  resultEl.innerHTML = `<div class="copilot-output">${escapeHtml(res.text)}</div>`;

  // Parse the model's plain-text response back into fields so it can be
  // persisted via POST /alerts/:id/triage. The system prompt fixes this
  // exact format, so a straightforward line-based parse is reliable enough
  // here — this isn't parsing arbitrary free text.
  const parsed = parseTriageResponse(res.text);
  if (parsed) {
    const saveRes = await authApi(`/alerts/${encodeURIComponent(alert.id)}/triage`, {
      method: "POST",
      authed: true,
      body: parsed,
    });
    if (saveRes.ok) {
      Object.assign(alert, saveRes.alert);
      btn.textContent = "✦ Re-triage with AI";
      // Re-render so the "saved" note and timestamp appear immediately,
      // without waiting for the next drawer open.
      resultEl.innerHTML = `<div class="copilot-output">${escapeHtml(res.text)}</div>
        <div class="demo-note">Triaged just now — saved to this alert.</div>`;
    }
    // If saving fails, the AI result is still shown above — it just won't
    // persist past this page view. Not worth blocking the visible result
    // on a save failure; the triage call itself already succeeded.
  }
}

function parseTriageResponse(text) {
  const verdictMatch = text.match(/VERDICT:\s*(.+)/i);
  const confidenceMatch = text.match(/CONFIDENCE:\s*(.+)/i);
  const analysisMatch = text.match(/ANALYSIS:\s*([\s\S]*?)(?=\n\s*RECOMMENDED NEXT STEP:|$)/i);
  const nextStepMatch = text.match(/RECOMMENDED NEXT STEP:\s*([\s\S]*)/i);

  if (!verdictMatch || !analysisMatch) return null; // doesn't match expected shape, don't try to save garbage

  return {
    verdict: verdictMatch[1].trim(),
    confidence: confidenceMatch ? confidenceMatch[1].trim() : null,
    analysis: analysisMatch[1].trim(),
    nextStep: nextStepMatch ? nextStepMatch[1].trim() : null,
  };
}

function renderAIFallback(res, alert) {
  const sample = `VERDICT: Needs Investigation
CONFIDENCE: Medium

ANALYSIS: This is a sample response shown because the live demo limit was reached. In production, Claude would analyze the specific host, user context, and MITRE mapping for ${alert.id} and return a tailored verdict.

RECOMMENDED NEXT STEP: Pivot on the source host in your EDR timeline and correlate with auth logs for the same window.`;

  return `
    <div class="copilot-error">
      ${escapeHtml(res.message || "Demo limit reached.")}
    </div>
    <div style="margin-top:8px;" class="demo-note">Sample output shown below for reference:</div>
    <div class="copilot-output" style="margin-top:8px; opacity:0.7;">${escapeHtml(sample)}</div>
  `;
}

// ---- Nav filtering ----

function wireNavFilters() {
  document.querySelectorAll("[data-filter]").forEach((el) => {
    el.addEventListener("click", () => {
      currentFilter = el.dataset.filter;
      currentSevFilter = null;
      document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
      el.classList.add("active");
      renderTable();
    });
  });

  document.querySelectorAll("[data-sev-filter]").forEach((el) => {
    el.addEventListener("click", () => {
      currentSevFilter = el.dataset.sevFilter;
      currentFilter = "all";
      document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
      el.classList.add("active");
      renderTable();
    });
  });

  drawerOverlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });
}

// ---- Init ----
// Called by index.html once requireValidSessionOrRedirect("soc_role")
// confirms a valid session — not self-running, since there's now real
// async work (fetching alerts) that has to happen before the table can
// render anything meaningful.
async function initSocDashboard(user) {
  currentUser = user;
  wireNavFilters();

  const loaded = await loadAlerts();
  if (!loaded) return; // error already shown in mainPanel by loadAlerts()

  await loadSocAgents();

  updateCounts();
  renderTable();
}

window.initSocDashboard = initSocDashboard;
