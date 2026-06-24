// SOC Dashboard — app logic
//
// Phase 2: alerts come from the real Worker/D1 backend (GET /alerts)
// instead of the static data.js array. Status/assignment changes persist
// via PATCH /alerts/:id, AI triage results save via POST /alerts/:id/triage.
//
// Phase 3 additions:
//   - Bulk false-positive dismissal: select alerts, one batched AI call
//     assesses the whole selection at once (cheaper on the rate limit than
//     one call per alert), then POST /alerts/bulk-dismiss persists the
//     ones the AI is confident about as resolved with a distinct
//     resolution_reason so they're never confused with manual resolutions.
//   - Daily digest: one AI call summarizing today's alerts. Ephemeral,
//     like the original single-alert triage was before Phase 2 — no
//     persistence needed since it's a point-in-time summary, not a
//     decision about any specific alert.
//   - MITRE clustering: pure client-side grouping by base technique ID
//     (e.g. T1059 groups T1059, T1059.001, T1059.002...). No AI call —
//     this is exact-match grouping, not correlation.
//
// Entry point is initSocDashboard(user), called by index.html only after
// the auth check (requireValidSessionOrRedirect) confirms a valid session.

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

let alerts = [];
let currentUser = null;
let currentFilter = "all";
let currentSevFilter = null;
let currentView = "table"; // "table" | "clusters"
let searchQuery = ""; // free-text filter: matches host, source, title, id, mitre
let selectedAlertId = null;
let selectedAlertIds = new Set(); // multi-select for bulk AI dismissal
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

// ---- MITRE clustering (pure grouping, no AI call) ----

// Extracts the base technique ID from a mitre field like "T1059.001 — PowerShell"
// -> "T1059". Sub-techniques of the same parent cluster together, since
// they represent the same underlying tactic. Returns null for non-technique
// values like "n/a — Operational", which shouldn't cluster with anything.
function baseTechniqueId(mitre) {
  const match = (mitre || "").match(/^T(\d+)(?:\.\d+)?/);
  return match ? `T${match[1]}` : null;
}

function buildMitreClusters(list) {
  const groups = new Map(); // baseId -> { techniqueLabel, alerts: [] }
  const unclustered = [];

  for (const alert of list) {
    const baseId = baseTechniqueId(alert.mitre);
    if (!baseId) {
      unclustered.push(alert);
      continue;
    }
    if (!groups.has(baseId)) {
      groups.set(baseId, { baseId, alerts: [] });
    }
    groups.get(baseId).alerts.push(alert);
  }

  // Only genuinely useful as "clusters" if 2+ alerts share a technique —
  // singletons get folded into unclustered rather than shown as a
  // 1-alert "cluster", which wouldn't tell an analyst anything new.
  const clusters = [];
  for (const group of groups.values()) {
    if (group.alerts.length >= 2) clusters.push(group);
    else unclustered.push(...group.alerts);
  }

  clusters.sort((a, b) => b.alerts.length - a.alerts.length);
  return { clusters, unclustered };
}

