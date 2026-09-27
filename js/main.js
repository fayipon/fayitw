/* =========================================================
   頁面啟動：初始化每個 banner，控制進場、循環與重播
   使用者開啟「減少動態效果」時，banner 直接顯示最終畫面，
   只有按下重播或輪播按鈕才會播放動畫。
   ========================================================= */
(() => {
  const html = document.documentElement;

  // CDN 沒載到就退回靜態版面
  if (!window.gsap || !window.ScrollTrigger) {
    html.classList.remove('js', 'motion');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  const { $, $$, banners } = MB;
  const motion = html.classList.contains('motion');
  const env = { motion, finePointer: matchMedia('(pointer: fine)').matches };

  /* ---------- Banner 生命週期 ---------- */

  $$('[data-banner]').forEach(section => {
    const make = banners[section.dataset.banner];
    const root = $('.banner', section);
    if (!make || !root) return;

    const api = make(root, env);
    const { intro } = api;
    let visible = false;
    let ready = false;
    let started = false;

    // 循環動畫只在「進場播完」而且「在畫面內」時跑，省電也省效能
    const sync = () => (motion && visible && ready ? api.play() : api.pause());
    intro.eventCallback('onComplete', () => { ready = true; sync(); });

    const replay = $('.replay', section);
    const icon = $('svg', replay);
    replay.addEventListener('click', () => {
      started = true;
      ready = false;
      api.pause();
      if (api.reset) api.reset();
      intro.restart();
      gsap.fromTo(icon, { rotation: 0 }, { rotation: -360, duration: 0.7, ease: 'expo.inOut' });
    });

    if (!motion) {
      intro.progress(1);
      return;
    }

    const start = () => {
      if (started) return;
      started = true;
      intro.play();
    };
    ScrollTrigger.create({ trigger: root, start: 'top 72%', end: 'bottom top', onEnter: start, onEnterBack: start });
    ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: self => { visible = self.isActive; sync(); },
    });
  });

  /* ---------- 錨點連結平滑捲動（會套用 scroll-margin-top） ---------- */

  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href');
    const target = hash === '#top' ? null : $(hash);
    if (hash !== '#top' && !target) return;
    e.preventDefault();
    const behavior = motion ? 'smooth' : 'auto';
    if (target) target.scrollIntoView({ behavior });
    else window.scrollTo({ top: 0, behavior });
    history.replaceState(null, '', hash);
  });

  /* ---------- 導覽列：標出目前看到的樣式 ---------- */

  const nav = $('.index');
  $$('a', nav).forEach(link => {
    const target = $(link.getAttribute('href'));
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top center',
      end: 'bottom center',
      onToggle: self => {
        link.classList.toggle('is-active', self.isActive);
        if (!self.isActive) return;
        const left = link.offsetLeft - nav.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
        nav.scrollTo({ left, behavior: motion ? 'smooth' : 'auto' });
      },
    });
  });

  /* ---------- 頁首進場、進度條 ---------- */

  if (motion) {
    gsap.timeline({ delay: 0.1 })
      .from('.intro .rl > span', { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.1 })
      .from('.intro .eyebrow, .intro-lead', { y: 20, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 }, 0.3)
      .from('.intro-shapes i', { scale: 0, rotation: -90, duration: 0.8, ease: 'back.out(2)', stagger: 0.08 }, 0.5);

    gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  }

  // 字型載入後尺寸會變，重新計算觸發點
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
