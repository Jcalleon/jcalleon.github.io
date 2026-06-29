// ===========================================================================
// CONTENT POPULATION — all text pulled directly from RESUME_DATA
// (cloudautomation-resume-data.js), generated from the same finalized,
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
// fixed vocabulary of real cloud/automation tool names that appear
// verbatim in the source CV, so it can never drift out of sync.
function renderSkills() {
  const KNOWN_TOOLS = [
    "Azure", "Azure CLI", "Terraform", "Ansible", "Entra ID", "Intune",
    "Azure AD Domain Services", "PowerShell", "Qualys", "Okta", "Citrix",
    "Azure Resource Manager",
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
  // ~30 hours/week eliminated via PowerShell + Qualys API automation is
  // the single most characteristic stat for this lens — pulled from the
  // actual RRMS bullet rather than hardcoded separately, so it can never
  // silently drift from the source text.
  const rrms = RESUME_DATA.jobs.find((j) => j.company.includes("Rapid Response"));
  const match = rrms && rrms.bullets.join(" ").match(/~?(\d+)\s*hours/);
  const value = match ? match[1] : "30";
  document.getElementById("stat-number").textContent = `${value}h`;
}

renderHeroStat();
renderSummary();
renderTimeline();
renderExperience();
renderSkills();

// Trigger the "sync" signature animation once, shortly after load.
window.addEventListener("load", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;
  setTimeout(() => {
    document.getElementById("stat-number").classList.add("synced");
  }, 400);
});

// ===========================================================================
// BACKGROUND CANVAS — a flowing automation pipeline: a small chain of
// nodes linked by gently curved conduits, with particles moving steadily
// in one direction along each conduit (loop, not bounce), evoking data
// flowing through an automated pipeline. Distinct from network's
// mesh-of-packets (random topology, packets in any direction) and
// cyber's scan-line: here motion is uniform and directional, like a
// pipeline rather than a network.
// ===========================================================================
(function () {
  const canvas = document.getElementById("pipeline-canvas");
  if (!canvas) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");

  let width, height, dpr;
  let stages = [];
  let particles = [];
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
    buildPipeline();
  }

  function buildPipeline() {
    const stageCount = Math.max(4, Math.min(6, Math.floor(width / 260)));
    stages = [];
    for (let i = 0; i < stageCount; i++) {
      const x = (width / (stageCount - 1)) * i;
      const y = height * 0.5 + Math.sin(i * 1.3) * height * 0.18;
      stages.push({ x, y, bob: Math.random() * Math.PI * 2 });
    }
    particles = [];
    for (let i = 0; i < stageCount - 1; i++) {
      const lane = 1 + Math.floor(Math.random() * 2);
      for (let k = 0; k < lane; k++) {
        particles.push({ segment: i, t: Math.random(), speed: 0.0018 + Math.random() * 0.0022 });
      }
    }
  }

  function curvePoint(a, b, t) {
    // simple quadratic curve bowing slightly toward the vertical midline
    const midX = (a.x + b.x) / 2;
    const midY = Math.min(a.y, b.y) - 40;
    const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * midX + t * t * b.x;
    const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * midY + t * t * b.y;
    return { x, y };
  }

  function frame(time) {
    ctx.clearRect(0, 0, width, height);

    // conduits
    ctx.strokeStyle = "rgba(167, 139, 250, 0.16)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < stages.length - 1; i++) {
      const a = stages[i], b = stages[i + 1];
      const mid = curvePoint(a, b, 0.5);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mid.x * 2 - (a.x + b.x) / 2 + (a.x + b.x) / 2, Math.min(a.y, b.y) - 40, b.x, b.y);
      ctx.stroke();
    }

    // stage nodes, with a slight vertical bob
    for (const s of stages) {
      const y = s.y + Math.sin(time / 1600 + s.bob) * 3;
      ctx.beginPath();
      ctx.arc(s.x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(167, 139, 250, 0.45)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s.x, y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(167, 139, 250, 0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // particles flowing along conduits, one direction, looping
    ctx.fillStyle = "rgba(110, 231, 224, 0.85)";
    for (const p of particles) {
      p.t += p.speed;
      if (p.t > 1) p.t -= 1;
      const a = stages[p.segment], b = stages[p.segment + 1];
      const pt = curvePoint(a, b, p.t);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    rafId = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);

  if (reduceMotion) {
    // Static single frame: conduits and stage nodes visible, no particle
    // motion and no bob.
    ctx.strokeStyle = "rgba(167, 139, 250, 0.16)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < stages.length - 1; i++) {
      const a = stages[i], b = stages[i + 1];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 40, b.x, b.y);
      ctx.stroke();
    }
    for (const s of stages) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(167, 139, 250, 0.45)";
      ctx.fill();
    }
  } else {
    requestAnimationFrame(frame);
  }
})();
