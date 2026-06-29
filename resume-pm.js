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
// the hero's milestone track plus every job's task bar fill in together.
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
        el.style.setProperty("--target-width", `${el.dataset.pct}%`);
        el.style.width = `${el.dataset.pct}%`;
        el.style.transition = "width 0.9s ease-out";
      }, i * 90);
    });
  }, 350);
});

// ===========================================================================
// BACKGROUND CANVAS — a structured grid of faint horizontal "schedule
// rows" with a handful of thin vertical milestone markers, evoking a
// Gantt chart's underlying grid rather than a network or scan motif.
// Mostly static, with a slow, subtle opacity breathing on the milestone
// markers so the page doesn't feel inert.
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
    const count = Math.max(4, Math.floor(width / 220));
    milestones = [];
    for (let i = 0; i < count; i++) {
      milestones.push({ x: (width / count) * (i + 0.5) + (Math.random() - 0.5) * 40, phase: Math.random() * Math.PI * 2 });
    }
  }

  function drawRows() {
    const rowHeight = 64;
    ctx.strokeStyle = "rgba(154, 159, 172, 0.05)";
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
      const breathe = 0.05 + 0.04 * Math.sin(t / 1800 + m.phase);
      ctx.strokeStyle = `rgba(245, 179, 66, ${breathe})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.x, 0);
      ctx.lineTo(m.x, height);
      ctx.stroke();
    }
  }

  function frame() {
    const t = performance.now() - startTime;
    ctx.clearRect(0, 0, width, height);
    drawRows();
    drawMilestones(t);
    rafId = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);

  if (reduceMotion) {
    drawRows();
    ctx.strokeStyle = "rgba(245, 179, 66, 0.07)";
    for (const m of milestones) {
      ctx.beginPath();
      ctx.moveTo(m.x, 0);
      ctx.lineTo(m.x, height);
      ctx.stroke();
    }
  } else {
    frame();
  }
})();
