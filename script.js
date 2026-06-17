// Placeholder click feedback — flash the element so it's obvious what's a stand-in
document.querySelectorAll('[data-placeholder]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    el.classList.add('placeholder-flash');
    setTimeout(() => el.classList.remove('placeholder-flash'), 900);
  });
});

// ===========================================================================
// NETWORK TOPOLOGY ANIMATION — nodes + edges + traveling "packets"
// Grounded in the subject: this is what a network/SOC diagram actually looks
// like, not generic floating particles.
// ===========================================================================
(function () {
  const canvas = document.getElementById('network-canvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let nodes = [];
  let edges = [];
  let packets = [];
  let rafId = null;

  const COLORS = {
    node: 'rgba(91, 143, 176, 0.85)',     // steel blue
    nodeCore: 'rgba(230, 232, 235, 1)', // text
    edge: 'rgba(91, 143, 176, 0.3)',
    edgeActive: 'rgba(240, 169, 60, 0.6)', // amber
    packet: 'rgba(240, 169, 60, 1)',
    packetGlow: 'rgba(240, 169, 60, 0.5)'
  };

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildGraph() {
    const isMobile = width < 640;
    const nodeCount = isMobile ? 9 : 28;
    const textColEdge = isMobile ? 0 : width * 0.46; // keep main text column lighter
    const yBound = isMobile ? height * 0.16 : height; // mobile: keep activity in top strip only
    nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      let x = Math.random() * width;
      // bias: push ~70% of nodes to the right of the text column on desktop
      if (!isMobile && Math.random() < 0.7) {
        x = textColEdge + Math.random() * (width - textColEdge);
      }
      nodes.push({
        x,
        y: Math.random() * yBound,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 2.6 + Math.random() * 2.4,
        pulse: Math.random() * Math.PI * 2,
        yBound
      });
    }

    // Connect each node to its 2-3 nearest neighbors (real topology feel,
    // not a fully connected mess)
    edges = [];
    const maxDist = Math.max(width, height) * 0.32;
    for (let i = 0; i < nodes.length; i++) {
      const dists = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < maxDist) dists.push({ j, d });
      }
      dists.sort((a, b) => a.d - b.d);
      const connections = dists.slice(0, 2 + Math.floor(Math.random() * 2));
      connections.forEach(c => {
        const key = i < c.j ? `${i}-${c.j}` : `${c.j}-${i}`;
        if (!edges.find(e => e.key === key)) {
          edges.push({ key, a: i, b: c.j });
        }
      });
    }

    packets = [];
    spawnPackets();
  }

  function spawnPackets() {
    const isMobile = width < 640;
    const packetCount = isMobile ? 5 : 10;
    for (let i = 0; i < packetCount; i++) {
      addPacket();
    }
  }

  function addPacket() {
    if (edges.length === 0) return;
    const edge = edges[Math.floor(Math.random() * edges.length)];
    packets.push({
      edge,
      t: 0,
      speed: 0.0035 + Math.random() * 0.004,
      reverse: Math.random() > 0.5
    });
  }

  function step() {
    // drift nodes gently
    nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;
      n.pulse += 0.02;
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > (n.yBound || height)) n.vy *= -1;
    });

    ctx.clearRect(0, 0, width, height);

    // edges
    const activeEdgeKeys = new Set(packets.map(p => p.edge.key));
    edges.forEach(e => {
      const a = nodes[e.a], b = nodes[e.b];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = activeEdgeKeys.has(e.key) ? COLORS.edgeActive : COLORS.edge;
      ctx.lineWidth = activeEdgeKeys.has(e.key) ? 1.4 : 1;
      ctx.stroke();
    });

    // packets traveling along edges
    packets.forEach(p => {
      p.t += p.speed;
      if (p.t >= 1) {
        p.t = 0;
        p.edge = edges[Math.floor(Math.random() * edges.length)];
        p.reverse = Math.random() > 0.5;
      }
      const a = nodes[p.edge.a], b = nodes[p.edge.b];
      const t = p.reverse ? 1 - p.t : p.t;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;

      // glow
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 13);
      grad.addColorStop(0, COLORS.packetGlow);
      grad.addColorStop(1, 'rgba(240, 169, 60, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLORS.packet;
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // nodes
    nodes.forEach(n => {
      const pulseR = n.r + Math.sin(n.pulse) * 0.6;
      ctx.beginPath();
      ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.node;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(n.x, n.y, pulseR * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.nodeCore;
      ctx.fill();
    });

    rafId = requestAnimationFrame(step);
  }

  function init() {
    resize();
    buildGraph();
    if (rafId) cancelAnimationFrame(rafId);
    if (!reduceMotion) {
      step();
    } else {
      // static single frame for reduced-motion users
      ctx.clearRect(0, 0, width, height);
      edges.forEach(e => {
        const a = nodes[e.a], b = nodes[e.b];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = COLORS.edge;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.node;
        ctx.fill();
      });
    }
  }

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(init, 200);
  });

  init();
})();

