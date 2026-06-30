// ===========================================================================
// CONTENT POPULATION — all text pulled directly from RESUME_DATA
// (projectmanagement-resume-data.js), generated from the same finalized,
// fact-checked CV content used for the .docx resumes — nothing here is
// invented. Mirrors resume-cyber.js's structure exactly for consistency
// across lenses, plus a Gantt-bar duration calculation unique to this lens.
// ===========================================================================

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function boldNumbers(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/(\d[\d,]*\+?%?)/g, "<strong>$1</strong>");
}

function renderSummary() {
  document.getElementById("summary-text").textContent = RESUME_DATA.summary;
}

function renderTimeline() {
  const el = document.getElementById("timeline");
  el.innerHTML = RESUME_DATA.jobs
    .map(
      (job) => `
    <div class="tl-item">
      <span class="tl-dates">${escapeHtml(job.dates)}</span>
      <div class="tl-company">${escapeHtml(job.company)}</div>
      <div class="tl-title">${escapeHtml(job.title)}</div>
    </div>`
    )
    .join("");
}

// Parses "Mon YYYY – Mon YYYY" / "YYYY – YYYY" / "Mon YYYY – present" into
// an approximate duration in months, used only to size each job's Gantt
// bar proportionally — a real signal (how long the role actually ran),
// not a decorative random width.
const MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};
function parseMonthYear(str) {
  str = str.trim();
  if (/present/i.test(str)) {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }
  const m = str.match(/([A-Za-z]{3})\s+(\d{4})/);
  if (m) return parseInt(m[2], 10) * 12 + (MONTHS[m[1]] ?? 0);
  const y = str.match(/(\d{4})/);
  if (y) return parseInt(y[1], 10) * 12;
  return null;
}
function jobDurationMonths(dates) {
  const parts = dates.split(/\u2013|-/).map((s) => s.trim());
  if (parts.length < 2) return 6;
  const start = parseMonthYear(parts[0]);
  const end = parseMonthYear(parts[1]);
  if (start == null || end == null) return 6;
  return Math.max(1, end - start);
}

function renderExperience() {
  const el = document.getElementById("experience-list");
  const durations = RESUME_DATA.jobs.map((j) => jobDurationMonths(j.dates));
  const maxDuration = Math.max(...durations);

  el.innerHTML = RESUME_DATA.jobs
    .map((job, i) => {
      const pct = Math.max(14, Math.round((durations[i] / maxDuration) * 100));
      return `
    <div class="exp-job">
      <div class="exp-job-head">
        <div class="exp-job-title-block">
          <h3>${escapeHtml(job.title)}</h3>
          <p>${escapeHtml(job.company)}</p>
        </div>
        <span class="exp-job-dates">${escapeHtml(job.dates)}</span>
      </div>
      <div class="gantt-track">
        <div class="gantt-fill" data-pct="${pct}" style="width:0%"></div>
      </div>
      <ul class="exp-bullets">
        ${job.bullets.map((b) => `<li>${boldNumbers(b)}</li>`).join("")}
      </ul>
    </div>`;
    })
    .join("");
}

// Derives a tools/platforms list from the actual bullet text, matching a
// fixed vocabulary of real tool/method names that appear verbatim in the
// source CV, so it can never drift out of sync with the bullets.
function renderSkills() {
  const KNOWN_TOOLS = [
    "Meraki", "pfSense", "Sophos", "CrowdStrike", "Tenable", "KACE",
    "Okta", "Atlassian", "1Password", "Splunk", "ELK", "Graylog",
    "Intune", "Entra ID", "Ansible", "Terraform", "PowerShell", "Qualys",
    "Azure",
  ];
  const found = new Set();
  const allText = RESUME_DATA.jobs.map((j) => j.bullets.join(" ")).join(" ");
  for (const tool of KNOWN_TOOLS) {
    if (allText.includes(tool)) found.add(tool);
  }

  const el = document.getElementById("skills-grid");
  el.innerHTML = [...found].map((s) => `<span class="skill-chip">${escapeHtml(s)}</span>`).join("");
}

function renderHeroStat() {
  // "60+" people coordinated across the enterprise hardening initiative
  // is the single most characteristic stat for this lens — pulled from
  // the actual RRMS bullet rather than hardcoded separately, so it can
  // never silently drift from the source text.
  const rrms = RESUME_DATA.jobs.find((j) => j.company.includes("Rapid Response"));
  const match = rrms && rrms.bullets.join(" ").match(/(\d+)\+?\s*(?:people|stakeholders)/i);
  const value = match ? match[1] : "60";
  document.getElementById("stat-number").textContent = `${value}+`;
}

