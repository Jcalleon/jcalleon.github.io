// ===========================================================================
// CONTENT POPULATION — all text pulled directly from RESUME_DATA
// (helpdesk-resume-data.js), generated from the same finalized,
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
// fixed vocabulary of real support-relevant tool names that appear
// verbatim in the source CV, so it can never drift out of sync.
function renderSkills() {
  const KNOWN_TOOLS = [
    "Active Directory", "BitLocker", "Jamf", "Intune", "Okta", "Atlassian",
    "1Password", "Azure", "CrowdStrike",
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
  // 500% improvement in technical support efficiency is the single most
  // characteristic stat for this lens — pulled from the actual Apple/
  // Keeco/etc bullet rather than hardcoded separately, so it can never
  // silently drift from the source text.
  const support = RESUME_DATA.jobs.find((j) => j.company.includes("Apple"));
  const match = support && support.bullets.join(" ").match(/by (\d+)%/);
  const value = match ? match[1] : "500";
  document.getElementById("stat-number").textContent = `${value}%`;
}

renderHeroStat();
renderSummary();
renderTimeline();
renderExperience();
renderSkills();

// Trigger the "ticket resolved" signature animation once, shortly after load.
window.addEventListener("load", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;
  setTimeout(() => {
    document.getElementById("stat-number").classList.add("resolved");
  }, 400);
});

// ===========================================================================
// TICKET TOAST — a small "new ticket" notification slides in from the
// right edge near the hero stat every ~6s, waits, then slides back out.
// It's purely decorative but it makes the page feel live and
// queue-like — different from ambient canvas motion because it's a
// real DOM element with text, not a graphical shape.
// ===========================================================================
(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const TICKETS = [
    "New ticket · Password reset",
    "New ticket · VPN access request",
    "New ticket · Printer offline",
    "New ticket · MFA enrollment",
    "New ticket · Account locked",
    "New ticket · Software install",
    "New ticket · Onboarding request",
  ];
  let idx = 0;

  const toast = document.createElement("div");
  toast.className = "ticket-toast";
  document.body.appendChild(toast);

  function showNext() {
    toast.textContent = TICKETS[idx % TICKETS.length];
    idx++;
    toast.classList.add("visible");
    setTimeout(() => {
      toast.classList.remove("visible");
    }, 2400);
  }

  // First one after a short delay, then every 5.5s
  setTimeout(() => {
    showNext();
    setInterval(showNext, 5500);
  }, 2200);
})();

// ===========================================================================
// BACKGROUND CANVAS — a scatter of soft, rounded chat-bubble shapes
// drifting upward through the page, swaying gently side to side, fading
// in as they spawn and fading out as they exit — like a queue of
// messages continuously moving through, not just static ambient shapes.
// Warm and human, not a system display: no grid, no sharp lines, no
// monospace-feeling motion.
// ===========================================================================
(function () {
  const canvas = document.getElementById("bubble-canvas");
  if (!canvas) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");

  let width, height, dpr;
  let bubbles = [];
  let rafId = null;
  let startTime = performance.now();

  const COLORS = ["rgba(255, 138, 92, 0.07)", "rgba(242, 169, 59, 0.07)", "rgba(255, 138, 92, 0.05)"];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBubbles();
  }

  function buildBubbles() {
    const count = Math.max(7, Math.min(11, Math.floor((width * height) / 170000)));
    bubbles = [];
    for (let i = 0; i < count; i++) {
      bubbles.push(makeBubble(Math.random() * height));
    }
  }

  function makeBubble(startY) {
    const w = 50 + Math.random() * 60;
    const h = w * (0.55 + Math.random() * 0.15);
    // Bias x toward the left/right margins, away from the centered
    // 760px content column, so bubbles read as ambient edge texture
    // rather than sitting on top of text.
    const contentHalf = 380;
    const center = width / 2;
    const edgeSpan = Math.max(0, center - contentHalf - 40);
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = center + side * (contentHalf + 40 + Math.random() * edgeSpan);
    return {
      x: Math.max(20, Math.min(width - 20, x)),
      baseX: Math.max(20, Math.min(width - 20, x)),
      y: startY,
      w, h,
      vy: -0.22 - Math.random() * 0.22,
      swayAmp: 8 + Math.random() * 14,
      swaySpeed: 0.0006 + Math.random() * 0.0006,
      swayPhase: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      bornAt: performance.now(),
    };
  }

  function drawBubble(b, alpha) {
    const r = Math.min(b.w, b.h) * 0.32;
    ctx.beginPath();
    // rounded rect body
    const x = b.x - b.w / 2, y = b.y - b.h / 2;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + b.w, y, x + b.w, y + b.h, r);
    ctx.arcTo(x + b.w, y + b.h, x, y + b.h, r);
    ctx.arcTo(x, y + b.h, x, y, r);
    ctx.arcTo(x, y, x + b.w, y, r);
    ctx.closePath();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.restore();
  }

  // Fade in over the first 900ms after spawn, fade out over the last
  // 700ms before despawn — so bubbles arrive and leave gently instead of
  // popping in/out at the canvas edge.
  function lifecycleAlpha(b, t, despawnAt) {
    const age = t - b.bornAt;
    const fadeIn = Math.min(1, age / 900);
    const remaining = despawnAt - t;
    const fadeOut = remaining < 700 ? Math.max(0, remaining / 700) : 1;
    return Math.min(fadeIn, fadeOut);
  }

  function frame(now) {
    const t = now || performance.now();
    ctx.clearRect(0, 0, width, height);
    for (const b of bubbles) {
      b.y += b.vy;
      b.x = b.baseX + Math.sin(t * b.swaySpeed + b.swayPhase) * b.swayAmp;
      const despawnAt = b.bornAt + ((height + b.h + 80) / -b.vy);
      const alpha = lifecycleAlpha(b, t, despawnAt);
      drawBubble(b, alpha);
      if (b.y + b.h < -40) {
        Object.assign(b, makeBubble(height + 40));
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);

  if (reduceMotion) {
    // Static single frame: bubbles visible at their initial positions, no drift.
    for (const b of bubbles) drawBubble(b, 1);
  } else {
    frame(startTime);
  }
})();
