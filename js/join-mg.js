/* =========================================================
   推廣動畫（join.html）
   開場 → 熱門遊戲 → 活動 → 站點特色 → 極速充提 → 立即註冊
   - 一條 GSAP 時間軸跑完全部分鏡；實機影片、數字、粒子、遊戲環都只依時間計算，
     暫停、跳段落、拖回去重看都一致
   - 活動、特色、充提、註冊步驟的文字來自 js/site.js
   ========================================================= */
(() => {
  const G = window.gsap;
  const site = window.SITE || {};
  const games = window.AFF_GAMES || [];
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const root = $('.tr-player');
  const mg = root && $('.mg', root);
  if (!mg) return;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const chars = text => [...String(text)].map(c => (c === ' ' ? ' ' : `<span>${esc(c)}</span>`)).join('');
  const video = src => `<video src="assets/clips/${src}.mp4" muted playsinline preload="auto"></video>`;

  const BRAND = site.brand || 'FAYI';
  const events = (site.events || []).slice(0, 3);
  const features = (site.features || []).slice(0, 4);
  const pay = (site.pay || []).slice(0, 2);
  const steps = (site.steps || []).slice(0, 3);
  const covers = games.map(g => g.img);
  const gameCount = Math.max(10, Math.floor(games.length / 10) * 10);

  const ICONS = {
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    games: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M8.5 9v6M12 9v6M15.5 9v6"/>',
    support: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.6-2 2.5-5 2.5"/>',
    shield: '<path d="M12 2.5l8 3v6c0 5-3.5 8.6-8 10-4.5-1.4-8-5-8-10v-6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8C10 4 6 4 6 6.5S9 8 12 8zm0 0c2-4 6-4 6-1.5S15 8 12 8z"/>',
    bolt: '<path d="M13 2L4.5 14H11l-1 8 8.5-12H12z"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.bolt}</svg>`;

  /* ---------- 素材與版面資料 ---------- */

  // 快剪：每 1 秒一個字，背後是實機畫面（from 是影片內的秒數）
  const CUTS = [
    { at: 3, word: '老虎機', en: 'SLOTS', src: 'superace-free', from: 7.7, c: '#ffb81c' },
    { at: 4, word: '賽馬', en: 'RACING', src: 'race-start', from: 2.6, c: '#12e0a0' },
    { at: 5, word: '消除', en: 'CASCADE', src: 'mw2-chain', from: 0.3, c: '#ff3b52' },
    { at: 6, word: '倍數', en: 'MULTIPLIER', src: 'pinata-chain', from: 4.1, c: '#26d4ff' },
    { at: 7, word: '免費遊戲', en: 'FREE GAMES', src: 'superace-trigger', from: 7.95, c: '#9dff3c' },
  ];

  // 三支手機同時播實機畫面。瀏覽器同時播兩支以上影片會掉到 30fps，
  // 所以三段先合成一支並排的影片（join-trio.mp4），每支手機用 canvas 畫自己那一段（sx、sw）。
  // pop 是畫面裡倍數亮起的時間點
  const TRIO_SRC = 'join-trio';
  const TRIO = [
    { name: '麻將胡了2', prov: 'PG SOFT', sx: 0, sw: 470, w: 300, h: 408, cx: 290, top: 170, ry: 22, pop: '×2', popAt: 13.2, c: '#ffd24a' },
    { name: '超級王牌', prov: 'JILI', sx: 470, sw: 444, w: 330, h: 477, cx: 640, top: 128, ry: 0, pop: '×10', popAt: 13.7, c: '#ff4d6d' },
    { name: 'Piñata Wins', prov: 'PG SOFT', sx: 914, sw: 548, w: 350, h: 408, cx: 990, top: 170, ry: -22, pop: '×2', popAt: 14.3, c: '#ff4fd8' },
  ];

  const WALL_COLS = 7;
  const WALL_ROWS = 4;
  const wallTiles = Array.from({ length: WALL_COLS * WALL_ROWS }, (_, k) =>
    `<i style="left:${(k % WALL_COLS) * 194}px;top:${Math.floor(k / WALL_COLS) * 194}px;background-image:url(${covers[(k * 3) % covers.length]})"></i>`).join('');
  const RING_N = Math.min(12, covers.length);
  const ringTiles = covers.slice(0, RING_N).map(src => `<i style="background-image:url(${src})"></i>`).join('');

  const evX = [250, 640, 1030];
  const ftX = [175, 485, 795, 1105];
  const payX = pay.length === 1 ? [640] : [400, 880];
  const R = 150;
  const C = 2 * Math.PI * R;

  /* ---------- 分鏡 ---------- */

  mg.classList.add('pm');
  mg.innerHTML = `
  <div class="mg-cam">
    <div class="p-bg"></div>
    <div class="p-rays"></div>
    <div class="p-tunnel"></div>

    <section class="sc ps-intro">
      <div class="p-grp">
        <i class="p-streak l"></i><i class="p-streak r"></i>
        <i class="p-shock"></i><i class="p-shock"></i>
        <h2 class="p-logo chars">${chars(BRAND)}</h2>
        <p class="p-slogan chars">${chars(site.slogan || '熱門遊戲，一站玩遍')}</p>
        <p class="p-slogan-en">HOT GAMES · ALL IN ONE</p>
      </div>
    </section>

    ${CUTS.map(c => `
    <section class="sc ps-cut" style="--c:${c.c}">
      ${video(c.src)}
      <div class="p-tint"></div>
      <b class="p-word">${esc(c.word)}</b>
      <span class="p-word-en">${c.en}</span>
    </section>`).join('')}

    <section class="sc ps-wall">
      <div class="p-wall">${wallTiles}<i class="p-glint"></i></div>
      <div class="p-scrim"></div>
      <div class="p-count"><b><span class="p-n p-gold">0</span><sup class="p-gold">+</sup></b><span>款熱門遊戲</span></div>
      <div class="p-provs"><span>PG SOFT</span><span>JILI</span><span>原創賽馬</span></div>
    </section>

    <section class="sc ps-trio">
      ${video(TRIO_SRC)}
      <h3 class="p-trio-h"><em>實機</em>畫面・倍數狂飆</h3>
      ${TRIO.map(p => `
      <div class="p-ph" style="--c:${p.c};width:${p.w}px;height:${p.h}px;left:${p.cx - p.w / 2}px;top:${p.top}px">
        <i class="p-ph-edge"></i><div class="p-ph-scr"><canvas width="${p.sw}" height="640"></canvas></div>
      </div>
      <p class="p-ph-name" style="--c:${p.c};left:${p.cx - 160}px;top:${p.top + p.h + 16}px"><span>${p.prov}</span>${esc(p.name)}</p>
      <b class="p-pop" style="--c:${p.c};left:${p.cx - 120}px;top:${p.top - 20}px">${p.pop}</b>`).join('')}
    </section>

    <section class="sc ps-events">
      <h3 class="p-ev-h"><span class="chars">${chars('限時活動')}</span></h3>
      <p class="p-ev-en">HOT EVENTS</p>
      ${events.map((e, i) => `
      <div class="p-card" style="left:${evX[i] - 170}px">
        <i class="p-card-shine"></i>
        <div class="p-card-ic">${icon('gift')}</div>
        <span class="p-card-tag">${esc(e.tag)}</span>
        <b class="p-card-t">${esc(e.title)}</b>
        <p class="p-card-d">${esc(e.desc)}</p>
      </div>`).join('')}
      <p class="p-ev-note">註冊就能參加・活動內容以站內公告為準</p>
    </section>

    <section class="sc ps-feat">
      <div class="p-floor"></div>
      <h3 class="p-ft-h">為什麼選 <span class="p-gold">${esc(BRAND)}</span>？</h3>
      <i class="p-beam"></i>
      ${features.map((f, i) => `
      <div class="p-ft" style="left:${ftX[i] - 140}px">
        <div class="p-ft-ic"><i class="p-ft-ring"></i>${icon(f.icon)}</div>
        <b>${esc(f.title)}</b>
        <span>${esc(f.desc)}</span>
      </div>`).join('')}
    </section>

    <section class="sc ps-pay">
      <h3 class="p-pay-h"><span>極速充值</span>${icon('bolt')}<span>極速出款</span></h3>
      ${pay.map((p, i) => `
      <div class="p-meter" style="left:${payX[i] - 170}px">
        <svg viewBox="0 0 340 340"><circle class="trk" cx="170" cy="170" r="${R}"/><circle class="arc" cx="170" cy="170" r="${R}" transform="rotate(-90 170 170)"/></svg>
        <div class="p-meter-in"><span class="lbl">${esc(p.label)}</span><small>${esc(p.lead || '')}</small><b><em>${esc(p.value)}</em>${esc(p.unit)}</b></div>
        <span class="p-stamp">✓ ${i ? '已出款' : '已到帳'}</span>
        <p class="p-meter-note">${esc(p.note || '')}</p>
      </div>`).join('')}
    </section>

    <section class="sc ps-join">
      <div class="p-ring">${ringTiles}</div>
      <div class="p-join-glow"></div>
      <h2 class="p-jlogo chars">${chars(BRAND)}</h2>
      <p class="p-join-h">現在註冊，<em>馬上開玩</em></p>
      <ol class="p-steps">${steps.map((s, i) => `<li><b>${i + 1}</b>${esc(s)}</li>`).join('')}</ol>
      <div class="p-cta"><span>立即註冊</span><i></i></div>
      <i class="p-ripple"></i>
      <svg class="p-hand" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z"/></svg>
      <p class="p-join-note">18+ 請理性遊戲</p>
    </section>

    <div class="p-vig"></div>
    <canvas class="p-fx" width="1280" height="720"></canvas>
  </div>
  <div class="p-hud"><div class="p-hud-brand"><i></i>${esc(BRAND)}</div><div class="p-hud-live"><i></i>實機畫面</div></div>
  <div class="p-wipe"><i></i><i></i><i></i><i></i><i></i></div>
  <div class="p-flash"></div>`;

  const cam = $('.mg-cam', mg);
  const bg = $('.p-bg', mg);
  const rays = $('.p-rays', mg);
  const tunnel = $('.p-tunnel', mg);
  const flashEl = $('.p-flash', mg);
  const hudBrand = $('.p-hud-brand', mg);
  const hudLive = $('.p-hud-live', mg);

  /* 段落 */
  const T = { cuts: 3, wall: 8, trio: 12.5, events: 16.5, feat: 23, pay: 29, join: 35.5 };
  const END = 46;
  const CHAPTERS = [
    { at: 0, name: '開場', caption: `${BRAND}：${site.slogan || '熱門遊戲，一站玩遍'}。` },
    { at: T.cuts, name: '熱門遊戲', caption: `實機畫面：老虎機、賽馬、消除、倍數、免費遊戲，${gameCount} 款以上熱門遊戲。` },
    { at: T.events, name: '活動', caption: `限時活動：${events.map(e => `${e.title}（${e.desc}）`).join('、')}。` },
    { at: T.feat, name: '站點特色', caption: `站點特色：${features.map(f => f.title).join('、')}。` },
    { at: T.pay, name: '極速充提', caption: pay.map(p => `${p.label}${p.lead || ''} ${p.value} ${p.unit}`).join('，') + '。' },
    { at: T.join, name: '立即註冊', caption: `現在註冊，馬上開玩：${steps.join(' → ')}。` },
  ];

  /* 實機影片：start~end 之間播放，from 是影片內的起點 */
  const cutVideos = $$('.ps-cut video', mg);
  const trioVideo = $('.ps-trio > video', mg);
  const trioCanvases = $$('.ps-trio canvas', mg).map(c => c.getContext('2d'));
  const VIDEOS = [
    ...CUTS.map((c, i) => ({ el: cutVideos[i], start: c.at, end: c.at + 1, from: c.from })),
    { el: trioVideo, start: T.trio, end: T.events, from: 0 },
  ];

  if (!G || !window.MGPlayer) {
    $('.ps-join', mg).style.visibility = 'visible';
    return;
  }

  /* ---------- 時間軸工具 ---------- */

  const tl = G.timeline({ paused: true });
  const show = (el, at, until) => {
    tl.set(el, { autoAlpha: 1 }, at);
    if (until != null) tl.set(el, { autoAlpha: 0 }, until);
  };
  const setBg = (at, css) => tl.set(bg, { background: css }, at);
  const setRays = (at, color, opacity) => tl.set(rays, { '--rc': color, opacity }, at);
  const flash = (at, { o = 1, c = '#fff', d = 0.45 } = {}) =>
    tl.set(flashEl, { opacity: o, background: c }, at).to(flashEl, { opacity: 0, duration: d, ease: 'power2.out' }, at);
  const punch = (at, s = 1.06, d = 0.45) =>
    tl.fromTo(cam, { scale: s }, { scale: 1, duration: d, ease: 'expo.out', immediateRender: false }, at);
  const shake = (at, a = 14, d = 0.35) =>
    tl.to(cam, { keyframes: { x: [0, -a, a * 0.8, -a * 0.5, a * 0.25, 0], y: [0, a * 0.5, -a * 0.6, a * 0.35, -a * 0.15, 0] }, duration: d, ease: 'none' }, at);
  // 金屬字、卡片、按鈕上的反光掃過（CSS 變數 --sx 控制反光位置）
  const shine = (el, at, d = 0.8, stagger = 0) =>
    tl.fromTo(el, { '--sx': '160%' }, { '--sx': '-60%', duration: d, stagger, ease: 'power2.inOut', immediateRender: false }, at);

  const wipe = $$('.p-wipe i', mg);
  G.set(wipe, { left: i => -260 + i * 330, width: 420, skewX: -18, scaleX: 0 });
  // 斜條轉場：at 時畫面剛好蓋滿，可以在那一刻換場景
  const wipeAt = (at, colors) => {
    tl.set(wipe, { transformOrigin: '0% 50%', background: i => colors[i % colors.length] }, at - 0.5)
      .to(wipe, { scaleX: 1, duration: 0.32, stagger: 0.04, ease: 'power3.in' }, at - 0.48)
      .set(wipe, { transformOrigin: '100% 50%' }, at)
      .to(wipe, { scaleX: 0, duration: 0.38, stagger: 0.04, ease: 'power3.out' }, at + 0.02);
  };

  /* ---------- 粒子：位置只由時間決定 ---------- */

  const BURSTS = [];
  const RAINS = [];
  const COUNTERS = [];
  const burst = (t, x, y, o = {}) =>
    BURSTS.push({ t, x, y, n: 70, coin: false, color: '#ffd24a', speed: 900, life: 1.3, grav: 500, size: 1, seed: BURSTS.length * 131 + 7, ...o });
  const coins = (t, x, y, o = {}) => burst(t, x, y, { coin: true, n: 36, speed: 1100, grav: 1100, life: 1.8, ...o });
  const rain = (t0, t1, o = {}) => RAINS.push({ t0, t1, rate: 24, seed: RAINS.length * 211 + 3, ...o });
  const counter = (el, at, dur, to) => COUNTERS.push({ el, at, dur, to, last: null });

  // 每一段的背景光點顏色
  const EMBERS = [
    { at: 0, c: '#ffd24a', n: 0 },
    { at: 0.75, c: '#ffd24a', n: 40 },
    { at: T.cuts, c: '#ffffff', n: 0 },
    { at: T.wall, c: '#b98cff', n: 36 },
    { at: T.trio, c: '#ff7ad9', n: 40 },
    { at: T.events, c: '#ffcf4a', n: 46 },
    { at: T.feat, c: '#38e6ff', n: 40 },
    { at: T.pay, c: '#5df5c2', n: 30 },
    { at: T.join, c: '#ffd24a', n: 50 },
  ];

  /* ---------- 開場 0–3 ---------- */

  const intro = $('.ps-intro', mg);
  show(intro, 0, T.cuts);
  setBg(0, '#000');
  setRays(0, 'rgba(255, 196, 60, .16)', 0);
  tl.fromTo(rays, { rotation: 0 }, { rotation: 300, duration: END, ease: 'none', immediateRender: false }, 0)
    .fromTo($('.p-streak.l', intro), { scaleX: 0 }, { scaleX: 1, duration: 0.65, ease: 'power3.in' }, 0.1)
    .fromTo($('.p-streak.r', intro), { scaleX: 0 }, { scaleX: 1, duration: 0.65, ease: 'power3.in' }, 0.1)
    .set($$('.p-streak', intro), { opacity: 0 }, 0.76);
  flash(0.75, { d: 0.6 });
  setBg(0.75, 'radial-gradient(900px 620px at 50% 45%, #3a1266, #0c0418 72%)');
  setRays(0.75, 'rgba(255, 196, 60, .2)', 1);
  tl.to(rays, { opacity: 0.55, duration: 2, ease: 'power2.out' }, 0.8)
    .fromTo($$('.p-shock', intro), { scale: 0.1, opacity: 1 }, { scale: 3.4, opacity: 0, duration: 0.8, stagger: 0.14, ease: 'power2.out' }, 0.75)
    .fromTo($$('.p-logo span', intro), { opacity: 0, scale: 3.2 }, { opacity: 1, scale: 1, duration: 0.32, stagger: 0.05, ease: 'power4.out' }, 0.76);
  shake(0.95, 18);
  burst(0.78, 640, 290, { n: 110, speed: 1300, life: 1.4 });
  coins(0.8, 640, 290, { n: 40 });
  tl.fromTo($$('.p-slogan span', intro), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: 'back.out(2.5)' }, 1.3)
    .fromTo($('.p-slogan-en', intro), { opacity: 0, letterSpacing: '1.4em' }, { opacity: 1, letterSpacing: '0.6em', duration: 0.8, ease: 'power3.out' }, 1.6);
  shine($$('.p-logo span', intro), 1.7, 0.6, 0.06);
  tl.to($('.p-grp', intro), { scale: 3.5, opacity: 0, duration: 0.45, ease: 'power3.in' }, 2.55);

  /* ---------- ① 熱門遊戲：快剪 3–8 ---------- */

  tl.set(hudBrand, { autoAlpha: 1 }, T.cuts).set(hudBrand, { autoAlpha: 0 }, T.join)
    .set(hudLive, { autoAlpha: 1 }, T.cuts).set(hudLive, { autoAlpha: 0 }, T.wall)
    .set(hudLive, { autoAlpha: 1 }, T.trio).set(hudLive, { autoAlpha: 0 }, T.events);
  setRays(T.cuts, 'rgba(255, 255, 255, .1)', 0);
  $$('.ps-cut', mg).forEach((sc, i) => {
    const A = CUTS[i].at;
    const word = $('.p-word', sc);
    show(sc, A, A + 1);
    flash(A, { o: i ? 0.75 : 1, d: i ? 0.22 : 0.4 });
    tl.fromTo($('video', sc), { scale: 1.35 }, { scale: 1.06, duration: 1, ease: 'power2.out' }, A)
      .fromTo(word, { opacity: 0, scale: 1.8, skewX: -20 }, { opacity: 1, scale: 1, skewX: -6, duration: 0.2, ease: 'power4.out' }, A + 0.04)
      .fromTo(word, { '--ca': '18px' }, { '--ca': '3px', duration: 0.45, ease: 'power2.out' }, A + 0.04)
      .to(word, { scale: 1.1, duration: 0.76, ease: 'none' }, A + 0.24)
      .fromTo($('.p-word-en', sc), { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 0.25, ease: 'power3.out' }, A + 0.14);
    punch(A + 0.5, 1.05, 0.4);
    burst(A + 0.06, 640, 330, { n: 40, color: CUTS[i].c, speed: 1400, life: 0.9, grav: 0 });
  });

  /* ---------- ① 熱門遊戲：遊戲牆 8–12.5 ---------- */

  const wallSc = $('.ps-wall', mg);
  const wall = $('.p-wall', wallSc);
  show(wallSc, T.wall, T.trio);
  flash(T.wall, { d: 0.5 });
  setBg(T.wall, 'radial-gradient(900px 620px at 50% 50%, #2a1260, #06020f 75%)');
  setRays(T.wall, 'rgba(185, 140, 255, .12)', 0.6);
  tl.fromTo(wall, { rotationX: 24, rotationY: -28, rotationZ: -8, x: 140, z: -220 }, { rotationY: -14, x: -110, z: 0, duration: 3.95, ease: 'none' }, T.wall)
    .fromTo($$('i:not(.p-glint)', wall), { opacity: 0, rotationY: -110, z: -500 }, { opacity: 1, rotationY: 0, z: 0, duration: 0.6, ease: 'back.out(1.4)', stagger: { each: 0.025, from: 'center', grid: [WALL_ROWS, WALL_COLS] } }, T.wall)
    .fromTo($('.p-glint', wall), { xPercent: -120 }, { xPercent: 120, duration: 1, ease: 'power1.inOut' }, 9.0)
    .fromTo($('.p-scrim', wallSc), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 9.0)
    .fromTo($('.p-count b', wallSc), { opacity: 0, scale: 2.4 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power4.out' }, 9.05)
    .fromTo($('.p-count sup', wallSc), { opacity: 0, scale: 0, rotation: -90 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.4, ease: 'back.out(3)' }, 9.8)
    .fromTo($('.p-count > span', wallSc), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, 9.9)
    .fromTo($$('.p-provs span', wallSc), { opacity: 0, y: 40, scale: 0.6 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, stagger: 0.12, ease: 'back.out(2.5)' }, 10.4);
  counter($('.p-n', wallSc), 9.1, 0.7, gameCount);
  shake(9.8, 12);
  burst(9.82, 790, 250, { n: 80, speed: 1100 });
  shine($$('.p-count .p-gold', wallSc), 10.6, 0.7, 0.1);
  tl.to([$('.p-count', wallSc), $('.p-provs', wallSc)], { opacity: 0, scale: 1.25, duration: 0.3, ease: 'power2.in' }, 11.8)
    .to(wall, { z: 750, rotationY: 0, rotationX: 0, rotationZ: 0, opacity: 0, duration: 0.55, ease: 'power3.in' }, 11.95);

  /* ---------- ① 熱門遊戲：三款實機 12.5–16.5 ---------- */

  const trio = $('.ps-trio', mg);
  show(trio, T.trio, T.events);
  flash(T.trio, { d: 0.45 });
  setBg(T.trio, 'radial-gradient(1000px 640px at 50% 60%, #5a0f58, #0d0214 75%)');
  setRays(T.trio, 'rgba(255, 110, 220, .14)', 0.8);
  const phones = $$('.p-ph', trio);
  tl.fromTo($('.p-trio-h', trio), { opacity: 0, y: -60 }, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2)' }, T.trio + 0.15);
  TRIO.forEach((p, i) => {
    const ph = phones[i];
    const order = [1, 0, 2][i];
    tl.fromTo(ph, { opacity: 0, y: 520, rotationX: 50, rotationY: p.ry * 2, scale: 0.7 }, { opacity: 1, y: 0, rotationX: 0, rotationY: p.ry, scale: 1, duration: 0.65, ease: 'expo.out', transformPerspective: 1100 }, T.trio + order * 0.12)
      .fromTo($('.p-ph-edge', ph), { rotation: 0 }, { rotation: 540, duration: 4, ease: 'none' }, T.trio)
      .to(ph, { y: i === 1 ? -12 : -8, duration: 1.2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, T.trio + 1.0)
      .fromTo($$('.p-ph-name', trio)[i], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, T.trio + 0.6 + order * 0.1)
      .fromTo($$('.p-pop', trio)[i], { opacity: 0, scale: 0, rotation: -25 }, { opacity: 1, scale: 1, rotation: -8, duration: 0.4, ease: 'back.out(3)' }, p.popAt)
      .to($$('.p-pop', trio)[i], { scale: 1.12, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 3 }, p.popAt + 0.45);
    burst(p.popAt + 0.02, p.cx, p.top + 20, { n: 60, color: p.c, speed: 1000 });
    punch(p.popAt, 1.04, 0.35);
  });
  shake(T.trio + 0.3, 10);
  tl.to(phones, { y: 80, opacity: 0, scale: 0.85, duration: 0.35, stagger: 0.05, ease: 'power2.in' }, 15.95)
    .to($$('.p-trio-h, .p-ph-name, .p-pop', trio), { opacity: 0, duration: 0.25 }, 15.95);
  wipeAt(T.events, ['#ffcf4a', '#ff3b52', '#fff4d0', '#b3001e', '#ffcf4a']);

  /* ---------- ② 活動 16.5–23 ---------- */

  const evSc = $('.ps-events', mg);
  const cards = $$('.p-card', evSc);
  show(evSc, T.events, T.feat);
  setBg(T.events, 'radial-gradient(1000px 640px at 50% 40%, #7a1020, #1a0306 75%)');
  setRays(T.events, 'rgba(255, 200, 70, .2)', 0.9);
  tl.fromTo($$('.p-ev-h span span', evSc), { opacity: 0, y: -160, scale: 1.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, stagger: 0.07, ease: 'back.out(2)' }, T.events + 0.1)
    .fromTo($('.p-ev-en', evSc), { opacity: 0, letterSpacing: '1.2em' }, { opacity: 1, letterSpacing: '.5em', duration: 0.7, ease: 'power3.out' }, T.events + 0.45);
  shake(T.events + 0.4, 12);
  coins(T.events + 0.35, 640, 120, { n: 50 });
  shine($$('.p-ev-h span span', evSc), T.events + 0.9, 0.6, 0.07);
  cards.forEach((card, i) => {
    const at = T.events + 0.7 + i * 0.22;
    tl.fromTo(card, { opacity: 0, x: 640 - evX[i], y: 200, rotationY: -120, rotationZ: (i - 1) * 25, scale: 0.5 }, { opacity: 1, x: 0, y: 0, rotationY: 0, rotationZ: (i - 1) * 3, scale: 1, duration: 0.75, ease: 'back.out(1.3)' }, at)
      .fromTo($('.p-card-ic', card), { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(3)' }, at + 0.45)
      .to($('.p-card-ic', card), { y: -10, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: 5 }, at + 1);
    coins(at + 0.55, evX[i], 250, { n: 18, speed: 800 });
    // 依序點亮每張卡
    const hi = T.events + 2.4 + i * 1.1;
    tl.to(card, { scale: 1.08, duration: 0.3, ease: 'back.out(3)' }, hi)
      .to(card, { scale: 1, duration: 0.4, ease: 'power2.inOut' }, hi + 0.8);
    shine(card, hi, 0.7);
    burst(hi + 0.05, evX[i], 400, { n: 50, speed: 800 });
  });
  tl.fromTo($('.p-ev-note', evSc), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, T.events + 2.0)
    .to(cards, { y: -120, opacity: 0, duration: 0.35, stagger: 0.06, ease: 'power2.in' }, 22.2)
    .to($$('.p-ev-h, .p-ev-en, .p-ev-note', evSc), { opacity: 0, duration: 0.3 }, 22.3);
  rain(T.events + 0.4, 22.2, { rate: 10 });
  wipeAt(T.feat, ['#38e6ff', '#0a3a52', '#dffaff', '#1478ff', '#38e6ff']);

  /* ---------- ③ 站點特色 23–29 ---------- */

  const ftSc = $('.ps-feat', mg);
  const fts = $$('.p-ft', ftSc);
  show(ftSc, T.feat, T.pay);
  setBg(T.feat, 'radial-gradient(1000px 640px at 50% 30%, #0b4254, #02090d 75%)');
  setRays(T.feat, 'rgba(56, 230, 255, .1)', 0.6);
  tl.fromTo($('.p-floor', ftSc), { backgroundPositionY: '0px' }, { backgroundPositionY: '480px', duration: 6, ease: 'none' }, T.feat)
    .fromTo($('.p-ft-h', ftSc), { opacity: 0, scale: 1.6, '--ca': '14px' }, { opacity: 1, scale: 1, '--ca': '2px', duration: 0.4, ease: 'power4.out' }, T.feat + 0.15);
  punch(T.feat + 0.2);
  shine($('.p-ft-h .p-gold', ftSc), T.feat + 0.8);
  fts.forEach((ft, i) => {
    const at = T.feat + 0.6 + i * 0.3;
    tl.fromTo($('.p-ft-ic', ft), { opacity: 0, scale: 0, rotation: -120 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2.4)' }, at)
      .fromTo($('.p-ft-ring', ft), { rotation: 0 }, { rotation: 720, duration: 5.4, ease: 'none' }, T.feat)
      .fromTo($$(':scope > b, :scope > span', ft), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.08, ease: 'power3.out' }, at + 0.2);
    burst(at + 0.1, ftX[i], 300, { n: 45, color: '#38e6ff', speed: 700, grav: 0, life: 1 });
    // 依序發光
    const hi = T.feat + 2.6 + i * 0.5;
    tl.to($('.p-ft-ic', ft), { scale: 1.15, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 }, hi);
  });
  tl.fromTo($('.p-beam', ftSc), { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.8, ease: 'power3.inOut' }, T.feat + 1.9)
    .to($$('.p-ft, .p-ft-h, .p-beam', ftSc), { opacity: 0, scale: 0.8, duration: 0.3, stagger: 0.04, ease: 'power2.in' }, 28.4);

  /* ---------- ④ 極速充提 29–35.5 ---------- */

  const paySc = $('.ps-pay', mg);
  const meters = $$('.p-meter', paySc);
  show(paySc, T.pay, T.join);
  flash(T.pay, { c: '#dfffee', d: 0.4 });
  setBg(T.pay, 'radial-gradient(900px 620px at 50% 55%, #0a4a33, #010805 75%)');
  setRays(T.pay, 'rgba(93, 245, 194, .1)', 0.4);
  tl.set(tunnel, { opacity: 0 }, 0)
    .fromTo(tunnel, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1.4, duration: 6.5, ease: 'power1.in', immediateRender: false }, T.pay)
    .fromTo(tunnel, { rotation: 0 }, { rotation: 40, duration: 6.5, ease: 'none', immediateRender: false }, T.pay)
    .set(tunnel, { opacity: 0 }, T.join)
    .fromTo($$('.p-pay-h > *', paySc), { opacity: 0, x: -500, skewX: -30 }, { opacity: 1, x: 0, skewX: -8, duration: 0.4, stagger: 0.12, ease: 'expo.out' }, T.pay + 0.05);
  shake(T.pay + 0.35, 12);
  pay.forEach((p, i) => {
    const m = meters[i];
    const at = T.pay + 0.7 + i * 1.3;
    const arc = $('.arc', m);
    tl.fromTo(m, { opacity: 0, scale: 0.4, rotation: -30 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2)' }, T.pay + 0.4 + i * 0.15)
      .fromTo(arc, { strokeDasharray: `0 ${C}` }, { strokeDasharray: `${C} 0`, duration: 0.9, ease: 'power4.inOut' }, at)
      .fromTo($('.p-meter-in b', m), { opacity: 0, scale: 2.6 }, { opacity: 1, scale: 1, duration: 0.28, ease: 'power4.out' }, at + 0.9)
      .fromTo($$('.p-meter-in .lbl, .p-meter-in small', m), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.06 }, at + 0.2)
      .fromTo($('.p-stamp', m), { opacity: 0, scale: 3, rotation: 10 }, { opacity: 1, scale: 1, rotation: -12, duration: 0.3, ease: 'power4.in' }, at + 1.05)
      .fromTo($('.p-meter-note', m), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35 }, at + 1.2)
      .to(m, { scale: 1.05, duration: 0.35, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 33.2 + i * 0.35);
    punch(at + 0.9, 1.05);
    shake(at + 1.35, 10);
    coins(at + 1.36, payX[i] + 110, 210, { n: 30 });
    burst(at + 0.92, payX[i], 360, { n: 70, color: '#5df5c2', speed: 1000, grav: 0 });
  });
  tl.to($$('.p-meter, .p-pay-h', paySc), { opacity: 0, scale: 1.3, duration: 0.35, ease: 'power2.in' }, 35.05);

  /* ---------- ⑤ 立即註冊 35.5–46 ---------- */

  const joinSc = $('.ps-join', mg);
  const ring = $('.p-ring', joinSc);
  const ringEls = $$('i', ring);
  const cta = $('.p-cta', joinSc);
  show(joinSc, T.join);
  flash(T.join, { c: '#fff3c4', d: 0.6 });
  setBg(T.join, 'radial-gradient(1000px 660px at 50% 40%, #4a1680, #0b0316 75%)');
  setRays(T.join, 'rgba(255, 200, 70, .2)', 1);
  tl.to(rays, { opacity: 0.6, duration: 2.5, ease: 'power2.out' }, T.join + 0.2)
    .fromTo($('.p-join-glow', joinSc), { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 1, ease: 'power3.out' }, T.join)
    .fromTo($$('.p-jlogo span', joinSc), { opacity: 0, y: -220, scale: 2 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.07, ease: 'back.out(1.8)' }, T.join + 0.3);
  shake(T.join + 0.75, 16);
  coins(T.join + 0.72, 640, 170, { n: 50 });
  shine($$('.p-jlogo span', joinSc), T.join + 1.3, 0.6, 0.06);
  tl.fromTo($('.p-join-h', joinSc), { opacity: 0, scale: 0.6, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(2.2)' }, T.join + 0.9)
    .fromTo($$('.p-steps li', joinSc), { opacity: 0, y: 30, scale: 0.7 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, stagger: 0.22, ease: 'back.out(2.5)' }, T.join + 1.4)
    .fromTo(cta, { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2.6)' }, T.join + 2.3)
    .fromTo($('.p-join-note', joinSc), { opacity: 0 }, { opacity: 1, duration: 0.4 }, T.join + 2.8);
  punch(T.join + 2.35, 1.06);
  burst(T.join + 2.4, 640, 520, { n: 90, speed: 1200 });
  tl.to(cta, { scale: 1.06, duration: 0.45, ease: 'sine.inOut', yoyo: true, repeat: 13 }, T.join + 3.0);
  [T.join + 3.0, T.join + 5.4, T.join + 7.8].forEach(at => shine(cta, at, 0.9));
  // 手指點按鈕
  const hand = $('.p-hand', joinSc);
  const ripple = $('.p-ripple', joinSc);
  [T.join + 3.6, T.join + 7.0].forEach(at => {
    tl.fromTo(hand, { opacity: 0, x: 240, y: 180 }, { opacity: 1, x: 0, y: 0, duration: 0.55, ease: 'power3.out', immediateRender: false }, at)
      .to(hand, { scale: 0.82, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.inOut' }, at + 0.6)
      .fromTo(ripple, { opacity: 1, scale: 0.3 }, { opacity: 0, scale: 2.4, duration: 0.7, ease: 'power2.out', immediateRender: false }, at + 0.68)
      .to(hand, { opacity: 0, x: 120, y: 120, duration: 0.4, ease: 'power2.in' }, at + 1.5);
    burst(at + 0.7, 640, 520, { n: 60, speed: 900 });
  });
  rain(T.join + 0.8, END, { rate: 9 });
  tl.set({}, {}, END);

  /* ---------- 每次時間變動：粒子、數字、遊戲環 ---------- */

  const fx = $('.p-fx', mg);
  const ctx = fx.getContext('2d');
  const rnd = (i, n) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  const sprite = draw => { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); return c; };
  const COIN = sprite(g => {
    const r = g.createRadialGradient(24, 22, 2, 32, 32, 30);
    r.addColorStop(0, '#fff7cc');
    r.addColorStop(0.35, '#ffd54a');
    r.addColorStop(0.8, '#e08600');
    r.addColorStop(1, '#8a4600');
    g.fillStyle = r;
    g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255, 244, 190, .85)';
    g.lineWidth = 3;
    g.beginPath(); g.arc(32, 32, 21, 0, Math.PI * 2); g.stroke();
  });
  const GLOW = {};
  const glow = color => GLOW[color] || (GLOW[color] = sprite(g => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, '#fff');
    r.addColorStop(0.2, color);
    r.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }));

  function drawCoin(x, y, size, flip, rot, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(Math.max(0.1, Math.abs(Math.cos(flip))), 1);
    ctx.drawImage(COIN, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function drawBurst(b, t) {
    const dt = t - b.t;
    if (dt < 0 || dt > b.life) return;
    const k = 2.4;
    const fade = 1 - dt / b.life;
    for (let i = 0; i < b.n; i++) {
      const s = b.seed + i;
      const ang = rnd(s, 1) * Math.PI * 2;
      const sp = b.speed * (0.25 + 0.75 * rnd(s, 2));
      const d = sp / k * (1 - Math.exp(-k * dt));
      const x = b.x + Math.cos(ang) * d;
      const y = b.y + Math.sin(ang) * d + 0.5 * b.grav * dt * dt;
      if (b.coin) {
        drawCoin(x, y, (22 + 22 * rnd(s, 3)) * b.size, dt * (5 + 8 * rnd(s, 4)) + rnd(s, 5) * 6, rnd(s, 6) * 6, Math.min(1, fade * 2.5));
        continue;
      }
      const v = sp * Math.exp(-k * dt);
      const vx = Math.cos(ang) * v;
      const vy = Math.sin(ang) * v + b.grav * dt;
      ctx.globalAlpha = fade;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2.5 * b.size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - vx * 0.035, y - vy * 0.035);
      ctx.stroke();
      const g = (10 + 20 * rnd(s, 3)) * b.size;
      ctx.drawImage(glow(b.color), x - g / 2, y - g / 2, g, g);
    }
  }

  function drawRain(r, t) {
    if (t < r.t0) return;
    const first = Math.max(0, Math.floor((t - 2 - r.t0) * r.rate));
    const last = Math.floor((Math.min(t, r.t1) - r.t0) * r.rate);
    for (let i = first; i <= last; i++) {
      const dt = t - (r.t0 + i / r.rate);
      const s = r.seed + i;
      const y = -50 + (200 + 200 * rnd(s, 2)) * dt + 350 * dt * dt;
      if (y > 780) continue;
      const x = rnd(s, 1) * 1320 - 20 + Math.sin(dt * 2 + s) * 20;
      drawCoin(x, y, 24 + 20 * rnd(s, 3), dt * (4 + 6 * rnd(s, 4)), rnd(s, 5) * 6, 1);
    }
  }

  function drawEmbers(t) {
    let e = EMBERS[0];
    EMBERS.forEach(x => { if (t >= x.at) e = x; });
    const img = glow(e.c);
    for (let i = 0; i < e.n; i++) {
      const sp = 40 + 90 * rnd(i, 7);
      const y = 760 - ((t * sp + rnd(i, 8) * 900) % 900);
      const x = rnd(i, 9) * 1280 + Math.sin(t * (0.6 + rnd(i, 10)) + i) * 26;
      const g = 6 + 16 * rnd(i, 12);
      ctx.globalAlpha = (0.25 + 0.5 * rnd(i, 11)) * (0.6 + 0.4 * Math.sin(t * 3 + i * 1.7));
      ctx.drawImage(img, x - g / 2, y - g / 2, g, g);
    }
  }

  function drawFx(t) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, 1280, 720);
    ctx.globalCompositeOperation = 'lighter';
    drawEmbers(t);
    BURSTS.forEach(b => { if (!b.coin) drawBurst(b, t); });
    ctx.globalCompositeOperation = 'source-over';
    RAINS.forEach(r => drawRain(r, t));
    BURSTS.forEach(b => { if (b.coin) drawBurst(b, t); });
    ctx.globalAlpha = 1;
  }

  function drawCounters(t) {
    COUNTERS.forEach(c => {
      const p = Math.min(1, Math.max(0, (t - c.at) / c.dur));
      const v = Math.round(c.to * (1 - Math.pow(1 - p, 3)));
      if (v !== c.last) {
        c.last = v;
        c.el.textContent = v.toLocaleString('en-US');
      }
    });
  }

  // 結尾的遊戲環：橢圓軌道，前面大而亮、後面小而暗
  function drawRing(t) {
    const dt = t - T.join;
    if (dt < 0) return;
    const open = 1 - Math.exp(-dt * 3);
    const spin = dt * 0.32 + 4 * (1 - Math.exp(-dt * 2.2));
    ringEls.forEach((el, i) => {
      const th = spin + (i / RING_N) * Math.PI * 2;
      const d = Math.cos(th);
      const x = Math.sin(th) * 590 * open;
      const y = d * 190 * open;
      const s = (0.5 + 0.5 * (d + 1) / 2) * (0.4 + 0.6 * open);
      // 經過中間文字後方時淡掉，讓字和按鈕保持清楚
      const side = 0.3 + 0.7 * Math.min(1, Math.abs(x) / 400);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
      el.style.opacity = (open * side * (0.2 + 0.8 * Math.pow((d + 1) / 2, 1.5))).toFixed(3);
      el.style.zIndex = String(Math.round((d + 1) * 50));
    });
  }

  // 把合成影片的三段分別畫到三支手機上
  function drawTrio() {
    if (trioVideo.readyState < 2) return;
    TRIO.forEach((p, i) => trioCanvases[i].drawImage(trioVideo, p.sx, 0, p.sw, 640, 0, 0, p.sw, 640));
  }
  ['loadeddata', 'seeked'].forEach(type => trioVideo.addEventListener(type, drawTrio));

  function onTick(t) {
    if (t >= T.trio - 1 && t < T.events) drawTrio();
    drawFx(t);
    drawCounters(t);
    drawRing(t);
  }

  /* ---------- 播放器（js/mg-player.js） ---------- */

  new MGPlayer({ root, tl, chapters: CHAPTERS, end: END, videos: VIDEOS, onTick });
})();