renderHeroStat();
renderSummary();
renderTimeline();
renderExperience();
renderSkills();

// Trigger the signature Gantt-fill animations once, shortly after load —
// the hero's milestone track plus every job's task bar fill in together,
// then a shimmer sweep runs once across each filled bar to reinforce the
// "delivered" metaphor.
window.addEventListener("load", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const heroFill = document.getElementById("stat-progress-fill");
  const jobFills = document.querySelectorAll(".gantt-fill");

  if (reduceMotion) {
    if (heroFill) heroFill.style.width = "100%";
    jobFills.forEach((el) => { el.style.width = `${el.dataset.pct}%`; });
    return;
  }

  setTimeout(() => {
    if (heroFill) heroFill.classList.add("filled");
    jobFills.forEach((el, i) => {
      setTimeout(() => {
        el.style.width = `${el.dataset.pct}%`;
        el.style.transition = "width 0.9s ease-out";
        // After the bar finishes filling, add a shimmer class that runs
        // a highlight sweep — "this project was delivered" signal.
        setTimeout(() => el.classList.add("shimmer"), 1000 + i * 90);
      }, i * 90);
    });
  }, 350);
});

// ===========================================================================
// BACKGROUND CANVAS — structured Gantt grid: horizontal schedule rows,
// vertical milestone markers with pulsier breathing, and a single "today"
// indicator that crawls slowly from left to right across the full viewport
// on a long loop — the page feels like a live project board, not a static
// diagram. Distinct from cyber's scan-line (one pass, stops) and infra's
// health-check sweep (top-to-bottom, repeating): this one is horizontal,
// slow, and continuous.
// ===========================================================================
(function () {
  const canvas = document.getElementById("grid-canvas");
  if (!canvas) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");

  let width, height, dpr;
  let milestones = [];
  let rafId = null;
  let startTime = performance.now();

  const TODAY_PERIOD = 28000; // ms for "today" marker to cross full width

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildMilestones();
  }

  function buildMilestones() {
    const count = Math.max(5, Math.floor(width / 180));
    milestones = [];
    for (let i = 0; i < count; i++) {
      milestones.push({
        x: (width / count) * (i + 0.5) + (Math.random() - 0.5) * 40,
        phase: Math.random() * Math.PI * 2,
        // Diamond milestone marker at a random y position
        markerY: height * (0.15 + Math.random() * 0.7),
      });
    }
  }

  function drawRows() {
    const rowHeight = 56;
    ctx.strokeStyle = "rgba(154, 159, 172, 0.06)";
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += rowHeight) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawMilestones(t) {
    for (const m of milestones) {
      // Stronger breathing range than before: 0.04–0.18 instead of 0.05–0.09
      const breathe = 0.04 + 0.14 * ((Math.sin(t / 1600 + m.phase) + 1) / 2);
      ctx.strokeStyle = `rgba(245, 179, 66, ${breathe})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(m.x, 0);
      ctx.lineTo(m.x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Small diamond marker on the line at its assigned y
      const markerBright = 0.15 + 0.35 * ((Math.sin(t / 1600 + m.phase) + 1) / 2);
      ctx.fillStyle = `rgba(245, 179, 66, ${markerBright})`;
      ctx.beginPath();
      ctx.save();
      ctx.translate(m.x, m.markerY);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
  }

  function drawToday(t) {
    const progress = (t % TODAY_PERIOD) / TODAY_PERIOD;
    const x = progress * width;

    // Glow band
    const grad = ctx.createLinearGradient(x - 24, 0, x + 24, 0);
    grad.addColorStop(0, "rgba(91, 121, 214, 0)");
    grad.addColorStop(0.5, "rgba(91, 121, 214, 0.12)");
    grad.addColorStop(1, "rgba(91, 121, 214, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - 24, 0, 48, height);

    // The marker line itself
    ctx.strokeStyle = "rgba(91, 121, 214, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // "TODAY" label at top
    ctx.fillStyle = "rgba(91, 121, 214, 0.65)";
    ctx.font = `700 9px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText("TODAY", x, 14);
    ctx.textAlign = "left";
  }

  function frame() {
    const t = performance.now() - startTime;
    ctx.clearRect(0, 0, width, height);
    drawRows();
    drawMilestones(t);
    drawToday(t);
    rafId = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);

  if (reduceMotion) {
    drawRows();
    ctx.strokeStyle = "rgba(245, 179, 66, 0.1)";
    ctx.setLineDash([4, 6]);
    for (const m of milestones) {
      ctx.beginPath();
      ctx.moveTo(m.x, 0);
      ctx.lineTo(m.x, height);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  } else {
    frame();
  }
})();
