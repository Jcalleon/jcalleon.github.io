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
  const labelsContainer = document.getElementById('exposure-labels');
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
      // thin out labels that would collide, and clip-suppress near right edge
      const labeled = [];
      devices.forEach(d => {
        if (!d.showLabel) return;
        if (d.x > width - 90) { d.showLabel = false; return; }
        const tooClose = labeled.some(o => Math.abs(o.x - d.x) < 100 && Math.abs(o.y - d.y) < 16);
        if (tooClose) d.showLabel = false; else labeled.push(d);
      });
      createLabelElements();
      return;
    }

    const count = 30;
    const topBand = 170; // hard cap, well above where cred cards begin
    const minY = 15; // keep clear of the very top edge / sticky nav seam
    const headingZone = { top: 45, bottom: 155, left: 0, right: Math.min(width, 680) };
    let attempts = 0;
    while (devices.length < count && attempts < count * 6) {
      attempts++;
      const x = Math.random() * width;
      const y = minY + Math.random() * (topBand - minY);
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
    // device (labels render to the right of the icon, ~90px wide), and
    // suppress labels that would clip past the right edge of the canvas
    const labeled = [];
    devices.forEach(d => {
      if (!d.showLabel) return;
      if (d.x > width - 100) {
        d.showLabel = false;
        return;
      }
      const tooClose = labeled.some(o => Math.abs(o.x - d.x) < 130 && Math.abs(o.y - d.y) < 18);
      if (tooClose) {
        d.showLabel = false;
      } else {
        labeled.push(d);
      }
    });
    createLabelElements();
  }

  function createLabelElements() {
    if (!labelsContainer) return;
    labelsContainer.innerHTML = '';
    devices.forEach(d => {
      if (!d.showLabel) {
        d.labelEl = null;
        return;
      }
      const el = document.createElement('span');
      el.className = 'exposure-label' + (d.flagged ? ' flagged' : '');
      el.textContent = d.ip;
      el.style.display = 'none';
      labelsContainer.appendChild(el);
      d.labelEl = el;
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

      if (d.showLabel && (justSwept || d.flagged) && d.labelEl) {
        d.labelEl.style.display = 'block';
        d.labelEl.style.left = (d.x + 12) + 'px';
        d.labelEl.style.top = d.y + 'px';
      } else if (d.labelEl) {
        d.labelEl.style.display = 'none';
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

// ===========================================================================
// CIRCUIT TRACE ANIMATION — orthogonal PCB-style traces converging into the
// competencies grid, with pulses traveling along them. Lives in the header
// area above the cards (the cards themselves are opaque).
// ===========================================================================
(function () {
  const canvas = document.getElementById('circuit-canvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let traces = [];
  let pulses = [];
  let rafId = null;

  const LINE = 'rgba(91, 143, 176, 0.35)';
  const LINE_DIM = 'rgba(91, 143, 176, 0.18)';
  const PULSE = 'rgba(240, 169, 60, 0.95)';
  const PULSE_GLOW = 'rgba(240, 169, 60, 0.4)';
  const NODE = 'rgba(140, 185, 218, 0.6)';

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

  function buildTraces() {
    // Measure the actual gap between section-head text and comp-grid live,
    // rather than guessing fixed pixel values that break at different
    // text-wrap widths.
    const sectionEl = canvas.parentElement;
    const headEl = sectionEl.querySelector('.section-head');
    const gridEl = sectionEl.querySelector('.comp-grid');
    const sectionTop = sectionEl.getBoundingClientRect().top;
    const headBottom = headEl ? headEl.getBoundingClientRect().bottom - sectionTop : 200;
    const gridTop = gridEl ? gridEl.getBoundingClientRect().top - sectionTop : 260;

    const topY = headBottom + 6;
    const bandHeight = Math.max(20, gridTop - topY - 6);
    const isMobile = width < 640;
    traces = [];

    const laneCount = isMobile ? 4 : 6;
    for (let i = 0; i < laneCount; i++) {
      const startX = (width / (laneCount + 1)) * (i + 1) + (Math.random() - 0.5) * 30;
      const midY = topY + bandHeight * (0.4 + Math.random() * 0.2);
      const endX = startX + (Math.random() - 0.5) * 60;
      const endY = topY + bandHeight;
      // orthogonal path: down, then horizontal jog, then down again
      const points = [
        { x: startX, y: topY },
        { x: startX, y: midY },
        { x: endX, y: midY },
        { x: endX, y: endY }
      ];
      traces.push({ points, hasNode: Math.random() < 0.6 });
    }

    pulses = traces.map((trace, i) => ({
      traceIndex: i,
      t: Math.random(),
      speed: 0.0025 + Math.random() * 0.0025,
      active: Math.random() < 0.7
    }));
  }

  function pathLength(points) {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return len;
  }

  function pointAtT(points, t) {
    const total = pathLength(points);
    let dist = t * total;
    for (let i = 1; i < points.length; i++) {
      const segLen = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      if (dist <= segLen) {
        const segT = segLen === 0 ? 0 : dist / segLen;
        return {
          x: points[i - 1].x + (points[i].x - points[i - 1].x) * segT,
          y: points[i - 1].y + (points[i].y - points[i - 1].y) * segT
        };
      }
      dist -= segLen;
    }
    return points[points.length - 1];
  }

  function drawTracePath(points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    traces.forEach((trace, i) => {
      ctx.strokeStyle = LINE_DIM;
      ctx.lineWidth = 1;
      drawTracePath(trace.points);

      // corner nodes (small connection dots at bends)
      if (trace.hasNode) {
        const corner = trace.points[2];
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = NODE;
        ctx.fill();
      }

      // endpoint dot (where trace meets the grid)
      const end = trace.points[trace.points.length - 1];
      ctx.beginPath();
      ctx.arc(end.x, end.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = LINE;
      ctx.fill();
    });

    pulses.forEach(p => {
      if (!p.active) return;
      if (!reduceMotion) p.t += p.speed;
      if (p.t > 1) {
        p.t = 0;
        p.active = Math.random() < 0.7;
      }
      const trace = traces[p.traceIndex];
      const pos = pointAtT(trace.points, p.t);

      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 7);
      grad.addColorStop(0, PULSE_GLOW);
      grad.addColorStop(1, 'rgba(240, 169, 60, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = PULSE;
      ctx.fill();
    });

    rafId = requestAnimationFrame(step);
  }

  function init() {
    resize();
    buildTraces();
    if (rafId) cancelAnimationFrame(rafId);
    if (!reduceMotion) {
      step();
    } else {
      ctx.clearRect(0, 0, width, height);
      traces.forEach(trace => {
        ctx.strokeStyle = LINE_DIM;
        ctx.lineWidth = 1;
        drawTracePath(trace.points);
      });
    }
  }

  let circuitResizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(circuitResizeTimeout);
    circuitResizeTimeout = setTimeout(init, 200);
  });

  init();
})();

// ===========================================================================
// BUILD PIPELINE ANIMATION — small blocks moving through CI/CD stages
// (build -> test -> deploy), flashing on completion. Lives in the gap
// between the section subtitle and the lab-grid cards. Text labels are
// real HTML (not canvas fillText) to stay clear of fingerprinting blocks.
// ===========================================================================
(function () {
  const canvas = document.getElementById('pipeline-canvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let stages = [];
  let blocks = [];
  let rafId = null;
  let bandTop = 0, bandHeight = 60;

  const LINE = 'rgba(91, 143, 176, 0.35)';
  const STAGE_FILL = 'rgba(28, 35, 48, 0.9)';
  const STAGE_STROKE = 'rgba(91, 143, 176, 0.4)';
  const BLOCK = 'rgba(140, 185, 218, 0.9)';
  const BLOCK_DONE = 'rgba(63, 182, 140, 0.95)';
  const BLOCK_GLOW = 'rgba(63, 182, 140, 0.4)';

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

  function measureBand() {
    const sectionEl = canvas.parentElement;
    const headEl = sectionEl.querySelector('.section-head');
    const gridEl = sectionEl.querySelector('.lab-grid');
    const sectionTop = sectionEl.getBoundingClientRect().top;
    const headBottom = headEl ? headEl.getBoundingClientRect().bottom - sectionTop : 200;
    const gridTop = gridEl ? gridEl.getBoundingClientRect().top - sectionTop : 280;
    const margin = 10;
    bandTop = headBottom + margin;
    // Never let the band exceed the actual available gap, even if that
    // means a thinner-than-ideal strip.
    bandHeight = Math.max(16, gridTop - bandTop - margin);
  }

  function buildStages() {
    measureBand();
    const isMobile = width < 640;
    const labels = isMobile ? ['build', 'test', 'ship'] : ['build', 'test', 'scan', 'deploy'];
    const margin = isMobile ? 24 : 60;
    const usable = width - margin * 2;
    const stageW = usable / labels.length;
    stages = labels.map((label, i) => ({
      label,
      x: margin + stageW * i,
      width: stageW,
      y: bandTop,
      height: bandHeight
    }));

    blocks = [];
    const blockCount = isMobile ? 3 : 5;
    for (let i = 0; i < blockCount; i++) {
      blocks.push({
        progress: Math.random(),
        speed: 0.0009 + Math.random() * 0.0007,
        lane: Math.random() * 0.6 + 0.2
      });
    }
  }

  function drawStageBox(stage) {
    ctx.fillStyle = STAGE_FILL;
    ctx.strokeStyle = STAGE_STROKE;
    ctx.lineWidth = 0.5;
    const pad = 6;
    const x = stage.x + pad;
    const w = stage.width - pad * 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, stage.y, w, stage.height, 6) : ctx.rect(x, stage.y, w, stage.height);
    ctx.fill();
    ctx.stroke();
  }

  let stageLabelEls = [];

  function step() {
    ctx.clearRect(0, 0, width, height);

    // connecting line through stage centers
    ctx.beginPath();
    ctx.moveTo(stages[0].x + 6, bandTop + bandHeight / 2);
    ctx.lineTo(stages[stages.length - 1].x + stages[stages.length - 1].width - 6, bandTop + bandHeight / 2);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.stroke();

    stages.forEach(drawStageBox);

    blocks.forEach(b => {
      if (!reduceMotion) b.progress += b.speed;
      if (b.progress > 1.08) {
        b.progress = -0.08;
        b.lane = Math.random() * 0.6 + 0.2;
      }
      const totalX = stages[0].x + 6 + (b.progress) * (stages[stages.length - 1].x + stages[stages.length - 1].width - 6 - (stages[0].x + 6));
      const y = bandTop + bandHeight * b.lane;
      const inFinalStage = b.progress > (stages.length - 1) / stages.length;
      const color = inFinalStage ? BLOCK_DONE : BLOCK;

      if (inFinalStage) {
        const grad = ctx.createRadialGradient(totalX, y, 0, totalX, y, 9);
        grad.addColorStop(0, BLOCK_GLOW);
        grad.addColorStop(1, 'rgba(63, 182, 140, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(totalX, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(totalX, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    rafId = requestAnimationFrame(step);
  }

  function createStageLabels() {
    let container = document.getElementById('pipeline-labels');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pipeline-labels';
      container.className = 'pipeline-labels';
      canvas.parentElement.insertBefore(container, canvas.nextSibling);
    }
    container.innerHTML = '';
    stageLabelEls = stages.map(stage => {
      const el = document.createElement('span');
      el.className = 'pipeline-label';
      el.textContent = stage.label;
      container.appendChild(el);
      return el;
    });
  }

  function positionStageLabels() {
    stages.forEach((stage, i) => {
      const el = stageLabelEls[i];
      if (!el) return;
      el.style.left = (stage.x + stage.width / 2) + 'px';
      el.style.top = (stage.y - 14) + 'px';
    });
  }

  function init() {
    resize();
    buildStages();
    createStageLabels();
    positionStageLabels();
    if (rafId) cancelAnimationFrame(rafId);
    if (!reduceMotion) {
      step();
    } else {
      ctx.clearRect(0, 0, width, height);
      stages.forEach(drawStageBox);
    }
  }

  let pipelineResizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(pipelineResizeTimeout);
    pipelineResizeTimeout = setTimeout(init, 200);
  });

  init();
})();

// ===========================================================================
// EXPERIENCE STICKY SCROLL — pinned SVG scene panel that swaps "scenes"
// (SOC wall, hooded solo operator, lock, network hub, headset) as the
// matching case-file scrolls through the active zone. Driven by
// IntersectionObserver, not scroll-jacking: native scroll, just watched.
// ===========================================================================
(function () {
  const scroller = document.getElementById('exp-scroller');
  if (!scroller) return;

  const cases = Array.from(scroller.querySelectorAll('.exp-case'));
  const sceneGroups = Array.from(scroller.querySelectorAll('.exp-scene-group'));
  const orgEl = document.getElementById('exp-stage-org');
  const rangeEl = document.getElementById('exp-stage-range');
  if (!cases.length || !sceneGroups.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeCase = cases[0];

  function setActive(caseEl) {
    if (caseEl === activeCase) return;
    activeCase = caseEl;

    cases.forEach(c => c.classList.toggle('is-active', c === caseEl));

    const scene = caseEl.dataset.scene;
    sceneGroups.forEach(g => g.classList.toggle('is-live', g.dataset.scene === scene));

    if (orgEl)   orgEl.textContent = caseEl.dataset.org || '';
    if (rangeEl) rangeEl.textContent = caseEl.dataset.range || '';
  }

  // Initialize first scene as live immediately (no fade-in wait on load)
  sceneGroups.forEach(g => g.classList.toggle('is-live', g.dataset.scene === cases[0].dataset.scene));
  if (orgEl)   orgEl.textContent = cases[0].dataset.org || '';
  if (rangeEl) rangeEl.textContent = cases[0].dataset.range || '';

  if (reduceMotion) {
    // Without smooth animation preference, just snap straight through —
    // still functionally correct, no IntersectionObserver needed for tiny win.
  }

  const observer = new IntersectionObserver((entries) => {
    // Pick whichever intersecting entry is closest to vertical center of viewport
    let best = null;
    let bestDist = Infinity;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const rect = entry.target.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const viewportCenter = window.innerHeight / 2;
      const dist = Math.abs(center - viewportCenter);
      if (dist < bestDist) {
        bestDist = dist;
        best = entry.target;
      }
    });
    if (best) setActive(best);
  }, {
    root: null,
    rootMargin: '-20% 0px -20% 0px',
    threshold: [0, 0.1, 0.25, 0.5, 0.75, 1]
  });

  cases.forEach(c => observer.observe(c));
})();

// ===========================================================================
// PING ANIMATION — expanding rings from the contact heading, like a network
// ping or completed handshake. Quiet closing beat, no text needed.
// ===========================================================================
(function () {
  const canvas = document.getElementById('ping-canvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let pings = [];
  let rafId = null;
  let spawnTimer = 0;
  let centerY = 0;

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

    const sectionEl = canvas.parentElement;
    const heading = sectionEl.querySelector('h2');
    if (heading) {
      const sectionTop = sectionEl.getBoundingClientRect().top;
      const hRect = heading.getBoundingClientRect();
      centerY = (hRect.top + hRect.bottom) / 2 - sectionTop;
    } else {
      centerY = height * 0.25;
    }
  }

  function spawnPing() {
    pings.push({ r: 4, opacity: 0.55 });
  }

  function step() {
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;

    if (!reduceMotion) {
      spawnTimer++;
      if (spawnTimer > 130) {
        spawnTimer = 0;
        spawnPing();
      }
    }

    pings.forEach(p => {
      if (!reduceMotion) {
        p.r += 0.9;
        p.opacity *= 0.985;
      }
      ctx.beginPath();
      ctx.arc(cx, centerY, p.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(91, 143, 176, ${p.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    pings = pings.filter(p => p.opacity > 0.02 && p.r < Math.max(width, height));

    rafId = requestAnimationFrame(step);
  }

  function init() {
    resize();
    pings = [{ r: 4, opacity: 0.55 }];
    spawnTimer = 0;
    if (rafId) cancelAnimationFrame(rafId);
    if (!reduceMotion) {
      step();
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  }

  let pingResizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(pingResizeTimeout);
    pingResizeTimeout = setTimeout(init, 200);
  });

  init();
})();

// ===========================================================================
// WAVEFORM ANIMATION — thin animated signal line in the gap between the
// "About" heading and the photo/video + bio grid. Suggests "signal" /
// monitoring without competing with the placeholders or dense bio text.
// ===========================================================================
(function () {
  const canvas = document.getElementById('waveform-canvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let rafId = null;
  let phase = 0;
  let bandTop = 0, bandHeight = 40;

  const LINE = 'rgba(91, 143, 176, 0.45)';
  const LINE_DIM = 'rgba(91, 143, 176, 0.18)';

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

  function measureBand() {
    const sectionEl = canvas.parentElement;
    const headEl = sectionEl.querySelector('.section-head');
    const gridEl = sectionEl.querySelector('.about-grid');
    const sectionTop = sectionEl.getBoundingClientRect().top;
    const headBottom = headEl ? headEl.getBoundingClientRect().bottom - sectionTop : 80;
    const gridTop = gridEl ? gridEl.getBoundingClientRect().top - sectionTop : 140;
    const margin = 10;
    bandTop = headBottom + margin;
    bandHeight = Math.max(16, gridTop - bandTop - margin);
  }

  function drawWave(yOffset, amplitude, color, lineWidth, freq, phaseShift) {
    const midY = bandTop + bandHeight / 2 + yOffset;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const y = midY + Math.sin((x * freq) + phase + phaseShift) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    const amp = Math.min(bandHeight * 0.32, 10);
    drawWave(0, amp, LINE_DIM, 1, 0.012, 0);
    drawWave(0, amp * 0.7, LINE, 1.2, 0.012, Math.PI / 3);

    if (!reduceMotion) phase += 0.025;

    rafId = requestAnimationFrame(step);
  }

  function init() {
    resize();
    measureBand();
    if (rafId) cancelAnimationFrame(rafId);
    if (!reduceMotion) {
      step();
    } else {
      ctx.clearRect(0, 0, width, height);
      const amp = Math.min(bandHeight * 0.32, 10);
      drawWave(0, amp, LINE_DIM, 1, 0.012, 0);
    }
  }

  let waveformResizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(waveformResizeTimeout);
    waveformResizeTimeout = setTimeout(init, 200);
  });

  init();
})();
