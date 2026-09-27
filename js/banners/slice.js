/* 04 切片輪播：交錯百葉窗轉場 + 自動輪播（懸停、聚焦或按暫停時停下） */
MB.banners.slice = root => {
  const { $, $$ } = MB;
  const slides = $$('.sl-slide', root);
  const blinds = $$('.sl-blinds span', root);
  const bars = $$('.sl-progress i', root);
  const counter = $('.sl-current', root);
  const ui = $('.sl-ui', root);
  const toggle = $('.sl-toggle', root);
  const DURATION = 5;
  const fg = slide => getComputedStyle(slide).color;

  let index = 0;
  let transition = null;
  let timer = null;
  let running = false;
  let userPaused = false;
  let hovering = false;

  const parts = s => ({
    kicker: $('.sl-kicker', s),
    lines: $$('.sl-title .rl > span', s),
    sub: $('.sl-sub', s),
    btn: $('.btn', s),
    art: $$('.sl-art > *', s),
  });

  function slideIn(s) {
    const p = parts(s);
    return gsap.timeline()
      .fromTo(p.art, { scale: 0, rotation: -45, opacity: 1 }, { scale: 1, rotation: 0, duration: 1, ease: 'back.out(1.4)', stagger: 0.1 }, 0)
      .fromTo(p.kicker, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, 0.1)
      .fromTo(p.lines, { yPercent: 110, y: 0, opacity: 1 }, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.1 }, 0.15)
      .fromTo([p.sub, p.btn], { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.08 }, 0.35);
  }

  function slideOut(s) {
    const p = parts(s);
    return gsap.timeline()
      .to([p.kicker, ...p.lines, p.sub, p.btn], { y: -30, opacity: 0, duration: 0.4, ease: 'power2.in', stagger: 0.03 }, 0)
      .to(p.art, { scale: 0.6, opacity: 0, duration: 0.4, ease: 'power2.in' }, 0);
  }

  // 不帶動畫地切到第 n 張（更新狀態、計數與進度條）
  function show(n) {
    slides.forEach((s, i) => {
      s.classList.toggle('is-active', i === n);
      if (i === n) s.removeAttribute('aria-hidden');
      else s.setAttribute('aria-hidden', 'true');
    });
    index = n;
    counter.textContent = String(n + 1).padStart(2, '0');
    bars.forEach((b, i) => gsap.set(b, { scaleX: i < n ? 1 : 0 }));
    ui.style.color = fg(slides[n]);
  }

  // 依目前狀態決定自動輪播要跑還是停
  function update() {
    const go = running && !userPaused && !hovering && !transition;
    if (!go) {
      if (timer) timer.pause();
      return;
    }
    if (timer) timer.resume();
    else {
      timer = gsap.fromTo(bars[index], { scaleX: 0 }, {
        scaleX: 1,
        duration: DURATION,
        ease: 'none',
        onComplete: () => { timer = null; goTo(index + 1, 1); },
      });
    }
  }

  function goTo(n, dir) {
    if (transition) return;
    n = (n + slides.length) % slides.length;
    if (n === index) return;
    if (timer) { timer.kill(); timer = null; }
    const from = slides[index];
    const to = slides[n];
    const order = dir > 0 ? 'start' : 'end';
    transition = gsap.timeline({ onComplete: () => { transition = null; update(); } })
      .add(slideOut(from), 0)
      // 單數條從上往下、雙數條從下往上，交錯蓋住畫面
      .set(blinds, { backgroundColor: to.dataset.bg, transformOrigin: i => (i % 2 ? '50% 0%' : '50% 100%') }, 0)
      .to(blinds, { scaleY: 1, duration: 0.55, ease: 'expo.inOut', stagger: { each: 0.045, from: order } }, 0.1)
      .to(ui, { color: fg(to), duration: 0.3 }, 0.4)
      .add(() => show(n))
      .set(blinds, { transformOrigin: i => (i % 2 ? '50% 100%' : '50% 0%') })
      .to(blinds, { scaleY: 0, duration: 0.55, ease: 'expo.inOut', stagger: { each: 0.045, from: order } })
      .add(slideIn(to), '-=0.45');
  }

  $('.sl-next', root).addEventListener('click', () => goTo(index + 1, 1));
  $('.sl-prev', root).addEventListener('click', () => goTo(index - 1, -1));
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    toggle.setAttribute('aria-pressed', String(userPaused));
    toggle.setAttribute('aria-label', userPaused ? '播放輪播' : '暫停輪播');
    update();
  });
  root.addEventListener('pointerenter', () => { hovering = true; update(); });
  root.addEventListener('pointerleave', () => { hovering = false; update(); });
  root.addEventListener('focusin', () => { hovering = true; update(); });
  root.addEventListener('focusout', e => {
    if (root.contains(e.relatedTarget)) return;
    hovering = false;
    update();
  });

  show(0);
  const intro = gsap.timeline({ paused: true })
    .add(slideIn(slides[0]))
    .from([$('.sl-count', root), $('.sl-progress', root), $('.sl-nav', root)], {
      y: 20, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08,
    }, 0.4);

  return {
    intro,
    play: () => { running = true; update(); },
    pause: () => { running = false; update(); },
    reset: () => {
      if (transition) { transition.kill(); transition = null; }
      if (timer) { timer.kill(); timer = null; }
      gsap.set(blinds, { scaleY: 0 });
      show(0);
    },
  };
};
