/* =========================================================
   遊戲介紹頁：精選輪播、遊戲介紹、遊戲庫
   內容全部來自 js/games.js；沒有 GSAP 或開啟「減少動態效果」時
   內容照樣顯示，只是不播動畫
   ========================================================= */
(() => {
  const games = window.AFF_GAMES || [];
  const cfg = window.AFF_CONFIG || {};
  const G = window.gsap;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = Boolean(G) && !reduced;
  const fine = matchMedia('(pointer: fine)').matches;
  const DURATION = 7; // 輪播每款停留秒數

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const featured = games.filter(g => g.intro);
  const byId = new Map(games.map(g => [g.id, g]));
  if (!featured.length) return;

  const playHref = g => (g && g.url) || cfg.playUrl || '#';
  const specOf = (g, key) => (g.specs.find(([k]) => k === key) || [])[1] || '';

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function setPlay(link, g) {
    const url = playHref(g);
    link.href = url;
    // 推廣連結依慣例標成 sponsored
    if (/^https?:/.test(url)) link.rel = 'sponsored noopener';
    else link.removeAttribute('rel');
  }
  $$('[data-play]').forEach(a => setPlay(a));

  /* ---------- 數字動畫：96.81%、2,500 倍、12 匹 這類純數字才跑 ---------- */

  const NUMBER = /^(\d[\d,]*(?:\.\d+)?)(\s*(?:%|倍|匹|秒)?)$/;

  function countUp(node, value, delay = 0) {
    if (node._count) node._count.kill();
    // 數字和單位不要被拆成兩行
    node.classList.toggle('is-num', NUMBER.test(value));
    const m = motion && value.match(NUMBER);
    if (!m) {
      node.textContent = value;
      return;
    }
    const target = parseFloat(m[1].replace(/,/g, ''));
    const decimals = (m[1].split('.')[1] || '').length;
    const comma = m[1].includes(',');
    const format = n => (comma
      ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : n.toFixed(decimals)) + m[2];
    const state = { n: 0 };
    node.textContent = format(0);
    node._count = G.to(state, {
      n: target,
      duration: 1.3,
      delay,
      ease: 'power3.out',
      onUpdate: () => { node.textContent = format(state.n); },
      onComplete: () => { node.textContent = value; },
    });
  }

  /* ---------- 粒子：往上飄的光點與十字星芒 ---------- */

  class Sparks {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.color = '#ffffff';
      this.list = [];
      this.w = 0;
      this.h = 0;
      this.running = false;
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
      if (first) this.list = Array.from({ length: w < 640 ? 28 : 56 }, () => this.spawn(true));
    }

    spawn(initial) {
      const r = G.utils.random;
      // 桌機時集中在右半邊的主視覺附近
      const x = this.w < 900 ? r(0, this.w) : r(this.w * 0.42, this.w);
      return {
        x,
        y: initial ? r(0, this.h) : this.h + 10,
        vy: r(-60, -18),
        sway: r(6, 22),
        freq: r(0.5, 1.4),
        phase: r(0, 6),
        size: r(0.8, 2.6),
        life: initial ? r(0, 5) : 0,
        max: r(3.5, 7),
        star: Math.random() < 0.16,
        white: Math.random() < 0.3,
      };
    }

    draw(dt) {
      const { ctx } = this;
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.globalCompositeOperation = 'lighter';
      this.list.forEach((p, i) => {
        p.life += dt;
        p.y += p.vy * dt;
        p.x += Math.cos(p.life * p.freq + p.phase) * p.sway * dt;
        if (p.life > p.max || p.y < -10) {
          this.list[i] = this.spawn(false);
          return;
        }
        const a = Math.sin(Math.PI * (p.life / p.max)) * (0.6 + 0.4 * Math.sin(p.life * 7 + p.phase));
        ctx.fillStyle = p.white ? '#ffffff' : this.color;
        if (p.star) {
          // 十字星芒：兩條細長菱形，慢慢轉
          const len = p.size * 6;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.life * 0.8);
          ctx.globalAlpha = a;
          for (let k = 0; k < 2; k += 1) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(0, -len);
            ctx.lineTo(p.size * 0.6, 0);
            ctx.lineTo(0, len);
            ctx.lineTo(-p.size * 0.6, 0);
            ctx.fill();
          }
          ctx.restore();
          return;
        }
        ctx.globalAlpha = a * 0.28;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    tick(time, deltaMs) {
      if (this.w) this.draw(Math.min(deltaMs, 50) / 1000);
    }

    start() {
      if (this.running) return;
      this.running = true;
      G.ticker.add(this.tick);
    }

    stop() {
      if (!this.running) return;
      this.running = false;
      G.ticker.remove(this.tick);
    }
  }

  /* ---------- 滑鼠傾斜 ---------- */

  function tilt(area, target, { rx = 12, ry = 16, glare } = {}) {
    if (!motion || !fine) return;
    const toX = G.quickTo(target, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const toY = G.quickTo(target, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    area.addEventListener('pointermove', e => {
      const box = area.getBoundingClientRect();
      const px = (e.clientX - box.left) / box.width;
      const py = (e.clientY - box.top) / box.height;
      toX((0.5 - py) * rx);
      toY((px - 0.5) * ry);
      if (glare) {
        glare.style.setProperty('--gx', `${px * 100}%`);
        glare.style.setProperty('--gy', `${py * 100}%`);
      }
    });
    area.addEventListener('pointerleave', () => {
      toX(0);
      toY(0);
    });
  }

  /* ---------- 精選輪播 ---------- */

  class Showcase {
    constructor(root) {
      this.root = root;
      this.index = -1;
      this.front = 0;
      this.paused = false;
      this.hover = false;
      this.focus = false;
      this.visible = true;
      this.busy = false;
      this.loops = [];

      this.bg = $$('.show-bg img', root);
      this.card = $('.show-card', root);
      this.cardImg = $('.show-card img', root);
      this.stage = $('.show-stage', root);
      this.visual = $('.show-visual', root);
      this.chips = $$('.show-chip', root);
      this.stats = $('.show-stats', root);
      this.title = $('.show-title', root);
      this.copy = $('.show-copy', root);
      this.parts = [...this.copy.children];
      this.pauseBtn = $('.show-pause', root);

      const rail = $('.show-thumbs', root);
      this.thumbs = featured.map((g, i) => {
        const b = el('button');
        b.type = 'button';
        b.setAttribute('aria-label', g.zh ? `${g.zh} ${g.name}` : g.name);
        const img = el('img');
        img.src = g.img;
        img.alt = '';
        b.append(img, el('span', '', g.zh || g.name), el('i'));
        b.addEventListener('click', () => {
          this.copy.setAttribute('aria-live', 'polite');
          this.goTo(i);
        });
        rail.append(b);
        return b;
      });
      this.bars = this.thumbs.map(b => $('i', b));

      rail.addEventListener('keydown', e => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const i = (this.index + step + featured.length) % featured.length;
        this.goTo(i, step);
        this.thumbs[i].focus();
      });

      this.pauseBtn.addEventListener('click', () => {
        this.paused = !this.paused;
        this.pauseBtn.setAttribute('aria-pressed', String(this.paused));
        this.pauseBtn.setAttribute('aria-label', this.paused ? '繼續輪播' : '暫停輪播');
        this.syncTimer();
      });

      $('[data-show-intro]', root).addEventListener('click', e => {
        e.preventDefault();
        intro.select(featured[this.index].id, { scroll: true });
      });

      // 手機左右滑動換遊戲
      let startX = null;
      this.visual.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') startX = e.clientX; });
      this.visual.addEventListener('pointerup', e => {
        if (startX == null) return;
        const dx = e.clientX - startX;
        startX = null;
        if (Math.abs(dx) > 40) this.step(dx < 0 ? 1 : -1);
      });

      if (motion) this.setupMotion();
      this.show(0);
      // 其他主圖先載入，切換時不會閃
      featured.slice(1).forEach(g => { new Image().src = g.img; });
    }

    setupMotion() {
      this.sparks = new Sparks($('.show-sparks', this.root));
      const r = G.utils.random;
      const loop = ({ targets, ...vars }) => this.loops.push(G.to(targets, { ...vars, paused: true }));
      loop({ targets: $('.show-rays', this.root), rotation: 360, duration: 60, ease: 'none', repeat: -1 });
      loop({ targets: $('.show-glow', this.root), scale: 1.12, opacity: 0.75, duration: 2.6, ease: 'sine.inOut', repeat: -1, yoyo: true });
      loop({ targets: this.stage, y: -12, duration: 3.2, ease: 'sine.inOut', repeat: -1, yoyo: true });
      this.chips.forEach((chip, i) => loop({ targets: chip, y: i ? 10 : -10, duration: r(2.4, 3.2), ease: 'sine.inOut', repeat: -1, yoyo: true, delay: i * 0.6 }));
      const shine = $('.show-shine', this.root);
      G.set(shine, { xPercent: -120 });
      this.loops.push(G.to(shine, { xPercent: 120, duration: 1.1, ease: 'power2.inOut', repeat: -1, repeatDelay: 3.6, delay: 1.5, paused: true }));

      tilt(this.visual, this.stage, { glare: this.card });
      if (fine) {
        const chipX = this.chips.map(c => G.quickTo(c, 'x', { duration: 0.8, ease: 'power3.out' }));
        this.visual.addEventListener('pointermove', e => {
          const box = this.visual.getBoundingClientRect();
          const px = (e.clientX - box.left) / box.width - 0.5;
          chipX.forEach((to, i) => to(px * (i ? -26 : 26)));
        });
        this.visual.addEventListener('pointerleave', () => chipX.forEach(to => to(0)));
        // 滑鼠停在主視覺或縮圖列上時先不換
        [this.visual, $('.show-rail', this.root)].forEach(area => {
          area.addEventListener('pointerenter', () => { this.hover = true; this.syncTimer(); });
          area.addEventListener('pointerleave', () => { this.hover = false; this.syncTimer(); });
        });
      }
      this.root.addEventListener('focusin', () => { this.focus = true; this.syncTimer(); });
      this.root.addEventListener('focusout', e => {
        if (this.root.contains(e.relatedTarget)) return;
        this.focus = false;
        this.syncTimer();
      });

      new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        this.syncFx();
      }).observe(this.root);
      document.addEventListener('visibilitychange', () => this.syncFx());
    }

    syncFx() {
      const on = this.visible && !document.hidden;
      this.loops.forEach(t => (on ? t.play() : t.pause()));
      if (this.sparks) (on ? this.sparks.start() : this.sparks.stop());
      this.syncTimer();
    }

    syncTimer() {
      if (!this.timer) return;
      const run = !this.paused && !this.hover && !this.focus && !this.busy && this.visible && !document.hidden;
      if (run) this.timer.resume();
      else this.timer.pause();
    }

    startTimer() {
      if (!motion) return;
      if (this.timer) this.timer.kill();
      G.set(this.bars, { scaleX: 0 });
      this.timer = G.to(this.bars[this.index], {
        scaleX: 1,
        duration: DURATION,
        ease: 'none',
        paused: true,
        onComplete: () => this.step(1),
      });
      this.syncTimer();
    }

    step(dir) {
      this.goTo((this.index + dir + featured.length) % featured.length, dir);
    }

    render(g) {
      $('.show-provider', this.root).textContent = g.provider;
      $('.show-type', this.root).textContent = g.type;
      $('.show-zh', this.root).textContent = g.zh || '';
      $('.show-en', this.root).textContent = g.name;
      this.title.classList.toggle('no-zh', !g.zh);
      $('.show-pitch', this.root).textContent = g.pitch;
      this.stats.replaceChildren(...g.stats.map(key => {
        const item = el('div');
        item.append(el('dt', '', key), el('dd', '', specOf(g, key)));
        return item;
      }));
      this.chips.forEach((chip, i) => {
        const key = g.stats[i];
        chip.replaceChildren(`${key} `, el('b', '', specOf(g, key)));
      });
      this.cardImg.src = g.img;
      this.cardImg.alt = '';
      $$('[data-play]', this.root).forEach(a => setPlay(a, g));
      this.thumbs.forEach((b, i) => b.setAttribute('aria-current', String(i === this.index)));
      if (!motion) this.root.style.setProperty('--accent', g.accent);
      if (this.sparks) this.sparks.color = g.accent;
    }

    setBg(g, animate) {
      const prev = this.bg[this.front];
      this.front ^= 1;
      const next = this.bg[this.front];
      next.src = g.img;
      if (!motion) {
        next.style.opacity = 1;
        prev.style.opacity = 0;
        return;
      }
      G.killTweensOf(next);
      G.fromTo(next, { opacity: 0 }, { opacity: 1, duration: animate ? 1.2 : 0.8, ease: 'power2.out' });
      // 背景慢慢拉遠，靜態圖也有鏡頭在動的感覺
      G.fromTo(next, { scale: 1.25 }, { scale: 1.02, duration: DURATION + 2, ease: 'sine.out' });
      G.to(prev, { opacity: 0, duration: 1.2, ease: 'power2.out' });
    }

    countStats(delay = 0) {
      $$('dd', this.stats).forEach((dd, i) => countUp(dd, dd.textContent, delay + i * 0.12));
    }

    show(i) {
      this.index = i;
      const g = featured[i];
      this.render(g);
      this.setBg(g, false);
      if (!motion) return;
      G.set(this.root, { '--accent': g.accent });
      G.set($('.show-shine', this.root), { xPercent: -120 });
      const tl = G.timeline();
      tl.fromTo(this.card, { rotationY: 55, scale: 0.8, opacity: 0 }, { rotationY: 0, scale: 1, opacity: 1, duration: 1.1, ease: 'power3.out' }, 0.1)
        .from($('.show-rays', this.root), { opacity: 0, scale: 0.6, duration: 1.4, ease: 'power2.out' }, 0)
        .fromTo(this.parts, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, 0.2)
        .fromTo(this.chips, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.6, stagger: 0.12, ease: 'back.out(2)' }, 0.8)
        .add(() => this.countStats(), 0.5);
      this.syncFx();
      this.startTimer();
    }

    goTo(i, dir) {
      if (i === this.index) return;
      if (dir == null) dir = i > this.index ? 1 : -1;
      if (this.tl) this.tl.progress(1).kill();
      const g = featured[i];
      this.index = i;
      if (!motion) {
        this.render(g);
        this.setBg(g, true);
        return;
      }
      this.busy = true;
      this.syncTimer();
      G.set(this.bars, { scaleX: 0 });
      const tl = G.timeline({
        onComplete: () => {
          this.busy = false;
          this.tl = null;
          this.startTimer();
        },
      });
      this.tl = tl;
      tl.to(this.parts, { opacity: 0, y: -14, duration: 0.3, stagger: 0.03, ease: 'power2.in' }, 0)
        .to(this.card, { rotationY: -70 * dir, xPercent: -16 * dir, opacity: 0, duration: 0.45, ease: 'power2.in' }, 0)
        .to(this.chips, { opacity: 0, scale: 0.6, duration: 0.25, ease: 'power2.in' }, 0)
        .to(this.root, { '--accent': g.accent, duration: 0.7, ease: 'none' }, 0.1)
        .add(() => {
          this.render(g);
          this.setBg(g, true);
        }, 0.45)
        .fromTo(this.card, { rotationY: 70 * dir, xPercent: 16 * dir, opacity: 0 }, { rotationY: 0, xPercent: 0, opacity: 1, duration: 0.85, ease: 'power3.out', immediateRender: false }, 0.5)
        .fromTo(this.parts, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'power3.out', immediateRender: false }, 0.55)
        .fromTo(this.chips, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(2)', immediateRender: false }, 0.85)
        .add(() => this.countStats(), 0.65);
    }
  }

  /* ---------- 遊戲介紹 ---------- */

  class Intro {
    constructor(root) {
      this.root = root;
      this.current = null;
      this.panel = $('.intro-panel', root);
      this.body = $('.intro-body', root);
      this.card = $('.intro-card', root);
      this.gallery = $('.intro-gallery', root);
      this.tablist = $('.intro-tabs', root);
      this.seen = !motion;

      this.tabs = featured.map(g => {
        const b = el('button');
        b.type = 'button';
        b.id = `tab-${g.id}`;
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-controls', 'intro-panel');
        const img = el('img');
        img.src = g.img;
        img.alt = '';
        img.loading = 'lazy';
        b.append(img, el('span', '', g.zh || g.name));
        b.addEventListener('click', () => this.select(g.id, { user: true }));
        this.tablist.append(b);
        return b;
      });
      this.panel.id = 'intro-panel';

      this.tablist.addEventListener('keydown', e => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const i = featured.indexOf(this.current);
        const next = featured[(i + step + featured.length) % featured.length];
        this.select(next.id, { user: true });
        this.tabs[featured.indexOf(next)].focus();
      });

      if (motion) {
        tilt(this.card.parentElement, this.card, { rx: 10, ry: 14, glare: this.card });
        const shine = $('.show-shine', this.card);
        G.set(shine, { xPercent: -120 });
        G.to(shine, { xPercent: 120, duration: 1.1, ease: 'power2.inOut', repeat: -1, repeatDelay: 4.5, delay: 2 });
        // 規格數字等捲到畫面上才開始跑
        const io = new IntersectionObserver(([entry]) => {
          if (!entry.isIntersecting) return;
          io.disconnect();
          this.seen = true;
          this.countSpecs();
        }, { threshold: 0.25 });
        io.observe(this.panel);
      }
    }

    select(id, { scroll = false, user = false } = {}) {
      const g = byId.get(id);
      if (!g || !g.intro) return;
      if (user || scroll) history.replaceState(null, '', `#game=${g.id}`);
      if (scroll) this.root.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      if (g === this.current) return;

      const first = !this.current;
      this.current = g;
      this.tabs.forEach((b, i) => {
        const on = featured[i] === g;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      this.panel.setAttribute('aria-labelledby', `tab-${g.id}`);
      const tab = this.tabs[featured.indexOf(g)];
      // 只捲動分頁列本身，不要帶動整頁
      this.tablist.scrollTo({ left: tab.offsetLeft - (this.tablist.clientWidth - tab.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });

      if (!motion || first) {
        this.render(g);
        if (motion) G.set(this.root, { '--accent': g.accent });
        return;
      }
      if (this.tl) this.tl.progress(1).kill();
      const parts = [...this.body.children];
      const tl = G.timeline({ onComplete: () => { this.tl = null; } });
      this.tl = tl;
      tl.to(parts, { opacity: 0, y: 8, duration: 0.2, stagger: 0.012, ease: 'power1.in' }, 0)
        .to([this.card, this.gallery], { opacity: 0, scale: 0.94, duration: 0.25, ease: 'power2.in' }, 0)
        .to(this.root, { '--accent': g.accent, duration: 0.5, ease: 'none' }, 0)
        .add(() => this.render(g))
        .fromTo([this.card, this.gallery], { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out', immediateRender: false })
        .fromTo(parts, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out', immediateRender: false }, '<0.05');
    }

    render(g) {
      const $r = s => $(s, this.root);
      $r('.intro-meta').textContent = `${g.provider} · ${g.type}`;
      const title = $r('.intro-title');
      title.textContent = g.zh || g.name;
      if (g.zh) title.append(el('small', '', g.name));
      $r('.intro-text').textContent = g.intro;
      $r('.intro-specs').replaceChildren(...g.specs.map(([k, v]) => {
        const item = el('div');
        item.append(el('dt', '', k), el('dd', '', v));
        return item;
      }));
      $r('.intro-features').replaceChildren(...g.features.map(([name, desc]) => {
        const li = el('li');
        li.append(el('strong', '', name), el('span', '', desc));
        return li;
      }));
      $r('.intro-steps').replaceChildren(...g.steps.map(s => el('li', '', s)));
      $r('.intro-tip').textContent = g.tip;
      const trailer = $r('[data-trailer]');
      trailer.hidden = !g.trailer;
      if (g.trailer) trailer.href = g.trailer;
      $$('[data-play]', this.root).forEach(a => setPlay(a, g));
      const img = $('img', this.card);
      img.src = g.img;
      img.alt = g.zh ? `${g.zh} ${g.name}` : g.name;

      this.gallery.hidden = !g.gallery;
      if (g.gallery) {
        $('h4', this.gallery).textContent = g.gallery.title;
        $('ul', this.gallery).replaceChildren(...g.gallery.items.map(([src, label], i) => {
          const li = el('li');
          const pic = el('img');
          pic.src = src;
          pic.alt = '';
          li.append(pic, el('span', '', label));
          if (motion) G.to(pic, { y: -6, duration: 1.8, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: i * 0.4 });
          return li;
        }));
      }
      if (!motion) this.root.style.setProperty('--accent', g.accent);
      if (this.seen) this.countSpecs();
    }

    countSpecs() {
      $$('.intro-specs dd', this.root).forEach((dd, i) => countUp(dd, dd.textContent, 0.25 + i * 0.08));
    }
  }

  /* ---------- 遊戲庫 ---------- */

  class Library {
    constructor(root) {
      this.root = root;
      this.grid = $('.lib-grid', root);
      const TAG = { hot: '熱門', big: '高倍數', original: '原創' };

      this.cards = games.map(g => {
        const card = el('article', 'lib-card');
        card.dataset.tags = [...g.tags, g.intro ? 'intro' : ''].join(' ');
        const inner = el('div', 'lib-inner');
        inner.style.setProperty('--accent', g.accent);

        const art = el('div', 'lib-art');
        const img = el('img');
        img.src = g.img;
        img.alt = g.zh ? `${g.zh} ${g.name}` : g.name;
        img.loading = 'lazy';
        img.width = 500;
        img.height = 500;
        art.append(img, el('span', 'lib-shine'));

        const info = el('div', 'lib-info');
        const meta = el('p');
        meta.append(`${g.provider} · ${g.type}`, ...g.tags.map(t => el('em', '', TAG[t])));
        info.append(el('h3', '', g.zh || g.name), meta);

        const actions = el('div', 'lib-actions');
        if (g.intro) {
          const more = el('button', 'btn-line', '看介紹');
          more.type = 'button';
          more.addEventListener('click', () => intro.select(g.id, { scroll: true }));
          actions.append(more);
        }
        const play = el('a', 'btn-play', '遊玩');
        setPlay(play, g);
        actions.append(play);

        inner.append(art, info, actions);
        card.append(inner);
        this.grid.append(card);

        if (motion && fine) {
          inner.addEventListener('pointermove', e => {
            const box = inner.getBoundingClientRect();
            const px = (e.clientX - box.left) / box.width;
            const py = (e.clientY - box.top) / box.height;
            inner.style.setProperty('--rx', `${(0.5 - py) * 10}deg`);
            inner.style.setProperty('--ry', `${(px - 0.5) * 12}deg`);
            inner.style.setProperty('--gx', `${px * 100}%`);
            inner.style.setProperty('--gy', `${py * 100}%`);
          });
          inner.addEventListener('pointerleave', () => {
            inner.style.setProperty('--rx', '0deg');
            inner.style.setProperty('--ry', '0deg');
          });
        }
        return card;
      });

      this.io = reveal(this.cards, 0.05);

      this.buttons = $$('[data-filter]', root);
      this.buttons.forEach(b => b.addEventListener('click', () => this.filter(b.dataset.filter)));
    }

    filter(key) {
      this.buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === key)));
      const apply = () => this.cards.forEach(c => {
        c.hidden = key !== 'all' && !c.dataset.tags.split(' ').includes(key);
      });
      if (!motion) {
        apply();
        return;
      }
      if (this.tl) this.tl.progress(1).kill();
      this.tl = G.timeline()
        .to(this.grid, { opacity: 0, y: 8, duration: 0.18, ease: 'power1.in' })
        .add(() => {
          apply();
          const shown = this.cards.filter(c => !c.hidden);
          shown.forEach(c => this.io && this.io.unobserve(c));
          G.fromTo(shown, { opacity: 0, y: 20, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.035, ease: 'power3.out' });
        })
        .set(this.grid, { opacity: 1, y: 0 });
    }
  }

  /* ---------- 捲動進場 ---------- */

  function reveal(nodes, stagger = 0.08) {
    if (!motion || !nodes.length) return null;
    G.set(nodes, { opacity: 0, y: 28 });
    const io = new IntersectionObserver(entries => {
      const hits = entries.filter(e => e.isIntersecting).map(e => e.target);
      if (!hits.length) return;
      hits.forEach(n => io.unobserve(n));
      G.to(hits, { opacity: 1, y: 0, duration: 0.8, stagger, ease: 'power3.out' });
    }, { rootMargin: '0px 0px -8% 0px' });
    nodes.forEach(n => io.observe(n));
    return io;
  }

  /* ---------- 組裝 ---------- */

  const intro = new Intro($('#intro'));
  const fromHash = () => {
    const m = location.hash.match(/^#game=([\w-]+)$/);
    const g = m && byId.get(m[1]);
    return g && g.intro ? g : null;
  };
  const linked = fromHash();
  intro.select((linked || featured[0]).id);
  new Showcase($('.show'));
  new Library($('#library'));
  reveal($$('.sec-head, .intro-panel, .faq details, .care'));

  if (linked) requestAnimationFrame(() => intro.root.scrollIntoView());
  window.addEventListener('hashchange', () => {
    const g = fromHash();
    if (g) intro.select(g.id, { scroll: true });
  });

  // 錨點平滑捲動（頁首固定，停的位置由 CSS scroll-margin-top 控制）
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || link.hasAttribute('data-play') || link.hasAttribute('data-show-intro')) return;
    const hash = link.getAttribute('href');
    if (hash.length < 2) return;
    const target = hash === '#top' ? null : $(hash);
    e.preventDefault();
    const behavior = reduced ? 'auto' : 'smooth';
    if (target) target.scrollIntoView({ behavior });
    else window.scrollTo({ top: 0, behavior });
  });
})();