function renderClusterView() {
  const list = getFilteredAlerts();
  const { clusters, unclustered } = buildMitreClusters(list);

  if (clusters.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      No technique clusters yet — clustering needs 2+ alerts sharing the same MITRE technique.
      ${unclustered.length > 0 ? `${unclustered.length} alert(s) shown below have unique techniques.` : ""}
    </div></td></tr>`;
  } else {
    tbody.innerHTML = "";
  }

  // Render clusters as grouped sections directly in the table body, using
  // a header row per cluster — keeps the same <table> structure (and CSS)
  // rather than building a whole separate layout for this view.
  for (const cluster of clusters) {
    const headerRow = document.createElement("tr");
    headerRow.className = "cluster-header-row";
    headerRow.innerHTML = `<td colspan="7" style="background:var(--panel-raised); font-family:var(--font-mono); font-size:11px; color:var(--accent-text); padding:8px 12px;">
      ${cluster.baseId} — ${cluster.alerts.length} related alerts (possible single campaign)
    </td>`;
    tbody.appendChild(headerRow);

    for (const alert of cluster.alerts) {
      tbody.appendChild(buildAlertRow(alert));
    }
  }

  if (unclustered.length > 0 && clusters.length > 0) {
    const headerRow = document.createElement("tr");
    headerRow.className = "cluster-header-row";
    headerRow.innerHTML = `<td colspan="7" style="background:var(--panel-raised); font-family:var(--font-mono); font-size:11px; color:var(--text-dim); padding:8px 12px;">
      Unclustered — ${unclustered.length} alert(s) with unique techniques
    </td>`;
    tbody.appendChild(headerRow);
    for (const alert of unclustered) {
      tbody.appendChild(buildAlertRow(alert));
    }
  } else if (clusters.length === 0) {
    for (const alert of unclustered) {
      tbody.appendChild(buildAlertRow(alert));
    }
  }

  // Bulk-select bar isn't shown in clusters view — keeps this view focused
  // on pattern-spotting rather than action-taking; switch back to table
  // view to select alerts for bulk dismissal.
  const bar = document.getElementById("bulk-action-bar");
  if (bar) bar.style.display = "none";
}

// Shared row-building logic between table view and cluster view, so a row
// looks and behaves identically in both (same click-to-open-drawer, same
// checkbox, same badges) rather than maintaining two near-duplicate templates.
function buildAlertRow(alert) {
  const tr = document.createElement("tr");
  tr.className = alert.id === selectedAlertId ? "selected" : "";
  tr.innerHTML = `
    <td><input type="checkbox" class="alert-checkbox" data-alert-id="${alert.id}" ${selectedAlertIds.has(alert.id) ? "checked" : ""} /></td>
    <td><span class="badge badge-${alert.severity}">${alert.severity}</span></td>
    <td>
      <div class="alert-title-cell">
        <span class="alert-title-main">${escapeHtml(alert.title)}</span>
        <span class="alert-title-id mono">${alert.id} · ${escapeHtml(alert.mitre)}${alert.resolution_reason === "ai_bulk_dismissed" ? " · AI-dismissed" : ""}</span>
      </div>
    </td>
    <td class="mono">${escapeHtml(alert.host)}</td>
    <td>${escapeHtml(alert.source)}</td>
    <td><span class="badge badge-${statusBadgeClass(alert.status)}">${alert.status}</span></td>
    <td class="mono" style="color:var(--text-dim); font-size:11px;">${formatTime(alert.created_at)}</td>
  `;
  tr.querySelector(".alert-checkbox").addEventListener("click", (e) => e.stopPropagation());
  tr.querySelector(".alert-checkbox").addEventListener("change", (e) => {
    if (e.target.checked) selectedAlertIds.add(alert.id);
    else selectedAlertIds.delete(alert.id);
    updateBulkBar();
  });
  tr.addEventListener("click", () => openDrawer(alert.id));
  return tr;
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
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    list = list.filter((a) =>
      [a.host, a.source, a.title, a.id, a.mitre, a.user_context]
        .some((field) => (field || "").toLowerCase().includes(q))
    );
  }
  return list.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function renderTable() {
  if (currentView === "clusters") {
    renderClusterView();
    return;
  }

  const list = getFilteredAlerts();
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No alerts match this filter.</div></td></tr>`;
    updateBulkBar();
    return;
  }

  for (const alert of list) {
    tbody.appendChild(buildAlertRow(alert));
  }

  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById("bulk-action-bar");
  if (!bar) return; // not present in clusters view
  const count = selectedAlertIds.size;
  if (count === 0) {
    bar.style.display = "none";
  } else {
    bar.style.display = "flex";
    document.getElementById("bulk-count").textContent = `${count} selected`;
  }

  const visible = getFilteredAlerts();
  const allSelected = visible.length > 0 && visible.every((a) => selectedAlertIds.has(a.id));
  const selectAllCheckbox = document.getElementById("select-all-checkbox");
  if (selectAllCheckbox) selectAllCheckbox.checked = allSelected;
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
          <div class="detail-field-value detail-field-link" data-search-value="${escapeHtml(alert.host)}" title="Click to find other alerts on this host">${escapeHtml(alert.host)}</div>
        </div>
        <div>
          <div class="detail-field-label">User / Process Context</div>
          <div class="detail-field-value detail-field-link" data-search-value="${escapeHtml(alert.user_context)}" title="Click to find other alerts involving this user/process">${escapeHtml(alert.user_context)}</div>
        </div>
        <div>
          <div class="detail-field-label">Source</div>
          <div class="detail-field-value detail-field-link" data-search-value="${escapeHtml(alert.source)}" title="Click to find other alerts from this source">${escapeHtml(alert.source)}</div>
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

  document.querySelectorAll(".detail-field-link").forEach((el) => {
    el.addEventListener("click", () => {
      const value = el.dataset.searchValue;
      if (!value || value === "n/a") return; // not a useful pivot
      closeDrawer();
      const searchInput = document.getElementById("search-input");
      if (searchInput) searchInput.value = value;
      searchQuery = value;
      renderTable();
    });
  });

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

// ---- Bulk false-positive dismissal (one batched AI call, not one per alert) ----

async function runBulkDismiss() {
  const ids = Array.from(selectedAlertIds);
  if (ids.length === 0) return;

  const selected = alerts.filter((a) => ids.includes(a.id));
  const btn = document.getElementById("bulk-dismiss-btn");
  const resultArea = document.getElementById("bulk-action-result");

  btn.disabled = true;
  resultArea.innerHTML = `<div class="copilot-loading">
    <span class="copilot-dot"></span><span class="copilot-dot"></span><span class="copilot-dot"></span>
    Assessing ${selected.length} alert(s) for false positives...
  </div>`;

  const system = `You are a SOC analyst's AI co-pilot. You will be given a batch of security alerts. For EACH alert, decide if it is very likely a false positive that can be safely auto-resolved, or if it needs human review. Be conservative — only mark an alert as a false positive if the evidence strongly supports it; when uncertain, say it needs review.

Respond with one line per alert, in EXACTLY this format, no other text:
<alert_id>: FALSE_POSITIVE | <one short reason>
<alert_id>: NEEDS_REVIEW | <one short reason>

One line per alert ID given, nothing else.`;

  const prompt = selected
    .map(
      (a) => `Alert ID: ${a.id}
Title: ${a.title}
Severity: ${a.severity}
Host: ${a.host}
Source: ${a.source}
MITRE: ${a.mitre}
Detail: ${a.details}`
    )
    .join("\n\n---\n\n");

  const res = await callAI({ app: "soc", system, prompt });
  btn.disabled = false;

  if (!res.ok) {
    resultArea.innerHTML = `<div class="copilot-error">${escapeHtml(res.message || "Demo limit reached — couldn't run the batch assessment.")}</div>`;
    return;
  }

  const decisions = parseBulkDismissResponse(res.text, ids);
  const toDismiss = decisions.filter((d) => d.verdict === "FALSE_POSITIVE").map((d) => d.id);
  const toReview = decisions.filter((d) => d.verdict !== "FALSE_POSITIVE");

  if (toDismiss.length === 0) {
    resultArea.innerHTML = `<div class="copilot-output">AI reviewed ${selected.length} alert(s) and didn't find any it's confident are false positives. No changes made — these still need human review.</div>`;
    return;
  }

  const dismissRes = await authApi("/alerts/bulk-dismiss", {
    method: "POST",
    authed: true,
    body: { alertIds: toDismiss },
  });

  if (!dismissRes.ok) {
    resultArea.innerHTML = `<div class="copilot-error">AI assessment completed but saving the result failed: ${escapeHtml(dismissRes.message || "unknown error")}</div>`;
    return;
  }

  resultArea.innerHTML = `<div class="copilot-output">Dismissed ${toDismiss.length} of ${selected.length} alert(s) as false positives.${
    toReview.length > 0 ? ` ${toReview.length} still need human review (not changed).` : ""
  }</div>`;

  selectedAlertIds.clear();
  await loadAlerts();
  renderTable();
  updateCounts();
}

// Parses lines like "ALR-10481: FALSE_POSITIVE | reason text" back into
// structured decisions. The system prompt fixes this exact line format,
// so this is parsing a known shape, not arbitrary free text.
function parseBulkDismissResponse(text, expectedIds) {
  const decisions = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9-]+):\s*(FALSE_POSITIVE|NEEDS_REVIEW)\s*\|?\s*(.*)$/i);
    if (!match) continue;
    const [, id, verdict, reason] = match;
    if (expectedIds.includes(id)) {
      decisions.push({ id, verdict: verdict.toUpperCase(), reason: reason || "" });
    }
  }
  return decisions;
}

