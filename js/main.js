/* =========================================================
   實驗台：建立 banner（桌機 + 手機預覽），接上控制面板
   ========================================================= */
(() => {
  if (!window.gsap || !window.MotionBanner) return;

  const $$ = s => [...document.querySelectorAll(s)];
  const LAYERS = ['kenburns', 'parallax', 'light', 'scene', 'glints', 'particles', 'sweep', 'copy'];
  const settings = {
    transition: 'slide',
    layers: Object.fromEntries(LAYERS.map(k => [k, true])),
  };

  const banners = $$('[data-motion-banner]').map(el => new MotionBanner(el, window.MB_SLIDES, settings));
  const apply = () => banners.forEach(b => b.setSettings(settings));

  function syncButtons() {
    $$('[data-transition]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.transition === settings.transition)));
    $$('[data-layer]').forEach(b => b.setAttribute('aria-pressed', String(settings.layers[b.dataset.layer])));
  }

  // 選轉場後立刻切到下一張示範
  $$('[data-transition]').forEach(button => button.addEventListener('click', () => {
    settings.transition = button.dataset.transition;
    syncButtons();
    apply();
    banners.forEach(b => b.next());
  }));

  $$('[data-layer]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.layer;
    settings.layers[key] = !settings.layers[key];
    syncButtons();
    apply();
  }));

  const actions = {
    replay: () => banners.forEach(b => b.replay()),
    next: () => banners.forEach(b => b.next()),
    off: () => { LAYERS.forEach(k => { settings.layers[k] = false; }); syncButtons(); apply(); },
    on: () => { LAYERS.forEach(k => { settings.layers[k] = true; }); syncButtons(); apply(); },
  };
  $$('[data-action]').forEach(button => button.addEventListener('click', () => actions[button.dataset.action]()));

  // 錨點平滑捲動
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || link.closest('.mb')) return;
    const hash = link.getAttribute('href');
    const target = hash === '#top' ? null : document.querySelector(hash);
    e.preventDefault();
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (target) target.scrollIntoView({ behavior });
    else window.scrollTo({ top: 0, behavior });
  });
})();
