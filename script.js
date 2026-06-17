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
