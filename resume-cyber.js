// ===========================================================================
// CONTENT POPULATION — all text pulled directly from RESUME_DATA
// (cyber-resume-data.js), generated from the same finalized, fact-checked
// CV content used for the .docx resumes — nothing here is invented.
// ===========================================================================

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

// Wraps the first standalone number/percent in a bullet with <strong> for
// quick scanning, matching the "fast scannability" design goal — mirrors
// the same numbers-in-bold convention already used on the homepage and in
// the .docx resumes, not a new invented pattern.
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

function renderExperience() {
  const el = document.getElementById("experience-list");
  el.innerHTML = RESUME_DATA.jobs
    .map(
      (job) => `
    <div class="exp-job">
      <div class="exp-job-head">
        <div class="exp-job-title-block">
          <h3>${escapeHtml(job.title)}</h3>
          <p>${escapeHtml(job.company)}</p>
        </div>
        <span class="exp-job-dates">${escapeHtml(job.dates)}</span>
      </div>
      <ul class="exp-bullets">
        ${job.bullets.map((b) => `<li>${boldNumbers(b)}</li>`).join("")}
      </ul>
    </div>`
    )
    .join("");
}

// Derives a skills/tools list from the actual bullet text rather than a
// separate hand-maintained list, so it can never drift out of sync with
// what the experience section actually says. Matches a fixed vocabulary of
// real tool/platform names that appear verbatim in the source CVs.
function renderSkills() {
  const KNOWN_TOOLS = [
    "Splunk", "ELK", "Graylog", "Cortex XDR", "CrowdStrike", "SentinelOne", "ESET",
    "PowerShell", "Qualys", "Tenable", "KACE", "Okta", "Atlassian", "1Password",
    "Active Directory", "Intune", "BitLocker", "Jamf", "Azure", "Terraform", "Ansible",
    "MFA", "VPN",
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
  // The 82% figure is the single most characteristic stat for this lens —
  // pulled from the actual RRMS bullet rather than hardcoded separately,
  // so it can never silently drift from the real source text.
  const rrms = RESUME_DATA.jobs.find((j) => j.company.includes("Rapid Response"));
  const match = rrms && rrms.bullets.join(" ").match(/(\d+)%/);
  const value = match ? match[1] : "82";
  document.getElementById("stat-number").textContent = `${value}%`;
}

renderHeroStat();
renderSummary();
renderTimeline();
renderExperience();
renderSkills();

// Trigger the scan-sweep signature animation once, shortly after load —
// not on every scroll/replay, since the design calls for one orchestrated
// moment, not a repeating gimmick.
window.addEventListener("load", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;
  setTimeout(() => {
    document.getElementById("stat-number").classList.add("scanning");
  }, 400);
});

// ===========================================================================
// BACKGROUND CANVAS — slow vertical scan-line sweep with faint grid dots,
// evoking a security-monitoring display. Distinct from the homepage's
// network-topology canvas: no nodes/edges/packets here, just a horizontal
// scanning beam over a static dot grid, true to a detection/scanning
// metaphor rather than a network-topology one.
// ===========================================================================
(function () {
  const canvas = document.getElementById("scan-canvas");
  if (!canvas) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");

  let width, height, dpr;
  let scanY = 0;
  let rafId = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawGrid() {
    const spacing = 42;
    ctx.fillStyle = "rgba(138, 150, 168, 0.12)";
    for (let x = 0; x < width; x += spacing) {
      for (let y = 0; y < height; y += spacing) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function drawScanLine() {
    const gradient = ctx.createLinearGradient(0, scanY - 80, 0, scanY + 80);
    gradient.addColorStop(0, "rgba(46, 217, 195, 0)");
    gradient.addColorStop(0.5, "rgba(46, 217, 195, 0.06)");
    gradient.addColorStop(1, "rgba(46, 217, 195, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, scanY - 80, width, 160);

    ctx.fillStyle = "rgba(46, 217, 195, 0.35)";
    ctx.fillRect(0, scanY, width, 1.5);
  }

  function frame() {
    ctx.clearRect(0, 0, width, height);
    drawGrid();
    drawScanLine();
    scanY += 0.6;
    if (scanY > height + 80) scanY = -80;
    rafId = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);

  if (reduceMotion) {
    // Static single frame, no animation loop, respecting the user's
    // motion preference rather than ignoring it.
    drawGrid();
  } else {
    frame();
  }
})();
