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
// EXPERIENCE STICKY SCROLL — two glowing security "nodes" rendered on canvas.
// They drift gently with the cursor (parallax, like Helion's plasma orbs),
// and pull together into a single merged node as the visitor scrolls through
// the case-file list. Each node displays an icon — terminal, hooded operator,
// lock, IP/network, shield — that swaps to match whichever job is centered
// in the viewport, with a faint matrix-style falling character rain inside
// the terminal-type icons. No scroll-jacking: native scroll, just observed.
// ===========================================================================
(function () {
  const scroller   = document.getElementById('exp-scroller');
  const stageInner = document.getElementById('exp-stage-inner');
  const canvas     = document.getElementById('exp-canvas');
  if (!scroller || !stageInner || !canvas) return;

  const cases  = Array.from(scroller.querySelectorAll('.exp-case'));
  const orgEl  = document.getElementById('exp-stage-org');
  const rangeEl= document.getElementById('exp-stage-range');
  if (!cases.length) return;

  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLOR_STEEL  = '91, 143, 176';
  const COLOR_GREEN  = '63, 182, 140';
  const COLOR_AMBER  = '240, 169, 60';
  const COLOR_TEXT   = '230, 232, 235';

  let width = 0, height = 0, dpr = 1;
  let cx = 0, cy = 0;            // stage center
  let mouseX = 0, mouseY = 0;    // pointer position relative to stage, -1..1
  let targetMouseX = 0, targetMouseY = 0;
  let mergeProgress = 0;         // 0 = apart, 1 = fully merged
  let targetMerge = 0;
  let activeCase = cases[0];
  let rafId = null;
  let matrixCols = [];
  let t = 0; // animation clock

  const ICONS = ['terminal', 'hacker', 'lock', 'ip', 'shield'];

  function resize() {
    const rect = stageInner.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = width / 2;
    cy = height / 2;
    buildMatrixCols();
  }

  function buildMatrixCols() {
    const colWidth = 11;
    const count = Math.max(4, Math.floor((width * 0.42) / colWidth));
    matrixCols = [];
    for (let i = 0; i < count; i++) {
      matrixCols.push({
        x: i * colWidth,
        y: Math.random() * -200,
        speed: 0.6 + Math.random() * 1.2,
        len: 4 + Math.floor(Math.random() * 6)
      });
    }
  }

  const MATRIX_CHARS = '01アイウエオカキクケコサシスセソ$#@&%';
  function randChar() {
    return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
  }

  // -------------------------------------------------------------------
  // Pointer tracking — relative position within the stage, normalized
  // -------------------------------------------------------------------
  function onPointerMove(e) {
    const rect = stageInner.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    targetMouseX = Math.max(-1, Math.min(1, (x - cx) / cx));
    targetMouseY = Math.max(-1, Math.min(1, (y - cy) / cy));
  }
  function onPointerLeave() {
    targetMouseX = 0;
    targetMouseY = 0;
  }
  stageInner.addEventListener('mousemove', onPointerMove);
  stageInner.addEventListener('mouseleave', onPointerLeave);

  // -------------------------------------------------------------------
  // Scroll tracking — merge progress derives from how far the visitor
  // has scrolled through the .exp-scroller relative to viewport
  // -------------------------------------------------------------------
  function updateMergeFromScroll() {
    const rect = scroller.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) { targetMerge = 0; return; }
    const scrolled = Math.min(Math.max(-rect.top, 0), total);
    targetMerge = Math.min(1, scrolled / total);
  }

  // -------------------------------------------------------------------
  // Active case tracking (drives which icon pair shows + readout text)
  // -------------------------------------------------------------------
  function setActive(caseEl) {
    if (caseEl === activeCase) return;
    activeCase = caseEl;
    cases.forEach(c => c.classList.toggle('is-active', c === caseEl));
    if (orgEl)   orgEl.textContent = caseEl.dataset.org || '';
    if (rangeEl) rangeEl.textContent = caseEl.dataset.range || '';
  }

  if (orgEl)   orgEl.textContent = cases[0].dataset.org || '';
  if (rangeEl) rangeEl.textContent = cases[0].dataset.range || '';

  const observer = new IntersectionObserver((entries) => {
    let best = null, bestDist = Infinity;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const rect = entry.target.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(center - window.innerHeight / 2);
      if (dist < bestDist) { bestDist = dist; best = entry.target; }
    });
    if (best) setActive(best);
  }, { root: null, rootMargin: '-20% 0px -20% 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
  cases.forEach(c => observer.observe(c));

  // -------------------------------------------------------------------
  // Icon renderers — drawn in local space centered on (0,0), caller translates
  // -------------------------------------------------------------------
  function drawTerminal(r) {
    const w = r * 1.5, h = r * 1.1;
    ctx.save();
    ctx.fillStyle = '#0D1117';
    ctx.strokeStyle = `rgba(${COLOR_GREEN}, 0.55)`;
    ctx.lineWidth = 1.5;
    roundRect(-w / 2, -h / 2, w, h, 5);
    ctx.fill(); ctx.stroke();

    // matrix rain clipped to screen
    ctx.save();
    roundRectPath(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 3);
    ctx.clip();
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    for (const col of matrixCols) {
      const localX = -w / 2 + 3 + (col.x % (w - 6));
      for (let i = 0; i < col.len; i++) {
        const yy = -h / 2 + ((col.y + i * 9) % (h + 20)) - 10;
        const fade = i === 0 ? 1 : 0.45 - i * 0.07;
        if (fade <= 0) continue;
        ctx.fillStyle = `rgba(${COLOR_GREEN}, ${Math.max(0, fade)})`;
        ctx.fillText(randChar(), localX, yy);
      }
    }
    ctx.restore();
    ctx.restore();
  }

  function drawHacker(r) {
    ctx.save();
    // hood
    ctx.fillStyle = '#161B22';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.5, -r * 0.42, r * 0.05);
    ctx.quadraticCurveTo(-r * 0.55, r * 0.35, -r * 0.62, r * 0.62);
    ctx.lineTo(r * 0.62, r * 0.62);
    ctx.quadraticCurveTo(r * 0.55, r * 0.35, r * 0.42, r * 0.05);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.5, 0, -r * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // face void
    ctx.fillStyle = '#05070a';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.05, r * 0.26, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    // terminal glow reflecting on face
    const glowPulse = 0.35 + Math.sin(t * 0.0022) * 0.18;
    ctx.fillStyle = `rgba(${COLOR_GREEN}, ${glowPulse})`;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.05, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLock(r) {
    ctx.save();
    const shackleLift = Math.max(0, Math.sin(t * 0.0014)) * 2;
    ctx.strokeStyle = `rgba(${COLOR_STEEL}, 0.85)`;
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -r * 0.18 - shackleLift, r * 0.34, Math.PI, 0);
    ctx.stroke();

    ctx.fillStyle = '#161B22';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    roundRect(-r * 0.46, -r * 0.1, r * 0.92, r * 0.62, r * 0.1);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = `rgba(${COLOR_GREEN}, 0.9)`;
    ctx.beginPath();
    ctx.arc(0, r * 0.16, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-r * 0.03, r * 0.16, r * 0.06, r * 0.16);
    ctx.restore();
  }

  function drawIP(r) {
    ctx.save();
    ctx.font = `${r * 0.24}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // hub node
    ctx.fillStyle = '#161B22';
    ctx.strokeStyle = `rgba(${COLOR_STEEL}, 0.8)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // spokes
    const spokes = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < spokes; i++) {
      const ang = (Math.PI * 2 * i) / spokes + Math.PI / 4;
      const ex = Math.cos(ang) * r * 0.55;
      const ey = Math.sin(ang) * r * 0.55;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = '#161B22';
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    }

    // blocked IP tag
    ctx.fillStyle = `rgba(${COLOR_TEXT}, 0.55)`;
    ctx.fillText('10.0.4.18', 0, r * 0.82);
    ctx.restore();
  }

  function drawShield(r) {
    ctx.save();
    ctx.fillStyle = '#161B22';
    ctx.strokeStyle = `rgba(${COLOR_STEEL}, 0.8)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.42, r * 0.5, -r * 0.05);
    ctx.quadraticCurveTo(r * 0.5, r * 0.42, 0, r * 0.62);
    ctx.quadraticCurveTo(-r * 0.5, r * 0.42, -r * 0.5, -r * 0.05);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.42, 0, -r * 0.6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    const pulse = 0.7 + Math.sin(t * 0.003) * 0.3;
    ctx.strokeStyle = `rgba(${COLOR_GREEN}, ${pulse})`;
    ctx.lineWidth = r * 0.1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, 0);
    ctx.lineTo(-r * 0.05, r * 0.18);
    ctx.lineTo(r * 0.26, -r * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  const ICON_DRAW = { terminal: drawTerminal, hacker: drawHacker, lock: drawLock, ip: drawIP, shield: drawShield };

  function roundRectPath(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
  function roundRect(x, y, w, h, rad) { roundRectPath(x, y, w, h, rad); }

  // -------------------------------------------------------------------
  // Node glow + icon composite
  // -------------------------------------------------------------------
  function drawNode(x, y, r, iconType, glowAlpha) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 1.9);
    grad.addColorStop(0, `rgba(${COLOR_STEEL}, ${0.55 * glowAlpha})`);
    grad.addColorStop(0.5, `rgba(${COLOR_STEEL}, ${0.22 * glowAlpha})`);
    grad.addColorStop(1, `rgba(${COLOR_STEEL}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // base disc
    ctx.fillStyle = 'rgba(22, 27, 34, 0.9)';
    ctx.strokeStyle = `rgba(${COLOR_STEEL}, ${0.5 * glowAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // rotating dashed ring
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((t * 0.00015) % (Math.PI * 2));
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // icon
    ctx.save();
    ctx.translate(x, y);
    const draw = ICON_DRAW[iconType] || drawTerminal;
    draw(r * 0.78);
    ctx.restore();
  }

  // -------------------------------------------------------------------
  // Merge bridge — cheap metaball approximation between two equal circles:
  // draw a stretched lens shape that grows as the circles approach,
  // capped/clipped by the circle radius so it never overshoots.
  // -------------------------------------------------------------------
  function drawBridge(x1, y, x2, r, alpha) {
    if (alpha <= 0) return;
    const midX = (x1 + x2) / 2;
    const halfGap = Math.abs(x2 - x1) / 2;
    const bridgeW = Math.max(0, r - halfGap * 0.55);
    if (bridgeW <= 0) return;
    const bridgeH = r * 0.62 * alpha;

    const grad = ctx.createLinearGradient(midX - bridgeW, y, midX + bridgeW, y);
    grad.addColorStop(0, `rgba(${COLOR_STEEL}, 0)`);
    grad.addColorStop(0.5, `rgba(${COLOR_STEEL}, ${0.85 * alpha})`);
    grad.addColorStop(1, `rgba(${COLOR_STEEL}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(midX, y, bridgeW, bridgeH, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // -------------------------------------------------------------------
  // Main render loop
  // -------------------------------------------------------------------
  function frame(dt) {
    t += dt;

    // ease pointer + merge toward targets
    const ease = reduceMotion ? 1 : 0.06;
    mouseX += (targetMouseX - mouseX) * ease;
    mouseY += (targetMouseY - mouseY) * ease;
    mergeProgress += (targetMerge - mergeProgress) * (reduceMotion ? 1 : 0.08);

    // matrix rain advance
    if (!reduceMotion) {
      for (const col of matrixCols) {
        col.y += col.speed;
        if (col.y > height + 40) col.y = Math.random() * -100;
      }
    }

    ctx.clearRect(0, 0, width, height);

    const baseR = Math.min(width, height) * 0.155;
    const idleFloat = reduceMotion ? 0 : Math.sin(t * 0.0009) * 6;
    const idleFloat2 = reduceMotion ? 0 : Math.cos(t * 0.0011) * 6;

    // base separated positions (left/right of center, slightly different heights)
    const sep = (1 - mergeProgress) * (width * 0.22);
    const parallaxStrength = 18;

    const x1 = cx - sep + mouseX * parallaxStrength + idleFloat * 0.4;
    const y1 = cy - height * 0.05 + mouseY * parallaxStrength * 0.6 + idleFloat;
    const x2 = cx + sep + mouseX * parallaxStrength * 0.7 + idleFloat2 * 0.4;
    const y2 = cy + height * 0.06 + mouseY * parallaxStrength * 0.6 + idleFloat2;

    // icon for node 1 = active case scene; node 2 = next case in list (preview)
    const activeIdx = cases.indexOf(activeCase);
    const icon1 = activeCase.dataset.scene || 'terminal';
    const nextCase = cases[(activeIdx + 1) % cases.length];
    const icon2 = mergeProgress > 0.9 ? icon1 : (nextCase.dataset.scene || 'shield');

    // bridge first (sits behind nodes)
    drawBridge(x1, (y1 + y2) / 2, x2, baseR, Math.max(0, (mergeProgress - 0.55) / 0.45));

    const fadeOutSecond = Math.max(0, 1 - Math.max(0, (mergeProgress - 0.75) / 0.25));
    drawNode(x1, y1, baseR, icon1, 1);
    if (fadeOutSecond > 0.02) drawNode(x2, y2, baseR * (0.85 + 0.15 * fadeOutSecond), icon2, fadeOutSecond);

    if (!reduceMotion) {
      rafId = requestAnimationFrame(step);
    }
  }

  let lastTime = performance.now();
  function step(now) {
    const dt = Math.min(48, now - lastTime);
    lastTime = now;
    updateMergeFromScroll();
    frame(dt);
  }

  function init() {
    resize();
    lastTime = performance.now();
    updateMergeFromScroll();
    if (reduceMotion) {
      frame(16);
    } else {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(step);
    }
  }

  let expResizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(expResizeTimeout);
    expResizeTimeout = setTimeout(init, 200);
  });
  window.addEventListener('scroll', () => {
    if (reduceMotion) { updateMergeFromScroll(); frame(16); }
  }, { passive: true });

  init();
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
