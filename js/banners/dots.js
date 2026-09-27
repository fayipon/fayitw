/* 05 點陣波紋：Canvas 點陣拼字、從中心擴散進場、游標推開、字詞輪替 */
MB.banners.dots = (root, { finePointer }) => {
  const { $, $$ } = MB;
  const canvas = $('.dm-canvas', root);
  const ctx = canvas.getContext('2d');
  const WORDS = ['MOVE', 'PLAY', 'FAYI'];
  const COLOR = { off: '#262626', on: '#FFC21A', hot: '#FF4A1C' };
  const LEVELS = 5;
  const state = { reveal: 0 };
  const pointer = { x: 0, y: 0, active: false };

  let W = 0;
  let H = 0;
  let gap = 12;
  let cols = 0;
  let rows = 0;
  let maxDist = 1;
  let dots = [];
  let wordIndex = 0;
  let time = 0;
  let last = 0;
  let running = false;

  // 把單字畫在「一格一像素」的小畫布上，取樣出哪些點要亮
  function sample(word) {
    if (!cols || !rows) return () => 0;
    const off = document.createElement('canvas');
    off.width = cols;
    off.height = rows;
    const o = off.getContext('2d', { willReadFrequently: true });
    const areaH = rows * 0.58;
    let size = areaH * 0.9;
    o.font = `900 ${size}px Archivo, sans-serif`;
    const w = o.measureText(word).width;
    if (w > cols * 0.86) size *= (cols * 0.86) / w;
    o.font = `900 ${size}px Archivo, sans-serif`;
    o.textAlign = 'center';
    o.textBaseline = 'alphabetic';
    o.fillText(word, cols / 2, areaH / 2 + size * 0.36);
    const data = o.getImageData(0, 0, cols, rows).data;
    return i => (data[i * 4 + 3] > 100 ? 1 : 0);
  }

  function build() {
    const r = root.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = r.width;
    H = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    gap = W < 640 ? 7 : 12;
    cols = Math.floor(W / gap);
    rows = Math.floor(H / gap);
    const ox = (W - (cols - 1) * gap) / 2;
    const oy = (H - (rows - 1) * gap) / 2;
    const cx = W / 2;
    const cy = H * 0.29;
    const lit = sample(WORDS[wordIndex]);

    dots = [];
    maxDist = 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = ox + col * gap;
        const y = oy + row * gap;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > maxDist) maxDist = dist;
        const on = lit(row * cols + col);
        dots.push({ x, y, dist, on, target: on, delay: 0 });
      }
    }
    draw();
  }

  function nextWord() {
    wordIndex = (wordIndex + 1) % WORDS.length;
    const lit = sample(WORDS[wordIndex]);
    dots.forEach((d, i) => {
      const target = lit(i);
      if (target === d.target) return;
      d.target = target;
      d.delay = Math.random() * 0.6;
    });
  }

  function update(dt) {
    time += dt;
    for (const d of dots) {
      if (d.on === d.target) continue;
      if (d.delay > 0) { d.delay -= dt; continue; }
      const diff = d.target - d.on;
      d.on += Math.sign(diff) * Math.min(Math.abs(diff), dt * 6);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (!dots.length) return;
    const base = gap * 0.34;
    const band = maxDist * 0.2;
    const front = state.reveal * (maxDist + band);
    const radius = gap * 9;
    // 同顏色的點合併成一條 path 一次填色，幾千個點也跑得動
    const off = new Path2D();
    const hot = new Path2D();
    const on = Array.from({ length: LEVELS }, () => new Path2D());

    for (const d of dots) {
      const appear = Math.min(1, (front - d.dist) / band);
      if (appear <= 0) continue;
      let x = d.x;
      let y = d.y;
      let push = 0;
      if (pointer.active) {
        const dx = d.x - pointer.x;
        const dy = d.y - pointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius && dist > 0.001) {
          push = 1 - dist / radius;
          x += (dx / dist) * push * gap * 1.4;
          y += (dy / dist) * push * gap * 1.4;
        }
      }
      const wave = 0.5 + 0.5 * Math.sin(time * 2.4 - d.dist * 0.02);
      let path;
      let r;
      if (d.on > 0.02) {
        const level = d.on * (0.55 + 0.45 * wave);
        path = push > 0.5 ? hot : on[Math.min(LEVELS - 1, Math.floor(level * LEVELS))];
        r = base * (0.6 + 0.4 * d.on) * (0.85 + 0.3 * wave);
      } else {
        path = off;
        r = base * 0.55;
      }
      r *= appear * (1 + push * 0.9);
      path.moveTo(x + r, y);
      path.arc(x, y, r, 0, Math.PI * 2);
    }

    ctx.fillStyle = COLOR.off;
    ctx.fill(off);
    ctx.fillStyle = COLOR.on;
    on.forEach((p, i) => {
      ctx.globalAlpha = (i + 1) / LEVELS;
      ctx.fill(p);
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLOR.hot;
    ctx.fill(hot);
  }

  function tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
  }

  const cycle = gsap.timeline({ repeat: -1, paused: true }).to({}, { duration: 3.2 }).call(nextWord);

  const intro = gsap.timeline({ paused: true })
    .fromTo(state, { reveal: 0 }, { reveal: 1, duration: 1.8, ease: 'power2.out', onUpdate: draw })
    .from($$('.dm-copy > *', root), { y: 24, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 }, 0.5);

  if (finePointer) {
    root.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
    });
    root.addEventListener('pointerleave', () => { pointer.active = false; });
  }

  build();
  let frame = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(build);
  }).observe(root);
  // 取樣要用到 Archivo，字型載入後重建一次
  if (document.fonts) document.fonts.load('900 40px Archivo').then(build);

  return {
    intro,
    play: () => {
      if (running) return;
      running = true;
      last = performance.now();
      gsap.ticker.add(tick);
      cycle.play();
    },
    pause: () => {
      running = false;
      gsap.ticker.remove(tick);
      cycle.pause();
    },
    reset: () => {
      wordIndex = 0;
      time = 0;
      build();
    },
  };
};
