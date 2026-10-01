/* =========================================================
   戰鬥場景（battle.html）：原創動畫戰鬥短片
   夜裡的石橋，術師對上操控紅綢的面具術士，25 秒：對峙 → 交鋒 → 追擊 → 停頓 → 決著
   - 分鏡照動畫戰鬥戲的鏡頭語言排：快剪與靜止長鏡頭交替、閃白藏剪接點、紅綢掃過鏡頭的遮擋轉場、
     甩鏡、鏡頭跟著光束飛、同軸跳接（中景直接跳特寫）、刷白溶接接到高調色、淡出
   - 整支片畫在一張 canvas 上：石橋與迴廊是簡單的 3D 投影（推近、拉遠、俯瞰都是真的鏡頭移動），
     角色、紅綢、光束、魔法陣、雲都是程式畫的，沒有圖片素材
   - 角色與紅綢一秒 12 張（一拍二），鏡頭與光束維持流暢
   - GSAP 時間軸只當時鐘；每一格只依時間 t 計算，網址加 #t=秒數 會停在那一格
   ========================================================= */
(() => {
  const G = window.gsap;
  const $ = (s, root = document) => root.querySelector(s);
  const root = $('.tr-player');
  const mg = root && $('.mg', root);
  if (!mg) return;

  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const inv = (a, b, v) => clamp((v - a) / (b - a));
  const rnd = (i, n) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  const ease = {
    io: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    out: k => 1 - Math.pow(1 - k, 3),
    in: k => k * k * k,
    xo: k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  };
  // 一拍二：角色與紅綢每秒只換 12 張
  const q12 = t => Math.floor(t * 12) / 12;

  const END = 25;
  const C = {
    sky0: '#03061a', sky1: '#0a1942', sky2: '#1d3a78',
    magic: '#8ff4ff', magicD: '#2aa9ff',
    red: '#c8173f', redD: '#5d0820', redL: '#ff6f8a',
    hair: '#161a2b', hairL: '#4a5a94', skin: '#f3ddcf', skinD: '#cf9fa3',
    cloak: '#1f2c52', cloakD: '#111a36', lining: '#1db1a2', shirt: '#e6edf7', shirtD: '#a4b3cf',
    legs: '#222637', boot: '#181a25', wood: '#56392a', iris: '#27c3b0', irisD: '#0b4a58',
    coat: '#0d0d16', coatL: '#2b2b44', mask: '#efe9df', maskD: '#b5aca1', foeHair: '#43101d', vest: '#1c1424',
    rim: '#a8c8ff',
  };
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mixc = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

  mg.classList.add('battlefilm');
  mg.innerHTML = '<canvas width="1280" height="720"></canvas>';
  const cv = $('canvas', mg);
  const main = cv.getContext('2d');
  let g = main;
  // 發光層：光束、魔法陣、光點、火花、月亮另外畫一份（半解析度），撮影時只讓這一層發光
  const ev = document.createElement('canvas');
  const EG = ev.getContext('2d');
  // 撮影：2D 畫好的每一格交給 WebGL 做光暈、柔焦、色彩校正；不支援 WebGL 就直接顯示 2D canvas
  const post = window.FilmPost ? window.FilmPost.create(cv, ev) : null;
  if (post) mg.replaceChildren(post.canvas);
  // 角色：主畫面照常畫，發光層上畫成黑色剪影，擋住身後魔法陣、月亮的光（邊緣還是會透一點光）
  const cast = fn => {
    fn();
    if (!post || g === EG) return;
    const m = g.getTransform(), k = ev.width / cv.width, sil = SIL;
    g = EG;
    SIL = '#000';
    g.setTransform(m.a * k, m.b * k, m.c * k, m.d * k, m.e * k, m.f * k);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    fn();
    SIL = sil;
    g = main;
  };
  // 把會發光的東西在發光層再畫一次（同樣的鏡頭位置，縮成一半）
  const emit = (fn, gain = 1) => {
    fn();
    if (!post || g === EG) return;
    const m = g.getTransform(), k = ev.width / cv.width;
    const op = g.globalCompositeOperation, al = g.globalAlpha;
    g = EG;
    g.setTransform(m.a * k, m.b * k, m.c * k, m.d * k, m.e * k, m.f * k);
    g.globalCompositeOperation = op;
    g.globalAlpha = al * gain;
    fn();
    g = main;
  };
  let R = 1;
  let lastT = 0;

  const mk = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'));
    return c;
  };

  /* ---------- 曲線 ---------- */

  // Catmull-Rom：通過每個控制點的平滑曲線（任意維度）
  const spline = (pts, per = 6) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push(p1.map((_, d) => 0.5 * (2 * p1[d] + (p2[d] - p0[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  };
  const bez = (a, b, c, d, n = 48) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, s = 1 - t;
      out.push(a.map((_, k) => s * s * s * a[k] + 3 * s * s * t * b[k] + 3 * s * t * t * c[k] + t * t * t * d[k]));
    }
    return out;
  };
  const tangents = S => S.map((p, j) => {
    const a = S[Math.max(0, j - 1)], b = S[Math.min(S.length - 1, j + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  });
  // 路徑上 a～b 那一段（0～1，依長度）
  const sub = (S, a, b) => {
    const L = [0];
    for (let i = 1; i < S.length; i++) L.push(L[i - 1] + Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]));
    const tot = L[L.length - 1] || 1, A = clamp(a) * tot, B = clamp(b) * tot;
    const at = d => {
      let i = 1;
      while (i < L.length - 1 && L[i] < d) i++;
      const k = clamp((d - L[i - 1]) / ((L[i] - L[i - 1]) || 1));
      return S[i - 1].map((v, j) => lerp(v, S[i][j], k));
    };
    const out = [at(A)];
    for (let i = 0; i < S.length; i++) if (L[i] > A && L[i] < B) out.push(S[i]);
    out.push(at(B));
    return out;
  };
  // 從 (bx, by) 往 ang 方向長出的波浪曲線；波往尾端傳，curl 讓尾端越來越彎
  const wave = (bx, by, ang, len, amp, ph, o = {}) => {
    const { n = 26, freq = 1.3, curl = 0 } = o;
    const out = [];
    let x = bx, y = by;
    const step = len / n;
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = ang + curl * u * u;
      if (i) { x += Math.cos(a) * step; y += Math.sin(a) * step; }
      const off = Math.sin(u * freq * TAU - ph) * amp * u;
      out.push([x - Math.sin(a) * off, y + Math.cos(a) * off]);
    }
    return out;
  };

  /* ---------- 預先畫好的素材：星空、雲、遠山、暗角 ---------- */

  const STARS = mk(1280, 720, c => {
    for (let i = 0; i < 300; i++) {
      const x = rnd(i, 1) * 1280, y = rnd(i, 2) * 720, r = 0.5 + Math.pow(rnd(i, 3), 4) * 1.9;
      c.fillStyle = `rgba(215,232,255,${0.25 + rnd(i, 4) * 0.7})`;
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
      if (r > 1.7) {
        c.strokeStyle = 'rgba(200,228,255,.45)';
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(x - 7, y); c.lineTo(x + 7, y);
        c.moveTo(x, y - 7); c.lineTo(x, y + 7);
        c.stroke();
      }
    }
  });

  // 一朵雲：一串圓弧，右上是月光照亮的亮面，其餘是暗面（賽璐璐兩色）
  function cloudShape(c, cx, cy, bw, seed, lit, dark, rimA = 0.9) {
    const bumps = [];
    for (let k = 0; k < 7; k++) {
      const u = k / 6;
      bumps.push([cx - bw / 2 + u * bw, cy - Math.sin(u * Math.PI) * (26 + rnd(seed, k) * 40), 22 + Math.sin(u * Math.PI) * (26 + rnd(seed, k + 9) * 34)]);
    }
    const path = (dx, dy) => {
      c.beginPath();
      for (const [x, y, r] of bumps) { c.moveTo(x + dx + r, y + dy); c.arc(x + dx, y + dy, r, 0, TAU); }
      c.rect(cx - bw / 2 + dx, cy - 8 + dy, bw, 26);
    };
    c.save();
    path(0, 0);
    c.fillStyle = lit;
    c.globalAlpha = rimA;
    c.fill();
    c.clip();
    c.globalAlpha = 1;
    path(-9, 13);
    c.fillStyle = dark;
    c.fill();
    c.restore();
  }
  const cloudBank = (seed, n, y, lit, dark, size = 1) => mk(2800, 420, c => {
    for (let b = 0; b < n; b++) {
      const bw = (170 + rnd(seed, b + 40) * 260) * size;
      const x = (b + rnd(seed, b)) * 2800 / n;
      const yy = y + (rnd(seed, b + 20) - 0.5) * 70;
      // 左右各畫一次，鋪滿時接縫看不出來
      [x, x - 2800, x + 2800].forEach(xx => cloudShape(c, xx, yy, bw, seed * 31 + b, lit, dark));
    }
  });
  const CLOUD_FAR = cloudBank(3, 10, 300, '#2c4c8f', '#172d5f', 0.8);
  const CLOUD_NEAR = cloudBank(7, 7, 330, '#4a6fb5', '#213f7e', 1.15);
  const CLOUD_DAY = cloudBank(11, 8, 320, '#ffffff', '#cfeaf7', 1.1);
  const PUFF = mk(460, 260, c => cloudShape(c, 230, 180, 380, 5, '#5d82c6', '#29498b'));

  // 遠山：週期剛好是 2800，橫向鋪滿沒有接縫
  const RIDGE = mk(2800, 320, c => {
    c.beginPath();
    c.moveTo(0, 320);
    for (let x = 0; x <= 2800; x += 8) {
      const k = x / 2800 * TAU;
      c.lineTo(x, 170 - 60 * Math.sin(k * 4 + 1) - 34 * Math.sin(k * 11 + 2) - 12 * Math.sin(k * 29));
    }
    c.lineTo(2800, 320);
    c.closePath();
    const gr = c.createLinearGradient(0, 60, 0, 320);
    gr.addColorStop(0, '#1b3068');
    gr.addColorStop(1, '#0a1634');
    c.fillStyle = gr;
    c.fill();
  });

  const VIGNETTE = mk(1280, 720, c => {
    const gr = c.createRadialGradient(640, 360, 280, 640, 360, 800);
    gr.addColorStop(0, 'rgba(0,0,10,0)');
    gr.addColorStop(1, 'rgba(0,0,10,.55)');
    c.fillStyle = gr;
    c.fillRect(0, 0, 1280, 720);
  });

  /* ---------- 畫面工具 ---------- */

  // 撮影（後製）參數：每一格先重設，各個鏡頭再依需要調整；座標用 1280×720 的畫布座標
  const POST0 = { bloom: 1.1, th: 0, diff: 0.14, ca: 0.0018, vig: 0.38, grain: 0.05, grade: 0, expo: 1, inv: 0, blur: null, rays: null };
  let POST = { ...POST0, shock: [] };
  // 衝擊波：dt 是撞擊後經過的秒數，圈往外擴、力道遞減
  const shockAt = (x, y, dt, s = 0.03, speed = 1400) => {
    if (dt < 0 || dt > 0.6) return;
    POST.shock.push([x, y, 30 + dt * speed, s * (1 - dt / 0.6)]);
  };

  let SX = 0, SY = 0;   // 鏡頭晃動
  const shake = (t, amp, hz = 24) => {
    const i = Math.floor(t * hz);
    SX = (rnd(i, 3) - 0.5) * 2 * amp;
    SY = (rnd(i, 7) - 0.5) * 2 * amp;
  };
  const screen = () => g.setTransform(R, 0, 0, R, SX * R, SY * R);
  const view = (cx, cy, z, rot = 0) => {
    screen();
    g.translate(640, 360);
    if (rot) g.rotate(rot);
    g.scale(z, z);
    g.translate(-cx, -cy);
  };
  const at = (x, y, s, fn) => {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    fn();
    g.restore();
  };
  const fill = col => { g.setTransform(R, 0, 0, R, 0, 0); g.fillStyle = col; g.fillRect(0, 0, 1280, 720); };
  const wash = (col, a) => {
    if (a <= 0) return;
    g.setTransform(R, 0, 0, R, 0, 0);
    g.globalAlpha = Math.min(1, a);
    g.fillStyle = col;
    g.fillRect(0, 0, 1280, 720);
    g.globalAlpha = 1;
  };
  const glowDot = (...args) => emit(() => glowDotDraw(...args));
  const glowDotDraw = (x, y, r, col = '150,240,255', a = 1) => {
    if (r <= 0 || a <= 0) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${a})`);
    gr.addColorStop(0.25, `rgba(${col},${0.8 * a})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    const op = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalCompositeOperation = op;
  };
  // 螢幕座標的橫向重複圖層（雲、遠山）
  function layer(img, ox, oy = 0, a = 1, bottom = 800) {
    if (a <= 0) return;
    screen();
    g.globalAlpha = Math.min(1, a);
    const w = img.width;
    for (let x = ((ox % w) + w) % w - w; x < 1280; x += w) g.drawImage(img, x, bottom - img.height + oy);
    g.globalAlpha = 1;
  }
  const moon = (...args) => emit(() => moonDraw(...args), 0.35);
  function moonDraw(x, y, r, a = 1) {
    glowDot(x, y, r * 3.4, '120,170,255', 0.45 * a);
    g.globalAlpha = a;
    g.fillStyle = '#eef5ff';
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(150,178,222,.35)';
    [[-0.3, -0.2, 0.25], [0.25, 0.1, 0.18], [-0.05, 0.38, 0.14], [0.36, -0.36, 0.1]].forEach(([dx, dy, rr]) => {
      g.beginPath();
      g.arc(x + dx * r, y + dy * r, rr * r, 0, TAU);
      g.fill();
    });
    g.globalAlpha = 1;
  }
  // 夜空：hy 是地平線的螢幕高度；ox、oy 讓星星、月亮、雲依深度做視差
  function nightSky(o = {}) {
    const { hy = 430, ox = 0, oy = 0, moonAt = null, mr = 70, clouds = 1, drift = 0 } = o;
    screen();
    const gr = g.createLinearGradient(0, hy - 820, 0, hy);
    gr.addColorStop(0, C.sky0);
    gr.addColorStop(0.62, C.sky1);
    gr.addColorStop(1, C.sky2);
    g.fillStyle = gr;
    g.fillRect(-40, -40, 1360, 800);
    g.drawImage(STARS, -((ox * 0.05) % 1280 + 1280) % 1280, oy * 0.05);
    g.drawImage(STARS, 1280 - ((ox * 0.05) % 1280 + 1280) % 1280, oy * 0.05);
    if (moonAt) moon(moonAt[0] - ox * 0.08, moonAt[1] - oy * 0.08, mr);
    if (clouds) {
      layer(CLOUD_FAR, -ox * 0.25 - drift * 0.5, hy - 430 - oy * 0.25, clouds, 520);
      layer(CLOUD_NEAR, -ox * 0.5 - drift, hy - 430 - oy * 0.5, clouds, 640);
    }
  }
  function daySky(o = {}) {
    const { hy = 470, drift = 0 } = o;
    screen();
    const gr = g.createLinearGradient(0, hy - 700, 0, hy + 200);
    gr.addColorStop(0, '#f6fcff');
    gr.addColorStop(0.55, '#c9ecf8');
    gr.addColorStop(1, '#8fd0ec');
    g.fillStyle = gr;
    g.fillRect(-40, -40, 1360, 800);
    layer(CLOUD_DAY, -drift, hy - 430, 0.9, 620);
  }
  // 橋下的深谷：往下越暗，幾道流動的霧
  function gorge(hy, t, a = 1) {
    screen();
    const gr = g.createLinearGradient(0, hy, 0, 760);
    gr.addColorStop(0, '#132a5c');
    gr.addColorStop(1, '#040a1c');
    g.fillStyle = gr;
    g.fillRect(-40, hy, 1360, 800 - hy);
    for (let i = 0; i < 4; i++) {
      const y = hy + 40 + i * 70, x = ((t * (14 + i * 6) + i * 400) % 1800) - 300;
      const mgr = g.createRadialGradient(x, y, 0, x, y, 520);
      mgr.addColorStop(0, `rgba(120,160,230,${0.12 * a})`);
      mgr.addColorStop(1, 'rgba(120,160,230,0)');
      g.fillStyle = mgr;
      g.save();
      g.translate(x, y);
      g.scale(1, 0.18);
      g.translate(-x, -y);
      g.fillRect(x - 520, y - 520, 1040, 1040);
      g.restore();
    }
  }

  /* ---------- 3D：石橋與迴廊 ---------- */
  // X 右、Y 下、Z 往前；yaw > 0 往右轉頭，pitch > 0 往下看；roll 讓畫面繞中心轉

  const NEAR = 0.25;
  const cam3 = (x, y, z, pitch = 0, f = 900, roll = 0, yaw = 0) => ({
    x, y, z, f, pitch, yaw,
    cp: Math.cos(pitch), sp: Math.sin(pitch), cr: Math.cos(roll), sr: Math.sin(roll), cy: Math.cos(yaw), sy: Math.sin(yaw),
  });
  const toCam = (K, X, Y, Z) => {
    const ex = X - K.x, dy = Y - K.y, ez = Z - K.z;
    const dx = ex * K.cy - ez * K.sy, dz = ex * K.sy + ez * K.cy;
    return [dx, dy * K.cp - dz * K.sp, dy * K.sp + dz * K.cp];
  };
  const scr = (K, c) => {
    const x = K.f * c[0] / c[2], y = K.f * c[1] / c[2];
    return [640 + x * K.cr - y * K.sr, 360 + x * K.sr + y * K.cr, K.f / c[2]];
  };
  const pt3 = (K, X, Y, Z) => {
    const c = toCam(K, X, Y, Z);
    return c[2] < NEAR ? null : scr(K, c);
  };
  const horizon = K => 360 - K.f * Math.tan(K.pitch);
  function poly3(K, pts, col) {
    const cs = pts.map(p => toCam(K, p[0], p[1], p[2]));
    const out = [];
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i], b = cs[(i + 1) % cs.length];
      if (a[2] >= NEAR) out.push(a);
      if ((a[2] >= NEAR) !== (b[2] >= NEAR)) {
        const k = (NEAR - a[2]) / (b[2] - a[2]);
        out.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k), NEAR]);
      }
    }
    if (out.length < 3) return;
    g.beginPath();
    out.forEach((c, i) => { const p = scr(K, c); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
    g.closePath();
    g.fillStyle = col;
    g.fill();
    g.strokeStyle = col;   // 同色細邊，蓋掉多邊形之間的縫
    g.lineWidth = 0.8;
    g.stroke();
  }
  function line3(K, a, b) {
    let A = toCam(K, a[0], a[1], a[2]), B = toCam(K, b[0], b[1], b[2]);
    if (A[2] < NEAR && B[2] < NEAR) return;
    const cut = (P, Q) => { const k = (NEAR - P[2]) / (Q[2] - P[2]); return [lerp(P[0], Q[0], k), lerp(P[1], Q[1], k), NEAR]; };
    if (A[2] < NEAR) A = cut(A, B);
    else if (B[2] < NEAR) B = cut(B, A);
    const p = scr(K, A), q = scr(K, B);
    g.moveTo(p[0], p[1]);
    g.lineTo(q[0], q[1]);
  }

  const PAL3 = {
    night: { deck: [46, 62, 108], seam: 'rgba(12,20,44,.55)', lit: [78, 104, 164], dark: [30, 42, 80], top: [104, 134, 196], front: [56, 76, 128], fog: [26, 52, 112], fogK: 0.02 },
    day: { deck: [200, 228, 242], seam: 'rgba(120,160,190,.4)', lit: [236, 248, 253], dark: [164, 204, 226], top: [252, 254, 255], front: [190, 222, 238], fog: [222, 244, 252], fogK: 0.03 },
  };
  const fogc = (P, col, z) => css(mixc(col, P.fog, 1 - Math.exp(-Math.max(0, z) * P.fogK)));

  // 石橋：橋面 X -3～3、Y=0，沿 Z 延伸；兩側矮牆與城垛（由遠到近畫）
  function bridge3(K, o = {}) {
    const { z0 = -10, z1 = 80, P = PAL3.night, seams = 26 } = o;
    screen();
    // 霧依離鏡頭的實際深度（鏡頭轉向時也對）
    const zc = (z, x = 0) => toCam(K, x, -0.5, z)[2];
    for (let z = z1; z > z0; z -= 4) {
      const za = Math.max(z0, z - 4);
      poly3(K, [[-3, 0, za], [3, 0, za], [3, 0, z], [-3, 0, z]], fogc(P, P.deck, zc(z - 2)));
    }
    // 石板縫：只畫近的
    g.strokeStyle = P.seam;
    g.lineWidth = 1.2;
    g.beginPath();
    for (let z = Math.floor(Math.min(z1, K.z + seams)); z >= Math.max(z0, Math.floor(K.z - 2)); z--) {
      line3(K, [-3, 0, z], [3, 0, z]);
      for (let x = -3 + (Math.abs(z) % 2) * 0.6; x < 3; x += 1.2) line3(K, [x, 0, z], [x, 0, z + 1]);
    }
    g.stroke();
    for (const side of [-1, 1]) {
      const xi = side * 3, xo = side * 3.45, face = side < 0 ? P.lit : P.dark;
      for (let z = z1; z > z0; z -= 4) {
        const za = Math.max(z0, z - 4), zz = zc(z - 2, xi);
        poly3(K, [[xi, 0, za], [xi, 0, z], [xi, -0.95, z], [xi, -0.95, za]], fogc(P, face, zz));
        poly3(K, [[xi, -0.95, za], [xi, -0.95, z], [xo, -0.95, z], [xo, -0.95, za]], fogc(P, P.top, zz));
      }
      for (let z = Math.floor(z1 / 1.7) * 1.7; z >= z0; z -= 1.7) {
        const zz = zc(z, xi);
        if (zz < -1) continue;
        poly3(K, [[xi, -1.45, z], [xi, -1.45, z + 0.9], [xo, -1.45, z + 0.9], [xo, -1.45, z]], fogc(P, P.top, zz));
        poly3(K, [[xi, -0.95, z], [xi, -0.95, z + 0.9], [xi, -1.45, z + 0.9], [xi, -1.45, z]], fogc(P, face, zz));
        poly3(K, [[xi, -0.95, z], [xo, -0.95, z], [xo, -1.45, z], [xi, -1.45, z]], fogc(P, P.front, zz));
      }
    }
  }

  // 橋下的迴廊：左邊實牆（盲拱）、右邊一排拱柱，拱洞外是夜空；月光從拱洞斜照在地上
  const ARC = { floor: [30, 40, 74], wall: [24, 32, 62], blind: [14, 20, 42], ceil: [12, 17, 36], rib: [20, 28, 54], pillar: [44, 60, 106], pillarF: [32, 44, 82], light: [96, 132, 200], fog: [8, 12, 30], fogK: 0.05 };
  function arcade(K) {
    const zMax = 51, P = ARC;
    const zc = z => z - K.z;
    screen();
    for (let z = zMax; z > K.z - 1; z -= 3) {
      const za = z - 3, zz = zc(z);
      poly3(K, [[-2.6, 0, za], [2.6, 0, za], [2.6, 0, z], [-2.6, 0, z]], fogc(P, P.floor, zz));
      poly3(K, [[-2.6, -4.2, za], [2.6, -4.2, za], [2.6, -4.2, z], [-2.6, -4.2, z]], fogc(P, P.ceil, zz));
      poly3(K, [[-2.6, 0, za], [-2.6, 0, z], [-2.6, -4.2, z], [-2.6, -4.2, za]], fogc(P, P.wall, zz));
    }
    // 盲拱、肋拱、地上的月光
    for (let z = 48; z > K.z - 3; z -= 3) {
      const zz = zc(z), arch = [];
      for (let i = 0; i <= 10; i++) arch.push([-2.6, -2.5 - Math.sin(i / 10 * Math.PI) * 0.9, z + 0.5 + i / 10 * 2]);
      poly3(K, [[-2.6, 0, z + 0.5], ...arch, [-2.6, 0, z + 2.5]], fogc(P, P.blind, zz));
      poly3(K, [[-2.6, -4.2, z], [2.6, -4.2, z], [2.6, -4.2, z + 0.7], [-2.6, -4.2, z + 0.7]], fogc(P, P.rib, zz));
      poly3(K, [[2.6, 0, z + 0.8], [2.6, 0, z + 2.9], [0.3, 0, z + 1.9], [0.3, 0, z - 0.2]], fogc(P, P.light, zz + 2));
    }
    // 右側：矮欄、拱柱、拱上的牆（由遠到近）
    for (let z = 48; z > K.z - 4; z -= 3) {
      const zz = zc(z), arch = [];
      for (let i = 0; i <= 10; i++) arch.push([2.6, -2.6 - Math.sin(i / 10 * Math.PI) * 1.0, z + 3 - i / 10 * 2.3]);
      poly3(K, [[2.6, -4.2, z + 0.7], [2.6, -4.2, z + 3], ...arch], fogc(P, P.pillar, zz));
      poly3(K, [[2.6, 0, z + 0.7], [2.6, 0, z + 3], [2.6, -0.8, z + 3], [2.6, -0.8, z + 0.7]], fogc(P, P.pillarF, zz));
      poly3(K, [[2.6, 0, z], [3.3, 0, z], [3.3, -4.2, z], [2.6, -4.2, z]], fogc(P, P.pillarF, zz));
      poly3(K, [[2.6, 0, z], [2.6, 0, z + 0.7], [2.6, -4.2, z + 0.7], [2.6, -4.2, z]], fogc(P, P.pillar, zz));
    }
    // 盡頭
    poly3(K, [[-2.6, 0, zMax], [2.6, 0, zMax], [2.6, -4.2, zMax], [-2.6, -4.2, zMax]], css(P.fog));
  }

  /* ---------- 側面的石橋（遠景用，世界座標：橋面 y=0） ---------- */

  const PAL2 = {
    night: { s0: [36, 54, 98], s1: [10, 18, 42], seam: 'rgba(6,12,30,.4)', ring: [46, 66, 116], top: [56, 78, 132], rim: 'rgba(160,198,255,.75)', tower: [30, 46, 88] },
    day: { s0: [214, 236, 248], s1: [160, 204, 228], seam: 'rgba(120,165,195,.35)', ring: [228, 244, 252], top: [240, 250, 255], rim: 'rgba(255,255,255,.9)', tower: [196, 226, 242] },
  };
  function bridgeSide(P = PAL2.night) {
    const x0 = -1900, x1 = 1900;
    const body = () => {
      g.beginPath();
      g.rect(x0, 0, x1 - x0, 780);
      for (let x = x0; x < x1; x += 320) {
        const a = x + 70, b = x + 320, m = (a + b) / 2, r = (b - a) / 2;
        g.moveTo(a, 780);
        g.lineTo(a, 40 + r);
        g.arc(m, 40 + r, r, Math.PI, 0);
        g.lineTo(b, 780);
        g.closePath();
      }
    };
    g.save();
    body();
    const gr = g.createLinearGradient(0, 0, 0, 780);
    gr.addColorStop(0, css(P.s0));
    gr.addColorStop(1, css(P.s1));
    g.fillStyle = gr;
    g.fill('evenodd');
    g.clip('evenodd');
    g.strokeStyle = P.seam;
    g.lineWidth = 1.3;
    g.beginPath();
    for (let y = 28, r = 0; y < 780; y += 28, r++) {
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      for (let x = x0 + (r % 2) * 34; x < x1; x += 68) { g.moveTo(x, y - 28); g.lineTo(x, y); }
    }
    g.stroke();
    g.strokeStyle = css(P.ring);
    g.lineWidth = 18;
    for (let x = x0; x < x1; x += 320) {
      const a = x + 70, b = x + 320, m = (a + b) / 2, r = (b - a) / 2;
      g.beginPath();
      g.arc(m, 40 + r, r + 9, Math.PI, 0);
      g.stroke();
    }
    g.restore();
    // 矮牆與城垛，上緣有月光
    g.fillStyle = css(P.top);
    g.fillRect(x0, -26, x1 - x0, 26);
    for (let x = x0; x < x1; x += 40) g.fillRect(x, -42, 22, 17);
    g.fillStyle = P.rim;
    g.fillRect(x0, -26, x1 - x0, 2.5);
    for (let x = x0; x < x1; x += 40) g.fillRect(x, -42, 22, 2.5);
    g.fillRect(x0, -1, x1 - x0, 2);
    // 城塔
    const tg = g.createLinearGradient(0, -440, 0, 780);
    tg.addColorStop(0, css(P.tower));
    tg.addColorStop(1, css(P.s1));
    g.fillStyle = tg;
    g.fillRect(560, -420, 130, 1200);
    for (let i = 0; i < 5; i++) g.fillRect(560 + i * 28.5, -444, 16, 26);
    g.fillStyle = P.rim;
    g.fillRect(687, -420, 3, 1200);
    for (let i = 0; i < 5; i++) g.fillRect(560 + i * 28.5, -444, 16, 2.5);
    g.fillStyle = 'rgba(4,8,20,.8)';
    g.beginPath();
    g.moveTo(612, -300); g.lineTo(612, -340); g.arc(625, -340, 13, Math.PI, 0); g.lineTo(638, -300);
    g.fill();
  }

  /* ---------- 光束、魔法陣、紅綢、閃光 ---------- */

  // 光束：外圈藍光、青色中層、白色核心，頭粗尾細；點可以帶第三個值當粗細倍率（3D 的遠近）
  const beam = (...args) => emit(() => beamDraw(...args));
  function beamDraw(S, o = {}) {
    const { w = 1, a = 1, head = 1 } = o;
    const N = S.length;
    if (N < 2 || a <= 0) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const layers = [[C.magicD, 0.2, 34], [C.magic, 0.7, 13], ['#ffffff', 1, 5]];
    for (const [col, al, lw] of layers) {
      g.strokeStyle = col;
      g.globalAlpha = al * a;
      for (let i = 0; i < N - 1; i += 4) {
        const j = Math.min(N - 1, i + 4), u = j / (N - 1);
        g.lineWidth = lw * w * (S[j][2] || 1) * (0.2 + 0.8 * u);
        g.beginPath();
        g.moveTo(S[i][0], S[i][1]);
        for (let k = i + 1; k <= j; k++) g.lineTo(S[k][0], S[k][1]);
        g.stroke();
      }
    }
    g.restore();
    if (head) {
      const h = S[N - 1];
      glowDot(h[0], h[1], 46 * w * (h[2] || 1) * head, '140,235,255', a);
    }
  }
  // 魔法陣：外圈、符文帶、六芒星、內圈；prog 控制畫到哪裡，sy 壓扁做出傾斜
  const magicCircle = (...args) => emit(() => magicCircleDraw(...args));
  function magicCircleDraw(x, y, r, prog, rot, o = {}) {
    const { sy = 1, ang = 0, a = 1 } = o;
    if (prog <= 0 || a <= 0 || r <= 0) return;
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.scale(1, sy);
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.3);
    gr.addColorStop(0, `rgba(120,230,255,${0.3 * a * prog})`);
    gr.addColorStop(1, 'rgba(40,120,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, r * 1.3, 0, TAU);
    g.fill();
    const lw = Math.max(1, r * 0.022);
    const glow = path => {
      g.strokeStyle = C.magicD; g.globalAlpha = 0.35 * a; g.lineWidth = lw * 3.4; path(); g.stroke();
      g.strokeStyle = C.magic; g.globalAlpha = 0.95 * a; g.lineWidth = lw; path(); g.stroke();
      g.strokeStyle = '#fff'; g.globalAlpha = 0.7 * a; g.lineWidth = lw * 0.45; path(); g.stroke();
    };
    const ring = (rr, k, r0) => { if (k > 0) glow(() => { g.beginPath(); g.arc(0, 0, rr, r0, r0 + TAU * k); }); };
    const k1 = inv(0, 0.45, prog), k2 = inv(0.2, 0.7, prog), k3 = inv(0.4, 1, prog);
    ring(r, k1, rot);
    ring(r * 0.92, k1, -rot * 1.3);
    ring(r * 0.62, k2, -rot);
    ring(r * 0.16, k2, rot * 2);
    if (k2 > 0) {
      const tri = off => [0, 1, 2, 3].map(i => { const q = -Math.PI / 2 + off + rot * 0.6 + i * TAU / 3; return [Math.cos(q) * r * 0.62, Math.sin(q) * r * 0.62]; });
      [tri(0), tri(Math.PI)].forEach(T => {
        const P = sub(T, 0, k2);
        glow(() => { g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); });
      });
    }
    // 符文：一格一格亮起來
    const n = 24;
    for (let i = 0; i < n * k3; i++) {
      const q = i / n * TAU - rot * 0.5, rr = r * 0.77;
      g.save();
      g.rotate(q);
      glow(() => {
        g.beginPath();
        g.arc(0, 0, rr, -0.06, 0.06);
        g.moveTo(rr - r * 0.05, (i % 3) * r * 0.012);
        g.lineTo(rr + r * 0.05, (i % 3) * r * 0.012);
        if (i % 2) { g.moveTo(rr + r * 0.02, -r * 0.03); g.lineTo(rr - r * 0.02, r * 0.03); }
      });
      g.restore();
    }
    g.restore();
  }
  // 紅綢：沿曲線的一條緞帶，會翻面（正面亮紅、背面暗紅），尾端收尖
  function ribbon(S, w, phase, o = {}) {
    const { twist = 1, a = 1, tip = 0.35, cols = [C.red, C.redD, C.redL], line = true } = o;
    const N = S.length;
    if (N < 2 || a <= 0) return;
    const T = tangents(S);
    g.globalAlpha = a;
    let prev = null;
    const edgeA = [], edgeB = [];
    for (let j = 0; j < N; j++) {
      const u = j / (N - 1);
      let k = 1;
      if (u > 1 - tip) k = Math.max(0, (1 - u) / tip);
      if (u < 0.1) k *= 0.45 + u * 5.5;
      const tw = Math.cos(phase + u * twist * 5);
      const hw = w * k * Math.max(0.1, Math.abs(tw)) / 2;
      const nx = -T[j][1], ny = T[j][0];
      const L = [S[j][0] + nx * hw, S[j][1] + ny * hw], Q = [S[j][0] - nx * hw, S[j][1] - ny * hw];
      if (prev) {
        g.fillStyle = F(tw >= 0 ? cols[0] : cols[1]);
        g.beginPath();
        g.moveTo(prev[0][0], prev[0][1]);
        g.lineTo(L[0], L[1]);
        g.lineTo(Q[0], Q[1]);
        g.lineTo(prev[1][0], prev[1][1]);
        g.closePath();
        g.fill();
        g.strokeStyle = g.fillStyle;
        g.lineWidth = 1;
        g.stroke();
        if (tw >= 0 && !SIL) {
          g.strokeStyle = cols[2];
          g.lineWidth = Math.max(1, w * 0.05);
          g.beginPath();
          g.moveTo(prev[0][0], prev[0][1]);
          g.lineTo(L[0], L[1]);
          g.stroke();
        }
      }
      prev = [L, Q];
      edgeA.push(L);
      edgeB.push(Q);
    }
    // 兩側的線稿
    if (line && !SIL) {
      g.beginPath();
      edgeA.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      edgeB.reverse().forEach(p => g.lineTo(p[0], p[1]));
      g.strokeStyle = 'rgba(30,2,12,.85)';
      g.lineWidth = lw() * 0.8;
      g.lineJoin = 'round';
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  // 往外噴的火花：位置只由時間決定
  const sparks = (...args) => emit(() => sparksDraw(...args));
  function sparksDraw(x, y, dt, o = {}) {
    const { n = 26, speed = 900, seed = 1, col = '#e9fdff', len = 0.05, life = 0.5, spread = TAU, dir = 0, size = 3 } = o;
    if (dt < 0 || dt > life) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = col;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const q = dir + (rnd(seed, i) - 0.5) * spread, v = speed * (0.35 + rnd(seed, i + 50));
      const d0 = v * Math.max(0, dt - len) * (1 - dt / life * 0.4), d1 = v * dt * (1 - dt / life * 0.4);
      g.globalAlpha = 1 - dt / life;
      g.lineWidth = size * (0.5 + rnd(seed, i + 90));
      g.beginPath();
      g.moveTo(x + Math.cos(q) * d0, y + Math.sin(q) * d0 + dt * dt * 300);
      g.lineTo(x + Math.cos(q) * d1, y + Math.sin(q) * d1 + dt * dt * 300);
      g.stroke();
    }
    g.restore();
  }
  // 星芒爆閃：一圈白色尖刺
  const burst = (...args) => emit(() => burstDraw(...args));
  function burstDraw(x, y, r, a = 1, seed = 1, rot = 0) {
    if (a <= 0) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = a;
    g.fillStyle = '#ffffff';
    g.translate(x, y);
    g.rotate(rot);
    for (let i = 0; i < 18; i++) {
      const q = i / 18 * TAU + rnd(seed, i) * 0.2, L = r * (0.45 + rnd(seed, i + 30) * 0.8), w = r * 0.035 * (1 + rnd(seed, i + 60));
      g.beginPath();
      g.moveTo(Math.cos(q + Math.PI / 2) * w, Math.sin(q + Math.PI / 2) * w);
      g.lineTo(Math.cos(q) * L, Math.sin(q) * L);
      g.lineTo(Math.cos(q - Math.PI / 2) * w, Math.sin(q - Math.PI / 2) * w);
      g.fill();
    }
    g.restore();
    glowDot(x, y, r * 0.6, '160,240,255', a);
  }
  // 飄浮的光點（螢幕座標）
  function motes(t, n, o = {}) {
    const { col = '150,240,255', vx = -40, vy = -30, a = 1, seed = 3, size = 3 } = o;
    for (let i = 0; i < n; i++) {
      const x = ((rnd(seed, i) * 1500 + t * vx * (0.5 + rnd(seed, i + 7))) % 1500 + 1500) % 1500 - 110;
      const y = ((rnd(seed, i + 3) * 900 + t * vy * (0.5 + rnd(seed, i + 9))) % 900 + 900) % 900 - 90;
      const tw = 0.5 + 0.5 * Math.sin(t * 5 + i);
      glowDot(x, y, size * (2 + rnd(seed, i + 11) * 3), col, a * (0.4 + 0.6 * tw));
    }
  }
  // 速度線：從畫面邊緣往中心
  function speedLines(cx, cy, t, a = 1, n = 40, col = '200,230,255') {
    if (a <= 0) return;
    screen();
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    const f = Math.floor(t * 24);
    for (let i = 0; i < n; i++) {
      const q = rnd(f, i) * TAU, r0 = 360 + rnd(f, i + 40) * 380, L = 120 + rnd(f, i + 80) * 260;
      g.strokeStyle = `rgba(${col},${a * (0.25 + rnd(f, i + 5) * 0.5)})`;
      g.lineWidth = 1 + rnd(f, i + 9) * 2.5;
      g.beginPath();
      g.moveTo(cx + Math.cos(q) * r0, cy + Math.sin(q) * r0);
      g.lineTo(cx + Math.cos(q) * (r0 + L), cy + Math.sin(q) * (r0 + L));
      g.stroke();
    }
    g.restore();
  }
  // 光的碎片：五瓣的花形
  const PETAL = (() => {
    const p = new Path2D();
    for (let i = 0; i < 5; i++) {
      const q = i / 5 * TAU;
      p.moveTo(Math.cos(q) * 0.55 + 0.45, Math.sin(q) * 0.55);
      p.arc(Math.cos(q) * 0.55, Math.sin(q) * 0.55, 0.45, 0, TAU);
    }
    p.moveTo(0.5, 0);
    p.arc(0, 0, 0.5, 0, TAU);
    return p;
  })();

  /* ---------- 角色：術師 ---------- */
  // 原創角色：黑色短鮑伯頭、青綠髮夾與眼睛、深藍披風（青綠內襯）、白上衣，法杖頂端是新月環與水晶
  let SIL = null;   // 設定時整個角色畫成單色剪影
  const F = c => SIL || c;

  // 線稿：深藍黑的外框。粗細依目前的縮放換算，畫面上約 1.4～4.6px（特寫時粗、遠景細）
  const LINE = '#0a0e22';
  const lw = () => {
    const m = g.getTransform(), s = Math.hypot(m.a, m.b) / R || 1;
    return clamp(1.1 + 0.95 * Math.sqrt(s), 1.4, 4.6) / s;
  };
  const ink = (k = 1) => {
    if (SIL) return;
    g.strokeStyle = LINE;
    g.lineWidth = lw() * k;
    g.lineJoin = 'round';
    g.stroke();
  };

  function limb(a, b, w, col, c2) {
    const path = () => {
      g.beginPath();
      g.moveTo(a[0], a[1]);
      if (c2) g.quadraticCurveTo(c2[0], c2[1], b[0], b[1]);
      else g.lineTo(b[0], b[1]);
    };
    g.lineCap = 'round';
    if (!SIL) {
      g.strokeStyle = LINE;
      g.lineWidth = w + lw() * 2;
      path();
      g.stroke();
    }
    g.strokeStyle = col;
    g.lineWidth = w;
    path();
    g.stroke();
  }
  function staff(ax, ay, bx, by, glow = 1) {
    limb([ax, ay], [bx, by], 9, F(C.wood));
    if (!SIL) {
      g.strokeStyle = 'rgba(168,200,255,.45)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(ax + 3, ay);
      g.lineTo(bx + 3, by);
      g.stroke();
    }
    const q = Math.atan2(by - ay, bx - ax);
    g.save();
    g.translate(bx, by);
    g.rotate(q + Math.PI / 2);
    g.strokeStyle = F('#c9d6ee');
    g.lineWidth = 5;
    g.beginPath();
    g.arc(0, -26, 26, 0.9, Math.PI * 2.1 - 0.9 + Math.PI, false);
    g.stroke();
    g.fillStyle = F('#bff9ff');
    g.beginPath();
    g.moveTo(0, -46); g.lineTo(9, -26); g.lineTo(0, -8); g.lineTo(-9, -26);
    g.closePath();
    g.fill();
    g.restore();
    if (!SIL && glow > 0) glowDot(bx + Math.cos(q) * 26, by + Math.sin(q) * 26, 60 * glow, '130,240,255', Math.min(1, glow));
  }
  function heroEye(x, y, w, open, flip, o) {
    g.save();
    g.translate(x, y);
    g.scale(w * flip, 1);
    const h = 12 * open;
    if (open > 0.08) {
      g.fillStyle = '#fbfdff';
      g.beginPath();
      g.ellipse(0, 1, 11, h, 0, 0, TAU);
      g.fill();
      g.save();
      g.clip();
      const ix = o.look[0] * 3 * flip, iy = o.look[1] * 3;
      const gr = g.createLinearGradient(0, -10, 0, 12);
      gr.addColorStop(0, C.irisD);
      gr.addColorStop(1, C.iris);
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(ix, 1 + iy, 8, 10.5, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#05262f';
      g.beginPath();
      g.ellipse(ix, 2 + iy, 3.4, 5, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(10,30,50,.4)';
      g.fillRect(-12, -14, 24, 8);
      if (o.glint) {
        g.strokeStyle = `rgba(170,250,255,${o.glint})`;
        g.lineWidth = 1.1;
        g.beginPath();
        g.ellipse(ix, 2 + iy, 6.2, 7.6, 0, 0, TAU);
        g.moveTo(ix + 4, 2 + iy);
        g.ellipse(ix, 2 + iy, 4, 5, 0, 0, TAU);
        g.stroke();
      }
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(ix - 3 * flip, -3 + iy, 2.7, 0, TAU);
      g.fill();
      g.beginPath();
      g.arc(ix + 3 * flip, 5 + iy, 1.2, 0, TAU);
      g.fill();
      g.restore();
    }
    g.strokeStyle = C.hair;
    g.lineCap = 'round';
    g.lineWidth = 3.4;
    g.beginPath();
    g.moveTo(-11, 1 - h * 0.5);
    g.quadraticCurveTo(0, -h - 3, 12, -h * 0.7);
    g.lineTo(15, -h * 0.9 - 2);
    g.stroke();
    if (open > 0.3) {
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-6, h + 1.5);
      g.quadraticCurveTo(2, h + 3, 9, h);
      g.stroke();
    }
    g.restore();
  }
  // 術師的頭：中心 (0,0)，臉寬約 82；yaw 轉頭（正值轉向畫面右），pitch 低頭（正值往下看）
  function heroHead(tq, o = {}) {
    const { yaw = 0, pitch = 0, eye = 1, look = [0, 0], mouth = 0, wind = 1, scratch = 0, glint = 0, windDir = -1 } = o;
    const fx = yaw * 15, fy = pitch * 12;
    const sw = k => Math.sin(tq * 7 + k * 1.7) * wind + windDir * wind * 0.6;
    // 後髮：鮑伯頭，髮尾一撮撮
    g.fillStyle = F(C.hair);
    g.beginPath();
    g.moveTo(-53, -20);
    g.bezierCurveTo(-62, -84, 62, -84, 53, -20);
    const back = [[57, 22], [50, 50], [44, 36], [34, 58], [0, 46], [-34, 58], [-44, 36], [-50, 50], [-57, 22]];
    back.forEach(([x, y], i) => g.lineTo(x + sw(i) * 4 * (y > 30 ? 1 : 0.4), y));
    g.closePath();
    g.fill();
    ink();
    if (SIL) {
      g.beginPath();
      g.ellipse(fx * 0.3, 10, 42, 48, 0, 0, TAU);
      g.fill();
      return;
    }
    // 脖子
    g.fillStyle = C.skinD;
    g.fillRect(-13, 30, 26, 46);
    g.beginPath();
    g.moveTo(-13, 30); g.lineTo(-13, 76);
    g.moveTo(13, 30); g.lineTo(13, 76);
    ink();
    // 臉
    const face = () => {
      g.beginPath();
      g.moveTo(-41, -34);
      g.bezierCurveTo(-43 + Math.max(0, yaw) * 6, 12, -30 + fx * 0.3, 40, fx * 0.7, 52);
      g.bezierCurveTo(30 + fx * 0.3, 40, 43 + Math.min(0, yaw) * 6, 12, 41, -34);
      g.closePath();
    };
    face();
    g.fillStyle = C.skin;
    g.fill();
    ink();
    // 瀏海
    const tips = [[48, 4], [37, -9], [28, 8], [16, -6], [6, 11], [-6, -4], [-16, 9], [-28, -7], [-38, 6], [-48, -5]];
    const bangs = dy => {
      g.beginPath();
      g.moveTo(-55, -26 + dy);
      g.bezierCurveTo(-60, -86 + dy, 60, -86 + dy, 55, -26 + dy);
      tips.forEach(([x, y], i) => g.lineTo(x + fx * 0.35 + sw(i + 3) * 2.2, y + dy + fy * 0.5));
      g.closePath();
    };
    // 瀏海在額頭上的影子
    g.save();
    face();
    g.clip();
    g.fillStyle = 'rgba(190,130,140,.5)';
    bangs(8);
    g.fill();
    // 背光側的臉頰影子
    g.fillStyle = 'rgba(190,130,140,.28)';
    g.beginPath();
    g.ellipse(-44 + fx * 0.5, 14, 16, 44, 0, 0, TAU);
    g.fill();
    g.restore();
    // 眼睛
    const ey = 7 + fy;
    const wL = 1 - Math.max(0, -yaw) * 0.5, wR = 1 - Math.max(0, yaw) * 0.5;
    heroEye(-19 * (1 - Math.max(0, yaw) * 0.25) + fx, ey, wL, eye, -1, { look, glint });
    heroEye(19 * (1 - Math.max(0, -yaw) * 0.25) + fx, ey, wR, eye, 1, { look, glint });
    // 鼻子、嘴
    g.strokeStyle = C.skinD;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(fx * 1.2 + 1, 22 + fy);
    g.lineTo(fx * 1.2 - 1, 26 + fy);
    g.stroke();
    const mx = fx * 1.05, my = 36 + fy * 0.8;
    g.strokeStyle = '#7a3c46';
    g.lineWidth = 1.7;
    g.beginPath();
    if (mouth > 0.5) { g.moveTo(mx - 6, my - 1); g.quadraticCurveTo(mx, my + 3.5, mx + 6, my - 1); g.stroke(); }
    else if (mouth < -0.5) { g.fillStyle = '#5b2530'; g.ellipse(mx, my, 5, 2.8, 0, 0, TAU); g.fill(); }
    else { g.moveTo(mx - 4, my); g.lineTo(mx + 4, my); g.stroke(); }
    if (scratch) {
      g.strokeStyle = `rgba(200,40,60,${scratch})`;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(18 + fx, 24 + fy);
      g.lineTo(30 + fx, 19 + fy);
      g.stroke();
    }
    // 瀏海、兩側的鬢髮
    g.fillStyle = C.hair;
    bangs(0);
    g.fill();
    ink();
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 45, -30);
      g.quadraticCurveTo(s * 54, 12, s * 49 + sw(s + 9) * 4, 50);
      g.quadraticCurveTo(s * 40, 14, s * 35, -24);
      g.closePath();
      g.fill();
      ink();
    }
    // 頭髮光圈與月光邊
    g.strokeStyle = 'rgba(95,115,185,.75)';
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const q = -2.45 + i * 0.3;
      g.beginPath();
      g.arc(0, -30, 44, q, q + 0.18);
      g.stroke();
    }
    g.strokeStyle = 'rgba(168,200,255,.55)';
    g.lineWidth = 2.2;
    g.beginPath();
    g.arc(0, -24, 56, -1.25, 0.3);
    g.stroke();
    // 髮夾：兩根交叉的青綠色
    g.strokeStyle = C.lining;
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(-44, -38); g.lineTo(-30, -24);
    g.moveTo(-44, -26); g.lineTo(-30, -38);
    g.stroke();
  }
  function boot(x, side) {
    g.fillStyle = F(C.boot);
    g.beginPath();
    g.moveTo(x - 15, -112);
    g.lineTo(x + 15, -112);
    g.lineTo(x + 17, -14);
    g.quadraticCurveTo(x + 18 + side * 4, 0, x + 4 + side * 6, 0);
    g.lineTo(x - 6 + side * 6, 0);
    g.quadraticCurveTo(x - 19 + side * 4, 0, x - 17, -14);
    g.closePath();
    g.fill();
    ink();
    if (!SIL) {
      g.fillStyle = '#2c3044';
      g.fillRect(x - 16, -112, 32, 10);
      g.fillStyle = 'rgba(168,200,255,.5)';
      g.fillRect(x + 13, -100, 2.5, 90);
    }
  }
  // 正面全身：腳底 (0,0)，身高約 620；pose：side（杖立身旁）、guard（橫杖擋）、raise（舉杖）
  function heroFront(tq, o = {}) {
    const { pose = 'side', wind = 1, windDir = -1, head = {}, glow = 1, lean = 0 } = o;
    const sw = (k, a = 1) => Math.sin(tq * 6.5 + k) * a * wind;
    g.save();
    if (lean) g.rotate(lean);
    // 披風背面
    const hemL = -150 + windDir * 36 * wind, hemR = 150 + windDir * 36 * wind;
    g.fillStyle = F(C.cloakD);
    g.beginPath();
    g.moveTo(-58, -484);
    g.quadraticCurveTo(-112 + windDir * 12 * wind, -380, hemL + sw(0, 14), -128);
    for (let i = 1; i <= 8; i++) {
      const u = i / 8;
      g.lineTo(lerp(hemL, hemR, u) + sw(i, 10), -128 + Math.sin(u * 10 + tq * 9) * 12 * wind + (i % 2 ? 12 : -6));
    }
    g.quadraticCurveTo(112 + windDir * 12 * wind, -380, 58, -484);
    g.closePath();
    g.fill();
    ink();
    // 腿、靴子、短裙
    limb([-24, -232], [-29, -60], 27, F(C.legs));
    limb([24, -232], [29, -60], 27, F(C.legs));
    boot(-30, -1);
    boot(30, 1);
    g.fillStyle = F('#262b40');
    g.beginPath();
    g.moveTo(-40, -306);
    g.lineTo(-66 + sw(2, 6), -214);
    g.quadraticCurveTo(0, -198, 66 + sw(3, 6), -214);
    g.lineTo(40, -306);
    g.closePath();
    g.fill();
    ink();
    // 上衣與腰帶
    g.fillStyle = F(C.shirt);
    g.beginPath();
    g.moveTo(-50, -478);
    g.quadraticCurveTo(-45, -390, -40, -300);
    g.lineTo(40, -300);
    g.quadraticCurveTo(45, -390, 50, -478);
    g.closePath();
    g.fill();
    ink();
    if (!SIL) {
      g.fillStyle = 'rgba(120,140,180,.45)';
      g.beginPath();
      g.moveTo(-50, -478); g.quadraticCurveTo(-45, -390, -40, -300); g.lineTo(-14, -300); g.quadraticCurveTo(-20, -400, -10, -478);
      g.closePath();
      g.fill();
    }
    g.fillStyle = F('#1b1f30');
    g.fillRect(-42, -314, 84, 14);
    g.fillStyle = F(C.lining);
    g.fillRect(-7, -316, 14, 18);
    const arms = () => {
      if (pose === 'side') {
        limb([-54, -468], [-80, -330], 22, F(C.shirt), [-74, -410]);
        limb([54, -468], [66, -318], 22, F(C.shirt), [70, -400]);
        staff(-86, -6, -72, -770, glow);
        g.fillStyle = F(C.skin);
        g.beginPath(); g.arc(-80, -328, 10, 0, TAU); g.arc(66, -312, 10, 0, TAU); g.fill();
      } else if (pose === 'guard') {
        limb([-54, -468], [-58, -402], 22, F(C.shirt), [-92, -430]);
        limb([54, -468], [60, -410], 22, F(C.shirt), [92, -440]);
        staff(210, -418, -200, -392, glow);
        g.fillStyle = F(C.skin);
        g.beginPath(); g.arc(-58, -400, 10, 0, TAU); g.arc(60, -408, 10, 0, TAU); g.fill();
      } else {
        limb([-54, -470], [-60, -662], 22, F(C.shirt), [-92, -560]);
        limb([54, -468], [168, -472], 22, F(C.shirt), [112, -446]);
        staff(-66, -470, -52, -940, glow);
        g.fillStyle = F(C.skin);
        g.beginPath(); g.arc(-60, -664, 10, 0, TAU); g.fill(); ink(0.8);
        g.beginPath(); g.ellipse(178, -474, 13, 10, -0.2, 0, TAU); g.fill(); ink(0.8);
      }
    };
    // 披風前襟（左右兩片），內側露出青綠內襯
    for (const s of [-1, 1]) {
      g.fillStyle = F(C.cloak);
      g.beginPath();
      g.moveTo(s * 40, -482);
      g.quadraticCurveTo(s * 80, -498, s * 98, -452);
      g.lineTo(s * (126 + sw(s + 4, 10)) + windDir * 20 * wind, -150 + sw(s, 8));
      g.lineTo(s * 64 + windDir * 12 * wind, -142);
      g.quadraticCurveTo(s * 56, -330, s * 50, -452);
      g.closePath();
      g.fill();
      ink();
      if (!SIL) {
        g.strokeStyle = C.lining;
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(s * 64 + windDir * 12 * wind, -144);
        g.quadraticCurveTo(s * 56, -330, s * 50, -452);
        g.stroke();
        g.strokeStyle = s > 0 ? 'rgba(168,200,255,.6)' : 'rgba(0,0,0,.25)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(s * 98, -452);
        g.lineTo(s * (126 + sw(s + 4, 10)) + windDir * 20 * wind, -150 + sw(s, 8));
        g.stroke();
      }
    }
    arms();
    // 領口與領結
    if (!SIL) {
      g.fillStyle = C.shirt;
      g.beginPath();
      g.moveTo(-22, -486); g.lineTo(0, -462); g.lineTo(22, -486); g.lineTo(12, -470); g.lineTo(0, -452); g.lineTo(-12, -470);
      g.closePath();
      g.fill();
      ink(0.7);
      g.fillStyle = C.lining;
      g.beginPath();
      g.moveTo(0, -466); g.lineTo(-13, -474); g.lineTo(-13, -456); g.closePath();
      g.moveTo(0, -466); g.lineTo(13, -474); g.lineTo(13, -456); g.closePath();
      g.fill();
    }
    g.save();
    g.translate(0, -548);
    g.scale(0.88, 0.88);
    heroHead(tq, { windDir, wind, ...head });
    g.restore();
    g.restore();
  }
  // 背面全身（鏡頭在她身後）：cast 時右手往前舉杖
  function heroBack(tq, o = {}) {
    const { wind = 1, windDir = -1, cast = 1, glow = 1 } = o;
    const sw = (k, a = 1) => Math.sin(tq * 6.5 + k) * a * wind;
    limb([-26, -200], [-36, -60], 28, F(C.legs));
    limb([26, -200], [36, -60], 28, F(C.legs));
    boot(-37, -1);
    boot(37, 1);
    const hx = lerp(96, 128, cast), hy = lerp(-420, -590, cast);
    staff(hx - 22, hy + 240, hx + 34, hy - 250, glow);
    // 披風
    const cloak = () => {
      g.beginPath();
      g.moveTo(-40, -508);
      g.quadraticCurveTo(-80, -502, -94, -454);
      g.lineTo(-150 + windDir * 40 * wind + sw(1, 12), -150);
      for (let i = 1; i <= 8; i++) {
        const u = i / 8;
        g.lineTo(lerp(-150, 158, u) + windDir * 40 * wind * (1 - u * 0.6) + sw(i, 9), -146 + Math.sin(u * 11 + tq * 9) * 12 * wind + (i % 2 ? 12 : -5));
      }
      g.lineTo(94, -454);
      g.quadraticCurveTo(80, -502, 40, -508);
      g.closePath();
    };
    cloak();
    g.fillStyle = F(C.cloak);
    g.fill();
    ink();
    if (!SIL) {
      g.save();
      cloak();
      g.clip();
      const gr = g.createLinearGradient(-160, 0, 160, 0);
      gr.addColorStop(0, 'rgba(6,10,26,.6)');
      gr.addColorStop(0.6, 'rgba(6,10,26,0)');
      g.fillStyle = gr;
      g.fillRect(-260, -520, 520, 400);
      g.strokeStyle = C.cloakD;
      g.lineWidth = 7;
      [[-40, -420, -90, -150], [8, -430, 10, -140], [52, -420, 90, -150]].forEach(([a, b, c, d]) => {
        g.beginPath();
        g.moveTo(a, b);
        g.quadraticCurveTo((a + c) / 2 + sw(a, 8), (b + d) / 2, c + windDir * 24 * wind, d);
        g.stroke();
      });
      g.restore();
      g.strokeStyle = 'rgba(168,200,255,.65)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(94, -454);
      g.lineTo(158 + windDir * 16 * wind, -150);
      g.stroke();
    }
    // 兜帽（放下的）與內襯
    g.fillStyle = F(C.cloakD);
    g.beginPath();
    g.ellipse(0, -494, 56, 22, 0, 0, TAU);
    g.fill();
    ink();
    if (!SIL) {
      g.strokeStyle = C.lining;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(0, -498, 48, 14, 0, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
    // 舉杖的右手
    limb([72, -470], [hx, hy], 32, F(C.cloak), [lerp(92, 124, cast), lerp(-440, -500, cast)]);
    g.fillStyle = F(C.skin);
    g.beginPath();
    g.arc(hx, hy, 10, 0, TAU);
    g.fill();
    ink();
    // 後腦勺的頭髮
    g.fillStyle = F(C.hair);
    g.beginPath();
    g.moveTo(-50, -548);
    g.bezierCurveTo(-58, -616, 58, -616, 50, -548);
    [[54, -514], [44, -498], [34, -510], [22, -494], [8, -506], [-8, -494], [-22, -508], [-34, -494], [-46, -506], [-54, -514]].forEach(([x, y], i) => g.lineTo(x + sw(i + 2, 4) + windDir * 5 * wind, y));
    g.closePath();
    g.fill();
    ink();
    if (!SIL) {
      g.strokeStyle = 'rgba(95,115,185,.8)';
      g.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        const q = -2.2 + i * 0.35;
        g.beginPath();
        g.arc(0, -556, 40, q, q + 0.2);
        g.stroke();
      }
      g.strokeStyle = 'rgba(168,200,255,.6)';
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(0, -552, 52, -1.2, 0.4);
      g.stroke();
      g.strokeStyle = C.lining;
      g.lineWidth = 3.2;
      g.beginPath();
      g.moveTo(-50, -566); g.lineTo(-36, -552);
      g.moveTo(-50, -554); g.lineTo(-36, -566);
      g.stroke();
    }
  }
  // 高角度俯拍的跪姿：右膝跪地、左膝立起、右手握著立在地上的法杖；披風在身後攤開
  // rise 0 低著頭、閉眼 → 1 抬頭看鏡頭
  function heroKneel(tq, o = {}) {
    const { rise = 0, wind = 1 } = o;
    const sw = (k, a = 1) => Math.sin(tq * 6 + k) * a * wind;
    g.fillStyle = 'rgba(4,8,22,.3)';
    g.beginPath();
    g.ellipse(0, 40, 250, 80, 0, 0, TAU);
    g.fill();
    // 身後攤開的披風：外緣被風掀動，右下有一道破口
    const edge = [[-60, -170], [-190, -210], [-290, -120], [-320, 0], [-250, 70], [-150, 60], [-110, 30], [110, 30], [160, 64], [250, 80], [300, -10], [280, -130], [190, -214], [60, -170]];
    const cloak = () => {
      g.beginPath();
      edge.forEach(([x, y], i) => {
        const k = i === 0 || i === edge.length - 1 || (i >= 6 && i <= 7) ? 0 : 1;
        const px = x + sw(i, 12) * k, py = y + sw(i + 3, 8) * k;
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      });
      g.closePath();
    };
    cloak();
    g.fillStyle = C.cloak;
    g.fill();
    ink();
    g.save();
    cloak();
    g.clip();
    g.strokeStyle = '#2f4378';
    g.lineWidth = 10;
    [[-80, -150, -270, -40], [-60, -120, -200, 50], [80, -150, 260, -60], [60, -120, 230, 60]].forEach(([a, b, c, d], i) => {
      g.beginPath();
      g.moveTo(a, b);
      g.quadraticCurveTo((a + c) / 2 + sw(i, 12), (b + d) / 2 - 20, c, d);
      g.stroke();
    });
    g.strokeStyle = C.cloakD;
    g.lineWidth = 7;
    [[-70, -130, -240, 10], [70, -130, 280, -20]].forEach(([a, b, c, d], i) => {
      g.beginPath();
      g.moveTo(a, b);
      g.quadraticCurveTo((a + c) / 2 + sw(i + 5, 12), (b + d) / 2 + 30, c, d);
      g.stroke();
    });
    g.restore();
    g.strokeStyle = 'rgba(168,200,255,.5)';
    g.lineWidth = 3;
    g.beginPath();
    edge.slice(8, 13).forEach(([x, y], i) => (i ? g.lineTo(x + sw(i + 8, 12), y + sw(i + 11, 8)) : g.moveTo(x + sw(i + 8, 12), y + sw(i + 11, 8))));
    g.stroke();
    g.fillStyle = '#0a1230';
    g.beginPath();
    g.moveTo(206, 76); g.lineTo(226, 30); g.lineTo(240, 78);
    g.closePath();
    g.fill();
    // 披風前緣的青綠內襯
    g.strokeStyle = C.lining;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(-110, 30); g.quadraticCurveTo(-90, -80, -60, -168);
    g.moveTo(110, 30); g.quadraticCurveTo(90, -80, 60, -168);
    g.stroke();
    // 立在地上的法杖
    staff(-150, 80, -112, -330, 0.45);
    // 短裙與腿：右膝跪地（畫面左），左膝立起（畫面右），靴子朝鏡頭
    g.fillStyle = '#262b40';
    g.beginPath();
    g.moveTo(-42, -52); g.lineTo(42, -52); g.lineTo(112, 26); g.quadraticCurveTo(0, 50, -112, 26);
    g.closePath();
    g.fill();
    ink();
    g.fillStyle = C.legs;
    g.beginPath();
    g.ellipse(-66, 44, 44, 24, 0.1, 0, TAU);
    g.fill();
    ink();
    limb([62, 0], [80, 70], 34, C.legs);
    g.beginPath();
    g.ellipse(58, 6, 40, 30, -0.3, 0, TAU);
    g.fill();
    ink();
    g.fillStyle = C.boot;
    g.beginPath();
    g.moveTo(58, 62); g.lineTo(102, 62); g.lineTo(110, 118); g.quadraticCurveTo(82, 134, 54, 118);
    g.closePath();
    g.fill();
    ink();
    g.fillStyle = '#2c3044';
    g.fillRect(56, 60, 48, 10);
    g.fillStyle = 'rgba(168,200,255,.45)';
    g.beginPath();
    g.ellipse(70, -6, 20, 10, -0.3, 0, TAU);
    g.fill();
    // 上身（高角度看起來比較短）
    g.fillStyle = C.shirt;
    g.beginPath();
    g.moveTo(-56, -162); g.lineTo(56, -162); g.lineTo(42, -50); g.lineTo(-42, -50);
    g.closePath();
    g.fill();
    ink();
    g.fillStyle = 'rgba(120,140,180,.5)';
    g.beginPath();
    g.moveTo(-56, -162); g.lineTo(-14, -162); g.lineTo(-10, -50); g.lineTo(-42, -50);
    g.closePath();
    g.fill();
    g.fillStyle = '#1b1f30';
    g.fillRect(-44, -64, 88, 13);
    g.fillStyle = C.lining;
    g.fillRect(-7, -66, 14, 16);
    // 披風蓋住的肩膀
    for (const s of [-1, 1]) {
      g.fillStyle = C.cloak;
      g.beginPath();
      g.moveTo(s * 26, -178); g.quadraticCurveTo(s * 92, -186, s * 104, -120); g.lineTo(s * 92, -60); g.lineTo(s * 58, -80); g.lineTo(s * 48, -156);
      g.closePath();
      g.fill();
      ink();
      g.strokeStyle = C.lining;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(s * 58, -80); g.lineTo(s * 48, -156);
      g.stroke();
    }
    // 右手往外握杖，左手搭在立起的膝上
    limb([-86, -150], [-126, -150], 24, C.shirt, [-112, -120]);
    limb([86, -150], [66, -8], 24, C.shirt, [104, -60]);
    g.fillStyle = C.skin;
    g.beginPath();
    g.arc(-128, -152, 11, 0, TAU);
    g.arc(64, -4, 11, 0, TAU);
    g.fill();
    g.fillStyle = C.lining;
    g.beginPath();
    g.moveTo(0, -162); g.lineTo(-13, -170); g.lineTo(-13, -152); g.closePath();
    g.moveTo(0, -162); g.lineTo(13, -170); g.lineTo(13, -152); g.closePath();
    g.fill();
    g.save();
    g.translate(0, -222);
    g.rotate(lerp(0.12, 0, rise));
    heroHead(tq, { pitch: lerp(1, 0.05, rise), eye: rise < 0.35 ? 0 : lerp(0.3, 1, inv(0.35, 0.8, rise)), look: [0.1, lerp(0.4, -0.5, rise)], scratch: 1, wind, windDir: -1 });
    g.restore();
  }
  // 遠景的小剪影
  function tinyHero(x, y, s, tq, o = {}) {
    const col = o.col || '#070d20';
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(-6, -46); g.lineTo(-17 - Math.sin(tq * 7) * 3, -10); g.lineTo(11, -8); g.lineTo(7, -46);
    g.closePath();
    g.fill();
    g.fillRect(-6, -12, 4, 12);
    g.fillRect(2, -12, 4, 12);
    g.beginPath();
    g.arc(0, -52, 7.5, 0, TAU);
    g.fill();
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(12, -2);
    g.lineTo(15, -72);
    g.stroke();
    g.strokeStyle = o.rim || 'rgba(168,200,255,.7)';
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(7, -46); g.lineTo(11, -8);
    g.moveTo(3, -58); g.arc(0, -52, 7.5, -1.1, 0.5);
    g.stroke();
    g.restore();
    if (o.glow !== 0) {
      const m = g.getTransform();
      g.save();
      glowDot(x + 15 * s, y - 74 * s, 16 * s * (o.glow || 1));
      g.setTransform(m);
      g.restore();
    }
  }
  function tinyFoe(x, y, s, tq, o = {}) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    for (let i = 0; i < 3; i++) ribbon(wave(0, -56, -1.9 + i * 0.5, 70 * (o.rib || 1), 10, tq * 4 + i), 7, tq * 3 + i);
    g.fillStyle = '#05050c';
    g.beginPath();
    g.moveTo(-8, -58); g.lineTo(-15 - Math.sin(tq * 6) * 3, 0); g.lineTo(15, 0); g.lineTo(8, -58);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(0, -65, 7, 0, TAU);
    g.fill();
    g.fillStyle = C.mask;
    g.beginPath();
    g.ellipse(1.5, -65, 4.5, 6, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(168,200,255,.6)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(8, -58); g.lineTo(15, 0);
    g.stroke();
    g.restore();
  }
  // 貼地拍的側面靴子：鞋底 (0,0)，鞋尖朝右；toe 讓腳尖往上翹（抬腳時）
  function bootCU(o = {}) {
    const { toe = 0 } = o;
    g.save();
    g.rotate(-toe * 0.25);
    g.fillStyle = C.legs;
    g.beginPath();
    g.moveTo(-58, -300); g.lineTo(-40, -900); g.lineTo(46, -900); g.lineTo(34, -300);
    g.closePath();
    g.fill();
    ink();
    // 靴身：後跟、鞋筒、鞋尖
    const shape = () => {
      g.beginPath();
      g.moveTo(-66, -330);
      g.lineTo(38, -330);
      g.quadraticCurveTo(40, -170, 52, -110);
      g.quadraticCurveTo(128, -84, 150, -34);
      g.quadraticCurveTo(156, -10, 136, -6);
      g.lineTo(-70, -6);
      g.quadraticCurveTo(-82, -60, -70, -150);
      g.closePath();
    };
    shape();
    g.fillStyle = C.boot;
    g.fill();
    ink();
    g.save();
    shape();
    g.clip();
    g.fillStyle = '#262a3a';
    g.beginPath();
    g.ellipse(20, -150, 60, 170, 0.1, 0, TAU);
    g.fill();
    g.strokeStyle = '#0c0d14';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-40, -200); g.quadraticCurveTo(-10, -186, 30, -200);
    g.moveTo(-50, -150); g.quadraticCurveTo(-10, -136, 34, -152);
    g.moveTo(60, -104); g.quadraticCurveTo(80, -70, 70, -40);
    g.stroke();
    g.restore();
    // 反摺的鞋口（青綠滾邊）、綁帶與扣環、鞋底
    g.fillStyle = '#2c3044';
    g.fillRect(-72, -346, 114, 40);
    g.fillStyle = C.lining;
    g.fillRect(-72, -312, 114, 6);
    g.fillStyle = '#12131c';
    g.fillRect(-70, -128, 118, 18);
    g.fillStyle = '#b8c6e0';
    g.fillRect(-4, -132, 22, 26);
    g.fillStyle = '#12131c';
    g.fillRect(2, -126, 10, 14);
    g.fillStyle = '#3a3f58';
    g.beginPath();
    g.moveTo(-72, -8); g.lineTo(138, -8); g.quadraticCurveTo(158, -8, 150, 6); g.lineTo(-72, 6);
    g.closePath();
    g.fill();
    ink();
    g.fillRect(-72, -30, 40, 36);
    g.strokeStyle = 'rgba(168,200,255,.6)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(38, -300); g.quadraticCurveTo(40, -170, 52, -110); g.quadraticCurveTo(128, -84, 150, -34);
    g.stroke();
    g.restore();
  }

  /* ---------- 角色：面具術士 ---------- */
  // 原創角色：白瓷面具（細眼縫、右側一道紅線）、暗紅的後梳亂髮、高領黑大衣（紅內襯），背後長出紅綢
  const FOE_RIBS = [[-28, -540, -2.25, 470, 42], [28, -540, -0.9, 490, 42], [-20, -470, -2.75, 420, 34], [20, -470, -0.4, 440, 34]];
  function foe(tq, o = {}) {
    const { rib = 1, arm = 0, crack = 0, torn = 0, wind = 1, calm = 0, eyeGlow = 0 } = o;
    const sp = calm ? 2.2 : 6;
    const sw = (k, a = 1) => Math.sin(tq * sp + k) * a * wind;
    if (rib > 0) {
      FOE_RIBS.forEach(([bx, by, ang, len, w], i) => {
        ribbon(wave(bx, by, ang, len * rib, calm ? 30 : 46, tq * (calm ? 1.4 : 3.2) + i * 1.7, { curl: i % 2 ? 0.7 : -0.7 }), w, tq * (calm ? 0.8 : 2) + i);
      });
    }
    // 腿與靴子
    limb([-16, -290], [-24, -40], 28, F('#16121c'));
    limb([16, -290], [24, -40], 28, F('#16121c'));
    g.fillStyle = F('#0a0a10');
    g.fillRect(-40, -60, 34, 60);
    g.fillRect(6, -60, 34, 60);
    // 大衣
    const hem = torn ? [[-150, 6], [-126, -30], [-110, 10], [-80, -20], [-40, 8]] : [[-150, 4], [-40, 8]];
    g.fillStyle = F(C.coat);
    g.beginPath();
    g.moveTo(-46, -580);
    g.quadraticCurveTo(-90, -562, -98, -520);
    g.lineTo(-114, -300);
    hem.forEach(([x, y], i) => g.lineTo(x + sw(i, i ? 6 : 16), y + sw(i + 2, 5)));
    g.lineTo(-18, -292);
    g.lineTo(18, -292);
    g.lineTo(40, 8);
    g.lineTo(150 + sw(3, 16), 2);
    g.lineTo(114, -300);
    g.lineTo(98, -520);
    g.quadraticCurveTo(90, -562, 46, -580);
    g.closePath();
    g.fill();
    ink();
    if (!SIL) {
      g.fillStyle = C.vest;
      g.beginPath();
      g.moveTo(-30, -572); g.lineTo(30, -572); g.lineTo(0, -380);
      g.closePath();
      g.fill();
      g.strokeStyle = C.red;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(-18, -292); g.lineTo(-40, 8);
      g.moveTo(18, -292); g.lineTo(40, 8);
      g.moveTo(-30, -572); g.lineTo(0, -380); g.lineTo(30, -572);
      g.stroke();
      g.fillStyle = '#15151f';
      g.fillRect(-106, -312, 212, 20);
      g.fillStyle = '#9aa6c0';
      g.fillRect(-10, -316, 20, 28);
      g.strokeStyle = 'rgba(168,200,255,.5)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(98, -520); g.lineTo(114, -300); g.lineTo(150 + sw(3, 16), 2);
      g.stroke();
      g.strokeStyle = 'rgba(255,70,100,.35)';
      g.beginPath();
      g.moveTo(-98, -520); g.lineTo(-114, -300);
      g.stroke();
    }
    // 手臂：左手垂下、右手抬到胸前（arm=1 時往外伸）
    limb([90, -520], [118, -300], 40, F(C.coat), [120, -420]);
    const hand = [lerp(-46, -210, arm), lerp(-432, -560, arm)];
    limb([-90, -515], hand, 38, F(C.coat), [lerp(-128, -150, arm), lerp(-420, -520, arm)]);
    for (const [x, y, dir] of [[118, -286, 1.4], [hand[0], hand[1], lerp(0.2, -2.6, arm)]]) {
      g.fillStyle = F('#141420');
      g.beginPath();
      g.arc(x, y, 14, 0, TAU);
      g.fill();
      ink();
      g.strokeStyle = F('#141420');
      g.lineWidth = 5;
      for (let f = 0; f < 4; f++) {
        const q = dir + (f - 1.5) * 0.28;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(q) * 30, y + Math.sin(q) * 30);
        g.stroke();
      }
      if (!SIL) {
        g.strokeStyle = C.red;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(x, y, 16, dir + 2.4, dir + 3.9);
        g.stroke();
      }
    }
    // 頭髮（面具後面往後梳的尖刺）
    g.fillStyle = F(C.foeHair);
    g.beginPath();
    g.moveTo(-36, -610);
    [[-44, -660], [-30, -706], [0, -724], [30, -716], [70, -734 + sw(1, 6)], [52, -700], [92, -700 + sw(2, 6)], [58, -676], [96, -660 + sw(3, 6)], [50, -646], [70, -612 + sw(4, 5)], [34, -620]].forEach(([x, y]) => g.lineTo(x, y));
    g.closePath();
    g.fill();
    ink();
    if (!SIL) {
      g.strokeStyle = '#7a2436';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-10, -712); g.lineTo(46, -716);
      g.moveTo(20, -700); g.lineTo(76, -694);
      g.stroke();
    }
    // 面具
    const mask = () => {
      g.beginPath();
      g.moveTo(0, -694);
      g.bezierCurveTo(30, -694, 38, -662, 34, -632);
      g.bezierCurveTo(30, -602, 14, -588, 0, -584);
      g.bezierCurveTo(-14, -588, -30, -602, -34, -632);
      g.bezierCurveTo(-38, -662, -30, -694, 0, -694);
      g.closePath();
    };
    mask();
    g.fillStyle = F(C.mask);
    g.fill();
    ink();
    if (!SIL) {
      g.save();
      mask();
      g.clip();
      g.fillStyle = 'rgba(150,140,130,.55)';
      g.beginPath();
      g.ellipse(-30, -640, 22, 60, 0.1, 0, TAU);
      g.fill();
      g.fillStyle = '#0b0710';
      g.beginPath();
      g.moveTo(-25, -652); g.lineTo(-7, -646); g.lineTo(-9, -641); g.lineTo(-24, -646);
      g.moveTo(25, -652); g.lineTo(7, -646); g.lineTo(9, -641); g.lineTo(24, -646);
      g.fill();
      g.strokeStyle = C.red;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(17, -688); g.lineTo(15, -660); g.moveTo(15, -638); g.lineTo(12, -598);
      g.stroke();
      g.fillStyle = C.red;
      g.beginPath();
      g.arc(0, -676, 2.6, 0, TAU);
      g.fill();
      if (crack > 0) {
        g.strokeStyle = '#2a2230';
        g.lineWidth = 1.8;
        g.beginPath();
        const cr = [[-6, -694], [-2, -676], [-13, -664], [-5, -646], [-15, -628], [-9, -608]];
        sub(cr, 0, crack).forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.stroke();
        if (crack >= 1) {
          g.fillStyle = '#120a14';
          g.beginPath();
          g.moveTo(-12, -694); g.lineTo(-2, -694); g.lineTo(-6, -682);
          g.closePath();
          g.fill();
        }
      }
      g.restore();
      g.strokeStyle = 'rgba(190,215,255,.7)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(24, -688);
      g.bezierCurveTo(36, -670, 36, -640, 30, -616);
      g.stroke();
    }
    if (eyeGlow > 0) {
      glowDot(-15, -647, 14, '255,60,90', eyeGlow);
      glowDot(15, -647, 14, '255,60,90', eyeGlow);
    }
    // 高領
    g.fillStyle = F(C.coat);
    g.beginPath();
    g.moveTo(-50, -592); g.lineTo(-46, -624); g.lineTo(-22, -606); g.lineTo(0, -598); g.lineTo(22, -606); g.lineTo(46, -624); g.lineTo(50, -592); g.lineTo(30, -568); g.lineTo(0, -560); g.lineTo(-30, -568);
    g.closePath();
    g.fill();
    ink();
    if (!SIL) {
      g.strokeStyle = C.red;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-46, -622); g.lineTo(-22, -604); g.lineTo(0, -596); g.lineTo(22, -604); g.lineTo(46, -622);
      g.stroke();
    }
  }

  /* ========== 分鏡 ========== */

  const HK = 1.65 / 620;   // 術師：3D 世界裡身高 1.65

  // A1 遠景：深谷上的石橋與城塔，兩端各一個小小的人影；鏡頭慢慢拉遠、減速停下
  function sEstablish(u, t) {
    const k = ease.out(inv(0, 1.8, u));
    const z = lerp(1.38, 1, k), cx = lerp(-150, 0, k), cy = lerp(-50, 0, k);
    nightSky({ hy: 470, ox: cx, oy: cy, moonAt: [930, 170], mr: 68, drift: t * 10 });
    layer(RIDGE, -cx * 0.3 - 200, 0, 1, 560);
    gorge(500, t);
    view(cx, cy - 30, z);
    bridgeSide();
    tinyHero(-420, 0, 1.1, q12(t));
    tinyFoe(470, 0, 1.1, q12(t));
    POST.rays = [930 - cx * 0.08, 170 - cy * 0.08, 0.45];
    wash('#000', 1 - inv(0, 0.7, u));
  }
  // A2、B1 從術師背後看出去：橋面往遠方收成一點，面具術士在盡頭
  // 魔法陣在術師前方 2.4、法杖高度；回傳螢幕上的中心與半徑
  const CIRCLE3 = [0.35, -1.45, 2.4];
  function backScene(t, K, o = {}) {
    const tq = q12(t);
    const hy = horizon(K);
    nightSky({ hy, ox: K.x * 60 + K.yaw * 900, moonAt: [300, 150], mr: 56, drift: t * 8 });
    layer(RIDGE, -K.x * 30 - K.yaw * 700 - 900, hy - 420, 1, hy + 150);
    gorge(hy, t);
    bridge3(K, { z0: -6, z1: 90 });
    const f = pt3(K, 0.3, 0, 42);
    if (f) { screen(); at(f[0], f[1], f[2] * 1.9 / 720, () => cast(() => foe(tq, { rib: o.foeRib ?? 0.6 }))); }
    const c = pt3(K, ...CIRCLE3);
    const h = pt3(K, 0, 0, 0);
    screen();
    if (o.circle) magicCircle(c[0], c[1], c[2] * 0.95, o.circle, t * 0.8, { sy: 0.92, ang: -K.yaw * 0.5 });
    at(h[0], h[1], h[2] * HK, () => cast(() => heroBack(tq, { cast: o.cast ?? 1, glow: o.glow ?? 1, wind: o.wind ?? 1 })));
    return c;
  }
  function sBackCast(u, t) {
    const K = cam3(lerp(0.9, 1.25, u / 1.4), -1.3, -3.5, 0.1, 900, 0, -0.32);
    const prog = ease.out(inv(0.25, 1.3, u));
    const c = backScene(t, K, { circle: prog, cast: ease.out(inv(0, 0.35, u)) });
    POST.rays = [c[0], c[1], 0.7 * prog];
  }
  // A3 同軸跳接：直接跳到眼睛大特寫，瞳孔裡映著魔法陣
  function sEyes(u, t) {
    fill('#1a2448');
    const z = lerp(12.5, 13.3, u / 0.6);
    POST.diff = 0.22;
    view(0, 5, z);
    heroHead(q12(t), { glint: 0.9, look: [0.1, -0.1], wind: 0.6 });
    screen();
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(1280, 0, 700, 0);
    gr.addColorStop(0, 'rgba(60,170,255,.35)');
    gr.addColorStop(1, 'rgba(60,170,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1280, 720);
    g.restore();
  }
  // A4 面具術士中景：紅綢一條條展開
  function sFoeMS(u, t) {
    nightSky({ hy: 700, moonAt: [1020, 150], mr: 90, clouds: 0.8, drift: t * 6 });
    screen();
    g.fillStyle = '#0a1636';
    g.fillRect(160, 250, 110, 500);
    for (let i = 0; i < 4; i++) g.fillRect(160 + i * 30, 232, 18, 20);
    POST.rays = [1020, 150, 0.3];
    const s = 1.3;
    at(700, 150 + 640 * s, s, () => cast(() => foe(q12(t), { rib: lerp(0.25, 1, ease.out(inv(0, 0.5, u))), arm: ease.io(inv(0.3, 0.7, u)) * 0.6, eyeGlow: inv(0.4, 0.7, u) })));
  }
  // B1 發射：閃白之後光束往遠方射出，鏡頭晃
  // B1 發射：閃白之後切到橋的側面，魔法陣側對鏡頭，光束橫過整個畫面往右射出去
  function sFire(u, t) {
    shake(t, lerp(14, 3, u / 0.7));
    const K = cam3(2.6, -1.25, lerp(0.2, 0.5, u / 0.7), 0.03, 900, 0, -Math.PI / 2);
    nightSky({ hy: horizon(K), ox: u * 200, moonAt: [980, 110], mr: 50, drift: t * 8 });
    bridge3(K, { z0: -14, z1: 30, seams: 30 });
    const c = pt3(K, 0, -1.4, -1.2);
    screen();
    // 魔法陣側對鏡頭：壓成直立的窄橢圓
    magicCircle(c[0], c[1], c[2] * 0.9, 1, t * 3, { sy: 0.28, ang: Math.PI / 2 });
    const head = ease.out(inv(0, 0.22, u));
    const S = [];
    for (let i = 0; i <= 40; i++) S.push([lerp(c[0], 1500, i / 40 * head), c[1] + Math.sin(i * 0.9 + t * 60) * 3 * (i / 40), 2.2]);
    beam(S, { w: 1.3 });
    glowDot(c[0], c[1], 320, '120,230,255', 1 - u);
    shockAt(c[0], c[1], u, 0.05);
    POST.rays = [c[0], c[1], 0.9 * (1 - u)];
    POST.ca = 0.005;
    sparks(c[0], c[1], u, { n: 30, speed: 1300, seed: 12, dir: 0, spread: 1.2, life: 0.5, size: 4 });
    // 術師在畫面左邊外，只看得到被後座力掀起的披風
    const tq = q12(t);
    g.fillStyle = C.cloak;
    g.beginPath();
    g.moveTo(-40, 120);
    for (let i = 0; i <= 6; i++) g.lineTo(60 + Math.sin(i * 1.4 + tq * 12) * 30 + i * 8, 120 + i * 100);
    g.lineTo(-40, 760);
    g.closePath();
    g.fill();
    g.strokeStyle = C.lining;
    g.lineWidth = 6;
    g.beginPath();
    for (let i = 0; i <= 6; i++) g.lineTo(60 + Math.sin(i * 1.4 + tq * 12) * 30 + i * 8, 120 + i * 100);
    g.stroke();
  }
  // B2 交鋒特寫：橫向的光束被斜劈下來的紅綢切開
  function sClash(u, t) {
    shake(t, 10);
    fill('#081230');
    speedLines(640, 360, t, 0.6);
    screen();
    const cutX = 760;
    const S = [];
    for (let i = 0; i <= 30; i++) S.push([lerp(-80, cutX, i / 30), lerp(410, 360, i / 30) + Math.sin(i + t * 40) * 2]);
    beam(S, { w: 3.2, head: 0 });
    glowDot(cutX, 360, 260, '150,240,255', 0.9);
    shockAt(cutX, 360, u, 0.05);
    POST.ca = 0.005;
    sparks(cutX, 360, (t % 0.25), { n: 40, speed: 1400, seed: Math.floor(t * 4), dir: -0.2, spread: 2.4, len: 0.04, life: 0.25, size: 4 });
    const tq = q12(t);
    for (let i = 0; i < 3; i++) {
      const x0 = 1150 + i * 120 - u * 500;
      ribbon(wave(x0, -120, 2.1 + i * 0.08, 1100, 70, tq * 6 + i, { freq: 0.8 }), 120 + i * 30, tq * 3 + i, { twist: 0.6 });
    }
    // 一條巨大的紅綢從鏡頭前掃過
    const k = inv(0.25, 0.5, u);
    if (k > 0) ribbon(wave(lerp(1700, -600, k), -300, 2.0, 1500, 60, tq * 5, { freq: 0.5 }), 700, 0.4 + tq * 2, { twist: 0.25 });
  }
  // B3 紅綢刺進石板：碎石往上噴
  function sHit(u, t) {
    shake(t, 18);
    const K = cam3(0, -2.2, -2.4, 0.8);
    nightSky({ hy: horizon(K) });
    bridge3(K, { z0: -4, z1: 30 });
    screen();
    const tq = q12(t);
    const hits = [[0.5, 1.4], [-1.3, 2.4], [1.6, 3.4]];
    hits.forEach(([X, Z], i) => {
      const p = pt3(K, X, 0, Z);
      const t0 = i * 0.05, k = ease.out(inv(t0, t0 + 0.08, u)), dt = u - t0 - 0.08;
      if (dt > 0) {
        // 石板裂開：放射狀的裂縫與紅光
        g.strokeStyle = '#0a1128';
        g.lineWidth = 4;
        g.beginPath();
        for (let j = 0; j < 7; j++) {
          const q = j / 7 * TAU + rnd(i, j), L = 60 + rnd(i, j + 5) * 90;
          g.moveTo(p[0], p[1]);
          g.lineTo(p[0] + Math.cos(q) * L * 0.5 + rnd(j, i) * 14, p[1] + Math.sin(q) * L * 0.25);
          g.lineTo(p[0] + Math.cos(q) * L, p[1] + Math.sin(q) * L * 0.45);
        }
        g.stroke();
        glowDot(p[0], p[1], 160, '255,70,100', 1 - dt * 3);
        shockAt(p[0], p[1], dt, 0.035, 1100);
      }
      ribbon(sub(wave(p[0] + 520 - i * 320, -260, 1.95 + i * 0.25, 1000, 36, tq * 6 + i), 0, k * 0.9).concat([[p[0], p[1]]]), 150, 0.3 + tq * 2 + i, { tip: 0.12, twist: 0.35 });
      if (dt > 0) {
        for (let j = 0; j < 14; j++) {
          const q = -Math.PI / 2 + (rnd(i, j) - 0.5) * 2.6, v = 600 + rnd(i, j + 20) * 1000;
          const x = p[0] + Math.cos(q) * v * dt, y = p[1] + Math.sin(q) * v * dt + 1600 * dt * dt, s = 10 + rnd(i, j + 40) * 22;
          g.fillStyle = rnd(i, j + 60) < 0.5 ? '#8ea6dc' : '#4d6398';
          g.beginPath();
          g.moveTo(x - s, y); g.lineTo(x, y - s * 0.8); g.lineTo(x + s * 0.9, y + s * 0.2); g.lineTo(x - s * 0.2, y + s * 0.7);
          g.closePath();
          g.fill();
        }
        sparks(p[0], p[1], dt, { n: 24, speed: 900, seed: i + 4, col: '#ff8aa0', dir: -Math.PI / 2, spread: 2.6, life: 0.3, size: 4 });
      }
    });
  }
  // B4 反拍：術師橫杖擋下，被往後推
  function sKnock(u, t) {
    shake(t, lerp(16, 6, u / 0.4));
    const K = cam3(0.2, -1.2, -4.6, 0.05);
    nightSky({ hy: horizon(K), moonAt: [980, 120], mr: 50 });
    gorge(horizon(K), t);
    bridge3(K, { z0: -5, z1: 90 });
    POST.ca = 0.004;
    const z = lerp(0, 3.2, ease.out(inv(0, 0.4, u)));
    const p = pt3(K, 0.1, 0, z);
    const tq = q12(t);
    screen();
    at(p[0], p[1], p[2] * HK, () => cast(() => heroFront(tq, { pose: 'guard', lean: -0.12, windDir: 1, wind: 1.4, head: { mouth: -1, eye: 0.7 } })));
    sparks(p[0], p[1] - 420 * p[2] * HK, u, { n: 30, speed: 800, seed: 9, col: '#ff7d96', life: 0.4 });
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      ribbon([[640 + s * 760, 800], [640 + s * 420, 620], [p[0] + s * 60, p[1] - 380 * p[2] * HK]], 110, tq * 3 + i, { tip: 0.2 });
    }
  }
  // B5 高角度的靜止長鏡頭：跪在石板上，慢慢抬起頭
  function sKneel(u, t) {
    const K = cam3(0, -3.4, -1.8, 0.95);
    nightSky({ hy: horizon(K) });
    bridge3(K, { z0: -4, z1: 20, seams: 20 });
    screen();
    POST.diff = 0.2;
    at(640, 520, 1.65, () => cast(() => heroKneel(q12(t), { rise: ease.io(inv(0.4, 1.7, u)), wind: 0.8 })));
    motes(t, 16, { vx: -60, vy: -20, a: 0.8 });
    motes(t, 8, { col: '255,70,100', vx: -90, vy: 10, seed: 8, size: 2 });
  }
  // B6 貼地的低角度：鏡頭轉向橋的側面，只拍靴子往前踏一步（面具術士在畫面右邊外，只看得到紅光）
  function sBoots(u, t) {
    const K = cam3(1.7, -0.3, lerp(-0.2, 0.3, u / 0.8), -0.12, 900, 0, -Math.PI / 2);
    const hy = horizon(K);
    nightSky({ hy, moonAt: [300, 120], mr: 46, drift: t * 8 });
    bridge3(K, { z0: -14, z1: 16, seams: 30 });
    screen();
    g.save();
    g.globalCompositeOperation = 'lighter';
    const rg = g.createLinearGradient(1280, 0, 760, 0);
    rg.addColorStop(0, 'rgba(255,40,80,.45)');
    rg.addColorStop(1, 'rgba(255,40,80,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 1280, 720);
    g.restore();
    const k = ease.io(inv(0.05, 0.45, u));
    at(470, 640, 1.1, () => bootCU());
    at(lerp(170, 900, k), 640 - Math.sin(k * Math.PI) * 110, 1.1, () => bootCU({ toe: Math.sin(k * Math.PI) }));
    if (k >= 1) {
      const dt = u - 0.45;
      for (let i = 0; i < 8; i++) {
        const d = dt * (200 + rnd(i, 1) * 260), x = 960 + (i % 2 ? d : -d * 0.7), s = 30 + dt * 160;
        g.fillStyle = `rgba(130,150,200,${0.5 * (1 - dt * 2.4)})`;
        g.beginPath();
        g.arc(x, 640 - rnd(i, 2) * 30 - dt * 60, s * (0.6 + rnd(i, 3) * 0.6), 0, TAU);
        g.fill();
      }
    }
    // 披風下擺在畫面上緣翻動
    g.fillStyle = C.cloakD;
    g.beginPath();
    g.moveTo(-40, -20);
    for (let i = 0; i <= 10; i++) g.lineTo(i * 136 - 40, 70 + Math.sin(i * 1.3 + q12(t) * 9) * 24 + (i % 2) * 22);
    g.lineTo(1340, -20);
    g.closePath();
    g.fill();
    g.strokeStyle = C.lining;
    g.lineWidth = 5;
    g.beginPath();
    for (let i = 0; i <= 10; i++) g.lineTo(i * 136 - 40, 70 + Math.sin(i * 1.3 + q12(t) * 9) * 24 + (i % 2) * 22);
    g.stroke();
  }
  // C1 六道光束往上射，鏡頭跟著往上搖、往右追
  function sHoming(u, t) {
    const k = ease.io(inv(0.1, 1.6, u));
    const cx = lerp(-260, 420, k), cy = lerp(-60, -520, Math.sin(k * Math.PI * 0.8));
    const z = lerp(1.6, 1.0, ease.out(inv(0, 1, u)));
    nightSky({ hy: 470, ox: cx * 0.6, oy: cy * 0.6, moonAt: [900, 200], mr: 70, drift: t * 10 });
    layer(RIDGE, -cx * 0.3 - 200, -cy * 0.35, 1, 560 - cy * 0.35);
    gorge(500 - cy * 0.35, t);
    view(cx, cy, z);
    bridgeSide();
    tinyHero(-300, 0, 1.25, q12(t), { glow: 2 });
    for (let i = 0; i < 6; i++) {
      const S = bez([-282, -90], [-460 + i * 70, -720 - i * 50], [420 + i * 40, -1060 + i * 70], [760 + i * 34, 90 - i * 14], 60);
      const h = ease.io(inv(0.08 + i * 0.05, 1.55, u));
      beam(sub(S, Math.max(0, h - 0.32), h), { w: 1.6 / z });
    }
    glowDot(-282, -90, 120 * (1 - inv(0.2, 0.9, u)), '140,235,255', 1);
    POST.rays = [640 + (-282 - cx) * z, 360 + (-90 - cy) * z, 0.8 * (1 - inv(0.2, 1.0, u))];
    const mv = Math.sin(Math.PI * inv(0.2, 1.6, u));
    POST.blur = [-26 * mv, 30 * mv];
  }
  // C2 橋下迴廊：一點透視，鏡頭先快推，面具術士橫衝過去，光束從拱洞轉進來、一路衝向鏡頭
  function sArcade(u, t) {
    const zc = lerp(-2.2, 0.6, ease.out(inv(0, 0.45, u)));
    const K = cam3(0, -1.7, zc, 0.02, 760);
    const hy = horizon(K);
    nightSky({ hy, moonAt: [1200, 150], mr: 60 });
    gorge(hy + 10, t);
    arcade(K);
    POST.rays = [1200, 150, 0.35];
    // 面具術士橫衝
    const dk = inv(0.2, 0.5, u);
    if (dk > 0 && dk < 1) {
      const p = pt3(K, lerp(3.4, -2.8, dk), 0, 15);
      screen();
      at(p[0], p[1], p[2] * 1.9 / 720, () => { g.rotate(-0.35); cast(() => foe(q12(t), { rib: 1.2, arm: 1 })); });
    }
    screen();
    for (let i = 0; i < 3; i++) {
      const P3 = spline([[7, -2.6 - i * 0.3, 24 + i * 3], [1.8, -2.2, 19 + i * 2], [-1.8, -1.4 + i * 0.2, 13 + i], [1.3, -2.3, 8], [-0.4 - i * 0.2, -1.7, zc + 0.6]], 12);
      const h = ease.in(inv(0.42 + i * 0.07, 1.62, u));
      const S = sub(P3, Math.max(0, h - 0.4), h).map(p => pt3(K, p[0], p[1], p[2])).filter(Boolean).map(p => [p[0], p[1], p[2] / 110]);
      beam(S, { w: 1 });
    }
  }
  // C3 追逐鏡頭：跟在光束後面飛上夜空，畫面隨轉彎側傾，面具術士越來越近
  function sChase(u, t) {
    const roll = Math.sin(u * 2.6) * 0.14;
    shake(t, 3);
    POST.blur = [-22, 16];
    POST.ca = 0.004;
    g.setTransform(R, 0, 0, R, 0, 0);
    g.translate(640, 360);
    g.rotate(roll);
    g.translate(-640, -360);
    const gr = g.createLinearGradient(0, -200, 0, 920);
    gr.addColorStop(0, C.sky0);
    gr.addColorStop(0.7, C.sky1);
    gr.addColorStop(1, C.sky2);
    g.fillStyle = gr;
    g.fillRect(-300, -300, 1880, 1320);
    const sy = (t * 220) % 720;
    g.drawImage(STARS, -150, sy - 720);
    g.drawImage(STARS, -150, sy);
    moon(300 + u * 160, 130 + u * 120, 56);
    for (let i = 0; i < 16; i++) {
      const d = 0.35 + rnd(i, 1) * 0.9;
      const x = ((rnd(i, 2) * 2200 - t * 900 * d) % 2200 + 2200) % 2200 - 500;
      const y = ((rnd(i, 3) * 1400 + t * 700 * d) % 1400 + 1400) % 1400 - 400;
      g.globalAlpha = 0.5 + d * 0.4;
      g.drawImage(PUFF, x, y, 460 * d, 260 * d);
    }
    g.globalAlpha = 1;
    const fs = lerp(0.14, 0.42, ease.in(inv(0, 1.3, u)));
    const fx = 880 + Math.sin(u * 3) * 30, fy = 240 + Math.cos(u * 2.4) * 20;
    at(fx, fy + 360 * fs, fs, () => cast(() => foe(q12(t), { arm: 1, rib: 1.2, wind: 1.5 })));
    for (let i = 0; i < 3; i++) {
      const hx = lerp(560 + i * 60, fx - 30, ease.in(inv(0, 1.3, u)) * (0.7 + i * 0.1)), hy = lerp(420 - i * 40, fy + 60, ease.in(inv(0, 1.3, u)) * 0.8);
      const S = bez([-200 - i * 100, 1000], [200, 800 - i * 60], [hx - 260, hy + 140 + Math.sin(t * 5 + i) * 40], [hx, hy], 40).map((p, j) => [p[0], p[1], lerp(3, 1, j / 40)]);
      beam(S, { w: i ? 0.8 : 1.3 });
    }
    speedLines(fx, fy, t, 0.7);
  }
  // C4 面具術士近景：紅綢編成盾，光束打在上面，面具裂開
  function sShield(u, t) {
    shake(t, lerp(14, 5, u / 1.2));
    POST.ca = 0.005;
    fill('#071030');
    screen();
    const sy = (t * 900) % 720;
    g.save();
    g.globalAlpha = 0.5;
    g.drawImage(STARS, 0, sy - 720);
    g.drawImage(STARS, 0, sy);
    g.restore();
    speedLines(640, 360, t, 0.5);
    const tq = q12(t);
    view(-10, -600, 2.2);
    cast(() => foe(tq, { rib: 0, arm: 1, crack: inv(0.5, 0.62, u), eyeGlow: 0.8 }));
    for (let i = 0; i < 4; i++) {
      const y0 = -560 + i * 36;
      ribbon(wave(-330, y0 + Math.sin(tq * 3 + i) * 16, 0.08 * (i % 2 ? 1 : -1), 640, 22, tq * 4 + i * 2, { freq: 1.1 }), 46, tq * 2 + i * 1.3, { twist: 0.6, tip: 0.2 });
    }
    screen();
    for (let i = 0; i < 4; i++) {
      const t0 = 0.08 + i * 0.22, dt = u - t0;
      const hx = 520 + rnd(i, 2) * 160, hy = 260 + rnd(i, 3) * 240;
      if (dt > -0.12 && dt < 0.12) {
        const S = [];
        for (let j = 0; j <= 20; j++) S.push([lerp(-100, hx, j / 20), lerp(hy + 220 - i * 60, hy, j / 20), 1.5]);
        beam(sub(S, 0, clamp((dt + 0.12) / 0.12)), { w: 1.4 });
      }
      sparks(hx, hy, dt, { n: 34, speed: 1100, seed: i + 20, dir: Math.PI, spread: 2.6, life: 0.4, size: 4 });
      sparks(hx, hy, dt, { n: 16, speed: 800, seed: i + 40, col: '#ff6d8c', dir: 0, spread: 2, life: 0.4 });
      if (dt > 0 && dt < 0.1) glowDot(hx, hy, 300, '160,240,255', 1 - dt * 10);
      shockAt(hx, hy, dt, 0.04);
    }
  }
  // D1 俯瞰：撞擊點罩著紅綢圓頂，煙塵往外擴散；鏡頭往上拉、減速停下
  function sOverhead(u, t) {
    const k = ease.out(inv(0, 1.3, u));
    const K = cam3(0.4, lerp(-12, -21, k), lerp(6, 4, k), 1.3, 900, lerp(0.16, 0.05, k));
    fill('#040b1e');
    screen();
    g.save();
    g.translate(640, 360);
    g.rotate(K.pitch * 0 + lerp(0.16, 0.05, k));
    g.strokeStyle = 'rgba(80,120,200,.25)';
    g.lineWidth = 30;
    g.beginPath();
    g.moveTo(-900, -500);
    g.bezierCurveTo(-200, -200, 200, -600, 900, 300);
    g.stroke();
    g.restore();
    gorge(-100, t, 0.6);
    bridge3(K, { z0: -10, z1: 40, seams: 36 });
    const h = pt3(K, -0.6, 0, -4);
    screen();
    if (h) {
      g.fillStyle = '#070d20';
      g.beginPath();
      g.ellipse(h[0], h[1], h[2] * 0.35, h[2] * 0.3, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.moveTo(h[0] - h[2] * 0.4, h[1] + h[2] * 0.1); g.lineTo(h[0] + h[2] * 0.4, h[1] + h[2] * 0.1); g.lineTo(h[0], h[1] + h[2] * 0.7);
      g.fill();
    }
    const c = pt3(K, 0, 0, 10);
    const r = c[2] * 1.7;
    shockAt(c[0], c[1], u, 0.05, 900);
    // 紅綢圓頂
    const dg = g.createRadialGradient(c[0] - r * 0.3, c[1] - r * 0.3, r * 0.1, c[0], c[1], r);
    dg.addColorStop(0, '#ff5b7a');
    dg.addColorStop(0.6, C.red);
    dg.addColorStop(1, C.redD);
    g.fillStyle = dg;
    g.beginPath();
    g.arc(c[0], c[1], r, 0, TAU);
    g.fill();
    g.strokeStyle = C.redD;
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.ellipse(c[0], c[1], r, r * Math.abs(Math.cos(i / 6 * Math.PI + t)), i / 6 * Math.PI, 0, TAU);
      g.stroke();
    }
    // 衝擊環與煙塵
    const ring = ease.out(inv(0, 0.9, u));
    g.strokeStyle = `rgba(190,245,255,${1 - ring})`;
    g.lineWidth = 10 * (1 - ring) + 1;
    g.beginPath();
    g.arc(c[0], c[1], r * (1.1 + ring * 2.6), 0, TAU);
    g.stroke();
    for (let i = 0; i < 18; i++) {
      const q = i / 18 * TAU + rnd(i, 1) * 0.3, d = r * (1.1 + ease.out(inv(0, 1.3, u)) * (1.2 + rnd(i, 2) * 1.2));
      const x = c[0] + Math.cos(q) * d, y = c[1] + Math.sin(q) * d, s = r * (0.35 + rnd(i, 3) * 0.3) * (0.8 + u * 0.5);
      g.fillStyle = 'rgba(120,140,190,.8)';
      g.beginPath();
      g.arc(x, y, s, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(70,86,140,.9)';
      g.beginPath();
      g.arc(x - s * 0.2, y + s * 0.25, s * 0.8, 0, TAU);
      g.fill();
    }
  }
  // D2 靜止：面具術士站著不動（面具已裂），紅綢慢慢飄；下一道光直接闖進這個畫面
  function sFoeHold(u, t) {
    const K = cam3(0, -1.6, -5.5, 0.0);
    nightSky({ hy: horizon(K), moonAt: [260, 140], mr: 52, drift: t * 5 });
    gorge(horizon(K), t);
    bridge3(K, { z0: -5, z1: 90 });
    screen();
    const tq = q12(t);
    const breath = Math.sin(t * 2) * 2;
    POST.rays = [260, 140, 0.3];
    at(640, 900 + breath, 1.25, () => cast(() => foe(tq, { calm: 1, crack: 1, torn: 1, rib: 0.8 })));
    motes(t, 10, { col: '255,80,110', vx: -20, vy: -30, seed: 5, size: 2 });
    const k = inv(1.1, 1.38, u);
    if (k > 0) {
      const S = [];
      for (let i = 0; i <= 30; i++) S.push([lerp(-120, 600, i / 30), lerp(-80, 330, i / 30), 1.4]);
      beam(sub(S, Math.max(0, k - 0.6), k), { w: 1.4 });
      if (k >= 1) glowDot(600, 330, 260, '160,240,255', 1 - inv(1.38, 1.5, u));
      shockAt(600, 330, u - 1.38, 0.05);
    }
  }
  // D3 面具特寫：紅綢從下方翻上來擋，接著刷白
  function sMaskCU(u, t) {
    shake(t, 6);
    fill('#081334');
    const tq = q12(t);
    POST.ca = 0.006;
    POST.rays = [-80, 360, 0.7 * inv(0, 0.5, u)];
    view(0, -645, 5);
    cast(() => foe(tq, { rib: 0, crack: 1, eyeGlow: 0.9 }));
    screen();
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(0, 0, 900, 0);
    gr.addColorStop(0, `rgba(120,220,255,${0.6 * inv(0, 0.5, u)})`);
    gr.addColorStop(1, 'rgba(120,220,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1280, 720);
    g.restore();
    const k = ease.out(inv(0.1, 0.45, u));
    for (let i = 0; i < 3; i++) ribbon(wave(200 + i * 360, 900, -1.35 - i * 0.12, 900 * k, 40, tq * 5 + i), 260, tq * 3 + i, { twist: 0.4 });
  }
  // E1 魔法陣一個個亮起：正面全身，鏡頭慢慢推近
  const CIRCLES = [
    [0, -0.55, 0.62, 1, 0, 0, 0], [0, 0.02, 0.8, 0.22, 0, 0.1, 0], [-0.62, -0.95, 0.2, 0.85, -0.25, 0.25, 1], [0.64, -1.0, 0.22, 0.8, 0.3, 0.35, 1],
    [-0.8, -0.45, 0.17, 0.6, -0.5, 0.45, 1], [0.84, -0.42, 0.18, 0.62, 0.5, 0.55, 1], [0, -1.3, 0.24, 0.45, 0, 0.62, 0],
  ];
  function sCircles(u, t) {
    const k = ease.io(inv(0, 1.4, u));
    const K = cam3(0, -1.05, lerp(-3.7, -3.0, k), -0.04);
    nightSky({ hy: horizon(K), moonAt: [1010, 130], mr: 58, drift: t * 8 });
    gorge(horizon(K), t);
    bridge3(K, { z0: -6, z1: 90 });
    const p = pt3(K, 0, 0, 0);
    const s = p[2] * HK, H = 620 * s;
    POST.rays = [p[0], p[1] - 0.55 * H, 0.15 + 0.35 * k];
    POST.bloom = 0.75;
    const draw = front => CIRCLES.forEach(([dx, dy, r, sy, ang, d, f]) => {
      if (f !== front) return;
      magicCircle(p[0] + dx * H, p[1] + dy * H, r * H, ease.out(inv(d, d + 0.5, u)), t * (f ? 1.4 : 0.6), { sy, ang });
    });
    screen();
    draw(0);
    at(p[0], p[1], s, () => cast(() => heroFront(q12(t), { pose: 'raise', windDir: 0, wind: 1.3, glow: 1.6, head: { glint: 0.6, mouth: -1 } })));
    screen();
    draw(1);
    motes(t, 20, { vx: 10, vy: -90, a: 0.9 });
    wash('#bff6ff', 0.4 * inv(1.1, 1.4, u));
  }
  // E2 齊射：城塔那一頭被光束交叉覆蓋，畫面刷白、星芒爆開
  function sBarrage(u, t) {
    shake(t, 6 + 12 * inv(0.3, 0.6, u));
    nightSky({ hy: 470, ox: 400, moonAt: [1100, 120], mr: 60, drift: t * 10 });
    layer(RIDGE, -700, 0, 1, 560);
    gorge(500, t);
    view(560, -170, 1.5);
    bridgeSide();
    tinyFoe(470, 0, 1.9, q12(t), { rib: 1.4 });
    for (let i = 0; i < 12; i++) {
      const t0 = i * 0.035, h = ease.in(inv(t0, t0 + 0.3, u));
      const y0 = -700 + rnd(i, 1) * 900, tx = 440 + rnd(i, 2) * 80, ty = -140 + rnd(i, 3) * 140;
      const S = bez([-300, y0], [0, y0 + 100], [tx - 200, ty - 200 + rnd(i, 4) * 300], [tx, ty], 30);
      beam(sub(S, Math.max(0, h - 0.5), h), { w: 0.8 });
    }
    screen();
    const wk = inv(0.45, 0.7, u);
    shockAt(640, 360, u - 0.55, 0.06, 1000);
    if (wk > 0) POST.rays = [640, 360, 1];
    wash('#ffffff', wk);
    if (wk > 0) burst(640, 360, 900, inv(0.55, 0.75, u), 3, t);
  }
  // E3 刷白溶接：光的碎片像花瓣一樣綻開、飄散，畫面又慢慢變白
  function sPetals(u, t) {
    POST.bloom = 1.6;
    POST.diff = 0.3;
    POST.rays = [640, 360, 0.6 * (1 - inv(0, 1.3, u))];
    fill('#0d2458');
    screen();
    emit(() => { for (let i = 0; i < 70; i++) {
      const q = rnd(i, 1) * TAU, v = 0.2 + rnd(i, 2) * 0.9;
      const d = 1300 * v * Math.pow(0.08 + u, 0.55);
      const x = 640 + Math.cos(q) * d + Math.sin(t * 1.3 + i) * 20 - u * 60, y = 360 + Math.sin(q) * d * 0.7 + u * 40;
      const s = (18 + rnd(i, 3) * 48) * (0.6 + u * 0.8);
      g.save();
      g.translate(x, y);
      g.rotate(rnd(i, 4) * TAU + t * (rnd(i, 5) - 0.5) * 2);
      g.scale(s, s);
      g.fillStyle = 'rgba(160,220,255,.85)';
      g.translate(0.08, 0.1);
      g.fill(PETAL);
      g.translate(-0.08, -0.1);
      g.fillStyle = '#ffffff';
      g.fill(PETAL);
      g.restore();
    } });
    wash('#ffffff', Math.max(1 - ease.out(inv(0, 0.35, u)), 0.92 * ease.in(inv(0.55, 1.3, u))));
  }
  // E4 色調翻轉：高調的淡藍色遠景，術師的剪影站在橋上，風吹著披風
  function sAfter(u, t) {
    daySky({ hy: 520, drift: t * 20 });
    view(-160 - u * 20, -150, 1.15);
    bridgeSide(PAL2.day);
    SIL = '#4e7fb0';
    at(-240, 0, 0.4, () => heroFront(q12(t), { pose: 'side', windDir: -1, wind: 1.6, glow: 0 }));
    SIL = null;
    motes(t, 30, { col: '255,255,255', vx: -70, vy: -50, a: 0.9 });
    screen();
    g.strokeStyle = 'rgba(255,255,255,.6)';
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const y = 120 + rnd(i, 1) * 480, x = ((rnd(i, 2) * 1800 - t * 900) % 1800 + 1800) % 1800 - 300;
      g.moveTo(x, y);
      g.lineTo(x + 220, y - 10);
    }
    g.stroke();
    wash('#ffffff', 0.85 * (1 - ease.out(inv(0, 0.4, u))));
  }
  // E5 收尾：近景，轉過頭來面向鏡頭，慢推，淡出
  function sTurn(u, t) {
    daySky({ hy: 900, drift: t * 16 });
    const k = ease.io(inv(0.1, 0.95, u));
    view(0, -520, lerp(2.85, 3.15, u / 1.5));
    cast(() => heroFront(q12(t), { pose: 'side', windDir: -1, wind: 1.1, glow: 0.5, head: { yaw: lerp(0.75, 0.02, k), look: [lerp(0.9, 0, k), 0], mouth: u > 0.9 ? 1 : 0, scratch: 0.8 } }));
    motes(t, 18, { col: '255,255,255', vx: -60, vy: -40, a: 0.8 });
    wash('#ffffff', 0.1);
    wash('#000000', ease.io(inv(0.8, 1.5, u)));
  }

  // 高調的白天鏡頭：暗部提亮、對比低、光暈與顆粒收斂
  const DAY = { grade: 1, bloom: 0.7, diff: 0.16, vig: 0.05, grain: 0.03, ca: 0.001 };
  const SHOTS = [
    [0, sEstablish], [1.8, sBackCast], [3.2, sEyes], [3.8, sFoeMS],
    [4.6, sFire], [5.3, sClash], [5.8, sHit], [6.1, sKnock], [6.5, sKneel], [8.6, sBoots],
    [9.4, sHoming], [11.0, sArcade], [12.7, sChase], [14.0, sShield],
    [15.2, sOverhead], [16.5, sFoeHold], [18.0, sMaskCU],
    [18.6, sCircles], [20.0, sBarrage], [20.9, sPetals], [22.2, sAfter, DAY], [23.5, sTurn, DAY],
  ];

  /* ---------- 剪接點上的轉場（疊在畫面最上層） ---------- */

  const flashFx = k => wash('#ffffff', Math.sqrt(1 - Math.abs(k - 0.5) * 2));
  // 反相的衝擊格：前半反相，後半刷白
  const invertFx = k => {
    if (k < 0.5) POST.inv = 1;
    else wash('#ffffff', 1 - (k - 0.5) * 2);
    POST.ca = 0.008;
  };
  // 一條巨大的紅綢從鏡頭前掃過，遮住整個畫面的那一刻剛好換鏡頭
  const sweepFx = (k, t) => {
    screen();
    const x = lerp(2300, -1100, ease.io(k));
    ribbon(wave(x, -500, 1.95, 1900, 80, t * 6, { freq: 0.5 }), 1500, 0.3 + t * 3, { twist: 0.18, tip: 0.1 });
  };
  // 甩鏡：橫向的模糊拉線
  const whipFx = k => {
    const a = 1 - Math.abs(k - 0.5) * 2;
    POST.blur = [-260 * a, 0];
    wash('#0a1a44', a * 0.8);
    screen();
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) {
      const y = rnd(i, 1) * 720, L = 300 + rnd(i, 2) * 1000, x = lerp(1400, -1400, k) + rnd(i, 3) * 1400;
      g.strokeStyle = `rgba(${rnd(i, 4) < 0.3 ? '160,230,255' : '120,150,220'},${a * (0.2 + rnd(i, 5) * 0.5)})`;
      g.lineWidth = 1 + rnd(i, 6) * 5;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + L, y);
      g.stroke();
    }
    g.restore();
  };
  // 光束衝進鏡頭：從中心往外整片變白
  const lensFx = k => {
    const a = 1 - Math.abs(k - 0.5) * 2;
    screen();
    const r = 200 + a * 1400;
    POST.bloom = 1.8;
    emit(() => {
      const gr = g.createRadialGradient(560, 330, 0, 560, 330, r);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(0.5, `rgba(170,245,255,${a})`);
      gr.addColorStop(1, 'rgba(90,190,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 1280, 720);
    });
  };
  const FX = [
    [4.6, 0.14, flashFx], [5.8, 0.16, invertFx], [9.4, 0.4, sweepFx], [11.0, 0.3, whipFx],
    [12.7, 0.26, lensFx], [15.2, 0.2, flashFx], [18.6, 0.2, flashFx],
  ];

  function render(t) {
    lastT = t;
    let i = SHOTS.length - 1;
    while (i > 0 && SHOTS[i][0] > t) i--;
    SX = SY = 0;
    SIL = null;
    POST = { ...POST0, shock: [], ...(SHOTS[i][2] || {}) };
    if (post) {
      EG.setTransform(1, 0, 0, 1, 0, 0);
      EG.globalAlpha = 1;
      EG.globalCompositeOperation = 'source-over';
      EG.fillStyle = '#000';
      EG.fillRect(0, 0, ev.width, ev.height);
    }
    g.setTransform(R, 0, 0, R, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    SHOTS[i][1](t - SHOTS[i][0], t);
    SX = SY = 0;
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // 沒有 WebGL 時才在 2D 上畫暗角（有的話暗角交給撮影）
    if (!post && !POST.grade) {
      g.setTransform(R, 0, 0, R, 0, 0);
      g.drawImage(VIGNETTE, 0, 0);
    }
    for (const [c, d, fx] of FX) {
      if (t >= c - d / 2 && t < c + d / 2) fx((t - c + d / 2) / d, t);
    }
    // 顆粒每一格依時間換，拖回去重看一致
    if (post) post.render({ ...POST, seed: (Math.floor(t * 24) % 64) * 17.3 });
  }

  // 解析度跟著播放器在螢幕上的實際像素（高 DPI 與全螢幕時更清楚），上限 1.6 倍（2048×1152，撮影後每格約 10ms 內）
  const frame = $('.tr-frame', root);
  new ResizeObserver(() => {
    const k = Math.min(frame.clientWidth / 1280, frame.clientHeight / 720) || 1;
    const r = Math.round(Math.min(1.6, Math.max(0.5, k * (window.devicePixelRatio || 1))) * 20) / 20;
    if (r === R) return;
    R = r;
    cv.width = Math.round(1280 * R);
    cv.height = Math.round(720 * R);
    ev.width = Math.round(640 * R);
    ev.height = Math.round(360 * R);
    render(lastT);
  }).observe(frame);

  const CHAPTERS = [
    { at: 0, name: '對峙', caption: '深谷上的石橋，兩端各站著一個人；術師舉起法杖，魔法陣在身前展開。' },
    { at: 4.6, name: '交鋒', caption: '光束射出，被紅綢劈開；術師被擊退，跪在石板上，慢慢抬起頭，再往前踏一步。' },
    { at: 9.4, name: '追擊', caption: '六道光束轉彎追擊，甩鏡切進橋下迴廊，鏡頭跟著光束一路追上夜空。' },
    { at: 15.2, name: '停頓', caption: '俯瞰撞擊後的煙塵；面具術士站著不動，下一道光直接闖進這個畫面。' },
    { at: 18.6, name: '決著', caption: '魔法陣一個個亮起，畫面刷白，光點散成花瓣；最後停在她轉過來的臉上。' },
  ];

  if (!G || !window.MGPlayer) {
    render(19.6);
    return;
  }
  const tl = G.timeline({ paused: true });
  tl.set({}, {}, END);
  const player = new MGPlayer({ root, tl, chapters: CHAPTERS, end: END, onTick: render });

  // #t=秒數：停在指定的那一格
  const seekHash = () => {
    const m = /(?:^|[#&])t=([\d.]+)/.exec(location.hash);
    if (!m) return;
    player.userPaused = true;
    player.pause();
    tl.seek(Math.min(END, parseFloat(m[1])));
    player.sync();
  };
  seekHash();
  window.addEventListener('hashchange', seekHash);
})();
