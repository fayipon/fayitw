/* =========================================================
   貓抓蝴蝶（cat.html）：水墨短片
   黑煙色緬因貓與發光的白蝴蝶，16 秒：霧中登場 → 墨圈 → 撲擊 → 躍起 → 捧蝶
   - 整支片畫在一張 canvas 上：貓有正面與側面兩套畫法（骨架 + 一束束的毛，
     黑色毛尖下透出銀灰底毛），筆觸、墨點、墨圈、竹林、遠山、霧、宣紙紋理都是程式產生
   - GSAP 時間軸只當時鐘；每一格只依時間 t 計算，拖回去重看一致
   - 依分鏡要求，畫面裡不放文字、UI、標誌
   - 網址加 #t=秒數 會停在那一格（檢查分鏡用）
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
  // 姿勢混合：數字、陣列、物件逐項內插
  const mix = (a, b, k) => {
    if (typeof a === 'number') return lerp(a, b, k);
    if (Array.isArray(a)) return a.map((v, i) => mix(v, b[i], k));
    const o = {};
    for (const key in a) o[key] = key in b ? mix(a[key], b[key], k) : a[key];
    return o;
  };

  const END = 16;
  const INK = [11, 11, 11];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  mg.classList.add('inkfilm');
  mg.innerHTML = '<canvas width="1280" height="720"></canvas>';
  const cv = $('canvas', mg);
  const g = cv.getContext('2d');
  let R = 1;
  let lastT = 0;

  const mk = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'));
    return c;
  };

  /* ---------- 曲線與筆觸 ---------- */

  // Catmull-Rom：通過每個控制點的平滑曲線
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
  const arcPts = (cx, cy, r, a0, a1, n = 40, wob = 0, seed = 1) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n), rr = r * (1 + wob * Math.sin(a * 3 + seed) + wob * 0.5 * Math.sin(a * 7 + seed * 2));
      out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return out;
  };

  // 毛筆：濕的墨芯 + 暈開的邊 + 一根根筆毛，尾端乾筆飛白；prog 控制畫到哪裡
  function brush(c, S, o) {
    const { w, prog = 1, col = INK, n = 16, dry = 0.35, seed = 1, taper = [0.12, 0.4], alpha = 1, bleed = 0.16, wob = 0.15 } = o;
    if (prog <= 0 || S.length < 2) return;
    const N = S.length;
    const end = Math.min(N, Math.max(2, Math.ceil(prog * (N - 1)) + 1));
    const T = tangents(S);
    const W = j => {
      const u = j / (N - 1);
      let k = 1;
      if (u < taper[0]) k = 0.35 + 0.65 * Math.sin((u / taper[0]) * Math.PI / 2);
      if (u > 1 - taper[1]) k *= Math.max(0.04, (1 - u) / taper[1]);
      return w * k * (1 - wob + wob * Math.sin(u * 11 + seed));
    };
    const side = (j, m) => [S[j][0] - T[j][1] * W(j) * m, S[j][1] + T[j][0] * W(j) * m];
    const poly = (m, until) => {
      c.beginPath();
      for (let j = 0; j < until; j++) { const p = side(j, m); if (j) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
      for (let j = until - 1; j >= 0; j--) { const p = side(j, -m); c.lineTo(p[0], p[1]); }
      c.fill();
    };
    const coreEnd = Math.max(2, Math.min(end, Math.floor((N - 1) * (1 - dry * 0.8)) + 1));
    if (bleed) { c.fillStyle = rgba(col, bleed * alpha); poly(0.62, end); }
    c.fillStyle = rgba(col, alpha);
    poly(0.4, coreEnd);
    c.strokeStyle = rgba(col, alpha * 0.92);
    c.lineCap = 'round';
    for (let b = 0; b < n; b++) {
      const m = (rnd(seed, b) * 2 - 1) * 0.5;
      const cut = 1 - dry * (0.25 + 0.75 * rnd(seed, b + 40));
      c.lineWidth = Math.max(0.6, (w / n) * (0.8 + 1.6 * rnd(seed, b + 80)));
      c.beginPath();
      let pen = false;
      for (let j = 0; j < end; j++) {
        const u = j / (N - 1);
        if (u > cut && rnd(seed + b * 13, j >> 1) < 0.35 + (u - cut) * 2.2) { pen = false; continue; }
        const p = side(j, m);
        if (pen) c.lineTo(p[0], p[1]);
        else { c.moveTo(p[0], p[1]); pen = true; }
      }
      c.stroke();
    }
  }

  /* ---------- 預先畫好的素材：宣紙、竹林、遠山、墨點、底片顆粒 ---------- */

  const PAPER = mk(1280, 720, c => {
    c.fillStyle = '#ebe4d3';
    c.fillRect(0, 0, 1280, 720);
    for (let i = 0; i < 60; i++) {
      const x = rnd(i, 1) * 1280, y = rnd(i, 2) * 720, r = 80 + rnd(i, 3) * 260;
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rnd(i, 4) < 0.5 ? 'rgba(120,100,70,.05)' : 'rgba(255,252,240,.07)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.lineCap = 'round';
    for (let i = 0; i < 1400; i++) {
      const x = rnd(i, 5) * 1280, y = rnd(i, 6) * 720, a = rnd(i, 7) * Math.PI, l = 6 + rnd(i, 8) * 26;
      c.strokeStyle = rnd(i, 9) < 0.55 ? `rgba(90,80,60,${0.04 + rnd(i, 10) * 0.07})` : `rgba(255,255,250,${0.1 + rnd(i, 10) * 0.12})`;
      c.lineWidth = 0.5 + rnd(i, 11) * 0.8;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.stroke();
    }
    const im = c.getImageData(0, 0, 1280, 720), d = im.data;
    let s = 99;
    for (let i = 0; i < d.length; i += 4) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const v = ((s >>> 24) - 128) / 20;
      d[i] += v; d[i + 1] += v; d[i + 2] += v;
    }
    c.putImageData(im, 0, 0);
    const v = c.createRadialGradient(640, 360, 280, 640, 360, 820);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(60,45,25,.3)');
    c.fillStyle = v;
    c.fillRect(0, 0, 1280, 720);
  });

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
  // 竹林圖層：竹竿分節、節上有竹葉；三層不同濃淡與模糊做出景深
  const bamboo = (seed, n, col, blur, thick, leafK, h = 880) => mk(2800, h, c => {
    if (blur) c.filter = `blur(${blur}px)`;
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.2 + rnd(seed, i) * 0.6) / n) * 2800;
      const lean = (rnd(seed, i + 50) - 0.5) * 60;
      const tk = thick * (0.7 + rnd(seed, i + 9) * 0.6);
      const segs = 5 + Math.floor(rnd(seed, i + 3) * 3);
      const segH = (h + 40) / segs;
      for (let s = 0; s < segs; s++) {
        const y0 = h + 20 - s * segH, y1 = y0 - segH + 5;
        const x0 = x + lean * (s / segs), x1 = x + lean * ((s + 1) / segs);
        c.beginPath();
        c.moveTo(x0 - tk / 2, y0 - 4);
        c.quadraticCurveTo((x0 + x1) / 2 - tk * 0.42, (y0 + y1) / 2, x1 - tk * 0.5, y1 + 3);
        c.lineTo(x1 + tk * 0.5, y1 + 3);
        c.quadraticCurveTo((x0 + x1) / 2 + tk * 0.42, (y0 + y1) / 2, x0 + tk / 2, y0 - 4);
        c.fill();
        c.fillRect(x1 - tk * 0.62, y1, tk * 1.24, Math.max(2, tk * 0.12));
        if (s > 0 && rnd(seed, i * 10 + s) < leafK) {
          const sd = rnd(seed, i * 10 + s + 5) < 0.5 ? -1 : 1;
          const k = 3 + Math.floor(rnd(seed, i + s * 7) * 4);
          for (let l = 0; l < k; l++) {
            const a = (sd > 0 ? 0.55 : Math.PI - 0.55) + (rnd(seed, i * 31 + s * 7 + l) - 0.5) * 1.1;
            const L = (46 + rnd(seed, l + i * 3 + s) * 56) * (thick / 22);
            leaf(c, x1 + sd * (tk * 0.5 + l * 5), y1 + l * 6, a, L, L * 0.15);
          }
        }
      }
    }
  });
  const BAM = {
    far: bamboo(3, 26, 'rgba(90,86,78,.2)', 3, 12, 0.35),
    mid: bamboo(5, 12, 'rgba(38,36,33,.55)', 0.8, 22, 0.45),
    near: bamboo(9, 4, 'rgba(8,8,8,.92)', 6, 70, 0.5),
  };

  // 遠山：山脊濃、往下淡出
  const MOUNT = mk(2800, 520, c => {
    [[0.28, 'rgba(70,66,60,', 280, 3, 0], [0.5, 'rgba(38,36,32,', 170, 1.5, 2]].forEach(([k, col, hgt, bl, ph]) => {
      c.filter = `blur(${bl}px)`;
      c.beginPath();
      c.moveTo(0, 520);
      for (let x = 0; x <= 2800; x += 16) {
        const y = 520 - hgt * (0.4 + 0.3 * Math.sin(x * 0.004 + ph) + 0.2 * Math.sin(x * 0.011 + ph * 2) + 0.1 * Math.sin(x * 0.031 + ph));
        c.lineTo(x, y);
      }
      c.lineTo(2800, 520);
      c.closePath();
      const gr = c.createLinearGradient(0, 520 - hgt * 1.1, 0, 520);
      gr.addColorStop(0, `${col}${k})`);
      gr.addColorStop(1, `${col}0)`);
      c.fillStyle = gr;
      c.fill();
    });
  });

  const GROUND = mk(3000, 60, c => {
    brush(c, spline([[0, 30], [750, 27], [1500, 33], [2250, 28], [3000, 30]], 30), { w: 9, dry: 0.7, n: 10, alpha: 0.55, taper: [0.02, 0.02], seed: 5, bleed: 0.08 });
  });

  const SPLATS = [0, 1, 2, 3, 4, 5].map(s => mk(256, 256, c => {
    c.translate(128, 128);
    c.fillStyle = '#0b0b0b';
    c.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * TAU;
      const r = 40 * (1 + 0.22 * Math.sin(3 * a + s * 2) + 0.14 * Math.sin(7 * a + s) + 0.08 * Math.sin(15 * a + s * 5));
      if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.moveTo(r, 0);
    }
    c.fill();
    for (let i = 0; i < 12; i++) {
      const a = rnd(s, i) * TAU, l = 60 + rnd(s, i + 20) * 60, w = 3 + rnd(s, i + 40) * 6;
      c.beginPath();
      c.moveTo(Math.cos(a - 0.12) * 30, Math.sin(a - 0.12) * 30);
      c.lineTo(Math.cos(a) * l, Math.sin(a) * l);
      c.lineTo(Math.cos(a + 0.12) * 30, Math.sin(a + 0.12) * 30);
      c.fill();
      c.beginPath();
      c.arc(Math.cos(a) * l, Math.sin(a) * l, w / 2, 0, TAU);
      c.fill();
    }
    for (let i = 0; i < 26; i++) {
      const a = rnd(s, i + 60) * TAU, d = 55 + rnd(s, i + 90) * 65, r = 1 + rnd(s, i + 120) * 5;
      c.beginPath();
      c.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, TAU);
      c.fill();
    }
  }));

  const GRAIN = [0, 1, 2].map(k => mk(256, 256, c => {
    const im = c.createImageData(256, 256), d = im.data;
    let s = 1234 + k * 999;
    for (let i = 0; i < d.length; i += 4) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const v = s >>> 24;
      d[i] = d[i + 1] = d[i + 2] = v > 128 ? 255 : 0;
      d[i + 3] = v & 31;
    }
    c.putImageData(im, 0, 0);
  }));
  const grainPat = GRAIN.map(c => g.createPattern(c, 'repeat'));

  /* ---------- 畫面工具 ---------- */

  const screen = () => g.setTransform(R, 0, 0, R, 0, 0);
  const view = (cx, cy, z, rot = 0) => {
    g.setTransform(R, 0, 0, R, 0, 0);
    g.translate(640, 360);
    if (rot) g.rotate(rot);
    g.scale(z, z);
    g.translate(-cx, -cy);
  };
  const fill = col => { screen(); g.fillStyle = col; g.fillRect(0, 0, 1280, 720); };
  const paper = () => { screen(); g.drawImage(PAPER, 0, 0, 1280, 720); };
  const wash = (col, a) => {
    if (a <= 0) return;
    screen();
    g.globalAlpha = Math.min(1, a);
    g.fillStyle = col;
    g.fillRect(0, 0, 1280, 720);
    g.globalAlpha = 1;
  };
  // 螢幕座標的視差圖層（橫向重複鋪滿）
  function layer(img, ox, oy = 0, sc = 1, a = 1, bottom = 800) {
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
  // 地平線（世界座標）
  function ground(y, a = 1) {
    if (a <= 0) return;
    const gr = g.createLinearGradient(0, y - 6, 0, y + 280);
    gr.addColorStop(0, `rgba(40,36,30,${0.16 * a})`);
    gr.addColorStop(1, 'rgba(40,36,30,0)');
    g.fillStyle = gr;
    g.fillRect(-3000, y - 6, 9000, 286);
    g.globalAlpha = a;
    for (let x = -3000; x < 6000; x += 3000) g.drawImage(GROUND, x, y - 30);
    g.globalAlpha = 1;
  }
  // 地面流動的霧（螢幕座標）：白霧 + 淡墨霧
  function mist(t, y, a = 1, speed = 14) {
    if (a <= 0) return;
    screen();
    for (let i = 0; i < 10; i++) {
      const ink = i >= 6;
      const x = ((rnd(i, 1) * 1900 + t * speed * (0.6 + rnd(i, 2))) % 1900) - 300;
      const yy = y + (rnd(i, 3) - 0.5) * 70, rx = 240 + rnd(i, 4) * 260, ry = 30 + rnd(i, 5) * 34;
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, ink ? `rgba(50,48,44,${0.1 * a})` : `rgba(246,242,233,${0.55 * a})`);
      gr.addColorStop(1, ink ? 'rgba(50,48,44,0)' : 'rgba(246,242,233,0)');
      g.save();
      g.translate(x, yy);
      g.scale(1, ry / rx);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, rx, 0, TAU);
      g.fill();
      g.restore();
    }
  }
  const splat = (x, y, size, k = 0, a = 1, rot = 0) => {
    if (a <= 0 || size <= 0) return;
    g.save();
    g.globalAlpha *= a;
    g.translate(x, y);
    g.rotate(rot);
    g.drawImage(SPLATS[k % 6], -size / 2, -size / 2, size, size);
    g.restore();
  };
  // 飛濺的墨滴：位置只由時間決定
  function drops(t, t0, x, y, o = {}) {
    const { n = 30, speed = 700, grav = 900, life = 1.2, seed = 1, dir = -Math.PI / 2, spread = Math.PI, size = 6, drag = 2.2 } = o;
    const dt = t - t0;
    if (dt < 0 || dt > life) return;
    g.fillStyle = rgba(INK, Math.min(1, (1 - dt / life) * 2.2));
    for (let i = 0; i < n; i++) {
      const a = dir + (rnd(seed, i) - 0.5) * spread;
      const sp = speed * (0.25 + 0.75 * rnd(seed, i + 30));
      const e = Math.exp(-drag * dt);
      const d = (sp / drag) * (1 - e);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d + 0.5 * grav * dt * dt;
      const vx = Math.cos(a) * sp * e, vy = Math.sin(a) * sp * e + grav * dt;
      const r = size * (0.3 + rnd(seed, i + 60));
      g.beginPath();
      g.ellipse(px, py, r * Math.min(4, 1 + Math.hypot(vx, vy) / 400), r, Math.atan2(vy, vx), 0, TAU);
      g.fill();
    }
  }
  /* ---------- 蝴蝶 ---------- */

  const FW = new Path2D('M0 -2 C6 -16 22 -24 28 -14 C29 -6 16 -1 0 1 Z');
  const HW = new Path2D('M0 1 C10 1 21 8 17 19 C11 23 3 14 0 4 Z');
  const GOLD = new Path2D('M8 -8 C14 -14 22 -17 26 -15 C22 -10 14 -6 8 -8 Z');
  // 發光的白蝴蝶：四周一圈柔和的光暈，翅膀只有淡淡的脈絡
  function butterfly(x, y, s, t, o = {}) {
    const { rot = 0, flapHz = 7, mono = null, alpha = 1, phase = 0 } = o;
    const open = o.open ?? 0.16 + 0.84 * Math.abs(Math.cos((t * flapHz + phase) * Math.PI));
    g.save();
    g.globalAlpha *= alpha;
    g.translate(x, y);
    g.rotate(rot);
    g.scale(s, s);
    if (!mono) {
      const halo = g.createRadialGradient(0, 2, 0, 0, 2, 48);
      halo.addColorStop(0, 'rgba(255,252,238,.8)');
      halo.addColorStop(0.35, 'rgba(255,248,226,.32)');
      halo.addColorStop(1, 'rgba(255,248,226,0)');
      g.fillStyle = halo;
      g.beginPath();
      g.arc(0, 2, 48, 0, TAU);
      g.fill();
    }
    for (const sd of [-1, 1]) {
      g.save();
      g.scale(sd * open, 1);
      g.fillStyle = mono || '#fffdf6';
      g.fill(FW);
      g.fill(HW);
      if (!mono) {
        g.fillStyle = 'rgba(232,206,150,.35)';
        g.fill(GOLD);
        g.strokeStyle = 'rgba(160,150,128,.7)';
        g.lineWidth = 0.8;
        g.stroke(FW);
        g.stroke(HW);
        g.beginPath();
        g.moveTo(1, -1);
        g.quadraticCurveTo(12, -10, 24, -13);
        g.moveTo(1, 1);
        g.quadraticCurveTo(14, -3, 25, -8);
        g.moveTo(1, 3);
        g.quadraticCurveTo(10, 8, 14, 16);
        g.stroke();
      }
      g.restore();
    }
    g.fillStyle = mono || '#6a655e';
    g.beginPath();
    g.ellipse(0, 3, 1.6, 8, 0, 0, TAU);
    g.fill();
    g.strokeStyle = mono || '#6a655e';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(0, -4);
    g.quadraticCurveTo(-3, -12, -7, -15);
    g.moveTo(0, -4);
    g.quadraticCurveTo(3, -12, 7, -15);
    g.stroke();
    g.restore();
  }
  /* ---------- 緬因貓 ---------- */

  // 骨架（側面、面向右、地面 y=0）：身體、鬃毛、頭、四條腿（肩／髖 → 肘／膝 → 腕／踝 → 掌）、尾巴
  const P0 = {
    hip: [-128, -188], chest: [96, -194], rh: 72, rc: 84, thigh: 58,
    ruff: [150, -228], rr: 74,
    head: [206, -292], hr: 54, hRot: 0,
    fN: [[124, -160], [132, -84], [136, -22], [148, -9]],
    fF: [[92, -160], [96, -84], [100, -22], [112, -9]],
    bN: [[-116, -168], [-92, -96], [-148, -36], [-132, -9]],
    bF: [[-150, -162], [-126, -92], [-178, -32], [-162, -9]],
    tail: [[-186, -206], [-258, -196], [-326, -166], [-392, -168], [-436, -204]],
  };
  const pose = o => ({ ...P0, ...o });
  // 前腳揮擊：從肩膀依角度伸出（0 = 正前方，負值往上）
  const arm = (s, a, L = 200, bend = 0.3) => {
    const d = [Math.cos(a), Math.sin(a)], nr = [-d[1], d[0]];
    return [s, [s[0] + d[0] * L * 0.42 + nr[0] * bend * 30, s[1] + d[1] * L * 0.42 + nr[1] * bend * 30], [s[0] + d[0] * L * 0.84, s[1] + d[1] * L * 0.84], [s[0] + d[0] * L, s[1] + d[1] * L]];
  };
  const POSE = {
    crouch: pose({
      hip: [-124, -122], chest: [86, -104], rh: 70, rc: 80, ruff: [144, -128], rr: 72, head: [214, -152], hRot: 0.04,
      fN: [[122, -80], [170, -44], [156, -16], [178, -9]], fF: [[92, -80], [140, -42], [126, -16], [148, -9]],
      bN: [[-112, -104], [-36, -48], [-120, -18], [-78, -9]], bF: [[-146, -100], [-66, -46], [-152, -18], [-110, -9]],
      tail: [[-184, -130], [-252, -104], [-322, -70], [-392, -50], [-452, -62]],
    }),
    run1: pose({
      hip: [-142, -206], chest: [104, -212], ruff: [160, -244], head: [226, -298], hRot: 0.06,
      fN: [[128, -176], [196, -132], [246, -72], [278, -44]], fF: [[100, -176], [168, -124], [220, -66], [250, -40]],
      bN: [[-130, -186], [-196, -130], [-262, -78], [-302, -58]], bF: [[-158, -182], [-218, -128], [-282, -86], [-320, -70]],
      tail: [[-196, -224], [-270, -232], [-344, -232], [-414, -240], [-476, -262]],
    }),
    lunge: pose({
      hip: [-140, -212], chest: [110, -232], rc: 82, ruff: [168, -264], head: [236, -304], hRot: -0.08,
      fN: [[140, -200], [220, -232], [296, -254], [334, -258]], fF: [[112, -192], [170, -150], [222, -120], [252, -110]],
      bN: [[-128, -190], [-200, -132], [-278, -84], [-318, -64]], bF: [[-158, -186], [-222, -142], [-298, -102], [-338, -88]],
      tail: [[-196, -228], [-270, -242], [-350, -252], [-420, -264], [-480, -292]],
    }),
    reach: pose({
      hip: [-130, -200], chest: [100, -212], rh: 68, rc: 80, ruff: [160, -238], head: [218, -272], hRot: -0.3,
      fN: [[132, -198], [222, -240], [312, -284], [368, -304]], fF: [[106, -198], [204, -236], [296, -276], [352, -296]],
      bN: [[-120, -180], [-182, -128], [-244, -100], [-284, -90]], bF: [[-150, -176], [-204, -120], [-266, -96], [-304, -82]],
      tail: [[-190, -212], [-262, -200], [-332, -170], [-392, -140], [-452, -130]],
    }),
    sit: pose({
      hip: [-64, -96], chest: [42, -214], rh: 82, rc: 80, thigh: 74, ruff: [84, -252], rr: 74, head: [122, -334],
      fN: [[74, -196], [80, -112], [84, -24], [100, -9]], fF: [[50, -196], [54, -112], [58, -24], [74, -9]],
      bN: [[-60, -106], [-4, -48], [-10, -16], [22, -9]], bF: [[-92, -100], [-34, -42], [-40, -16], [-8, -9]],
      tail: [[-138, -44], [-208, -30], [-268, -44], [-308, -92], [-302, -150]],
    }),
  };
  POSE.land = pose({ ...POSE.crouch, head: [210, -170], hRot: -0.1 });
  // 緬因貓腿長：身體整個抬高，腿的關節依高度比例跟著抬（腳掌不動）
  const lift = (P, d) => {
    const up = p => [p[0], p[1] - d];
    const leg = L => L.map((p, i) => [p[0], p[1] - d * (1 - i / 3)]);
    return { ...P, hip: up(P.hip), chest: up(P.chest), ruff: up(P.ruff), head: up(P.head), tail: P.tail.map(up), fN: leg(P.fN), fF: leg(P.fF), bN: leg(P.bN), bF: leg(P.bF) };
  };
  Object.keys(POSE).forEach(k => { POSE[k] = lift(POSE[k], k === 'sit' ? 8 : k === 'crouch' || k === 'land' ? 12 : 26); });

  // 毛束：每根是一束彎曲的三角形；先畫長一點的銀灰底毛，再畫黑色毛尖
  function furKit(t, wind, windDir) {
    const fur = [], f12 = Math.floor(t * 12);
    const add = (x, y, a, len, w, i) => {
      const k = Math.min(1.5, len / 30);
      const sw = Math.sin(t * 2.1 + i * 0.9) * 0.16 * wind * k + windDir * wind * 0.25 * k;
      fur.push([x, y, a + sw, len * (1 + (rnd(i, f12) - 0.5) * 0.14), w, i]);
    };
    const angOf = (nx, ny, fl, m) => Math.atan2(ny * (1 - m) + fl[1] * m, nx * (1 - m) + fl[0] * m);
    const tube = (path, pts, radii, specs, id) => {
      const S = spline(pts, 6), T = tangents(S), n = S.length;
      for (let j = 0; j < n; j++) {
        const u = (j / (n - 1)) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(u));
        const r = lerp(radii[k], radii[k + 1], u - k), x = S[j][0], y = S[j][1];
        path.moveTo(x + r, y);
        path.arc(x, y, r, 0, TAU);
        if (specs) specs.forEach((sp, si) => {
          const v = j / (n - 1);
          if (v < (sp.from || 0) || v > (sp.to ?? 1) || j % (sp.every || 1)) return;
          const nx = -T[j][1] * sp.side, ny = T[j][0] * sp.side, i = id * 1000 + si * 100 + j;
          add(x + nx * r * 0.85, y + ny * r * 0.85, angOf(nx, ny, sp.flow || T[j], sp.mix ?? 0.5) + (rnd(i, 5) - 0.5) * 0.45, lerp(sp.len[0], sp.len[1], rnd(i, 3)), sp.w || 9, i);
        });
      }
    };
    const blob = (path, cx, cy, r, sp, id = 0) => {
      path.moveTo(cx + r, cy);
      path.arc(cx, cy, r, 0, TAU);
      if (!sp) return;
      for (let a = sp.arc[0], j = 0; a <= sp.arc[1]; a += sp.step || 0.2, j++) {
        const i = id * 1000 + j, nx = Math.cos(a), ny = Math.sin(a);
        add(cx + nx * r * 0.86, cy + ny * r * 0.86, angOf(nx, ny, sp.flow || [nx, ny], sp.mix ?? 0.4) + (rnd(i, 5) - 0.5) * 0.4, lerp(sp.len[0], sp.len[1], rnd(i, 3)), sp.w || 10, i);
      }
    };
    // 一束毛：根部飽滿、往尖端收細並微微捲起
    const draw = (kl, kw, da = 0) => {
      const p = new Path2D();
      for (const [x, y, a0, len, w, i] of fur) {
        const a = a0 + (i % 3 - 1) * da;
        const L = len * kl, hw = w * kw * 0.5, ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
        const curl = L * 0.2 * (i % 2 ? 1 : -1);
        const tx = x + ca * L + px * curl, ty = y + sa * L + py * curl;
        p.moveTo(x + px * hw, y + py * hw);
        p.bezierCurveTo(x + ca * L * 0.3 + px * hw * 1.05, y + sa * L * 0.3 + py * hw * 1.05, x + ca * L * 0.7 + px * (hw * 0.4 + curl * 0.6), y + sa * L * 0.7 + py * (hw * 0.4 + curl * 0.6), tx, ty);
        p.bezierCurveTo(x + ca * L * 0.7 + px * (curl * 0.6 - hw * 0.4), y + sa * L * 0.7 + py * (curl * 0.6 - hw * 0.4), x + ca * L * 0.3 - px * hw * 1.05, y + sa * L * 0.3 - py * hw * 1.05, x - px * hw, y - py * hw);
        p.closePath();
      }
      g.fill(p);
    };
    return { add, tube, blob, draw };
  }

  function drawEye(x, y, rx, ry, ang, o) {
    const open = 1 - clamp(o.blink || 0), pupil = o.pupil ?? 0.34, look = o.look || 0;
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    const eye = new Path2D();
    eye.moveTo(-rx, 0);
    eye.bezierCurveTo(-rx * 0.55, -ry * 1.25 * open, rx * 0.45, -ry * 1.3 * open, rx, -ry * 0.12);
    eye.bezierCurveTo(rx * 0.5, ry * 1.05 * open, -rx * 0.5, ry * 1.1 * open, -rx, 0);
    if (open > 0.03) {
      // 眼睛的光暈用漸層畫（比 shadowBlur 省很多）
      if (o.glow) {
        const halo = g.createRadialGradient(0, 0, rx * 0.7, 0, 0, rx * 1.6);
        halo.addColorStop(0, `rgba(255,140,30,${Math.min(0.3, o.glow / 150) * open})`);
        halo.addColorStop(1, 'rgba(255,140,30,0)');
        g.save();
        g.scale(1, 0.62);
        g.fillStyle = halo;
        g.beginPath();
        g.arc(0, 0, rx * 1.6, 0, TAU);
        g.fill();
        g.restore();
      }
      const cx = look * rx, cy = (o.lookY || 0) * ry;
      const gr = g.createRadialGradient(cx, cy, rx * 0.05, cx, cy, rx * 1.05);
      gr.addColorStop(0, '#ffcf7a');
      gr.addColorStop(0.3, '#ffa53a');
      gr.addColorStop(0.62, '#ee6d12');
      gr.addColorStop(0.88, '#a3380a');
      gr.addColorStop(1, '#3c1200');
      g.fillStyle = gr;
      g.fill(eye);
      g.save();
      g.clip(eye);
      // 虹膜紋理：長短不一的放射細線
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU + rnd(i, 3) * 0.05, r0 = rx * (0.16 + rnd(i, 5) * 0.2), r1 = rx * (0.55 + rnd(i, 4) * 0.45);
        g.strokeStyle = i % 3 ? `rgba(130,50,0,${0.2 + rnd(i, 6) * 0.25})` : `rgba(255,228,160,${0.18 + rnd(i, 6) * 0.2})`;
        g.lineWidth = rx * (0.008 + rnd(i, 7) * 0.014);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        g.stroke();
      }
      // 瞳孔：邊緣稍微柔和的直立細縫
      const pw = rx * pupil * 0.5;
      g.fillStyle = 'rgba(8,4,2,.45)';
      g.beginPath();
      g.ellipse(cx, cy, pw * 1.5, ry * 1.2, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#060302';
      g.beginPath();
      g.ellipse(cx, cy, pw, ry * 1.15, 0, 0, TAU);
      g.fill();
      if (o.reflect) o.reflect(rx, ry);
      // 上眼瞼的陰影與濕潤的反光
      const sh = g.createLinearGradient(0, -ry * 1.2, 0, 0);
      sh.addColorStop(0, 'rgba(20,6,0,.55)');
      sh.addColorStop(1, 'rgba(20,6,0,0)');
      g.fillStyle = sh;
      g.fillRect(-rx, -ry * 1.3, rx * 2, ry * 1.3);
      g.fillStyle = 'rgba(255,255,255,.9)';
      g.beginPath();
      g.ellipse(cx - rx * 0.3, cy - ry * 0.35, rx * 0.075, ry * 0.12, -0.4, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.4)';
      g.beginPath();
      g.arc(cx + rx * 0.28, cy + ry * 0.32, rx * 0.035, 0, TAU);
      g.fill();
      g.restore();
    }
    // 紅棕色的濕潤眼眶、黑色眼線、下眼瞼一道淡淡的反光
    g.strokeStyle = 'rgba(112,40,14,.45)';
    g.lineWidth = rx * 0.14;
    g.stroke(eye);
    g.strokeStyle = '#070606';
    g.lineWidth = rx * 0.035;
    g.lineCap = 'round';
    g.stroke(eye);
    if (open > 0.03) {
      g.strokeStyle = 'rgba(255,236,214,.3)';
      g.lineWidth = rx * 0.02;
      g.beginPath();
      g.moveTo(-rx * 0.6, ry * 0.72 * open);
      g.quadraticCurveTo(0, ry * 1.08 * open, rx * 0.55, ry * 0.6 * open);
      g.stroke();
    }
    g.restore();
  }

  function drawCat(P, o) {
    const t = o.t || 0, s = o.s || 1, wind = o.wind ?? 0.35;
    const K = furKit(t, wind, o.windDir || 0);
    const far = new Path2D(), body = new Path2D();
    const hRot = P.hRot + (o.tilt || 0), ca = Math.cos(hRot), sa = Math.sin(hRot);
    const [hx, hy] = P.head, hr = P.hr;
    const hp = (x, y) => [hx + x * ca - y * sa, hy + x * sa + y * ca];
    const sway = o.sway ?? 4, tailHz = o.tailHz || 1.1;
    const tail = P.tail.map((p, i) => [p[0] + Math.sin(t * tailHz + i * 0.8 + 1) * i * sway * 0.5, p[1] + Math.sin(t * tailHz + i * 0.7) * i * sway]);
    const paw = (path, leg, rx, ry) => {
      const a = leg[3], b = leg[2], ang = Math.atan2(a[1] - b[1], a[0] - b[0]) - Math.PI / 2;
      const cx = a[0] + Math.cos(ang) * 6, cy = a[1] + Math.sin(ang) * 6;
      path.moveTo(cx + rx * Math.cos(ang), cy + rx * Math.sin(ang));
      path.ellipse(cx, cy, rx, ry, ang, 0, TAU);
      K.add(cx + Math.cos(ang) * rx * 0.8, cy + Math.sin(ang) * rx * 0.8, ang, 8, 6, 777 + Math.round(a[0]));
      return [cx, cy, ang];
    };

    // 眼睛特寫時畫面只看得到頭，身體與腳不畫（放大後的大圓很耗效能）
    const whole = !o.headOnly;
    // 遠側的腳與耳朵（稍淡）
    if (whole) K.tube(far, P.fF, [31, 24, 19, 18], [{ side: 1, len: [6, 13], every: 2 }], 1);
    if (whole) {
      K.tube(far, P.bF, [P.thigh * 0.8, 29, 18, 17], [{ side: 1, len: [10, 22], every: 2, to: 0.5 }], 2);
      paw(far, P.fF, 27, 13);
      paw(far, P.bF, 26, 12);
    }
    const fl = o.earFlick || 0;
    const earF = [hp(-38, -34), hp(-48, -76), hp(-30, -106), hp(-8, -82), hp(-4, -50)];
    far.moveTo(...earF[0]);
    far.quadraticCurveTo(...earF[1], ...earF[2]);
    far.quadraticCurveTo(...earF[3], ...earF[4]);
    far.closePath();

    if (whole) {
      // 尾巴：又長又蓬，兩層毛
      K.tube(body, tail, [26, 34, 38, 34, 24], [
        { side: 1, len: [30, 58], mix: 0.25, w: 15 }, { side: -1, len: [30, 58], mix: 0.25, w: 15 },
        { side: 1, len: [14, 30], mix: 0.5, w: 12 }, { side: -1, len: [14, 30], mix: 0.5, w: 12 },
      ], 3);
      const tt = tail[tail.length - 1], tp = tail[tail.length - 2], ta = Math.atan2(tt[1] - tp[1], tt[0] - tp[0]);
      K.blob(body, tt[0], tt[1], 20, { arc: [ta - 1.3, ta + 1.3], step: 0.2, len: [28, 54], flow: [Math.cos(ta), Math.sin(ta)], mix: 0.55, w: 14 }, 4);

      // 身體：胸深，肚子下方垂著長毛，背上的毛順著往後貼
      const br = Math.sin(t * 2.2) * 1.5;
      const mid = [(P.hip[0] + P.chest[0]) / 2, (P.hip[1] + P.chest[1]) / 2 + 12];
      K.tube(body, [P.hip, mid, P.chest], [P.rh, (P.rh + P.rc) / 2 + 3 + br, P.rc + br], [
        { side: 1, len: [22, 44], flow: [-0.45, 1], mix: 0.6, w: 14 },
        { side: 1, len: [10, 22], flow: [-0.6, 1], mix: 0.4, w: 11 },
        { side: -1, len: [5, 11], flow: [-0.95, 0.3], mix: 0.85, w: 10 },
      ], 5);

      // 後腿：大腿後側的「燈籠褲」長毛
      K.tube(body, P.bN, [P.thigh + 4, 31, 19, 18], [
        { side: 1, len: [18, 40], to: 0.5, flow: [-1, 0.8], mix: 0.5, w: 13 },
        { side: 1, len: [6, 12], every: 2, from: 0.5 },
        { side: -1, len: [5, 10], every: 2, from: 0.3 },
      ], 6);
      paw(body, P.bN, 27, 12.5);

      // 獅子般的鬃毛：往下垂成一大片圍兜
      K.tube(body, [P.chest, P.ruff, hp(-10, 14)], [P.rc * 0.94, P.rr + 4, hr * 0.92], null, 7);
      K.blob(body, P.ruff[0], P.ruff[1], P.rr + 4, { arc: [-0.5, 3.2], step: 0.1, len: [34, 66], flow: [-0.2, 1], mix: 0.5, w: 15 }, 8);
      K.blob(body, P.ruff[0] + 6, P.ruff[1] + 20, P.rr * 0.7, { arc: [0.3, 2.2], step: 0.14, len: [30, 56], flow: [-0.1, 1], mix: 0.6, w: 13 }, 11);

    }
    // 頭：大而方的臉，臉頰毛
    K.blob(body, ...hp(0, 0), hr + 2, { arc: [hRot + 0.7, hRot + 3], step: 0.14, len: [14, 32], flow: [-ca, 0.6], mix: 0.5, w: 11 }, 9);
    K.blob(body, ...hp(30, -20), 31);
    K.blob(body, ...hp(44, 12), 26);
    K.blob(body, ...hp(50, 24), 20);
    K.blob(body, ...hp(26, 32), 22);
    K.blob(body, ...hp(64, 5), 12);
    const earN = [hp(-14, -42), hp(-22, -84), hp(2 - fl * 24, -118 + fl * 10), hp(30, -80), hp(34, -42)];
    body.moveTo(...earN[0]);
    body.quadraticCurveTo(...earN[1], ...earN[2]);
    body.quadraticCurveTo(...earN[3], ...earN[4]);
    body.closePath();
    // 耳尖的猞猁毛
    const tuft = (tip, base, len, i) => {
      const a = Math.atan2(tip[1] - base[1], tip[0] - base[0]);
      K.add(tip[0], tip[1], a, len, 4, i);
      K.add(tip[0], tip[1], a - 0.25, len * 0.7, 3, i + 1);
    };
    tuft(earN[2], hp(10, -50), 30, 90001);
    tuft(earF[2], hp(-20, -48), 24, 90003);

    // 近側前腳：粗壯，手肘後方有一撮毛
    if (whole) K.tube(body, P.fN, [35, 26, 21, 19], [
      { side: 1, len: [12, 24], every: 1, to: 0.45, flow: [-1, 0.5], mix: 0.5, w: 11 },
      { side: 1, len: [5, 10], every: 2, from: 0.45 },
      { side: -1, len: [4, 8], every: 2 },
    ], 10);
    const pw = whole ? paw(body, P.fN, 30, 14) : [0, 0, 0];

    g.save();
    g.translate(o.x, o.y);
    if (o.rot) g.rotate(o.rot);
    g.scale((o.flip ? -1 : 1) * s, s);
    if (o.pivot) g.translate(-o.pivot[0], -o.pivot[1]);
    if (o.alpha != null) g.globalAlpha = o.alpha;
    // 先畫銀灰底毛（比黑毛長一點、角度錯開），邊緣看起來像煙
    if (!o.lite) {
      g.fillStyle = 'rgba(96,94,87,.85)';
      K.draw(1.32, 1.2, 0.16);
    }
    g.fillStyle = '#1e1d1b';
    g.fill(far);
    // 邊緣一圈淡淡的灰霧；特寫時整個畫面都是貓，省掉這層（模糊很耗效能）
    if (o.halo !== false) {
      g.shadowColor = 'rgba(70,68,62,.55)';
      g.shadowBlur = 10;
    }
    g.fillStyle = '#0a0a0a';
    g.fill(body);
    g.shadowBlur = 0;
    K.draw(1, 1);

    // 黑毛底下透出的銀灰底毛：順著毛流的細線
    g.lineCap = 'round';
    const sheen = new Path2D();
    for (let i = 0; i < 26; i++) {
      const a = -0.3 + rnd(i, 21) * 3.1, r0 = P.rr * (0.2 + rnd(i, 22) * 0.65);
      const x0 = P.ruff[0] + Math.cos(a) * r0, y0 = P.ruff[1] + Math.sin(a) * r0, L = 26 + rnd(i, 23) * 34;
      sheen.moveTo(x0, y0);
      sheen.quadraticCurveTo(x0 - L * 0.2, y0 + L * 0.5, x0 - L * 0.12 + Math.sin(t * 1.5 + i) * 2 * wind, y0 + L);
    }
    const sp = [P.hip, P.chest], sd = Math.atan2(P.chest[1] - P.hip[1], P.chest[0] - P.hip[0]);
    for (let i = 0; i < 30; i++) {
      const k = rnd(i, 24), v = (rnd(i, 25) - 0.6) * 1.4, rr = lerp(P.rh, P.rc, k);
      const x0 = lerp(sp[0][0], sp[1][0], k) - Math.sin(sd) * v * rr, y0 = lerp(sp[0][1], sp[1][1], k) + Math.cos(sd) * v * rr;
      const L = 30 + rnd(i, 26) * 40, a = sd + Math.PI + 0.25;
      sheen.moveTo(x0, y0);
      sheen.quadraticCurveTo(x0 + Math.cos(a) * L * 0.5, y0 + Math.sin(a) * L * 0.5 - 3, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L + 6);
    }
    for (let i = 0; i < tail.length - 1; i++) {
      const a = tail[i], b = tail[i + 1];
      for (const off of [-8, 2, 10]) {
        sheen.moveTo(a[0], a[1] + off);
        sheen.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + off - 6, b[0], b[1] + off * 0.7);
      }
    }
    g.strokeStyle = 'rgba(126,123,114,.3)';
    g.lineWidth = 1.6;
    if (!o.lite) g.stroke(sheen);

    // 臉上的細毛：從眼睛往後順，特寫時看得到一根根的毛
    const face = new Path2D();
    for (let i = 0; i < 90; i++) {
      const a = rnd(i, 31) * TAU, d = 13 + rnd(i, 32) * 44;
      const lx = 33 + Math.cos(a) * d, ly = -10 + Math.sin(a) * d * 0.8;
      if (Math.hypot(lx, ly) > hr * 0.94 && Math.hypot(lx - 30, ly + 20) > 29) continue;
      const p0 = hp(lx, ly), L = 5 + rnd(i, 33) * 10, aa = hRot + Math.PI + 0.15 + (rnd(i, 34) - 0.5) * 0.6;
      face.moveTo(p0[0], p0[1]);
      face.quadraticCurveTo(p0[0] + Math.cos(aa) * L * 0.5, p0[1] + Math.sin(aa) * L * 0.5 + 1, p0[0] + Math.cos(aa) * L, p0[1] + Math.sin(aa) * L);
    }
    for (let i = 0; i < 6; i++) {
      const b = hp(i * 4, -46), tip = hp(8 + i * 2 - fl * 16, -88 + i * 3);
      face.moveTo(b[0], b[1]);
      face.quadraticCurveTo(b[0] + 4, (b[1] + tip[1]) / 2, tip[0], tip[1]);
    }
    g.strokeStyle = 'rgba(112,109,101,.5)';
    g.lineWidth = 0.45;
    g.stroke(face);

    if (o.claws) {
      const [px, py, pa] = pw, dx = Math.cos(pa), dy = Math.sin(pa);
      const cl = new Path2D();
      for (let i = -1.5; i <= 1.5; i++) {
        const bx = px + dx * 20 - dy * i * 6, by = py + dy * 20 + dx * i * 6;
        cl.moveTo(bx, by);
        cl.quadraticCurveTo(bx + dx * 12, by + dy * 12, bx + dx * 12 + dy * 7, by + dy * 12 - dx * 7);
      }
      g.strokeStyle = '#ece5d4';
      g.lineWidth = 2.4;
      g.stroke(cl);
    }

    const eye = hp(33, -10);
    drawEye(eye[0], eye[1], 12, 7.5, hRot - 0.16, o);

    const wb = hp(56, 16), wk = new Path2D();
    for (let i = 0; i < 7; i++) {
      const a = hRot - 0.3 + i * 0.1 + Math.sin(t * 1.4 + i) * 0.02, L = 86 + rnd(i, 41) * 36;
      const x0 = wb[0], y0 = wb[1] + i * 1.2;
      wk.moveTo(x0, y0);
      wk.quadraticCurveTo(x0 + Math.cos(a) * L * 0.6, y0 + Math.sin(a) * L * 0.6 - 3, x0 + Math.cos(a + 0.14) * L, y0 + Math.sin(a + 0.14) * L + 6);
    }
    const bw = hp(26, -30);
    for (let i = 0; i < 2; i++) {
      const a = hRot - 1.0 - i * 0.25, L = 50 + i * 10;
      wk.moveTo(bw[0], bw[1]);
      wk.quadraticCurveTo(bw[0] + Math.cos(a) * L * 0.6, bw[1] + Math.sin(a) * L * 0.6, bw[0] + Math.cos(a + 0.3) * L, bw[1] + Math.sin(a + 0.3) * L);
    }
    g.strokeStyle = 'rgba(232,226,212,.78)';
    g.lineWidth = 1.1;
    g.stroke(wk);
    g.restore();
  }

  // 正面的緬因貓：坐著、走路（前腳交替抬起）、站起來舉爪、在胸前合攏雙爪
  function drawCatFront(o) {
    const t = o.t || 0, s = o.s || 1;
    const walk = o.walk, stand = walk != null ? 1 : 0;
    const reach = o.reach || 0, cup = o.cup || 0, up = o.up || 0;
    const K = furKit(t, o.wind ?? 0.4, 0);
    const back = new Path2D(), body = new Path2D();
    const ph = walk != null ? Math.sin(walk * Math.PI) : 0;
    const bob = walk != null ? Math.abs(ph) * 6 : 0;
    const cy = lerp(-200, -238, Math.max(stand, reach)) - bob;
    const hx = Math.sin(t * 0.8) * 2 + (o.tilt || 0) * 12, hy = cy - 112 - reach * 6;

    // 尾巴：坐著時從右後方繞出來，站著時翹在身後
    const sw = o.sway ?? 6;
    const tailSit = [[56, -40], [132, -34], [190, -70], [200, -136], [166, -172]];
    const tailUp = [[40, -150], [112, -186], [150, -250], [140, -318], [100, -348]];
    const tail = tailSit.map((p, i) => [lerp(p[0], tailUp[i][0], stand) + Math.sin(t * 1.3 + i * 0.7) * i * sw, lerp(p[1], tailUp[i][1], stand) + Math.cos(t * 1.1 + i * 0.6) * i * sw * 0.5]);
    K.tube(back, tail, [26, 32, 34, 30, 22], [{ side: 1, len: [20, 50], mix: 0.3, w: 10 }, { side: -1, len: [20, 50], mix: 0.3, w: 10 }, { side: 1, len: [10, 26], mix: 0.5, w: 8 }, { side: -1, len: [10, 26], mix: 0.5, w: 8 }], 41);
    const tt = tail[4], tp = tail[3], ta = Math.atan2(tt[1] - tp[1], tt[0] - tp[0]);
    K.blob(back, tt[0], tt[1], 20, { arc: [ta - 1.4, ta + 1.4], step: 0.14, len: [22, 48], flow: [Math.cos(ta), Math.sin(ta)], mix: 0.5, w: 10 }, 42);

    // 後半身：坐著是寬大的臀部與大腿，站著時縮到胸口後面
    const hy0 = lerp(-86, -150, stand), hr0 = lerp(110, 72, stand);
    K.blob(back, 0, hy0, hr0, { arc: [0.2, Math.PI - 0.2], step: 0.1, len: [12, 30], flow: [0, 1], mix: 0.5, w: 10 }, 43);
    [-1, 1].forEach((d, i) => {
      const th = [d * lerp(64, 60, stand), lerp(-56, -124, stand)], pw = [d * lerp(98, 72, stand), -12];
      K.tube(back, [th, [(th[0] + pw[0]) / 2, (th[1] + pw[1]) / 2], pw], [lerp(66, 32, stand), 26, 20], [{ side: d, len: [10, 24], mix: 0.5 }], 44 + i);
      back.moveTo(pw[0] + 28, pw[1]);
      back.ellipse(pw[0], pw[1], 28, 13, 0, 0, TAU);
    });

    // 胸口與獅子般的鬃毛（長毛往下垂成圍兜）
    K.blob(body, 0, cy, 104);
    K.blob(body, 0, cy - 14, 116, { arc: [-0.25, Math.PI + 0.25], step: 0.06, len: [26, 70], flow: [0, 1], mix: 0.55, w: 10 }, 46);

    // 前腳：坐著落地、走路交替抬起、舉到頭上、或在胸前合攏
    const paws = [-1, 1].map((d, i) => {
      const sh = [d * 40, cy + 40];
      const lift = walk != null ? Math.max(0, d * ph) * 34 : 0;
      let p = [d * 46, -12 - lift];
      p = [lerp(p[0], d * 100, reach), lerp(p[1], cy - 300, reach)];
      p = [lerp(p[0], d * 34, cup), lerp(p[1], cy + 70, cup)];
      const el = [(sh[0] + p[0]) / 2 + d * (12 + reach * 40), (sh[1] + p[1]) / 2];
      K.tube(body, [sh, el, p], [31, 26, 23], [{ side: -d, len: [8, 18], every: 2, mix: 0.5 }, { side: d, len: [5, 10], every: 2 }], 47 + i);
      const rx = 31 - reach * 5 + cup * 10, ry = 16 + reach * 6 + cup * 6;
      body.moveTo(p[0] + rx, p[1]);
      body.ellipse(p[0], p[1], rx, ry, 0, 0, TAU);
      K.add(p[0], p[1] + ry * 0.6, Math.PI / 2, 8, 10, 4900 + i);
      return p;
    });

    // 頭：大而方的臉、臉頰毛、大耳朵與耳尖的猞猁毛
    K.blob(body, hx, hy, 80, { arc: [0.05, Math.PI - 0.05], step: 0.07, len: [18, 50], flow: [0, 1], mix: 0.35, w: 9 }, 49);
    K.blob(body, hx, hy, 80, { arc: [Math.PI + 0.5, TAU - 0.5], step: 0.25, len: [6, 12], mix: 0.2 }, 50);
    [-1, 1].forEach(d => K.blob(body, hx + d * 48, hy + 20, 46));
    const ears = [-1, 1].map((d, i) => {
      const b1 = [hx + d * 74, hy - 26], b2 = [hx + d * 20, hy - 70], tip = [hx + d * (72 + (o.earFlick || 0) * 14 * (d > 0 ? 1 : 0)), hy - 136];
      body.moveTo(...b1);
      body.quadraticCurveTo(hx + d * 88, hy - 84, ...tip);
      body.quadraticCurveTo(hx + d * 40, hy - 100, ...b2);
      body.closePath();
      K.add(tip[0], tip[1], Math.atan2(tip[1] - hy + 60, tip[0] - hx - d * 46), 32, 4, 5000 + i * 2);
      K.add(tip[0], tip[1], Math.atan2(tip[1] - hy + 60, tip[0] - hx - d * 46) - d * 0.3, 22, 3, 5001 + i * 2);
      return [b1, b2, tip];
    });

    g.save();
    g.translate(o.x, o.y);
    g.scale(s, s);
    if (o.alpha != null) g.globalAlpha = o.alpha;
    g.fillStyle = 'rgba(100,97,90,.85)';
    K.draw(1.3, 1.2, 0.16);
    g.fillStyle = '#1b1a18';
    g.fill(back);
    if (o.halo !== false) {
      g.shadowColor = 'rgba(70,68,62,.55)';
      g.shadowBlur = 12;
    }
    g.fillStyle = '#111110';
    g.fill(body);
    g.shadowBlur = 0;
    K.draw(1, 1);
    g.globalAlpha *= 0.55;
    K.draw(0.85, 0.7, 0.3);
    g.globalAlpha = o.alpha ?? 1;

    // 銀灰底毛：鬃毛往下、臉頰往外、腳往下的細線
    const hair = new Path2D();
    for (let i = 0; i < 46; i++) {
      const a = 0.15 + rnd(i, 301) * (Math.PI - 0.3), r0 = 20 + rnd(i, 302) * 70;
      const x0 = Math.cos(a) * r0 * 1.2, y0 = cy - 14 + Math.sin(a) * r0 * 0.75 - 30, L = 18 + rnd(i, 303) * 50;
      const bend = (rnd(i, 312) - 0.5) * 22 + Math.cos(a) * 10;
      hair.moveTo(x0, y0);
      hair.bezierCurveTo(x0 + bend * 0.3, y0 + L * 0.35, x0 + bend, y0 + L * 0.6, x0 + bend * 1.2 + Math.sin(t * 1.4 + i) * 2, y0 + L);
    }
    for (let i = 0; i < 40; i++) {
      const d = i % 2 ? 1 : -1, a = -0.6 + rnd(i, 304) * 1.9, r0 = 30 + rnd(i, 305) * 44;
      const x0 = hx + d * (18 + Math.cos(a) * r0), y0 = hy + 4 + Math.sin(a) * r0 * 0.8, L = 14 + rnd(i, 306) * 22;
      hair.moveTo(x0, y0);
      hair.quadraticCurveTo(x0 + d * L * 0.5, y0 + 2, x0 + d * L, y0 + L * 0.35);
    }
    paws.forEach((p, i) => {
      const d = i ? 1 : -1;
      for (let k = 0; k < 6; k++) {
        const u = rnd(k, 307 + i), x0 = lerp(d * 40, p[0], u) + (rnd(k, 309) - 0.5) * 20, y0 = lerp(cy + 40, p[1], u);
        hair.moveTo(x0, y0);
        hair.lineTo(x0 + (rnd(k, 310) - 0.5) * 6, y0 + 22);
      }
    });
    ears.forEach(([b1, b2, tip], i) => {
      for (let k = 0; k < 5; k++) {
        const b = [lerp(b1[0], b2[0], 0.2 + k * 0.15), lerp(b1[1], b2[1], 0.2 + k * 0.15)];
        hair.moveTo(...b);
        hair.quadraticCurveTo(lerp(b[0], tip[0], 0.5) + (i ? -4 : 4), lerp(b[1], tip[1], 0.5), lerp(b[0], tip[0], 0.75), lerp(b[1], tip[1], 0.75));
      }
    });
    g.strokeStyle = 'rgba(128,124,116,.36)';
    g.lineWidth = 1.5;
    g.lineCap = 'round';
    g.stroke(hair);

    // 合攏在胸前的前爪：黑色的爪子疊在黑色胸口上，用灰色毛邊與趾縫分開
    if (cup > 0.5) {
      paws.forEach((p, i) => {
        const d = i ? 1 : -1, rx = 42, ry = 23;
        g.fillStyle = '#151514';
        g.beginPath();
        g.ellipse(p[0], p[1], rx, ry, d * 0.12, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(146,140,130,.7)';
        g.lineWidth = 2.2;
        g.beginPath();
        g.ellipse(p[0], p[1], rx, ry, d * 0.12, Math.PI * 1.02, Math.PI * 1.98);
        g.stroke();
        g.beginPath();
        for (let k = 0; k < 3; k++) {
          const tx = p[0] + (k - 1) * 20;
          g.moveTo(tx, p[1] + 2);
          g.quadraticCurveTo(tx + d * 2, p[1] + 12, tx, p[1] + 21);
        }
        for (let k = 0; k < 12; k++) {
          const a = Math.PI + 0.15 + (k / 11) * (Math.PI - 0.3), x0 = p[0] + Math.cos(a) * rx * 0.95, y0 = p[1] + Math.sin(a) * ry * 0.95;
          g.moveTo(x0, y0);
          g.lineTo(x0 + Math.cos(a) * 10 + (rnd(k, 420) - 0.5) * 6, y0 + Math.sin(a) * 12);
        }
        g.strokeStyle = 'rgba(146,140,130,.5)';
        g.lineWidth = 1.5;
        g.stroke();
      });
    }

    // 臉：口鼻較淡、眉心皺起、橘色的眼睛、鼻子、鬍鬚
    const mz = g.createRadialGradient(hx, hy + 30, 0, hx, hy + 30, 50);
    mz.addColorStop(0, 'rgba(120,114,106,.5)');
    mz.addColorStop(1, 'rgba(120,114,106,0)');
    g.fillStyle = mz;
    g.fillRect(hx - 50, hy - 20, 100, 100);
    const brow = new Path2D();
    [-1, 1].forEach(d => {
      for (let k = 0; k < 4; k++) {
        brow.moveTo(hx + d * (10 + k * 3), hy - 18 - k * 4);
        brow.quadraticCurveTo(hx + d * (28 + k * 3), hy - 30 - k * 5, hx + d * (52 + k * 2), hy - 30 - k * 6);
      }
    });
    g.strokeStyle = 'rgba(120,116,108,.45)';
    g.lineWidth = 1.4;
    g.stroke(brow);
    [-1, 1].forEach(d => drawEye(hx + d * 33, hy - 2 - up * 4, 17, 10, d * -0.2, { ...o, look: o.look || 0, lookY: -up * 0.35 }));
    g.fillStyle = '#6a5451';
    g.beginPath();
    g.moveTo(hx - 10, hy + 24 - up * 3);
    g.quadraticCurveTo(hx, hy + 20 - up * 3, hx + 10, hy + 24 - up * 3);
    g.quadraticCurveTo(hx + 3, hy + 34 - up * 3, hx, hy + 35 - up * 3);
    g.quadraticCurveTo(hx - 3, hy + 34 - up * 3, hx - 10, hy + 24 - up * 3);
    g.fill();
    g.strokeStyle = 'rgba(80,70,66,.8)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(hx, hy + 35 - up * 3);
    g.lineTo(hx, hy + 42 - up * 3);
    g.moveTo(hx - 11, hy + 46 - up * 3);
    g.quadraticCurveTo(hx - 4, hy + 47 - up * 3, hx, hy + 42 - up * 3);
    g.quadraticCurveTo(hx + 4, hy + 47 - up * 3, hx + 11, hy + 46 - up * 3);
    g.stroke();
    const wk = new Path2D();
    [-1, 1].forEach(d => {
      for (let k = 0; k < 6; k++) {
        const x0 = hx + d * 18, y0 = hy + 36 + k * 2.2, a = 0.05 + k * 0.08, L = 110 + rnd(k, 311 + d) * 50;
        wk.moveTo(x0, y0);
        wk.quadraticCurveTo(x0 + d * L * 0.55, y0 + Math.sin(a) * L * 0.4 - 4, x0 + d * L * Math.cos(a), y0 + Math.sin(a) * L + 6);
      }
    });
    g.strokeStyle = 'rgba(236,230,218,.75)';
    g.lineWidth = 1.1;
    g.stroke(wk);
    g.restore();
    return { paws: paws.map(p => [o.x + p[0] * s, o.y + p[1] * s]), head: [o.x + hx * s, o.y + hy * s] };
  }

  /* ---------- 分鏡（依參考影片的節奏：霧中登場 → 墨圈 → 撲擊 → 躍起 → 捧蝶） ---------- */

  // 霧：整片淡淡的白霧，中間可以更濃（兩側竹林留著）
  const fog = (a, center = 0) => {
    if (a <= 0) return;
    screen();
    const gr = g.createLinearGradient(0, 0, 0, 720);
    gr.addColorStop(0, `rgba(236,232,224,${a * 0.85})`);
    gr.addColorStop(0.55, `rgba(236,232,224,${a * 0.45})`);
    gr.addColorStop(1, `rgba(236,232,224,${a})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 1280, 720);
    if (center > 0) {
      const rg = g.createRadialGradient(640, 380, 60, 640, 380, 520);
      rg.addColorStop(0, `rgba(238,234,226,${center})`);
      rg.addColorStop(1, 'rgba(238,234,226,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 1280, 720);
    }
  };
  // 左下、右下的墨色石頭與竹叢
  const SHRUB = mk(1280, 720, c => {
    c.filter = 'blur(1.2px)';
    const clump = (x, y, sc, seed) => {
      for (let i = 0; i < 4; i++) {
        const rx = x + (rnd(seed, i) - 0.5) * 200 * sc, ry = y - rnd(seed, i + 9) * 30 * sc, r = (40 + rnd(seed, i + 3) * 60) * sc;
        const gr = c.createRadialGradient(rx, ry - r * 0.4, 0, rx, ry, r * 1.3);
        gr.addColorStop(0, 'rgba(22,22,21,.85)');
        gr.addColorStop(1, 'rgba(22,22,21,0)');
        c.fillStyle = gr;
        c.beginPath();
        c.ellipse(rx, ry, r * 1.4, r, 0, 0, TAU);
        c.fill();
      }
      c.fillStyle = 'rgba(16,16,15,.8)';
      for (let i = 0; i < 30; i++) {
        leaf(c, x + (rnd(seed, i + 20) - 0.5) * 240 * sc, y - 20 * sc - rnd(seed, i + 40) * 90 * sc, -Math.PI / 2 + (rnd(seed, i + 60) - 0.5) * 2.2, (40 + rnd(seed, i + 80) * 50) * sc, 8 * sc);
      }
    };
    clump(90, 720, 1.3, 1);
    clump(1190, 710, 1.4, 2);
    clump(270, 650, 0.6, 3);
    clump(1030, 640, 0.5, 4);
  });
  // 特寫時滿版的深色毛（一根根的灰線）
  const FURTEX = mk(1280, 720, c => {
    c.fillStyle = '#151413';
    c.fillRect(0, 0, 1280, 720);
    c.lineCap = 'round';
    for (let i = 0; i < 2400; i++) {
      const x = rnd(i, 201) * 1420 - 70, y = rnd(i, 202) * 820 - 50;
      const a = -0.45 + (rnd(i, 203) - 0.5) * 0.5 + ((x - 640) / 1280) * 0.9, L = 30 + rnd(i, 204) * 90;
      c.strokeStyle = rnd(i, 205) < 0.5 ? `rgba(118,113,105,${0.18 + rnd(i, 206) * 0.3})` : `rgba(60,58,55,${0.3 + rnd(i, 206) * 0.4})`;
      c.lineWidth = 1 + rnd(i, 207) * 3;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5 + 6, x + Math.cos(a) * L, y + Math.sin(a) * L);
      c.stroke();
    }
  });
  // 墨水漣漪：腳掌落地時一圈圈往外擴
  function ripples(x, y, t0, t, sc = 1) {
    for (let i = 0; i < 4; i++) {
      const k = inv(t0 + i * 0.12, t0 + i * 0.12 + 0.9, t);
      if (k <= 0 || k >= 1) continue;
      const rx = (40 + k * 320) * sc;
      g.strokeStyle = `rgba(20,20,20,${0.55 * (1 - k)})`;
      g.lineWidth = (12 - i * 2.5) * (1 - k * 0.6) * sc;
      g.beginPath();
      g.ellipse(x, y, rx, rx * 0.18, 0, 0, TAU);
      g.stroke();
    }
  }
  // 墨圈：兩道弧形筆觸繞一圈，墨點沿著圈冒出來
  function swirl(cx, cy, r, prog, seed, o = {}) {
    const w = o.w || 40, a = o.alpha ?? 0.9;
    brush(g, arcPts(cx, cy, r, -2.3, -2.3 + 4.3, 48, 0.05, seed), { w, prog: clamp(prog * 1.3), dry: 0.75, seed, n: 20, taper: [0.25, 0.55], alpha: a, wob: 0.35 });
    brush(g, arcPts(cx, cy, r * 0.95, 0.9, 0.9 + 3.7, 44, 0.05, seed + 1), { w: w * 0.7, prog: clamp(prog * 1.3 - 0.3), dry: 0.8, seed: seed + 1, n: 16, taper: [0.3, 0.55], alpha: a * 0.85, wob: 0.35 });
    for (let i = 0; i < 14; i++) {
      const aa = rnd(seed, i + 100) * TAU, k = inv(i / 18, i / 18 + 0.15, prog), rr = r * (0.97 + rnd(seed, i + 120) * 0.12);
      if (k > 0) splat(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, (26 + rnd(seed, i + 110) * 64) * ease.xo(k) * (o.blob || 1), i, 0.95, aa);
    }
    g.fillStyle = rgba(INK, 0.85);
    for (let i = 0; i < 40; i++) {
      const aa = rnd(seed, i + 200) * TAU, k = inv(rnd(seed, i + 210) * 0.8, rnd(seed, i + 210) * 0.8 + 0.1, prog);
      if (k <= 0) continue;
      const rr = r * (0.9 + rnd(seed, i + 220) * 0.3), sz = 1.5 + rnd(seed, i + 230) * 5;
      g.beginPath();
      g.arc(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, sz * ease.xo(k), 0, TAU);
      g.fill();
    }
  }
  const sideBamboo = (t, a = 1, blur = 0) => {
    layer(BAM.far, 180 + t * 4, 0, 1.05, 0.8 * a);
    layer(BAM.mid, 520 + t * 6, 0, 1.1, a);
    fog(0, 0.95);
    if (blur) layer(BAM.near, 1040 + t * 20, 0, 1.2, 0.5 * a);
  };

  // A 霧中遠景：遠山、墨色石叢，遠方一隻貓從霧裡走來
  function sMist(u, t) {
    const k = u / 1.3;
    paper();
    layer(MOUNT, 160, -190, 1.25, 0.9);
    fog(0.3);
    view(640, 360, 1);
    drawCatFront({ x: 640, y: 500, s: lerp(0.22, 0.3, k), t, walk: t * 1.6, halo: false, alpha: 0.85, glow: 30 });
    screen();
    g.drawImage(SHRUB, 0, 0);
    mist(t, 480, 1.2, 20);
    fog(0.2);
    wash('#5f5c57', 1 - inv(0, 0.6, u));
  }
  // B 腳掌落地：兩條粗腿從霧裡伸下來，巨大的腳掌踩下，墨水一圈圈漾開
  function drawPawsCU(cx, gy, t, liftL) {
    g.save();
    g.translate(cx, gy);
    [-1, 1].forEach((d, i) => {
      const px = d * 170, py = -(i ? 0 : liftL) * 110, top = -760;
      const leg = g.createLinearGradient(0, top, 0, py);
      leg.addColorStop(0, 'rgba(17,17,16,0)');
      leg.addColorStop(0.4, 'rgba(17,17,16,.8)');
      leg.addColorStop(1, 'rgba(17,17,16,1)');
      g.fillStyle = leg;
      g.beginPath();
      g.moveTo(px - 70, top);
      g.bezierCurveTo(px - 84, -440, px - 108, py - 170, px - 104, py - 40);
      g.lineTo(px + 104, py - 40);
      g.bezierCurveTo(px + 108, py - 170, px + 84, -440, px + 70, top);
      g.closePath();
      g.fill();
      // 腿邊一根根往外翹的毛
      g.lineCap = 'round';
      for (let k = 0; k < 150; k++) {
        const side = k % 2 ? 1 : -1, y0 = lerp(top + 200, py - 40, rnd(k, 401 + i)), a = Math.PI / 2 - side * (0.35 + rnd(k, 403) * 0.5);
        const wv = lerp(74, 104, inv(top, py, y0));
        const x0 = px + side * (wv - 20 + rnd(k, 404) * 30), L = 26 + rnd(k, 405) * 56;
        g.strokeStyle = rnd(k, 406) < 0.3 ? `rgba(120,116,108,${0.4 * inv(top + 200, py, y0)})` : `rgba(17,17,16,${0.85 * inv(top + 150, py, y0)})`;
        g.lineWidth = 3 + rnd(k, 407) * 7;
        g.beginPath();
        g.moveTo(x0 - side * 10, y0);
        g.quadraticCurveTo(x0 + side * L * 0.3, y0 + L * 0.4, x0 + Math.cos(a) * L * 0.2 + side * L * 0.5, y0 + L);
        g.stroke();
      }
      g.strokeStyle = 'rgba(120,116,108,.3)';
      g.lineWidth = 2;
      g.beginPath();
      for (let k = 0; k < 40; k++) {
        const x0 = px + (rnd(k, 412 + i) - 0.5) * 170, y0 = lerp(top + 260, py - 90, rnd(k, 413 + i)), L = 30 + rnd(k, 414) * 50;
        g.moveTo(x0, y0);
        g.quadraticCurveTo(x0 + (x0 - px) * 0.08, y0 + L * 0.5, x0 + (x0 - px) * 0.18, y0 + L);
      }
      g.stroke();
      // 腳掌：大而圓，四個腳趾
      const paw = new Path2D();
      paw.ellipse(px, py - 30, 108, 50, 0, 0, TAU);
      for (let k = 0; k < 4; k++) {
        const tx = px + (k - 1.5) * 50;
        paw.moveTo(tx + 30, py - 6);
        paw.arc(tx, py - 6, 30, 0, TAU);
      }
      g.fillStyle = '#121211';
      g.fill(paw);
      g.strokeStyle = 'rgba(120,116,108,.5)';
      g.lineWidth = 2;
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const tx = px + (k - 1) * 50;
        g.moveTo(tx, py - 34);
        g.quadraticCurveTo(tx + 3, py - 16, tx, py + 8);
      }
      g.stroke();
      g.strokeStyle = 'rgba(17,17,16,.9)';
      g.lineWidth = 3;
      g.beginPath();
      for (let k = 0; k < 12; k++) {
        const tx = px + (rnd(k, 408 + i) - 0.5) * 200, ty = py - 70 + rnd(k, 409) * 40;
        g.moveTo(tx, ty);
        g.lineTo(tx + (rnd(k, 410) - 0.5) * 30, ty - 20 - rnd(k, 411) * 24);
      }
      g.stroke();
    });
    g.restore();
  }
  function sStep(u, t) {
    paper();
    fog(0.2);
    view(640, 360, 1);
    const land = 0.32, gy = 660;
    const lift = 1 - ease.in(inv(0, land, u));
    ripples(640 - 170, gy, 1.3 + land, t, 1.3);
    if (u > land) splat(640 - 170, gy + 8, 230 * ease.xo(inv(land, land + 0.15, u)), 3, 0.4, 0.2);
    drops(t, 1.3 + land, 640 - 170, gy, { n: 20, speed: 520, dir: -Math.PI / 2, spread: 2.6, grav: 1200, life: 0.7, seed: 7, size: 4 });
    drawPawsCU(640, gy, t, lift);
    fog(0, 0);
    screen();
    const top = g.createLinearGradient(0, 0, 0, 360);
    top.addColorStop(0, 'rgba(236,232,224,.95)');
    top.addColorStop(1, 'rgba(236,232,224,0)');
    g.fillStyle = top;
    g.fillRect(0, 0, 1280, 360);
    mist(t, 690, 0.7, 30);
  }
  // C 走出霧：正面朝鏡頭走來，尾巴甩動
  function sWalk(u, t) {
    const k = u / 2.2;
    paper();
    layer(MOUNT, 160, 90, 1.3, 0.5);
    sideBamboo(t, 0.6);
    view(640, 360, 1);
    drawCatFront({ x: 640, y: 730, s: lerp(0.62, 0.98, ease.out(k)), t, walk: t * 1.5, sway: 10, glow: 30 });
    mist(t, 660, 1, 18);
    fog(lerp(0.55, 0.05, ease.out(k)));
  }
  // D 墨圈：坐下，四周的墨點與墨圈成形，發光的白蝴蝶飛進來
  function sRing(u, t) {
    paper();
    fog(0, 0.5);
    view(640, 360, 1);
    swirl(640, 420, 330, ease.out(inv(0.05, 1.0, u)), 11);
    drawCatFront({ x: 640, y: 740, s: 0.9, t, sway: 8, glow: 30 });
    drops(t, 4.6, 640, 420, { n: 26, speed: 800, spread: TAU, grav: 200, life: 1.2, seed: 12, size: 5, drag: 3 });
    const q = ease.out(inv(0.4, 1.3, u));
    butterfly(lerp(1180, 900, q), lerp(260, 330, q) + Math.sin(t * 3) * 10, 0.9, t, { flapHz: 6 });
  }
  // E、H 眼睛大特寫：滿版的深色毛，中間一隻橘色的眼睛
  function eyeCU(u, t, o) {
    screen();
    g.save();
    g.translate(640, 360);
    g.scale(o.z, o.z);
    g.drawImage(FURTEX, -640 - u * 10, -360, 1280, 720);
    g.restore();
    screen();
    const vg = g.createRadialGradient(o.x, 360, 120, o.x, 360, 700);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = vg;
    g.fillRect(0, 0, 1280, 720);
    g.translate(o.x - u * 8, 370);
    g.scale(o.size, o.size);
    drawEye(0, 0, 17, 10, -0.08, { pupil: o.pupil, glow: 40, look: o.look || 0 });
  }
  const sEyeA = u => eyeCU(u, 0, { z: 1.05 + u * 0.1, x: 640, size: 20 + u * 2, pupil: 0.22 });
  const sEyeB = u => eyeCU(u, 0, { z: 1.2 + u * 0.1, x: 560, size: 26 + u * 3, pupil: lerp(0.2, 0.55, ease.io(inv(0.1, 0.5, u))) });
  // F 竹林遠景：兩側竹林、中間起霧；貓坐著看著蝴蝶，慢慢伏低
  function sGrove(u, t) {
    paper();
    sideBamboo(t);
    view(640, 360, 1);
    ground(560, 0.6);
    const P = mix(POSE.sit, POSE.crouch, ease.io(inv(0.3, 0.95, u)));
    drawCat(P, { x: 860, y: 560, s: 0.42, flip: true, t, wind: 0.4, pupil: 0.3, sway: 6 });
    butterfly(440 + Math.sin(t * 1.6) * 20, 330 + Math.sin(t * 2.4) * 14, 0.8, t, { flapHz: 6 });
    mist(t, 560, 1, 10);
  }
  // G 撲擊：三個動態鏡頭，前爪揮出、墨痕繞身、墨點四濺
  const glowTrail = (path, t, len = 0.45) => {
    const n = 20, pts = [];
    for (let i = 0; i <= n; i++) pts.push(path(t - (i / n) * len));
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = 1 - i / n;
      g.strokeStyle = `rgba(255,248,226,${0.85 * a})`;
      g.lineWidth = 2.6 * a + 0.4;
      g.beginPath();
      g.moveTo(pts[i][0], pts[i][1]);
      g.lineTo(pts[i + 1][0], pts[i + 1][1]);
      g.stroke();
    }
  };
  function sPounce(u, t) {
    paper();
    if (u < 0.7) {
      // 往左撲，前爪伸向蝴蝶
      const p = u / 0.7;
      const co = { x: lerp(800, 700, p), y: 470, pivot: [0, -200], rot: lerp(0.18, -0.05, p), flip: true, s: 0.95, t, wind: 1.2, claws: true, pupil: 0.14 };
      const P = { ...POSE.lunge, fN: arm(POSE.lunge.fN[0], lerp(-0.6, 0.15, ease.out(p)), 230) };
      view(640, 360, 1.02);
      swirl(640, 380, 360, ease.out(inv(0, 0.9, p)), 21, { w: 34, blob: 0.7 });
      drawCat(P, co);
      const bp = tt => [lerp(300, 160, inv(7.4, 8.1, tt)), lerp(170, 120, inv(7.4, 8.1, tt)) + Math.sin(tt * 12) * 10];
      glowTrail(bp, t);
      butterfly(...bp(t), 0.8, t, { flapHz: 10 });
      drops(t, 7.5, 360, 470, { n: 24, speed: 600, dir: Math.PI, spread: 1.6, grav: 600, life: 0.7, seed: 22, size: 5 });
    } else if (u < 1.5) {
      // 低身衝刺，身後拖出一道墨痕
      const p = (u - 0.7) / 0.8, x = lerp(420, 760, p);
      sideBamboo(t, 0.45, 1);
      view(640, 360, 1);
      ground(640, 0.5);
      brush(g, [[x - 560, 520], [x - 320, 470], [x - 120, 470]], { w: 90, alpha: 0.6, dry: 0.75, n: 22, seed: 23, taper: [0.5, 0.15] });
      drawCat(mix(POSE.run1, POSE.lunge, ease.io(p)), { x, y: 640, s: 0.95, t, wind: 1.3, windDir: -1, pupil: 0.14 });
      const bp = tt => [lerp(760, 1080, inv(8.1, 8.9, tt)) + Math.sin(tt * 9) * 20, 200 + Math.sin(tt * 13) * 30];
      glowTrail(bp, t);
      butterfly(...bp(t), 0.8, t, { flapHz: 10 });
      drops(t, 8.2, x - 100, 620, { n: 18, speed: 400, dir: -2.4, spread: 1, grav: 900, life: 0.5, seed: 24, size: 4 });
    } else {
      // 落地伏低、尾巴捲起，蝴蝶飛走
      const p = (u - 1.5) / 0.7;
      sideBamboo(t, 0.7);
      view(640, 360, 1);
      ground(620, 0.7);
      splat(560, 626, 200, 2, 0.5);
      drawCat(POSE.land, { x: 540, y: 620, s: 0.8, t, wind: 0.8, sway: 14, tailHz: 3, pupil: 0.3 });
      butterfly(lerp(900, 1040, p), lerp(260, 150, p), 0.8, t, { flapHz: 7 });
      mist(t, 620, 0.8, 16);
    }
  }
  // I 抬頭：正面坐著，抬頭看頭頂的蝴蝶
  function sLookUp(u, t) {
    paper();
    sideBamboo(t, 0.7);
    view(640, 360, 1);
    const up = ease.io(inv(0, 0.4, u));
    drawCatFront({ x: 640, y: 800, s: 1.08, t, up, sway: 5, glow: 30 });
    butterfly(650 + Math.sin(t * 2) * 12, 110 + Math.sin(t * 3) * 8, 0.9, t, { flapHz: 5 });
    fog(0.1);
  }
  // J 躍起：巨大的墨圈，貓站起來雙爪舉向蝴蝶
  function sRise(u, t) {
    paper();
    view(640, 360, 1);
    const p = u / 0.8;
    swirl(640, 380, 300, ease.out(inv(0, 0.7, p)), 31, { w: 46, blob: 1.2 });
    const r = drawCatFront({ x: 640, y: lerp(980, 820, ease.out(p)), s: 1.0, t, reach: ease.out(inv(0, 0.5, p)), up: 1, sway: 6, glow: 30 });
    const top = [(r.paws[0][0] + r.paws[1][0]) / 2, Math.min(r.paws[0][1], r.paws[1][1]) - 50];
    butterfly(top[0], top[1], 0.9, t, { flapHz: 4 });
  }
  // K 雙爪捧蝶：臉部特寫，蝴蝶停在合攏的前爪上，再飛起來
  function sCup(u, t) {
    paper();
    fog(0, 0.4);
    view(640, 360, 1 + u * 0.03);
    const lift = ease.in(inv(1.1, 1.8, u));
    const r = drawCatFront({ x: 640, y: 800, s: 1.6, t, cup: 1, up: -0.2 + lift * 0.6, look: lerp(0, -0.3, lift), sway: 4, glow: 36 });
    const c = [(r.paws[0][0] + r.paws[1][0]) / 2, (r.paws[0][1] + r.paws[1][1]) / 2 - 40];
    const b = [lerp(c[0], 330, lift) + Math.sin(t * 5) * 8 * lift, lerp(c[1], 170, lift)];
    butterfly(b[0], b[1], 1.3, t, { flapHz: lerp(1.2, 6, lift), open: u < 1.1 ? 0.55 + 0.4 * Math.abs(Math.sin(t * 2)) : undefined });
  }
  // L 收尾：竹林霧中，貓端坐、尾巴捲動，蝴蝶飛遠，畫面暗下
  function sEnd(u, t) {
    paper();
    sideBamboo(t);
    view(640, 360, 1);
    ground(650, 0.5);
    const r = drawCatFront({ x: 640, y: 650, s: 0.62, t, sway: 12, glow: 24 });
    const q = ease.in(inv(0.2, 2.3, u));
    butterfly(lerp(r.head[0] + 70, 1180, q), lerp(r.head[1] - 40, 70, q) + Math.sin(t * 4) * 10, 0.7, t, { flapHz: 6 });
    mist(t, 640, 1, 10);
    wash('#2c2a27', 0.85 * inv(1.8, 2.5, u));
  }

  const SHOTS = [
    [0, sMist], [1.3, sStep], [2.3, sWalk],
    [4.5, sRing], [5.9, sEyeA],
    [6.5, sGrove], [7.4, sPounce],
    [9.6, sEyeB], [10.2, sLookUp], [10.9, sRise],
    [11.7, sCup], [13.5, sEnd],
  ];

  function render(t) {
    lastT = t;
    let i = SHOTS.length - 1;
    while (i > 0 && SHOTS[i][0] > t) i--;
    g.setTransform(R, 0, 0, R, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    SHOTS[i][1](t - SHOTS[i][0], t);
    // 底片顆粒（每秒換 12 次）
    screen();
    g.globalAlpha = 0.45;
    g.fillStyle = grainPat[Math.floor(t * 12) % 3];
    g.fillRect(0, 0, 1280, 720);
    g.globalAlpha = 1;
  }

  // 解析度跟著播放器大小（全螢幕時更清楚），上限 1.25 倍
  const frame = $('.tr-frame', root);
  new ResizeObserver(() => {
    const k = Math.min(frame.clientWidth / 1280, frame.clientHeight / 720) || 1;
    const r = Math.round(Math.min(1.25, Math.max(0.5, k * (window.devicePixelRatio || 1))) * 20) / 20;
    if (r === R) return;
    R = r;
    cv.width = Math.round(1280 * R);
    cv.height = Math.round(720 * R);
    render(lastT);
  }).observe(frame);

  const CHAPTERS = [
    { at: 0, name: '霧中登場', caption: '霧裡的遠山與石叢，一隻黑煙色緬因貓踩著墨水走出來。' },
    { at: 4.5, name: '墨圈', caption: '牠坐下，四周的墨點與墨圈成形，一隻發光的白蝴蝶飛了進來。' },
    { at: 6.5, name: '撲擊', caption: '竹林裡伏低、撲出、衝刺，墨痕繞著身體甩開。' },
    { at: 9.6, name: '躍起', caption: '瞳孔放大，抬頭，在巨大的墨圈裡站起來，雙爪舉向蝴蝶。' },
    { at: 11.7, name: '捧蝶', caption: '蝴蝶停在合攏的前爪上，毫髮無傷地飛走，貓在竹林霧裡靜靜坐著。' },
  ];

  if (!G || !window.MGPlayer) {
    render(12.4);
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
