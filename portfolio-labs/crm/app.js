// CRM Pipeline — app logic

let deals = DEALS.map((d) => ({ ...d }));
let selectedDealId = null;

const board = document.getElementById("kanban-board");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const drawerBody = document.getElementById("drawer-body");
const drawerDealId = document.getElementById("drawer-deal-id");

function formatCurrency(n) {
  return "$" + n.toLocaleString("en-US");
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysSince(iso) {
  const now = new Date("2026-06-23T08:15:00Z");
  const then = new Date(iso);
  const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function updateTotal() {
  const total = deals
    .filter((d) => d.stage !== "Closed Won")
    .reduce((sum, d) => sum + d.value, 0);
  document.getElementById("pipeline-total").textContent =
    `Open pipeline: ${formatCurrency(total)}`;
}

function renderBoard() {
  board.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "kanban-board";

  for (const stage of STAGES) {
    const stageDeals = deals.filter((d) => d.stage === stage);
    const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);

    const col = document.createElement("div");
    col.className = "kanban-column";
    col.innerHTML = `
      <div class="kanban-column-header">
        <span class="kanban-column-title">${stage}</span>
        <span class="kanban-column-value">${formatCurrency(stageValue)}</span>
      </div>
      <div class="kanban-column-body" id="col-${stage.replace(/\s+/g, "-")}"></div>
    `;
    wrapper.appendChild(col);
  }

  board.appendChild(wrapper);

  for (const stage of STAGES) {
    const colBody = document.getElementById(`col-${stage.replace(/\s+/g, "-")}`);
    const stageDeals = deals.filter((d) => d.stage === stage);

    if (stageDeals.length === 0) {
      colBody.innerHTML = `<div class="empty-state" style="padding:24px 8px;">No deals</div>`;
      continue;
    }

    for (const deal of stageDeals) {
      const card = document.createElement("div");
      card.className = "deal-card";
      card.innerHTML = `
        <div class="deal-card-company">${deal.company}</div>
        <div class="deal-card-contact">${deal.contact}</div>
        <div class="deal-card-footer">
          <span class="deal-card-value">${formatCurrency(deal.value)}</span>
          <span class="deal-card-activity">${daysSince(deal.lastActivity)}</span>
        </div>
      `;
      card.addEventListener("click", () => openDrawer(deal.id));
      colBody.appendChild(card);
    }
  }

  updateTotal();
}

function openDrawer(dealId) {
  selectedDealId = dealId;
  const deal = deals.find((d) => d.id === dealId);
  drawerDealId.textContent = deal.id;
  drawerBody.innerHTML = renderDrawerContent(deal);
  attachDrawerHandlers(deal);
  drawer.classList.add("open");
  drawerOverlay.classList.add("open");
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawerOverlay.classList.remove("open");
  selectedDealId = null;
}

function renderDrawerContent(deal) {
  return `
    <div class="detail-section">
      <div class="detail-label">Company</div>
      <div style="font-size:15px; font-weight:600; margin-bottom:4px;">${deal.company}</div>
      <div style="font-size:12px; color:var(--text-secondary);">${deal.contact}</div>
    </div>

    <div class="detail-section">
      <div class="detail-grid">
        <div>
          <div class="detail-field-label">Deal value</div>
          <div class="detail-field-value mono" style="color:var(--accent-text); font-weight:600;">${formatCurrency(deal.value)}</div>
        </div>
        <div>
          <div class="detail-field-label">Last activity</div>
          <div class="detail-field-value">${formatDate(deal.lastActivity)} (${daysSince(deal.lastActivity)})</div>
        </div>
        <div style="grid-column: 1 / -1;">
          <div class="detail-field-label">Stage</div>
          <select class="stage-select" id="stage-select">
            ${STAGES.map((s) => `<option value="${s}" ${deal.stage === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">Activity notes</div>
      <div class="notes-timeline">
        ${deal.notes.map((n) => `<div class="note-entry">${n}</div>`).join("")}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">AI deal summary</div>
      <button class="copilot-trigger" id="summarize-btn">✦ Summarize &amp; suggest next action</button>
      <div class="demo-note">Live call to Claude via a rate-limited proxy. Capped per visitor/day.</div>
      <div id="summary-result" style="margin-top:12px;"></div>
    </div>
  `;
}

function attachDrawerHandlers(deal) {
  document.getElementById("drawer-close").onclick = closeDrawer;
  document.getElementById("stage-select").onchange = (e) => {
    deal.stage = e.target.value;
    renderBoard();
  };
  document.getElementById("summarize-btn").onclick = () => runSummary(deal);
}

async function runSummary(deal) {
  const btn = document.getElementById("summarize-btn");
  const resultEl = document.getElementById("summary-result");

  btn.disabled = true;
  resultEl.innerHTML = `
    <div class="copilot-loading">
      <span class="copilot-dot"></span><span class="copilot-dot"></span><span class="copilot-dot"></span>
      Reviewing deal history...
    </div>`;

  const system = `You are a sales AI co-pilot embedded in a CRM. Given a deal's notes history, respond in this exact plain-text format, no markdown headers:

SUMMARY: 2-3 sentences summarizing where this deal stands and why, based specifically on the notes given.

RISK: [Low/Medium/High] — one sentence on the main risk to closing, if any.

NEXT ACTION: One concrete, specific next action the rep should take, with brief reasoning.

Be specific to the deal's actual notes. Do not be generic. Keep total response under 140 words.`;

  const prompt = `Company: ${deal.company}
Contact: ${deal.contact}
Deal value: ${formatCurrency(deal.value)}
Current stage: ${deal.stage}
Notes history (chronological):
${deal.notes.map((n, i) => `${i + 1}. ${n}`).join("\n")}`;

  const res = await callAI({ app: "crm", system, prompt });

  btn.disabled = false;

  if (!res.ok) {
    resultEl.innerHTML = renderAIFallback(res, deal);
    return;
  }

  resultEl.innerHTML = `<div class="copilot-output">${escapeHtml(res.text)}</div>`;
}

function renderAIFallback(res, deal) {
  const sample = `SUMMARY: This is a sample response shown because the live demo limit was reached. In production, Claude would summarize ${deal.company}'s full notes history and current stage.

RISK: Medium — sample placeholder; a real call would assess this from the actual notes.

NEXT ACTION: Follow up directly with ${deal.contact.split(",")[0]} to confirm timeline and next steps.`;

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

drawerOverlay.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

// ---- Init ----
renderBoard();