// ---- Daily digest (ephemeral — one AI call, not persisted) ----

async function runDailyDigest() {
  const btn = document.getElementById("digest-btn");
  const resultArea = document.getElementById("digest-result");

  const today = new Date().toISOString().slice(0, 10);
  const todaysAlerts = alerts.filter((a) => a.created_at.startsWith(today));

  if (todaysAlerts.length === 0) {
    resultArea.innerHTML = `<div class="demo-note">No alerts created today yet.</div>`;
    return;
  }

  btn.disabled = true;
  resultArea.innerHTML = `<div class="copilot-loading">
    <span class="copilot-dot"></span><span class="copilot-dot"></span><span class="copilot-dot"></span>
    Summarizing today's queue...
  </div>`;

  const system = `You are a SOC shift-handoff assistant. Given today's security alerts, write a concise shift-handoff summary for the next analyst. Plain text, no markdown headers. Cover: overall picture (how many, what severities), anything that needs immediate attention, and any pattern worth flagging across multiple alerts. Keep it under 130 words.`;

  const prompt = todaysAlerts
    .map((a) => `${a.id} [${a.severity}] ${a.title} — ${a.status} — host: ${a.host} — mitre: ${a.mitre}`)
    .join("\n");

  const res = await callAI({ app: "soc", system, prompt: `Today's alerts (${todaysAlerts.length} total):\n${prompt}` });
  btn.disabled = false;

  if (!res.ok) {
    resultArea.innerHTML = `<div class="copilot-error">${escapeHtml(res.message || "Demo limit reached.")}</div>`;
    return;
  }

  resultArea.innerHTML = `<div class="copilot-output">${escapeHtml(res.text)}</div>`;
}

// ---- Nav filtering, view toggle, bulk select, and Phase 3 buttons ----

function wireNavFilters() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderTable();
    });
  }

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

  document.querySelectorAll("[data-view]").forEach((el) => {
    el.addEventListener("click", () => {
      currentView = el.dataset.view;
      document.querySelectorAll("[data-view]").forEach((n) => n.classList.remove("active"));
      el.classList.add("active");
      renderTable();
    });
  });

  const selectAllCheckbox = document.getElementById("select-all-checkbox");
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", (e) => {
      const list = getFilteredAlerts();
      if (e.target.checked) list.forEach((a) => selectedAlertIds.add(a.id));
      else list.forEach((a) => selectedAlertIds.delete(a.id));
      renderTable();
    });
  }

  const bulkDismissBtn = document.getElementById("bulk-dismiss-btn");
  if (bulkDismissBtn) bulkDismissBtn.addEventListener("click", runBulkDismiss);

  const digestBtn = document.getElementById("digest-btn");
  if (digestBtn) digestBtn.addEventListener("click", runDailyDigest);

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
