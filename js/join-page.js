/* =========================================================
   推廣頁（join.html）的頁面內容：依 js/site.js 與 js/games.js 產生
   ========================================================= */
(() => {
  const cfg = window.AFF_CONFIG || {};
  const site = window.SITE || {};
  const games = window.AFF_GAMES || [];
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  };
  const ICONS = {
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    games: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M8.5 9v6M12 9v6M15.5 9v6"/>',
    support: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.6-2 2.5-5 2.5"/>',
    shield: '<path d="M12 2.5l8 3v6c0 5-3.5 8.6-8 10-4.5-1.4-8-5-8-10v-6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8C10 4 6 4 6 6.5S9 8 12 8zm0 0c2-4 6-4 6-1.5S15 8 12 8z"/>',
    bolt: '<path d="M13 2L4.5 14H11l-1 8 8.5-12H12z"/>',
  };

  // 註冊按鈕；沒設定註冊連結就用遊玩連結
  const registerUrl = cfg.registerUrl && cfg.registerUrl !== '#' ? cfg.registerUrl : cfg.playUrl || '#';
  $$('[data-register]').forEach(a => {
    a.href = registerUrl;
    if (/^https?:/.test(registerUrl)) a.rel = 'sponsored noopener';
  });

  // 熱門遊戲：前 12 款，連到遊戲介紹頁
  const list = $('.jn-games');
  if (list) {
    games.slice(0, 12).forEach(g => {
      const img = el('img', { src: g.img, alt: '', loading: 'lazy', width: 150, height: 150 });
      const a = el('a', { href: `affiliate.html#game=${g.id}` }, [img, el('span', { textContent: g.zh || g.name })]);
      a.style.setProperty('--c', g.accent);
      list.append(el('li', {}, [a]));
    });
  }

  const events = $('.jn-events');
  (site.events || []).forEach(e => {
    events?.append(el('li', {}, [el('small', { textContent: e.tag }), el('h3', { textContent: e.title }), el('p', { textContent: e.desc })]));
  });

  const feats = $('.jn-feats');
  (site.features || []).forEach(f => {
    const ic = el('i');
    ic.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[f.icon] || ICONS.bolt}</svg>`;
    feats?.append(el('li', {}, [ic, el('h3', { textContent: f.title }), el('p', { textContent: f.desc })]));
  });

  const pay = $('.jn-pay');
  (site.pay || []).forEach(p => {
    const big = el('strong', {}, [el('small', { textContent: p.lead || '' }), el('em', { textContent: p.value }), ` ${p.unit}`]);
    pay?.append(el('li', {}, [el('b', { textContent: p.label }), el('div', {}, [big, el('span', { textContent: p.note || '' })])]));
  });

  const steps = $('.jn-steps');
  (site.steps || []).forEach(s => steps?.append(el('li', { textContent: s })));
})();
