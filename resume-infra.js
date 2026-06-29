// ===========================================================================
// CONTENT POPULATION — all text pulled directly from RESUME_DATA
// (infrastructure-resume-data.js), generated from the same finalized,
// fact-checked CV content used for the .docx resumes — nothing here is
// invented. Mirrors resume-cyber.js's structure exactly for consistency
// across lenses.
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

// Derives a tools/platforms list from the actual bullet text, matching a
// fixed vocabulary of real infra tool names that appear verbatim in the
// source CV, so it can never drift out of sync with the bullets.
function renderSkills() {
  const KNOWN_TOOLS = [
    "Tenable", "KACE", "CrowdStrike", "Okta", "Atlassian", "1Password",
    "Splunk", "ELK", "Graylog", "Cortex XDR", "SentinelOne", "ESET",
    "Intune", "Ansible", "PowerShell", "Qualys", "Active Directory",
    "Cisco",
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
  // 90% patch compliance is the single most characteristic stat for this
  // lens — pulled from the actual Smart Circle bullet rather than
  // hardcoded separately, so it can never silently drift from the source.
  const smartCircle = RESUME_DATA.jobs.find((j) => j.company.includes("Smart Circle"));
  const match = smartCircle && smartCircle.bullets.join(" ").match(/to (\d+)%/);
  const value = match ? match[1] : "90";
  document.getElementById("stat-number").textContent = `${value}%`;
}

renderHeroStat();
renderSummary();
renderTimeline();
renderExperience();
renderSkills();

// Trigger the "status online" signature animation once, shortly after load.
window.addEventListener("load", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;
  setTimeout(() => {
    document.getElementById("stat-number").classList.add("online");
  }, 400);
});

// ===========================================================================
// BACKGROUND CANVAS — a faint architectural blueprint grid (fine lines,
// occasional cross-tick "measurement marks") with a handful of steady
// status dots that pulse in place. No sweeping motion, no traveling
// elements: stability and structure are the point, not activity.
// Distinct from cyber's scan-line and network's traveling packets.
// ===========================================================================
(function () {
  const canvas = document.getElementById("blueprint-canvas");
  if (!canvas) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");

  let width, height, dpr;
  let statusDots = [];
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
    buildStatusDots();
  }

  function buildStatusDots() {
    const spacing = 160;
    statusDots = [];
    for (let x = spacing; x < width; x += spacing) {
      for (let y = spacing; y < height; y += spacing) {
        // sparse: only place a dot at roughly a third of grid intersections
        if (Math.random() < 0.35) {
          statusDots.push({ x, y, phase: Math.random() * Math.PI * 2 });
        }
      }
    }
  }

  function drawGrid() {
    const spacing = 40;
    ctx.strokeStyle = "rgba(143, 176, 160, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    // measurement cross-ticks at major intersections
    const major = spacing * 4;
    ctx.strokeStyle = "rgba(143, 176, 160, 0.14)";
    for (let x = 0; x < width; x += major) {
      for (let y = 0; y < height; y += major) {
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
        ctx.stroke();
      }
    }
  }

  function drawStatusDots(t) {
    for (const d of statusDots) {
      const pulse = 0.4 + 0.3 * Math.sin(t / 1400 + d.phase);
      ctx.beginPath();
      ctx.arc(d.x, d.y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(52, 211, 153, ${pulse})`;
      ctx.fill();
    }
  }

  function frame() {
    const t = performance.now() - startTime;
    ctx.clearRect(0, 0, width, height);
    drawGrid();
    drawStatusDots(t);
    rafId = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);

  if (reduceMotion) {
    // Static single frame: grid plus dots at fixed mid-brightness, no pulse.
    drawGrid();
    for (const d of statusDots) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(52, 211, 153, 0.55)";
      ctx.fill();
    }
  } else {
    frame();
  }
})();
