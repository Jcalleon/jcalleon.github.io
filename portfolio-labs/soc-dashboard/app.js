// SOC Dashboard — app logic

let alerts = ALERTS.map((a) => ({ ...a }));
let currentFilter = "all";
let currentSevFilter = null;
let selectedAlertId = null;

const tbody = document.getElementById("alert-tbody");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const drawerBody = document.getElementById("drawer-body");
const drawerAlertId = document.getElementById("drawer-alert-id");

function formatTime(iso) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 19).replace("T", " ") + "Z";
}

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
    return new Date(b.timestamp) - new Date(a.timestamp);
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
          <span class="alert-title-main">${alert.title}</span>
          <span class="alert-title-id mono">${alert.id} · ${alert.mitre}</span>
        </div>
      </td>
      <td class="mono">${alert.host}</td>
      <td>${alert.source}</td>
      <td><span class="badge badge-${statusBadgeClass(alert.status)}">${alert.status}</span></td>
      <td class="mono" style="color:var(--text-dim); font-size:11px;">${formatTime(alert.timestamp)}</td>
    `;
    tr.addEventListener("click", () => openDrawer(alert.id));
    tbody.appendChild(tr);
  }
}

function statusBadgeClass(status) {
  if (status === "new") return "info";
  if (status === "investigating") return "medium";
  if (status === "resolved") return "success";
  return "info";
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

function renderDrawerContent(alert) {
  return `
    <div class="detail-section">
      <div class="detail-label">Alert</div>
      <div style="font-size:14px; font-weight:600; margin-bottom:8px;">${alert.title}</div>
      <span class="badge badge-${alert.severity}">${alert.severity}</span>
    </div>

    <div class="detail-section">
      <div class="detail-grid">
        <div>
          <div class="detail-field-label">Host</div>
          <div class="detail-field-value">${alert.host}</div>
        </div>
        <div>
          <div class="detail-field-label">User / Process Context</div>
          <div class="detail-field-value">${alert.user}</div>
        </div>
        <div>
          <div class="detail-field-label">Source</div>
          <div class="detail-field-value">${alert.source}</div>
        </div>
        <div>
          <div class="detail-field-label">MITRE ATT&amp;CK</div>
          <div class="detail-field-value">${alert.mitre}</div>
        </div>
        <div>
          <div class="detail-field-label">Timestamp</div>
          <div class="detail-field-value">${formatTime(alert.timestamp)}</div>
        </div>
        <div>
          <div class="detail-field-label">Status</div>
          <select class="status-select" id="status-select">
            <option value="new" ${alert.status === "new" ? "selected" : ""}>New</option>
            <option value="investigating" ${alert.status === "investigating" ? "selected" : ""}>Investigating</option>
            <option value="resolved" ${alert.status === "resolved" ? "selected" : ""}>Resolved</option>
          </select>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">Raw detail</div>
      <div class="detail-narrative">${alert.details}</div>
    </div>

    <div class="detail-section">
      <div class="detail-label">AI triage</div>
      <button class="copilot-trigger" id="triage-btn">✦ Triage with AI</button>
      <div class="demo-note">Live call to Claude via a rate-limited proxy. Capped per visitor/day.</div>
      <div id="triage-result" style="margin-top:12px;"></div>
    </div>
  `;
}

function attachDrawerHandlers(alert) {
  document.getElementById("drawer-close").onclick = closeDrawer;
  document.getElementById("status-select").onchange = (e) => {
    alert.status = e.target.value;
    updateCounts();
    renderTable();
  };
  document.getElementById("triage-btn").onclick = () => runTriage(alert);
}

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
User/process context: ${alert.user}
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---- Nav filtering ----
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

// ---- Init ----
updateCounts();
renderTable();
