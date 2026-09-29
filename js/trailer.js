/* =========================================================
   極速賽馬 遊戲介紹動畫（Motion Graphic × 實機畫面）
   - 一條 GSAP 主時間軸跑完全部分鏡，可暫停、跳段落、拖回去重看
   - 實機影片跟著時間軸走（暫停、跳段落時影片同步），不是各自播放
   - 畫布固定 1280×720，依外框寬度等比縮放
   ========================================================= */
(() => {
  const G = window.gsap;
  const cfg = window.AFF_CONFIG || {};
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const frame = $('.tr-frame');
  const mg = $('.mg');
  if (!frame || !mg) return;

  const playUrl = cfg.playUrl || '#';
  $$('[data-play]').forEach(a => {
    a.href = playUrl;
    if (/^https?:/.test(playUrl)) a.rel = 'sponsored noopener';
  });

  const chars = text => [...text].map(c => (c === ' ' ? ' ' : `<span>${c}</span>`)).join('');

  /* ---------- 分鏡 ---------- */

  mg.innerHTML = `
  <div class="mg-cam">
    <div class="mg-bg"></div>
    <div class="mg-dots"></div>

    <section class="sc sc-open">
      <div class="op-rays"></div>
      <svg class="op-ring" viewBox="0 0 720 720"><circle cx="360" cy="360" r="300"/><circle cx="360" cy="360" r="330"/></svg>
      <p class="op-kicker chars">${chars('每')}<b>2</b>${chars('分鐘，一場新的比賽')}</p>
      <h2 class="op-title chars">${chars('極速賽馬')}</h2>
      <p class="op-en">HORSE RACING</p>
      <img class="op-badge" src="assets/games/cup-sunny.webp" alt="">
    </section>

    <section class="sc sc-v1 vid">
      <video data-clip="pack" src="assets/clips/race-pack.mp4" muted playsinline preload="auto"></video>
      <div class="v-tag"><i></i>實機畫面</div>
      <p class="v-big">真的在跑的<br><em>3D 賽場</em></p>
      <div class="v-lower"><b>SUNNY CUP</b><span>8 匹同場競速</span></div>
    </section>

    <section class="sc sc-ring">
      <div class="rg-copy"><p>一場只要</p><h3><em>2</em> 分鐘</h3><small>每一場都照同樣的節奏跑</small></div>
      <svg class="rg" viewBox="0 0 540 540">
        <circle class="rg-track" cx="270" cy="270" r="220"/>
        <circle class="rg-arc" cx="270" cy="270" r="220"/>
        <circle class="rg-arc" cx="270" cy="270" r="220"/>
        <circle class="rg-arc" cx="270" cy="270" r="220"/>
        <circle class="rg-arc" cx="270" cy="270" r="220"/>
      </svg>
      <div class="rg-center"><b>0</b><span>秒 / 一場</span></div>
    </section>

    <section class="sc sc-v2 vid">
      <video data-clip="start" src="assets/clips/race-start.mp4" muted playsinline preload="auto"></video>
      <div class="speed"></div>
      <div class="v-tag"><i></i>實機畫面</div>
      <p class="v-slam">起跑！</p>
      <p class="v-note">每匹馬都有自己的跑法</p>
      <ul class="v-styles"><li>領放</li><li>跟前</li><li>中段後追</li><li>後段爆發</li></ul>
    </section>

    <section class="sc sc-cups">
      <div class="cup c-sunny"><img src="assets/games/cup-sunny.webp" alt=""><b>Sunny Cup</b><span>8 匹</span></div>
      <div class="cup c-thunder"><img src="assets/games/cup-thunder.webp" alt=""><b>Thunder Cup</b><span>10 匹</span></div>
      <div class="cup c-royal"><img src="assets/games/cup-royal.webp" alt=""><b>Royal Cup</b><span>12 匹</span></div>
      <p class="cups-title">三個盃賽，各自開跑</p>
    </section>

    <section class="sc sc-v3 vid">
      <video data-clip="finish" src="assets/clips/race-finish.mp4" muted playsinline preload="auto"></video>
      <div class="v-tag"><i></i>實機畫面</div>
      <p class="v-big">最後直線<br><em>全力衝刺</em></p>
      <div class="frame-lines"></div>
      <div class="flash"></div>
      <p class="v-photo">PHOTO FINISH</p>
      <p class="v-sub">結算後立即派彩</p>
    </section>

    <section class="sc sc-steps">
      <h3 class="st-title">三步驟開玩</h3>
      <svg class="st-path" viewBox="0 0 1280 720"><path d="M250 325 C 400 470, 490 470, 640 405 S 900 300, 1030 325"/></svg>
      <div class="st st1"><b>1</b><p>選一個盃賽</p><small>Sunny・Thunder・Royal</small></div>
      <div class="st st2"><b>2</b><p>48 秒內下注</p><small>10–10,000，10 的倍數</small></div>
      <div class="st st3"><b>3</b><p>看比賽・等派彩</p><small>結算後自動入帳</small></div>
    </section>

    <section class="sc sc-end">
      <div class="end-clip"><video data-clip="podium" src="assets/clips/race-podium.mp4" muted playsinline preload="auto"></video></div>
      <div class="end-copy">
        <p>KUNKING 原創</p>
        <h3 class="chars">${chars('極速賽馬')}</h3>
        <p class="end-sub">每 2 分鐘一場・三個盃賽</p>
        <span class="end-btn">立即遊玩 →<i></i></span>
        <small>18+ 請理性遊戲</small>
      </div>
      <canvas class="confetti" width="1280" height="720"></canvas>
    </section>
  </div>
  <div class="mg-wipe"><i></i><i></i><i></i><i></i></div>`;

  const S = name => $(`.sc-${name}`, mg);
  const cam = $('.mg-cam', mg);

  /* 段落：name 顯示在進度列，caption 是給螢幕閱讀器與畫面下方的說明 */
  const CHAPTERS = [
    { at: 0, name: '開場', caption: '極速賽馬：每 2 分鐘開跑一場。' },
    { at: 4.3, name: '實機賽場', caption: '實機畫面：3D 賽場，Sunny Cup 8 匹同場競速。' },
    { at: 10.3, name: '一場 2 分鐘', caption: '一場 120 秒：下注 48 秒、集合 12 秒、比賽 50 秒、結算 10 秒。' },
    { at: 16.3, name: '起跑', caption: '實機畫面：開閘起跑，每匹馬都有自己的跑法。' },
    { at: 22.8, name: '三個盃賽', caption: 'Sunny Cup 8 匹、Thunder Cup 10 匹、Royal Cup 12 匹。' },
    { at: 28.0, name: '衝線', caption: '實機畫面：最後直線衝刺，結算後立即派彩。' },
    { at: 37.0, name: '怎麼玩', caption: '三步驟：選盃賽、48 秒內下注、看比賽等派彩。' },
    { at: 42.0, name: '開始遊玩', caption: '實機畫面：頒獎台。立即開始遊玩。' },
  ];
  const END = 49;

  /* 實機影片：在時間軸的 start~end 之間播放，from 是影片內的起點，freeze 之後停格 */
  const VIDEOS = [
    { clip: 'pack', start: 4.3, end: 10.6, from: 0 },
    { clip: 'start', start: 16.3, end: 23.2, from: 0 },
    { clip: 'finish', start: 28.0, end: 37.4, from: 0, freeze: 6.85 },
    { clip: 'podium', start: 42.0, end: END + 1, from: 0 },
  ].map(v => ({ ...v, el: $(`video[data-clip="${v.clip}"]`, mg) }));

  if (!G || !window.MGPlayer) {
    // 沒有 GSAP：直接顯示結尾畫面
    S('end').style.visibility = 'visible';
    return;
  }

  /* ---------- 時間軸 ---------- */

  const tl = G.timeline({ paused: true });
  const show = (name, at, until) => {
    tl.set(S(name), { autoAlpha: 1 }, at);
    if (until != null) tl.set(S(name), { autoAlpha: 0 }, until);
  };
  const wipe = $$('.mg-wipe i', mg);
  G.set(wipe, { left: i => -300 + i * 400, width: 640, skewX: -20, scaleX: 0 });
  // 斜條轉場：at 時畫面剛好被蓋滿，可以在那一刻換場景
  const wipeAt = at => {
    tl.set(wipe, { transformOrigin: '0% 50%' }, at - 0.6)
      .to(wipe, { scaleX: 1, duration: 0.4, stagger: 0.05, ease: 'power3.in' }, at - 0.55)
      .set(wipe, { transformOrigin: '100% 50%' }, at)
      .to(wipe, { scaleX: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out' }, at + 0.02);
  };

  // S1 開場 0–4.3
  const open = S('open');
  show('open', 0, 4.3);
  tl.set($('.mg-bg', mg), { background: 'radial-gradient(900px 600px at 50% 45%, #145a3f, #06140f 70%)' }, 0)
    .fromTo($('.op-rays', open), { opacity: 0, rotation: -20, scale: 0.6 }, { opacity: 1, rotation: 30, scale: 1, duration: 4.3, ease: 'power2.out' }, 0)
    .fromTo($$('.op-ring circle', open), { strokeDasharray: '0 2200', rotation: -90, transformOrigin: '50% 50%' }, { strokeDasharray: '2200 0', rotation: 90, duration: 1.4, stagger: 0.15, ease: 'power2.inOut' }, 0.1)
    .fromTo($$('.op-kicker span, .op-kicker b', open), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'back.out(3)' }, 0.3)
    .fromTo($$('.op-title span', open), { opacity: 0, y: -140, scale: 1.6, rotation: gi => (gi % 2 ? 12 : -12) }, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.55, stagger: 0.09, ease: 'back.out(2.2)' }, 1.1)
    .to(cam, { keyframes: { x: [0, -14, 12, -8, 5, 0] }, duration: 0.35, ease: 'none' }, 1.62)
    .fromTo($('.op-en', open), { opacity: 0, letterSpacing: '1.4em' }, { opacity: 1, letterSpacing: '0.5em', duration: 0.8, ease: 'power3.out' }, 1.7)
    .fromTo($('.op-badge', open), { opacity: 0, scale: 0, rotation: -40 }, { opacity: 1, scale: 1, rotation: 8, duration: 0.6, ease: 'back.out(2.5)' }, 2.0)
    .to($('.op-badge', open), { y: -10, rotation: -4, duration: 1.4, ease: 'sine.inOut' }, 2.6)
    .to($$('.op-title span', open), { y: -8, duration: 0.8, stagger: 0.06, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 2.4);
  wipeAt(4.3);

  // S2 實機：整群馬奔馳 4.3–10.6
  const v1 = S('v1');
  show('v1', 4.3, 10.6);
  tl.fromTo($('video', v1), { scale: 1.15 }, { scale: 1, duration: 6.3, ease: 'none' }, 4.3)
    .fromTo($('.v-tag', v1), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' }, 4.6)
    .fromTo($('.v-lower', v1), { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power4.out' }, 4.9)
    .fromTo($$('.v-lower b, .v-lower span', v1), { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.12 }, 5.2)
    .fromTo($('.v-big', v1), { opacity: 0, x: 80, skewX: -12 }, { opacity: 1, x: 0, skewX: 0, duration: 0.6, ease: 'power4.out' }, 5.4)
    .to([$('.v-big', v1), $('.v-lower', v1)], { opacity: 0, x: 40, duration: 0.3 }, 9.3)
    // 影片縮成圓形，接到下一段的圓環
    .fromTo(v1, { clipPath: 'circle(75% at 50% 50%)' }, { clipPath: 'circle(0% at 71% 50%)', duration: 0.7, ease: 'power3.in' }, 9.9);

  // S3 一場 120 秒 10.3–16.6
  const ring = S('ring');
  const C = 2 * Math.PI * 220;
  const PHASES = [
    { sec: 48, label: '下注', color: '#5df5c2' },
    { sec: 12, label: '集合', color: '#ffc83d' },
    { sec: 50, label: '比賽', color: '#ff8a3d' },
    { sec: 10, label: '結算', color: '#6fb7ff' },
  ];
  const arcs = $$('.rg-arc', ring);
  const center = $('.rg-center b', ring);
  let acc = 0;
  show('ring', 10.3, 16.6);
  tl.set($('.mg-bg', mg), { background: 'radial-gradient(900px 600px at 70% 50%, #123f4a, #06120f 70%)' }, 10.3)
    .fromTo($('.rg', ring), { scale: 0.2, rotation: -120, transformOrigin: '50% 50%' }, { scale: 1, rotation: 0, duration: 0.8, ease: 'back.out(1.6)' }, 10.3)
    .fromTo($$('.rg-copy > *', ring), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.12, ease: 'power3.out' }, 10.6)
    .fromTo(center, { textContent: 0 }, { textContent: 120, snap: { textContent: 1 }, duration: 3.1, ease: 'none' }, 10.9);
  PHASES.forEach((p, i) => {
    const len = p.sec / 120 * C;
    const startAngle = -90 + acc / 120 * 360;
    const mid = (acc + p.sec / 2) / 120 * Math.PI * 2 - Math.PI / 2;
    const at = 10.9 + acc / 120 * 3.1;
    const dur = p.sec / 120 * 3.1;
    arcs[i].style.stroke = p.color;
    arcs[i].setAttribute('transform', `rotate(${startAngle} 270 270)`);
    const label = document.createElement('div');
    label.className = 'rg-label';
    label.innerHTML = `<b style="color:${p.color}">${p.sec}s</b>${p.label}`;
    ring.append(label);
    // 標籤放在圓弧中點外側（圓心在畫布 910,360）
    G.set(label, { left: 910 + Math.cos(mid) * 322, top: 360 + Math.sin(mid) * 322, xPercent: -50, yPercent: -50, textAlign: 'center' });
    tl.fromTo(arcs[i], { strokeDasharray: `0 ${C}` }, { strokeDasharray: `${Math.max(len - 8, 4)} ${C}`, duration: dur, ease: 'none' }, at)
      .fromTo(label, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(3)' }, at + dur * 0.5);
    acc += p.sec;
  });
  tl.to([$('.rg', ring), center.parentElement], { scale: 1.06, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out' }, 14.0)
    .to($$('.rg-copy > *, .rg-label', ring), { opacity: 0, duration: 0.3 }, 15.6)
    // 穿過圓環中心進到下一段
    .to([$('.rg', ring), center.parentElement], { scale: 5, opacity: 0, duration: 0.7, ease: 'power3.in' }, 15.8);

  // S4 實機：開閘起跑 16.3–23.2
  const v2 = S('v2');
  show('v2', 16.3, 23.2);
  tl.fromTo(v2, { clipPath: 'circle(0% at 71% 50%)' }, { clipPath: 'circle(150% at 71% 50%)', duration: 0.7, ease: 'power3.in' }, 16.3)
    .fromTo($('.v-tag', v2), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.5 }, 16.6)
    // 影片第 0.9 秒閘門打開
    .fromTo($('.v-slam', v2), { opacity: 0, scale: 3.2, rotation: -8 }, { opacity: 1, scale: 1, rotation: -4, duration: 0.35, ease: 'power4.in' }, 16.95)
    .to(cam, { keyframes: { x: [0, 18, -14, 9, -4, 0], y: [0, -10, 8, -5, 2, 0] }, duration: 0.4, ease: 'none' }, 17.3)
    .to($('.v-slam', v2), { opacity: 0, scale: 0.6, y: -60, duration: 0.35, ease: 'power2.in' }, 18.3)
    .fromTo($('.speed', v2), { opacity: 0, backgroundPositionX: 0 }, { opacity: 1, backgroundPositionX: -2400, duration: 5, ease: 'none' }, 17.3)
    .fromTo($('.v-note', v2), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 18.7)
    .fromTo($$('.v-styles li', v2), { opacity: 0, y: 40, scale: 0.7 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.35, ease: 'back.out(2.5)' }, 19.0)
    .to($$('.v-styles li', v2), { borderColor: '#ffc83d', duration: 0.2, stagger: 0.35, yoyo: true, repeat: 1 }, 20.6);

  // S5 三個盃賽 22.8–28.4
  const cups = S('cups');
  const panels = $$('.cup', cups);
  show('cups', 22.5, 28.4);
  tl.fromTo(panels, { yPercent: i => (i % 2 ? -110 : 110) }, { yPercent: 0, duration: 0.55, stagger: 0.1, ease: 'power4.out' }, 22.5)
    .fromTo($$('.cup img', cups), { scale: 0, rotation: -30, y: -80 }, { scale: 1, rotation: 0, y: 0, duration: 0.6, stagger: 0.12, ease: 'back.out(2)' }, 23.0)
    .fromTo($$('.cup b, .cup span', cups), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.07, ease: 'power3.out' }, 23.5)
    .fromTo($('.cups-title', cups), { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 23.3)
    .to($$('.cup img', cups), { y: -14, duration: 0.9, stagger: 0.2, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 24.1)
    .to($('.cups-title', cups), { opacity: 0, duration: 0.3 }, 27.5)
    .to(panels, { yPercent: i => (i % 2 ? 110 : -110), duration: 0.5, stagger: 0.08, ease: 'power3.in' }, 27.7);

  // S6 實機：最後直線 → 停格 PHOTO FINISH 28.0–37.4
  const v3 = S('v3');
  const freezeAt = 28.0 + 6.85;
  show('v3', 28.0, 37.4);
  tl.fromTo($('.v-tag', v3), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.5 }, 28.3)
    .fromTo($('.v-big', v3), { opacity: 0, x: 90, skewX: -14 }, { opacity: 1, x: 0, skewX: 0, duration: 0.55, ease: 'power4.out' }, 28.6)
    .to($('.v-big', v3), { opacity: 0, x: 60, duration: 0.3 }, 31.8)
    .set($('.flash', v3), { opacity: 0.95 }, freezeAt)
    .to($('.flash', v3), { opacity: 0, duration: 0.5, ease: 'power2.out' }, freezeAt)
    .fromTo($('video', v3), { scale: 1 }, { scale: 1.18, duration: 2.4, ease: 'power2.out', transformOrigin: '46% 46%' }, freezeAt)
    .fromTo($('.frame-lines', v3), { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.35 }, freezeAt + 0.05)
    .fromTo($('.v-photo', v3), { opacity: 0, scale: 2.4, skewX: -10 }, { opacity: 1, scale: 1, skewX: 0, duration: 0.35, ease: 'power4.in' }, freezeAt + 0.1)
    .to(cam, { keyframes: { x: [0, 12, -9, 5, 0] }, duration: 0.3, ease: 'none' }, freezeAt + 0.45)
    .fromTo($('.v-sub', v3), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, freezeAt + 0.7);
  wipeAt(37.0);

  // S7 怎麼玩 37.0–42.0
  const steps = S('steps');
  const path = $('.st-path path', steps);
  const pathLen = path.getTotalLength();
  show('steps', 37.0, 42.0);
  tl.set($('.mg-bg', mg), { background: 'radial-gradient(900px 600px at 50% 60%, #0f4a36, #06120f 70%)' }, 37.0)
    .fromTo($('.st-title', steps), { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 37.2)
    .fromTo(path, { strokeDasharray: pathLen, strokeDashoffset: pathLen }, { strokeDashoffset: 0, duration: 1.8, ease: 'power1.inOut' }, 37.4);
  $$('.st', steps).forEach((st, i) => {
    tl.fromTo($('b', st), { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2.4)' }, 37.5 + i * 0.6)
      .fromTo([...st.children].slice(1), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power3.out' }, 37.75 + i * 0.6);
  });
  tl.to($$('.st b', steps), { scale: 1.1, duration: 0.25, stagger: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' }, 39.8)
    .to($$('.st, .st-title', steps), { opacity: 0, y: 40, duration: 0.35, stagger: 0.05, ease: 'power2.in' }, 41.5)
    .to(path, { opacity: 0, duration: 0.3 }, 41.6);

  // S8 結尾：頒獎台 + 行動按鈕 42.0–49
  const end = S('end');
  show('end', 42.0);
  tl.set($('.mg-bg', mg), { background: 'radial-gradient(900px 600px at 30% 50%, #165a40, #06120f 70%)' }, 42.0)
    .fromTo($('.end-clip', end), { opacity: 0, scale: 0.6, rotation: -6 }, { opacity: 1, scale: 1, rotation: -2, duration: 0.7, ease: 'back.out(1.8)' }, 42.0)
    .fromTo($$('.end-copy > p:first-child', end), { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.4 }, 42.4)
    .fromTo($$('.end-copy h3 span', end), { opacity: 0, y: 60, rotation: 10 }, { opacity: 1, y: 0, rotation: 0, duration: 0.45, stagger: 0.07, ease: 'back.out(2.5)' }, 42.5)
    .fromTo($('.end-sub', end), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, 43.0)
    .fromTo($('.end-btn', end), { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)' }, 43.3)
    .fromTo($('.end-copy small', end), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 43.7)
    .fromTo($('.end-btn i', end), { xPercent: -120 }, { xPercent: 330, duration: 0.9, ease: 'power2.inOut', repeat: 2, repeatDelay: 0.9 }, 44.0)
    .to($('.end-btn', end), { scale: 1.06, duration: 0.45, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 44.2)
    .to($('.end-clip', end), { rotation: 1, y: -8, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 43.0)
    .set({}, {}, END);

  /* ---------- 彩帶：位置只由時間決定，暫停、拖回去都會一致 ---------- */

  const confetti = $('.confetti', end);
  const ctx = confetti.getContext('2d');
  const BURST = 42.6;
  const bits = Array.from({ length: 90 }, (_, i) => {
    const r = n => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    return {
      x: 390 + (r(1) - 0.5) * 120,
      y: 300,
      vx: (r(2) - 0.5) * 900,
      vy: -300 - r(3) * 500,
      spin: (r(4) - 0.5) * 16,
      w: 8 + r(5) * 8,
      h: 4 + r(6) * 5,
      color: ['#5df5c2', '#ffc83d', '#ff8a3d', '#ffffff', '#6fb7ff'][i % 5],
    };
  });
  function drawConfetti(t) {
    ctx.clearRect(0, 0, 1280, 720);
    const dt = t - BURST;
    if (dt <= 0 || dt > 4.5) return;
    bits.forEach(b => {
      const drag = 1 - Math.exp(-dt * 1.4);
      const x = b.x + b.vx / 1.4 * drag;
      const y = b.y + b.vy / 1.4 * drag + 260 * dt * dt * 0.5;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (4.5 - dt) * 1.5);
      ctx.translate(x, y);
      ctx.rotate(b.spin * dt);
      ctx.scale(1, Math.cos(dt * 9 + b.spin));
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    });
  }

  /* ---------- 播放器（js/mg-player.js） ---------- */

  new MGPlayer({ root: $('.tr-player'), tl, chapters: CHAPTERS, end: END, videos: VIDEOS, onTick: drawConfetti });
})();
