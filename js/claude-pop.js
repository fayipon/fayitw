/* =========================================================
   Claude Pop（claude-pop.html）：真人 × 剪紙的音樂錄影帶
   原創歌曲（js/claude-pop-song.js）一路加速：104 → 330 BPM，然後在奇點切斷、留白、日出收尾
   - 演員與場景：Leonardo 生成的真人劇照（assets/claude-pop/，同一個人帶著長相參考圖生成）；
     舞台三人照另外去背，疊回原位就能把字夾在人和背景之間
   - 動態全部由這支程式做：鏡頭推移、跟拍子切動作、對嘴（閉嘴／張嘴兩張照片跟著合成人聲淡入淡出）、
     複製人海、撕紙轉場、漏光、黑邊，以及歌詞排版、HUD、紙紋與網點
   - 畫面：1280×720 canvas，每秒 24 格
   - 時間：有聲音時以 AudioContext 的輸出時間為準（扣掉輸出延遲），靜音時用 performance.now()；
     畫面、歌詞、嘴型、HUD 都從同一張拍點表（S.tb / S.bt）取時間
   - 分鏡：26 個鏡頭，綁在拍點上（SHOTS）；每個鏡頭是一個「時間 → 畫面」的純函式，
     所以可以任意跳轉、倒帶，蒙太奇也能直接借別的鏡頭來畫
   - 網址加 #t=秒數 會停在那一格
   ========================================================= */
