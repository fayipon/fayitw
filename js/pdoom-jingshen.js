/* =========================================================
   精神版 P(doom) MV（pdoom-jingshen.html）
   - 影片：Seedance 2.0 生成的 31 段片段，照剪接表（assets/pdoom-jingshen/edl.json）由
     scripts/pdoom-edit.py --name pdoom-jingshen 剪成一支跟原曲等長的影片（含原曲）；這裡一格一格畫到 canvas 上
   - 畫面照時裝秀 MV：前半東北雪夜、後半雪地白茫茫；影片本身沒有字
   - 程式疊上去的：時裝秀 HUD（左上 Look 編號、右上翻牌 P(DOOM)、左側刻度尺、底部跑馬燈、時間碼、
     臉部追蹤框）、網點與底片顆粒、調色、切點推鏡、轉場故障、閃白、片頭片尾、最後的馬賽克；
     字卡與歌詞在 js/pdoom-jingshen-type.js
   - 夜景用白字、雪地用黑字：依目前鏡頭的片段決定，切點上 0.12 秒轉過去
   - 時間：以影片的 currentTime 為準（聲音就在影片裡，不會不同步）；拍點 88 BPM、第一拍在 0.21 秒
   - 網址加 #t=秒數 會停在那一格
   ========================================================= */
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const root = $('.pj-player');
  const mg = root && $('.mg', root);
  if (!mg) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const frac = x => x - Math.floor(x);
  const rnd = (i, n = 0) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  const ease = {
    io: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    out: k => 1 - Math.pow(1 - k, 3),
    in: k => k * k * k,
    back: k => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2),
  };
  const pad = n => String(n).padStart(2, '0');
  const OR = '#f2642e';

  /* ---------- 拍點與段落 ---------- */
  const BPM = 88, BEAT = 60 / BPM, OFF = 0.21, END = 156.7, FINALE = 150.89;
  const tb = b => OFF + b * BEAT;
  const bt = t => (t - OFF) / BEAT;
  const SECTIONS = [
    { id: 'v1', name: '主歌一', t0: 0, caption: 'Look 01–02：雪夜縣城。眼睛裡的火花、網咖、往後倒進雪堆；洗浴中心的紅毯，兩排兄弟同時鞠躬。' },
    { id: 'c1', name: '副歌一', t0: tb(33), caption: '副歌一：迪廳社會搖，P(DOOM) 從 5% 開始翻牌往上跳；炕頭小屋就是 Chinese room。' },
    { id: 'v2', name: '主歌二', t0: tb(56), caption: 'Look 04–05：綠皮火車（training run）、極光下的冰河、鬼火機車加速、自動麻將桌洗牌（rearranging）。' },
    { id: 'c2', name: '副歌二', t0: tb(86), caption: '副歌二：雪夜街頭的整排社會搖、煙火、NVDA 衝上月亮、二人轉舞台的冷焰火。' },
    { id: 'v3', name: '主歌三', t0: tb(106), caption: 'Look 07：切進雪地白茫茫。高速公路的翻牌看板、鐵西老廠房、冰湖甩尾（sharp left turn）。' },
    { id: 'c3', name: '副歌三', t0: tb(139), caption: '副歌三：雪原上的黑貂群舞、迴紋針從天而降、Killswitch 那位在休假。' },
    { id: 'br', name: '橋段', t0: tb(160), caption: '橋段：變電站的 transformers、撞破鐵絲網、礦場裡十萬張顯卡、RLHF 整個歪掉。' },
    { id: 'c4', name: '副歌四', t0: tb(181), caption: '副歌四：織布機（Loom）、拉上口罩（masked）、雪原上幾十個她（recursive）。' },
    { id: 'out', name: '尾聲', t0: tb(200), caption: '尾聲：END OF SHOW。11 套 Look 全部走完，P(DOOM) 翻到 100%，畫面碎成馬賽克。' },
  ];
  SECTIONS.forEach((s, i) => { s.t1 = i + 1 < SECTIONS.length ? SECTIONS[i + 1].t0 : END; });
  const secAt = t => { let i = 0; while (i + 1 < SECTIONS.length && t >= SECTIONS[i + 1].t0) i++; return SECTIONS[i]; };
  const chorus = id => id[0] === 'c' || id === 'out';

  // 剪接表：切點用來推鏡；每個鏡頭的片段決定白字還是黑字；face = 臉的位置（追蹤框）
  let SHOTS = [];
  const WHITE_CLIPS = new Set(['v-highway', 'v-factory', 'v-drift', 'v-ice', 'v-snowdance', 'v-paperclips', 'v-pool', 'v-pylons', 'v-fence', 'v-gpu', 'v-loom', 'v-mask', 'v-clones', 'v-star']);
  const shotIndex = t => { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t) i++; return i; };
  const mixAt = t => {
    if (!SHOTS.length) return t >= tb(106) ? 1 : 0;
    const i = shotIndex(t), s = SHOTS[i];
    const cur = WHITE_CLIPS.has(s.clip) ? 1 : 0;
    const was = i ? (WHITE_CLIPS.has(SHOTS[i - 1].clip) ? 1 : 0) : cur;
    return lerp(was, cur, clamp((t - s.t) / 0.12));
  };
  const lastCut = t => (SHOTS.length ? SHOTS[shotIndex(t)].t : 0);

  // P(DOOM)：[開始, 結束, 從, 到]（每拍跳一格，段落之間停住）
  const METER = [[23.0, 35.5, 5, 34], [59.0, 69.9, 34, 61], [95.4, 105.4, 61, 86], [109.3, 123.4, 86, 97], [123.5, 135.4, 97, 99.9], [FINALE, FINALE + 0.25, 99.9, 100]];
  const pdoomAt = t => {
    let v = 5;
    for (const [a, b, v0, v1] of METER) {
      if (t < a) break;
      const n = Math.max(1, Math.round((b - a) / BEAT)), p = clamp((t - a) / (b - a)) * n;
      v = t >= b ? v1 : lerp(v0, v1, (Math.floor(p) + ease.out(clamp(frac(p) * 4))) / n);
    }
    return v;
  };
  // 段落交界的故障轉場：[開始, 結束, 強度]
  const GLITCH = [[22.45, 22.9, 1], [35.6, 35.9, 0.6], [58.6, 59.05, 1], [72.2, 72.6, 1], [94.75, 95.1, 0.8], [109.05, 109.45, 1], [123.4, 123.75, 0.8], [136.35, 136.7, 0.8], [150.6, 150.95, 1]];
  const glitchAt = t => GLITCH.reduce((m, [a, b, k]) => (t >= a && t < b ? Math.max(m, k) : m), 0);
  const FLASHES = [[tb(33), 1], [tb(86), 1], [tb(106), 1], [tb(139), 0.8], [tb(160), 1], [tb(181), 1], [tb(200), 0.7], [FINALE, 1]];
  // 最後的馬賽克：[開始, 方塊大小]
  const PIXEL = [[151.3, 7], [151.85, 21], [152.4, 60], [152.9, 0]];
  const pixelAt = t => { let px = 0; for (const [a, s] of PIXEL) if (t >= a) px = s; return px; };

  /* ---------- 畫布 ---------- */
  const W = 1280, H = 720;
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  mg.classList.add('pd-film');
  mg.replaceChildren(cv);
  let R = 1;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // 暈光：縮成小圖再放大，只留亮部
  const SM1 = mk(160, 90), SM2 = mk(160, 90);
  const s1 = SM1.getContext('2d'), s2 = SM2.getContext('2d');
  // 色散
  const CR = mk(640, 360), CC = mk(640, 360);
  const cr = CR.getContext('2d'), cc = CC.getContext('2d');
  // 馬賽克
  const PX = mk(184, 104);
  const px = PX.getContext('2d');
  const GRAINS = [0, 1, 2].map(() => {
    const c = mk(256, 256), x = c.getContext('2d'), im = x.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 90;
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
      im.data[i * 4 + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    return c;
  });
  // 網點：印刷網屏的小圓點
  const DOTS = (() => {
    const c = mk(5, 5), x = c.getContext('2d');
    x.fillStyle = '#000';
    x.beginPath();
    x.arc(2.5, 2.5, 1.15, 0, TAU);
    x.fill();
    return c;
  })();
  let grainPats = null, dotPat = null;
  const VIGNETTE = (() => {
    const c = mk(640, 360), x = c.getContext('2d');
    const gr = x.createRadialGradient(320, 180, 120, 320, 180, 400);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,.6)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 640, 360);
    return c;
  })();

  /* ---------- 影片 ---------- */
  const video = document.createElement('video');
  // 先試著有聲音自動播；瀏覽器不准的話 play() 會退回靜音，等第一次點擊再開聲音
  video.muted = false;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.preload = 'auto';
  video.style.cssText = 'position:absolute;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  mg.append(video);
  const hasFrame = () => video.readyState >= 2 && video.videoWidth > 0;

  /* ---------- 畫字 ---------- */
  const FONT = {
    cond: '"Barlow Condensed", "Arial Narrow", sans-serif',
    wide: 'Michroma, "Arial Black", sans-serif',
    sans: 'Inter, "Noto Sans TC", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  };
  const font = (size, fam, weight = '') => `${weight ? weight + ' ' : ''}${size}px ${fam}`;
  // 一行字（track = 字距，逐字畫，避免依賴 letterSpacing）
  const text = (s, x, y, o = {}) => {
    g.save();
    g.font = font(o.size || 32, o.fam || FONT.sans, o.weight);
    g.textBaseline = o.base || 'alphabetic';
    g.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    g.fillStyle = o.color || '#fff';
    const track = o.track || 0;
    const chars = [...s];
    const w = track ? chars.reduce((a, ch) => a + g.measureText(ch).width, 0) + track * (chars.length - 1) : g.measureText(s).width;
    let cx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    if (o.shadow) { g.shadowColor = o.shadow; g.shadowBlur = o.blur || 18; }
    g.textAlign = 'left';
    if (!track) g.fillText(s, cx, y);
    else chars.forEach(ch => { g.fillText(ch, cx, y); cx += g.measureText(ch).width + track; });
    g.restore();
    return w;
  };
  const measure = (s, size, fam, weight, track = 0) => {
    g.save();
    g.font = font(size, fam, weight);
    const chars = [...s];
    const w = track ? chars.reduce((a, ch) => a + g.measureText(ch).width, 0) + track * (chars.length - 1) : g.measureText(s).width;
    g.restore();
    return w;
  };
  const inkRGB = m => [lerp(244, 18, m), lerp(242, 18, m), lerp(238, 18, m)].map(Math.round);
  const ink = (m, a = 1) => `rgba(${inkRGB(m).join(',')},${a})`;

  let LOOKS = [[0, 1]];
  const lookAt = t => { let n = 1; for (const [a, k] of LOOKS) if (t >= a) n = k; return n; };
  const TYPE = window.PDoomJingshenType
    ? window.PDoomJingshenType({ g, W, H, clamp, lerp, frac, ease, rnd, text, measure, FONT, OR, mixAt, pdoomAt, lookAt, cv })
    : { draw() {}, impact: () => 0, skew: () => 0, looks: LOOKS };
  LOOKS = TYPE.looks;

  /* ---------- 一格 ---------- */
  let FR = 0;
  // 鏡頭：z = 放大、(x, y) = 位移、r = 旋轉、k = 斜切
  const CAM = { z: 1, x: 0, y: 0, r: 0, k: 0 };
  const drawVideo = (ctx = g, w = W, h = H) => {
    ctx.save();
    ctx.translate(w / 2 + CAM.x * (w / W), h / 2 + CAM.y * (h / H));
    if (CAM.r) ctx.rotate(CAM.r);
    if (CAM.k) ctx.transform(1, 0, CAM.k, 1, 0, 0);
    ctx.scale(CAM.z, CAM.z);
    ctx.drawImage(video, -w / 2, -h / 2, w, h);
    ctx.restore();
  };

  function render(t) {
    FR = Math.floor(t * 24);
    g.setTransform(R, 0, 0, R, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#050505';
    g.fillRect(0, 0, W, H);
    if (!hasFrame()) {
      loadingCard();
      return;
    }
    const sec = secAt(t);
    const m = mixAt(t);
    const b = bt(t);
    const kick = Math.exp(-frac(b) * 7);
    const cutAge = t - lastCut(t);

    // 鏡頭：切點進來先放大再收；副歌跟著拍子微推；字砸下來時推近、晃一下；RLHF 那句整個斜掉
    const imp = reduced ? 0 : TYPE.impact(t);
    CAM.z = 1.02 + Math.exp(-cutAge * 10) * 0.035 + (chorus(sec.id) ? 0.012 * kick : 0) + imp * 0.05;
    CAM.x = (rnd(FR, 51) - 0.5) * 22 * imp;
    CAM.y = (rnd(FR, 52) - 0.5) * 16 * imp;
    CAM.r = (rnd(FR, 53) - 0.5) * 0.018 * imp;
    CAM.k = reduced ? 0 : TYPE.skew(t);
    if (t > tb(200)) CAM.z += (t - tb(200)) * 0.002;

    const pxs = pixelAt(t);
    const gl = reduced ? 0 : glitchAt(t);
    if (pxs) mosaic(pxs);
    else if (gl > 0 && rnd(FR, 9) < 0.4 + gl * 0.5) glitchFrame(gl);
    else drawVideo();

    grade(m);
    halftone(m);
    faceBox(t, m);
    TYPE.draw(t);
    hud(t, m);
    extras(t, m);
    flashes(t);
    film(m);
    // 開頭從黑淡入；最後淡到白
    if (t < 0.8) {
      g.fillStyle = `rgba(5,5,5,${1 - ease.io(clamp(t / 0.8))})`;
      g.fillRect(0, 0, W, H);
    }
    if (t > END - 1.3) endCard(t);
  }

  function loadingCard() {
    const p = video.buffered.length && video.duration ? clamp(video.buffered.end(0) / Math.min(8, video.duration)) : 0;
    text('I’M UPPING MY', W / 2, 300, { size: 20, fam: FONT.mono, weight: '700', color: '#f4efe6', align: 'center', track: 8, alpha: 0.7 });
    text('P(DOOM)', W / 2, 400, { size: 110, fam: FONT.cond, weight: '800', color: '#f4efe6', align: 'center', track: 2 });
    text('JINGSHEN EDITION · SS27', W / 2, 436, { size: 12, fam: FONT.mono, weight: '700', color: OR, align: 'center', track: 4 });
    g.fillStyle = 'rgba(244,239,230,.18)';
    g.fillRect(490, 460, 300, 3);
    g.fillStyle = OR;
    g.fillRect(490, 460, 300 * p, 3);
    text('LOADING', W / 2, 494, { size: 11, fam: FONT.mono, weight: '700', color: '#f4efe6', align: 'center', track: 6, alpha: 0.6 });
  }

  // 故障：橫向撕裂 + 紅青色散
  function glitchFrame(gl) {
    const n = 7 + Math.floor(rnd(FR, 11) * 6);
    let y = 0;
    const x0 = CAM.x;
    for (let i = 0; i < n; i++) {
      const h = i === n - 1 ? H - y : Math.round((H / n) * (0.4 + rnd(FR * 7 + i, 12) * 1.2));
      CAM.x = x0 + (rnd(FR * 13 + i, 14) - 0.5) * 140 * gl * (rnd(FR + i, 15) < 0.55 ? 1 : 0.1);
      g.save();
      g.beginPath();
      g.rect(0, y, W, h);
      g.clip();
      drawVideo();
      g.restore();
      y += h;
      if (y >= H) break;
    }
    CAM.x = x0;
    const d = 6 + gl * 16;
    cr.globalCompositeOperation = cc.globalCompositeOperation = 'source-over';
    cr.drawImage(video, 0, 0, 640, 360);
    cc.drawImage(video, 0, 0, 640, 360);
    cr.globalCompositeOperation = cc.globalCompositeOperation = 'multiply';
    cr.fillStyle = '#ff0000';
    cr.fillRect(0, 0, 640, 360);
    cc.fillStyle = '#00ffff';
    cc.fillRect(0, 0, 640, 360);
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.5 * gl;
    g.drawImage(CR, -d, 0, W, H);
    g.drawImage(CC, d, 0, W, H);
    g.restore();
  }

  // 馬賽克：縮小再用最近鄰放大
  function mosaic(size) {
    const w = Math.max(2, Math.round(W / size)), h = Math.max(2, Math.round(H / size));
    px.imageSmoothingEnabled = true;
    px.clearRect(0, 0, PX.width, PX.height);
    drawVideo(px, w, h);
    g.save();
    g.imageSmoothingEnabled = false;
    g.drawImage(PX, 0, 0, w, h, 0, 0, W, H);
    g.restore();
  }

  // 調色：夜景 = 冷色暗部 + 亮部暈光、稍微去飽和；雪地 = 抬亮、去飽和、偏冷灰
  function grade(m) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const cw = cv.width, ch = cv.height;
    g.globalCompositeOperation = 'saturation';
    g.globalAlpha = lerp(0.16, 0.3, m);
    g.fillStyle = '#808080';
    g.fillRect(0, 0, cw, ch);
    if (m < 1) {
      const n = 1 - m;
      s1.globalCompositeOperation = 'source-over';
      s1.drawImage(cv, 0, 0, 160, 90);
      s2.globalCompositeOperation = 'source-over';
      s2.drawImage(SM1, 0, 0);
      s2.globalCompositeOperation = 'multiply';
      s2.drawImage(SM1, 0, 0);
      s2.drawImage(SM1, 0, 0);
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.4 * n;
      g.drawImage(SM2, 0, 0, cw, ch);
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = 0.24 * n;
      g.fillStyle = '#1d4a5a';
      g.fillRect(0, 0, cw, ch);
    }
    if (m > 0) {
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.07 * m;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, cw, ch);
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = 0.14 * m;
      g.fillStyle = '#dfe9ee';
      g.fillRect(0, 0, cw, ch);
    }
    g.restore();
  }

  // 網點：雪地比較明顯，夜景淡淡的
  function halftone(m) {
    if (!dotPat) dotPat = g.createPattern(DOTS, 'repeat');
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = lerp(0.1, 0.2, m);
    g.fillStyle = dotPat;
    g.fillRect(0, 0, cv.width, cv.height);
    g.restore();
  }

  // 臉部追蹤框：剪接表裡的 face = [x, y, w, h]（或 [[鏡頭內秒數, x, y, w, h], ...] 逐點內插），座標是影片畫面
  function faceBox(t, m) {
    if (!SHOTS.length) return;
    const s = SHOTS[shotIndex(t)];
    if (!s.face) return;
    let f = s.face;
    if (Array.isArray(f[0])) {
      const dt = t - s.t;
      let i = 0;
      while (i + 1 < f.length && dt >= f[i + 1][0]) i++;
      const a = f[i], b2 = f[Math.min(i + 1, f.length - 1)];
      const k = b2[0] > a[0] ? clamp((dt - a[0]) / (b2[0] - a[0])) : 0;
      f = [1, 2, 3, 4].map(j => lerp(a[j], b2[j], k));
    }
    const map = (x, y) => [W / 2 + CAM.x + (x - W / 2) * CAM.z, H / 2 + CAM.y + (y - H / 2) * CAM.z];
    const [x0, y0] = map(f[0], f[1]);
    const a = clamp((t - s.t - 0.1) / 0.15);
    if (a <= 0) return;
    const w = f[2] * CAM.z, h = f[3] * CAM.z;
    const col = ink(m, 0.85);
    g.save();
    g.globalAlpha = a;
    g.strokeStyle = col;
    g.lineWidth = 1.2;
    const l = Math.min(22, w * 0.22);
    [[x0, y0, 1, 1], [x0 + w, y0, -1, 1], [x0, y0 + h, 1, -1], [x0 + w, y0 + h, -1, -1]].forEach(([px2, py, dx, dy]) => {
      g.beginPath(); g.moveTo(px2, py + dy * l); g.lineTo(px2, py); g.lineTo(px2 + dx * l, py); g.stroke();
    });
    g.restore();
    text(`MODEL 01 · LOOK ${pad(lookAt(t))}`, x0, y0 - 8, { size: 8.5, fam: FONT.mono, weight: '700', color: col, track: 1, alpha: a });
    text(`0.9${Math.floor(rnd(Math.floor(t * 4), 5) * 9)}`, x0 + w, y0 - 8, { size: 8.5, fam: FONT.mono, weight: '500', color: col, align: 'right', alpha: a });
  }

  /* ---------- HUD：時裝秀的外框 ---------- */
  const fmtN = n => Math.floor(n).toLocaleString('en-US');
  const FLAPCH = '0123456789';
  function hud(t, m) {
    const on = clamp((t - 0.5) / 0.4) * (1 - clamp((t - (END - 1.6)) / 0.6));
    if (on <= 0) return;
    const c = ink(m);
    g.save();
    g.globalAlpha = on;
    // 四角十字
    g.strokeStyle = ink(m, 0.7);
    g.lineWidth = 1;
    [[18, 18], [W - 18, 18], [18, H - 36], [W - 18, H - 36]].forEach(([x, y]) => {
      g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.stroke();
    });
    // 左上：Look 編號
    text(`LOOK ${pad(lookAt(t))} / 11`, 40, 36, { size: 10, fam: FONT.mono, weight: '700', color: c, track: 1 });
    text('MODEL 01 · JINGSHEN · DONGBEI −27°C', 40, 52, { size: 8.5, fam: FONT.mono, weight: '500', color: c, track: 1, alpha: 0.6 });
    // 右上：系列名、波形、翻牌 P(DOOM)
    text('P(DOOM) · SS27', W - 40, 36, { size: 10, fam: FONT.mono, weight: '700', color: c, track: 1, align: 'right' });
    const kick = Math.exp(-frac(bt(t)) * 6);
    g.fillStyle = ink(m, 0.75);
    for (let i = 0; i < 34; i++) {
      const h = 2 + (0.25 + 0.75 * rnd(i, Math.floor(t * 12))) * (0.35 + 0.65 * kick) * 10;
      g.fillRect(W - 40 - 34 * 3 + i * 3, 52 - h, 2, h);
    }
    const v = Math.floor(pdoomAt(t)), was = Math.floor(pdoomAt(t - 0.14));
    const s = v >= 100 ? '100' : pad(v), sw = was >= 100 ? '100' : pad(was);
    const tw = 20, th = 28;
    const x0 = W - 40 - 96 - s.length * (tw + 2);
    [...s].forEach((d, i) => {
      const x = x0 + i * (tw + 2), y = 64;
      g.fillStyle = '#141414';
      g.fillRect(x, y, tw, th);
      g.fillStyle = 'rgba(255,255,255,.07)';
      g.fillRect(x, y, tw, th / 2);
      const spin = sw.length === s.length ? sw[i] !== d : true;
      const shown = spin && t - 0.14 > 0 ? FLAPCH[Math.floor(rnd(i + Math.floor(t * 30), 3) * 10)] : d;
      text(shown, x + tw / 2, y + 21, { size: 18, fam: FONT.mono, weight: '700', color: OR, align: 'center' });
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(x, y + th / 2 - 0.5, tw, 1);
    });
    text('PERCENT', W - 40 - 88, 75, { size: 9.5, fam: FONT.mono, weight: '700', color: c, track: 3 });
    text('P(DOOM)', W - 40 - 88, 89, { size: 9.5, fam: FONT.mono, weight: '700', color: c, track: 3 });
    g.fillStyle = ink(m, 0.4);
    g.fillRect(x0, 98, W - 40 - x0, 1);
    text('I’M UPPING MY P(DOOM) · JINGSHEN', W - 40, 109, { size: 7, fam: FONT.mono, weight: '500', color: c, track: 1, align: 'right', alpha: 0.6 });
    // 左側刻度尺（慢慢往上捲）
    g.save();
    g.beginPath();
    g.rect(0, 130, 40, 450);
    g.clip();
    const off = (t * 9) % 10;
    for (let i = 0; i < 48; i++) {
      const y = 130 + i * 10 - off;
      const n = i + Math.floor(t * 0.9);
      const long = n % 5 === 0;
      g.fillStyle = ink(m, long ? 0.7 : 0.4);
      g.fillRect(16, y, long ? 9 : 5, 1);
      if (n % 10 === 0) text(String(n).padStart(3, '0'), 28, y + 3, { size: 7, fam: FONT.mono, weight: '500', color: c, alpha: 0.6 });
    }
    g.restore();
    // 右下：時間碼
    text(`${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}:${pad(Math.floor(frac(t) * 24))}`, W - 40, H - 34, { size: 9.5, fam: FONT.mono, weight: '500', color: c, align: 'right', track: 1 });
    g.restore();
    ticker(t, on);
  }

  // 底部跑馬燈：數字一直在跳
  function ticker(t, on) {
    const items = [
      `CONTEXT ${fmtN(1182340 + t * 5231)} TOK`,
      `NVDA $${(4.1 + t * 0.0082).toFixed(2)}T`,
      `FLOPS 1E${Math.min(30, 24 + Math.floor(t / 24))}/S`,
      `GPUS ${fmtN(Math.min(100000, 2048 + t * 820))}`,
      `KILLSWITCH: ${t > 99 ? 'ON PTO' : 'STANDBY'}`,
      `LAMB SKEWERS ${fmtN(40 + t * 2.4)}`,
      `TOKENS BURNED ${fmtN(t * 1904211)}`,
      'GOLD CHAIN 24K × 2',
      `SHOGGOTH SIGHTINGS ${Math.floor(1 + t / 30)}`,
      `P(DOOM) ${Math.floor(pdoomAt(t))}%`,
      `LOOKS ${pad(lookAt(t))} / 11`,
      'TEMP −27°C · HARBIN',
    ];
    g.save();
    g.globalAlpha = on;
    g.fillStyle = 'rgba(8,8,8,.62)';
    g.fillRect(0, H - 20, W, 20);
    g.font = font(9.5, FONT.mono, '500');
    const sep = '   ◆   ';
    const widths = items.map(s => measure(s + sep, 9.5, FONT.mono, '500', 0.6));
    const total = widths.reduce((a, b) => a + b, 0);
    let x = -((t * 46) % total);
    for (let pass = 0; x < W; pass++) {
      for (let i = 0; i < items.length && x < W; i++) {
        if (x + widths[i] > 0) text(items[i] + sep, x, H - 6, { size: 9.5, fam: FONT.mono, weight: '500', color: i === 9 ? OR : '#f2f0ea', track: 0.6 });
        x += widths[i];
      }
    }
    g.restore();
  }

  // 片頭、段落之間、尾聲的看板、P(DOOM) 100%、馬賽克標籤
  const FLAPA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function board(s, x, y, age, o = {}) {
    const cw = o.cw || 28, ch = o.ch || 40, gap = o.gap == null ? 3 : o.gap;
    const chars = [...s];
    const total = chars.length * (cw + gap) - gap;
    const x0 = o.align === 'c' ? x - total / 2 : o.align === 'r' ? x - total : x;
    chars.forEach((c, i) => {
      const a = age - i * 0.03;
      if (a < 0 || c === ' ') return;
      const tx = x0 + i * (cw + gap);
      g.fillStyle = '#141414';
      g.fillRect(tx, y, cw, ch);
      g.fillStyle = 'rgba(255,255,255,.07)';
      g.fillRect(tx, y, cw, ch / 2);
      const shown = a < 0.24 ? FLAPA[Math.floor(rnd(i * 31 + Math.floor(a * 28), 5) * FLAPA.length)] : c;
      text(shown, tx + cw / 2, y + ch / 2 + ch * 0.22, { size: ch * 0.62, fam: FONT.mono, weight: '700', color: o.color || '#f2f0ea', align: 'center' });
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(tx, y + ch / 2 - 0.5, cw, 1);
    });
    return total;
  }
  const NAMES = ['BLACK MINK', 'BATHHOUSE', 'BIG FLOWER', 'NIGHT TRAIN', 'GHOST FIRE', 'ERRENZHUAN', 'ARMY COAT', 'PAPERCLIPS', 'EMPTY POOL', 'THE LOOM', 'FINAL WALK'];
  function extras(t, m) {
    // 片頭：翻牌標題
    if (t > 0.25 && t < 1.5) {
      const a = 1 - clamp((t - 1.3) / 0.2);
      g.save();
      g.globalAlpha = a;
      board('I’M UPPING MY P(DOOM)', W / 2, 300, t - 0.25, { align: 'c', cw: 30, ch: 44 });
      text('JINGSHEN EDITION · SS27 · 11 LOOKS', W / 2, 376, { size: 11, fam: FONT.mono, weight: '700', color: OR, align: 'center', track: 4 });
      g.restore();
    }
    // 副歌一和主歌二之間：下一個 Look
    if (t > 35.7 && t < 38.3) {
      const age = t - 35.7;
      g.save();
      g.globalAlpha = 1 - clamp((t - 38.1) / 0.2);
      board('NEXT LOOK 04', W / 2, 310, age, { align: 'c', cw: 34, ch: 50 });
      text('NIGHT TRAIN · K7041 · HARD SEAT', W / 2, 392, { size: 11, fam: FONT.mono, weight: '700', color: OR, align: 'center', track: 4, alpha: clamp((age - 0.3) / 0.2) });
      g.restore();
    }
    // 尾聲：END OF SHOW 看板 + Look 索引一行一行列出來
    if (t > 140.6 && t < FINALE) {
      const age = t - 140.6;
      board('END OF SHOW', 60, 150, age, { cw: 34, ch: 50 });
      text('LOOKS 11 / 11 · BOARD 01 · FINAL', 62, 222, { size: 10, fam: FONT.mono, weight: '700', color: ink(m), track: 2, alpha: clamp((age - 0.3) / 0.2) });
      const x = 900, y = 140, w = 340;
      const a = clamp(age / 0.25);
      g.save();
      g.globalAlpha = a;
      g.fillStyle = m < 0.5 ? 'rgba(14,14,14,.82)' : 'rgba(250,249,246,.9)';
      g.fillRect(x, y, w, 300);
      const c = m < 0.5 ? '#f2f0ea' : '#141414';
      text('SHOW NOTES · LOOKBOOK INDEX', x + 14, y + 22, { size: 9, fam: FONT.mono, weight: '700', color: c, track: 1 });
      g.fillStyle = m < 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)';
      g.fillRect(x + 14, y + 32, w - 28, 1);
      const cur = Math.floor(bt(t)) % 11;
      LOOKS.forEach(([t0, n], i) => {
        const ra = clamp((age - 0.2 - i * BEAT * 0.5) / 0.15);
        if (ra <= 0) return;
        const yy = y + 54 + i * 22;
        if (i === cur) { g.fillStyle = OR; g.fillRect(x + 8, yy - 14, w - 16, 20); }
        const col = i === cur ? '#fff' : c;
        text(pad(n), x + 14, yy, { size: 10, fam: FONT.mono, weight: '700', color: i === cur ? '#fff' : OR, alpha: ra });
        text(NAMES[i], x + 46, yy, { size: 10, fam: FONT.mono, weight: '500', color: col, track: 1, alpha: ra });
        text(`${Math.floor(pdoomAt(t0 + 0.5))}%`, x + w - 14, yy, { size: 10, fam: FONT.mono, weight: '700', color: col, align: 'right', alpha: ra });
      });
      g.restore();
    }
    // 最高點：P(DOOM) 100% 砸下來
    const fa = t - FINALE;
    if (fa >= 0 && fa < 0.5) {
      const a = 1 - clamp((fa - 0.35) / 0.15);
      const s = 1 + 0.4 * Math.exp(-fa * 10);
      g.save();
      g.fillStyle = m < 0.5 ? `rgba(0,0,0,${0.35 * a})` : `rgba(246,245,241,${0.4 * a})`;
      g.fillRect(0, 0, W, H);
      g.translate(W / 2, H / 2);
      g.scale(s, s);
      g.globalAlpha = a;
      text('P(DOOM)', 0, 40, { size: 230, fam: FONT.cond, weight: '800', color: m < 0.5 ? '#fff' : '#141414', align: 'center', shadow: m < 0.5 ? 'rgba(0,0,0,.4)' : null, blur: 40 });
      g.restore();
    }
    if (fa >= 0.2 && t < 152.9) {
      board('100%', W / 2, 470, fa - 0.2, { align: 'c', cw: 70, ch: 100, gap: 5, color: OR });
    }
    // 馬賽克的標籤：07 PX → 21 PX → 60 PX
    const pxs = pixelAt(t);
    if (pxs) {
      const x = 40, y = 520;
      g.fillStyle = 'rgba(250,249,246,.94)';
      g.fillRect(x, y, 200, 110);
      text('MOSAIC · END OF SHOW', x + 12, y + 20, { size: 8.5, fam: FONT.mono, weight: '700', color: '#141414', track: 1 });
      text(`${pad(pxs)} PX`, x + 12, y + 66, { size: 40, fam: FONT.mono, weight: '700', color: '#141414' });
      for (let i = 0; i < 10; i++) {
        const r = 1.5 + i * 0.55;
        g.fillStyle = i < Math.round(pxs / 6) ? OR : '#141414';
        g.beginPath(); g.arc(x + 18 + i * 17, y + 92, r, 0, TAU); g.fill();
      }
    }
    // 最後：星星髮夾的微距 + 最後一張吊牌
    if (t >= 152.9) {
      const age = t - 153.2;
      if (age > 0) {
        const a = clamp(age / 0.3);
        text('we', 64, 300, { size: 13, fam: FONT.mono, weight: '500', color: '#141414', alpha: a });
        text('are', 64, 318, { size: 13, fam: FONT.mono, weight: '500', color: '#141414', alpha: clamp((age - 0.15) / 0.3) });
        text('so', 64, 336, { size: 13, fam: FONT.mono, weight: '500', color: '#141414', alpha: clamp((age - 0.3) / 0.3) });
        text('doomed', 64, 354, { size: 13, fam: FONT.mono, weight: '700', color: OR, alpha: clamp((age - 0.45) / 0.3) });
      }
    }
  }

  // 片尾卡：淡到白，中間一行字
  function endCard(t) {
    const k = ease.io(clamp((t - (END - 1.3)) / 1.0));
    g.fillStyle = `rgba(246,245,241,${k})`;
    g.fillRect(0, 0, W, H);
    const a = clamp((t - (END - 0.9)) / 0.4);
    text('I’M UPPING MY P(DOOM)', W / 2, H / 2 - 6, { size: 26, fam: FONT.wide, color: '#141414', align: 'center', track: 6, alpha: a });
    text('JINGSHEN EDITION · SS27 · END OF SHOW', W / 2, H / 2 + 28, { size: 11, fam: FONT.mono, weight: '700', color: OR, align: 'center', track: 4, alpha: a });
  }

  function flashes(t) {
    let f = 0;
    for (const [at, k] of FLASHES) {
      const age = t - at;
      if (age >= 0 && age < 0.5) f = Math.max(f, k * Math.exp(-age * 9));
    }
    const cutAge = t - lastCut(t);
    if (chorus(secAt(t).id) && cutAge < 0.2) f = Math.max(f, 0.22 * Math.exp(-cutAge * 18));
    if (reduced) f *= 0.3;
    if (f <= 0.01) return;
    g.fillStyle = `rgba(255,253,248,${clamp(f)})`;
    g.fillRect(0, 0, W, H);
  }

  // 底片：顆粒（每格換位置）與暗角；雪地暗角淡一點
  function film(m) {
    if (!grainPats) grainPats = GRAINS.map(c => g.createPattern(c, 'repeat'));
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const ox = Math.floor(rnd(FR, 31) * 256), oy = Math.floor(rnd(FR, 32) * 256);
    g.translate(-ox, -oy);
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = lerp(0.24, 0.16, m);
    g.fillStyle = grainPats[FR % 3];
    g.fillRect(ox, oy, cv.width, cv.height);
    g.restore();
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = lerp(0.8, 0.3, m);
    g.drawImage(VIGNETTE, 0, 0, cv.width, cv.height);
    g.restore();
  }

  /* =========================================================
     播放器：時間就是影片的 currentTime
     ========================================================= */
  const frame = $('.tr-frame', root);
  const toggle = $('.tr-toggle', root);
  const bigPlay = $('.tr-big-play', root);
  const timeEl = $('.tr-time', root);
  const caption = $('.tr-caption', root);
  const list = $('.tr-chapters', root);
  const fsBtn = $('.tr-fs', root);
  const soundBtn = $('.pd-sound', root);
  const unmute = $('.pd-unmute', root);
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const P = { playing: false, userPaused: reduced, inView: false, wantPlay: false, wantSeek: null, lastDraw: -1, autoMuted: false };
  // 影片網址要等剪接表讀到才知道；在那之前的播放與跳轉先記著
  const hasSrc = () => !!video.getAttribute('src');
  const now = () => Math.min(END, P.wantSeek != null ? P.wantSeek : video.currentTime || 0);

  const setPlaying = playing => {
    toggle.setAttribute('aria-pressed', String(!playing));
    toggle.setAttribute('aria-label', playing ? '暫停' : '播放');
    bigPlay.hidden = playing;
    bigPlay.setAttribute('aria-label', now() >= END - 0.05 ? '重新播放' : '播放');
    syncSoundUI();
  };
  const play = () => {
    if (P.playing) return;
    if (!hasSrc()) { P.wantPlay = true; return; }
    if (now() >= END - 0.05) video.currentTime = 0;
    P.playing = true;
    setPlaying(true);
    const pr = video.play();
    if (pr && pr.catch) pr.catch(err => {
      // 被 pause() 打斷的不算失敗
      if (err && err.name === 'AbortError') return;
      // 瀏覽器不讓有聲音自動播：改成靜音再播一次，記著等使用者第一次點擊時把聲音開回來
      if (!video.muted) {
        video.muted = true;
        P.autoMuted = true;
        syncSoundUI();
        video.play().catch(() => { P.playing = false; setPlaying(false); });
      } else { P.playing = false; setPlaying(false); }
    });
    loop();
  };
  const pause = () => {
    P.wantPlay = false;
    if (!P.playing) return;
    P.playing = false;
    video.pause();
    setPlaying(false);
    draw(true);
  };
  const seek = t => {
    if (!hasSrc()) P.wantSeek = clamp(t, 0, END);
    else video.currentTime = clamp(t, 0, END);
    draw(true);
  };
  video.addEventListener('seeked', () => draw(true));
  video.addEventListener('loadeddata', () => draw(true));
  video.addEventListener('progress', () => { if (!hasFrame()) draw(true); });
  video.addEventListener('ended', () => {
    P.playing = false;
    setPlaying(false);
    draw(true);
  });

  // 聲音：影片本身就帶著原曲，開聲音 = 取消靜音
  const syncSoundUI = () => {
    const on = !video.muted;
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? '關閉聲音' : '開啟聲音');
    unmute.hidden = !(P.playing && !on);
  };
  // 自動播被迫靜音時，使用者第一次點頁面任何地方（或按鍵）就開聲音；
  // 點的是畫面本身的話只開聲音、不暫停；點聲音鈕或「開聲音」提示交給它們自己處理
  const wake = e => {
    if (!P.autoMuted) return;
    // Esc、組合鍵這類不算使用者啟用；那時開聲音，瀏覽器會把影片停掉
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    P.autoMuted = false;
    if (e.target.closest && e.target.closest('.pd-sound, .pd-unmute')) return;
    video.muted = false;
    syncSoundUI();
    if (e.type === 'click' && P.playing && frame.contains(e.target) && !e.target.closest('.tr-big-play')) {
      e.stopPropagation();
    }
  };
  document.addEventListener('click', wake, true);
  document.addEventListener('keydown', wake, true);
  soundBtn.addEventListener('click', () => {
    P.autoMuted = false;
    video.muted = !video.muted;
    syncSoundUI();
    if (!video.muted && !P.playing) { P.userPaused = false; play(); }
  });
  unmute.addEventListener('click', e => {
    e.stopPropagation();
    video.muted = false;
    syncSoundUI();
  });

  // 段落進度列
  list.replaceChildren();
  const items = SECTIONS.map(c => {
    const li = document.createElement('li');
    li.style.setProperty('--len', c.t1 - c.t0);
    li.innerHTML = '<button type="button"><span class="bar"><i></i></span><span class="name"></span></button>';
    $('.name', li).textContent = c.name;
    const btn = $('button', li);
    btn.setAttribute('aria-label', `跳到「${c.name}」`);
    btn.addEventListener('click', () => {
      seek(c.t0 + 0.01);
      P.userPaused = false;
      play();
    });
    list.append(li);
    return { li, bar: $('i', li), c };
  });
  let curChapter = -1;
  const syncUI = t => {
    timeEl.textContent = `${fmt(t)} / ${fmt(END)}`;
    let idx = 0;
    items.forEach((it, i) => {
      it.bar.style.transform = `scaleX(${clamp((t - it.c.t0) / (it.c.t1 - it.c.t0))})`;
      if (t >= it.c.t0) idx = i;
    });
    if (idx !== curChapter) {
      curChapter = idx;
      items.forEach((it, i) => it.li.classList.toggle('is-on', i === idx));
      caption.textContent = items[idx].c.caption;
    }
  };

  const draw = (force = false) => {
    const t = now();
    const f = Math.floor(t * 48);
    if (force || f !== P.lastDraw) {
      P.lastDraw = f;
      render(t);
      syncUI(t);
    }
  };
  let raf = 0;
  const loop = () => {
    cancelAnimationFrame(raf);
    const step = () => {
      if (!P.playing) return;
      draw();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  toggle.addEventListener('click', () => {
    if (P.playing) { P.userPaused = true; pause(); } else { P.userPaused = false; play(); }
  });
  bigPlay.addEventListener('click', e => {
    e.stopPropagation();
    P.userPaused = false;
    play();
  });
  frame.addEventListener('click', e => {
    if (e.target.closest('.tr-big-play, .pd-unmute')) return;
    toggle.click();
  });
  const autoplay = () => {
    if (P.inView && !document.hidden && !P.userPaused && now() < END - 0.05) play();
    else if (P.playing) pause();
  };
  new IntersectionObserver(([entry]) => {
    P.inView = entry.intersectionRatio > 0.4;
    autoplay();
  }, { threshold: [0, 0.4, 0.8] }).observe(frame);
  document.addEventListener('visibilitychange', autoplay);
  if (fsBtn) {
    fsBtn.hidden = !document.fullscreenEnabled;
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else root.requestFullscreen().catch(() => {});
    });
    document.addEventListener('fullscreenchange', () => {
      const full = document.fullscreenElement === root;
      fsBtn.setAttribute('aria-pressed', String(full));
      fsBtn.setAttribute('aria-label', full ? '離開全螢幕' : '全螢幕');
    });
  }

  // 1280×720 畫布等比縮放；解析度跟著播放器在螢幕上的實際像素（上限 1.5 倍）
  const fit = () => {
    const w = frame.clientWidth, h = frame.clientHeight;
    const k = Math.min(w / 1280, h / 720) || 1;
    mg.style.setProperty('--k', k);
    mg.style.setProperty('--ox', `${(w - 1280 * k) / 2}px`);
    mg.style.setProperty('--oy', `${(h - 720 * k) / 2}px`);
    const r = Math.round(Math.min(1.5, Math.max(0.5, k * (window.devicePixelRatio || 1))) * 20) / 20;
    if (r !== R) {
      R = r;
      cv.width = Math.round(1280 * R);
      cv.height = Math.round(720 * R);
      grainPats = null;
      dotPat = null;
      draw(true);
    }
  };
  new ResizeObserver(fit).observe(frame);
  fit();

  // 字型載好之後重畫（canvas 不會自己等字型）
  if (document.fonts) {
    Promise.all([
      '800 40px "Barlow Condensed"', '700 40px "Barlow Condensed"', '40px Michroma', '500 40px Inter', '700 40px Inter',
      '500 40px "JetBrains Mono"', '700 40px "JetBrains Mono"',
    ].map(f => document.fonts.load(f).catch(() => {}))).then(() => draw(true));
  }
  // 剪接表每次都重新確認（影片網址帶內容雜湊，換片後不會拿到快取裡的舊影片）
  fetch('assets/pdoom-jingshen/edl.json', { cache: 'no-cache' }).then(r => r.json()).then(edl => {
    SHOTS = edl.shots.map(s => ({ ...s, t: s.b != null ? tb(s.b) : s.t }));
    video.src = `assets/pdoom-jingshen/${edl.video || 'pdoom-jingshen.mp4'}`;
  }).catch(() => {
    video.src = 'assets/pdoom-jingshen/pdoom-jingshen.mp4';
  }).then(() => {
    if (P.wantSeek != null) { video.currentTime = P.wantSeek; P.wantSeek = null; }
    draw(true);
    if (P.wantPlay) { P.wantPlay = false; play(); }
  });

  // #t=秒數：停在那一格
  const seekHash = () => {
    const mm = /(?:^|[#&])t=([\d.]+)/.exec(location.hash);
    if (!mm) return false;
    P.userPaused = true;
    pause();
    seek(Math.min(END, parseFloat(mm[1])));
    return true;
  };
  if (!seekHash() && reduced) seek(tb(33) + 1.2);
  window.addEventListener('hashchange', seekHash);
  setPlaying(false);
  draw(true);

  // 除錯用：在主控台 PJ.seek(秒)
  window.PJ = {
    seek: t => { P.userPaused = true; pause(); seek(t); },
    state: () => ({ t: +now().toFixed(3), playing: P.playing, muted: video.muted, ready: video.readyState, buffered: video.buffered.length ? +video.buffered.end(0).toFixed(1) : 0 }),
    sections: SECTIONS.map(s => [s.id, +s.t0.toFixed(2)]),
  };
})();
