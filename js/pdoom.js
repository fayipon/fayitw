/* =========================================================
   P(doom) MV（pdoom.html）：I'm Upping My P(doom) 的真人 MV
   - 影片：Seedance 2.0 生成的 16 段片段，照剪接表（assets/pdoom/edl.json）由 scripts/pdoom-edit.py
     剪成一支跟原曲等長的 assets/pdoom/pdoom.mp4（含原曲）；這裡把它一格一格畫到 canvas 上
   - 動態全部由這支程式疊上去：鼓點推鏡、震動、閃白、頻閃、色散與橫向撕裂、暈光、
     底片顆粒與片門晃動、黑邊開合、漏光，以及章節卡、地點時間、副歌大字、P(doom) 儀表
   - 主歌是日系（16mm、2.39:1 黑邊、暖色暈光），副歌是 K-pop（滿版、跟拍子推鏡、飽和、閃光）
   - 時間：以影片的 currentTime 為準（聲音就在影片裡，不會不同步）；拍點 88 BPM、第一拍在 0.21 秒
   - 網址加 #t=秒數 會停在那一格
   ========================================================= */
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const root = $('.pd-player');
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
  // 0 → 1 → 0：a 秒淡入、b 秒淡出
  const env = (age, len, a = 0.12, b = 0.18) => (age < 0 || age > len ? 0 : Math.min(clamp(age / a), clamp((len - age) / b)));

  /* ---------- 拍點與段落 ---------- */
  const BPM = 88, BEAT = 60 / BPM, OFF = 0.21, END = 156.7, FADE = 152.9;
  const tb = b => OFF + b * BEAT;
  const bt = t => (t - OFF) / BEAT;
  // look：j = 日系主歌、k = K-pop 副歌
  const SECTIONS = [
    { id: 'v1', name: '主歌一', t0: 0, look: 'j', caption: '第一話「火花」：她眼裡的火花、傍晚的平交道、深夜的便利商店；最後筆電的光把整個房間吞掉。' },
    { id: 'c1', name: '副歌一', t0: tb(33), look: 'k', pal: '#ff5fa2', caption: '副歌一：粉紅色機房布景，五人群舞。P(doom) 從 5% 開始往上爬。' },
    { id: 'v2', name: '主歌二', t0: tb(56), look: 'j', caption: '第二話「目覚め」：屋頂上的紙片、澀谷路口只有她停著不動、末班電車。' },
    { id: 'c2', name: '副歌二', t0: tb(86), look: 'k', pal: '#7f8cff', caption: '副歌二：鉻金屬八角星前的群舞，臉頰上的液態鉻眼淚。' },
    { id: 'v3', name: '主歌三', t0: tb(106), look: 'j', caption: '第三話「眠れない夜」：夕陽教室裡前進、倒帶、再前進；深夜計程車的急左轉。' },
    { id: 'c3', name: '副歌三', t0: tb(139), look: 'k', pal: '#ffc85a', caption: '副歌三：整首最安靜的一段，迴紋針從天而降，慢動作。' },
    { id: 'br', name: '橋段', t0: tb(160), look: 'k', pal: '#ff2a3a', caption: '橋段：紅色警報舞台，所有場景用半拍快切、故障撕裂。' },
    { id: 'c4', name: '副歌四', t0: tb(181), look: 'k', pal: '#ff9a3d', caption: '副歌四：白色舞台上的巨大星光，最後的隊形。' },
    { id: 'out', name: '尾聲', t0: tb(200), look: 'k', pal: '#ff9a3d', caption: '尾聲：最大聲的一段，所有鏡頭回來一次，然後「終」。' },
  ];
  SECTIONS.forEach((s, i) => { s.t1 = i + 1 < SECTIONS.length ? SECTIONS[i + 1].t0 : END; });
  const secAt = t => { let i = 0; while (i + 1 < SECTIONS.length && t >= SECTIONS[i + 1].t0) i++; return SECTIONS[i]; };
  // 畫面風格的時間軸：大致跟段落走，但副歌二最後一句（便利商店的面無表情）先切回日系
  const LOOKS = SECTIONS.map(s => [s.t0, s.look === 'k' ? 1 : 0]);
  LOOKS.splice(4, 0, [tb(101.5), 0]);
  // 日系 → K-pop 的混合比例（0 = 日系、1 = K-pop），在交界用 0.35 秒轉過去
  const kMix = t => {
    let i = 0;
    while (i + 1 < LOOKS.length && t >= LOOKS[i + 1][0]) i++;
    const [t0, cur] = LOOKS[i];
    const was = i ? LOOKS[i - 1][1] : cur;
    return lerp(was, cur, ease.io(clamp((t - t0) / 0.35)));
  };

  // 剪接表：切點用來做推鏡與閃光（影片本身已經照這張表剪好）
  let CUTS = [];
  const lastCut = t => { let c = 0; for (const x of CUTS) { if (x > t) break; c = x; } return c; };

  /* ---------- 畫面上的字（時間都綁在原曲的拍點或歌詞起點） ---------- */
  // 日系章節卡：直書的話數與標題
  const CHAPTERS_J = [
    { t: 1.6, len: 3.6, no: '第一話', title: '火花', en: 'EP.1 — SPARKS' },
    { t: tb(56) + 0.1, len: 3.4, no: '第二話', title: '目覚め', en: 'EP.2 — AWAKENING' },
    { t: tb(106) + 0.1, len: 3.4, no: '第三話', title: '眠れない夜', en: 'EP.3 — SLEEPLESS' },
  ];
  // 日系的地點與時間（左下角）
  const PLACES = [
    { t: 6.0, len: 2.8, jp: '東京都 下北沢', time: '18:42' },
    { t: 9.0, len: 3.6, jp: 'コンビニ', time: '01:13' },
    { t: 17.9, len: 3.4, jp: '自宅', time: '03:30' },
    { t: 38.6, len: 2.8, jp: '屋上', time: '17:05' },
    { t: 41.6, len: 3.0, jp: '渋谷', time: '18:30' },
    { t: 53.5, len: 3.6, jp: '最終電車', time: '00:24' },
    { t: 73.3, len: 3.0, jp: '教室', time: '16:50' },
    { t: 81.5, len: 3.0, jp: 'タクシー', time: '02:11' },
  ];
  // 錄影帶的倒帶字樣（教室那段倒放時）
  const REW = [tb(109.5), tb(112.5)];
  // P(doom) 儀表：[開始, 結束, 從, 到]（每拍跳一格，段落之間停住）
  const FINALE = 150.89;
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
  const meterOn = t => (t >= 22.7 && t < 72.9 && !(t > 38.4 && t < 58.8)) || t >= 94.9;
  // 閃白：段落交界與副歌第一拍
  const FLASHES = [[tb(33), 1], [tb(86), 1], [tb(139), 0.7], [tb(160), 1], [tb(181), 1], [tb(200), 0.8], [150.89, 1]];
  // 故障：[開始, 結束, 強度]
  const GLITCH = [[22.45, 22.95, 1], [58.6, 59.1, 1], [102.4, 102.9, 0.6], [131.9, 133.4, 0.8], [150.6, 151.1, 1]];
  const glitchAt = t => {
    // 橋段：每一拍的拍頭撕一下
    const br = t >= tb(160) && t < tb(181) ? 0.7 * Math.exp(-frac(bt(t)) * 12) : 0;
    return GLITCH.reduce((m, [a, b, k]) => (t >= a && t < b ? Math.max(m, k) : m), br > 0.15 ? br : 0);
  };
  // 頻閃：橋段的每個反拍
  const strobeAt = t => (t >= tb(160) && t < tb(181) ? Math.exp(-frac(bt(t) + 0.5) * 14) * 0.22 : 0);

  /* ---------- 畫布 ---------- */
  const W = 1280, H = 720;
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  mg.classList.add('pd-film');
  mg.replaceChildren(cv);
  let R = 1;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // 暈光：縮成小圖再放大（雙線性放大本身就是模糊），只留亮部
  const SM1 = mk(160, 90), SM2 = mk(160, 90);
  const s1 = SM1.getContext('2d'), s2 = SM2.getContext('2d');
  // 色散：紅、青兩張分色
  const CR = mk(640, 360), CC = mk(640, 360);
  const cr = CR.getContext('2d'), cc = CC.getContext('2d');
  // 底片顆粒：三張雜訊輪流用
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
  let grainPats = null;
  const VIGNETTE = (() => {
    const c = mk(640, 360), x = c.getContext('2d');
    const gr = x.createRadialGradient(320, 180, 110, 320, 180, 400);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,.55)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 640, 360);
    return c;
  })();

  /* ---------- 影片 ---------- */
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.preload = 'auto';
  video.className = 'pd-src';
  video.style.cssText = 'position:absolute;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  mg.append(video);
  const hasFrame = () => video.readyState >= 2 && video.videoWidth > 0;

  /* ---------- 畫圖工具 ---------- */
  const FONT = {
    hook: 'Anton, "Arial Narrow", Impact, sans-serif',
    sans: 'Inter, "Noto Sans TC", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    serif: '"Instrument Serif", Georgia, serif',
    jp: '"Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", serif',
  };
  const font = (size, fam, weight = '') => `${weight ? weight + ' ' : ''}${size}px ${fam}`;
  // 一行字（track = 字距，用逐字畫，避免依賴 letterSpacing）
  const text = (s, x, y, o = {}) => {
    g.save();
    g.font = font(o.size || 32, o.fam || FONT.sans, o.weight);
    g.textBaseline = o.base || 'alphabetic';
    g.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    g.fillStyle = o.color || '#fff';
    const track = o.track || 0;
    const chars = [...s];
    const w = chars.reduce((a, ch) => a + g.measureText(ch).width, 0) + track * (chars.length - 1);
    let cx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    if (o.shadow) { g.shadowColor = o.shadow; g.shadowBlur = o.blur || 18; }
    if (!track) {
      g.textAlign = 'left';
      g.fillText(s, cx, y);
    } else {
      chars.forEach(ch => { g.fillText(ch, cx, y); cx += g.measureText(ch).width + track; });
    }
    g.restore();
    return w;
  };
  const measure = (s, size, fam, weight, track = 0) => {
    g.save();
    g.font = font(size, fam, weight);
    const chars = [...s];
    const w = chars.reduce((a, ch) => a + g.measureText(ch).width, 0) + track * (chars.length - 1);
    g.restore();
    return w;
  };
  // 直書（日文）：一個字一格往下排
  const vtext = (s, x, y, o = {}) => {
    const size = o.size || 40;
    [...s].forEach((ch, i) => {
      const k = o.ages ? clamp(o.ages[i] / 0.25) : 1;
      if (k <= 0) return;
      text(ch, x, y + i * size * (o.lead || 1.12), { ...o, size, align: 'center', base: 'top', alpha: (o.alpha == null ? 1 : o.alpha) * k });
    });
  };
  // 歌詞的動態排版（js/pdoom-lyrics.js）
  const LYR = window.PDoomLyrics && window.ClaudePopKit ? window.PDoomLyrics({ g, W, H, clamp, lerp, frac, ease, vtext, px: () => R }) : { draw() {}, impact: () => 0 };

  /* ---------- 一格 ---------- */
  let T = 0, FR = 0;
  // 把影片畫滿畫面：z = 放大、(x, y) = 位移、r = 旋轉
  const drawVideo = (z = 1, x = 0, y = 0, r = 0) => {
    g.save();
    g.translate(W / 2 + x, H / 2 + y);
    if (r) g.rotate(r);
    g.scale(z, z);
    g.drawImage(video, -W / 2, -H / 2, W, H);
    g.restore();
  };

  function render(t) {
    T = t;
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
    const km = kMix(t);
    const b = bt(t);
    const kick = Math.exp(-frac(b) * 7);
    const cutAge = t - lastCut(t);

    // 鏡頭：K-pop 跟拍子推、切點一進來先放大再收；日系只有片門的細微晃動
    const punch = Math.exp(-cutAge * 9) * (0.05 + 0.05 * km);
    let z = 1.02 + punch + km * 0.03 * kick;
    let sx = 0, sy = 0, rot = 0;
    if (km > 0.5 && sec.id === 'br') {
      sx = (rnd(FR, 3) - 0.5) * 14 * kick;
      sy = (rnd(FR, 4) - 0.5) * 10 * kick;
      rot = (rnd(FR, 5) - 0.5) * 0.012 * kick;
    }
    const weave = 1 - km;
    sx += (rnd(FR, 1) - 0.5) * 1.6 * weave;
    sy += (rnd(FR, 2) - 0.5) * 1.6 * weave;
    // 歌詞砸下來的重拍：鏡頭跟著推近、晃一下
    const imp = reduced ? 0 : LYR.impact(t);
    z += imp * 0.06;
    sx += (rnd(FR, 51) - 0.5) * 26 * imp;
    sy += (rnd(FR, 52) - 0.5) * 18 * imp;
    rot += (rnd(FR, 53) - 0.5) * 0.02 * imp;
    // 尾聲最後慢慢推近
    if (t > 150.9) z += (t - 150.9) * 0.012;

    const gl = reduced ? 0 : glitchAt(t);
    if (gl > 0 && rnd(FR, 9) < 0.35 + gl * 0.5) glitchFrame(gl, z, sx, sy);
    else drawVideo(z, sx, sy, rot);

    grade(km, sec);
    letterbox(t, km);
    overlays(t, sec, km);
    flashes(t);
    film(km);
    // 開頭從黑淡入
    if (t < 1.2) {
      g.fillStyle = `rgba(5,5,5,${1 - ease.io(clamp(t / 1.2))})`;
      g.fillRect(0, 0, W, H);
    }
    // 結尾：淡出到黑，最後一個字「終」
    if (t > FADE) {
      g.fillStyle = `rgba(5,5,5,${ease.io(clamp((t - FADE) / 2.2))})`;
      g.fillRect(0, 0, W, H);
      const k = clamp((t - FADE - 1.4) / 0.6);
      if (k > 0) {
        vtext('終', W / 2, H / 2 - 40, { size: 72, fam: FONT.jp, weight: '900', color: '#f4efe6', alpha: k });
        text('I’M UPPING MY P(DOOM)', W / 2, H / 2 + 92, { size: 15, fam: FONT.mono, weight: '700', color: '#f4efe6', align: 'center', track: 5, alpha: k * 0.8 });
      }
    }
  }

  function loadingCard() {
    const p = video.buffered.length && video.duration ? clamp(video.buffered.end(0) / Math.min(8, video.duration)) : 0;
    text('I’M UPPING MY', W / 2, 300, { size: 22, fam: FONT.mono, weight: '700', color: '#f4efe6', align: 'center', track: 8, alpha: 0.7 });
    text('P(DOOM)', W / 2, 410, { size: 120, fam: FONT.hook, color: '#f4efe6', align: 'center', track: 4 });
    g.fillStyle = 'rgba(244,239,230,.18)';
    g.fillRect(490, 450, 300, 3);
    g.fillStyle = '#ff3d6e';
    g.fillRect(490, 450, 300 * p, 3);
    text('LOADING', W / 2, 486, { size: 12, fam: FONT.mono, weight: '700', color: '#f4efe6', align: 'center', track: 6, alpha: 0.6 });
  }

  // 故障：橫向撕裂 + 紅青色散
  function glitchFrame(gl, z, sx, sy) {
    const n = 7 + Math.floor(rnd(FR, 11) * 6);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const h = i === n - 1 ? H - y : Math.round((H / n) * (0.4 + rnd(FR * 7 + i, 12) * 1.2));
      const off = (rnd(FR * 13 + i, 14) - 0.5) * 120 * gl * (rnd(FR + i, 15) < 0.55 ? 1 : 0.1);
      g.save();
      g.beginPath();
      g.rect(0, y, W, h);
      g.clip();
      drawVideo(z, sx + off, sy);
      g.restore();
      y += h;
      if (y >= H) break;
    }
    // 色散：紅、青各一張，用 screen 疊回去
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
    g.globalAlpha = 0.55 * gl;
    g.drawImage(CR, -d, 0, W, H);
    g.drawImage(CC, d, 0, W, H);
    g.restore();
  }

  // 調色：日系 = 抬黑、偏暖、紅色暈光；K-pop = 亮部發光、每段一個主色
  function grade(km, sec) {
    s1.globalCompositeOperation = 'source-over';
    s1.drawImage(cv, 0, 0, 160, 90);
    // 只留亮部：自己乘自己兩次
    s2.globalCompositeOperation = 'source-over';
    s2.drawImage(SM1, 0, 0);
    s2.globalCompositeOperation = 'multiply';
    s2.drawImage(SM1, 0, 0);
    s2.drawImage(SM1, 0, 0);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const cw = cv.width, ch = cv.height;
    // 日系
    if (km < 1) {
      const j = 1 - km;
      s1.globalCompositeOperation = 'source-over';
      s1.drawImage(SM2, 0, 0);
      s1.globalCompositeOperation = 'multiply';
      s1.fillStyle = '#ff6a3a';
      s1.fillRect(0, 0, 160, 90);
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.55 * j;
      g.drawImage(SM1, 0, 0, cw, ch);
      g.globalAlpha = 0.1 * j;
      g.fillStyle = '#2a3a55';
      g.fillRect(0, 0, cw, ch);
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = 0.28 * j;
      g.fillStyle = '#ffb27a';
      g.fillRect(0, 0, cw, ch);
    }
    // K-pop
    if (km > 0) {
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.5 * km;
      g.drawImage(SM2, 0, 0, cw, ch);
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = 0.3 * km;
      g.fillStyle = sec.pal || '#ff5fa2';
      g.fillRect(0, 0, cw, ch);
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = 0.12 * km;
      g.fillStyle = '#808080';
      g.fillRect(0, 0, cw, ch);
    }
    g.restore();
  }

  // 黑邊：日系 2.39:1，K-pop 打開成滿版
  function letterbox(t, km) {
    const h = 92 * (1 - km);
    if (h < 0.5) return;
    g.fillStyle = '#050505';
    g.fillRect(0, 0, W, h);
    g.fillRect(0, H - h, W, h);
  }

  function overlays(t, sec, km) {
    // 日系章節卡：右側直書
    for (const c of CHAPTERS_J) {
      const age = t - c.t, a = env(age, c.len, 0.5, 0.6);
      if (a <= 0) continue;
      const ages = [...(c.no + c.title)].map((_, i) => age - 0.15 - i * 0.09);
      vtext(c.no, 1150, 150, { size: 26, fam: FONT.jp, weight: '700', color: '#f4efe6', alpha: a * 0.85, ages: ages.slice(0, c.no.length) });
      vtext(c.title, 1090, 150, { size: 54, fam: FONT.jp, weight: '900', color: '#f4efe6', alpha: a, lead: 1.08, ages: ages.slice(c.no.length) });
      g.fillStyle = `rgba(244,239,230,${0.6 * a})`;
      g.fillRect(1124, 150, 1, 120 * ease.out(clamp(age / 0.8)));
      text(c.en, 1180, 590, { size: 12, fam: FONT.mono, weight: '700', color: '#f4efe6', align: 'right', track: 4, alpha: a * 0.7 });
    }
    // 地點與時間：左下角
    for (const p of PLACES) {
      const age = t - p.t, a = env(age, p.len, 0.3, 0.4);
      if (a <= 0) continue;
      const ty = 560;
      text(p.time, 72, ty, { size: 13, fam: FONT.mono, weight: '700', color: '#f4efe6', track: 3, alpha: a * 0.8 });
      text(p.jp, 72, ty + 34, { size: 26, fam: FONT.jp, weight: '700', color: '#f4efe6', track: 6, alpha: a });
      g.fillStyle = `rgba(255,61,110,${a})`;
      g.fillRect(60, ty - 12, 3, 52);
    }
    // 倒帶：像錄影帶的螢幕顯示，左上角閃
    if (t >= REW[0] && t < REW[1] + 1.2) {
      const rew = t < REW[1];
      if (!rew || frac(t * 1.6) < 0.62) {
        text(rew ? '◀◀ REW' : '▶ PLAY', 72, 150, { size: 30, fam: FONT.mono, weight: '700', color: '#f4efe6', track: 4, alpha: 0.9, shadow: 'rgba(0,0,0,.5)', blur: 6 });
      }
    }
    // 尾聲的最高點：儀表破表，P(DOOM) 100%
    const fa = t - FINALE;
    if (fa >= 0 && fa < FADE - FINALE + 0.4) {
      const a = env(fa, FADE - FINALE + 0.4, 0.03, 0.8);
      const s = 1 + 0.5 * Math.exp(-fa * 9);
      const jit = fa < 0.6 ? (rnd(FR, 23) - 0.5) * 20 : 0;
      g.fillStyle = `rgba(0,0,0,${0.32 * a})`;
      g.fillRect(0, 0, W, H);
      g.save();
      g.translate(W / 2, H / 2 - 10);
      g.scale(s, s);
      g.globalCompositeOperation = 'screen';
      text('P(DOOM)', -8 + jit, 10, { size: 200, fam: FONT.hook, color: '#ff2a6a', align: 'center', track: 6, alpha: a * 0.9 });
      text('P(DOOM)', 8 - jit, 10, { size: 200, fam: FONT.hook, color: '#00e5ff', align: 'center', track: 6, alpha: a * 0.9 });
      g.globalCompositeOperation = 'source-over';
      text('P(DOOM)', 0, 10, { size: 200, fam: FONT.hook, color: '#fff', align: 'center', track: 6, alpha: a, shadow: 'rgba(0,0,0,.4)', blur: 40 });
      text('100%', 0, 150, { size: 120, fam: FONT.hook, color: '#ff2a3a', align: 'center', track: 4, alpha: a * clamp((fa - 0.25) / 0.1), shadow: 'rgba(255,42,58,.6)', blur: 36 });
      g.restore();
    }
    // 歌詞：每一句一個版型（js/pdoom-lyrics.js）
    LYR.draw(t);
    // K-pop 的 HUD：四角框線、REC、時間碼、P(doom) 儀表
    if (km > 0.02) hud(t, km);
  }

  function hud(t, km) {
    const a = km;
    g.save();
    g.globalAlpha = a;
    g.strokeStyle = 'rgba(255,255,255,.75)';
    g.lineWidth = 2;
    const m = 34, l = 34;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, dx, dy]) => {
      g.beginPath();
      g.moveTo(x, y + dy * l);
      g.lineTo(x, y);
      g.lineTo(x + dx * l, y);
      g.stroke();
    });
    if (frac(t) < 0.6) {
      g.fillStyle = '#ff2a3a';
      g.beginPath();
      g.arc(m + 22, m + 30, 6, 0, TAU);
      g.fill();
    }
    text('REC', m + 36, m + 35, { size: 14, fam: FONT.mono, weight: '700', color: '#fff', track: 3 });
    const tc = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}:${String(Math.floor(frac(t) * 24)).padStart(2, '0')}`;
    text(tc, W - m - 12, H - m - 14, { size: 14, fam: FONT.mono, weight: '700', color: '#fff', align: 'right', track: 2 });
    text('88 BPM', m + 14, H - m - 14, { size: 14, fam: FONT.mono, weight: '700', color: '#fff', track: 2 });
    g.restore();
    if (meterOn(t)) meter(t, km);
  }

  // P(doom) 儀表：右側直立的刻度條
  function meter(t, km) {
    const v = pdoomAt(t);
    const x = W - 92, y0 = 150, h = 380;
    const col = v < 40 ? '#ffc85a' : v < 75 ? '#ff7a3a' : '#ff2a3a';
    g.save();
    g.globalAlpha = km;
    g.fillStyle = 'rgba(10,10,10,.45)';
    g.fillRect(x - 10, y0 - 40, 56, h + 96);
    g.strokeStyle = 'rgba(255,255,255,.6)';
    g.lineWidth = 1;
    g.strokeRect(x, y0, 14, h);
    for (let i = 0; i <= 10; i++) {
      g.fillStyle = 'rgba(255,255,255,.6)';
      g.fillRect(x + 18, y0 + (h * i) / 10, i % 5 ? 6 : 12, 1);
    }
    const fh = (h * v) / 100;
    g.fillStyle = col;
    g.shadowColor = col;
    g.shadowBlur = 16;
    g.fillRect(x + 2, y0 + h - fh, 10, fh);
    g.restore();
    text('P(DOOM)', x + 18, y0 - 16, { size: 12, fam: FONT.mono, weight: '700', color: '#fff', align: 'center', track: 2, alpha: km });
    text(`${v >= 100 ? '100' : v >= 99.9 ? '99.9' : Math.floor(v)}%`, x + 18, y0 + h + 36, { size: 22, fam: FONT.mono, weight: '700', color: col, align: 'center', alpha: km });
  }

  function flashes(t) {
    let f = strobeAt(t);
    for (const [at, k] of FLASHES) {
      const age = t - at;
      if (age >= 0 && age < 0.5) f = Math.max(f, k * Math.exp(-age * 9));
    }
    // K-pop 段落裡每個切點一個小閃光
    const km = kMix(t);
    const cutAge = t - lastCut(t);
    if (km > 0.5 && cutAge < 0.2) f = Math.max(f, 0.28 * Math.exp(-cutAge * 18));
    if (reduced) f *= 0.3;
    if (f <= 0.01) return;
    g.fillStyle = `rgba(255,252,246,${clamp(f)})`;
    g.fillRect(0, 0, W, H);
  }

  // 底片：顆粒（每格換位置）、日系多一點；暗角
  function film(km) {
    if (!grainPats) grainPats = GRAINS.map(c => g.createPattern(c, 'repeat'));
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const ox = Math.floor(rnd(FR, 31) * 256), oy = Math.floor(rnd(FR, 32) * 256);
    g.translate(-ox, -oy);
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = lerp(0.32, 0.14, km);
    g.fillStyle = grainPats[FR % 3];
    g.fillRect(ox, oy, cv.width, cv.height);
    g.restore();
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = lerp(0.9, 0.6, km);
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

  const P = { playing: false, userPaused: reduced, inView: false, wantPlay: false, wantSeek: null, lastDraw: -1 };
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
    if (pr && pr.catch) pr.catch(() => {
      // 瀏覽器不讓有聲音自動播：改成靜音再播一次
      if (!video.muted) { video.muted = true; syncSoundUI(); video.play().catch(() => { P.playing = false; setPlaying(false); }); }
      else { P.playing = false; setPlaying(false); }
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
  soundBtn.addEventListener('click', () => {
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
      draw(true);
    }
  };
  new ResizeObserver(fit).observe(frame);
  fit();

  // 字型載好之後重畫（canvas 不會自己等字型）
  if (document.fonts) {
    Promise.all([
      '40px Anton', '40px "Archivo Black"', '700 40px "JetBrains Mono"', '40px "Instrument Serif"', 'italic 40px "Instrument Serif"', '700 40px Inter', '800 40px Inter',
    ].map(f => document.fonts.load(f).catch(() => {})).concat(
      document.fonts.load('900 40px "Noto Serif JP"', '第一話火花終死神の目').catch(() => {}),
      document.fonts.load('700 40px "Noto Serif JP"', '東京都下北沢コンビニ').catch(() => {}),
    )).then(() => draw(true));
  }
  // 剪接表每次都重新確認（影片網址帶內容雜湊，換片後不會拿到快取裡的舊影片）
  fetch('assets/pdoom/edl.json', { cache: 'no-cache' }).then(r => r.json()).then(edl => {
    CUTS = edl.shots.map(s => (s.b != null ? tb(s.b) : s.t)).filter(x => x > 0);
    video.src = `assets/pdoom/${edl.video || 'pdoom.mp4'}`;
  }).catch(() => {
    video.src = 'assets/pdoom/pdoom.mp4';
  }).then(() => {
    if (P.wantSeek != null) { video.currentTime = P.wantSeek; P.wantSeek = null; }
    draw(true);
    if (P.wantPlay) { P.wantPlay = false; play(); }
  });

  // #t=秒數：停在那一格
  const seekHash = () => {
    const m = /(?:^|[#&])t=([\d.]+)/.exec(location.hash);
    if (!m) return false;
    P.userPaused = true;
    pause();
    seek(Math.min(END, parseFloat(m[1])));
    return true;
  };
  if (!seekHash() && reduced) seek(tb(33) + 1.2);
  window.addEventListener('hashchange', seekHash);
  setPlaying(false);
  draw(true);

  // 除錯用：在主控台 PDoom.seek(秒)
  window.PDoom = {
    seek: t => { P.userPaused = true; pause(); seek(t); },
    state: () => ({ t: +now().toFixed(3), playing: P.playing, muted: video.muted, ready: video.readyState, buffered: video.buffered.length ? +video.buffered.end(0).toFixed(1) : 0 }),
    sections: SECTIONS.map(s => [s.id, +s.t0.toFixed(2)]),
  };
})();
