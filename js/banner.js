/* =========================================================
   MotionBanner：圖片主視覺輪播 + 動態層
   一張平面主視覺圖，依設定座標疊上光束、閃光、粒子與場景特效，
   再加上鏡頭推移、滑鼠視差、文字進場和五種轉場。
   用法：new MotionBanner(元素, MB_SLIDES, settings)
   ========================================================= */
(() => {
  const SCENE_W = 960;
  const DURATION = 6; // 每張停留秒數

  function el(tag, cls, attrs) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (attrs) Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  function place(node, { x, y }) {
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
  }

  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M9 6v12M15 6v12"/><path class="i-play" d="M8 5.5v13l10.5-6.5z"/></svg>';

  /* ---------- 粒子（Canvas） ---------- */

  class Particles {
    constructor(canvas, cfg) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cfg = cfg;
      this.list = [];
      this.w = 0;
      this.h = 0;
      this.s = 1;
      this.running = false;
      this.last = 0;
      this.tick = this.tick.bind(this);
      new ResizeObserver(() => this.resize()).observe(canvas);
    }

    resize() {
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const first = !this.w;
      this.w = w;
      this.h = h;
      this.s = w / SCENE_W;
      if (first) this.list = Array.from({ length: Math.round(this.cfg.count * (w < 520 ? 0.6 : 1)) }, () => this.spawn(true));
    }

    spawn(initial) {
      const c = this.cfg;
      const r = gsap.utils.random;
      const s = this.s;
      const color = c.colors[Math.floor(Math.random() * c.colors.length)];
      if (c.mode === 'swirl') {
        const radius = (initial ? r(c.rMin, c.rMax) : c.rMax) * this.w / 100;
        return { color, angle: r(0, Math.PI * 2), radius, speed: r(0.35, 0.8), shrink: r(10, 24) * s, size: r(0.9, 2.4) * s, phase: r(0, 6) };
      }
      const [x0, x1, y0, y1] = c.area;
      const x = r(x0, x1) / 100 * this.w;
      if (c.mode === 'bokeh') {
        return { color, x, y: r(y0, y1) / 100 * this.h, vx: r(-7, 7) * s, vy: r(-14, -4) * s, size: r(7, 22) * s, life: initial ? r(0, 6) : 0, max: r(5, 9), alpha: r(0.1, 0.26) };
      }
      const y = (initial ? r(y0, y1) : y1) / 100 * this.h;
      return { color, x, y, vy: r(-55, -18) * s, sway: r(4, 14) * s, freq: r(0.6, 1.6), phase: r(0, 6), size: r(0.8, 2.4) * s, life: initial ? r(0, 4) : 0, max: r(2.8, 5.5) };
    }

    step(dt) {
      const c = this.cfg;
      const inner = c.rEnd * this.w / 100;
      const outer = c.rMax * this.w / 100;
      this.list.forEach((p, i) => {
        if (c.mode === 'swirl') {
          // 越靠近中心轉得越快，像被吸進去
          p.angle += p.speed * dt * Math.pow(outer / Math.max(p.radius, 1), 0.8);
          p.radius -= p.shrink * dt;
          if (p.radius < inner) this.list[i] = this.spawn(false);
          return;
        }
        p.life += dt;
        p.x += (p.vx || 0) * dt + (p.sway ? Math.cos(p.life * p.freq + p.phase) * p.sway * dt : 0);
        p.y += p.vy * dt;
        if (p.life > p.max) this.list[i] = this.spawn(false);
      });
    }

    clear() {
      this.ctx.clearRect(0, 0, this.w, this.h);
    }

    draw() {
      const { ctx, cfg: c } = this;
      this.clear();
      ctx.globalCompositeOperation = 'lighter';
      const inner = c.rEnd * this.w / 100;
      const outer = c.rMax * this.w / 100;
      this.list.forEach(p => {
        if (c.mode === 'bokeh') {
          const a = p.alpha * Math.sin(Math.PI * Math.min(1, p.life / p.max));
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, p.color);
          g.addColorStop(1, 'transparent');
          ctx.globalAlpha = a;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        let x;
        let y;
        let a;
        if (c.mode === 'swirl') {
          x = c.center[0] / 100 * this.w + Math.cos(p.angle) * p.radius;
          y = c.center[1] / 100 * this.h + Math.sin(p.angle) * p.radius * c.squash;
          const t = (p.radius - inner) / (outer - inner);
          a = Math.min(1, (1 - t) * 5) * Math.min(1, t * 3);
        } else {
          x = p.x;
          y = p.y;
          a = Math.sin(Math.PI * (p.life / p.max)) * (0.65 + 0.35 * Math.sin(p.life * 9 + p.phase));
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    tick() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.w) this.resize();
      this.step(dt);
      this.draw();
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      gsap.ticker.add(this.tick);
    }

    stop() {
      this.running = false;
      gsap.ticker.remove(this.tick);
    }
  }

  /* ---------- 輪播本體 ---------- */

  class MotionBanner {
    constructor(root, slides, settings) {
      this.root = root;
      this.slides = slides;
      this.settings = settings;
      this.index = 0;
      this.busy = null;
      this.timer = null;
      this.kb = null;
      this.paused = false;
      this.hover = false;
      this.focus = false;
      this.visible = true;
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.fine = matchMedia('(pointer: fine)').matches;
      this.build();
      this.bind();
      this.applyLayers();
      this.show(0);
    }

    build() {
      const root = this.root;
      root.classList.add('mb');
      root.setAttribute('role', 'region');
      root.setAttribute('aria-roledescription', 'carousel');
      root.setAttribute('aria-label', '精選活動');
      root.tabIndex = 0;

      this.stage = el('div', 'mb-stage');
      root.append(this.stage);
      this.items = this.slides.map((s, i) => this.buildSlide(s, i));

      this.dots = el('div', 'mb-dots');
      this.dotParts = this.slides.map((s, i) => {
        const button = el('button', '', { type: 'button', 'aria-label': `第 ${i + 1} 張` });
        const bar = el('span');
        const fill = el('i');
        bar.append(fill);
        button.append(bar);
        button.addEventListener('click', () => this.goTo(i));
        this.dots.append(button);
        return { button, fill };
      });

      this.pauseBtn = el('button', 'mb-pause', { type: 'button', 'aria-label': '暫停輪播', 'aria-pressed': 'false' });
      this.pauseBtn.innerHTML = PAUSE;
      root.append(this.dots, this.pauseBtn);
    }

    buildSlide(s, i) {
      const slide = el('article', `mb-slide mb-slide-${s.id}`, {
        'aria-roledescription': 'slide',
        'aria-label': `${i + 1} / ${this.slides.length}`,
      });
      slide.style.setProperty('--accent', s.accent);
      slide.style.setProperty('--glow', s.glow);
      slide.style.setProperty('--glint', s.glintColor);

      const frame = el('div', 'mb-frame');
      const scene = el('div', 'mb-scene');
      const zoom = el('div', 'mb-zoom');
      zoom.style.transformOrigin = `${s.focus.x}% ${s.focus.y}%`;

      const img = el('img', '', { src: s.image, alt: '', draggable: 'false', width: '960', height: '436', decoding: 'async' });
      if (i === 0) img.setAttribute('fetchpriority', 'high');
      zoom.append(img);

      const fx = { glow: null, rays: [], ring: null, screen: null, vortex: null, glints: [], sweep: null };

      // 光暈：主體後方的呼吸光
      fx.glow = el('div', 'fx-light mb-glow');
      place(fx.glow, s.focus);
      zoom.append(fx.glow);

      // 光束：從光源往下灑的幾道光
      if (s.rays) {
        const wrap = el('div', 'fx-light mb-rays');
        place(wrap, s.rays);
        wrap.style.setProperty('--ray', s.rays.color);
        fx.rays = s.rays.angles.map((angle, n) => {
          const ray = el('i');
          ray.style.setProperty('--w', `${n % 2 ? 7 : 11}%`);
          ray.dataset.angle = angle;
          gsap.set(ray, { rotation: angle });
          wrap.append(ray);
          return ray;
        });
        zoom.append(wrap);
      }

      // 場景特效：依主視覺內容而定
      if (s.ring) {
        fx.ring = el('div', 'fx-scene mb-ring');
        place(fx.ring, s.ring);
        fx.ring.style.width = `${s.ring.w}%`;
        fx.ring.style.height = `${s.ring.h}%`;
        zoom.append(fx.ring);
      }
      if (s.screen) {
        const screen = el('div', 'fx-scene mb-screen');
        place(screen, s.screen);
        screen.style.width = `${s.screen.w}%`;
        screen.style.height = `${s.screen.h}%`;
        const flash = el('i', 'mb-screen-flash');
        const bar = el('i', 'mb-screen-bar');
        screen.append(flash, bar);
        fx.screen = { flash, bar };
        zoom.append(screen);
      }
      if (s.vortex) {
        const vortex = el('div', 'fx-scene mb-vortex');
        place(vortex, s.vortex);
        vortex.style.width = `${s.vortex.size}%`;
        const swirl = el('i', 'mb-vortex-swirl');
        const core = el('i', 'mb-vortex-core');
        const ring = el('i', 'mb-vortex-ring');
        vortex.append(swirl, core, ring);
        fx.vortex = { swirl, core, ring };
        zoom.append(vortex);
      }

      // 閃光：寶石、霓虹星、水晶的位置
      const glints = el('div', 'fx-glints mb-glints');
      fx.glints = (s.glints || []).map(([x, y, size]) => {
        const g = el('i');
        place(g, { x, y });
        if (size) g.style.width = `${size}%`;
        glints.append(g);
        return g;
      });
      zoom.append(glints);

      const canvas = el('canvas', 'fx-particles mb-particles');
      zoom.append(canvas);

      // 掃光：定期斜掃過整個畫面
      const sweep = el('div', 'fx-sweep mb-sweep');
      fx.sweep = el('i');
      sweep.append(fx.sweep);
      zoom.append(sweep);

      // 以座標點為中心：用 GSAP 的百分比位移，尺寸改變時才會跟著走
      gsap.set([fx.glow, fx.ring, ...fx.glints].filter(Boolean), { xPercent: -50, yPercent: -50 });
      gsap.set(fx.sweep, { xPercent: -150, rotation: 14 });

      scene.append(zoom);
      frame.append(scene, el('div', 'mb-shade'));

      const copy = el('div', 'mb-copy');
      const label = el('span', 'mb-label');
      label.textContent = s.label;
      const title = el('h2', 'mb-title');
      const lines = s.title.map((text, n) => {
        const line = el('span', 'mb-line');
        const inner = el(n === s.title.length - 1 ? 'em' : 'span');
        inner.textContent = text;
        line.append(inner);
        title.append(line);
        return inner;
      });
      const desc = el('p', 'mb-desc');
      desc.textContent = s.desc;
      const cta = el('a', 'mb-cta', { href: '#' });
      cta.innerHTML = `<span>${s.cta}</span>${ARROW}<i class="mb-cta-shine"></i>`;
      cta.addEventListener('click', e => e.preventDefault());
      gsap.set($('.mb-cta-shine', cta), { xPercent: -160 });
      copy.append(label, title, desc, cta);

      slide.append(frame, copy);
      this.stage.append(slide);

      const item = {
        data: s,
        el: slide,
        frame,
        scene,
        zoom,
        fx,
        copy,
        parts: { label, lines, em: lines[lines.length - 1], desc, cta, shine: $('.mb-cta-shine', cta) },
        particles: new Particles(canvas, s.particles),
      };
      item.loops = this.makeLoops(item);
      return item;
    }

    makeLoops(item) {
      const { fx, parts } = item;
      const r = gsap.utils.random;
      const loops = [];
      const loop = ({ targets, ...vars }) => loops.push(gsap.to(targets, { ...vars, paused: true }));

      loop({ targets: fx.glow, scale: 1.14, opacity: 0.7, duration: 2.6, ease: 'sine.inOut', repeat: -1, yoyo: true });
      fx.rays.forEach(ray => loop({
        targets: ray, rotation: Number(ray.dataset.angle) + r(-4, 4), opacity: r(0.25, 0.75), duration: r(1.8, 3.4), ease: 'sine.inOut', repeat: -1, yoyo: true,
      }));

      if (fx.ring) loop({ targets: fx.ring, scaleX: 1.08, scaleY: 1.3, opacity: 0.55, duration: 1.8, ease: 'sine.inOut', repeat: -1, yoyo: true });
      if (fx.screen) {
        loops.push(gsap.timeline({ repeat: -1, paused: true })
          .to(fx.screen.flash, { opacity: 0.55, duration: 0.06 })
          .to(fx.screen.flash, { opacity: 0.15, duration: 0.14 })
          .to(fx.screen.flash, { opacity: 0.45, duration: 0.05 })
          .to(fx.screen.flash, { opacity: 0.2, duration: 0.5 })
          .to({}, { duration: 1.6 }));
        loops.push(gsap.fromTo(fx.screen.bar, { yPercent: -120 }, { yPercent: 620, duration: 2.4, ease: 'none', repeat: -1, paused: true }));
      }
      if (fx.vortex) {
        loops.push(gsap.to(fx.vortex.swirl, { rotation: -360, duration: 4.5, ease: 'none', repeat: -1, paused: true }));
        loops.push(gsap.to(fx.vortex.core, { scale: 1.25, opacity: 0.7, duration: 1.2, ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true }));
        loops.push(gsap.fromTo(fx.vortex.ring, { scale: 0.5, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 2, ease: 'power1.out', repeat: -1, paused: true }));
      }

      gsap.set(fx.glints, { scale: 0 });
      fx.glints.forEach(g => {
        loops.push(gsap.timeline({ repeat: -1, repeatDelay: r(1.2, 3.4), delay: r(0, 2.4), paused: true })
          .fromTo(g, { scale: 0, rotation: 0 }, { scale: 1, rotation: 45, duration: 0.35, ease: 'power2.out' })
          .to(g, { scale: 0, rotation: 90, duration: 0.5, ease: 'power2.in' }));
      });

      loops.push(gsap.timeline({ repeat: -1, repeatDelay: 4.2, delay: 1.4, paused: true })
        .fromTo(fx.sweep, { xPercent: -150 }, { xPercent: 420, duration: 1.6, ease: 'power2.inOut' })
        .fromTo(parts.shine, { xPercent: -160 }, { xPercent: 260, duration: 0.9, ease: 'power2.inOut' }, 0.5));

      // 重點字的流光
      loops.push(gsap.fromTo(parts.em, { backgroundPosition: '100% 0%' }, {
        backgroundPosition: '0% 0%', duration: 2.6, ease: 'power1.inOut', repeat: -1, repeatDelay: 2.4, paused: true,
      }));
      return loops;
    }

    bind() {
      const root = this.root;

      this.pauseBtn.addEventListener('click', () => {
        this.paused = !this.paused;
        this.pauseBtn.setAttribute('aria-pressed', String(this.paused));
        this.pauseBtn.setAttribute('aria-label', this.paused ? '播放輪播' : '暫停輪播');
        this.syncTimer();
      });

      root.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { this.hover = true; this.syncTimer(); } });
      root.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { this.hover = false; this.syncTimer(); } });
      root.addEventListener('focusin', () => { this.focus = true; this.syncTimer(); });
      root.addEventListener('focusout', e => {
        if (root.contains(e.relatedTarget)) return;
        this.focus = false;
        this.syncTimer();
      });
      root.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        this.goTo(this.index + dir, dir);
      });

      // 左右滑動切換（垂直方向交給頁面捲動）
      const stage = this.stage;
      stage.addEventListener('dragstart', e => e.preventDefault());
      stage.addEventListener('pointerdown', e => {
        if (!e.isPrimary || e.button !== 0) return;
        this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, axis: null };
      });
      stage.addEventListener('pointermove', e => {
        const d = this.drag;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.axis && Math.hypot(dx, dy) > 8) {
          d.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
          if (d.axis === 'x') stage.setPointerCapture(e.pointerId);
        }
        d.dx = dx;
      });
      const end = () => {
        const d = this.drag;
        this.drag = null;
        if (!d || d.axis !== 'x') return;
        if (Math.abs(d.dx) < Math.min(80, stage.clientWidth * 0.15)) return;
        this.suppressClick = true;
        const dir = d.dx < 0 ? 1 : -1;
        this.goTo(this.index + dir, dir);
      };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', () => { this.drag = null; });
      stage.addEventListener('click', e => {
        if (!this.suppressClick) return;
        e.preventDefault();
        e.stopPropagation();
        this.suppressClick = false;
      }, true);

      // 滑鼠視差：背景往反方向、文字往同方向，做出前後景深
      if (this.fine) {
        this.px = this.items.map(item => ({
          sx: gsap.quickTo(item.scene, 'x', { duration: 1, ease: 'power3' }),
          sy: gsap.quickTo(item.scene, 'y', { duration: 1, ease: 'power3' }),
          cx: gsap.quickTo(item.copy, 'x', { duration: 1, ease: 'power3' }),
          cy: gsap.quickTo(item.copy, 'y', { duration: 1, ease: 'power3' }),
        }));
        root.addEventListener('pointermove', e => {
          if (!this.settings.layers.parallax || this.reduced) return;
          const r = stage.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width - 0.5;
          const ny = (e.clientY - r.top) / r.height - 0.5;
          const p = this.px[this.index];
          p.sx(-nx * 18);
          p.sy(-ny * 10);
          p.cx(nx * 8);
          p.cy(ny * 5);
        });
        root.addEventListener('pointerleave', () => this.resetParallax());
      }

      // 不在畫面內或分頁隱藏時，停掉所有循環動畫
      new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        this.syncFx();
        this.syncTimer();
      }, { threshold: 0.15 }).observe(root);
      document.addEventListener('visibilitychange', () => {
        this.syncFx();
        this.syncTimer();
      });
    }

    resetParallax() {
      if (!this.px) return;
      this.px.forEach(p => { p.sx(0); p.sy(0); p.cx(0); p.cy(0); });
    }

    /* ---------- 設定 ---------- */

    setSettings(settings) {
      this.settings = settings;
      this.applyLayers();
    }

    applyLayers() {
      const L = this.settings.layers;
      Object.keys(L).forEach(k => this.root.classList.toggle(`off-${k}`, !L[k]));
      if (!L.parallax) this.resetParallax();
      if (!L.particles) this.items.forEach(item => { item.particles.stop(); item.particles.clear(); });
      const item = this.items[this.index];
      if (!L.kenburns || this.reduced) {
        if (this.kb) this.kb.kill();
        this.kb = null;
        gsap.to(item.zoom, { scale: 1, duration: 0.6, ease: 'power2.out' });
      } else if (!this.kb) {
        this.startKenBurns(item);
      }
      this.syncFx();
    }

    /* ---------- 狀態同步 ---------- */

    get live() {
      return this.visible && !document.hidden && !this.reduced;
    }

    syncFx() {
      const L = this.settings.layers;
      this.items.forEach((item, i) => {
        const on = this.live && i === this.index;
        item.loops.forEach(l => (on ? l.play() : l.pause()));
        if (on && L.particles) item.particles.start();
        else item.particles.stop();
      });
    }

    syncTimer() {
      const run = !this.reduced && !this.paused && !this.hover && !this.focus && !this.busy && this.visible && !document.hidden;
      if (!run) {
        if (this.timer) this.timer.pause();
        return;
      }
      if (this.timer) {
        this.timer.resume();
        return;
      }
      this.timer = gsap.fromTo(this.dotParts[this.index].fill, { scaleX: 0 }, {
        scaleX: 1,
        duration: DURATION,
        ease: 'none',
        onComplete: () => {
          this.timer = null;
          this.goTo(this.index + 1, 1);
        },
      });
    }

    stopTimer() {
      if (this.timer) this.timer.kill();
      this.timer = null;
    }

    updateDots() {
      this.dotParts.forEach((d, i) => {
        d.button.setAttribute('aria-current', i === this.index ? 'true' : 'false');
        gsap.set(d.fill, { scaleX: this.reduced && i === this.index ? 1 : 0 });
      });
    }

    startKenBurns(item) {
      if (this.kb) this.kb.kill();
      this.kb = null;
      gsap.set(item.zoom, { scale: 1 });
      if (!this.settings.layers.kenburns || this.reduced) return;
      this.kb = gsap.to(item.zoom, { scale: 1.08, duration: 12, ease: 'none' });
    }

    /* ---------- 文字進出場 ---------- */

    copyIn(item) {
      const p = item.parts;
      const targets = [p.label, ...p.lines, p.desc, p.cta];
      if (!this.settings.layers.copy || this.reduced) {
        gsap.set(targets, { clearProps: 'opacity,transform,letterSpacing' });
        return gsap.timeline();
      }
      return gsap.timeline()
        .fromTo(p.label, { opacity: 0, y: 0, letterSpacing: '0.6em' }, { opacity: 1, letterSpacing: '0.2em', duration: 0.9, ease: 'expo.out' })
        .fromTo(p.lines, { yPercent: 110, y: 0, opacity: 1 }, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.1 }, 0.05)
        .fromTo(p.desc, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.3)
        .fromTo(p.cta, { scale: 0.6, y: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(2.2)' }, 0.42);
    }

    copyOut(item) {
      const p = item.parts;
      if (!this.settings.layers.copy || this.reduced) return gsap.timeline();
      return gsap.timeline().to([p.label, ...p.lines, p.desc, p.cta], {
        y: -14, opacity: 0, duration: 0.32, ease: 'power2.in', stagger: 0.03,
      });
    }

    /* ---------- 切換 ---------- */

    show(n) {
      if (this.busy) this.busy.kill();
      this.busy = null;
      this.stopTimer();
      this.items.forEach((item, i) => {
        item.el.classList.toggle('is-active', i === n);
        item.el.setAttribute('aria-hidden', i === n ? 'false' : 'true');
        item.el.inert = i !== n;
        this.resetSlide(item);
      });
      this.index = n;
      this.updateDots();
      const item = this.items[n];
      this.startKenBurns(item);
      if (this.settings.layers.copy && !this.reduced) {
        gsap.fromTo(item.frame, { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.4, ease: 'expo.out' });
      }
      this.copyIn(item).delay(this.reduced ? 0 : 0.25);
      this.syncFx();
      this.syncTimer();
    }

    resetSlide(item) {
      item.el.style.clipPath = '';
      item.el.classList.remove('is-masking');
      gsap.set(item.el, { clearProps: 'opacity,zIndex' });
      gsap.set(item.frame, { clearProps: 'transform,opacity' });
      gsap.set(item.scene, { xPercent: 0 });
    }

    // 主體中心在舞台上的位置（%），給光圈轉場當圓心
    focusPoint(item) {
      const stage = this.stage.getBoundingClientRect();
      const glow = item.fx.glow.getBoundingClientRect();
      return {
        x: ((glow.left + glow.width / 2 - stage.left) / stage.width) * 100,
        y: ((glow.top + glow.height / 2 - stage.top) / stage.height) * 100,
      };
    }

    goTo(n, dir) {
      const len = this.items.length;
      n = (n + len) % len;
      if (n === this.index || this.busy) return;
      if (dir === undefined) dir = n > this.index ? 1 : -1;

      const cur = this.items[this.index];
      const nxt = this.items[n];
      this.stopTimer();
      this.resetSlide(nxt);
      nxt.el.classList.add('is-active');
      nxt.el.inert = false;
      nxt.el.setAttribute('aria-hidden', 'false');
      gsap.set(nxt.el, { zIndex: 2 });
      gsap.set(cur.el, { zIndex: 1 });

      const tl = gsap.timeline({ onComplete: () => this.finish(cur, nxt) });
      this.busy = tl;
      tl.add(this.copyOut(cur), 0);
      this.transition(this.reduced ? 'cut' : this.settings.transition, tl, cur, nxt, dir);
      tl.add(this.copyIn(nxt), this.reduced ? 0 : 0.5);

      this.index = n;
      this.updateDots();
      this.startKenBurns(nxt);
      this.resetParallax();
      this.syncFx();
    }

    finish(cur, nxt) {
      cur.el.classList.remove('is-active');
      cur.el.inert = true;
      cur.el.setAttribute('aria-hidden', 'true');
      this.resetSlide(cur);
      nxt.el.style.clipPath = '';
      nxt.el.classList.remove('is-masking');
      gsap.set(nxt.el, { clearProps: 'opacity,zIndex' });
      this.busy = null;
      this.syncTimer();
    }

    transition(type, tl, cur, nxt, dir) {
      const inOut = 'expo.inOut';
      switch (type) {
        case 'fade':
          tl.fromTo(nxt.el, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.inOut' }, 0)
            .fromTo(nxt.frame, { scale: 1.16 }, { scale: 1, duration: 1.5, ease: 'expo.out' }, 0)
            .to(cur.frame, { scale: 1.05, duration: 0.9, ease: 'power2.in' }, 0);
          break;

        case 'slide':
          // 外框整片滑動，裡面的圖慢一拍，產生視差
          tl.fromTo(nxt.frame, { xPercent: 100 * dir }, { xPercent: 0, duration: 1.1, ease: inOut }, 0)
            .fromTo(nxt.scene, { xPercent: -40 * dir }, { xPercent: 0, duration: 1.1, ease: inOut }, 0)
            .to(cur.frame, { xPercent: -100 * dir, duration: 1.1, ease: inOut }, 0)
            .to(cur.scene, { xPercent: 40 * dir, duration: 1.1, ease: inOut }, 0);
          break;

        case 'iris': {
          const { x, y } = this.focusPoint(nxt);
          const o = { r: 0 };
          const set = () => { nxt.el.style.clipPath = `circle(${o.r}% at ${x}% ${y}%)`; };
          set();
          tl.to(o, { r: 160, duration: 1.2, ease: 'power3.inOut', onUpdate: set }, 0)
            .fromTo(nxt.frame, { scale: 1.2 }, { scale: 1, duration: 1.5, ease: 'expo.out' }, 0)
            .to(cur.frame, { scale: 0.94, duration: 1.2, ease: 'power2.inOut' }, 0);
          break;
        }

        case 'blinds': {
          const o = { p: 0 };
          nxt.el.classList.add('is-masking');
          const set = () => nxt.el.style.setProperty('--blind', `${o.p}%`);
          set();
          tl.to(o, { p: 100, duration: 1.1, ease: 'power2.inOut', onUpdate: set }, 0)
            .fromTo(nxt.frame, { scale: 1.08 }, { scale: 1, duration: 1.4, ease: 'expo.out' }, 0);
          break;
        }

        case 'wipe': {
          // 斜切邊從右往左（上一張則反過來）掃過
          const o = { p: 0 };
          const set = () => {
            if (dir > 0) {
              const top = 130 - 160 * o.p;
              nxt.el.style.clipPath = `polygon(${top}% 0%, 100% 0%, 100% 100%, ${top - 30}% 100%)`;
            } else {
              const top = -30 + 160 * o.p;
              nxt.el.style.clipPath = `polygon(0% 0%, ${top}% 0%, ${top + 30}% 100%, 0% 100%)`;
            }
          };
          set();
          tl.to(o, { p: 1, duration: 1, ease: 'power3.inOut', onUpdate: set }, 0)
            .fromTo(nxt.frame, { xPercent: 8 * dir }, { xPercent: 0, duration: 1.3, ease: 'expo.out' }, 0)
            .to(cur.frame, { xPercent: -6 * dir, duration: 1, ease: 'power3.inOut' }, 0);
          break;
        }

        default:
          tl.fromTo(nxt.el, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0);
      }
    }

    next() {
      this.goTo(this.index + 1, 1);
    }

    replay() {
      this.show(0);
    }
  }

  function $(selector, context) {
    return context.querySelector(selector);
  }

  window.MotionBanner = MotionBanner;
})();
