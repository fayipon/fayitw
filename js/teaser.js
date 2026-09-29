/* =========================================================
   KUNKING 站點預告（teaser.html）
   風格：絕區零式的街頭動畫 UI：白底、大塊黑、螢光綠點綴、粗斜體窄字、
         塗鴉角色名、貼紙拼貼、映像管電視、漫畫分格；畫面文字全部用英文
   開機 → PICK YOUR GAME → 角色登場（6 款）→ 電視牆實機 → KUNKING 原創賽馬 → 註冊
   - 一條 GSAP 時間軸；影片、雜訊、粒子、角色抖動都只依時間計算，拖回去重看一致
   - 同一時間最多只播一支影片（多支同時播會掉到 30fps），
     需要多個畫面時用 canvas 從同一支影片畫不同區塊
   ========================================================= */
(() => {
  const G = window.gsap;
  const cfg = window.AFF_CONFIG || {};
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const root = $('.tr-player');
  const mg = root && $('.mg', root);
  if (!mg) return;

  // 頁面上的註冊按鈕；沒設定註冊連結就用遊玩連結
  const registerUrl = cfg.registerUrl && cfg.registerUrl !== '#' ? cfg.registerUrl : cfg.playUrl || '#';
  $$('[data-register]').forEach(a => {
    a.href = registerUrl;
    if (/^https?:/.test(registerUrl)) a.rel = 'sponsored noopener';
  });

  const BRAND = 'KUNKING';
  const chars = text => [...text].map(c => (c === ' ' ? ' ' : `<span>${c}</span>`)).join('');
  const video = (src, cls = '') => `<video class="${cls}" src="assets/clips/${src}.mp4" muted playsinline preload="auto"></video>`;
  const rnd = (i, n) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  const art = slug => `assets/chars/${slug}-art.webp`;
  const cut = slug => `assets/chars/${slug}-cut.webp`;

  /* ---------- 段落與資料 ---------- */

  const T = { boot: 0, pick: 2.6, cards: 5.4, tv: 22.2, race: 27, end: 32 };
  const CARD_LEN = 2.8;
  const END = 40;

  // 角色登場卡。rect 是角色在原圖（寬 base）上的位置，用來把角色放大到固定高度、擺在右側
  const CARDS = [
    { slug: 'fortune-tiger', name: 'FORTUNE TIGER', tag: 'TIGER', c: '#ff8a1f', chips: ['PG SOFT', 'SLOT', 'MAX 2,500X'], base: 2084, rect: [760, 100, 900, 1150] },
    { slug: 'medusa', name: 'MEDUSA', tag: 'MEDUSA', c: '#27d3c3', chips: ['PG SOFT', 'SLOT', 'GREEK MYTH'], base: 455, rect: [0, 0, 455, 572] },
    { slug: 'fortune-rabbit', name: 'FORTUNE RABBIT', tag: 'RABBIT', c: '#ff3b6b', chips: ['PG SOFT', 'SLOT', 'PRIZE SYMBOLS'], base: 2084, rect: [760, 200, 680, 960] },
    { slug: 'wild-bandito', name: 'WILD BANDITO', tag: 'BANDITO', c: '#b86bff', chips: ['PG SOFT', 'SLOT', 'MAX 25,000X'], base: 2084, rect: [760, 60, 1050, 1290] },
    { slug: 'pinata-wins', name: 'PIÑATA WINS', tag: 'PIÑATA', c: '#ff4fb8', chips: ['PG SOFT', 'CASCADE', 'MAX 5,000X'], base: 2084, rect: [700, 100, 900, 1230], clip: { src: 'pinata-mult', from: 4.6 } },
    { slug: 'asgardian-rising', name: 'ASGARDIAN RISING', tag: 'VIKING', c: '#ffb13b', chips: ['PG SOFT', 'SLOT', 'MAX 25,000X'], base: 2084, rect: [700, 60, 820, 1150] },
  ].map((c, i) => {
    const [x, y, w, h] = c.rect;
    const s = 640 / h;
    return { ...c, at: T.cards + i * CARD_LEN, left: 900 - (x + w / 2) * s, top: 50 - y * s, width: c.base * s };
  });

  // 電視牆：3×3，trio 是從並排影片畫的三段（sx、sw）
  const TVS = [
    { x: 70, y: 36, w: 360, h: 214, r: -2, kind: 'img', src: art('lucky-neko') },
    { x: 452, y: 20, w: 376, h: 226, r: 1, kind: 'trio', seg: 0 },
    { x: 850, y: 40, w: 360, h: 210, r: 2, kind: 'static' },
    { x: 56, y: 268, w: 372, h: 220, r: 1, kind: 'trio', seg: 1 },
    { x: 450, y: 262, w: 380, h: 230, r: 0, kind: 'logo' },
    { x: 852, y: 266, w: 372, h: 222, r: -1, kind: 'trio', seg: 2 },
    { x: 76, y: 506, w: 356, h: 200, r: 2, kind: 'img', src: art('fortune-snake') },
    { x: 454, y: 510, w: 372, h: 196, r: -1, kind: 'static' },
    { x: 848, y: 504, w: 366, h: 204, r: 1, kind: 'img', src: 'assets/games/horse-racing.webp' },
  ];
  const TRIO = [[0, 470], [470, 444], [914, 548]];

  // 漫畫賽道：三格都從同一支影片畫；src 是影片上要放大的區塊
  const RACE_FROM = 2.85;
  const FREEZE = 6.85;
  const PANES = [
    { x: 20, y: 20, w: 740, h: 680, poly: '0 0,740 0,620 680,0 680', src: [248, 0, 784, 720] },
    { x: 700, y: 20, w: 560, h: 320, poly: '80 0,560 0,560 320,14 320', src: [333, 252, 256, 146] },
    { x: 640, y: 360, w: 620, h: 340, poly: '72 0,620 0,620 340,14 340', src: [622, 302, 344, 190] },
  ];

  // 結尾的角色貼紙合照：[slug, 中心 x, 底部 y, 高度, 角度]，後面的疊在上面
  const LINEUP = [
    ['asgardian-rising', 120, 736, 320, -6], ['fortune-snake', 292, 724, 280, 5], ['medusa', 448, 736, 330, -3],
    ['wild-bandito', 1170, 736, 320, 6], ['pinata-wins', 1000, 730, 310, -5], ['fortune-rabbit', 830, 724, 280, 4],
    ['fortune-tiger', 640, 744, 370, 2],
  ];

  /* ---------- 分鏡 ---------- */

  const tvScreen = tv => {
    if (tv.kind === 'img') return `<img src="${tv.src}" alt="">`;
    if (tv.kind === 'trio') return `<canvas class="k-trio" data-seg="${tv.seg}" width="${TRIO[tv.seg][1]}" height="640"></canvas>`;
    if (tv.kind === 'static') return '<canvas class="k-noise" width="160" height="90"></canvas>';
    return `<div class="k-tvlogo"><b>${BRAND}</b><span>REAL GAMEPLAY</span></div>`;
  };
  const tvBody = (inner, style = '', cls = '') => `<div class="k-tv ${cls}" style="${style}"><div class="k-tv-scr">${inner}</div><i class="k-knob"></i><i class="k-knob b"></i></div>`;

  mg.classList.add('kz');
  mg.innerHTML = `
  <div class="mg-cam">
    <div class="k-bg"></div>

    <section class="sc ks-boot">
      <div class="k-lockup"><b>${BRAND}</b><i>TV</i></div>
      <div class="k-loading"><b>NOW LOADING</b><span>${'<i></i>'.repeat(8)}</span></div>
    </section>

    <section class="sc ks-pick">
      <div class="k-dots"></div>
      ${['PICK', 'YOUR', 'GAME'].map((w, i) => `<p class="k-word k-w${i}"><i></i><span>${w}</span></p>`).join('')}
      <p class="k-sub">6 HOT TITLES · 1 PLATFORM</p>
      <div class="k-band"><b>${BRAND} GAME FILES</b><span>▶ 01 — 06</span></div>
    </section>

    ${CARDS.map((c, i) => `
    <section class="sc ks-card" style="--c:${c.c}">
      <div class="k-panel"></div>
      <div class="k-dots"></div>
      <b class="k-graf">${chars(c.tag)}</b>
      <div class="k-art" style="left:${c.left.toFixed(0)}px;top:${c.top.toFixed(0)}px;width:${c.width.toFixed(0)}px"><img class="boil" src="${art(c.slug)}" alt=""></div>
      ${c.clip ? tvBody(video(c.clip.src), '', 'k-cardtv') : ''}
      <div class="k-plate">
        <p class="k-file"><b>FILE 0${i + 1}</b><span>/ 06</span></p>
        <h3 class="k-name">${c.name}</h3>
        <ul class="k-chips">${c.chips.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
      <div class="k-corner"><i></i><span>${BRAND}<br>GAME FILE</span></div>
      <div class="k-imp"><img src="${cut(c.slug)}" alt=""></div>
    </section>`).join('')}

    <section class="sc ks-tv">
      <div class="k-dots"></div>
      <div class="k-wall">${TVS.map(tv => tvBody(tvScreen(tv), `left:${tv.x}px;top:${tv.y}px;width:${tv.w}px;height:${tv.h}px;--r:${tv.r}deg`)).join('')}</div>
      ${video('join-trio', 'k-src')}
      <div class="k-band k-band-tv"><b>REAL GAMEPLAY</b><span>▶ ON AIR</span></div>
    </section>

    <section class="sc ks-race">
      ${video('race-finish', 'k-src')}
      ${PANES.map(p => `<canvas class="k-pane" width="${p.w}" height="${p.h}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;clip-path:polygon(${p.poly.split(',').map(xy => xy.split(' ').map(n => `${n}px`).join(' ')).join(',')})"></canvas>`).join('')}
      <svg class="k-gutter" viewBox="0 0 1280 720">${PANES.map(p => `<polygon transform="translate(${p.x} ${p.y})" points="${p.poly}"/>`).join('')}</svg>
      <div class="k-halftone"></div>
      <p class="k-nar k-nar-a">EVERY 2 MINUTES,</p>
      <p class="k-nar k-nar-b">A BRAND NEW RACE!</p>
      <b class="k-dash">DASH!!</b>
      <div class="k-stamp"><b>${BRAND}</b><span>ORIGINAL</span></div>
      <p class="k-rlabel">HORSE RACING</p>
      <p class="k-pf">PHOTO<br>FINISH!!</p>
    </section>

    <section class="sc ks-end">
      <div class="k-dots"></div>
      <div class="k-slashbg"></div>
      <h2 class="k-mark">${chars(BRAND)}</h2>
      <p class="k-tagline">HOT GAMES. ONE PLATFORM.</p>
      <div class="k-cta"><span>SIGN UP NOW</span><i></i><em>CLICK!</em></div>
      <p class="k-18">18+ PLAY RESPONSIBLY</p>
      ${LINEUP.map(([slug, x, y, h, r]) => `<img class="k-stk boil" src="${cut(slug)}" alt="" style="left:${x}px;top:${y - h}px;height:${h}px">`).join('')}
    </section>

    <div class="k-slash"><i></i><i></i></div>
    <svg class="k-cursor" viewBox="0 0 12 20" aria-hidden="true"><path d="M0 0v17l4-4 3 7 3-1-3-7h5z"/></svg>
    <i class="k-ripple"></i>
    <canvas class="k-fx" width="1280" height="720"></canvas>
    <canvas class="k-static" width="160" height="90"></canvas>
  </div>
  <div class="k-crt"></div>
  <div class="k-hud">
    <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
    <p class="h-ch"><b>${BRAND} TV</b><span class="h-chn">CH 01</span></p>
    <p class="h-rec"><i></i>REC <span class="h-tc">00:00:00:00</span></p>
    <p class="h-play">▶ PLAY</p>
  </div>
  <div class="k-flash"></div>`;

  const cam = $('.mg-cam', mg);
  const bg = $('.k-bg', mg);
  const flashEl = $('.k-flash', mg);
  const staticEl = $('.k-static', mg);
  const hud = $('.k-hud', mg);
  const cursor = $('.k-cursor', mg);
  const ripple = $('.k-ripple', mg);
  const slash = $('.k-slash', mg);
  const S = cls => $(`.${cls}`, mg);

  const CHAPTERS = [
    { at: 0, name: 'BOOT', caption: `${BRAND} TV — site trailer.` },
    { at: T.pick, name: 'PICK', caption: 'Pick your game: 6 hot titles, 1 platform.' },
    { at: T.cards, name: 'GAMES', caption: `${CARDS.map(c => c.name).join(', ')}.` },
    { at: T.tv, name: 'GAMEPLAY', caption: 'Real gameplay: Mahjong Ways 2, Super Ace, Piñata Wins.' },
    { at: T.race, name: 'ORIGINAL', caption: `${BRAND} original: horse racing, a brand new race every 2 minutes.` },
    { at: T.end, name: 'SIGN UP', caption: `${BRAND}: hot games, one platform. Sign up now. 18+ play responsibly.` },
  ];
  const CH = [[0.3, 1], [T.pick, 2], [T.cards, 3], [T.tv, 4], [T.race, 5], [T.end, 6]];

  const cardVideos = $$('.ks-card video', mg);
  const trioVideo = $('.ks-tv .k-src', mg);
  const raceVideo = $('.ks-race .k-src', mg);
  const VIDEOS = [
    ...CARDS.filter(c => c.clip).map((c, i) => ({ el: cardVideos[i], start: c.at + 0.1, end: c.at + CARD_LEN, from: c.clip.from })),
    { el: trioVideo, start: T.tv, end: T.race, from: 0 },
    { el: raceVideo, start: T.race, end: T.end, from: RACE_FROM, freeze: FREEZE },
  ];

  if (!G || !window.MGPlayer) {
    S('ks-end').style.visibility = 'visible';
    return;
  }

  /* ---------- 時間軸工具 ---------- */

  const tl = G.timeline({ paused: true });
  const show = (el, at, until) => {
    tl.set(el, { autoAlpha: 1 }, at);
    if (until != null) tl.set(el, { autoAlpha: 0 }, until);
  };
  const flash = (at, c = '#fff', o = 1, d = 0.2) =>
    tl.set(flashEl, { opacity: o, background: c }, at).to(flashEl, { opacity: 0, duration: d, ease: 'power2.out' }, at);
  const punch = (at, s = 1.07, d = 0.35) =>
    tl.fromTo(cam, { scale: s }, { scale: 1, duration: d, ease: 'expo.out', immediateRender: false }, at);
  // 震動用逐格（steps），比平滑的抖動更像動畫
  const shake = (at, a = 14, d = 0.3) =>
    tl.to(cam, { keyframes: { x: [0, -a, a * 0.8, -a * 0.5, a * 0.25, 0], y: [0, a * 0.5, -a * 0.6, a * 0.35, -a * 0.15, 0] }, duration: d, ease: 'steps(6)' }, at);
  const chSwitch = at => {
    tl.set(staticEl, { opacity: 1 }, at - 0.1).set(staticEl, { opacity: 0 }, at + 0.1)
      .to(cam, { keyframes: { y: [0, -16, 10, -5, 0] }, duration: 0.2, ease: 'steps(4)' }, at - 0.1);
  };
  // 斜切轉場：黑色斜條（前緣螢光綠）掃過，at 時蓋滿畫面
  const slashAt = at => {
    tl.fromTo(slash, { xPercent: -100 }, { xPercent: 0, duration: 0.18, ease: 'power3.in', immediateRender: false }, at - 0.18)
      .to(slash, { xPercent: 100, duration: 0.2, ease: 'power3.out' }, at + 0.02);
  };
  const moveCursor = (at, x, y, d = 0.5) => tl.to(cursor, { x, y, duration: d, ease: 'power2.inOut' }, at);
  G.set(slash, { xPercent: -100, skewX: -16 });
  G.set($$('.k-imp img, .k-stk', mg), { xPercent: -50 });

  /* ---------- 粒子：位置只由時間決定 ---------- */

  const BURSTS = [];
  const stars = (t, x, y, o = {}) => BURSTS.push({ t, x, y, n: 24, speed: 800, life: 0.8, grav: 0, kind: 'star', colors: ['#111', '#d7ff1f', '#fff'], seed: BURSTS.length * 97 + 11, ...o });
  const confetti = (t, x, y, o = {}) => stars(t, x, y, { kind: 'bit', n: 60, speed: 1100, grav: 900, life: 1.6, colors: ['#111', '#d7ff1f', '#ff3b6b', '#27d3c3', '#fff'], ...o });
  const click = (at, x, y) => {
    tl.to(cursor, { scale: 0.8, duration: 0.08, yoyo: true, repeat: 1 }, at)
      .fromTo(ripple, { x, y, scale: 0.2, opacity: 1 }, { scale: 2.2, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, at + 0.05);
    stars(at + 0.05, x, y, { n: 18, speed: 500 });
  };

  /* ---------- 開機 0–2.6 ---------- */

  const boot = S('ks-boot');
  show(boot, 0, T.pick);
  tl.set(bg, { background: '#000' }, 0)
    .set(hud, { autoAlpha: 0 }, 0).set(hud, { autoAlpha: 1 }, 0.5)
    .fromTo(cam, { clipPath: 'inset(50% 50% 50% 50%)' }, { clipPath: 'inset(49.6% 0% 49.6% 0%)', duration: 0.14, ease: 'power3.out' }, 0.2)
    .to(cam, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.2, ease: 'power3.inOut' }, 0.36)
    .set(staticEl, { opacity: 1 }, 0.2).set(staticEl, { opacity: 0 }, 0.85)
    .set(bg, { background: '#f3f3ef' }, 0.85)
    .fromTo($('.k-lockup', boot), { scaleX: 2.6, scaleY: 0.2, opacity: 0 }, { scaleX: 1, scaleY: 1, opacity: 1, duration: 0.28, ease: 'back.out(2.4)' }, 0.86)
    .fromTo($('.k-lockup i', boot), { scale: 0, rotation: -40 }, { scale: 1, rotation: -8, duration: 0.25, ease: 'back.out(3)' }, 1.15)
    .fromTo($('.k-loading', boot), { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.25, ease: 'power3.out' }, 1.3)
    .fromTo($$('.k-loading span i', boot), { opacity: 0.15 }, { opacity: 1, duration: 0.05, stagger: 0.1 }, 1.4);
  flash(0.85, '#fff', 1, 0.3);
  shake(0.9, 16);
  stars(0.9, 640, 330, { n: 36, speed: 1100 });
  chSwitch(T.pick);

  /* ---------- PICK YOUR GAME 2.6–5.4 ---------- */

  const pick = S('ks-pick');
  show(pick, T.pick, T.cards);
  tl.set(bg, { background: '#f3f3ef' }, T.pick);
  $$('.k-word', pick).forEach((w, i) => {
    const at = T.pick + 0.12 + i * 0.36;
    tl.fromTo($('span', w), { yPercent: 110, skewX: -20 }, { yPercent: 0, skewX: 0, duration: 0.22, ease: 'expo.out' }, at)
      .fromTo($('i', w), { scaleX: 0 }, { scaleX: 1, duration: 0.2, ease: 'power3.out' }, at + 0.1);
    punch(at, 1.05, 0.25);
  });
  tl.fromTo($('.k-sub', pick), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.4, ease: 'steps(10)' }, T.pick + 1.35)
    .fromTo($('.k-band', pick), { xPercent: -105 }, { xPercent: 0, duration: 0.3, ease: 'expo.out' }, T.pick + 1.7)
    .to($$('.k-word', pick), { x: -30, duration: 1.2, ease: 'none', stagger: 0.05 }, T.pick + 1.5);
  shake(T.pick + 1.72, 10);

  /* ---------- 角色登場 5.4–22.2 ---------- */

  $$('.ks-card', mg).forEach((sc, i) => {
    const c = CARDS[i];
    const A = c.at;
    const imp = $('.k-imp', sc);
    show(sc, A, A + CARD_LEN);
    // 衝擊畫面：3 格的反白剪影，再切到彩色
    tl.set(imp, { autoAlpha: 1 }, A).set(imp, { autoAlpha: 0 }, A + 0.1)
      .fromTo($('img', imp), { scale: 1.25 }, { scale: 1.12, duration: 0.1, ease: 'none' }, A)
      .fromTo($('.k-art', sc), { x: 160, scale: 1.12, opacity: 0 }, { x: 0, scale: 1, opacity: 1, duration: 0.34, ease: 'expo.out' }, A + 0.1)
      .to($('.k-art', sc), { x: -24, duration: CARD_LEN - 0.6, ease: 'none' }, A + 0.44)
      .fromTo($('.k-panel', sc), { xPercent: -60 }, { xPercent: 0, duration: 0.25, ease: 'expo.out' }, A + 0.08)
      .fromTo($$('.k-graf span', sc), { opacity: 0, scale: 2.2, rotation: k => (rnd(i, k) - 0.5) * 40 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.2, stagger: 0.04, ease: 'steps(4)' }, A + 0.14)
      .to($('.k-graf', sc), { x: 30, duration: CARD_LEN - 0.4, ease: 'none' }, A + 0.3)
      .fromTo($('.k-file', sc), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.2, ease: 'power3.out' }, A + 0.3)
      .fromTo($('.k-name', sc), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.3, ease: 'power4.out' }, A + 0.36)
      .fromTo($$('.k-chips li', sc), { opacity: 0, y: 20, scale: 0.7 }, { opacity: 1, y: 0, scale: 1, duration: 0.2, stagger: 0.07, ease: 'back.out(2.5)' }, A + 0.55)
      .fromTo($('.k-corner', sc), { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'steps(3)' }, A + 0.6);
    if (c.clip) tl.fromTo($('.k-cardtv', sc), { scale: 0, rotation: -20 }, { scale: 1, rotation: 4, duration: 0.3, ease: 'back.out(2.2)' }, A + 0.75);
    shake(A + 0.1, 16, 0.3);
    stars(A + 0.12, 880, 360, { n: 30, speed: 1000 });
  });
  chSwitch(T.tv);

  /* ---------- 電視牆 22.2–27 ---------- */

  const tvSc = S('ks-tv');
  const wall = $('.k-wall', tvSc);
  const tvs = $$('.k-tv', wall);
  show(tvSc, T.tv, T.race);
  tl.set(bg, { background: '#f3f3ef' }, T.tv)
    .fromTo(wall, { scale: 2.6, transformOrigin: '640px 377px' }, { scale: 1, duration: 0.9, ease: 'expo.out' }, T.tv)
    .fromTo(tvs, { opacity: 0.2 }, { opacity: 1, duration: 0.05, stagger: { each: 0.08, from: 'center' } }, T.tv + 0.2)
    .fromTo($('.k-band-tv', tvSc), { xPercent: -105 }, { xPercent: 0, duration: 0.3, ease: 'expo.out' }, T.tv + 1.0)
    .to(tvs, { y: k => (k % 2 ? -6 : 6), duration: 0.5, ease: 'steps(3)', yoyo: true, repeat: 5, stagger: 0.05 }, T.tv + 1.2)
    // 拉進右下角的賽馬電視
    .to(wall, { scale: 3.4, transformOrigin: '1031px 606px', duration: 0.6, ease: 'power3.in' }, T.race - 0.6);
  shake(T.tv + 0.9, 10);
  chSwitch(T.race);

  /* ---------- KUNKING 原創：賽馬 27–32 ---------- */

  const race = S('ks-race');
  const freezeAt = T.race + (FREEZE - RACE_FROM);
  const panes = $$('.k-pane', race);
  show(race, T.race, T.end);
  tl.set(bg, { background: '#f3f3ef' }, T.race)
    .fromTo(panes, { opacity: 0, x: k => [-200, 200, 200][k] }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.12, ease: 'power4.out' }, T.race)
    .fromTo($('.k-stamp', race), { scale: 3, rotation: 30, opacity: 0 }, { scale: 1, rotation: -12, opacity: 1, duration: 0.2, ease: 'power4.in' }, T.race + 0.5)
    .fromTo($('.k-nar-a', race), { scale: 0, rotation: -8 }, { scale: 1, rotation: -3, duration: 0.25, ease: 'back.out(3)' }, T.race + 0.9)
    .fromTo($('.k-nar-b', race), { scale: 0, rotation: 8 }, { scale: 1, rotation: 2, duration: 0.25, ease: 'back.out(3)' }, T.race + 1.4)
    .fromTo($('.k-dash', race), { scale: 0, rotation: -20 }, { scale: 1, rotation: -8, duration: 0.2, ease: 'back.out(3)' }, T.race + 2.0)
    .fromTo($('.k-rlabel', race), { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power3.out' }, T.race + 2.3)
    // 停格：反白一閃 + PHOTO FINISH
    .set(panes, { filter: 'invert(1) contrast(1.4)' }, freezeAt)
    .set(panes, { filter: 'none' }, freezeAt + 0.08)
    .set(panes, { filter: 'invert(1) contrast(1.4)' }, freezeAt + 0.16)
    .set(panes, { filter: 'grayscale(1) contrast(1.3)' }, freezeAt + 0.24)
    .fromTo($('.k-pf', race), { scale: 0, rotation: -30 }, { scale: 1, rotation: -6, duration: 0.25, ease: 'back.out(2.5)' }, freezeAt + 0.05);
  shake(T.race + 0.7, 16);
  shake(freezeAt, 20, 0.4);
  stars(freezeAt + 0.06, 640, 360, { n: 50, speed: 1300 });
  slashAt(T.end);

  /* ---------- 註冊 32–40 ---------- */

  const end = S('ks-end');
  show(end, T.end);
  tl.set(bg, { background: '#f3f3ef' }, T.end)
    .fromTo($('.k-slashbg', end), { xPercent: -100 }, { xPercent: 0, duration: 0.3, ease: 'expo.out' }, T.end + 0.05)
    .fromTo($$('.k-mark span', end), { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.24, stagger: 0.05, ease: 'steps(5)' }, T.end + 0.2)
    .fromTo($('.k-tagline', end), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.4, ease: 'steps(12)' }, T.end + 0.7);
  punch(T.end + 0.45, 1.06);
  $$('.k-stk', end).forEach((st, i) => {
    const [, x, y, h, r] = LINEUP[i];
    const at = T.end + 0.9 + i * 0.13;
    tl.fromTo(st, { scale: 0, rotation: r - 30, y: 80 }, { scale: 1, rotation: r, y: 0, duration: 0.3, ease: 'back.out(2.2)' }, at);
    stars(at + 0.05, x, y - h * 0.6, { n: 14, speed: 600 });
  });
  shake(T.end + 1.8, 10);
  tl.fromTo($('.k-cta', end), { scale: 0, rotation: -10 }, { scale: 1, rotation: -3, duration: 0.3, ease: 'back.out(3)' }, T.end + 2.0)
    .fromTo($('.k-cta em', end), { scale: 0, rotation: 30 }, { scale: 1, rotation: 12, duration: 0.25, ease: 'back.out(3)' }, T.end + 2.3)
    .fromTo($('.k-18', end), { opacity: 0 }, { opacity: 1, duration: 0.3 }, T.end + 2.4)
    .to($('.k-cta', end), { scale: 1.06, duration: 0.4, yoyo: true, repeat: 11, ease: 'sine.inOut' }, T.end + 2.8)
    .fromTo($('.k-cta i', end), { '--sx': '160%' }, { '--sx': '-60%', duration: 0.8, ease: 'power2.inOut', repeat: 2, repeatDelay: 1.2 }, T.end + 2.8);
  confetti(T.end + 2.05, 1060, 180);
  tl.set(cursor, { autoAlpha: 1, x: 1240, y: 520 }, T.end + 2.8);
  moveCursor(T.end + 2.9, 1070, 170, 0.6);
  click(T.end + 3.6, 1070, 170);
  tl.to($('.k-cta', end), { scale: 0.92, duration: 0.08, yoyo: true, repeat: 1 }, T.end + 3.6);
  confetti(T.end + 3.65, 1060, 190, { n: 40 });
  click(T.end + 5.8, 1070, 170);
  tl.set({}, {}, END);

  /* ---------- 每次時間變動：雜訊、HUD、影片畫面、角色抖動、粒子 ---------- */

  const fx = $('.k-fx', mg);
  const ctx = fx.getContext('2d');
  const noiseCtx = [staticEl, ...$$('.k-noise', mg)].map(c => c.getContext('2d'));
  const noise = noiseCtx[0].createImageData(160, 90);
  const hudCh = $('.h-chn', mg);
  const hudTc = $('.h-tc', mg);
  const hudRec = $('.h-rec i', mg);
  const trioCtx = $$('.k-trio', mg).map(c => ({ c: c.getContext('2d'), seg: TRIO[+c.dataset.seg] }));
  const paneCtx = panes.map(c => c.getContext('2d'));
  const boils = $$('.boil', mg);

  const STAR = {};
  const starSprite = color => STAR[color] || (STAR[color] = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.translate(32, 32);
    g.fillStyle = color;
    g.strokeStyle = color === '#111' ? '#d7ff1f' : '#111';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, -29);
    g.quadraticCurveTo(0, 0, 29, 0);
    g.quadraticCurveTo(0, 0, 0, 29);
    g.quadraticCurveTo(0, 0, -29, 0);
    g.quadraticCurveTo(0, 0, 0, -29);
    g.fill();
    g.stroke();
    return c;
  })());

  function drawNoise(t) {
    const tvOn = t >= T.tv - 0.2 && t < T.race;
    if (G.getProperty(staticEl, 'opacity') < 0.01 && !tvOn) return;
    // 雜訊每秒換 15 次，比每格都換更像舊電視
    let s = (Math.floor(t * 15) * 9301 + 49297) % 233280;
    const d = noise.data;
    for (let i = 0; i < d.length; i += 4) {
      s = (s * 9301 + 49297) % 233280;
      d[i] = d[i + 1] = d[i + 2] = (s / 233280) * 255;
      d[i + 3] = 255;
    }
    noiseCtx.forEach(c => c.putImageData(noise, 0, 0));
  }

  function drawHud(t) {
    let ch = 1;
    CH.forEach(([at, n]) => { if (t >= at) ch = n; });
    const chText = `CH ${String(ch).padStart(2, '0')}`;
    if (hudCh.textContent !== chText) hudCh.textContent = chText;
    const f = Math.floor(t * 30);
    const tc = `00:00:${String(Math.floor(f / 30)).padStart(2, '0')}:${String(f % 30).padStart(2, '0')}`;
    if (hudTc.textContent !== tc) hudTc.textContent = tc;
    hudRec.style.opacity = Math.floor(t * 2) % 2 ? '0.2' : '1';
  }

  function drawVideos(t) {
    if (t >= T.tv - 1 && t < T.race && trioVideo.readyState >= 2) {
      trioCtx.forEach(({ c, seg: [sx, sw] }) => c.drawImage(trioVideo, sx, 0, sw, 640, 0, 0, sw, 640));
    }
    if (t >= T.race - 1 && t < T.end && raceVideo.readyState >= 2) {
      PANES.forEach((p, i) => {
        const [sx, sy, sw, sh] = p.src;
        paneCtx[i].drawImage(raceVideo, sx, sy, sw, sh, 0, 0, p.w, p.h);
      });
    }
  }
  [trioVideo, raceVideo].forEach(v => ['loadeddata', 'seeked'].forEach(type => v.addEventListener(type, () => drawVideos(tl.time()))));

  // 角色逐格抖動（每秒 12 次、1–2px），像手繪動畫的線條在「呼吸」
  function drawBoil(t) {
    const f = Math.floor(t * 12);
    boils.forEach((el, i) => {
      el.style.translate = `${((rnd(f, i) - 0.5) * 3).toFixed(1)}px ${((rnd(f, i + 50) - 0.5) * 3).toFixed(1)}px`;
    });
  }

  function drawFx(t) {
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, 1280, 720);
    BURSTS.forEach(b => {
      const dt = t - b.t;
      if (dt < 0 || dt > b.life) return;
      const k = 2.6;
      const fade = 1 - dt / b.life;
      for (let i = 0; i < b.n; i++) {
        const s = b.seed + i;
        const ang = rnd(s, 1) * Math.PI * 2;
        const sp = b.speed * (0.3 + 0.7 * rnd(s, 2));
        const d = sp / k * (1 - Math.exp(-k * dt));
        const x = b.x + Math.cos(ang) * d;
        const y = b.y + Math.sin(ang) * d + 0.5 * b.grav * dt * dt;
        const color = b.colors[i % b.colors.length];
        ctx.globalAlpha = Math.min(1, fade * 1.6);
        if (b.kind === 'star') {
          const sz = (16 + 26 * rnd(s, 3)) * (0.4 + 0.6 * fade);
          ctx.drawImage(starSprite(color), x - sz / 2, y - sz / 2, sz, sz);
        } else {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(dt * (4 + 8 * rnd(s, 4)));
          ctx.scale(1, Math.cos(dt * 10 + s));
          ctx.fillStyle = color;
          ctx.fillRect(-8, -4, 16, 8);
          ctx.restore();
        }
      }
    });
    ctx.globalAlpha = 1;
  }

  function onTick(t) {
    drawNoise(t);
    drawHud(t);
    drawVideos(t);
    drawBoil(t);
    drawFx(t);
  }

  /* ---------- 播放器（js/mg-player.js） ---------- */

  new MGPlayer({ root, tl, chapters: CHAPTERS, end: END, videos: VIDEOS, onTick });
})();
