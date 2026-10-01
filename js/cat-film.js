/* =========================================================
   貓抓蝴蝶（cat.html）：水墨短片
   霧裡走出一隻長毛黑貓，追一隻發光的白蝴蝶，15 秒：
   霧中現身 → 墨圈裡的凝視 → 竹林撲蝶 → 雙爪落空，蝴蝶停在頭上
   - 畫面：淡墨的宣紙、大片霧氣、遠山與竹林；全片的顏色只有貓的橙色眼睛與蝴蝶的白光
   - 貓（原創角色）是長毛的黑貓：身體、四肢、尾巴、臉都由數千撮「毛」堆出來
     （每撮是一道尖端收細的筆觸，順著毛流方向長；邊緣的毛較長、往外張，成為蓬鬆的輪廓），
     同一個深淺的毛合成一條路徑一次畫完；毛的位置綁在骨架上，所以姿勢怎麼變毛都跟著走
   - 水墨由 WebGL2 實現（js/ink-gl.js）：GPU 流體（黑墨與霧）、宣紙、水墨濾鏡與後製；
     不支援時改用 2D 合成（沒有流體與後製）
   - 流體固定每步 1/60 秒、每一刀重新開始；跳到某一格時從那一刀開頭重算，順著播或拖回去看，同一格都一樣
   - 圖層：背景（遠山、竹林、霧、被霧蓋住的貓）→ 流體 → 前景（貓、蝴蝶、墨圈、墨點）
   - GSAP 時間軸只當時鐘；畫面裡不放文字、UI、標誌；網址加 #t=秒數 會停在那一格
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
    s: k => k * k * (3 - 2 * k),
  };
  // 姿勢混合：數字、陣列、物件逐項內插
  const mix = (a, b, k) => {
    if (typeof a === 'number') return lerp(a, b, k);
    if (Array.isArray(a)) return a.map((v, i) => mix(v, b[i], k));
    const o = {};
    for (const key in a) o[key] = key in b ? mix(a[key], b[key], k) : a[key];
    return o;
  };

  const END = 15;
  const INKC = [10, 10, 10];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  /* ---------- 畫布：背景與前景兩張透明圖層，輸出由水墨引擎合成 ---------- */

  mg.classList.add('inkfilm');
  const INK = window.InkGL ? window.InkGL.create() : null;
  const cvB = document.createElement('canvas'), cvF = document.createElement('canvas');
  const gB = cvB.getContext('2d'), gF = cvF.getContext('2d');
  const OUT = INK ? INK.canvas : document.createElement('canvas');
  const go = INK ? null : OUT.getContext('2d');
  mg.replaceChildren(OUT);
  let g = gB;
  // 切換圖層（沿用目前的鏡頭位置）
  const front = () => { if (g !== gF) { gF.setTransform(g.getTransform()); g = gF; } };
  const back = () => { if (g !== gB) { gB.setTransform(g.getTransform()); g = gB; } };
  // R 是輸出解析度；RS 是目前畫布的縮放（畫進低解析度的緩衝時會變小）
  let R = 1, RS = 1, lastT = 0;

  const mk = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'));
    return c;
  };
  // 在預先畫好的素材上用同一套筆刷
  const paintOn = (c, fn) => { const keep = g; g = c; fn(); g = keep; };

  let SX = 0, SY = 0;   // 鏡頭晃動
  const shake = (t, amp, hz = 30) => {
    const i = Math.floor(t * hz);
    SX = (rnd(i, 3) - 0.5) * 2 * amp;
    SY = (rnd(i, 7) - 0.5) * 2 * amp;
  };
  const screen = () => g.setTransform(RS, 0, 0, RS, SX * RS, SY * RS);
  const view = (cx, cy, z, rot = 0) => {
    screen();
    g.translate(640, 360);
    if (rot) g.rotate(rot);
    g.scale(z, z);
    g.translate(-cx, -cy);
  };
  const at = (x, y, s, fn, rot = 0) => {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.scale(s, s);
    fn();
    g.restore();
  };

  // 低解析度畫一次再放大：遠景、景深外的東西、霧（等於免費的模糊）；k 是縮小倍數
  const SOFT = [document.createElement('canvas'), document.createElement('canvas')];
  let softD = 0;
  function soft(k, fn, alpha = 1) {
    const c = SOFT[softD++], s = c.getContext('2d');
    const w = Math.ceil((1280 * R) / k) + 2, h = Math.ceil((720 * R) / k) + 2;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } else { s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, w, h); }
    const keep = g, keepRS = RS, M = g.getTransform();
    s.setTransform(M.a / k, M.b / k, M.c / k, M.d / k, M.e / k, M.f / k);
    s.globalAlpha = 1;
    s.lineCap = 'round';
    s.lineJoin = 'round';
    g = s;
    RS = keepRS / k;
    fn();
    g = keep;
    RS = keepRS;
    softD--;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = alpha;
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, w * k, h * k);
    g.restore();
  }

  /* ---------- 曲線與筆刷 ---------- */

  const spline = (pts, per = 6) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(d => 0.5 * (2 * p1[d] + (p2[d] - p0[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  };
  const tangents = S => S.map((p, j) => {
    const a = S[Math.max(0, j - 1)], b = S[Math.min(S.length - 1, j + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  });
  const bez2 = (a, b, c, k) => [0, 1].map(d => (1 - k) * (1 - k) * a[d] + 2 * (1 - k) * k * b[d] + k * k * c[d]);
  // 控制點的數值（半徑）也跟著曲線補
  const along = (ws, per, n) => Array.from({ length: n }, (_, j) => {
    const u = j / per, k = Math.min(ws.length - 2, Math.floor(u));
    return lerp(ws[k], ws[k + 1], u - k);
  });

  // 毛筆：W 是每一點的寬度（陣列或 u → 寬度）；暈開的邊 + 濕的墨芯 + 一根根筆毛，尾端乾筆飛白；prog 控制畫到哪裡
  function inkStroke(S, W, o = {}) {
    const { col = INKC, alpha = 1, dry = 0.3, n = 12, seed = 1, prog = 1, bleed = 0.12, streak = 0.25 } = o;
    const N = S.length;
    if (N < 2 || prog <= 0 || alpha <= 0) return;
    const end = Math.max(2, Math.min(N, Math.ceil(prog * (N - 1)) + 1));
    const T = tangents(S);
    const w = j => (typeof W === 'function' ? W(j / (N - 1)) : W[j]);
    const side = (j, m) => [S[j][0] - T[j][1] * w(j) * m, S[j][1] + T[j][0] * w(j) * m];
    const poly = (m, b) => {
      g.beginPath();
      for (let j = 0; j < b; j++) { const p = side(j, m); if (j) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
      for (let j = b - 1; j >= 0; j--) { const p = side(j, -m); g.lineTo(p[0], p[1]); }
      g.closePath();
    };
    const coreEnd = Math.max(2, Math.min(end, Math.floor((N - 1) * (1 - dry)) + 1));
    if (bleed) {
      g.fillStyle = rgba(col, bleed * alpha);
      poly(0.6, end);
      g.fill();
    }
    g.fillStyle = rgba(col, alpha);
    poly(0.5, coreEnd);
    g.fill();
    g.lineCap = 'round';
    for (let b = 0; b < n; b++) {
      const m = (rnd(seed, b) * 2 - 1) * 0.48;
      const cut = 1 - dry * (0.15 + 0.85 * rnd(seed, b + 40));
      const light = rnd(seed, b + 70) < streak;
      g.strokeStyle = light ? `rgba(214,208,196,${0.25 * alpha})` : rgba(col, alpha * (0.75 + 0.25 * rnd(seed, b + 90)));
      g.beginPath();
      let pen = false, lw = 0, cnt = 0;
      for (let j = 0; j < end; j++) {
        const u = j / (N - 1);
        if (u > cut && (light || rnd(seed + b * 13, j >> 1) < 0.3 + (u - cut) * 2.5)) { pen = false; continue; }
        const p = side(j, m);
        if (pen) g.lineTo(p[0], p[1]);
        else { g.moveTo(p[0], p[1]); pen = true; }
        lw += w(j);
        cnt++;
      }
      g.lineWidth = Math.max(0.7, (lw / Math.max(1, cnt)) / n * (light ? 0.7 : 1.7));
      g.stroke();
    }
  }
  // 依控制點畫一筆：pts 用 Catmull-Rom 補成曲線，ws 是每個控制點的寬度
  const stroke = (pts, ws, o = {}, per = 8) => {
    const S = spline(pts, per);
    inkStroke(S, along(ws, per, S.length), o);
    return S;
  };

  /* ---------- 毛：一撮撮的毛（尖端收細的筆觸）與細毛 ---------- */
  // 深淺：0 焦墨 → 8 淡灰；同一個深淺的毛分三批，每批合成一條路徑一次畫完（毛再多也只要幾十次填色），
  // 不同批疊在一起會加深，做出水彩般的濃淡
  const TONE = [[8, 8, 8], [18, 17, 16], [30, 29, 28], [45, 43, 41], [64, 62, 59], [88, 85, 81], [116, 112, 107], [150, 145, 138], [186, 181, 172]];
  const NT = TONE.length, NB = 3;
  const LKA = [0.95, 0.92, 0.88, 0.8, 0.7, 0.6, 0.52, 0.46, 0.42];
  const LK = Array.from({ length: NT * NB }, () => []), HR = TONE.map(() => []);
  let FURA = 1;
  // 兩趟：0 是毛（畫進半解析度的緩衝，邊緣柔一點）；1 是細節（眼睛、鼻子、鬍鬚、細毛，清楚地畫在上面）
  let PASS = 0;
  const tk = k => (k < 0 ? 0 : k > NT - 1 ? NT - 1 : k | 0);
  const putLock = (k, x, y, a, L, w, b, i = 0) => LK[tk(k) * NB + (i % NB)].push(x, y, a, L, w, b);
  const putHair = (k, x, y, a, L, b) => HR[tk(k)].push(x, y, a, L, b);
  // 目前座標系一個單位等於幾個 1280 畫布像素（細毛要固定粗細）
  const unit = () => { const M = g.getTransform(); return Math.hypot(M.a, M.b) / RS; };
  function flushFur(hairPx = 0.8) {
    for (let k = 0; k < NT * NB; k++) {
      const b = LK[k];
      if (!b.length) continue;
      g.fillStyle = rgba(TONE[(k / NB) | 0], FURA * LKA[(k / NB) | 0]);
      g.beginPath();
      for (let i = 0; i < b.length; i += 6) {
        const x = b[i], y = b[i + 1], a = b[i + 2], L = b[i + 3], w = b[i + 4] * 0.5, bd = b[i + 5];
        const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
        const tx = x + ca * L + px * bd * L, ty = y + sa * L + py * bd * L;
        const mx = x + ca * L * 0.4 + px * bd * L * 0.25, my = y + sa * L * 0.4 + py * bd * L * 0.25;
        g.moveTo(x + px * w, y + py * w);
        g.quadraticCurveTo(mx + px * w * 1.1, my + py * w * 1.1, tx, ty);
        g.quadraticCurveTo(mx - px * w * 1.1, my - py * w * 1.1, x - px * w, y - py * w);
        g.quadraticCurveTo(x - ca * w * 1.4, y - sa * w * 1.4, x + px * w, y + py * w);
      }
      g.fill();
      b.length = 0;
    }
    const lw = hairPx / unit();
    for (let k = 0; k < NT; k++) {
      const b = HR[k];
      if (!b.length) continue;
      g.strokeStyle = rgba(TONE[k], FURA * 0.7);
      g.lineWidth = lw;
      g.beginPath();
      for (let i = 0; i < b.length; i += 5) {
        const x = b[i], y = b[i + 1], a = b[i + 2], L = b[i + 3], bd = b[i + 4];
        const ca = Math.cos(a), sa = Math.sin(a);
        g.moveTo(x, y);
        g.quadraticCurveTo(x + ca * L * 0.5 - sa * bd * L * 0.3, y + sa * L * 0.5 + ca * bd * L * 0.3, x + ca * L - sa * bd * L, y + sa * L + ca * bd * L);
      }
      g.stroke();
      b.length = 0;
    }
  }
  // 水彩般的一團淡墨（毛底下的濃淡）
  function blot(x, y, rx, ry, tone, a, rot = 0) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, rgba(TONE[tk(tone)], a * FURA));
    gr.addColorStop(1, rgba(TONE[tk(tone)], 0));
    g.fillStyle = gr;
    g.fillRect(-rx, -rx, rx * 2, rx * 2);
    g.restore();
  }
  // 加一撮毛（和細毛）：方向 a，droop 讓毛往下垂；crisp 的部位細毛畫在第二趟
  function tuft(o, i, x, y, a, edge, tone) {
    const { len = 30, wid = 10, bend = 0.16, hairs = 0.15, droop = 0, sway = 0, t = 0, seed = 1, crisp = false } = o;
    if (droop) a = Math.atan2(Math.sin(a) + droop, Math.cos(a));
    if (sway) a += Math.sin(t * 2.3 + i * 0.7) * sway;
    a += (rnd(seed, i + 13.1) - 0.5) * (o.jit ?? 0.3);
    const L = len * (0.55 + 0.8 * rnd(seed, i + 5.7)) * (1 + (o.edge ?? 0.3) * edge);
    // 相鄰的毛一起往同一邊彎（像梳過的長毛），再加一點各自的亂
    const bd = (Math.sin(x * 0.045 + y * 0.03 + seed) * 0.7 + (rnd(seed, i + 9.9) - 0.5) * 0.8) * bend;
    const k = tone + (rnd(seed, i + 3.3) - 0.5) * 1.4;
    if (PASS === 0) putLock(k, x, y, a, L, wid * (0.6 + 0.7 * rnd(seed, i + 1.9)), bd, i);
    if (hairs && rnd(seed, i + 6.6) < hairs && (PASS === 1) === crisp) {
      putHair(k + 1.5 + rnd(seed, i + 8.1) * 2, x, y, a + (rnd(seed, i + 2.2) - 0.5) * 0.25, L * (1 + 0.5 * rnd(seed, i + 4.4)), bd * 1.3);
    }
  }
  // 毛管：沿骨線 S（已補成曲線）長毛，Rr 是每一點的半徑；dir=1 毛往 S 的尾端長，-1 往開頭
  // 邊緣的毛往外張（fan）；tone(s, v) 回傳 0～8 的深淺（s 沿骨線、v 橫向 -1～1）；wash 是底下幾團較淡的墨
  function furTube(S, Rr, o) {
    const { n = 300, dir = 1, fan = 0.35, seed = 1, tone = () => 2, core = 1, coreK = 0.82, bias = 0.75, crisp = false, wash = 0, washTone = 5 } = o;
    if (PASS === 1 && !crisp) return;
    const N = S.length, T = tangents(S);
    if (PASS === 0 && core != null) {
      g.fillStyle = rgba(TONE[core], FURA);
      g.beginPath();
      for (let j = 0; j < N; j++) g.lineTo(S[j][0] - T[j][1] * Rr[j] * coreK, S[j][1] + T[j][0] * Rr[j] * coreK);
      for (let j = N - 1; j >= 0; j--) g.lineTo(S[j][0] + T[j][1] * Rr[j] * coreK, S[j][1] - T[j][0] * Rr[j] * coreK);
      g.closePath();
      g.fill();
      for (const j of [0, N - 1]) { g.beginPath(); g.arc(S[j][0], S[j][1], Rr[j] * coreK, 0, TAU); g.fill(); }
      for (let i = 0; i < wash; i++) {
        const j = Math.floor(rnd(seed, i + 50) * N), v = (rnd(seed, i + 51) * 2 - 1) * 0.6;
        blot(S[j][0] - T[j][1] * Rr[j] * v, S[j][1] + T[j][0] * Rr[j] * v, Rr[j] * 0.9, Rr[j] * 0.6, washTone, 0.4, Math.atan2(T[j][1], T[j][0]));
      }
    }
    for (let i = 0; i < n; i++) {
      const s = rnd(seed, i), v0 = rnd(seed, i + 7.3) * 2 - 1;
      const v = Math.sign(v0) * Math.pow(Math.abs(v0), bias);
      const j = s * (N - 1), j0 = Math.floor(j), f = j - j0, j1 = Math.min(N - 1, j0 + 1);
      const tx = lerp(T[j0][0], T[j1][0], f), ty = lerp(T[j0][1], T[j1][1], f);
      const r = lerp(Rr[j0], Rr[j1], f);
      const x = lerp(S[j0][0], S[j1][0], f) - ty * v * r, y = lerp(S[j0][1], S[j1][1], f) + tx * v * r;
      tuft(o, i, x, y, Math.atan2(ty * dir, tx * dir) + v * fan * dir, v * v, tone(s, v));
    }
    flushFur(o.hairPx);
  }
  // 毛團：橢圓範圍裡長毛，毛從焦點 F 往外放射（臉、胸前的鬃毛）；tone(x, y) 用 -1～1 的相對位置
  function furDisc(cx, cy, rx, ry, o) {
    const { n = 300, F = [cx, cy], twist = 0, seed = 1, tone = () => 2, core = 1, coreK = 0.85, bias = 0.6, rot = 0, crisp = false, wash = 0, washTone = 5 } = o;
    if (PASS === 1 && !crisp) return;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    if (PASS === 0 && core != null) {
      g.fillStyle = rgba(TONE[core], FURA);
      g.beginPath();
      g.ellipse(cx, cy, rx * coreK, ry * coreK, rot, 0, TAU);
      g.fill();
      for (let i = 0; i < wash; i++) {
        const an = rnd(seed, i + 50) * TAU, rr = Math.sqrt(rnd(seed, i + 51)) * 0.6;
        blot(cx + Math.cos(an) * rx * rr, cy + Math.sin(an) * ry * rr, rx * 0.5, ry * 0.4, washTone, 0.4, an);
      }
    }
    for (let i = 0; i < n; i++) {
      const an = rnd(seed, i) * TAU, rr = Math.pow(rnd(seed, i + 3.1), bias);
      const lx = Math.cos(an) * rr, ly = Math.sin(an) * rr;
      const x = cx + lx * rx * cr - ly * ry * sr, y = cy + lx * rx * sr + ly * ry * cr;
      tuft(o, i, x, y, Math.atan2(y - F[1], x - F[0]) + twist, rr * rr, tone(lx, ly, rr));
    }
    flushFur(o.hairPx);
  }
  // 畫一隻貓：毛先畫進半解析度的緩衝（柔邊），再把清楚的細節疊上去
  function drawCat(fn, k = 2) {
    PASS = 0;
    soft(k, fn);
    PASS = 1;
    fn();
    PASS = 0;
  }

  /* ---------- 黑貓：臉 ---------- */
  // 橙色的眼睛：杏仁形，虹膜由內而外亮黃 → 橙 → 深橙紅，放射紋、兩端尖的直立瞳孔、一圈黑眼線；
  // inner 是靠鼻子那側（+1 在右）；glare 讓上眼瞼靠鼻子那側壓低（瞪人）；pupil 0 是一條縫、1 是張到最開
  // 大特寫（ry 很大）時多畫：虹膜的斑紋、外圈較深的環、下眼瞼的濕潤反光、內眼角的兩點水光
  function catEye(x, y, rx, ry, ang, o = {}) {
    const { open = 1, pupil = 0.2, look = [0, 0], glow = 1, glare = 0.6, inner = 1 } = o;
    const big = ry > 40;
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    if (glow > 0) {
      const h = g.createRadialGradient(0, 0, ry * 0.5, 0, 0, rx * 1.9);
      h.addColorStop(0, `rgba(255,150,50,${0.16 * glow})`);
      h.addColorStop(1, 'rgba(255,150,50,0)');
      g.fillStyle = h;
      g.fillRect(-rx * 2, -rx * 2, rx * 4, rx * 4);
    }
    const op = clamp(open);
    const eye = new Path2D();
    const ox = -inner * rx, ix = inner * rx;
    // 外眼角略高、內眼角往下勾；上眼瞼弧度大，下眼瞼較平
    eye.moveTo(ox, -ry * 0.28);
    eye.bezierCurveTo(ox * 0.55, -ry * 1.15 * op, ix * 0.35, -ry * (1.1 - glare * 0.65) * op, ix, ry * 0.32);
    eye.bezierCurveTo(ix * 0.5, ry * 0.95 * op, ox * 0.45, ry * 0.92 * op, ox, -ry * 0.28);
    if (op > 0.05) {
      g.save();
      g.clip(eye);
      const cx = look[0] * rx * 0.3, cy = look[1] * ry * 0.22 + ry * 0.04, ir = ry * 1.28;
      g.fillStyle = '#6e2a0e';
      g.fillRect(-rx * 1.2, -ry * 2, rx * 2.4, ry * 4);
      const gi = g.createRadialGradient(cx, cy - ir * 0.1, 0, cx, cy, ir);
      gi.addColorStop(0, '#ffe09a');
      gi.addColorStop(0.3, '#fbb04e');
      gi.addColorStop(0.62, '#f07f26');
      gi.addColorStop(0.86, '#c9561a');
      gi.addColorStop(1, '#6a260c');
      g.fillStyle = gi;
      g.beginPath();
      g.arc(cx, cy, ir, 0, TAU);
      g.fill();
      if (ry > 6) {
        // 放射紋：亮的細紋與暗的細紋交錯
        const nf = big ? 150 : 36;
        g.lineWidth = Math.max(0.5, ry * (big ? 0.014 : 0.035));
        for (let i = 0; i < nf; i++) {
          const a = (i / nf) * TAU + rnd(i, 3) * 0.08, r0 = ir * (0.2 + rnd(i, 4) * 0.25), r1 = ir * (0.6 + rnd(i, 5) * 0.38);
          g.strokeStyle = rnd(i, 6) < 0.5 ? `rgba(255,230,160,${big ? 0.28 : 0.35})` : `rgba(140,46,10,${big ? 0.32 : 0.3})`;
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          g.quadraticCurveTo(cx + Math.cos(a + 0.05) * (r0 + r1) * 0.5, cy + Math.sin(a + 0.05) * (r0 + r1) * 0.5, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          g.stroke();
        }
      }
      if (big) {
        // 虹膜的斑紋與外圈較深的環
        for (let i = 0; i < 40; i++) {
          const a = rnd(i, 11) * TAU, r = ir * (0.3 + rnd(i, 12) * 0.6), rr = ry * (0.04 + rnd(i, 13) * 0.08);
          g.fillStyle = rnd(i, 14) < 0.5 ? 'rgba(255,214,140,.22)' : 'rgba(150,50,12,.2)';
          g.beginPath();
          g.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rr * 2.2, rr, a, 0, TAU);
          g.fill();
        }
        const ring = g.createRadialGradient(cx, cy, ir * 0.72, cx, cy, ir);
        ring.addColorStop(0, 'rgba(90,30,8,0)');
        ring.addColorStop(1, 'rgba(90,30,8,.55)');
        g.fillStyle = ring;
        g.beginPath();
        g.arc(cx, cy, ir, 0, TAU);
        g.fill();
      }
      // 瞳孔：兩端尖的直立縫，越興奮越寬（不會變成全圓）
      const pw = ry * (0.11 + Math.min(pupil, 0.75) * 0.5), ph = ry * (1.12 + pupil * 0.08);
      g.fillStyle = '#070404';
      g.beginPath();
      g.moveTo(cx, cy - ph);
      g.bezierCurveTo(cx + pw * 1.35, cy - ph * 0.45, cx + pw * 1.35, cy + ph * 0.45, cx, cy + ph);
      g.bezierCurveTo(cx - pw * 1.35, cy + ph * 0.45, cx - pw * 1.35, cy - ph * 0.45, cx, cy - ph);
      g.fill();
      if (big) {
        g.strokeStyle = 'rgba(80,26,8,.5)';
        g.lineWidth = ry * 0.03;
        g.stroke();
      }
      // 上眼瞼的陰影
      const sh = g.createLinearGradient(0, -ry * 1.15, 0, ry * 0.25);
      sh.addColorStop(0, 'rgba(24,8,2,.82)');
      sh.addColorStop(1, 'rgba(24,8,2,0)');
      g.fillStyle = sh;
      g.fillRect(-rx * 1.2, -ry * 1.4, rx * 2.4, ry * 1.65);
      // 反光：一塊亮的、一點小的；大特寫時下緣一道濕潤的弧
      g.fillStyle = 'rgba(255,251,242,.9)';
      g.beginPath();
      g.ellipse(cx - rx * 0.12 * inner - pw * 0.9, cy - ry * 0.34, ry * (big ? 0.11 : 0.17), ry * (big ? 0.09 : 0.14), -0.4, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,251,242,.6)';
      g.beginPath();
      g.arc(cx + rx * 0.16 * inner + pw * 0.6, cy + ry * 0.36, ry * (big ? 0.035 : 0.06), 0, TAU);
      g.fill();
      if (big) {
        g.strokeStyle = 'rgba(255,236,210,.28)';
        g.lineWidth = ry * 0.025;
        g.beginPath();
        g.arc(cx, cy - ry * 0.05, ir * 0.82, Math.PI * 0.2, Math.PI * 0.75);
        g.stroke();
      }
      g.restore();
    }
    // 眼線：特寫時細一點、邊緣柔一點；內眼角帶一點紅棕色的淚腺
    g.lineJoin = 'round';
    if (big) {
      g.strokeStyle = 'rgba(6,5,5,.45)';
      g.lineWidth = ry * 0.2;
      g.stroke(eye);
    }
    g.strokeStyle = '#060505';
    g.lineWidth = ry * (big ? 0.07 : 0.24);
    g.stroke(eye);
    g.fillStyle = 'rgba(120,40,24,.9)';
    g.beginPath();
    g.ellipse(ix * 0.95, ry * 0.42, rx * (big ? 0.035 : 0.07), ry * (big ? 0.14 : 0.2), inner * 0.6, 0, TAU);
    g.fill();
    if (big) {
      g.fillStyle = 'rgba(255,240,230,.7)';
      for (const [dx, dy, r] of [[-0.02, 0.46, 0.03], [0.02, 0.58, 0.02]]) {
        g.beginPath();
        g.arc(ix * (0.95 + dx), ry * dy, ry * r, 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }

  // 臉的特徵位置跟著轉向（yaw：-1 向左、1 向右）在球面上移動
  const turn = (x, yaw, r = 104) => Math.sin(Math.asin(clamp(x / r, -1, 1)) + yaw * 0.75) * r;

  // 頭（正面為主）：原點在兩眼連線的中點，臉寬約 180；ears 是耳朵往後壓的程度
  function catHead(o = {}) {
    const { yaw = 0, pitch = 0, t = 0, open = 1, pupil = 0.2, look = [0, 0], glare = 0.7, glow = 1, detail = 1, ears = 0, seed = 11, whisk = 1, mane = 1, lit = 1 } = o;
    const X = x => turn(x, yaw);
    const PY = y => y - pitch * 30 * (1 - Math.min(1, Math.abs(y) / 150));
    // detail 越高毛越多、每撮越小（特寫時用）
    const D = k => Math.round(k * detail), SZ = 1 / Math.sqrt(detail);
    const fx = X(0), ey = PY(0), ex = 40;
    // 鬃毛：臉周圍一大圈往下垂的長毛（下巴、臉頰），比臉淡
    if (mane) {
      furDisc(fx * 0.3, PY(64), 138 * mane, 116 * mane, {
        n: D(640), F: [fx * 0.5, PY(-10)], len: 34 * SZ, wid: 12 * SZ, seed, edge: 0.3, droop: 1, bend: 0.3, hairs: 0.25, t, sway: 0.02,
        tone: (x, y) => 3 + Math.max(0, y) * 1.8 + Math.abs(x) * 0.5, core: 2, wash: 5, washTone: 5,
      });
    }
    // 耳朵：深色三角、裡面淡灰的耳毛、耳尖一撮長毛
    const earPts = sd => {
      const bx0 = X(sd * 86), bx1 = X(sd * 22), tipx = X(sd * (92 + ears * 44));
      return [bx0, PY(-36), bx1, PY(-64), tipx, PY(-158 + ears * 66)];
    };
    for (const sd of yaw > 0 ? [-1, 1] : [1, -1]) {
      const [bx0, by0, bx1, by1, tipx, tipy] = earPts(sd);
      if (PASS === 0) {
        g.fillStyle = rgba(TONE[1], FURA);
        g.beginPath();
        g.moveTo(bx0, by0);
        g.quadraticCurveTo(lerp(bx0, tipx, 0.5) + sd * 10, lerp(by0, tipy, 0.5), tipx, tipy);
        g.quadraticCurveTo(lerp(bx1, tipx, 0.55) - sd * 2, lerp(by1, tipy, 0.5), bx1, by1);
        g.closePath();
        g.fill();
        // 耳朵裡一片淡灰
        blot(lerp(lerp(bx0, bx1, 0.5), tipx, 0.4), lerp(lerp(by0, by1, 0.5), tipy, 0.4), 26, 34, 5, 0.6);
        for (let i = 0; i < 14; i++) {
          const k = i / 14, x = lerp(bx0, tipx, k), y = lerp(by0, tipy, k);
          putLock(0, x, y, Math.atan2(tipy - by0, tipx - bx0) - sd * 0.6, 14, 7, 0, i);
        }
        // 耳毛與耳尖的長毛（柔邊）
        for (let i = 0; i < D(30); i++) {
          const k = 0.45 + rnd(seed + sd, i) * 0.35, m = 0.3 + rnd(seed + sd, i + 1) * 0.45;
          const x = lerp(lerp(bx0, bx1, m), tipx, k), y = lerp(lerp(by0, by1, m), tipy, k);
          putHair(3.5 + rnd(seed, i + 2) * 2, x, y, Math.atan2(tipy - y, tipx - x) + (rnd(seed, i + 3) - 0.5) * 0.7, 24 + rnd(seed, i + 4) * 30, (rnd(seed, i + 5) - 0.5) * 0.5);
        }
        for (let i = 0; i < 6; i++) putHair(0, tipx, tipy + 6, -Math.PI / 2 + sd * 0.3 + (i - 2.5) * 0.08, 16 + rnd(seed, i + 30) * 20, (rnd(seed, i + 31) - 0.5) * 0.5);
        flushFur(1.4);
      }
    }
    // 頭：毛從鼻子往外放射；額頭深色、帶虎斑，臉頰較淡
    furDisc(fx * 0.2, PY(-14), 92 - Math.abs(yaw) * 8, 96, {
      n: D(820), F: [fx, PY(46)], len: 17 * SZ, wid: 9 * SZ, seed: seed + 1, edge: -0.45, hairs: 0, jit: 0.22, t, bias: 0.5,
      tone: (x, y) => {
        // 額頭的虎斑：往兩眼之間收攏的細條紋（M 字）
        const q = x / (0.35 + Math.max(0, -y) * 0.9);
        const stripe = y < -0.08 ? (Math.sin(q * 7.5 + Math.sin(y * 6) * 0.6) > 0.15 ? -1.1 : 1.1) * clamp(1.4 - Math.abs(x) * 1.6) : 0;
        return 2 + Math.max(0, y) * 1.6 + Math.abs(x) * 1.1 + stripe;
      },
      core: 1, wash: 4, washTone: 4,
    });
    // 臉頰往外、往下的淡灰毛
    for (const sd of [-1, 1]) {
      furDisc(X(sd * 62), PY(34), 46, 38, {
        n: D(110), F: [X(sd * 14), PY(14)], len: 26 * SZ, wid: 10 * SZ, seed: seed + 5 + sd, edge: 0.5, droop: 0.4, hairs: 0.3, crisp: false,
        tone: () => 4.6, core: null,
      });
    }
    // 吻部：淡一點的鬍鬚墊、下巴
    furDisc(fx, PY(56), 34, 22, { n: D(130), F: [fx, PY(44)], len: 10 * SZ, wid: 6 * SZ, seed: seed + 9, edge: 0.4, tone: (x, y) => 3.8 + y * 0.6, core: 3 });
    if (PASS === 0) {
      // 眼窩與鼻樑：深色
      for (const sd of [-1, 1]) blot(X(sd * ex), ey, 34, 24, 0, 0.9, sd * -0.2);
      blot(fx, PY(22), 12, 26, 0, 0.6);
      // 眉：眼睛上方壓低的深色毛
      for (const sd of [-1, 1]) {
        for (let i = 0; i < 8; i++) {
          const k = i / 7, x = X(sd * lerp(18, 62, k)), y = ey - lerp(13, 20, k) + glare * lerp(5, -1, k);
          putLock(0, x, y, sd > 0 ? -0.3 - k * 0.5 : Math.PI + 0.3 + k * 0.5, 15, 7, 0, i);
        }
      }
      flushFur();
      return;
    }
    // 眼睛（轉向時遠側的眼睛變窄）
    // lit：眼睛從霧裡亮起來
    g.globalAlpha = lit;
    for (const sd of [-1, 1]) {
      const x = X(sd * ex), sq = clamp(1 - Math.max(0, -sd * yaw) * 0.55, 0.3, 1);
      catEye(x, ey, 17 * sq, 10.5 * (1 - pitch * 0.2), sd * -0.24, { open, pupil, look, glow, glare, inner: -sd });
    }
    g.globalAlpha = 1;
    // 鼻子：灰粉色的倒三角，鼻孔、上緣一點反光
    const nx = X(0), ny = PY(44);
    g.fillStyle = '#86625c';
    g.beginPath();
    g.moveTo(nx - 11, ny - 5);
    g.quadraticCurveTo(nx, ny - 9, nx + 11, ny - 5);
    g.quadraticCurveTo(nx + 6, ny + 4, nx, ny + 8);
    g.quadraticCurveTo(nx - 6, ny + 4, nx - 11, ny - 5);
    g.fill();
    g.strokeStyle = 'rgba(20,12,10,.7)';
    g.lineWidth = 1.4;
    g.stroke();
    g.fillStyle = 'rgba(30,16,14,.85)';
    g.beginPath();
    g.ellipse(nx - 4.5, ny + 1.5, 2.6, 1.6, 0.5, 0, TAU);
    g.ellipse(nx + 4.5, ny + 1.5, 2.6, 1.6, -0.5, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(236,206,196,.35)';
    g.beginPath();
    g.ellipse(nx - 2, ny - 4, 4, 1.6, 0, 0, TAU);
    g.fill();
    // 嘴
    g.strokeStyle = 'rgba(8,8,8,.85)';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(nx, ny + 8);
    g.lineTo(nx, ny + 14);
    g.quadraticCurveTo(nx - 6, ny + 19, nx - 13, ny + 14);
    g.moveTo(nx, ny + 14);
    g.quadraticCurveTo(nx + 6, ny + 19, nx + 13, ny + 14);
    g.stroke();
    // 鬍鬚墊上的黑點
    g.fillStyle = 'rgba(10,10,10,.7)';
    for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(X(sd * (14 + (i % 3) * 7)), ny + 10 + Math.floor(i / 3) * 6, 1.1, 0, TAU);
      g.fill();
    }
    // 鬍鬚：從吻部往外掃出去、往下彎的細白線；眉上幾根往上翹
    if (whisk > 0) {
      g.lineCap = 'round';
      for (const sd of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const x0 = X(sd * (18 + (i % 2) * 7)), y0 = ny + 10 + i * 3;
          const L = (150 + rnd(seed, i + sd * 9) * 60) * whisk, a = (sd > 0 ? 0 : Math.PI) + sd * (-0.1 + i * 0.12);
          const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L + L * 0.22;
          g.strokeStyle = `rgba(232,227,216,${0.52 - i * 0.06})`;
          g.lineWidth = 1.1 - i * 0.1;
          g.beginPath();
          g.moveTo(x0, y0);
          g.quadraticCurveTo(lerp(x0, x1, 0.55), lerp(y0, y1, 0.3) - 6, x1, y1);
          g.stroke();
        }
        for (let i = 0; i < 2; i++) {
          const x0 = X(sd * (26 + i * 9)), y0 = ey - 18;
          g.strokeStyle = 'rgba(232,227,216,.45)';
          g.lineWidth = 0.9;
          g.beginPath();
          g.moveTo(x0, y0);
          g.quadraticCurveTo(x0 + sd * 24, y0 - 36, x0 + sd * (44 + i * 14), y0 - 46 - i * 6);
          g.stroke();
        }
      }
    }
    // 臉周圍清楚的細毛（一點點）
    if (mane) furDisc(fx * 0.3, PY(64), 138 * mane, 116 * mane, { n: D(120), F: [fx * 0.5, PY(-10)], len: 40 * SZ, wid: 15 * SZ, seed: seed + 40, edge: 0.4, droop: 1, hairs: 1, crisp: true, tone: () => 3.5 });
  }

  /* ---------- 黑貓：正面的身體 ---------- */
  // 腳掌：圓的掌、三道趾縫、趾間的毛；claws 是露出的爪子
  function paw(x, y, r, o = {}) {
    const { seed = 3, claws = 0, tone = 1.4 } = o;
    furDisc(x, y, r * 1.1, r * 0.72, { n: 60, F: [x, y - r], len: r * 0.42, wid: r * 0.32, seed, edge: 0.4, tone: (lx, ly) => tone + (ly < 0 ? 0.8 : 0), core: 0 });
    if (PASS === 0) {
      g.strokeStyle = rgba(TONE[0], FURA);
      g.lineWidth = r * 0.1;
      g.beginPath();
      for (let i = -1; i <= 1; i++) {
        g.moveTo(x + i * r * 0.42, y + r * 0.6);
        g.quadraticCurveTo(x + i * r * 0.38, y + r * 0.1, x + i * r * 0.3, y - r * 0.1);
      }
      g.stroke();
      return;
    }
    if (claws > 0) {
      g.fillStyle = `rgba(226,218,204,${0.92 * clamp(claws)})`;
      for (let i = 0; i < 4; i++) {
        const cx = x + (i - 1.5) * r * 0.44, cy = y + r * 0.58, L = r * 0.55 * claws;
        g.beginPath();
        g.moveTo(cx - r * 0.07, cy);
        g.quadraticCurveTo(cx + r * 0.1, cy + L * 0.5, cx + r * 0.02, cy + L);
        g.quadraticCurveTo(cx + r * 0.02, cy + L * 0.4, cx + r * 0.07, cy);
        g.fill();
      }
    }
  }

  // 正面站姿／坐姿／舉手：P 是骨架（地面 y=0、身體中線 x=0；head 是兩眼中點）
  const FPOSE = {
    sit: {
      head: [0, -470], body: [[0, -380], [0, -240], [0, -120]], br: [92, 114, 124],
      armL: [[-54, -290], [-52, -150], [-48, -20]], armR: [[54, -290], [52, -150], [48, -20]], ar: [30, 26, 24],
      legL: [[-92, -120], [-110, -60], [-112, -14]], legR: [[92, -120], [110, -60], [112, -14]], lr: [62, 48, 24], haunch: 1,
      tail: [[100, -36], [212, -50], [270, -122], [254, -212], [190, -248]], tr: [30, 40, 44, 38, 16],
      ruff: [0, -350, 124, 124],
    },
    walk: {
      head: [0, -452], body: [[0, -360], [0, -270], [0, -180]], br: [90, 100, 96],
      armL: [[-54, -290], [-56, -150], [-54, -20]], armR: [[54, -290], [56, -150], [54, -20]], ar: [30, 26, 23],
      legL: [[-62, -180], [-72, -100], [-74, -16]], legR: [[62, -180], [72, -100], [74, -16]], lr: [40, 28, 20], haunch: 0,
      tail: [[56, -210], [170, -240], [250, -320], [270, -420], [214, -480]], tr: [26, 36, 42, 36, 14],
      ruff: [0, -340, 118, 116],
    },
    reach: {
      head: [0, -500], body: [[0, -420], [0, -300], [0, -160]], br: [88, 96, 100],
      armL: [[-66, -450], [-90, -610], [-30, -780]], armR: [[66, -450], [90, -610], [30, -780]], ar: [42, 37, 33],
      legL: [[-58, -170], [-76, -90], [-72, -14]], legR: [[58, -170], [76, -90], [72, -14]], lr: [52, 38, 22], haunch: 0,
      tail: [[46, -160], [110, -110], [140, -46], [180, -10], [240, 0]], tr: [24, 34, 38, 32, 14],
      ruff: [0, -380, 110, 112],
    },
  };
  function catFront(P, o = {}) {
    const { t = 0, seed = 21, detail = 1, armsFront = true } = o;
    const D = k => Math.round(k * detail), SZ = 1 / Math.sqrt(detail);
    // 尾巴（在身後）：粗大蓬鬆，毛往兩側張開，帶幾圈深色環紋
    const tS = spline(P.tail, 6), tR = along(P.tr, 6, tS.length);
    furTube(tS, tR, { n: D(560), dir: 1, fan: 0.5, len: 30 * SZ, wid: 11 * SZ, seed: seed + 1, edge: 0.4, bend: 0.28, hairs: 0.2, t, sway: 0.04, tone: (s, v) => 2.2 + Math.abs(v) * 1.6 + (Math.sin(s * 16) > 0.5 ? -1.4 : 0), core: 1, wash: 3 });
    // 後腿：坐著時是兩團大腿毛，站著時是兩條腿
    for (const [L, sd] of [[P.legL, -1], [P.legR, 1]]) {
      const S = spline(L, 5), Rr = along(P.lr, 5, S.length);
      furTube(S, Rr, { n: D(P.haunch ? 300 : 180), dir: 1, fan: 0.4, len: 28 * SZ, wid: 13 * SZ, seed: seed + 3 + sd, edge: 0.4, droop: 0.4, t, tone: (s, v) => 1.8 + v * -sd * 1.2 + s * 0.4, core: 1, wash: 2 });
      paw(L[2][0] + sd * 6, L[2][1] - 4, 22, { seed: seed + 5 + sd });
    }
    // 身體：毛往下長，胸口較淡、兩側有深色條紋
    const bS = spline(P.body, 6), bR = along(P.br, 6, bS.length);
    furTube(bS, bR, { n: D(560), dir: 1, fan: 0.4, len: 32 * SZ, wid: 14 * SZ, seed: seed + 7, edge: 0.4, droop: 0.3, t, tone: (s, v) => 2 + (1 - Math.abs(v)) * 1.8 + (Math.sin(s * 9 + Math.abs(v) * 4) > 0.6 ? -1.6 : 0), core: 1, wash: 4 });
    const arms = () => {
      for (const [A, sd] of [[P.armL, -1], [P.armR, 1]]) {
        const S = spline(A, 6), Rr = along(P.ar, 6, S.length);
        furTube(S, Rr, { n: D(240), dir: 1, fan: 0.3, len: 24 * SZ, wid: 11 * SZ, seed: seed + 9 + sd, edge: 0.3, droop: 0.15, t, tone: (s, v) => 2.4 + v * sd * 1.6 + (1 - s) * 0.6 + (Math.sin(s * 12) > 0.6 ? -1.2 : 0), core: 1 });
        const e = A[A.length - 1];
        paw(e[0], e[1] - 6, o.pawR || 28, { seed: seed + 11 + sd, claws: o.claws || 0 });
      }
    };
    if (!armsFront) arms();
    // 胸前的鬃毛：淡灰的長毛往下垂
    const [rx0, ry0, rrx, rry] = P.ruff;
    furDisc(rx0, ry0, rrx, rry, { n: D(560), F: [rx0, ry0 - rry * 0.9], len: 40 * SZ, wid: 16 * SZ, seed: seed + 13, edge: 0.4, droop: 0.6, bend: 0.22, t, sway: 0.02, tone: (x, y) => 3 + (1 - Math.abs(x)) * 1.8 + y * 0.5, core: 2, wash: 4, washTone: 6 });
    if (armsFront) arms();
    at(P.head[0], P.head[1], 1, () => catHead({ t, detail, ...o.head }), P.headRot || 0);
  }

  // 正面走路：左右前腳輪流抬起，身體微微左右晃、頭上下點
  const walkF = (t, amt = 1, base = FPOSE.walk) => {
    const P = mix(base, base, 0);
    const ph = t * 1.7 * TAU, l = Math.max(0, Math.sin(ph)) * 30 * amt, r = Math.max(0, -Math.sin(ph)) * 30 * amt, sw = Math.sin(ph) * 5 * amt;
    P.armL = P.armL.map((p, i) => [p[0] + sw, p[1] - l * (i / 2)]);
    P.armR = P.armR.map((p, i) => [p[0] + sw, p[1] - r * (i / 2)]);
    P.body = P.body.map(p => [p[0] + sw * 0.8, p[1]]);
    P.ruff = [P.ruff[0] + sw, P.ruff[1], P.ruff[2], P.ruff[3]];
    P.head = [P.head[0] + sw * 0.6, P.head[1] + Math.abs(Math.cos(ph)) * 5 * amt];
    return P;
  };
  // 呼吸與搖尾巴（站著、坐著時）
  const idleF = (P, t, tailAmt = 1) => {
    const Q = mix(P, P, 0), b = Math.sin(t * 2.2) * 3;
    Q.head = [Q.head[0], Q.head[1] + b * 0.6];
    Q.ruff = [Q.ruff[0], Q.ruff[1] + b * 0.4, Q.ruff[2] + b, Q.ruff[3]];
    Q.tail = Q.tail.map((p, i) => [p[0] + Math.sin(t * 1.8 - i * 0.6) * i * 9 * tailAmt, p[1] + Math.cos(t * 1.8 - i * 0.6) * i * 4 * tailAmt]);
    return Q;
  };

  /* ---------- 黑貓：側面（骨架 + 毛） ---------- */
  // 面向右、地面 y=0：hip／chest 身體兩端（rh、rc 半徑，arch 背拱起多少）、ruff 胸前鬃毛（rr）、
  // head 頭（兩眼中點；hs 大小、hRot 傾斜）、fN／fF／bN／bF 四條腿（肩或髖 → 肘或膝 → 腕或踝 → 掌；N 是近側）、tail 尾巴五個點
  const SPOSE = {
    stand: { hip: [-120, -178], chest: [86, -186], rh: 60, rc: 64, ruff: [128, -170], rr: 58, head: [178, -262], hs: 0.68, hRot: 0, arch: 12,
      fN: [[78, -160], [88, -96], [84, -30], [100, -8]], fF: [[56, -160], [64, -96], [60, -30], [76, -8]],
      bN: [[-112, -160], [-80, -96], [-116, -32], [-98, -8]], bF: [[-138, -156], [-106, -94], [-142, -32], [-124, -8]],
      tail: [[-172, -172], [-236, -196], [-282, -250], [-290, -318], [-258, -362]] },
    crouch: { hip: [-124, -112], chest: [82, -84], rh: 58, rc: 62, ruff: [124, -82], rr: 56, head: [184, -130], hs: 0.68, hRot: 0.05, arch: 14,
      fN: [[84, -60], [132, -40], [124, -12], [148, -6]], fF: [[60, -60], [108, -38], [100, -12], [124, -6]],
      bN: [[-114, -98], [-44, -50], [-112, -14], [-84, -6]], bF: [[-140, -94], [-70, -46], [-138, -14], [-110, -6]],
      tail: [[-176, -110], [-250, -92], [-318, -74], [-378, -84], [-416, -116]] },
    gather: { hip: [-92, -150], chest: [70, -140], rh: 58, rc: 62, ruff: [110, -140], rr: 56, head: [168, -196], hs: 0.68, hRot: 0.1, arch: 22,
      fN: [[86, -110], [66, -62], [34, -22], [52, -6]], fF: [[64, -110], [44, -60], [12, -20], [30, -6]],
      bN: [[-86, -136], [-20, -96], [18, -46], [40, -8]], bF: [[-110, -132], [-44, -92], [-6, -44], [16, -8]],
      tail: [[-146, -160], [-210, -180], [-262, -222], [-290, -276], [-284, -332]] },
    leap: { hip: [-150, -232], chest: [108, -250], rh: 52, rc: 58, ruff: [150, -250], rr: 52, head: [218, -292], hs: 0.68, hRot: -0.1, arch: 4,
      fN: [[138, -232], [222, -250], [300, -270], [342, -276]], fF: [[116, -228], [196, -238], [274, -252], [312, -256]],
      bN: [[-140, -218], [-220, -192], [-298, -172], [-344, -166]], bF: [[-164, -214], [-244, -198], [-322, -186], [-366, -184]],
      tail: [[-200, -238], [-276, -244], [-350, -240], [-420, -244], [-478, -262]] },
    land: { hip: [-118, -178], chest: [82, -112], rh: 56, rc: 60, ruff: [120, -108], rr: 56, head: [180, -152], hs: 0.68, hRot: 0.08, arch: 18,
      fN: [[98, -90], [146, -52], [140, -14], [164, -6]], fF: [[74, -90], [122, -50], [116, -14], [140, -6]],
      bN: [[-110, -164], [-66, -120], [-124, -70], [-104, -40]], bF: [[-134, -160], [-90, -118], [-148, -70], [-128, -42]],
      tail: [[-172, -192], [-240, -214], [-300, -246], [-348, -290], [-362, -344]] },
    swipe: { hip: [-126, -150], chest: [80, -214], rh: 56, rc: 60, ruff: [118, -210], rr: 56, head: [176, -290], hs: 0.68, hRot: -0.15, arch: 6,
      fN: [[100, -226], [196, -322], [282, -378], [330, -384]], fF: [[74, -196], [100, -118], [108, -40], [126, -8]],
      bN: [[-118, -136], [-60, -80], [-110, -30], [-84, -8]], bF: [[-142, -132], [-86, -76], [-136, -30], [-110, -8]],
      tail: [[-176, -150], [-246, -158], [-306, -190], [-344, -240], [-346, -300]] },
    rear: { hip: [-40, -150], chest: [6, -350], rh: 56, rc: 54, ruff: [36, -340], rr: 54, head: [44, -440], hs: 0.68, hRot: -0.25, arch: -10,
      fN: [[30, -350], [66, -420], [78, -486], [90, -516]], fF: [[8, -344], [44, -410], [56, -470], [68, -500]],
      bN: [[-36, -130], [2, -72], [-34, -24], [-8, -6]], bF: [[-60, -128], [-22, -70], [-58, -24], [-32, -6]],
      tail: [[-86, -120], [-150, -84], [-212, -76], [-262, -102], [-284, -150]] },
  };
  // 往鏡頭伸的那隻腳：掌心朝前，粉棕色的掌墊、四顆趾墊、彎爪
  function padsFace(x, y, r, rot = 0) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = '#9b6f67';
    g.beginPath();
    g.ellipse(0, r * 0.2, r * 0.42, r * 0.33, 0, 0, TAU);
    g.fill();
    for (let i = 0; i < 4; i++) {
      const a = -2.55 + i * 0.6;
      g.beginPath();
      g.ellipse(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66 + r * 0.12, r * 0.16, r * 0.2, a + Math.PI / 2, 0, TAU);
      g.fill();
    }
    g.fillStyle = 'rgba(232,224,210,.9)';
    for (let i = 0; i < 4; i++) {
      const a = -2.55 + i * 0.6, cx = Math.cos(a) * r * 0.95, cy = Math.sin(a) * r * 0.95 + r * 0.1;
      g.beginPath();
      g.moveTo(cx - 3, cy);
      g.quadraticCurveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3 - 4, cx + Math.cos(a + 0.6) * r * 0.32, cy + Math.sin(a + 0.6) * r * 0.32);
      g.quadraticCurveTo(cx + Math.cos(a) * r * 0.15, cy + Math.sin(a) * r * 0.15, cx + 3, cy);
      g.fill();
    }
    g.restore();
  }
  // 側面的貓：o.flip 面向左；o.pads 近側前腳朝鏡頭；o.head 傳給頭
  function catSide(P, o = {}) {
    const { x = 0, y = 0, s = 1, flip = false, t = 0, seed = 31, detail = 1, rot = 0, sx = 1 } = o;
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.scale((flip ? -s : s) * sx, s);
    const D = k => Math.round(k * detail);
    const leg = (L, rs, sd, near) => {
      const S = spline(L, 4), Rr = along(rs, 4, S.length);
      furTube(S, Rr, { n: D(near ? 190 : 130), dir: 1, fan: 0.3, len: 22, wid: 11, seed: seed + sd, edge: 0.3, droop: 0.3, t, tone: (s2, v) => (near ? 2.4 : 1) + (v > 0 ? 0.6 : -0.3) + (Math.sin(s2 * 11) > 0.6 ? -1 : 0), core: near ? 1 : 0 });
      const e = L[3];
      furDisc(e[0], e[1] - 3, rs[3] * 1.35, rs[3] * 0.8, { n: D(36), F: [e[0] - rs[3], e[1] - rs[3] * 2], len: 10, wid: 7, seed: seed + sd + 7, edge: 0.2, tone: () => (near ? 1.8 : 0.8), core: 0 });
    };
    leg(P.fF, [26, 19, 14, 13], 1, false);
    leg(P.bF, [46, 27, 15, 13], 2, false);
    // 尾巴：蓬鬆、帶深色環紋
    const tS = spline(P.tail, 6), tR = along([24, 32, 36, 32, 13], 6, tS.length);
    furTube(tS, tR, { n: D(480), dir: 1, fan: 0.5, len: 28, wid: 11, seed: seed + 3, edge: 0.4, bend: 0.28, t, sway: 0.04, tone: (s2, v) => 2 + Math.abs(v) * 1.4 + (Math.sin(s2 * 16) > 0.5 ? -1.4 : 0), core: 1, wash: 2 });
    // 身體：毛從胸往臀長，背深、肚子淡，側面有虎斑
    const dx = P.chest[0] - P.hip[0], dy = P.chest[1] - P.hip[1], dl = Math.hypot(dx, dy) || 1, arch = P.arch ?? 12;
    const mid = [(P.hip[0] + P.chest[0]) / 2 + (dy / dl) * arch, (P.hip[1] + P.chest[1]) / 2 - (dx / dl) * arch];
    const bS = spline([P.hip, mid, P.chest], 8), bR = along([P.rh, (P.rh + P.rc) * 0.47, P.rc], 8, bS.length);
    furTube(bS, bR, { n: D(560), dir: -1, fan: 0.35, len: 30, wid: 13, seed: seed + 5, edge: 0.3, droop: 0.25, t, tone: (s2, v) => 1.6 + (v > 0 ? v * 2.4 : v * 0.6) + (Math.sin(s2 * 15 + v * 2) > 0.55 ? -1.4 : 0), core: 1, wash: 4 });
    // 近側的後腿（大腿毛蓬鬆）
    leg(P.bN, [54, 30, 16, 14], 4, true);
    // 胸前鬃毛
    furDisc(P.ruff[0], P.ruff[1], P.rr, P.rr * 1.1, { n: D(240), F: [P.ruff[0] + 16, P.ruff[1] - P.rr], len: 30, wid: 12, seed: seed + 6, edge: 0.3, droop: 0.8, t, tone: (lx, ly) => 3.2 + ly * 1.2, core: 2, wash: 2, washTone: 6 });
    // 近側的前腳
    leg(P.fN, [28, 20, 15, 14], 5, true);
    if (o.pads && PASS === 1) {
      const e = P.fN[3], b = P.fN[2];
      padsFace(e[0], e[1] - 4, 22, Math.atan2(e[1] - b[1], e[0] - b[0]) + Math.PI / 2);
    }
    at(P.head[0], P.head[1], P.hs ?? 0.6, () => catHead({ t, yaw: 0.5, mane: 0.72, detail: 0.75 * detail, whisk: 0.8, ...o.head }), P.hRot || 0);
    g.restore();
  }
  // 近側前腳掌在畫面上的位置（拉墨痕用）
  const pawAt = (P, o) => {
    const e = P.fN[3], s = o.s || 1;
    return [o.x + (o.flip ? -1 : 1) * e[0] * s, o.y + e[1] * s];
  };

  /* ---------- 特寫：眼睛、腳掌 ---------- */
  // 眼睛的大特寫：四周是往外放射的大撮毛，眼睛的虹膜有放射紋、瞳孔隨情緒張開
  function bigEye(o = {}) {
    const { pupil = 0.2, look = [0, 0], z = 1, t = 0, seed = 71 } = o;
    view(640, 380, z);
    drawCat(() => {
      furDisc(600, 420, 1000, 640, {
        n: 2400, F: [-900, 420], len: 96, wid: 20, seed, edge: 0.2, bend: 0.3, jit: 0.3, t, hairs: 0.3, bias: 0.8,
        tone: (x, y, rr) => 2 + Math.max(0, rr - 0.45) * 2.6 + (Math.sin(x * 9 + y * 4) > 0.55 ? -1.4 : 0), core: 1, wash: 10, washTone: 4,
      });
      if (PASS === 1) catEye(640, 372, 300, 172, -0.06, { pupil, look, glare: 0.3, glow: 0.5, inner: 1 });
    });
  }
  // 正面的前腳特寫（從低角度看）：腳從畫面上方伸下來，掌落在地上；lift 是離地高度
  function bigLeg(x, gy, s, lift, seed, o = {}) {
    at(x, gy - lift, s, () => {
      // 腿：上粗下細，兩側的長毛往外翻
      const S = spline([[34, -900], [16, -560], [4, -300], [0, -150]], 6), Rr = along([116, 104, 92, 100], 6, S.length);
      furTube(S, Rr, { n: 760, dir: 1, fan: 0.5, len: 66, wid: 20, seed, edge: 0.6, droop: 0.12, bend: 0.28, tone: (s2, v) => 1.8 + Math.abs(v) * 1.8 + (Math.sin(s2 * 7 + v) > 0.6 ? -1.2 : 0), core: 1, wash: 5 });
      // 掌：比腿寬的一團；前緣四個趾頭（頂上較亮、趾縫深），趾間冒出長毛
      furDisc(0, -78, 156, 92, { n: 420, F: [0, -190], len: 38, wid: 15, seed: seed + 2, edge: 0.4, bend: 0.22, tone: (lx, ly) => 1.6 + (ly < -0.2 ? 1.2 : 0), core: 1 });
      for (let i = 0; i < 4; i++) {
        const tx = (i - 1.5) * 66, ty = -18 + Math.abs(i - 1.5) * 14;
        furDisc(tx, ty, 40, 48, { n: 130, F: [tx * 0.5, ty - 90], len: 26, wid: 12, seed: seed + 3 + i, edge: 0.35, bend: 0.2, tone: (lx, ly) => 2.4 + (ly < 0 ? 1.6 : -0.8), core: 1 });
      }
      if (PASS === 0) {
        g.strokeStyle = rgba(TONE[0], 0.95);
        g.lineWidth = 10;
        g.beginPath();
        for (let i = 0; i < 3; i++) {
          const tx = (i - 1) * 66;
          g.moveTo(tx, 36 - Math.abs(i - 1) * 6);
          g.quadraticCurveTo(tx * 1.05, -20, tx * 0.85, -76);
        }
        g.stroke();
        return;
      }
      if (o.claws) {
        g.fillStyle = `rgba(196,190,178,${0.9 * clamp(o.claws)})`;
        for (let i = 0; i < 4; i++) {
          const cx = (i - 1.5) * 66 + 4, cy = 26 + Math.abs(i - 1.5) * 12, L = 22 * clamp(o.claws);
          g.beginPath();
          g.moveTo(cx - 6, cy - 4);
          g.quadraticCurveTo(cx + 6, cy + L * 0.5, cx + 2, cy + L);
          g.quadraticCurveTo(cx + 1, cy + L * 0.4, cx + 6, cy - 4);
          g.fill();
        }
      }
    });
  }

  /* ---------- 白色的蝴蝶 ---------- */
  // 發光的白蝴蝶：前後翅、灰色的翅脈、細的身體與觸角；拍翅是翅膀寬度的變化；glow 是周圍的白光
  function butterfly(x, y, s, t, o = {}) {
    const { rot = 0, flapHz = 6, alpha = 1, glow = 1, phase = 0, open = null, sparkle = 1 } = o;
    if (alpha <= 0) return;
    const f = open ?? (0.5 + 0.5 * Math.sin((t * flapHz + phase) * TAU));
    const k = 0.14 + 0.86 * f;
    g.save();
    g.translate(x, y);
    g.globalAlpha *= alpha;
    if (glow > 0) {
      const h = g.createRadialGradient(0, 0, 3 * s, 0, 0, 80 * s);
      h.addColorStop(0, `rgba(255,253,246,${0.8 * glow})`);
      h.addColorStop(0.3, `rgba(255,252,242,${0.32 * glow})`);
      h.addColorStop(1, 'rgba(255,252,242,0)');
      g.fillStyle = h;
      g.fillRect(-80 * s, -80 * s, 160 * s, 160 * s);
    }
    // 身後幾點飄落的微光
    if (sparkle) {
      for (let i = 0; i < 5; i++) {
        const a = (t * 0.9 + i * 0.2) % 1;
        g.fillStyle = `rgba(255,252,240,${0.8 * (1 - a) * sparkle})`;
        g.beginPath();
        g.arc((rnd(i, Math.floor(t * 0.9 + i * 0.2)) - 0.5) * 30 * s, a * 46 * s, (1.6 - a) * s * 1.4, 0, TAU);
        g.fill();
      }
    }
    g.rotate(rot);
    g.scale(s, s);
    for (const sd of [-1, 1]) {
      g.save();
      g.scale(sd * k, 1);
      const fw = new Path2D();
      fw.moveTo(0, -2);
      fw.bezierCurveTo(8, -30, 36, -42, 44, -30);
      fw.bezierCurveTo(48, -16, 30, -2, 2, 2);
      fw.closePath();
      const hw = new Path2D();
      hw.moveTo(0, 2);
      hw.bezierCurveTo(26, 0, 38, 16, 30, 30);
      hw.bezierCurveTo(22, 38, 6, 26, 0, 8);
      hw.closePath();
      g.fillStyle = 'rgba(254,253,249,.97)';
      g.fill(hw);
      g.fill(fw);
      g.strokeStyle = 'rgba(126,120,110,.6)';
      g.lineWidth = 1.1;
      g.stroke(fw);
      g.stroke(hw);
      g.strokeStyle = 'rgba(160,154,144,.45)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(2, -1);
      g.quadraticCurveTo(20, -24, 40, -30);
      g.moveTo(2, 0);
      g.quadraticCurveTo(22, -12, 42, -18);
      g.moveTo(2, 4);
      g.quadraticCurveTo(18, 12, 28, 26);
      g.stroke();
      g.restore();
    }
    g.fillStyle = 'rgba(40,36,32,.95)';
    g.beginPath();
    g.ellipse(0, 4, 2.2, 12, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(40,36,32,.8)';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(-1, -7);
    g.quadraticCurveTo(-6, -18, -10, -24);
    g.moveTo(1, -7);
    g.quadraticCurveTo(6, -18, 10, -24);
    g.stroke();
    g.restore();
  }
  // 飛行的抖動：蝴蝶不會直直地飛
  const flit = (t, k = 1, seed = 0) => [Math.sin(t * 2.3 + seed) * 14 * k + Math.sin(t * 5.1 + seed * 2) * 5 * k, Math.sin(t * 3.1 + seed) * 10 * k + Math.cos(t * 7.3 + seed) * 4 * k];

  /* ---------- 墨：墨點、墨團、墨圈 ---------- */
  // 墨點：從一點往外噴的大小墨點（k 0→1 飛出去）
  function splatter(x, y, n, Rad, k, seed, o = {}) {
    if (k <= 0) return;
    g.fillStyle = rgba(INKC, o.alpha ?? 0.9);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (o.a0 ?? 0) + (rnd(seed, i) - 0.5) * (o.spread ?? TAU), d = Rad * (0.25 + rnd(seed, i + 1) * 0.75) * ease.out(clamp(k * (0.7 + rnd(seed, i + 3) * 0.6)));
      const r = (o.size ?? 6) * (0.25 + Math.pow(rnd(seed, i + 2), 3) * 1.8);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      g.moveTo(px + r, py);
      g.arc(px, py, r, 0, TAU);
    }
    g.fill();
  }
  // 墨團：濃墨的一團，邊緣幾道往外噴的尖刺（墨滴重重落在紙上）
  function blob(x, y, r, seed, k = 1, alpha = 0.92) {
    if (k <= 0) return;
    const rr = r * ease.out(clamp(k * 1.6));
    g.fillStyle = rgba(INKC, alpha);
    g.beginPath();
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * TAU, q = rr * (0.82 + rnd(seed, i % 20) * 0.32);
      if (i) g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
      else g.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
    }
    g.fill();
    g.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = rnd(seed, i + 30) * TAU, L = rr * (1.15 + rnd(seed, i + 31) * 0.9) * ease.out(clamp(k * 1.2)), w = rr * 0.12;
      g.moveTo(x + Math.cos(a + 1.4) * w, y + Math.sin(a + 1.4) * w);
      g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
      g.lineTo(x + Math.cos(a - 1.4) * w, y + Math.sin(a - 1.4) * w);
      const tr = rr * 0.09 * (0.6 + rnd(seed, i + 32));
      g.moveTo(x + Math.cos(a) * (L + tr * 2) + tr, y + Math.sin(a) * (L + tr * 2));
      g.arc(x + Math.cos(a) * (L + tr * 2), y + Math.sin(a) * (L + tr * 2), tr, 0, TAU);
    }
    g.fill();
  }
  // 墨圈的一段弧（毛筆）：中心 (cx, cy)、半徑 rx／ry、從 a0 掃過 sweep；prog 畫到哪
  function arcStroke(cx, cy, rx, ry, a0, sweep, w, prog, seed, o = {}) {
    if (prog <= 0) return;
    const pts = [];
    for (let i = 0; i <= 96; i++) {
      const a = a0 + (sweep * i) / 96, j = 1 + Math.sin(i * 0.25 + seed) * 0.012;
      pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
    }
    dryBrush(pts, u => w * (0.2 + 0.8 * Math.sin(Math.PI * clamp(u * 1.08 + 0.04))), { seed, prog, alpha: 0.82, wash: 0.22, load: 0.85, n: 46, ...o });
  }
  // 沿著一串點拉一道墨痕（揮爪的軌跡）
  function trail(pts, w, seed, o = {}) {
    if (pts.length < 2) return;
    dryBrush(spline(pts, 6), u => w * Math.pow(u, 0.7) * (1 - Math.pow(u, 8) * 0.4), { seed, n: 24, load: 0.8, wash: 0.25, ...o });
  }
  // 乾筆：一根根筆毛各自沾墨，墨越用越少，筆毛之間露出紙（飛白）；起筆濃、收筆散開
  // W 是 u → 寬度；prog 畫到哪；load 是墨量（越小越早乾）；wash 是底下那層淡墨的濃度
  function dryBrush(S, W, o = {}) {
    const { col = INKC, alpha = 0.92, n = 40, seed = 1, prog = 1, load = 1, wash = 0.45 } = o;
    const N = S.length;
    if (N < 2 || prog <= 0 || alpha <= 0) return;
    const end = Math.max(2, Math.min(N, Math.ceil(prog * (N - 1)) + 1));
    const T = tangents(S);
    const w = j => W(j / (N - 1));
    let wmax = 0;
    for (let j = 0; j < N; j++) wmax = Math.max(wmax, w(j));
    if (wash) {
      g.fillStyle = rgba(col, wash * alpha);
      g.beginPath();
      for (let j = 0; j < end; j++) { const r = w(j) * 0.42 * (1 - 0.5 * j / (N - 1)); g.lineTo(S[j][0] - T[j][1] * r, S[j][1] + T[j][0] * r); }
      for (let j = end - 1; j >= 0; j--) { const r = w(j) * 0.42 * (1 - 0.5 * j / (N - 1)); g.lineTo(S[j][0] + T[j][1] * r, S[j][1] - T[j][0] * r); }
      g.fill();
    }
    g.lineCap = 'round';
    for (let b = 0; b < n; b++) {
      const m = (rnd(seed, b) * 2 - 1) * 0.5;
      // 這根筆毛的墨在哪裡開始不夠（外側的筆毛先乾）
      const dryAt = load * (0.35 + rnd(seed, b + 40) * 0.75) - Math.abs(m) * 0.9;
      g.strokeStyle = rgba(col, alpha * (0.35 + 0.65 * rnd(seed, b + 60)));
      g.lineWidth = Math.max(0.6, (wmax / n) * (1.2 + rnd(seed, b + 20) * 2));
      g.beginPath();
      let pen = false;
      for (let j = 0; j < end; j++) {
        const u = j / (N - 1);
        const gap = u > dryAt ? 0.3 + (u - dryAt) * 2.4 : 0.04 + Math.abs(m) * 0.12;
        if (rnd(seed + b * 7, j) < gap) { pen = false; continue; }
        const r = w(j) * (m + (rnd(seed + b, j + 300) - 0.5) * 0.06);
        const px = S[j][0] - T[j][1] * r, py = S[j][1] + T[j][0] * r;
        if (pen) g.lineTo(px, py);
        else { g.moveTo(px, py); pen = true; }
      }
      g.stroke();
    }
  }

  /* ---------- 背景 ---------- */
  // 螢幕座標的橫向重複圖層
  function layer(img, ox, oy = 0, sc = 1, a = 1, bottom = 720) {
    if (a <= 0) return;
    screen();
    g.globalAlpha = Math.min(1, a);
    g.translate(640, 360);
    g.scale(sc, sc);
    g.translate(-640, -360);
    const w = img.width;
    let x = ((ox % w) + w) % w - w;
    while (x > 640 - 640 / sc - w) x -= w;
    for (; x < 640 + 640 / sc; x += w) g.drawImage(img, x, bottom - img.height + oy);
    g.globalAlpha = 1;
  }
  // 一團霧（螢幕上的柔邊橢圓）
  const fog = (x, y, rx, ry, a, col = [236, 232, 224]) => {
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, rgba(col, a));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.fillRect(-rx, -rx, rx * 2, rx * 2);
    g.restore();
  };
  // 霧帶（螢幕座標）
  function hazeBand(y0, y1, a, col = [232, 228, 219]) {
    g.save();
    screen();
    const mb = g.createLinearGradient(0, y0, 0, y1);
    mb.addColorStop(0, rgba(col, 0));
    mb.addColorStop(0.5, rgba(col, a));
    mb.addColorStop(1, rgba(col, 0));
    g.fillStyle = mb;
    g.fillRect(-20, y0, 1320, y1 - y0);
    g.restore();
  }

  // 遠山：兩層淡墨的山脊，往下淡進霧裡，山坡上幾道乾筆皴
  const MTN = mk(2600, 420, c => paintOn(c, () => {
    for (const [row, base, amp, col, a] of [[0, 300, 170, [118, 114, 107], 0.72], [1, 370, 120, [52, 50, 47], 0.88]]) {
      const ridge = x => base - amp * Math.pow(0.5 + 0.5 * Math.sin(x * 0.0042 + row * 2.1), 1.6) * (0.65 + 0.35 * Math.sin(x * 0.013 + row * 4)) - Math.sin(x * 0.05 + row) * 6;
      const gr = c.createLinearGradient(0, base - amp, 0, 420);
      gr.addColorStop(0, rgba(col, a));
      gr.addColorStop(0.5, rgba(col, a * 0.45));
      gr.addColorStop(1, rgba(col, 0));
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(0, 420);
      for (let x = 0; x <= 2600; x += 10) c.lineTo(x, ridge(x));
      c.lineTo(2600, 420);
      c.closePath();
      c.fill();
      for (let i = 0; i < 40; i++) {
        const x = rnd(row + 40, i) * 2600, y = ridge(x) + 16 + rnd(row + 41, i) * 50;
        blot(x, y, 40 + rnd(row + 42, i) * 70, 14 + rnd(row + 43, i) * 20, row ? 0 : 3, 0.45, 0.4);
      }
    }
  }));
  // 岸邊的石頭：濃墨的石塊、淡墨的皴與受光面、往下淡進水氣；上面一叢叢草
  const rocks = (w, h, blocks, seed, grass) => mk(w, h, c => paintOn(c, () => {
    blocks.forEach(([x, y, rw, rh], bi) => {
      const path = new Path2D();
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI + (i / 16) * Math.PI, r = 1 + (rnd(seed + bi, i) - 0.5) * 0.3;
        if (i) path.lineTo(x + Math.cos(a) * rw * r, y + Math.sin(a) * rh * r);
        else path.moveTo(x + Math.cos(a) * rw * r, y + Math.sin(a) * rh * r);
      }
      path.lineTo(x + rw * 0.9, y + rh * 0.5);
      path.lineTo(x - rw * 0.9, y + rh * 0.5);
      path.closePath();
      const gr = c.createLinearGradient(0, y - rh, 0, y + rh * 0.5);
      gr.addColorStop(0, 'rgba(16,15,14,.95)');
      gr.addColorStop(0.7, 'rgba(26,25,23,.85)');
      gr.addColorStop(1, 'rgba(60,58,54,0)');
      c.fillStyle = gr;
      c.fill(path);
      c.save();
      c.clip(path);
      for (let i = 0; i < 12; i++) {
        const sx = x - rw * 0.8 + rnd(seed + bi, i + 20) * rw * 1.2, sy = y - rh * (0.4 + rnd(seed + bi, i + 21) * 0.5);
        stroke([[sx, sy], [sx + 14, sy + 16], [sx + 22, sy + 40]], [7, 5, 1], { col: [120, 116, 108], alpha: 0.35, dry: 0.7, n: 5, seed: seed * 50 + i, bleed: 0, streak: 0.3 }, 4);
      }
      c.restore();
    });
    grass.forEach(([gx, gy, n, Lg], gi) => {
      for (let i = 0; i < n; i++) {
        const x = gx + (rnd(seed + gi, i + 60) - 0.5) * 30, a = -Math.PI / 2 + (rnd(seed + gi, i + 61) - 0.5) * 1.6, L = Lg * (0.5 + rnd(seed + gi, i + 62) * 0.7);
        const bend = (rnd(seed + gi, i + 63) - 0.5) * 0.8;
        stroke([[x, gy], [x + Math.cos(a) * L * 0.5, gy + Math.sin(a) * L * 0.5], [x + Math.cos(a + bend) * L, gy + Math.sin(a + bend) * L]], [3.2, 2.2, 0.4],
          { col: [12, 12, 11], alpha: 0.9, dry: 0.3, n: 3, seed: seed * 70 + gi * 10 + i, bleed: 0, streak: 0 }, 4);
      }
    });
  }));
  const ROCKL = rocks(520, 320, [[110, 200, 120, 70], [250, 230, 110, 50], [380, 250, 90, 34]], 3, [[120, 136, 9, 46], [250, 186, 7, 38]]);
  const ROCKR = rocks(560, 300, [[300, 150, 150, 80], [460, 190, 110, 60], [150, 230, 120, 40]], 7, [[290, 76, 11, 56], [420, 134, 8, 44]]);

  // 竹林圖層：竹竿分節、節上有竹葉；不同濃淡與模糊做出景深
  const leaf = (c, x, y, a, L, Wd) => {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(L * 0.3, -Wd, L, 0);
    c.quadraticCurveTo(L * 0.4, Wd * 0.6, 0, 0);
    c.fill();
    c.restore();
  };
  // 一簇竹葉：從竹節長出的小枝，葉子細長、尖端收細、往下垂
  function leafCluster(c, x, y, w, seed, col, a = 1) {
    const sd = rnd(seed, 3) < 0.5 ? -1 : 1, k = 3 + Math.floor(rnd(seed, 4) * 4);
    const tx = x + sd * w * 2.4, ty = y + w * 0.5;
    c.strokeStyle = rgba(col, a * 0.9);
    c.lineWidth = Math.max(1, w * 0.08);
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + sd * w, y - w * 0.4, tx, ty);
    c.stroke();
    c.fillStyle = rgba(col, a);
    for (let l = 0; l < k; l++) {
      const ang = (sd > 0 ? 0.45 : Math.PI - 0.45) + sd * (l - k / 2) * 0.34 + (rnd(seed, l + 5) - 0.5) * 0.3;
      const L = w * (3.4 + rnd(seed, l + 9) * 2), Wd = L * 0.12;
      c.save();
      c.translate(tx, ty);
      c.rotate(ang);
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(L * 0.3, -Wd, L, 0);
      c.quadraticCurveTo(L * 0.35, Wd * 0.9, 0, 0);
      c.fill();
      c.restore();
    }
  }
  // 一根竹子：竿的兩緣深、中間淡，竹節是一道深色的橫筆，節上長出竹葉
  function bambooStalk(c, x, yb, yt, w, seed, col, leafK = 0.5) {
    const segs = 4 + Math.floor(rnd(seed, 1) * 3), lean = (rnd(seed, 2) - 0.5) * 24;
    for (let s2 = 0; s2 < segs; s2++) {
      const y0 = yb - ((yb - yt) * s2) / segs, y1 = yb - ((yb - yt) * (s2 + 1)) / segs + 5;
      const x0 = x + (lean * s2) / segs, x1 = x + (lean * (s2 + 1)) / segs;
      const gr = c.createLinearGradient(x0 - w / 2, 0, x0 + w / 2, 0);
      gr.addColorStop(0, rgba(col, 1));
      gr.addColorStop(0.3, rgba(col, 0.5));
      gr.addColorStop(0.65, rgba(col, 0.62));
      gr.addColorStop(1, rgba(col, 1));
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(x0 - w / 2, y0);
      c.lineTo(x1 - w * 0.47, y1);
      c.lineTo(x1 + w * 0.47, y1);
      c.lineTo(x0 + w / 2, y0);
      c.fill();
      c.fillStyle = rgba(col, 1);
      c.beginPath();
      c.ellipse(x1, y1, w * 0.6, Math.max(1.5, w * 0.09), 0, 0, TAU);
      c.fill();
      if (s2 > 0 && rnd(seed, s2 + 10) < leafK) leafCluster(c, x1, y1, w, seed * 13 + s2, col);
    }
  }
  // 竹林圖層：竹子一叢一叢（每叢兩三根），叢與叢之間留空
  const bamboo = (seed, clusters, col, blur, thick, leafK, h = 760, w = 2600) => mk(w, h, c => {
    if (blur) c.filter = `blur(${blur}px)`;
    for (let i = 0; i < clusters; i++) {
      const cx = ((i + 0.15 + rnd(seed, i) * 0.7) / clusters) * w, m = 1 + Math.floor(rnd(seed, i + 5) * 3);
      for (let j = 0; j < m; j++) {
        bambooStalk(c, cx + (j - (m - 1) / 2) * thick * (1.6 + rnd(seed, i * 7 + j) * 1.5), h + 10, -20, thick * (0.75 + rnd(seed, i * 3 + j) * 0.5), seed * 100 + i * 10 + j, col, leafK);
      }
    }
  });
  const BAM = {
    far: bamboo(3, 12, [150, 146, 140], 3, 12, 0.4),
    mid: bamboo(5, 6, [92, 89, 84], 1, 20, 0.55),
  };
  // 近景的竹子（畫面左右兩側，清楚、深色、葉子多）
  const NEAR = [0, 1].map(k => mk(420, 820, c => {
    const xs = k ? [250, 330] : [70, 170, 236];
    xs.forEach((x, i) => bambooStalk(c, x, 840, -30, 30 - i * 4, 700 + k * 10 + i, [22, 21, 20], 0.8));
  }));
  // 竹林：遠近三層竹子、地面一道淡墨、地上的霧；cx 是鏡頭的橫向位置（視差）
  function grove(cx, o = {}) {
    const { gy = 560, near = 1, blurMid = 1 } = o;
    soft(3, () => {
      layer(BAM.far, -cx * 0.15 - 300, 0, 1, 0.9, gy + 10);
      hazeBand(gy - 300, gy + 80, 0.6);
    });
    soft(blurMid ? 2 : 1, () => layer(BAM.mid, -cx * 0.35 - 700, 0, 1, 0.8, gy + 30));
    soft(4, () => hazeBand(gy - 200, gy + 60, 0.45));
    screen();
    // 地面：一道淡墨的橫刷，往下淡掉
    const gr = g.createLinearGradient(0, gy - 10, 0, gy + 160);
    gr.addColorStop(0, 'rgba(120,116,108,.3)');
    gr.addColorStop(0.2, 'rgba(160,156,148,.16)');
    gr.addColorStop(1, 'rgba(160,156,148,0)');
    g.fillStyle = gr;
    g.fillRect(-20, gy - 10, 1320, 180);
    for (let i = 0; i < 6; i++) {
      const x = ((rnd(i, 81) * 1600 - cx * 0.8) % 1600 + 1600) % 1600 - 160, y = gy + 8 + rnd(i, 82) * 120, L = 140 + rnd(i, 83) * 260;
      stroke([[x, y], [x + L * 0.5, y + (rnd(i, 84) - 0.5) * 6], [x + L, y + (rnd(i, 85) - 0.5) * 8]], [6, 4, 1], { col: [70, 68, 64], alpha: 0.25, dry: 0.7, n: 6, seed: 300 + i, bleed: 0, streak: 0.3 }, 4);
    }
    if (near) {
      screen();
      g.globalAlpha = near;
      const px = -cx * 0.9;
      g.drawImage(NEAR[0], -140 + px % 60, gy - 690, 420, 820);
      g.drawImage(NEAR[1], 1000 + px % 60, gy - 720, 420, 820);
      g.globalAlpha = 1;
    }
  }
  // 湖：遠山、湖面、岸邊的石頭與草、霧
  function lake(u, z) {
    soft(4, () => {
      view(640, 380, 1 + (z - 1) * 0.3);
      g.drawImage(MTN, -660 - u * 6, 50);
    });
    soft(2, () => {
      view(640, 380, z);
      for (let i = 0; i < 9; i++) {
        const y = 418 + i * i * 3.2, x = 120 + rnd(i, 91) * 900, L = 120 + rnd(i, 92) * 300;
        stroke([[x, y], [x + L * 0.5, y + 1], [x + L, y]], [3, 2.4, 0.6], { col: [90, 87, 82], alpha: 0.28, dry: 0.6, n: 4, seed: 400 + i, bleed: 0, streak: 0.3 }, 4);
      }
      g.drawImage(ROCKL, -30, 290);
      fog(160, 560, 260, 60, 0.7, [150, 146, 140]);
    });
    view(640, 380, z * 1.04);
    g.drawImage(ROCKR, 840, 470, 520, 278);
  }

  /* ---------- 鏡頭 ---------- */
  const T_STEP = 1.1, T_EMERGE = 2.17, T_EYE = 6.08, T_STALK = 6.58, T_POUNCE = 7.5, T_CHASE = 8.05, T_EYE2 = 10.08, T_RISE = 10.75, T_ENSO = 10.95, T_CUP = 11.67, T_SIT = 13.42;

  // 霧中的湖面：一隻黑貓的影子從霧裡慢慢走來
  function sMist(u, t) {
    const z = 1 + u * 0.05;
    lake(u, z);
    // 遠遠走來的貓：模糊、半透明，被霧蓋住
    soft(3, () => {
      view(640, 380, z);
      FURA = 0.6;
      at(634, 424, 0.27 + u * 0.04, () => catFront(walkF(t, 0.8), { t, detail: 0.3, head: { glow: 0, whisk: 0 } }));
      FURA = 1;
      fog(640, 380, 420, 120, 0.35);
    });
    soft(4, () => {
      layer(MIST, -u * 40, 0, 1, 0.8, 560);
      layer(MIST, 300 + u * 30, 0, 1.3, 0.5, 700);
    });
  }
  // 腳掌落地：低角度的特寫，墨一圈圈漾開
  function sStep(u, t) {
    const hit = 0.42;
    if (u > hit && u < hit + 0.12) shake(t, 5 * (1 - (u - hit) / 0.12));
    view(640, 360, 1 + u * 0.03);
    soft(4, () => {
      screen();
      hazeBand(40, 320, 0.6, [210, 206, 198]);
      fog(300, 120, 300, 120, 0.4, [120, 116, 110]);
    });
    // 遠的那隻腳（景深外）
    soft(3, () => { view(640, 360, 1 + u * 0.03); PASS = 0; bigLeg(1010, 470, 0.62, 0, 61); });
    // 落地時的一灘墨（流體的漣漪在底下）
    view(640, 360, 1 + u * 0.03);
    const k = inv(hit, hit + 0.3, u);
    if (k > 0) {
      g.save();
      g.translate(600, 612);
      g.scale(1, 0.32);
      splatter(0, 0, 26, 460, k, 19, { size: 10 });
      g.restore();
    }
    // 近的腳：從上方落下
    const lift = u < hit ? 260 * Math.pow(1 - u / hit, 2) : -Math.sin(Math.min(1, (u - hit) / 0.2) * Math.PI) * 8;
    drawCat(() => bigLeg(600, 640, 1, lift, 41, { claws: clamp((u - hit + 0.05) * 6) }));
  }
  // 走出霧：正面走近、眼睛亮起、停下；墨圈在身邊捲開，白蝴蝶飛來
  const butterEmerge = (u, t) => {
    const k = ease.out(inv(2.5, 3.3, u)), f = flit(t, 1, 1);
    return [lerp(1180, 930, k) + f[0], lerp(160, 250, k) + f[1] + Math.sin(u * 1.4) * 10];
  };
  function sEmerge(u, t) {
    const walk = inv(0, 1.9, u), kz = ease.out(walk), stop = ease.io(inv(1.6, 2.1, u));
    const s = lerp(0.95, 1.72, kz), eyeY = lerp(330, 262, kz);
    const P0 = walkF(t, 1 - stop), P = idleF(stop > 0 ? mix(P0, FPOSE.walk, stop) : P0, t, 0.6 + stop * 0.6);
    const lit = ease.out(inv(0.48, 0.85, u)), b = butterEmerge(u, t);
    const lookK = ease.io(inv(3.0, 3.4, u));
    screen();
    hazeBand(380, 760, 0.35, [200, 196, 188]);
    // 墨圈（在貓的後面）：左右兩道弧，弧上的墨團與噴出的墨點
    const e0 = 2.2;
    view(640, 360, 1 + Math.max(0, u - 2) * 0.02);
    arcStroke(640, 360, 380, 340, Math.PI * 0.6, Math.PI * 0.74, 30, ease.out(inv(e0, e0 + 0.6, u)), 5);
    arcStroke(640, 360, 380, 340, -Math.PI * 0.36, Math.PI * 0.74, 30, ease.out(inv(e0 + 0.15, e0 + 0.75, u)), 6);
    blob(318, 560, 34, 3, inv(e0 + 0.35, e0 + 0.6, u));
    blob(286, 228, 22, 4, inv(e0 + 0.2, e0 + 0.45, u));
    blob(990, 470, 30, 5, inv(e0 + 0.55, e0 + 0.8, u));
    blob(930, 150, 20, 6, inv(e0 + 0.45, e0 + 0.7, u));
    splatter(640, 360, 40, 460, inv(e0 + 0.3, e0 + 1.1, u), 8, { size: 5 });
    // 貓
    screen();
    drawCat(() => at(640, eyeY - P.head[1] * s, s, () => catFront(P, { t, detail: 0.7 + s * 0.5, head: { pupil: 0.12 + lookK * 0.1, glare: 0.8, glow: lit, look: [0.75 * lookK, -0.25 * lookK], yaw: 0.14 * lookK, lit } })));
    front();
    butterfly(b[0], b[1], 0.42, t, { rot: -0.3 + Math.sin(t * 2) * 0.3, alpha: inv(2.45, 2.7, u) });
  }
  // 眼睛的大特寫
  function sEye(u, t) {
    bigEye({ pupil: lerp(0.08, 0.3, ease.io(inv(0.15, 0.4, u))), look: [0.2, -0.1], z: 1 + u * 0.08, t });
  }
  // 竹林：伏低、搖屁股，盯著左邊的蝴蝶
  function sStalk(u, t) {
    const cam = u * 20;
    grove(cam, { gy: 610 });
    view(640 + cam, 360, 1 + u * 0.04);
    const k = ease.io(inv(0.1, 0.55, u)), wig = inv(0.5, 0.65, u) * Math.sin(t * 24) * 6;
    const P = mix(SPOSE.stand, SPOSE.crouch, k);
    P.hip = [P.hip[0] + wig, P.hip[1] + Math.abs(wig) * 0.5];
    P.bN = P.bN.map((p, i) => (i < 2 ? [p[0] + wig, p[1]] : p));
    P.tail = P.tail.map((p, i) => [p[0] + Math.sin(t * 3 - i * 0.7) * i * 6, p[1] + Math.cos(t * 3 - i * 0.7) * i * 3]);
    drawCat(() => catSide(P, { x: 1000, y: 612, s: 0.86, flip: true, t, detail: 1.2, head: { yaw: 0.3, pupil: 0.35, look: [0.5, -0.5] } }));
    front();
    const f = flit(t, 1, 2);
    butterfly(lerp(420, 500, u) + f[0], 250 + f[1], 0.5, t, { rot: 0.4 });
  }
  // 撲向鏡頭：身體拉長飛過畫面，爪子帶出一道墨弧
  const pounceO = u => ({ x: lerp(820, 700, u), y: lerp(700, 680, u), s: 1.28, flip: true });
  function sPounce(u, t) {
    POST.blur = [-30 * (1 - u), 0];
    screen();
    layer(BAM.far, -300 - u * 200, 0, 1.4, 0.35, 420);
    hazeBand(300, 760, 0.3, [190, 186, 178]);
    const o = pounceO(u), P = SPOSE.leap;
    // 揮爪的墨弧（在貓的後面）
    const arc = [];
    for (let i = 0; i <= 10; i++) { const q = clamp(u - 0.2 + i * 0.03); const p = pawAt(P, pounceO(q)); arc.push([p[0] - 30 - (1 - i / 10) * 160 * Math.sin(i / 10 * 3), p[1] - 90 + Math.pow(i / 10, 2) * 80]); }
    view(640, 360, 1);
    arcStroke(470, 330, 230, 230, Math.PI * 1.05, -Math.PI * 0.55, 30, ease.out(inv(0, 0.5, u)), 11);
    splatter(380, 330, 30, 360, inv(0.1, 0.7, u), 12, { size: 6, a0: Math.PI, spread: 2.6 });
    drawCat(() => catSide(P, { ...o, t, pads: 1, head: { yaw: 0.12, pupil: 0.6, glare: 0.9 } }));
    front();
    const f = flit(t, 0.6, 3);
    butterfly(lerp(180, 120, u) + f[0], lerp(90, 50, u) + f[1], 0.42, t, { rot: -0.5, flapHz: 8 });
  }
  // 追逐：落地、轉身、揮爪、閃白後一記大撲、落地、站起來去抓
  const CH = [
    [0.0, 'land', -1, 760], [0.3, 'gather', -1, 730], [0.5, 'gather', 1, 700], [0.7, 'swipe', 1, 790], [0.88, 'land', 1, 880],
    [1.15, 'gather', 1, 900], [1.37, 'leap', 1, 1000], [1.55, 'swipe', 1, 1110], [1.72, 'land', 1, 1180], [1.88, 'stand', 1, 1200], [2.03, 'rear', 1, 1210],
  ];
  const chaseAt = u => {
    let i = 0;
    while (i < CH.length - 2 && CH[i + 1][0] <= u) i++;
    const a = CH[i], b = CH[i + 1], k = ease.io(clamp((u - a[0]) / (b[0] - a[0])));
    const P = mix(SPOSE[a[1]], SPOSE[b[1]], k);
    const face = lerp(a[2], b[2], k);
    return { P, x: lerp(a[3], b[3], k), face };
  };
  function sChase(u, t) {
    const c = chaseAt(u), camX = lerp(c.x - 640, chaseAt(Math.max(0, u - 0.15)).x - 640, 0.5) - 60;
    const fast = Math.abs(c.x - chaseAt(Math.max(0, u - 0.03)).x) / 0.03;
    POST.blur = [-Math.min(40, fast * 0.05), 0];
    grove(camX + 900, { gy: 660, near: 0.6 });
    view(640 + camX, 360, 1);
    const o = { x: c.x, y: 660, s: 0.98, flip: c.face < 0, sx: Math.max(0.08, Math.abs(c.face)) };
    // 揮爪：胸前一道弧形的墨痕，揮完慢慢淡掉
    for (const [u0, u1, sd] of [[0.55, 0.8, 21], [1.35, 1.6, 22]]) {
      if (u < u0 || u > u1 + 0.3) continue;
      const cc = chaseAt(u1), dir = cc.face < 0 ? -1 : 1, cx = cc.x + dir * 80, cy = 660 - 200;
      g.globalAlpha = 1 - inv(u1, u1 + 0.3, u);
      arcStroke(cx, cy, 250, 230, dir > 0 ? -1.5 : Math.PI + 1.5, dir * 2.1, 34, ease.out(inv(u0, u1, u)), sd, { load: 0.7 });
      splatter(cx + dir * 240, cy + 80, 14, 160, inv(u1 - 0.05, u1 + 0.2, u), sd + 5, { size: 5, a0: dir > 0 ? 0.3 : Math.PI - 0.3, spread: 1.6 });
      g.globalAlpha = 1;
    }
    // 落地踢起的墨點
    for (const [ul, sd] of [[0.02, 31], [0.88, 32], [1.72, 33]]) {
      const k = inv(ul, ul + 0.25, u);
      if (k > 0 && k < 1) {
        const cc = chaseAt(ul);
        g.globalAlpha = 1 - k;
        splatter(cc.x + 80, 660, 18, 180, k, sd, { size: 6, a0: -Math.PI / 2, spread: 2.2 });
        g.globalAlpha = 1;
      }
    }
    drawCat(() => catSide(c.P, { ...o, t, detail: 1.2, head: { yaw: 0.4, pupil: 0.55, glare: 0.9, look: [0.6, -0.4] } }));
    front();
    const f = flit(t, 1, 4), bx = c.x + 330 + Math.sin(u * 3) * 40, by = lerp(220, 120, inv(1.7, 2.03, u)) + Math.sin(u * 5) * 30;
    butterfly(bx + f[0], by + f[1], 0.5, t, { rot: 0.3, flapHz: 8 });
  }
  function sEye2(u, t) {
    shake(t, 1.5);
    bigEye({ pupil: lerp(0.45, 0.85, ease.out(inv(0, 0.35, u))), look: [0, -0.3], z: 1.06 + u * 0.05, t });
  }
  // 往上一躍：舉起雙爪
  function sRise(u, t) {
    POST.blur = [0, 30];
    screen();
    hazeBand(200, 760, 0.3, [200, 196, 188]);
    const s = 0.82, y = lerp(1000, 780, ease.out(u));
    drawCat(() => at(640, y, s, () => catFront(FPOSE.reach, { t, pawR: 42, head: { pitch: 0.6, pupil: 0.8, look: [0, -0.8] } })));
    front();
    butterfly(640 + Math.sin(t * 4) * 10, 110, 0.5, t, { flapHz: 9 });
  }
  // 墨圈裡合攏雙爪
  function sEnso(u, t) {
    const z = 1 + u * 0.05;
    view(640, 400, z);
    const pr = ease.out(inv(0, 0.4, u));
    arcStroke(640, 410, 340, 330, -Math.PI * 0.28, -Math.PI * 1.72, 40, pr, 41, { load: 1.1, wash: 0.3 });
    [[340, 250, 46, 1, 0.1], [960, 480, 40, 2, 0.25], [420, 690, 34, 3, 0.35], [880, 150, 24, 4, 0.18]].forEach(([x, y, r, sd, d]) => blob(x, y, r, sd + 40, inv(d, d + 0.2, u)));
    splatter(640, 410, 60, 520, inv(0.15, 0.6, u), 44, { size: 6 });
    const close = ease.io(inv(0, 0.5, u)), P = mix(FPOSE.reach, FPOSE.reach, 0);
    P.armL = P.armL.map((p, i) => (i === 2 ? [lerp(-70, -30, close), p[1]] : p));
    P.armR = P.armR.map((p, i) => (i === 2 ? [lerp(70, 30, close), p[1]] : p));
    drawCat(() => at(640, 1110, 1.12, () => catFront(P, { t, detail: 1.3, pawR: 44, head: { pitch: 0.55, pupil: 0.75, look: [0, -0.8] } })));
    front();
    butterfly(640, 1110 - 1.12 * 830, 0.5, t, { flapHz: 4, glow: 1.2 });
  }
  // 臉的特寫：雙爪合起，蝴蝶從爪縫溜出來，從臉前飛走；眼睛跟著牠
  const butterCup = u => {
    const k1 = ease.out(inv(0.12, 0.55, u)), k2 = ease.io(inv(0.55, 1.2, u)), k3 = ease.in(inv(1.2, 1.75, u));
    let x = lerp(640, 600, k1), y = lerp(650, 520, k1);
    x = lerp(x, 470, k2);
    y = lerp(y, 430, k2);
    x = lerp(x, 60, k3);
    y = lerp(y, 400, k3);
    return [x, y];
  };
  function sCup(u, t) {
    const z = 1 + u * 0.03;
    view(640, 360, z);
    const b = butterCup(u), f = flit(t, 0.6, 5), bx = b[0] + f[0], by = b[1] + f[1];
    const hx = 640, hy = 300, hs = 2.15;
    const look = [clamp((bx - hx) / 420, -1, 1), clamp((by - hy) / 300, -1, 1)];
    drawCat(() => {
      at(hx, hy, hs, () => catHead({ t, detail: 2.2, pupil: 0.3, glare: lerp(0.6, 1, inv(0.6, 1.2, u)), look, whisk: 1.1 }));
      // 合起的雙爪（下方）：前臂從畫面下緣伸上來，趾頭往中間彎，爪子細細地勾出來
      for (const sd of [-1, 1]) {
        const open = ease.out(inv(0.05, 0.4, u)) * 26;
        at(640 + sd * (190 + open), 690, 1, () => {
          const S = spline([[sd * 150, 260], [sd * 70, 130], [sd * 10, 30]], 6), Rr = along([130, 112, 96], 6, S.length);
          furTube(S, Rr, { n: 560, dir: 1, fan: 0.4, len: 50, wid: 18, seed: 90 + sd, edge: 0.4, bend: 0.28, tone: (s2, v) => 1.4 + (v * sd > 0 ? 1 : 0), core: 1, wash: 3 });
          furDisc(-sd * 10, -6, 120, 84, { n: 360, F: [sd * 60, 80], len: 34, wid: 14, seed: 93 + sd, edge: 0.4, bend: 0.25, tone: (lx, ly) => 1.6 + (ly < -0.3 ? 1 : 0), core: 1 });
          for (let i = 0; i < 4; i++) {
            const a = -Math.PI / 2 - sd * (0.3 + i * 0.36), tx = -sd * 20 + Math.cos(a) * 92, ty = -10 + Math.sin(a) * 76;
            furDisc(tx, ty, 34, 38, { n: 90, F: [tx * 0.4 - sd * 10, ty * 0.4 + 30], len: 24, wid: 11, seed: 95 + i + sd * 7, edge: 0.35, tone: (lx, ly) => 2 + (ly < 0 ? 1.2 : -0.4), core: 1 });
            if (PASS === 1 && i < 3) {
              const cx = tx + Math.cos(a) * 26, cy = ty + Math.sin(a) * 26;
              g.strokeStyle = 'rgba(190,184,172,.85)';
              g.lineWidth = 3;
              g.beginPath();
              g.moveTo(cx, cy);
              g.quadraticCurveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, cx + Math.cos(a - sd * 1.2) * 18, cy + Math.sin(a - sd * 1.2) * 18);
              g.stroke();
            }
          }
        });
      }
    });
    front();
    butterfly(bx, by, 0.75, t, { rot: lerp(0, -1.2, inv(1.1, 1.4, u)), flapHz: 5, glow: 1.1 });
  }
  // 竹林裡坐下：蝴蝶繞一圈，停在牠頭上
  const butterSit = u => {
    if (u < 1) {
      const k = ease.io(u);
      return [lerp(360, 640, k) + Math.sin(k * Math.PI) * -60, lerp(260, 0, k) + Math.sin(k * Math.PI * 1.5) * 50];
    }
    return [640, 0];
  };
  function sSit(u, t) {
    grove(0, { gy: 640, near: 0.8 });
    const s = 0.5, P = idleF(FPOSE.sit, t, 1.2);
    const headY = 640 + (P.head[1] - 150) * s;
    const look = ease.io(inv(0.95, 1.15, u));
    view(640, 360, 1 + u * 0.03);
    drawCat(() => at(640, 640, s, () => catFront(P, { t, head: { pupil: 0.25, glare: 0.75, look: [0, -0.7 * look], ears: 0.1 * look } })));
    front();
    const b = butterSit(u), land = u >= 1;
    const f = land ? [0, 0] : flit(t, 0.8, 6);
    butterfly(b[0] + f[0], (land ? headY : headY + b[1] * 1) + f[1], 0.4, t, { flapHz: land ? 1.2 : 7, open: land ? 0.6 + 0.4 * Math.sin(t * 2) : null, rot: land ? 0 : 0.3 });
  }

  const SHOTS = [
    [0, sMist], [T_STEP, sStep], [T_EMERGE, sEmerge], [T_EYE, sEye], [T_STALK, sStalk], [T_POUNCE, sPounce],
    [T_CHASE, sChase], [T_EYE2, sEye2], [T_RISE, sRise], [T_ENSO, sEnso], [T_CUP, sCup], [T_SIT, sSit],
  ];
  let POST = {};
  const POST0 = { con: 1.04, vig: 0.24, grain: 0.03, inv: 0, flash: 0, fade: 0, blur: null, zoom: null, wipe: null, bleedB: 0.22, bleedF: 0.1, granB: 0.04, granF: 0.05, warp: 0.8, tint: [0.94, 0.94, 0.965], wcol: [0.9, 0.886, 0.85] };

  /* ---------- 剪接點上的效果（後製參數） ---------- */
  const FX = [
    [0, 0.45, k => { POST.fade = 1 - ease.out(k); }],
    [T_POUNCE, 0.08, k => { POST.flash = 0.6 * (1 - k); }],
    [9.42, 0.14, k => { POST.flash = 1 - k * k; }],
    [T_RISE, 0.06, k => { POST.flash = 0.4 * (1 - k); }],
    [14.7, 0.31, k => { POST.fade = ease.s(clamp(k / 0.97)); }],
  ];

  /* ---------- 流體墨的編排 ---------- */
  // 每一刀重新開始；每一步呼叫一次 (u0, u1)：在這一步注入墨、霧與水流（u0～u1 是這一刀裡的時間）
  const on = (u0, u1, x) => u0 <= x && x < u1;
  function inkRing(x, y, rx, ry, amt, w, seed, white = 0) {
    const n = Math.round(rx / 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd(seed, i) * 0.2, k = 0.9 + rnd(seed, i + 40) * 0.2;
      INK.dye(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k, w * (0.7 + rnd(seed, i + 80) * 0.6), amt * (0.6 + rnd(seed, i + 120) * 0.8), [1, rx / ry], white);
    }
  }
  const inkMist = u0 => {
    // 湖面上飄的霧
    [[180, 470], [640, 430], [1100, 480], [400, 560]].forEach(([x, y], i) => {
      if (u0 < 0.02) INK.white(x, y, 120, 0.5, [1, 2.6]);
      INK.white(x + u0 * 30, y, 70, 0.006, [1, 2.4]);
      INK.push(x, y, 140, i % 2 ? 50 : -40, -3, [1, 2]);
    });
  };
  const inkStep = (u0, u1) => {
    // 腳掌落地：墨往外炸開，接著一圈圈漣漪（地面透視壓扁）
    const hit = 0.42;
    if (on(u0, u1, hit)) {
      INK.dye(600, 615, 70, 2.6, [1, 3]);
      INK.radial(600, 615, 110, 2400, [1, 3]);
    }
    [[hit + 0.12, 260, 80], [hit + 0.3, 400, 120], [hit + 0.5, 540, 160]].forEach(([x, rx, ry], i) => {
      if (!on(u0, u1, x)) return;
      inkRing(600, 615, rx, ry, 0.5 - i * 0.1, 16, 7 + i);
      INK.radial(600, 615, rx * 0.8, 500, [1, rx / ry]);
    });
  };
  const inkFog = (u0, u1) => {
    // 一開始濃霧蓋住，風把霧往兩邊吹開；之後墨圈上的墨團慢慢暈開
    if (on(u0, u1, 0)) {
      for (let i = 0; i < 16; i++) INK.white(260 + (i % 4) * 250 + rnd(i, 1) * 80, 120 + Math.floor(i / 4) * 170 + rnd(i, 2) * 60, 170, 1.3);
    }
    if (u0 < 1.6) {
      INK.push(500, 380, 220, -120, -20);
      INK.push(800, 380, 220, 120, -20);
    }
    const e0 = 2.2;
    [[318, 560, e0 + 0.35], [286, 228, e0 + 0.2], [990, 470, e0 + 0.55], [930, 150, e0 + 0.45]].forEach(([x, y, at2], i) => {
      if (on(u0, u1, at2 + 0.1)) {
        INK.dye(x, y, 26 - i * 2, 1.2);
        INK.radial(x, y, 40, 300);
      }
    });
  };
  const inkGrove = u0 => {
    [[200, 600], [700, 620], [1150, 590]].forEach(([x, y], i) => {
      if (u0 < 0.02) INK.white(x, y, 160, 0.35, [1, 3]);
      INK.push(x, y, 160, i % 2 ? 30 : -24, -2, [1, 3]);
    });
  };
  const inkPounce = (u0, u1) => {
    if (on(u0, u1, 0.12)) {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (0.8 + i * 0.1), x = 470 + Math.cos(a) * 230, y = 330 + Math.sin(a) * 230;
        INK.dye(x, y, 18, 1.2);
        INK.push(x, y, 40, Math.cos(a) * 600, Math.sin(a) * 600);
      }
    }
  };
  const inkEnso = (u0, u1) => {
    // 墨圈畫過的地方墨滲開；墨團暈開
    const p0 = ease.out(inv(0, 0.4, u0)), p1 = ease.out(inv(0, 0.4, u1));
    if (p1 > p0) {
      for (let k = 0; k < 2; k++) {
        const a = -Math.PI * 0.28 - Math.PI * 1.72 * lerp(p0, p1, k / 2);
        INK.dye(640 + Math.cos(a) * 340, 410 + Math.sin(a) * 330, 16, 0.35);
      }
    }
    [[340, 250, 0.1], [960, 480, 0.25], [420, 690, 0.35], [880, 150, 0.18]].forEach(([x, y, d]) => {
      if (on(u0, u1, d + 0.05)) { INK.dye(x, y, 30, 1.4); INK.radial(x, y, 50, 400); }
    });
  };
  const INKSEG = [
    [0, inkMist, { curl: 10, vd: 0.99, dd: 0.998, ddw: 0.996, turb: 40 }],
    [T_STEP, inkStep, { curl: 22, vd: 0.985, dd: 0.999 }],
    [T_EMERGE, inkFog, { curl: 18, vd: 0.99, dd: 0.999, ddw: 0.972, turb: 120 }],
    [T_EYE, null],
    [T_STALK, inkGrove, { curl: 10, turb: 30, ddw: 0.995 }],
    [T_POUNCE, inkPounce, { curl: 30, vd: 0.98 }],
    [T_CHASE, null],
    [T_ENSO, inkEnso, { curl: 26, vd: 0.985, turb: 60 }],
    [T_CUP, null],
    [T_SIT, inkGrove, { curl: 10, turb: 30, ddw: 0.995 }],
  ];
  // 把流體推進到時間 t：同一刀裡往前就接著算；換刀或往回跳就從這一刀開頭重算
  const STEP = 1 / 60;
  let segI = -1, segN = 0;
  function syncInk(t) {
    let i = INKSEG.length - 1;
    while (i > 0 && INKSEG[i][0] > t) i--;
    const [t0, fn, prm = {}] = INKSEG[i];
    const target = Math.max(0, Math.floor((t - t0) / STEP + 1e-6));
    if (i !== segI || target < segN) {
      INK.reset();
      segI = i;
      segN = 0;
    }
    while (segN < target) {
      const u0 = segN * STEP;
      if (fn) fn(u0, u0 + STEP);
      INK.step(STEP * (prm.rate || 1), prm);
      segN++;
    }
  }

  // 霧的貼圖：一團團柔邊的白霧
  const MIST = mk(2400, 360, c => {
    for (let i = 0; i < 90; i++) {
      const x = rnd(i, 61) * 2400, y = 90 + rnd(i, 62) * 200, rx = 120 + rnd(i, 63) * 260, ry = 26 + rnd(i, 64) * 60;
      for (const xx of [x, x - 2400, x + 2400]) {
        c.save();
        c.translate(xx, y);
        c.scale(1, ry / rx);
        const gr = c.createRadialGradient(0, 0, 0, 0, 0, rx);
        gr.addColorStop(0, `rgba(238,235,228,${0.22 + rnd(i, 65) * 0.25})`);
        gr.addColorStop(1, 'rgba(238,235,228,0)');
        c.fillStyle = gr;
        c.fillRect(-rx, -rx, rx * 2, rx * 2);
        c.restore();
      }
    }
  });
  // 沒有 WebGL2 時用的宣紙
  const PAPER = INK ? null : mk(1280, 720, c => {
    c.fillStyle = '#dcd7cc';
    c.fillRect(0, 0, 1280, 720);
    for (let i = 0; i < 60; i++) {
      const x = rnd(i, 1) * 1280, y = rnd(i, 2) * 720, r = 80 + rnd(i, 3) * 260;
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rnd(i, 4) < 0.5 ? 'rgba(120,100,70,.05)' : 'rgba(255,252,240,.07)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const v = c.createRadialGradient(640, 360, 300, 640, 360, 820);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(40,36,30,.25)');
    c.fillStyle = v;
    c.fillRect(0, 0, 1280, 720);
  });

  function render(t) {
    lastT = t;
    let i = SHOTS.length - 1;
    while (i > 0 && SHOTS[i][0] > t) i--;
    if (INK) syncInk(t);
    SX = SY = 0;
    RS = R;
    FURA = 1;
    PASS = 0;
    POST = { ...POST0 };
    for (const c of [gB, gF]) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, c.canvas.width, c.canvas.height);
      c.lineCap = 'round';
      c.lineJoin = 'round';
    }
    g = gB;
    SHOTS[i][1](t - SHOTS[i][0], t);
    for (const [c, d, fx] of FX) {
      if (t >= c && t < c + d) fx((t - c) / d);
    }
    if (t >= END - 0.01) POST.fade = 1;
    if (INK) {
      INK.render(cvB, cvF, { ...POST, time: t });
      return;
    }
    // 2D 版本：宣紙 + 背景 + 前景；閃白、淡出用一層顏色蓋上
    go.setTransform(1, 0, 0, 1, 0, 0);
    go.globalAlpha = 1;
    go.drawImage(PAPER, 0, 0, OUT.width, OUT.height);
    go.drawImage(cvB, 0, 0);
    go.drawImage(cvF, 0, 0);
    if (POST.flash) {
      go.globalAlpha = POST.flash;
      go.fillStyle = '#f4f1ea';
      go.fillRect(0, 0, OUT.width, OUT.height);
    }
    if (POST.fade) {
      go.globalAlpha = POST.fade;
      go.fillStyle = '#000';
      go.fillRect(0, 0, OUT.width, OUT.height);
    }
    go.globalAlpha = 1;
  }

  // 解析度跟著播放器在螢幕上的實際像素（全螢幕時更清楚）；水墨版上限 1.6 倍，2D 版 1.25 倍
  const frame = $('.tr-frame', root);
  new ResizeObserver(() => {
    const k = Math.min(frame.clientWidth / 1280, frame.clientHeight / 720) || 1;
    const r = Math.round(Math.min(INK ? 1.6 : 1.25, Math.max(0.5, k * (window.devicePixelRatio || 1))) * 20) / 20;
    if (r === R) return;
    R = r;
    for (const c of [cvB, cvF, ...(INK ? [] : [OUT])]) {
      c.width = Math.round(1280 * R);
      c.height = Math.round(720 * R);
    }
    render(lastT);
  }).observe(frame);

  const CHAPTERS = [
    { at: 0, name: '現身', caption: '霧裡的湖面，一隻長毛黑貓慢慢走近；腳掌落下，墨一圈圈漾開。' },
    { at: T_EMERGE, name: '凝視', caption: '從霧裡走出來，橙色的眼睛亮起，墨圈在身邊捲開；一隻發光的白蝴蝶飛過。' },
    { at: T_STALK, name: '撲蝶', caption: '竹林裡伏低、撲向鏡頭，追著蝴蝶又撲又抓。' },
    { at: T_RISE, name: '落空', caption: '雙爪在墨圈裡合攏，蝴蝶卻從爪縫溜走，最後停在牠頭上。' },
  ];

  if (!G || !window.MGPlayer) {
    render(4.6);
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