// ===========================================================================
// EXPOSURE MAP ANIMATION — devices, shields, locks, scanning sweep
// Shodan/Censys-style global device map. Distinct from the hero's network
// topology: this one reads as "scanning the perimeter", not "live traffic".
// ===========================================================================
(function () {
  const canvas = document.getElementById('exposure-canvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let devices = [];
  let sweepAngle = 0;
  let rafId = null;
  let t = 0;

  const ICE = 'rgba(200, 228, 248, 1)';
  const ICE_DIM = 'rgba(140, 185, 218, 0.75)';
  const ICE_FAINT = 'rgba(91, 143, 176, 0.35)';
  const FLAG = 'rgba(240, 169, 60, 1)';
  const SWEEP = 'rgba(160, 205, 235, 0.22)';

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function randomIP() {
    const seg = () => Math.floor(Math.random() * 255);
    return `${seg()}.${seg()}.${seg()}.${seg()}`;
  }

  function buildDevices() {
    const isMobile = width < 640;
    devices = [];

    if (isMobile) {
      // Mobile: heading spans y=64-109, card grid starts y=157 (measured).
      // Use the ~35px gap between them for a thin device band.
      const bandTop = 118;
      const bandBottom = 148;
      const count = 6;
      for (let i = 0; i < count; i++) {
        const flagged = Math.random() < 0.22;
        devices.push({
          x: 20 + Math.random() * (width - 40),
          y: bandTop + Math.random() * (bandBottom - bandTop),
          type: ['shield', 'lock', 'node'][Math.floor(Math.random() * 3)],
          flagged,
          ip: randomIP(),
          showLabel: flagged && Math.random() < 0.5,
          blink: Math.random() * Math.PI * 2,
          blinkSpeed: 0.015 + Math.random() * 0.02
        });
      }
      // thin out labels that would collide
      const labeled = [];
      devices.forEach(d => {
        if (!d.showLabel) return;
        const tooClose = labeled.some(o => Math.abs(o.x - d.x) < 100 && Math.abs(o.y - d.y) < 16);
        if (tooClose) d.showLabel = false; else labeled.push(d);
      });
      return;
    }

    const count = 30;
    const topBand = 170; // hard cap, well above where cred cards begin
    const headingZone = { top: 50, bottom: 145, left: 0, right: Math.min(width, 650) };
    let attempts = 0;
    while (devices.length < count && attempts < count * 6) {
      attempts++;
      const x = Math.random() * width;
      const y = Math.random() * topBand;
      const inHeadingZone = y > headingZone.top && y < headingZone.bottom && x > headingZone.left && x < headingZone.right;
      if (inHeadingZone) continue;
      const flagged = Math.random() < 0.22;
      devices.push({
        x, y,
        type: ['shield', 'lock', 'node'][Math.floor(Math.random() * 3)],
        flagged,
        ip: randomIP(),
        showLabel: flagged ? Math.random() < 0.7 : Math.random() < 0.12,
        blink: Math.random() * Math.PI * 2,
        blinkSpeed: 0.015 + Math.random() * 0.02
      });
    }

    // suppress labels that would visually collide with an already-labeled
    // device (labels render to the right of the icon, ~90px wide)
    const labeled = [];
    devices.forEach(d => {
      if (!d.showLabel) return;
      const tooClose = labeled.some(o => Math.abs(o.x - d.x) < 110 && Math.abs(o.y - d.y) < 16);
      if (tooClose) {
        d.showLabel = false;
      } else {
        labeled.push(d);
      }
    });
  }

  function drawShield(x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.bezierCurveTo(size * 0.7, -size * 0.7, size * 0.7, size * 0.2, 0, size);
    ctx.bezierCurveTo(-size * 0.7, size * 0.2, -size * 0.7, -size * 0.7, 0, -size);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.35, 0);
    ctx.lineTo(-size * 0.1, size * 0.3);
    ctx.lineTo(size * 0.4, -size * 0.3);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawLock(x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -size * 0.15, size * 0.55, Math.PI, 0, false);
    ctx.stroke();
    ctx.strokeRect(-size * 0.6, -size * 0.15, size * 1.2, size * 0.9);
    ctx.restore();
  }

  function drawNode(x, y, size, color) {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function step() {
    t += 1;
    ctx.clearRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.18;
    const sweepR = Math.max(width, height) * 0.95;

    // faint concentric scan rings
    for (let r = 1; r <= 4; r++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (sweepR / 4) * r, 0, Math.PI * 2);
      ctx.strokeStyle = ICE_FAINT;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // rotating sweep wedge
    if (!reduceMotion) sweepAngle += 0.006;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, sweepR, sweepAngle, sweepAngle + 0.5);
    ctx.closePath();
    ctx.fillStyle = SWEEP;
    ctx.fill();
    ctx.restore();

    // devices
    devices.forEach(d => {
      d.blink += d.blinkSpeed;
      const pulse = 0.7 + Math.sin(d.blink) * 0.3;
      const angleToDevice = Math.atan2(d.y - cy, d.x - cx);
      let normalizedSweep = sweepAngle % (Math.PI * 2);
      let normalizedAngle = angleToDevice % (Math.PI * 2);
      if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
      if (normalizedSweep < 0) normalizedSweep += Math.PI * 2;
      const diff = Math.abs(normalizedAngle - normalizedSweep);
      const justSwept = diff < 0.5 || diff > Math.PI * 2 - 0.5;

      const baseColor = d.flagged ? FLAG : ICE_DIM;
      const color = justSwept ? (d.flagged ? FLAG : ICE) : baseColor;
      const size = justSwept ? 11 * pulse : 8.5;

      if (d.type === 'shield') drawShield(d.x, d.y, size, color);
      else if (d.type === 'lock') drawLock(d.x, d.y, size, color);
      else drawNode(d.x, d.y, size, color);

      if (d.showLabel && (justSwept || d.flagged)) {
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = d.flagged ? FLAG : ICE_DIM;
        ctx.fillText(d.ip, d.x + 12, d.y + 3);
      }
    });

    rafId = requestAnimationFrame(step);
  }

  function init() {
    resize();
    buildDevices();
    if (rafId) cancelAnimationFrame(rafId);
    if (!reduceMotion) {
      step();
    } else {
      ctx.clearRect(0, 0, width, height);
      devices.forEach(d => {
        const color = d.flagged ? FLAG : ICE_DIM;
        if (d.type === 'shield') drawShield(d.x, d.y, 7, color);
        else if (d.type === 'lock') drawLock(d.x, d.y, 7, color);
        else drawNode(d.x, d.y, 7, color);
      });
    }
  }

  let exposureResizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(exposureResizeTimeout);
    exposureResizeTimeout = setTimeout(init, 200);
  });

  init();
})();