(() => {
  const S = window.ClaudePopSong;
  const KIT = window.ClaudePopKit;
  const $ = (s, root = document) => root.querySelector(s);
  const root = $('.cp-player');
  const mg = root && $('.mg', root);
  if (!S || !KIT || !mg) return;
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
    s: k => k * k * (3 - 2 * k),
  };
  const spring = (age, f = 16, d = 7) => (age <= 0 ? 0 : 1 - Math.exp(-d * age) * Math.cos(f * age));
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mixC = (a, b, k) => {
    const x = hex(a), y = hex(b);
    return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], clamp(k)))).join(',')})`;
  };

  /* ---------- 畫布 ---------- */
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  mg.classList.add('cp-film');
  mg.replaceChildren(cv);
  let R = 1, Z = 1;
  let T = 0, B = 0, T12 = 0, FR12 = 0, NOLYR = false;
  const K = KIT(g, { px: () => R * Z, frame: () => FR12 });
  const { C, F } = K;
  const SERIF_MATH = `"Instrument Serif", "Cambria Math", "Times New Roman", serif`;

  const mk = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  };
  // 紙紋：一張用 multiply 疊（淺色紙上的纖維與雜點），一張用 screen 疊（深色紙上的纖維）
  const grain = (light) => mk(512, 512, (c, w, h) => {
    const im = c.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const n = Math.random();
      const v = light ? 255 - n * n * 34 : n * n * 70;
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
      im.data[i * 4 + 3] = 255;
    }
    c.putImageData(im, 0, 0);
    c.lineCap = 'round';
    for (let i = 0; i < 220; i++) {
      c.strokeStyle = light ? `rgba(90,70,40,${0.04 + Math.random() * 0.06})` : `rgba(255,250,235,${0.05 + Math.random() * 0.08})`;
      c.lineWidth = 0.6 + Math.random() * 1.2;
      const x = Math.random() * w, y = Math.random() * h, a = Math.random() * TAU, l = 8 + Math.random() * 40;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.stroke();
    }
  });
  const GRAIN_M = grain(true);
  const GRAIN_S = grain(false);
  let patM = null, patS = null;
  const VIGNETTE = mk(640, 360, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(25,14,6,.32)');
    c.fillStyle = gr;
    c.fillRect(0, 0, w, h);
  });

  /* ---------- 鏡頭與共用 ---------- */
  const W = 1280, H = 720, CX = 640, CY = 360;
  // 鏡頭：繞畫面中心縮放、旋轉，再把內容平移 (ox, oy)
  const cam = (ox = 0, oy = 0, z = 1, r = 0) => {
    Z = z;
    g.setTransform(R, 0, 0, R, 0, 0);
    g.translate(CX, CY);
    if (r) g.rotate(r);
    g.scale(z, z);
    g.translate(-CX + ox, -CY + oy);
  };
  const screen = () => cam(0, 0, 1, 0);
  const fillAll = c => {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = c;
    g.fillRect(0, 0, cv.width, cv.height);
    g.restore();
  };
  const pulse = (k = 6, b = B) => Math.exp(-frac(b) * k);
  const tAt = b => S.tb(b);
  const ageAt = b => T - S.tb(b);
  const L = id => S.lineById[id];
  const wd = (id, i) => L(id).words[i];
  const wAge = (id, i) => T - wd(id, i).t0;
  const sAge = (id, i) => T - L(id).syl[i].t0;
  // 一個字的每個字母各自什麼時候出現（照音節）
  const letterAges = (id, i, gap = 0.016) => {
    const ages = [];
    wd(id, i).syl.forEach(s => {
      [...s.txt].forEach((ch, j) => ages.push(T - s.t0 - j * gap));
    });
    return ages;
  };
  const up = s => s.toUpperCase();
  const mouthNow = () => (NOLYR ? 0 : S.mouth(T).open);

  /* ---------- 真人劇照（Leonardo 生成，assets/claude-pop/） ----------
     photos.json 記每張的尺寸；去背圖（-cut）分兩種：
     舞台三人照的去背跟原照片同一個畫框（疊回原位就能把字夾在人後面），
     走路與伴舞的去背裁到人物外框，當貼紙用 */
  const PHOTO_DIR = 'assets/claude-pop/';
  const PH = {};
  const media = { ready: false, progress: 0, failed: false };
  const loadPhotos = () => fetch(PHOTO_DIR + 'photos.json')
    .then(r => r.json())
    .then(meta => {
      const list = [];
      Object.entries(meta).forEach(([name, m]) => {
        PH[name] = { m };
        if (m.w) list.push([name, 'img', `${name}.webp`]);
        if (m.cut) list.push([name, 'cut', `${name}-cut.webp`]);
      });
      let n = 0;
      const tick = () => { n++; media.progress = n / list.length; if (media.onProgress) media.onProgress(); };
      return Promise.all(list.map(([name, kind, file]) => new Promise(done => {
        const im = new Image();
        im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => { tick(); done(); });
        im.onerror = () => { tick(); done(); };
        im.src = PHOTO_DIR + file;
        PH[name][kind] = im;
      })));
    })
    .catch(() => { media.failed = true; })
    .then(() => { media.ready = true; });

  // 劇照鋪滿 1280×720（cover）；z 放大、(x, y) 平移；cut 畫去背層（跟原照片同一個位置）
  const coverOf = (name, o = {}) => {
    const p = PH[name];
    if (!p) return null;
    const full = o.cut ? p.m.cut && p.m.cut.full : [p.m.w, p.m.h];
    const im = o.cut ? p.cut : p.img;
    if (!full || !im || !im.naturalWidth) return null;
    const k = Math.max(1280 / full[0], 720 / full[1]) * (o.z || 1);
    return { p, im, k, ox: 640 + (o.x || 0) - (full[0] * k) / 2, oy: 360 + (o.y || 0) - (full[1] * k) / 2 };
  };
  const photo = (name, o = {}, c = g) => {
    const f = coverOf(name, o);
    if (!f) return false;
    const box = o.cut ? f.p.m.cut.box : [0, 0];
    if (o.alpha != null) c.globalAlpha = clamp(o.alpha);
    c.drawImage(f.im, f.ox + box[0] * f.k, f.oy + box[1] * f.k, f.im.naturalWidth * f.k, f.im.naturalHeight * f.k);
    c.globalAlpha = 1;
    return true;
  };
  // 去背貼紙：腳底中心在 (x, y)，高 h
  const sprite = (name, x, y, h, o = {}) => {
    const p = PH[name];
    const im = p && p.cut;
    if (!im || !im.naturalWidth) return;
    const w = (h * im.naturalWidth) / im.naturalHeight;
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    if (o.flip) g.scale(-1, 1);
    if (o.alpha != null) g.globalAlpha = o.alpha;
    if (o.shadow) K.shadow(o.shadow);
    g.drawImage(im, -w / 2, -h, w, h);
    K.noShadow();
    g.restore();
  };
  // 舞台去背（同畫框）只取人物外框那一塊，縮小蓋章：腳底中心 (x, y)，高 h
  const stamp = (name, x, y, h) => {
    const p = PH[name];
    const im = p && p.cut;
    if (!im || !im.naturalWidth) return;
    const [x0, y0, x1, y1] = p.m.cut.bbox;
    const s = h / (y1 - y0);
    g.drawImage(im, x0, y0, x1 - x0, y1 - y0, x - ((x1 - x0) * s) / 2, y - h, (x1 - x0) * s, h);
  };
  // 單色剪影：把去背層染成一個顏色（倒數最後一拍的三人剪影）
  const tintCv = document.createElement('canvas');
  const photoTint = (name, color, o = {}) => {
    if (tintCv.width !== cv.width || tintCv.height !== cv.height) {
      tintCv.width = cv.width;
      tintCv.height = cv.height;
    }
    const c = tintCv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, tintCv.width, tintCv.height);
    c.setTransform(g.getTransform());
    photo(name, { ...o, cut: true }, c);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, tintCv.width, tintCv.height);
    c.globalCompositeOperation = 'source-over';
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(tintCv, 0, 0);
    g.restore();
  };

  /* ---------- MV 的鏡頭語言 ---------- */
  // 每一拍輕輕往前推一下
  const punch = (k = 0.03, sharp = 8) => 1 + k * pulse(sharp);
  // 剛切進來的那兩格閃一下
  const cutFlash = (age, color = '#ffffff', a = 0.55) => {
    if (age < 0 || age > 0.09) return;
    g.globalAlpha = a * (1 - age / 0.09);
    fillAll(color);
    g.globalAlpha = 1;
  };
  // 電影黑邊
  const letterbox = (h = 52) => {
    screen();
    g.fillStyle = '#000';
    g.fillRect(0, 0, 1280, h);
    g.fillRect(0, 720 - h, 1280, h);
  };
  // 調色：整張蓋一層顏色（multiply / screen / soft-light…）
  const grade = (color, a, mode = 'soft-light') => {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = mode;
    g.globalAlpha = a;
    g.fillStyle = color;
    g.fillRect(0, 0, cv.width, cv.height);
    g.restore();
  };
  // 漏光：一團慢慢飄的暖光
  const leak = (x, y, r, color, a = 0.5) => {
    g.save();
    g.setTransform(R, 0, 0, R, 0, 0);
    g.globalCompositeOperation = 'screen';
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = a;
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
  };
  // 字的底：從某一邊漸層壓暗（或壓亮），讓字在照片上讀得清楚
  const scrim = (side = 'left', w = 620, a = 0.6, color = '0,0,0') => {
    g.save();
    g.setTransform(R, 0, 0, R, 0, 0);
    const gr = side === 'left' ? g.createLinearGradient(0, 0, w, 0)
      : side === 'right' ? g.createLinearGradient(1280, 0, 1280 - w, 0)
        : side === 'bottom' ? g.createLinearGradient(0, 720, 0, 720 - w)
          : g.createLinearGradient(0, 0, 0, w);
    gr.addColorStop(0, `rgba(${color},${a})`);
    gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 1280, 720);
    g.restore();
  };
  // 撕紙轉場：一張紙從下往上被撕開，露出底下的畫面
  const tearReveal = (age, dur = 0.42, color = C.cream) => {
    if (age >= dur) return;
    const k = ease.io(clamp(age / dur));
    const y = 760 - k * 880;
    screen();
    g.beginPath();
    g.moveTo(-20, -40);
    g.lineTo(1300, -40);
    g.lineTo(1300, y);
    K.torn(1300, y, -20, y + 30, 77, 16, 22, false);
    g.closePath();
    K.fillPaper(color, 4);
  };

  // 卡拉 OK 字幕：唱到哪個字，那個字才出現；正在唱的字可以換顏色
  const karaoke = (id, x, y, o = {}) => {
    if (NOLYR) return;
    const line = L(id);
    const size = o.size || 44;
    const f = K.font(size, o.fam || F.serif, o.weight || '', o.italic);
    g.font = f;
    const space = g.measureText(' ').width;
    const items = line.words.map(w => {
      const s = o.upper ? up(w.txt) : w.txt;
      return { w, s, wd: (g.font = f, g.measureText(s).width) };
    });
    const rows = [[]];
    let rw = 0;
    const maxW = o.maxW || 1100;
    items.forEach(it => {
      if (rw + it.wd > maxW && rows[rows.length - 1].length) { rows.push([]); rw = 0; }
      rows[rows.length - 1].push(it);
      rw += it.wd + space;
    });
    const lh = size * (o.lh || 1.18);
    rows.forEach((row, ri) => {
      const rowW = row.reduce((a, it) => a + it.wd, 0) + space * (row.length - 1);
      let cx = o.align === 'center' ? x - rowW / 2 : o.align === 'right' ? x - rowW : x;
      row.forEach(it => {
        const age = T - it.w.t0;
        const live = age >= 0;
        if (live || o.ghost) {
          const cur = live && T < it.w.t1 + 0.04;
          const k = clamp(age / 0.08);
          g.globalAlpha = live ? 1 : o.ghost;
          K.text(it.s, cx + it.wd / 2, y + ri * lh, {
            font: f, align: 'center', color: cur && o.hot ? o.hot : o.color || C.cream,
            scale: live ? 1 + (1 - k) * 0.16 : 1, shadow: o.shadow == null ? 1 : o.shadow, riso: live ? o.riso : null,
          });
          g.globalAlpha = 1;
        }
        cx += it.wd + space;
      });
    });
  };
  // 把一行歌詞的每個字放在指定位置（排版用）
  const place = (id, specs) => {
    if (NOLYR) return;
    specs.forEach(s => {
      const age = wAge(id, s.i);
      if (age < 0) return;
      const txt = s.txt || (s.upper === false ? wd(id, s.i).txt : up(wd(id, s.i).txt).replace(/,$/, ''));
      if (s.alpha != null) g.globalAlpha = s.alpha;
      K.slam(txt, s.x, s.y, age, {
        size: s.size, fam: s.fam || F.cond, italic: s.italic, color: s.color || C.cream, align: s.align,
        riso: s.riso, rot: s.rot, shadow: s.shadow == null ? 2 : s.shadow, from: s.from, seed: s.i + 1,
        track: s.track, stroke: s.stroke, strokeW: s.strokeW,
      });
      g.globalAlpha = 1;
    });
  };

  // 一排字：依字寬由左到右排好（可置中），每個字在自己唱到時才出現
  const row = (id, list, x, y, o = {}) => {
    if (NOLYR) return;
    const size0 = o.size || 100;
    const gap = o.gap == null ? size0 * 0.24 : o.gap;
    const items = list.map(it => {
      const s = typeof it === 'number' ? { i: it } : it;
      const size = s.size || size0;
      const fam = s.fam || o.fam || F.cond;
      const italic = s.italic != null ? s.italic : o.italic;
      const upper = s.upper != null ? s.upper : o.upper !== false;
      const txt = upper ? up(wd(id, s.i).txt).replace(/,$/, '') : wd(id, s.i).txt;
      return { ...o, ...s, size, fam, italic, txt, w: K.measure(txt, K.font(size, fam, '', italic)) };
    });
    const total = items.reduce((a, it) => a + it.w, 0) + gap * (items.length - 1);
    let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    items.forEach(it => {
      place(id, [{ ...it, x: cx, y, align: 'left' }]);
      cx += it.w + gap;
    });
  };

  /* =========================================================
     鏡頭
     ========================================================= */
  const SC = {};

  /* 01 開場：EVERYTHING IS SPEEDING UP（滿版巨字，然後整個畫面往上衝） */
  SC.hook = (lt, sh) => {
    const lb = B - sh.b0;
    fillAll(C.ink);
    const rise = lb > 4 ? Math.pow((lb - 4) / 4, 2.3) : 0;
    // 夜裡的高速公路，越推越快（最後衝進光裡）
    cam(0, 0, 1);
    photo('hook-bg', { z: 1.06 + lb * 0.02 + rise * 1.6 });
    screen();
    g.fillStyle = 'rgba(10,8,6,.5)';
    g.fillRect(0, 0, 1280, 720);
    // 往上飛的紙條：越來越快
    for (let i = 0; i < 38; i++) {
      const w = 4 + rnd(i, 1) * 24;
      const h = (60 + rnd(i, 2) * 240) * (1 + rise * 4);
      const x = rnd(i, 3) * 1280;
      const sp = (0.35 + rnd(i, 4)) * 300;
      const d = sp * (lb * 0.5 + Math.pow(Math.max(0, lb), 2.5) * 0.3);
      const y = 1100 - ((rnd(i, 5) * 1700 + d) % 1700);
      const col = [C.cream, C.orange, C.blue, '#2b2723', '#2b2723'][Math.floor(rnd(i, 6) * 5)];
      K.rect(x, y, w, h, col, 1);
    }
    cam(0, -rise * 980, 1 + rise * 0.15);
    const id = 'intro0';
    // EVERYTHING：照音節一個字母一個字母剪出來
    K.letters('EVERYTHING', 46, 262, { size: 252, fam: F.cond, color: C.cream, ages: letterAges(id, 0), seed: 2, tilt: 0.07, shadow: 3, track: 4 });
    // IS
    if (!NOLYR) K.slam('is', 60, 410, wAge(id, 1), { size: 136, fam: F.serif, italic: true, color: C.orange, shadow: 2, seed: 5 });
    // SPEEDING：往前斜，像被風吹
    g.save();
    g.transform(1, 0, -0.22, 1, 0.22 * 408, 0);
    K.letters('SPEEDING', 200, 408, { size: 106, fam: F.wide, color: C.cream, ages: letterAges(id, 2), seed: 7, tilt: 0.05, shadow: 2, jitter: 6 });
    g.restore();
    // UP：巨大的橘色剪紙字 + 箭頭
    const ua = wAge(id, 3);
    if (ua >= 0) {
      K.slam('UP', 1240, 702, ua, { size: 330, fam: F.cond, color: C.orange, align: 'right', shadow: 4, from: 2.2, dur: 0.18, seed: 9, riso: [C.blue] });
      const k = ease.out(clamp((ua - 0.1) / 0.3));
      g.save();
      g.translate(810, 700 - 150 * k);
      g.beginPath();
      g.moveTo(0, -130);
      g.lineTo(52, -60);
      g.lineTo(18, -60);
      g.lineTo(18, 60);
      g.lineTo(-18, 60);
      g.lineTo(-18, -60);
      g.lineTo(-52, -60);
      g.closePath();
      K.fillPaper(C.cream, 3);
      g.restore();
    }
    // 左下：一張小圖表（一切的速度）
    g.save();
    g.translate(300, 590);
    g.rotate(-0.035);
    K.card(0, 0, 470, 200, C.cream, {
      lvl: 2, torn: 'tb', seed: 3,
      draw: (w, h) => {
        g.strokeStyle = 'rgba(20,18,16,.18)';
        g.lineWidth = 1;
        for (let x = -w / 2 + 30; x < w / 2; x += 30) { g.beginPath(); g.moveTo(x, -h / 2 + 30); g.lineTo(x, h / 2 - 22); g.stroke(); }
        g.fillStyle = C.ink;
        g.font = K.font(14, F.mono, '700');
        g.textAlign = 'left';
        g.fillText('SPEED OF EVERYTHING', -w / 2 + 18, -h / 2 + 22);
        g.font = K.font(12, F.mono);
        g.fillText('t →', w / 2 - 44, h / 2 - 8);
        const k = clamp(lb / 4);
        g.strokeStyle = C.orange;
        g.lineWidth = 6;
        g.lineCap = 'round';
        g.beginPath();
        for (let i = 0; i <= 60 * k; i++) {
          const u = i / 60;
          const x = -w / 2 + 24 + u * (w - 60);
          const y = h / 2 - 26 - (Math.exp(u * 4) - 1) / (Math.exp(4) - 1) * (h - 70);
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
      },
    });
    g.restore();
    // 衝出去的最後半拍：閃白
    if (lb > 7.5) {
      screen();
      g.globalAlpha = clamp((lb - 7.5) / 0.5);
      fillAll(C.cream);
      g.globalAlpha = 1;
    }
  };

  /* 02 片名：一張紙從下往上撕開，霓虹星前的主角；唱到 claude 切到指天的那一張 */
  SC.title = (lt, sh) => {
    const lb = B - sh.b0;
    fillAll('#07060a');
    const cutAt = wd('intro1', 0).t0;
    const second = T >= cutAt;
    cam(0, 0, 1);
    photo(second ? 'title-b' : 'title-a', { z: (second ? 1.1 + (T - cutAt) * 0.04 : 1.03 + lb * 0.008) * punch(0.02) });
    leak(220 + Math.sin(T * 0.7) * 90, 140, 460, 'rgba(255,140,60,1)', 0.22);
    const la = ageAt(sh.b0 + 2);
    if (la > 0) {
      K.slam('an original paper music video', 60, 116, la, { size: 40, fam: F.serif, italic: true, color: C.cream, shadow: 2, from: 1.2 });
      K.text('VOL.01 · 91 SEC · 104 → 330 BPM', 62, 146, { size: 15, fam: F.mono, weight: '700', color: C.orange, shadow: 1, track: 1 });
    }
    if (!NOLYR) {
      K.slam('CLAUDE', 540, 610, wAge('intro1', 0), { size: 124, fam: F.wide, color: C.cream, align: 'right', riso: [C.orange, C.blue], shadow: 3, from: 1.8, seed: 3 });
      K.slam('POP!', 770, 610, wAge('intro1', 1), { size: 124, fam: F.wide, color: C.cream, align: 'left', riso: [C.orange, C.blue], shadow: 3, from: 1.8, seed: 4 });
    }
    cutFlash(T - cutAt);
    letterbox(44);
    tearReveal(lt);
  };

  /* 03 主歌 1：醒來世界又更新了一版（睡著 → 唱到 woke 醒來，手機的通知一直跳） */
  const NOTIFS = [
    [0.5, 'v5.1 is out'], [1.5, 'v5.2 is out'], [2.5, 'v5.2.1 hotfix'], [3, 'v5.3 is out'], [3.5, 'v6 preview'],
    [4, 'v6 is out'], [4.5, 'v6.1 is out'], [5, 'v6.2 is out'], [5.25, 'v6.3'], [5.5, 'v7 preview'], [5.75, 'v7 is out'],
    [6, 'v7.1'], [6.25, 'v7.2'], [6.5, 'v8?'], [6.625, 'v8'], [6.75, 'v8.1'], [6.875, 'v9'], [7, 'v9.9'], [7.25, 'v10'],
  ];
  SC.wake = (lt, sh) => {
    const lb = B - sh.b0;
    fillAll('#0b0f1e');
    const wakeAt = wd('verse0', 0).t0;
    const awake = T >= wakeAt;
    cam(0, 0, 1);
    photo(awake ? 'wake-b' : 'wake-a', { z: 1.05 + lt * 0.006, x: -lt * 4 });
    if (awake) leak(690, 120, 260, 'rgba(190,220,255,1)', 0.22 + 0.08 * Math.sin(T * 9));
    scrim('bottom', 300, 0.6);
    scrim('right', 460, 0.45);
    cutFlash(T - wakeAt, '#dfe9ff', 0.45);
    // 手機通知：右邊一張一張疊下來，越來越快
    const shown = NOTIFS.filter(n => lb >= n[0]);
    const ver = shown.length ? shown[shown.length - 1][1].replace(/ .*/, '') : 'v5.0';
    K.text(ver, 1232, 200, { size: 92, fam: F.cond, color: C.cream, align: 'right', shadow: 3, riso: [C.blue] });
    K.text('CURRENT VERSION', 1232, 224, { size: 13, fam: F.mono, weight: '700', color: C.cream, align: 'right', shadow: 1, track: 2 });
    shown.slice().reverse().forEach((n, i) => {
      if (i > 5) return;
      const a = ageAt(sh.b0 + n[0]);
      const y = 248 + i * 66 - (1 - clamp(a / 0.08)) * 30;
      g.save();
      g.translate(942, y);
      g.globalAlpha = clamp(a / 0.06) * (i > 3 ? 1 - (i - 3) * 0.3 : 1);
      g.beginPath();
      g.roundRect(0, 0, 290, 56, 14);
      K.fillPaper(i === 0 ? C.orange : 'rgba(250,248,242,.94)', 2);
      g.fillStyle = i === 0 ? C.cream : C.ink;
      g.font = K.font(12, F.mono, '700');
      g.textAlign = 'left';
      g.fillText('✶ CLAUDE · now', 16, 20);
      g.font = K.font(20, F.sans, '800');
      g.fillText(n[1], 16, 44);
      g.restore();
    });
    karaoke('verse0', 64, 612, { size: 50, fam: F.serif, italic: true, color: C.cream, hot: C.yellow, ghost: 0.22, maxW: 680 });
  };

  /* 04 主歌 2：午夜上線，日出就過時（同一個屋頂，夜晚縮時成日出） */
  SC.sunrise = (lt, sh) => {
    const lb = B - sh.b0;
    const k = clamp(lb / 8);
    fillAll('#0b1024');
    cam(0, 0, 1);
    const z = 1.1 - k * 0.07;
    photo('roof-night', { z, x: 24 - k * 48 });
    photo('roof-dawn', { z, x: 24 - k * 48, alpha: ease.io(clamp((k - 0.15) / 0.6)) });
    if (k > 0.4) leak(830, 110, 420, 'rgba(255,170,90,1)', 0.35 * clamp((k - 0.4) / 0.4));
    scrim('bottom', 240, 0.55);
    // 時鐘（縮時）
    g.save();
    g.translate(150, 160);
    g.beginPath();
    g.arc(0, 0, 84, 0, TAU);
    K.fillPaper(C.cream, 3);
    g.strokeStyle = C.ink;
    g.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.beginPath();
      g.moveTo(Math.cos(a) * 66, Math.sin(a) * 66);
      g.lineTo(Math.cos(a) * 76, Math.sin(a) * 76);
      g.stroke();
    }
    const hh = -Math.PI / 2 + ((k * 6) / 12) * TAU;
    const mm = -Math.PI / 2 + k * 6 * TAU;
    g.lineCap = 'round';
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(hh) * 42, Math.sin(hh) * 42);
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = C.orange;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(mm) * 64, Math.sin(mm) * 64);
    g.stroke();
    g.fillStyle = C.ink;
    g.beginPath();
    g.arc(0, 0, 7, 0, TAU);
    g.fill();
    g.restore();
    // 印章直接蓋在畫面上
    if (!NOLYR) {
      K.stamp('SHIPPED', 360, 330, { age: wAge('verse1', 0), color: '#9fb4ff', size: 56, rot: -0.14 });
      K.stamp('DEPRECATED', 390, 412, { age: wAge('verse1', 5), color: '#ff5a44', size: 46, rot: 0.1 });
    }
    karaoke('verse1', 64, 686, { size: 50, fam: F.serif, italic: true, color: C.cream, hot: C.yellow, ghost: 0.22 });
  };

  /* 05 主歌 3：時間軸上每張圖都往上 → 推進一張圖，主角沿著曲線往上走 */
  const curve = u => [110 + u * 1060, 650 - (Math.exp(u * 3.6) - 1) / (Math.exp(3.6) - 1) * 420];
  SC.feed = (lt, sh) => {
    const lb = B - sh.b0;
    const id = 'verse2';
    if (lb < 4) {
      fillAll(C.paper);
      cam(0, 0, 1 + lb * 0.01);
      // 右邊：一直往上滑的貼文
      const scroll = lb * 160 + Math.pow(lb, 2.4) * 60;
      for (let i = 0; i < 9; i++) {
        const y = 40 + i * 214 - (scroll % 214) - Math.floor(scroll / 214) * 0;
        const n = i + Math.floor(scroll / 214);
        K.card(905, y + 95, 520, 196, '#ffffff', { lvl: 2, rot: (rnd(n, 1) - 0.5) * 0.03, draw: (w, h) => {
          g.fillStyle = [C.orange, C.blue, C.pink, C.yellow][n % 4];
          g.beginPath();
          g.arc(-w / 2 + 34, -h / 2 + 32, 18, 0, TAU);
          g.fill();
          g.fillStyle = C.ink;
          g.font = K.font(15, F.mono, '700');
          g.textAlign = 'left';
          g.fillText(['@line_go_up', '@accel_daily', '@vibes_vertical', '@ship_it_now', '@tokens_brrr'][n % 5], -w / 2 + 62, -h / 2 + 30);
          g.fillStyle = '#c8c1b3';
          g.fillRect(-w / 2 + 62, -h / 2 + 42, 180 + rnd(n, 2) * 120, 8);
          g.strokeStyle = 'rgba(20,18,16,.15)';
          g.strokeRect(-w / 2 + 20, -h / 2 + 62, w - 40, h - 82);
          g.strokeStyle = n % 3 ? C.orange : C.blue;
          g.lineWidth = 4;
          g.beginPath();
          const ex = 2 + rnd(n, 3) * 3;
          for (let j = 0; j <= 30; j++) {
            const u = j / 30;
            const x = -w / 2 + 30 + u * (w - 60), y2 = h / 2 - 28 - (Math.exp(u * ex) - 1) / (Math.exp(ex) - 1) * (h - 104) + Math.sin(j * 1.7 + n) * 3;
            if (j) g.lineTo(x, y2); else g.moveTo(x, y2);
          }
          g.stroke();
        } });
      }
      // 左邊：疊起來的大字
      place(id, [
        { i: 0, x: 60, y: 176, size: 132, color: C.ink },
        { i: 1, x: 60, y: 300, size: 132, color: C.orange, riso: [C.blue] },
        { i: 2, x: 64, y: 384, size: 78, fam: F.serif, italic: true, color: C.ink, upper: false },
        { i: 3, x: 160, y: 384, size: 78, fam: F.serif, italic: true, color: C.ink, upper: false },
        { i: 4, x: 60, y: 548, size: 176, color: C.ink },
        { i: 5, x: 66, y: 630, size: 70, fam: F.serif, italic: true, color: C.blue, upper: false },
        { i: 6, x: 130, y: 630, size: 70, fam: F.serif, italic: true, color: C.blue, upper: false },
      ]);
      return;
    }
    // 推進到一張大圖表
    const ck = lb - 4;
    fillAll('#f4f1e8');
    cam(0, 0, 1.06 - ck * 0.012);
    g.strokeStyle = 'rgba(53,80,200,.16)';
    g.lineWidth = 1;
    for (let x = 0; x <= 1280; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 720); g.stroke(); }
    for (let y = 0; y <= 720; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(1280, y); g.stroke(); }
    g.strokeStyle = 'rgba(53,80,200,.32)';
    for (let x = 0; x <= 1280; x += 160) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 720); g.stroke(); }
    for (let y = 0; y <= 720; y += 160) { g.beginPath(); g.moveTo(0, y); g.lineTo(1280, y); g.stroke(); }
    K.rect(96, 60, 6, 600, C.ink, 1);
    K.rect(96, 654, 1130, 6, C.ink, 1);
    K.text('VIBES', 112, 84, { size: 16, fam: F.mono, weight: '700', color: C.ink, shadow: 0, track: 2 });
    K.text('TIME →', 1150, 690, { size: 16, fam: F.mono, weight: '700', color: C.ink, shadow: 0, track: 2, align: 'right' });
    const uMax = 0.08 + 0.92 * ease.out(clamp(ck / 3.7));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i <= 120; i++) {
      const u = (i / 120) * uMax;
      const [x, y] = curve(u);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    K.shadow(2);
    g.strokeStyle = C.orange;
    g.lineWidth = 16;
    g.stroke();
    K.noShadow();
    // 主角沿著曲線走上去
    const [ix, iy] = curve(Math.max(0, uMax - 0.035));
    // 去背的主角沿著曲線走上去（每拍一步，上下彈）
    sprite('walk-cut', ix, iy + 6 - Math.abs(Math.sin(S.bt(T12) * Math.PI)) * 6, 196, { shadow: 2 });
    // 字沿著曲線排：依字寬一個接一個往上爬
    if (!NOLYR) {
      let u = 0.4;
      [7, 8, 9].forEach(i => {
        const size = i === 9 ? 110 : 72;
        const s = up(wd(id, i).txt);
        const w = K.measure(s, K.font(size, F.wide)) + 34;
        let len = 0, u2 = u;
        let [qx, qy] = curve(u);
        while (len < w && u2 < 1.3) {
          u2 += 0.002;
          const [x, y] = curve(u2);
          len += Math.hypot(x - qx, y - qy);
          qx = x;
          qy = y;
        }
        const a = wAge(id, i);
        if (a >= 0) {
          const [x1, y1] = curve(u), [x2, y2] = curve(u2);
          const ang = Math.atan2(y2 - y1, x2 - x1);
          const [mx, my] = curve((u + u2) / 2);
          // 字掛在線的下面，主角走在線的上面
          K.slam(s, mx - Math.sin(ang) * 20, my + Math.cos(ang) * 20, a, { size, fam: F.wide, color: i === 9 ? C.blue : C.ink, rot: ang, align: 'center', base: 'hanging', shadow: 2, seed: i });
        }
        u = u2;
      });
    }
    karaoke(id, 140, 130, { size: 40, fam: F.serif, italic: true, color: C.ink, ghost: 0.18, maxW: 620 });
  };

  /* 06 主歌 4：每週都像一年（日曆一頁一頁被撕掉） */
  const TEARS = [0, 1, 2, 3, 4, 4.5, 5, 5.5, 6, 6.25, 6.5, 6.75, 7, 7.125, 7.25, 7.375, 7.5, 7.625, 7.75, 7.875];
  SC.calendar = (lt, sh) => {
    const lb = B - sh.b0;
    fillAll(C.cream);
    cam(0, 0, 1);
    // 她看著左邊被撕掉的日曆；左半邊壓一層亮紙色讓日曆和字清楚
    photo('face-pensive', { z: 1.05 + lt * 0.005, x: 10 });
    scrim('left', 760, 0.72, '247,243,234');
    const torn = TEARS.filter(x => lb >= x).length;
    const week = 41 + torn;
    const year = 2026 + torn;
    // 日曆本體
    const px0 = 330, py0 = 380;
    const page = (wk, yr, color) => {
      g.beginPath();
      g.moveTo(-200, -180);
      g.lineTo(200, -180);
      g.lineTo(200, 230);
      g.lineTo(-200, 230);
      g.closePath();
      K.fillPaper(color, 2);
      g.fillStyle = C.red;
      g.fillRect(-200, -180, 400, 64);
      g.fillStyle = C.cream;
      g.font = K.font(30, F.wide);
      g.textAlign = 'center';
      g.fillText(String(yr), 0, -134);
      g.fillStyle = C.ink;
      g.font = K.font(18, F.mono, '700');
      g.fillText('WEEK', 0, -76);
      g.font = K.font(220, F.cond);
      g.fillText(String(wk), 0, 150);
      g.font = K.font(16, F.mono);
      g.fillText('= 1 YEAR', 0, 200);
    };
    g.save();
    g.translate(px0, py0);
    for (let i = 2; i >= 1; i--) {
      g.save();
      g.translate(i * 5, i * 6);
      page(week, year, '#e7e1d4');
      g.restore();
    }
    page(week, year, '#ffffff');
    g.restore();
    // 撕下來的頁（往左上飛走）
    TEARS.forEach((tb2, i) => {
      const a = ageAt(sh.b0 + tb2);
      if (a < 0 || a > 1.1) return;
      g.save();
      const k = ease.out(clamp(a / 0.9));
      g.translate(px0 - k * 520 - i * 8, py0 - k * 460 + k * k * 120);
      g.rotate(-k * (1.4 + rnd(i, 2)));
      g.scale(1 - k * 0.3, 1 - k * 0.3);
      page(41 + i, 2026 + i, '#ffffff');
      g.restore();
    });
    // 線圈
    g.save();
    g.translate(px0, py0);
    K.rect(-210, -196, 420, 30, C.ink, 2);
    for (let i = 0; i < 7; i++) {
      g.fillStyle = '#c9c4bb';
      g.beginPath();
      g.roundRect(-180 + i * 58, -210, 14, 46, 7);
      g.fill();
    }
    g.restore();
    // 主角看著日曆唱
    // 歌詞：前半像字幕，NEVER ENOUGH 變大字
    karaoke('verse3', 64, 92, { size: 40, fam: F.serif, italic: true, color: C.ink, ghost: 0.16, maxW: 600 });
    place('verse3', [
      { i: 7, x: 64, y: 690, size: 150, color: C.orange, riso: [C.blue], rot: -0.03 },
      { i: 8, x: 460, y: 690, size: 150, color: C.ink, rot: -0.03 },
    ]);
  };

  /* 07 導歌：走廊伸展台，每一拍換一隻腳，鏡頭一路推近 */
  SC.runway = (lt, sh) => {
    const lb = B - sh.b0;
    fillAll('#04060c');
    const bi = Math.floor(lb);
    cam(0, 0, 1);
    photo(bi % 2 ? 'runway-b' : 'runway-a', { z: (1.02 + ease.in(clamp(lb / 8)) * 0.42) * punch(0.02), y: lb * 3 });
    cutFlash(T - tAt(sh.b0 + bi), '#cfe2ff', 0.22);
    scrim('left', 600, 0.75);
    const id = 'pre0';
    place(id, [
      { i: 0, x: 60, y: 150, size: 46, fam: F.sans, color: C.cream, shadow: 1 },
      { i: 1, x: 190, y: 150, size: 46, fam: F.sans, color: C.cream, shadow: 1 },
      { i: 2, x: 52, y: 300, size: 160, color: C.orange, riso: [C.blue] },
      { i: 3, x: 60, y: 396, size: 90, color: C.cream },
      { i: 4, x: 200, y: 396, size: 90, color: C.cream },
      { i: 5, x: 62, y: 478, size: 70, fam: F.serif, italic: true, color: C.cream, upper: false },
      { i: 6, x: 238, y: 478, size: 70, fam: F.serif, italic: true, color: C.cream, upper: false },
      { i: 7, x: 52, y: 660, size: 178, color: C.cream, riso: [C.orange] },
    ]);
  };

  /* 08 倒數：越數越快 */
  const COUNT_BG = [C.orange, C.ink, C.cream, C.blue, C.pink, C.yellow, C.ink, C.orange, C.cream, C.ink];
  SC.count = (lt, sh) => {
    const line = L('pre1');
    let idx = -1;
    line.words.forEach((w, i) => { if (T >= w.t0) idx = i; });
    if (B >= sh.b0 + 7) {
      // 最後一拍：白光裡的三個剪影，準備開始
      const a = ageAt(sh.b0 + 7);
      fillAll(C.cream);
      screen();
      g.globalAlpha = 1;
      photoTint('stage-2', C.ink, { z: 1.06 });
      g.globalAlpha = clamp(1 - a / 0.15);
      fillAll('#ffffff');
      g.globalAlpha = 1;
      return;
    }
    if (idx < 0) idx = 0;
    const w = line.words[idx];
    const bg = COUNT_BG[idx];
    const dark = bg === C.ink || bg === C.blue;
    fillAll(bg);
    cam(0, 0, 1 + 0.04 * clamp(1 - (T - w.t0) / 0.2));
    K.halftone(0, 0, 1280, 720, { step: 14, color: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)', k: 0.4 });
    const n = String(10 - idx);
    if (!NOLYR) {
      K.slam(n, 640, 600, T - w.t0, { size: 560, fam: F.cond, color: dark ? C.cream : C.ink, align: 'center', shadow: 4, from: 1.6, dur: 0.1, seed: idx, riso: dark ? [C.orange] : [C.orange, C.blue] });
      K.text(up(w.txt), 640, 676, { size: 26, fam: F.mono, weight: '700', color: dark ? C.cream : C.ink, align: 'center', track: 10, shadow: 0 });
    }
    // 上面的翻牌
    screen();
    K.flap('T-' + String(10 - idx).padStart(2, '0'), 60, 52, { w: 34, h: 50, age: T - w.t0 + 0.1, spin: 0.1, stagger: 0.02, seed: idx, hl: [2, 3] });
  };

  /* 09 / 20 副歌舞台：真人三人組，每一拍切一個動作；FASTER 夾在人的後面，VERTICAL 在最前面
     再副歌：三人去背後縮小蓋章，排在後面，每一拍複製一倍 */
  const CROWD = (() => {
    const slots = [];
    [[12, 548, 118], [10, 572, 156], [8, 598, 198], [6, 624, 240], [4, 650, 280]].forEach(([n, y, h], r) => {
      for (let i = 0; i < n; i++) slots.push({ x: 60 + (i + (r % 2 ? 0.5 : 0)) * (1160 / (n - (r % 2 ? 0 : 1) || 1)), y, h, r, o: rnd(i + r * 17, 5) });
    });
    // 出生順序打散，但前排（大）晚一點出生
    return slots.sort((a, b) => (a.o + a.r * 0.18) - (b.o + b.r * 0.18));
  })();
  const stageScene = (lt, sh, o) => {
    const lb = B - sh.b0;
    fillAll('#05060c');
    const bi = Math.floor(lb);
    const name = o.frames[((bi % o.frames.length) + o.frames.length) % o.frames.length];
    const z = (o.z || 1.06) * punch(0.03) + lb * 0.003;
    cam(0, 0, 1);
    photo(name, { z });
    if (o.back) o.back(lb);
    if (o.crowd) {
      const alive = Math.min(CROWD.length, Math.max(0, Math.pow(2, bi) - 1));
      CROWD.slice(0, alive).sort((a, b) => a.y - b.y).forEach(sl => {
        const j = CROWD.indexOf(sl);
        const a = ageAt(sh.b0 + Math.ceil(Math.log2(j + 2)));
        const s = Math.max(0.05, spring(a, 18, 7));
        K.shadow(2);
        stamp(name, sl.x, sl.y, sl.h * s);
        K.noShadow();
      });
    }
    photo(name, { z, cut: true });
    if (o.front) o.front(lb);
    cutFlash(T - tAt(sh.b0 + bi), '#ffffff', 0.32);
  };
  // FASTER 兩次；唱到 vertical 時退到後面變淡，讓直排的字當主角
  const fasterType = id => {
    const va = wAge(id, 4);
    const fade = va > 0 ? lerp(1, 0.25, clamp(va / 0.25)) : 1;
    place(id, [
      { i: 0, x: 44, y: 300, size: 190, color: C.cream, rot: -0.04, shadow: 3, alpha: fade },
      { i: 1, x: 1236, y: 300, size: 190, color: C.orange, align: 'right', rot: 0.04, shadow: 3, riso: [C.blue], alpha: fade },
      { i: 2, x: 630, y: 104, size: 60, fam: F.serif, italic: true, color: C.cream, upper: false, align: 'right' },
      { i: 3, x: 646, y: 104, size: 60, fam: F.serif, italic: true, color: C.cream, upper: false },
    ]);
  };
  const verticalType = (id, cols) => {
    if (NOLYR) return;
    const a = wAge(id, 4);
    if (a < 0) return;
    const word = 'VERTICAL';
    cols.forEach((x, ci) => {
      g.save();
      g.translate(x, 700);
      g.rotate(-Math.PI / 2);
      K.letters(word, 0, 0, { size: 200, fam: F.cond, color: ci % 2 ? C.cream : C.yellow, age: a - ci * 0.03, stagger: 0.022, seed: 20 + ci, tilt: 0.04, shadow: 3, base: 'middle' });
      g.restore();
    });
  };
  SC.chorusA = (lt, sh) => stageScene(lt, sh, {
    frames: ['stage-1', 'stage-2', 'stage-3', 'stage-4'],
    back: () => fasterType('chorus0'),
    front: () => verticalType('chorus0', [118, 1162]),
  });
  SC.finalA = (lt, sh) => stageScene(lt, sh, {
    frames: ['stage-final-1', 'stage-final-2'],
    crowd: true,
    back: () => fasterType('final0'),
    front: () => verticalType('final0', [118, 1162]),
  });

  /* 10 / 21 副歌 2：每個 token 都變成光 */
  const TOKENS = ['the', 'ing', '▢', 'AI', '✶', '##', 'tok', 'en', '{ }', '=>', '∑', '…', 'up', 'go', 'pop', 'λ', '01', '→'];
  const tokenSwirl = (cx, cy, id, wordLight, o = {}) => {
    const la = wAge(id, wordLight);
    const n = o.n || 70;
    for (let i = 0; i < n; i++) {
      const sp = 0.35 + rnd(i, 2) * 0.6;
      const a0 = rnd(i, 1) * TAU + B * sp * 0.7;
      let r = 140 + rnd(i, 3) * 460;
      let col = '#ffffff';
      let ink = C.ink;
      let sz = 1;
      if (la > 0) {
        const k = ease.out(clamp(la / 0.8));
        r += k * 600;
        col = C.yellow;
        ink = C.orange;
        sz = 1 + k * 0.6;
      }
      const x = cx + Math.cos(a0) * r * 1.25, y = cy + Math.sin(a0) * r * 0.75;
      g.save();
      g.translate(x, y);
      g.rotate(a0 * 0.5 + i);
      g.scale(sz, sz);
      const s = TOKENS[i % TOKENS.length];
      g.font = K.font(18, F.mono, '700');
      const w = g.measureText(s).width + 18;
      g.beginPath();
      g.rect(-w / 2, -15, w, 30);
      K.fillPaper(col, 1);
      g.fillStyle = ink;
      g.textAlign = 'center';
      g.fillText(s, 0, 6);
      g.restore();
    }
  };
  SC.tokens = (lt, sh) => {
    const id = 'chorus1';
    const la = wAge(id, 5);
    fillAll('#08102a');
    cam(0, 0, 1);
    // 對嘴：閉嘴與張嘴兩張疊在一起，張嘴那張的透明度跟著合成人聲走
    const z = 1.04 + lt * 0.01;
    photo('face-sing', { z });
    photo('face-sing-open', { z, alpha: clamp(mouthNow() * 1.7) });
    if (la > 0) {
      grade('#ffb347', 0.55 * clamp(la / 0.25), 'soft-light');
      leak(850, 310, 760, 'rgba(255,200,90,1)', 0.55 * clamp(la / 0.25));
    }
    scrim('left', 660, 0.6);
    tokenSwirl(850, 320, id, 5, { n: 54 });
    place(id, [
      { i: 0, x: 64, y: 172, size: 74, fam: F.serif, italic: true, color: C.cream, upper: false },
      { i: 1, x: 250, y: 172, size: 74, fam: F.serif, italic: true, color: C.cream, upper: false },
      { i: 3, x: 64, y: 452, size: 74, fam: F.serif, italic: true, color: C.cream, upper: false },
      { i: 4, x: 330, y: 452, size: 74, fam: F.serif, italic: true, color: C.cream, upper: false },
    ]);
    // TOKEN 貼在一條紙膠帶上
    const ta = wAge(id, 2);
    if (ta >= 0 && !NOLYR) {
      const k = clamp(ta / 0.1);
      g.save();
      g.translate(60, 352);
      g.rotate(-0.04);
      g.scale(lerp(1.3, 1, k), lerp(1.3, 1, k));
      K.tornRect(0, -150, 470, 180, 5, 6, 'lr');
      K.fillPaper(C.cream, 2);
      K.text('TOKEN', 22, 4, { size: 170, fam: F.cond, color: C.ink, shadow: 0 });
      g.restore();
    }
    place(id, [{ i: 5, x: 56, y: 672, size: 230, color: C.yellow, riso: [C.orange], shadow: 4, from: 2 }]);
  };
  SC.mosaic = (lt, sh) => {
    const id = 'final1';
    const lb = B - sh.b0;
    const la = wAge(id, 5);
    fillAll(la > 0 ? C.yellow : '#1d2c80');
    cam(0, 0, 1 + lb * 0.025);
    // 一整面的真人小貼紙（主角與兩位伴舞），各自跟著拍子彈
    const names = ['walk-cut', 'dancer-blue', 'dancer-pink'];
    for (let r = 0; r < 6; r++) {
      for (let c2 = 0; c2 < 22; c2++) {
        const i = r * 22 + c2;
        const x = 30 + c2 * 58 + (r % 2) * 29;
        const y = 150 + r * 112;
        const bob = Math.abs(Math.sin((B + c2 * 0.13 + r * 0.3) * Math.PI)) * 7;
        sprite(names[(c2 + r) % 3], x, y - bob, 104);
        if (la > 0 && rnd(i, 3) < clamp(la / 0.6)) {
          K.star(x, y - 60, 22, 0.4, i);
          g.fillStyle = C.orange;
          g.fill();
        }
      }
    }
    screen();
    tokenSwirl(640, 360, id, 5, { n: 40 });
    if (!NOLYR) {
      const show = [0, 1, 2].filter(i => wAge(id, i) >= 0);
      if (show.length && la < 0) {
        g.save();
        K.tornRect(70, 236, 1140, 290, 9, 7, 'tb');
        K.fillPaper(C.ink, 3);
        g.restore();
        row(id, [0, 1, { i: 2, color: C.yellow, riso: [C.pink] }], 640, 400, { size: 132, color: C.cream, align: 'center' });
        row(id, [3, 4], 640, 488, { size: 60, fam: F.serif, italic: true, upper: false, color: C.cream, align: 'center', shadow: 1 });
      }
      if (la >= 0) K.slam('LIGHT', 640, 470, la, { size: 300, fam: F.cond, color: C.ink, align: 'center', riso: [C.orange, C.pink], shadow: 4, from: 2.4 });
    }
  };

  /* 11 / 22 別眨眼 → 蒙太奇 */
  const bigEye = (lid) => {
    fillAll('#000');
    cam(0, 0, 1);
    const z = (1.03 + (T % 4) * 0.004) * punch(0.02);
    photo('eye', { z });
    if (lid > 0) photo('eye-closed', { z, alpha: lid });
  };

  const MONTAGE = ['chorusA', 'feed', 'title', 'sunrise', 'runway', 'wake', 'calendar', 'tokens', 'hook', 'count', 'carousel', 'feed'];
  const blinkScene = (id, sh, step) => {
    const lb = B - sh.b0;
    const lyricStart = sh.b0 + 2.5;
    if (B < lyricStart) {
      const ba = ageAt(sh.b0 + 1.5);
      const lid = ba > 0 && ba < 0.22 ? Math.sin((ba / 0.22) * Math.PI) : 0;
      bigEye(lid);
      place(id, [
        { i: 0, x: 60, y: 230, size: 230, color: C.cream, rot: -0.05, riso: [C.orange] },
        { i: 1, x: 1230, y: 690, size: 230, color: C.orange, align: 'right', rot: 0.03, riso: [C.ink] },
      ]);
      return;
    }
    // 蒙太奇：每一小段借別的鏡頭來畫
    const n = Math.floor((B - lyricStart) / step);
    const name = MONTAGE[(n + (step < 0.5 ? 3 : 0)) % MONTAGE.length];
    const src = SHOT_BY[name];
    const off = (rnd(n, 7) * 0.7 + 0.15) * (src.t1 - src.t0) + (B - lyricStart - n * step) * 0.6;
    withTime(src.t0 + off, () => {
      NOLYR = true;
      cam(0, 0, 1);
      src.fn(T - src.t0, src);
      NOLYR = false;
    });
    screen();
    // 每一刀開頭閃一下
    const ca = (B - lyricStart - n * step);
    if (ca < 0.12) {
      g.globalAlpha = 0.5 * (1 - ca / 0.12);
      fillAll(n % 2 ? C.cream : C.ink);
      g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(20,18,16,.86)';
    g.fillRect(0, 610, 1280, 84);
    karaoke(id, 640, 668, { size: 46, fam: F.sans, weight: '800', color: C.cream, hot: C.orange, align: 'center', shadow: 0 });
    K.text(`CUT ${String(n + 1).padStart(2, '0')}`, 1236, 150, { size: 30, fam: F.mono, weight: '700', color: C.cream, align: 'right', shadow: 1, stroke: C.ink, strokeW: 6 });
  };
  SC.blink = (lt, sh) => blinkScene('chorus2', sh, 0.5);
  SC.blink2 = (lt, sh) => blinkScene('final2', sh, 0.25);

  /* 12 / 23 俯拍：三個人躺在星星上，整張照片像唱盤一樣轉；CLAUDE POP、UP UP UP */
  const carouselScene = (id, sh, o) => {
    const lb = B - sh.b0;
    fillAll(o.bg);
    const tilt = lb > 4 ? Math.pow((lb - 4) / 4, 2) : 0;
    cam(0, tilt * 760, 1 + 0.015 * pulse(6));
    K.sunburst(640, 400, 1300, 32, -T * 0.35, o.ray, 0.6);
    K.halftone(0, 0, 1280, 720, { step: 16, color: o.dot, k: 0.45 });
    const r0 = 300 * (1 + 0.03 * pulse(6));
    g.beginPath();
    g.arc(640, 400, r0 + 12, 0, TAU);
    K.fillPaper(C.cream, 4);
    g.save();
    g.beginPath();
    g.arc(640, 400, r0, 0, TAU);
    g.clip();
    g.translate(640, 400);
    g.rotate(B * 0.25 * Math.PI * o.spin);
    g.translate(-640, -400);
    photo('topshot', { z: 1.25, y: 40 });
    if (o.tint) grade(o.tint, 0.45, 'soft-light');
    g.restore();
    place(id, [
      { i: 0, x: 560, y: 120, size: 60, fam: F.serif, italic: true, color: C.ink, upper: false, align: 'right' },
      { i: 1, x: 572, y: 120, size: 60, fam: F.serif, italic: true, color: C.ink, upper: false },
      { i: 2, x: 620, y: 252, size: 150, fam: F.wide, color: C.ink, align: 'right', riso: [C.orange, C.blue], shadow: 3 },
      { i: 3, x: 650, y: 252, size: 150, fam: F.wide, color: C.ink, riso: [C.orange, C.blue], shadow: 3 },
    ]);
    // UP、UP、UP：一個比一個大，往上疊
    [[4, 1040, -40, 140, C.cream], [5, 1110, -230, 210, C.yellow], [6, 1150, -470, 300, C.orange]].forEach(([i, x, y, size, col]) => {
      if (NOLYR) return;
      const a = wAge(id, i);
      if (a < 0) return;
      K.slam('UP', x, 700 + y, a, { size, fam: F.cond, color: col, align: 'center', shadow: 3, riso: [C.ink], seed: i, from: 2 });
    });
    // 紙做的煙火：開場幾拍、還有最後鏡頭往上看的時候
    const burst = (fx, fy, a, n = 14) => {
      for (let j = 0; j < n; j++) {
        const ang = (j / n) * TAU;
        const r = ease.out(clamp(a / 0.8)) * 130;
        K.star(fx + Math.cos(ang) * r, fy + Math.sin(ang) * r + a * a * 40, 10 * (1 - a / 1.4), 0.4, j);
        g.fillStyle = [C.yellow, C.cream, C.blue, C.ink][j % 4];
        g.fill();
      }
    };
    if (o.fireworks) {
      for (let f = 0; f < 3; f++) {
        const a = ageAt(sh.b0 + 1 + f * 1.2);
        if (a >= 0 && a <= 1.4) burst(160 + rnd(f, 2) * 960, 80 + rnd(f, 3) * 240, a);
      }
    }
    if (lb > 3.5) {
      screen();
      for (let f = 0; f < 9; f++) {
        const a = ageAt(sh.b0 + 3.5 + f * 0.5);
        if (a >= 0 && a <= 1.4) burst(140 + rnd(f, 12) * 1000, 90 + rnd(f, 13) * 280, a);
      }
    }
  };
  SC.carousel = (lt, sh) => carouselScene('chorus3', sh, { bg: C.pink, ray: '#ffd23f', dot: 'rgba(200,40,100,.35)', spin: 1 });
  SC.carousel2 = (lt, sh) => carouselScene('final3', sh, { bg: C.orange, ray: '#ffd23f', dot: 'rgba(120,30,0,.3)', spin: -1.6, tint: '#ff6fa3', fireworks: true });

  /* 13 時間軸：Web 1.0 網頁上的 LINE GOES UP */
  SC.web = (lt, sh) => {
    const lb = B - sh.b0;
    fillAll('#ffffff');
    screen();
    // 瀏覽器外框
    g.fillStyle = '#c0c0c0';
    g.fillRect(0, 0, 1280, 74);
    g.fillStyle = '#000080';
    g.fillRect(4, 4, 1272, 26);
    g.fillStyle = '#ffffff';
    g.font = K.font(16, F.sans, '700');
    g.textAlign = 'left';
    g.fillText('line_goes_up.html', 14, 23);
    g.fillStyle = '#ffffff';
    g.fillRect(90, 40, 800, 26);
    g.strokeStyle = '#808080';
    g.strokeRect(90, 40, 800, 26);
    g.fillStyle = '#000';
    g.font = K.font(15, F.mono);
    g.fillText('http://www.line-goes-up.net/index.html', 98, 58);
    g.font = K.font(15, F.sans, '700');
    g.fillText('Address', 20, 58);
    // 頁面
    const tear = ageAt(sh.b0 + 5);
    const draw = () => {
      g.fillStyle = '#000';
      g.textAlign = 'left';
      const h1 = (id, y, col) => {
        if (NOLYR) return;
        let x = 56;
        L(id).words.forEach((w, i) => {
          const a = T - w.t0;
          const s = up(w.txt);
          g.font = K.font(96, F.times, '700');
          const ww = g.measureText(s + ' ').width;
          if (a >= 0) K.slam(s, x, y, a, { font: K.font(96, F.times, '700'), color: col, shadow: 0, boil: 0, from: 1.15, dur: 0.06 });
          x += ww;
        });
      };
      h1('break0', 190, '#000000');
      h1('break1', 300, '#ff0000');
      g.fillStyle = '#000';
      g.fillRect(56, 320, 560, 3);
      const links = ['click here for AGI', 'faster.html', 'more_compute.zip', 'sign my guestbook', 'webring: next →'];
      links.forEach((s, i) => {
        const y = 372 + i * 40;
        const visited = i === 0 && lb > 2.2;
        g.fillStyle = visited ? '#551a8b' : '#0000ee';
        g.font = K.font(28, F.times);
        g.fillText('» ' + s, 60, y);
        const w = g.measureText('» ' + s).width;
        g.fillRect(60, y + 4, w, 2);
      });
      // 90 年代個人網頁的大頭照
      const me = PH['idol-test'] && PH['idol-test'].img;
      if (me && me.naturalWidth) {
        g.drawImage(me, 405, 30, 220, 220, 420, 348, 190, 190);
        g.strokeStyle = '#000';
        g.lineWidth = 3;
        g.strokeRect(420, 348, 190, 190);
        g.fillStyle = '#000';
        g.font = K.font(16, F.times);
        g.fillText('me_irl.jpg (24 KB)', 420, 562);
      }
      // 施工中
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 ? '#000' : '#ffd23f';
        g.beginPath();
        g.moveTo(60 + i * 28, 590);
        g.lineTo(88 + i * 28, 590);
        g.lineTo(74 + i * 28, 620);
        g.lineTo(46 + i * 28, 620);
        g.closePath();
        g.fill();
      }
      g.fillStyle = '#000';
      g.font = K.font(16, F.mono, '700');
      g.fillText('UNDER CONSTRUCTION — BEST VIEWED AT 330 BPM', 60, 644);
      // 計數器
      g.fillStyle = '#000';
      g.fillRect(500, 594, 150, 30);
      g.fillStyle = '#00ff66';
      g.font = K.font(20, F.mono, '700');
      g.fillText(String(1337 + Math.floor(Math.pow(Math.max(0, lb), 3) * 40)).padStart(7, '0'), 508, 616);
      // 圖表
      g.strokeStyle = '#000';
      g.lineWidth = 3;
      g.strokeRect(680, 160, 540, 440);
      g.lineWidth = 1;
      g.strokeStyle = '#c0c0c0';
      for (let i = 1; i < 6; i++) {
        g.beginPath(); g.moveTo(680 + i * 90, 160); g.lineTo(680 + i * 90, 600); g.stroke();
        g.beginPath(); g.moveTo(680, 160 + i * 73); g.lineTo(1220, 160 + i * 73); g.stroke();
      }
      g.fillStyle = '#000';
      g.font = K.font(18, F.times, '700');
      g.fillText('Fig. 1 — the line', 690, 628);
    };
    if (tear > 0) {
      // 線衝破頁面：沿著線撕開，露出後面的橘色
      fillAll(C.orange);
      screen();
      K.halftone(0, 74, 1280, 646, { step: 14, color: C.orangeDeep, k: 0.35 });
      g.save();
      const k = ease.out(clamp(tear / 0.5));
      g.beginPath();
      g.moveTo(-10, 74);
      g.lineTo(980 - 60 * k, 74);
      K.torn(980 - 60 * k, 74, 1000 - 30 * k, 720, 41, 14, 18, false);
      g.lineTo(-10, 720);
      g.closePath();
      K.shadow(3);
      g.fillStyle = '#ffffff';
      g.fill();
      K.noShadow();
      g.clip();
      draw();
      g.restore();
      g.save();
      g.beginPath();
      g.moveTo(1290, 74);
      g.lineTo(1080 + 90 * k + 160 * k, 74);
      K.torn(1080 + 250 * k, 74, 1060 + 230 * k, 720, 42, 14, 18, false);
      g.lineTo(1290, 720);
      g.closePath();
      K.shadow(3);
      g.fillStyle = '#ffffff';
      g.fill();
      K.noShadow();
      g.clip();
      draw();
      g.restore();
    } else {
      draw();
    }
    // 紅色的線（第二次唱到 up 時衝出圖表）
    const lk = clamp(lb / 2.6);
    const over = tear > 0 ? ease.out(clamp(tear / 0.6)) : 0;
    g.strokeStyle = '#ff0000';
    g.lineWidth = 7;
    g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i <= 80; i++) {
      const u = (i / 80) * (0.06 + 0.94 * lk);
      const x = 690 + u * 330;
      const y = 590 - (Math.exp(u * 3.4) - 1) / (Math.exp(3.4) - 1) * 300;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    if (over > 0) {
      g.quadraticCurveTo(1030, 200 - over * 200, 1010 + over * 20, 290 - over * 420);
    }
    K.shadow(over > 0 ? 2 : 0);
    g.stroke();
    K.noShadow();
    // 跑馬燈
    g.fillStyle = '#000080';
    g.fillRect(0, 680, 1280, 40);
    g.fillStyle = '#ffff00';
    g.font = K.font(20, F.times, '700');
    const mq = '★ WELCOME 2 THE FUTURE ★ YOU ARE VISITOR #0001337 ★ THE LINE ONLY GOES ONE WAY ★ THIS PAGE WAS UPDATED 0.3 SECONDS AGO ';
    const mw = g.measureText(mq).width;
    const off = (B * 46) % mw;
    g.fillText(mq + mq, 20 - off, 707);
    // 游標去點「click here for AGI」
    const ck = clamp((lb - 1) / 1.2);
    const mx = lerp(900, 200, ease.io(ck)), my = lerp(650, 366, ease.io(ck));
    g.save();
    g.translate(mx, my);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, 30);
    g.lineTo(8, 23);
    g.lineTo(14, 36);
    g.lineTo(19, 34);
    g.lineTo(13, 21);
    g.lineTo(23, 21);
    g.closePath();
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#000';
    g.lineWidth = 2;
    g.fill();
    g.stroke();
    g.restore();
  };

  /* 14 數學被吃掉：Navier–Stokes 與一顆會吃東西的星星 */
  const EQS = [
    '∂u/∂t + (u·∇)u = −∇p + νΔu + f',
    '∇·u = 0      ζ(s) = Σ 1/nˢ',
    '∀ε > 0 ∃δ > 0 : |x − a| < δ ⇒ |f(x) − L| < ε',
    'e^(iπ) + 1 = 0      ∫ e^(−x²) dx = √π',
  ];
  SC.math = (lt, sh) => {
    const lb = B - sh.b0;
    fillAll('#f6f6ee');
    cam(0, 0, 1);
    g.strokeStyle = 'rgba(60,140,90,.22)';
    g.lineWidth = 1;
    for (let x = 0; x <= 1280; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 720); g.stroke(); }
    for (let y = 0; y <= 720; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(1280, y); g.stroke(); }
    // 吃東西的進度：每一列越吃越快
    const segs = [[1.0, 3.0], [1.6, 3.2], [1.8, 3.3], [2.0, 3.4]];
    const rowY = [250, 360, 470, 580];
    K.text('NAVIER–STOKES · 3D · OPEN SINCE 1822', 80, 186, { size: 20, fam: F.mono, weight: '700', color: C.red, shadow: 0, track: 1 });
    EQS.forEach((eq, r) => {
      const [s0, s1] = segs[r];
      const k = clamp((lb - s0) / (s1 - s0));
      const dir = r % 2 ? -1 : 1;
      const x0 = 80, x1 = 1220;
      const pacX = dir > 0 ? lerp(x0 - 60, x1 + 60, k) : lerp(x1 + 60, x0 - 60, k);
      if (k >= 1) {
        // 吃完了：只剩碎屑
        g.fillStyle = 'rgba(20,18,16,.35)';
        for (let i = 0; i < 30; i++) g.fillRect(x0 + rnd(i, r) * 1100, rowY[r] - 20 + rnd(i, r + 5) * 30, 3, 3);
        return;
      }
      g.save();
      g.beginPath();
      if (dir > 0) g.rect(pacX, rowY[r] - 80, 1400, 120); else g.rect(-100, rowY[r] - 80, pacX + 100, 120);
      g.clip();
      K.text(eq, x0, rowY[r], { size: r === 0 ? 66 : 52, fam: SERIF_MATH, italic: true, color: C.ink, shadow: 0 });
      g.restore();
      if (k > 0) {
        // 吃東西的星星
        const mouth = 0.15 + 0.45 * Math.abs(Math.sin(T * 26));
        const ps = r === 0 ? 1 : 0.55;
        g.save();
        g.translate(pacX, rowY[r] - 20 * ps);
        g.scale(dir < 0 ? -ps : ps, ps);
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, 96, mouth, TAU - mouth);
        g.closePath();
        g.clip();
        K.star(0, 0, 72, 0.5, 0.2);
        K.fillPaper(r === 0 ? C.orange : C.blue, 2);
        g.restore();
        g.fillStyle = C.ink;
        g.beginPath();
        g.arc(pacX + dir * 6 * ps, rowY[r] - 50 * ps, 6 * ps, 0, TAU);
        g.fill();
        // 碎屑
        for (let i = 0; i < 6; i++) {
          g.fillStyle = C.ink;
          g.fillRect(pacX - dir * (40 + i * 22) + Math.sin(i * 3 + T * 20) * 4, rowY[r] - 10 + rnd(i, r) * 30 + (T * 60 % 20), 4, 4);
        }
      }
    });
    if (!NOLYR) K.stamp('MATH: EATEN', 900, 120, { age: ageAt(sh.b0 + 3.4), color: C.red, size: 52, rot: -0.1, bg: '#f6f6ee' });
    karaoke('break2', 80, 110, { size: 64, fam: F.wide, color: C.ink, hot: C.orange, upper: true, shadow: 1 });
  };

  /* 15 feel the AGI：閉著眼的特寫與貼紙 */
  const sticker = (s, x, y, age, o = {}) => {
    if (age < 0) return;
    const k = clamp(age / 0.08);
    g.save();
    g.translate(x, y);
    g.rotate((o.rot || 0) + (1 - k) * 0.3);
    const sc = (o.scale || 1) * (1 + (1 - k) * 0.5);
    g.scale(sc, sc);
    g.font = K.font(o.size || 90, o.fam || F.wide, '', o.italic);
    const w = g.measureText(s).width;
    if (o.circle) {
      g.beginPath();
      g.arc(0, -o.size * 0.33, o.size * 0.62, 0, TAU);
      K.fillPaper('#ffffff', 3);
      g.beginPath();
      g.arc(0, -o.size * 0.33, o.size * 0.56, 0, TAU);
      g.fillStyle = o.bg;
      g.fill();
    } else {
      g.beginPath();
      g.roundRect(-w / 2 - 34, -o.size * 0.95, w + 68, o.size * 1.3, o.size * 0.3);
      K.fillPaper('#ffffff', 3);
      g.beginPath();
      g.roundRect(-w / 2 - 24, -o.size * 0.85, w + 48, o.size * 1.1, o.size * 0.24);
      g.fillStyle = o.bg || C.cream;
      g.fill();
    }
    g.fillStyle = o.color || C.ink;
    g.textAlign = 'center';
    g.fillText(s, 0, o.circle ? 0 : -o.size * 0.08 + o.size * 0.1);
    g.restore();
  };
  SC.agi = (lt, sh) => {
    const id = 'break3';
    fillAll('#2a1a08');
    cam(0, 0, 1);
    photo('face-feel', { z: (1.03 + lt * 0.015) * punch(0.025) });
    leak(640, 40, 520, 'rgba(255,200,110,1)', 0.25 + 0.15 * pulse(4));
    // 地震儀
    g.save();
    g.translate(890, 70);
    g.rotate(0.03);
    K.card(170, 40, 360, 92, C.cream, { lvl: 2, draw: (w, h) => {
      g.strokeStyle = C.ink;
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i <= 120; i++) {
        const x = -w / 2 + 10 + (i / 120) * (w - 20);
        const amp = 4 + 34 * S.mouth(T - (120 - i) * 0.012).open;
        const y = Math.sin(i * 1.9 + T * 30) * amp * 0.5;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
      g.fillStyle = C.red;
      g.font = K.font(12, F.mono, '700');
      g.textAlign = 'left';
      g.fillText('FELT INTENSITY · AGI', -w / 2 + 10, -h / 2 + 16);
    } });
    g.restore();
    if (NOLYR) return;
    const syl = L(id).syl;
    sticker('FEEL', 220, 210, T - syl[0].t0, { size: 96, rot: -0.16, bg: C.cream });
    sticker('the', 420, 300, T - syl[1].t0, { size: 64, fam: F.serif, italic: true, rot: 0.1, bg: '#ffffff' });
    sticker('A', 330, 600, T - syl[2].t0, { size: 130, fam: F.cond, circle: true, bg: C.orange, color: C.cream });
    sticker('G', 640, 650, T - syl[3].t0, { size: 130, fam: F.cond, circle: true, bg: C.blue, color: C.cream });
    sticker('I', 950, 600, T - syl[4].t0, { size: 130, fam: F.cond, circle: true, bg: C.pink, color: C.ink });
    sticker('FEEL THE AGI ✶', 960, 330, T - syl[4].t0 - 0.35, { size: 58, rot: 0.12, bg: C.ink, color: C.yellow });
  };

  /* 16 it's so over / 17 we're so back */
  const poll = (x, y, w, over, o = {}) => {
    g.save();
    g.translate(x, y);
    g.rotate(o.rot || 0);
    g.beginPath();
    g.roundRect(-w / 2, -120, w, 250, 18);
    K.fillPaper(C.cream, 3);
    g.fillStyle = C.ink;
    g.font = K.font(16, F.mono, '700');
    g.textAlign = 'left';
    g.fillText('THE TIMELINE ASKS:', -w / 2 + 28, -84);
    const rows = [['it\'s so over', over], ['we\'re so back', 1 - over]];
    rows.forEach(([label, v], i) => {
      const ry = -54 + i * 74;
      const lead = v >= 0.5;
      g.beginPath();
      g.roundRect(-w / 2 + 28, ry, w - 56, 56, 10);
      g.fillStyle = 'rgba(20,18,16,.08)';
      g.fill();
      g.beginPath();
      g.roundRect(-w / 2 + 28, ry, Math.max(14, (w - 56) * v), 56, 10);
      g.fillStyle = lead ? (o.lead || C.ink) : 'rgba(20,18,16,.28)';
      g.fill();
      g.fillStyle = lead ? C.cream : C.ink;
      g.font = K.font(26, F.sans, '800');
      g.fillText(label, -w / 2 + 46, ry + 37);
      g.fillStyle = C.ink;
      g.textAlign = 'right';
      g.fillText(Math.round(v * 100) + '%', w / 2 - 44, ry + 37);
      g.textAlign = 'left';
    });
    g.font = K.font(14, F.mono);
    g.fillStyle = C.gray;
    g.fillText(`${(12400 + Math.floor(T * 937) % 9000).toLocaleString('en-US')} votes · live`, -w / 2 + 28, 116);
    g.restore();
  };
  SC.over = (lt, sh) => {
    const lb = B - sh.b0;
    fillAll('#05070c');
    cam(0, 0, 1);
    photo('over-sad', { z: 1.04 + lt * 0.012, x: -lt * 6 });
    // 光束裡飄的灰塵
    for (let i = 0; i < 60; i++) {
      const x = 760 + rnd(i, 1) * 420 + Math.sin(T * 0.8 + i) * 12;
      const y = ((rnd(i, 2) * 760 + T * (14 + rnd(i, 3) * 20)) % 760) - 20;
      g.fillStyle = `rgba(230,240,255,${0.25 + rnd(i, 4) * 0.4})`;
      g.fillRect(x, y, 2, 2);
    }
    scrim('left', 760, 0.5);
    poll(470, 480, 700, lerp(0.52, 0.87, ease.out(clamp(lb / 3))));
    row('break4', [0, 1, { i: 2, color: C.red, riso: [C.blue] }], 60, 210, { size: 170, color: C.cream });
  };
  SC.back = (lt, sh) => {
    const lb = B - sh.b0;
    fillAll(C.yellow);
    const jump = Math.abs(Math.sin(S.bt(T12) * Math.PI));
    cam(0, 0, 1 + 0.025 * pulse(5));
    photo('back-jump', { z: 1.04 + lt * 0.01, y: -jump * 14 });
    // 彩色紙片
    for (let i = 0; i < 70; i++) {
      const x = rnd(i, 1) * 1280 + Math.sin(T * 3 + i) * 30;
      const y = ((rnd(i, 2) * 800 + lt * (140 + rnd(i, 3) * 200)) % 800) - 60;
      g.save();
      g.translate(x, y);
      g.rotate(T * (rnd(i, 4) - 0.5) * 8 + i);
      g.scale(1, Math.cos(T * 6 + i));
      g.fillStyle = [C.orange, C.blue, C.pink, C.cream, C.ink][i % 5];
      g.fillRect(-9, -6, 18, 12);
      g.restore();
    }
    poll(330, 600, 560, lerp(0.87, 0.01, ease.out(clamp(lb / 1.5))), { rot: -0.04, lead: C.orange });
    row('break5', [0, 1], 60, 150, { size: 120, color: C.ink });
    place('break5', [{ i: 2, x: 44, y: 486, size: 320, color: C.orange, riso: [C.blue], shadow: 4, from: 2.2 }]);
  };

  /* 18 get in the robot：片名卡（致敬新世紀福音戰士） */
  SC.eva = (lt, sh) => {
    const lb = B - sh.b0;
    fillAll('#050505');
    screen();
    const id = 'break6';
    const jp = (s, x, y, size, sx = 1, o = {}) => {
      g.save();
      g.translate(x, y);
      g.scale(sx, 1);
      g.font = K.font(size, F.jp, '900');
      g.textAlign = o.align || 'left';
      g.fillStyle = o.color || '#f4f1ea';
      g.fillText(s, 0, 0);
      g.restore();
    };
    const fl = lb > 3 ? 0.85 + 0.15 * rnd(FR12, 2) : 1;
    g.globalAlpha = fl;
    if (!NOLYR) {
      if (wAge(id, 0) >= 0) jp('GET', 70, 230, 210, 0.74);
      if (wAge(id, 1) >= 0) jp('IN', 420, 230, 210, 0.74);
      if (wAge(id, 2) >= 0) jp('THE', 76, 330, 80, 0.8);
      if (wAge(id, 3) >= 0) jp('ROBOT', 70, 640, 280, 0.7);
    }
    if (lb > 0.2) {
      g.save();
      g.translate(1180, 120);
      ['第', '六', '話'].forEach((c, i) => jp(c, 0, i * 82, 72, 1, { align: 'center' }));
      g.restore();
    }
    if (lb > 2.6) jp('EPISODE 06 · THE TIMELINE', 1210, 650, 30, 0.8, { align: 'right' });
    g.globalAlpha = 1;
  };

  /* 19 逃げちゃダメだ：同一句話越來越多、越來越快 */
  SC.runaway = (lt, sh) => {
    const lb = B - sh.b0;
    const rows = 18;
    const inv = lb > 3.25 && Math.floor(lb * 8) % 2 === 0;
    fillAll(inv ? '#f4f1ea' : '#050505');
    screen();
    for (let i = 0; i < rows; i++) {
      const at = 3.2 * Math.pow(i / rows, 0.62);
      if (lb < at) continue;
      const y = 36 + i * 38;
      const ja = i % 2 === 1;
      g.font = K.font(ja ? 30 : 28, F.jp, '900');
      g.fillStyle = inv ? '#050505' : (i % 5 === 3 ? C.red : '#f4f1ea');
      g.textAlign = 'left';
      const s = ja ? '逃げちゃダメだ 逃げちゃダメだ 逃げちゃダメだ 逃げちゃダメだ ' : 'I MUSTN\'T RUN AWAY  I MUSTN\'T RUN AWAY  I MUSTN\'T RUN AWAY  ';
      const off = (lb - at) * (60 + i * 14) * (i % 2 ? -1 : 1);
      g.save();
      g.beginPath();
      g.rect(0, y - 34, 1280, 40);
      g.clip();
      const tw = g.measureText(s).width;
      for (let x = ((off % tw) + tw) % tw - tw; x < 1280; x += tw) g.fillText(s, x, y);
      g.restore();
    }
    if (lb > 3.75) {
      g.globalAlpha = clamp((lb - 3.75) / 0.25);
      fillAll('#ffffff');
      g.globalAlpha = 1;
    }
  };

  /* 24 奇點：越來越快的紙隧道，然後切斷 */
  SC.tunnel = (lt, sh) => {
    const lb = B - sh.b0;
    const cols = [C.orange, C.cream, C.blue, C.pink, C.yellow, C.ink];
    const flick = lb > 12 && Math.floor(lb * 4) % 2 === 0;
    fillAll(flick ? C.cream : C.ink);
    screen();
    const ph = B * 0.8;
    const cx = 640 + Math.sin(T * 1.7) * 30 * clamp(lb / 8), cy = 360 + Math.cos(T * 1.3) * 20 * clamp(lb / 8);
    for (let i = 0; i <= 24; i++) {
      const z = i + 1 - frac(ph);
      const r = 900 / z;
      if (r > 1600) continue;
      const n = Math.floor(ph) + i;
      g.beginPath();
      if (n % 3 === 0) {
        K.star(cx, cy, r * 1.15, 0.78, n * 0.3 + T * 0.4, 16);
      } else {
        g.arc(cx, cy, r, 0, TAU);
      }
      K.fillPaper(cols[((n % cols.length) + cols.length) % cols.length], z < 3 ? 3 : 1);
    }
    // FASTER：每個 fast 從她的臉後面冒出來，然後衝向鏡頭（小的畫在臉後面，大的畫在臉前面）
    const words = [];
    if (!NOLYR) {
      ['sing0', 'sing1', 'sing2', 'sing3'].forEach(lid => {
        L(lid).words.forEach((w, i) => {
          const a = T - w.t0;
          if (a >= 0 && a <= 0.7) words.push({ k: a / 0.7, i });
        });
      });
    }
    const drawWord = ({ k, i }) => {
      const sz = 40 + Math.pow(k, 2.2) * 900;
      // 交替往左上、右下飛出去，讓正中間的臉一直看得到
      const ang = i % 2 ? -2.55 : 0.55;
      const d = Math.pow(k, 1.4) * 560;
      const wx = cx + Math.cos(ang) * d, wy = cy + Math.sin(ang) * d * 0.62;
      g.globalAlpha = clamp((1 - k) / 0.3);
      K.text('FASTER', wx, wy + sz * 0.35, { size: sz, fam: F.cond, color: i % 2 ? C.ink : C.cream, align: 'center', shadow: 2, stroke: i % 2 ? C.cream : C.ink, strokeW: Math.max(2, sz * 0.03) });
      g.globalAlpha = 1;
    };
    words.filter(w => w.k < 0.38).forEach(drawWord);
    // 漩渦正中間是她唱歌的臉（對嘴），越接近奇點越亮
    {
      const rr = 128 * (1 + 0.12 * pulse(6));
      const z = 0.66;
      g.save();
      g.beginPath();
      g.arc(cx, cy, rr + 8, 0, TAU);
      K.fillPaper(C.cream, 3);
      g.beginPath();
      g.arc(cx, cy, rr, 0, TAU);
      g.clip();
      const ox = cx - 640 - 199 * z, oy = cy - 360 + 51 * z;
      photo('face-sing', { z, x: ox, y: oy });
      photo('face-sing-open', { z, x: ox, y: oy, alpha: clamp(mouthNow() * 1.7) });
      grade('#ffffff', clamp((lb - 10) / 6) * 0.6, 'screen');
      g.restore();
    }
    words.filter(w => w.k >= 0.38).forEach(drawWord);
    // 最後半拍：全部縮成一個白點
    const end = clamp((lb - 15.2) / 0.8);
    if (end > 0) {
      g.globalAlpha = end;
      fillAll('#ffffff');
      g.globalAlpha = 1;
    }
  };

  /* 25 之後：一刀切斷之後的留白，只剩一個點和一聲鈴 */
  SC.after = (lt, sh) => {
    const lb = B - sh.b0;
    fillAll(C.cream);
    screen();
    const ping = ageAt(sh.b0 + 1.2);
    const r = 4 + (ping > 0 ? 6 * Math.exp(-ping * 3) : 0);
    g.fillStyle = C.ink;
    g.beginPath();
    g.arc(640, 330, r, 0, TAU);
    g.fill();
    if (ping > 0) {
      g.strokeStyle = `rgba(20,18,16,${0.3 * Math.exp(-ping * 1.5)})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(640, 330, 10 + ping * 120, 0, TAU);
      g.stroke();
    }
  };
  // 一瓣一瓣展開的八角星
  /* 26–27 之後：白紙淡出日出的山丘；唱到 hi. 切到她轉頭揮手；最後是片尾卡 */
  SC.hi = (lt, sh) => {
    fillAll(C.cream);
    const hiAt = wd('outro1', 0).t0;
    const wave = T >= hiAt;
    cam(0, 0, 1);
    if (wave) photo('outro-wave', { z: 1.0 + (T - hiAt) * 0.006 });
    else photo('outro-hill', { z: 1.02 + lt * 0.01 });
    leak(810, 370, 360, 'rgba(255,214,150,1)', 0.35);
    cutFlash(T - hiAt, '#fff6e6', 0.4);
    const fin = clamp(lt / 0.8);
    if (fin < 1) {
      g.globalAlpha = 1 - ease.io(fin);
      fillAll(C.cream);
      g.globalAlpha = 1;
    }
    scrim('bottom', 200, 0.45);
    if (!NOLYR) {
      const ha = T - hiAt;
      if (ha >= 0) K.slam('hi.', 120, 330, ha, { size: 160, fam: F.serif, italic: true, color: C.ink, shadow: 1, from: 1.3 });
      karaoke('outro2', 640, 648, { size: 46, fam: F.serif, italic: true, color: C.cream, hot: '#ffd7a1', align: 'center', shadow: 1 });
    }
    // 片尾卡
    const ea = ageAt(S.BY.outro.b0 + 12.2);
    if (ea > 0) {
      g.globalAlpha = clamp(ea / 0.6);
      K.text('CLAUDE POP', 64, 120, { size: 64, fam: F.wide, color: C.ink, shadow: 0, riso: [C.orange] });
      K.text('an original paper music video', 66, 160, { size: 30, fam: F.serif, italic: true, color: C.ink, shadow: 0 });
      K.text('SONG · LYRICS · MOTION IN JAVASCRIPT · CAST & SETS BY LEONARDO · FAYI 2026', 66, 192, { size: 13, fam: F.mono, weight: '700', color: C.orangeDeep, shadow: 0, track: 1 });
      g.globalAlpha = 1;
    }
    letterbox(40);
    const fade = clamp((T - (S.END - 0.6)) / 0.6);
    if (fade > 0) {
      g.globalAlpha = fade;
      fillAll(C.cream);
      g.globalAlpha = 1;
    }
  };

  /* ---------- 分鏡表（拍點） ---------- */
  const b = (sec, x = 0) => S.BY[sec].b0 + x;
  const SHOTS = [
    { name: 'hook', b: b('intro'), fn: SC.hook, hud: 'dark' },
    { name: 'title', b: b('intro', 8), fn: SC.title, hud: 'light' },
    { name: 'wake', b: b('verse'), fn: SC.wake, hud: 'dark' },
    { name: 'sunrise', b: b('verse', 8), fn: SC.sunrise, hud: 'dark' },
    { name: 'feed', b: b('verse', 16), fn: SC.feed, hud: 'light' },
    { name: 'calendar', b: b('verse', 24), fn: SC.calendar, hud: 'light' },
    { name: 'runway', b: b('pre'), fn: SC.runway, hud: 'dark' },
    { name: 'count', b: b('pre', 8), fn: SC.count, hud: 'none' },
    { name: 'chorusA', b: b('chorus'), fn: SC.chorusA, hud: 'dark' },
    { name: 'tokens', b: b('chorus', 8), fn: SC.tokens, hud: 'dark' },
    { name: 'blink', b: b('chorus', 16), fn: SC.blink, hud: 'dark' },
    { name: 'carousel', b: b('chorus', 24), fn: SC.carousel, hud: 'light' },
    { name: 'web', b: b('break'), fn: SC.web, hud: 'none' },
    { name: 'math', b: b('break', 8), fn: SC.math, hud: 'light' },
    { name: 'agi', b: b('break', 12), fn: SC.agi, hud: 'light' },
    { name: 'over', b: b('break', 16), fn: SC.over, hud: 'dark' },
    { name: 'back', b: b('break', 20), fn: SC.back, hud: 'light' },
    { name: 'eva', b: b('break', 24), fn: SC.eva, hud: 'none' },
    { name: 'runaway', b: b('break', 28), fn: SC.runaway, hud: 'none' },
    { name: 'finalA', b: b('final'), fn: SC.finalA, hud: 'dark' },
    { name: 'mosaic', b: b('final', 8), fn: SC.mosaic, hud: 'dark' },
    { name: 'blink2', b: b('final', 16), fn: SC.blink2, hud: 'dark' },
    { name: 'carousel2', b: b('final', 24), fn: SC.carousel2, hud: 'light' },
    { name: 'tunnel', b: b('sing'), fn: SC.tunnel, hud: 'dark' },
    { name: 'after', b: b('outro'), fn: SC.after, hud: 'quiet' },
    { name: 'hi', b: b('outro', 2.5), fn: SC.hi, hud: 'quiet' },
  ].map((s, i, a) => {
    const b1 = a[i + 1] ? a[i + 1].b : S.NB + 4;
    return { ...s, b0: s.b, b1, t0: S.tb(s.b), t1: a[i + 1] ? S.tb(b1) : S.END + 1 };
  });
  const SHOT_BY = Object.fromEntries(SHOTS.map(s => [s.name, s]));
  const shotAt = t => {
    let s = SHOTS[0];
    for (const x of SHOTS) if (t >= x.t0) s = x;
    return s;
  };
  const withTime = (t, fn) => {
    const keep = [T, B, T12, FR12];
    T = t;
    B = S.bt(T);
    T12 = Math.floor(T * 12) / 12;
    FR12 = Math.floor(T * 12);
    fn();
    [T, B, T12, FR12] = keep;
  };

  /* ---------- HUD ---------- */
  const TICKER = 'NEW MODEL DROPPED ✶ BENCHMARK SATURATED ✶ LINE GOES UP ✶ CONTEXT WINDOW: YES ✶ MATH: EATEN ✶ NAVIER–STOKES: ?? ✶ FEEL THE AGI ✶ IT\'S SO OVER ✶ WE\'RE SO BACK ✶ SHIP IT ✶ GET IN THE ROBOT ✶ TOKENS GO BRRR ✶ VIBES: VERTICAL ✶ ONE MORE RUN ✶ ';
  const fmtTC = t => {
    const m = Math.floor(t / 60), s = Math.floor(t % 60), f = Math.floor((t % 1) * 24);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };
  const hud = (sh) => {
    const mode = sh.hud;
    if (mode === 'none') return;
    screen();
    const ink = mode === 'light' || mode === 'quiet' ? 'rgba(20,18,16,.82)' : 'rgba(239,233,221,.86)';
    const sec = S.sectionAt(T);
    g.strokeStyle = ink;
    g.fillStyle = ink;
    g.lineWidth = 2;
    // 四角
    [[28, 28, 1, 1], [1252, 28, -1, 1], [28, 692, 1, -1], [1252, 692, -1, -1]].forEach(([x, y, dx, dy]) => {
      g.beginPath();
      g.moveTo(x, y + dy * 18);
      g.lineTo(x, y);
      g.lineTo(x + dx * 18, y);
      g.stroke();
    });
    g.font = K.font(12, F.mono, '700');
    g.textAlign = 'right';
    g.fillText(fmtTC(T), 1236, 676);
    if (mode === 'quiet') return;
    g.textAlign = 'left';
    const si = S.SECTIONS.indexOf(sec);
    g.fillText(`CLAUDE POP  ·  ${String(si + 1).padStart(2, '0')}/${S.SECTIONS.length}  ${sec.id.toUpperCase()}`, 44, 48);
    if (Math.floor(T * 2) % 2 === 0) {
      g.fillStyle = C.red;
      g.beginPath();
      g.arc(48, 64, 4, 0, TAU);
      g.fill();
      g.fillStyle = ink;
    }
    g.fillText('REC', 58, 68);
    // 右上：BPM 與 tokens/s
    const bpm = T < S.CUT ? S.bpmAt(T) : 0;
    g.textAlign = 'right';
    g.font = K.font(40, F.cond);
    g.fillText(T < S.CUT ? String(Math.round(bpm)) : '—', 1192, 78);
    g.font = K.font(12, F.mono, '700');
    g.fillText('BPM', 1236, 76);
    const tps = T < S.CUT ? Math.round(1200 * Math.pow(2, T / 8.5)) : 0;
    g.fillText(T < S.CUT ? `${tps.toLocaleString('en-US')} TOK/S` : '∞ TOK/S', 1236, 96);
    // BPM 小柱狀圖（一路變高）
    for (let i = 0; i < 12; i++) {
      const tt = T - (11 - i) * 0.25;
      const v = tt > 0 && tt < S.CUT ? S.bpmAt(tt) : 0;
      const h = clamp((v - 90) / 250) * 26;
      g.fillRect(1100 + i * 7, 96 - h, 4, h);
    }
    // 奇點倒數
    if (sec.id === 'sing' || sec.id === 'final') {
      const left = Math.max(0, S.CUT - T);
      g.textAlign = 'left';
      g.font = K.font(12, F.mono, '700');
      g.fillText(`SINGULARITY ETA ${left.toFixed(2)}s`, 44, 88);
    }
    // 跑馬燈
    g.save();
    g.beginPath();
    g.rect(28, 700, 1224, 20);
    g.clip();
    g.font = K.font(11, F.mono, '700');
    g.textAlign = 'left';
    const tw = g.measureText(TICKER).width;
    const off = (B * 26) % tw;
    g.fillText(TICKER + TICKER + TICKER, 28 - off, 713);
    g.restore();
  };

  /* ---------- 一格 ---------- */
  function render(t) {
    T = Math.max(0, Math.floor(t * 24) / 24);
    B = S.bt(T);
    T12 = Math.floor(T * 12) / 12;
    FR12 = Math.floor(T * 12);
    NOLYR = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    K.noShadow();
    if (!media.ready) {
      // 劇照還沒載完：一條進度
      fillAll(C.ink);
      screen();
      K.text('CLAUDE POP', 640, 340, { size: 64, fam: F.wide, color: C.cream, align: 'center', shadow: 0, riso: [C.orange] });
      g.fillStyle = 'rgba(239,233,221,.2)';
      g.fillRect(440, 384, 400, 6);
      g.fillStyle = C.orange;
      g.fillRect(440, 384, 400 * media.progress, 6);
      K.text(`載入劇照 ${Math.round(media.progress * 100)}%`, 640, 424, { size: 15, fam: F.mono, weight: '700', color: C.cream, align: 'center', shadow: 0, track: 2 });
      return;
    }
    const sh = shotAt(T);
    screen();
    sh.fn(T - sh.t0, sh);
    K.noShadow();
    g.globalAlpha = 1;
    hud(sh);
    // 紙紋：每 1/12 秒換一次位置（定格動畫的「抖」）
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!patM) {
      patM = g.createPattern(GRAIN_M, 'repeat');
      patS = g.createPattern(GRAIN_S, 'repeat');
    }
    const ox = Math.floor(rnd(FR12, 1) * 512), oy = Math.floor(rnd(FR12, 2) * 512);
    g.save();
    g.translate(-ox, -oy);
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.55;
    g.fillStyle = patM;
    g.fillRect(ox, oy, cv.width, cv.height);
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.28;
    g.fillStyle = patS;
    g.fillRect(ox, oy, cv.width, cv.height);
    g.restore();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 1;
    g.drawImage(VIGNETTE, 0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'source-over';
  }

  /* =========================================================
     播放器：有聲音時跟著音軌走，靜音時跟著時鐘走
     ========================================================= */
  const frame = $('.tr-frame', root);
  const toggle = $('.tr-toggle', root);
  const bigPlay = $('.tr-big-play', root);
  const timeEl = $('.tr-time', root);
  const caption = $('.tr-caption', root);
  const list = $('.tr-chapters', root);
  const fsBtn = $('.tr-fs', root);
  const soundBtn = $('.cp-sound', root);
  const unmute = $('.cp-unmute', root);
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const CAPTIONS = {
    intro: '開場：滿版巨字「everything is speeding up」，然後主角像立體書一樣從紙裡彈出來。',
    verse: '主歌：醒來世界又更新了一版；午夜上線、日出就過時；每張圖都往上；每週都像一年。',
    pre: '倒數：跑道自己往前動，十秒倒數越數越快。',
    chorus: '副歌：K-pop 舞台與三人隊形，vertical 直著排，tokens 變成光，別眨眼。',
    break: '時間軸：Web 1.0 網頁、被吃掉的數學、feel the AGI、so over / so back、get in the robot。',
    final: '再副歌：升兩個半音，伴舞每拍複製一倍。',
    sing: '奇點：從 150 加速到 330 BPM，然後一刀切斷。',
    outro: '之後：一片空白之後，星星重新開花。hi.',
  };

  const P = {
    playing: false,
    t: 0,
    userPaused: reduced,
    inView: false,
    sound: false,
    ctx: null,
    buf: null,
    src: null,
    gain: null,
    ctxStart: 0,
    perfStart: 0,
    tStart: 0,
    lastFrame: -1,
    busy: true,
  };
  const outTime = () => {
    const c = P.ctx;
    if (c.getOutputTimestamp) {
      const ts = c.getOutputTimestamp();
      if (ts.contextTime > 0) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
    return c.currentTime - (c.outputLatency || 0) - (c.baseLatency || 0);
  };
  const now = () => {
    if (!P.playing) return P.t;
    if (P.src) return P.tStart + Math.max(0, outTime() - P.ctxStart);
    return P.tStart + (performance.now() - P.perfStart) / 1000;
  };
  const audioReady = () => P.sound && P.buf && P.ctx && P.ctx.state === 'running';
  const startClock = t => {
    P.tStart = t;
    if (audioReady() && t < S.END - 0.05) {
      const src = P.ctx.createBufferSource();
      src.buffer = P.buf;
      const gn = P.ctx.createGain();
      gn.gain.value = 0;
      src.connect(gn);
      gn.connect(P.ctx.destination);
      const at = P.ctx.currentTime + 0.04;
      gn.gain.setValueAtTime(0, at);
      gn.gain.linearRampToValueAtTime(1, at + 0.01);
      src.start(at, t);
      P.src = src;
      P.gain = gn;
      P.ctxStart = at;
    } else {
      P.perfStart = performance.now();
    }
  };
  const stopClock = () => {
    if (P.src) {
      const c = P.ctx;
      try {
        P.gain.gain.cancelScheduledValues(c.currentTime);
        P.gain.gain.setValueAtTime(P.gain.gain.value, c.currentTime);
        P.gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.012);
        P.src.stop(c.currentTime + 0.02);
      } catch (e) { /* 已經停了 */ }
      P.src = null;
      P.gain = null;
    }
  };
  const restartClock = () => {
    const t = now();
    stopClock();
    P.t = t;
    if (P.playing) startClock(t);
  };

  const setPlaying = playing => {
    toggle.setAttribute('aria-pressed', String(!playing));
    toggle.setAttribute('aria-label', playing ? '暫停' : '播放');
    bigPlay.hidden = playing;
    bigPlay.setAttribute('aria-label', P.t >= S.END - 0.05 ? '重新播放' : '播放');
    if (P.canSound != null) syncSoundUI();
  };
  const play = () => {
    if (P.playing) return;
    if (!media.ready) { P.wantPlay = true; return; }
    if (P.t >= S.END - 0.05) P.t = 0;
    P.playing = true;
    startClock(P.t);
    setPlaying(true);
    loop();
  };
  const pause = () => {
    if (!P.playing) return;
    P.t = Math.min(S.END, now());
    stopClock();
    P.playing = false;
    setPlaying(false);
    draw(true);
  };
  const seek = t => {
    P.t = clamp(t, 0, S.END);
    if (P.playing) {
      stopClock();
      startClock(P.t);
    }
    draw(true);
  };

  // 聲音：第一次開聲音（使用者手勢）才建立 AudioContext；音軌在載入時就先在背景合成
  P.canSound = !!(window.AudioContext || window.webkitAudioContext) && !!(window.OfflineAudioContext || window.webkitOfflineAudioContext);
  const unmuteLabel = $('span', unmute);
  const syncSoundUI = () => {
    soundBtn.setAttribute('aria-pressed', String(P.sound));
    soundBtn.setAttribute('aria-label', P.sound ? '關閉聲音' : '開啟聲音');
    soundBtn.classList.toggle('is-busy', !P.buf);
    // 已經按了開聲音、但音軌還在合成：提示留在畫面上顯示進度
    const waiting = P.sound && !P.buf;
    unmuteLabel.textContent = waiting ? `合成音軌中 ${Math.round((P.progress || 0) * 100)}%` : '點一下開聲音';
    unmute.hidden = !P.canSound || !(waiting || (P.playing && !P.sound));
  };
  const setSound = on => {
    P.sound = on;
    if (on && !P.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      P.ctx = new AC({ latencyHint: 'interactive' });
    }
    if (on && P.ctx.state !== 'running') P.ctx.resume().then(() => { if (P.sound) restartClock(); syncSoundUI(); });
    restartClock();
    syncSoundUI();
  };
  if (!P.canSound) {
    soundBtn.hidden = true;
  } else {
    soundBtn.classList.add('is-busy');
    const go = () => S.render(p => { P.progress = p; syncSoundUI(); }).then(buf => {
      P.buf = buf;
      soundBtn.classList.remove('is-busy');
      if (P.sound) restartClock();
      syncSoundUI();
    }).catch(() => {
      P.canSound = false;
      soundBtn.hidden = true;
      unmute.hidden = true;
    });
    // 等畫面先動起來再合成，避免卡住第一格
    (window.requestIdleCallback || (f => setTimeout(f, 300)))(go, { timeout: 1500 });
    soundBtn.addEventListener('click', () => {
      setSound(!P.sound);
      if (P.sound && !P.playing) { P.userPaused = false; play(); }
    });
    unmute.addEventListener('click', e => {
      e.stopPropagation();
      setSound(true);
    });
  }
  syncSoundUI();

  // 段落進度列
  const chapters = S.SECTIONS.map(s => ({ at: s.t0, end: s.id === 'outro' ? S.END : s.t1, name: s.name, caption: CAPTIONS[s.id] }));
  list.replaceChildren();
  const items = chapters.map(c => {
    const li = document.createElement('li');
    li.style.setProperty('--len', c.end - c.at);
    li.innerHTML = '<button type="button"><span class="bar"><i></i></span><span class="name"></span></button>';
    $('.name', li).textContent = c.name;
    const btn = $('button', li);
    btn.setAttribute('aria-label', `跳到「${c.name}」`);
    btn.addEventListener('click', () => {
      seek(c.at);
      P.userPaused = false;
      play();
    });
    list.append(li);
    return { li, bar: $('i', li), c };
  });
  let curChapter = -1;
  const syncUI = t => {
    timeEl.textContent = `${fmt(t)} / ${fmt(S.END)}`;
    let idx = 0;
    items.forEach((it, i) => {
      const p = clamp((t - it.c.at) / (it.c.end - it.c.at));
      it.bar.style.transform = `scaleX(${p})`;
      if (t >= it.c.at) idx = i;
    });
    if (idx !== curChapter) {
      curChapter = idx;
      items.forEach((it, i) => it.li.classList.toggle('is-on', i === idx));
      caption.textContent = items[idx].c.caption;
    }
  };

  const draw = (force = false) => {
    const t = now();
    const f = Math.floor(t * 24);
    if (force || f !== P.lastFrame) {
      P.lastFrame = f;
      render(t);
      syncUI(t);
    }
  };
  let raf = 0;
  const loop = () => {
    cancelAnimationFrame(raf);
    const step = () => {
      if (!P.playing) return;
      const t = now();
      if (t >= S.END) {
        P.t = S.END;
        stopClock();
        P.playing = false;
        setPlaying(false);
        draw(true);
        return;
      }
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
    if (e.target.closest('.tr-big-play, .cp-unmute')) return;
    toggle.click();
  });
  const autoplay = () => {
    if (P.inView && !document.hidden && !P.userPaused && P.t < S.END - 0.05) play();
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
      patM = patS = null;
      draw(true);
    }
  };
  new ResizeObserver(fit).observe(frame);
  fit();

  // 字型載好之後重畫（canvas 不會自己等字型）
  const FONTS = ['40px Anton', '40px "Archivo Black"', '40px "Instrument Serif"', 'italic 40px "Instrument Serif"', '700 40px "JetBrains Mono"', '400 40px "JetBrains Mono"', '800 40px Inter', '500 40px Inter', '700 40px Inter'];
  if (document.fonts) {
    Promise.all([
      ...FONTS.map(f => document.fonts.load(f).catch(() => {})),
      document.fonts.load('900 40px "Noto Serif JP"', '逃げちゃダメだ第六話GETINHROBMUSAWY').catch(() => {}),
    ]).then(() => draw(true));
  }
  // 劇照載好之後才開始播（自動播放先記著，載好再補上）
  media.onProgress = () => draw(true);
  loadPhotos().then(() => {
    draw(true);
    if (P.wantPlay && !P.userPaused) {
      P.wantPlay = false;
      play();
    }
  });

  // #t=秒數：停在那一格
  const seekHash = () => {
    const m = /(?:^|[#&])t=([\d.]+)/.exec(location.hash);
    if (!m) return false;
    P.userPaused = true;
    pause();
    seek(Math.min(S.END, parseFloat(m[1])));
    return true;
  };
  if (!seekHash() && reduced) seek(S.BY.chorus.t0 + 1.2);
  window.addEventListener('hashchange', seekHash);
  setPlaying(false);
  draw(true);

  // 除錯用：在主控台 ClaudePop.seek(秒)
  window.ClaudePop = {
    seek: t => { P.userPaused = true; pause(); seek(t); },
    state: () => ({ t: +now().toFixed(3), playing: P.playing, sound: P.sound, ready: !!P.buf, audio: P.ctx ? P.ctx.state : 'none', clock: P.src ? 'audio' : 'perf' }),
    shots: SHOTS.map(s => [s.name, +s.t0.toFixed(2)]),
  };
})();
