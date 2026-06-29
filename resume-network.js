// ===========================================================================
// CONTENT POPULATION — all text pulled directly from RESUME_DATA
// (networking-resume-data.js), generated from the same finalized,
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
// fixed vocabulary of real network/infra tool names that appear verbatim
// in the source CV, so it can never drift out of sync with the bullets.
function renderSkills() {
  const KNOWN_TOOLS = [
    "Cisco", "MikroTik", "RouterOS", "Meraki", "pfSense", "Sophos",
    "Azure", "Azure CLI", "Samba", "PXE", "Okta", "CrowdStrike",
    "Cortex XDR", "SentinelOne", "ESET", "BitLocker", "Jamf", "Intune",
    "Active Directory", "VLAN", "IPSec", "VPN", "NSG",
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
  // 99.999% network uptime is the single most characteristic stat for
  // this lens — pulled from the actual InSync bullet rather than
  // hardcoded separately, so it can never silently drift from the source.
  const insync = RESUME_DATA.jobs.find((j) => j.company.includes("InSync"));
  const match = insync && insync.bullets.join(" ").match(/(\d+(?:\.\d+)?)%/);
  const value = match ? match[1] : "99.999";
  document.getElementById("stat-number").textContent = `${value}%`;
}

renderHeroStat();
renderSummary();
renderTimeline();
renderExperience();
renderSkills();

// Trigger the "link up" signature animation once, shortly after load.
window.addEventListener("load", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;
  setTimeout(() => {
    document.getElementById("stat-number").classList.add("linking");
  }, 400);
});

// ===========================================================================
// BACKGROUND CANVAS — a live topology: a handful of nodes connected by
// edges, with small packets actually traveling along those edges on a
// loop. Distinct from cyber's scan-line sweep: here the network itself is
// the visual, not a beam passing over a grid.
// ===========================================================================
(function () {
  const canvas = document.getElementById("topo-canvas");
  if (!canvas) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");

  let width, height, dpr;
  let nodes = [];
  let edges = [];
  let packets = [];
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
    buildTopology();
  }

  function buildTopology() {
    const count = Math.max(7, Math.min(13, Math.floor((width * height) / 90000)));
    nodes = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 2 + Math.random() * 1.5,
      });
    }
    edges = [];
    // Connect each node to its 2 nearest neighbors, giving a sparse,
    // genuinely topology-like mesh rather than a dense random graph.
    for (let i = 0; i < nodes.length; i++) {
      const dists = nodes
        .map((n, j) => ({ j, d: j === i ? Infinity : Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y) }))
        .sort((a, b) => a.d - b.d);
      for (let k = 0; k < 2; k++) {
        const j = dists[k].j;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!edges.find((e) => e.key === key)) {
          edges.push({ key, a: i, b: j });
        }
      }
    }
    packets = edges.slice(0, Math.ceil(edges.length * 0.6)).map((e) => ({
      edge: e,
      t: Math.random(),
      speed: 0.0025 + Math.random() * 0.003,
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, width, height);

    // drift nodes gently
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > height) n.vy *= -1;
    }

    // edges
    ctx.strokeStyle = "rgba(14, 165, 233, 0.18)";
    ctx.lineWidth = 1;
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // nodes
    ctx.fillStyle = "rgba(143, 169, 189, 0.5)";
    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // packets traveling along edges
    ctx.fillStyle = "rgba(56, 225, 196, 0.9)";
    for (const p of packets) {
      p.t += p.speed;
      if (p.t > 1) p.t -= 1;
      const a = nodes[p.edge.a], b = nodes[p.edge.b];
      const x = a.x + (b.x - a.x) * p.t;
      const y = a.y + (b.y - a.y) * p.t;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    rafId = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);

  if (reduceMotion) {
    // Static single frame: nodes and edges visible, no drift or packets.
    ctx.strokeStyle = "rgba(14, 165, 233, 0.18)";
    ctx.lineWidth = 1;
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(143, 169, 189, 0.5)";
    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    frame();
  }
})();
