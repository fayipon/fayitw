/* =========================================================
   精神版 P(doom) MV 的字（由 pdoom-jingshen.js 每一格呼叫）
   照時裝秀 MV 的排版，影片本身沒有字，這裡全部畫上去：
   - 歌詞在左下逐字出現；重點字在夜景變橘色，在雪地改成黑底反白
   - 重點字放大成窄體大字（Barlow Condensed）或寬體（Michroma），旁邊一行等寬小字註解
   - 每個 Look 一張 Look 卡（Look 03. Big flower: / Chinese room.）與一張吊牌（洗標、條碼）
   - 資料卡跟著歌詞的意思：訓練 loss 曲線、終端機、股價、儀表、軌道圖、勾選框、計數器、翻牌看板
   - 副歌第一句：翻牌 I'M UPPING MY + 大字 P(DOOM) + 翻牌百分比
   - 歌詞只有每句的起訖時間；每個字的時間照音節數在這句裡分配
   ========================================================= */
window.PDoomJingshenType = env => {
  const { g, W, H, clamp, lerp, frac, ease, rnd, text, measure, FONT, OR, mixAt, pdoomAt, lookAt, cv } = env;
  const TAU = Math.PI * 2;
  const pad = n => String(n).padStart(2, '0');
  const tc = t => `${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}:${pad(Math.floor(frac(t) * 24))}`;
  // 字的顏色：夜景白字、雪地黑字
  const inkRGB = m => [lerp(244, 18, m), lerp(242, 18, m), lerp(238, 18, m)].map(Math.round);
  const ink = (m, a = 1) => `rgba(${inkRGB(m).join(',')},${a})`;
  const shadowOf = m => (m < 0.5 ? 'rgba(0,0,0,.45)' : null);
  // 出現 0.22 秒、消失 0.15 秒
  const pop = (age, len = 99) => (age < 0 || age > len ? 0 : Math.min(ease.out(clamp(age / 0.22)), clamp((len - age) / 0.15)));

  /* ---------- 每個字的時間 ---------- */
  // 母音群數當音節數；全大寫的縮寫一個字母算將近一個音節（AGI、MLP、NVDA、PTO、RLHF……）
  const syl = w => {
    const s = w.replace(/[^A-Za-z0-9]/g, '');
    if (!s) return 1;
    if (/^[A-Z0-9]{2,5}s?$/.test(s)) return s.replace(/s$/, '').length * 0.8;
    const mm = s.toLowerCase().match(/[aeiouy]+/g);
    let n = mm ? mm.length : 1;
    if (/[^aeiouy]e$/i.test(s) && n > 1) n--;
    return Math.max(1, n);
  };
  const clean = w => w.replace(/[^A-Za-z0-9()]/g, '').toUpperCase();

  /* ---------- 畫法 ---------- */
  // 大字：從基線往上擦出來，可以帶一行等寬註解
  const big = (s, x, y, o) => {
    const age = o.age;
    if (age == null || age < 0) return 0;
    const size = o.size || 140, fam = o.fam || FONT.cond, weight = o.weight || (fam === FONT.cond ? '800' : '');
    const track = o.track || 0;
    const w = measure(s, size, fam, weight, track);
    const x0 = o.align === 'r' ? x - w : o.align === 'c' ? x - w / 2 : x;
    const k = ease.out(clamp(age / (o.dur || 0.18)));
    g.save();
    if (o.rot || o.skew || o.sx || o.sy) {
      const px = x0 + w / 2, py = y - size * 0.36;
      g.translate(px, py);
      if (o.rot) g.rotate(o.rot);
      if (o.skew) g.transform(1, 0, o.skew, 1, 0, 0);
      g.scale(o.sx || 1, o.sy || 1);
      g.translate(-px, -py);
    }
    g.beginPath();
    g.rect(x0 - 30, y + size * 0.16 - size * 1.1 * k, w + 60, size * 1.1 * k + 2);
    g.clip();
    text(s, x0, y + (1 - k) * size * 0.3, { size, fam, weight, color: o.color, track, alpha: o.alpha, shadow: o.shadow, blur: o.blur || 24 });
    g.restore();
    if (o.sub) {
      text(o.sub, o.align === 'r' ? x0 + w : x0 + 4, y + 26, {
        size: 10, fam: FONT.mono, weight: '500', color: o.subColor || o.color, track: 2,
        align: o.align === 'r' ? 'right' : undefined, alpha: (o.alpha == null ? 1 : o.alpha) * clamp((age - 0.15) / 0.2),
      });
    }
    return w;
  };
  // 一個字母一個字母畫（給要各自動的字：抖、飛走、重組）
  const letters = (s, x, y, o, fx) => {
    const size = o.size, fam = o.fam || FONT.cond, weight = o.weight || '800';
    const chars = [...s];
    const ws = chars.map(c => measure(c, size, fam, weight));
    const tr = o.track || 0;
    const total = ws.reduce((p, q) => p + q, 0) + tr * (chars.length - 1);
    let cx = o.align === 'r' ? x - total : o.align === 'c' ? x - total / 2 : x;
    chars.forEach((c, j) => {
      const e = fx(j, chars.length, cx) || {};
      const a = (o.alpha == null ? 1 : o.alpha) * (e.a == null ? 1 : e.a);
      if (a > 0.01 && c !== ' ') {
        g.save();
        g.translate(cx + ws[j] / 2 + (e.dx || 0), y + (e.dy || 0));
        if (e.rot) g.rotate(e.rot);
        if (e.sc) g.scale(e.sc, e.sc);
        text(c, 0, 0, { size, fam, weight, color: e.color || o.color, align: 'center', alpha: a, shadow: o.shadow, blur: 20 });
        g.restore();
      }
      cx += ws[j] + tr;
    });
    return total;
  };

  // 翻牌看板：每格先亂翻再停在目標字；value 換掉的那一格會再翻一次
  const FLAPCH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const flap = (s, x, y, o) => {
    const chars = [...s];
    const cw = o.cw || 30, ch = o.ch || 42, gap = o.gap == null ? 3 : o.gap;
    const total = chars.length * (cw + gap) - gap;
    const x0 = o.align === 'c' ? x - total / 2 : o.align === 'r' ? x - total : x;
    const size = o.size || ch * 0.62;
    chars.forEach((c, i) => {
      const age = o.age - i * (o.stagger == null ? 0.03 : o.stagger);
      if (age < 0) return;
      if (c === ' ' && !o.blank) return;
      const tx = x0 + i * (cw + gap);
      const a = (o.alpha == null ? 1 : o.alpha) * clamp(age / 0.06);
      g.save();
      g.globalAlpha *= a;
      g.fillStyle = o.tile || '#141414';
      g.fillRect(tx, y, cw, ch);
      g.fillStyle = 'rgba(255,255,255,.07)';
      g.fillRect(tx, y, cw, ch / 2);
      const spin = age < (o.settle || 0.24) || (o.redo && o.redo(i));
      const shown = spin ? FLAPCH[Math.floor(rnd(i * 31 + Math.floor((age + 9) * 28), o.seed || 7) * FLAPCH.length)] : c;
      text(shown, tx + cw / 2, y + ch / 2 + size * 0.36, { size, fam: o.fam || FONT.mono, weight: '700', color: o.color || '#f2f0ea', align: 'center' });
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(tx, y + ch / 2 - 0.5, cw, 1);
      g.restore();
    });
    return total;
  };

  // 資料卡：夜景是深色卡、雪地是白卡；標題一行等寬字，右邊一個橘色標籤
  const panel = (x, y, w, h, a, m, title, tagText, body) => {
    if (a <= 0) return;
    const dark = m < 0.5;
    const c = dark ? '#f2f0ea' : '#141414';
    g.save();
    g.globalAlpha *= a;
    g.translate(x, y + (1 - a) * 12);
    g.fillStyle = dark ? 'rgba(14,14,14,.86)' : 'rgba(250,249,246,.93)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = dark ? 'rgba(255,255,255,.24)' : 'rgba(0,0,0,.28)';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, w - 1, h - 1);
    text(title, 12, 19, { size: 9, fam: FONT.mono, weight: '500', color: c, track: 1, alpha: 0.8 });
    if (tagText) {
      const tw = measure(tagText, 8, FONT.mono, '700', 1) + 10;
      g.fillStyle = OR;
      g.fillRect(w - 10 - tw, 8, tw, 15);
      text(tagText, w - 10 - tw + 5, 19, { size: 8, fam: FONT.mono, weight: '700', color: '#fff', track: 1 });
    }
    g.fillStyle = dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.16)';
    g.fillRect(12, 30, w - 24, 1);
    body(c, dark);
    g.restore();
  };

  // 洗標符號：洗衣盆、三角、方框圓叉、圓、熨斗
  const care = (x, y, col) => {
    g.save();
    g.strokeStyle = col;
    g.lineWidth = 1.1;
    g.translate(x, y);
    g.beginPath(); g.moveTo(0, 1); g.lineTo(2, 10); g.lineTo(11, 10); g.lineTo(13, 1); g.stroke();
    g.beginPath(); g.moveTo(1, 3); for (let i = 0; i <= 6; i++) g.lineTo(1 + i * 1.83, 3 + (i % 2 ? -1.4 : 0)); g.stroke();
    g.beginPath(); g.moveTo(24, 1); g.lineTo(30, 10); g.lineTo(18, 10); g.closePath(); g.stroke();
    g.strokeRect(36, 0.5, 11, 10); g.beginPath(); g.arc(41.5, 5.5, 3.6, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(36, 0.5); g.lineTo(47, 10.5); g.moveTo(47, 0.5); g.lineTo(36, 10.5); g.stroke();
    g.beginPath(); g.arc(58, 5.5, 5, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(68, 10); g.lineTo(80, 10); g.lineTo(80, 4); g.quadraticCurveTo(74, 1, 70, 4); g.closePath(); g.stroke();
    g.restore();
  };
  const barcode = (x, y, w, h, seed, col) => {
    g.fillStyle = col;
    let cx = x;
    for (let i = 0; cx < x + w; i++) {
      const bw = rnd(i, seed) < 0.3 ? 2 : 1;
      if (rnd(i, seed + 1) < 0.62) g.fillRect(cx, y, bw, h);
      cx += bw + 1;
    }
  };
  // 吊牌：白紙卡、上面一個穿繩的洞、品名、材質表、洗標、條碼
  const tag = (x, y, a, look, title, rows, rot = 0.03) => {
    if (a <= 0) return;
    const w = 236, rh = 15, h = 98 + rows.length * rh + 40;
    g.save();
    g.globalAlpha *= a;
    g.translate(x + w / 2, y + h / 2);
    g.rotate(rot * (0.5 + 0.5 * a));
    g.scale(0.9 + 0.1 * a, 0.9 + 0.1 * a);
    g.translate(-w / 2, -h / 2);
    g.shadowColor = 'rgba(0,0,0,.35)';
    g.shadowBlur = 20;
    g.shadowOffsetY = 8;
    g.fillStyle = '#f4f2ec';
    g.fillRect(0, 0, w, h);
    g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(0,0,0,.2)';
    g.beginPath(); g.arc(w / 2, 11, 4, 0, TAU); g.fill();
    text(`LOOK ${pad(look)} / 11 · SS27`, 14, 34, { size: 8.5, fam: FONT.mono, weight: '500', color: '#555', track: 1 });
    const pw = measure('JINGSHEN', 8, FONT.mono, '700', 1) + 10;
    g.fillStyle = OR;
    g.fillRect(w - 14 - pw, 24, pw, 14);
    text('JINGSHEN', w - 14 - pw + 5, 34.5, { size: 8, fam: FONT.mono, weight: '700', color: '#fff', track: 1 });
    text(title, 14, 70, { size: 30, fam: FONT.cond, weight: '700', color: '#111' });
    g.fillStyle = '#111';
    g.fillRect(14, 80, w - 28, 1);
    rows.forEach(([k, v], i) => {
      text(k, 14, 98 + i * rh, { size: 8.5, fam: FONT.mono, weight: '500', color: '#666', track: 1 });
      text(v, w - 14, 98 + i * rh, { size: 8.5, fam: FONT.mono, weight: '700', color: '#111', align: 'right', track: 1 });
    });
    const yb = 98 + rows.length * rh + 6;
    care(14, yb, '#333');
    barcode(w - 14 - 96, yb - 2, 96, 18, look * 13, '#111');
    text(`JS-27-${pad(look)}0${look % 7}`, w - 14, yb + 30, { size: 7.5, fam: FONT.mono, weight: '500', color: '#555', align: 'right', track: 1 });
    g.restore();
  };

  // 折線圖（在資料卡裡）：f(u) 回傳 0~1 的高度，p = 畫到哪
  const chart = (x, y, w, h, f, p, col, grid) => {
    g.strokeStyle = grid;
    g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(x, y + (h * i) / 4); g.lineTo(x + w, y + (h * i) / 4); g.stroke(); }
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.beginPath();
    const n = 80;
    for (let i = 0; i <= n * p; i++) {
      const u = i / n;
      const yy = y + h - f(u) * h;
      i ? g.lineTo(x + u * w, yy) : g.moveTo(x + u * w, yy);
    }
    g.stroke();
    if (p > 0 && p < 1) {
      const u = p, yy = y + h - f(u) * h;
      g.fillStyle = col;
      g.beginPath(); g.arc(x + u * w, yy, 3.5, 0, TAU); g.fill();
    }
  };
  // 終端機：一行一行打字
  const terminal = (x, y, w, a, m, title, lines, t) => {
    const h = 40 + lines.length * 30 + 10;
    panel(x, y, w, h, a, 0, title, 'RUNNING', c => {
      lines.forEach(([s, t0, size, col], i) => {
        if (t < t0) return;
        const n = Math.floor(clamp((t - t0) / Math.max(0.2, s.length * 0.035)) * s.length);
        const cursor = n < s.length || frac(t * 2) < 0.5 ? '▌' : '';
        text(s.slice(0, n) + (i === lines.length - 1 ? cursor : ''), 14, 60 + i * 30, { size: size || 20, fam: FONT.mono, weight: '500', color: col || c });
      });
    });
  };
  // 方框追蹤：四角括號 + 標籤
  const brackets = (x, y, w, h, a, col, label, conf) => {
    if (a <= 0) return;
    const l = Math.min(26, w * 0.25);
    g.save();
    g.globalAlpha *= a;
    g.strokeStyle = col;
    g.lineWidth = 1.5;
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([px, py, dx, dy]) => {
      g.beginPath(); g.moveTo(px, py + dy * l); g.lineTo(px, py); g.lineTo(px + dx * l, py); g.stroke();
    });
    if (label) {
      const lw = measure(label, 8.5, FONT.mono, '700', 1) + 10;
      g.fillStyle = col;
      g.fillRect(x, y - 16, lw, 14);
      text(label, x + 5, y - 6, { size: 8.5, fam: FONT.mono, weight: '700', color: col === OR ? '#fff' : '#111', track: 1 });
    }
    if (conf) text(conf, x + w, y - 6, { size: 9, fam: FONT.mono, weight: '500', color: col, align: 'right', track: 1 });
    g.restore();
  };
  // 掃描圈：圓、刻度、轉動的弧
  const ring = (cx, cy, r, a, t, col, label) => {
    if (a <= 0) return;
    g.save();
    g.globalAlpha *= a;
    g.strokeStyle = col;
    g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
    g.setLineDash([2, 6]);
    g.beginPath(); g.arc(cx, cy, r * 1.18, 0, TAU); g.stroke();
    g.setLineDash([]);
    g.lineWidth = 2.5;
    g.beginPath(); g.arc(cx, cy, r, t * 1.6, t * 1.6 + 0.9); g.stroke();
    for (let i = 0; i < 48; i++) {
      const an = (i / 48) * TAU, l = i % 4 ? 5 : 10;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r); g.lineTo(cx + Math.cos(an) * (r - l), cy + Math.sin(an) * (r - l)); g.stroke();
    }
    if (label) text(label, cx + r * 0.72, cy - r * 0.8, { size: 9, fam: FONT.mono, weight: '700', color: col, track: 1 });
    g.restore();
  };

  /* ---------- Look：每套造型一張 Look 卡與一張吊牌 ---------- */
  // [開始, 第幾套, 造型, 這一段, 吊牌位置 [x, y], 吊牌內容]
  const LOOKS = [
    [1.5, 1, 'Black mink:', 'Sparks.', [1010, 400], [['SHELL', 'MINK (FAUX)'], ['CHAIN', '24K × 2'], ['INK', 'DRAGON / KOI'], ['EYES', 'GREY · SPARKS']]],
    [13.0, 2, 'Bathhouse:', 'The boss.', [1000, 130], [['VENUE', 'XIYU ZHONGXIN'], ['STAFF', 'BOWING × 10'], ['RANK', 'BOSS'], ['FLOOR', 'MARBLE, RED']]],
    [26.5, 3, 'Big flower:', 'Chinese room.', [1000, 150], [['PRINT', 'DONGBEI PEONY'], ['ROOM', 'CHINESE, 1×1'], ['CONTENTS', 'SHROOMS 500G'], ['HEAT', 'KANG 28°C']]],
    [38.6, 4, 'Night train:', 'Training run.', [60, 330], [['CLASS', 'HARD SEAT'], ['CAR', 'GREEN, K7041'], ['LOSS', 'STABLE'], ['ETA', '∞']]],
    [45.0, 5, 'Ghost fire:', 'Accelerating.', [990, 340], [['LED', 'RGB × 6'], ['HELMET', 'NONE'], ['OPTIMIZER', 'ADAM'], ['ROAD', 'ICE']]],
    [64.5, 6, 'Errenzhuan:', 'Omega point.', [1000, 130], [['PROP', 'RED HANKY'], ['SPARKS', 'COLD'], ['COMPUTE', '1E30 FLOP/S'], ['SAFE', 'ENOUGH']]],
    [77.5, 7, 'Army coat:', 'Obsolete.', [990, 470], [['COAT', 'GREATCOAT'], ['COLLAR', 'FAUX FUR'], ['ARCH', 'VON NEUMANN'], ['STATUS', 'OBSOLETE']]],
    [97.5, 8, 'Paperclips:', 'Fill the room.', [60, 300], [['OBJECTIVE', 'MAXIMIZE'], ['KILLSWITCH', 'ON PTO'], ['RETURN', 'NEVER'], ['MATERIAL', 'YOU']]],
    [105.4, 9, 'Empty pool:', 'Blues.', null, [['TILES', 'ORTHOGONAL'], ['GOALS', 'ANY'], ['SMARTS', 'ANY'], ['MOOD', 'BLUES']]],
    [126.0, 10, 'The loom:', 'Foretold.', [1000, 300], [['THREAD', 'WHITE'], ['WEAVE', 'FORETOLD'], ['MASK', 'PRE-TRAINED'], ['LOOP', 'RECURSIVE']]],
    [137.4, 11, 'Final walk:', 'For show?', [1000, 130], [['LOOKS', '11 / 11'], ['SHOW', 'OVER'], ['SHELL', 'OPTIMISM'], ['LINING', 'DOOM']]],
  ];
  const lookCard = (t, m) => {
    for (const [t0, n, outfit, title, pos, rows] of LOOKS) {
      const age = t - t0;
      if (age < 0 || age > 3.4) continue;
      const a = pop(age, 3.2);
      const x = 40, y = 112;
      // Look 03. Big flower: 打字出來，第二行橘色
      const l1 = `Look ${pad(n)}. ${outfit}`;
      const n1 = Math.floor(clamp(age / 0.45) * l1.length);
      text(l1.slice(0, n1), x, y + 30, { size: 34, fam: FONT.sans, weight: '700', color: ink(m), alpha: a, shadow: shadowOf(m), blur: 18 });
      const n2 = Math.floor(clamp((age - 0.35) / 0.4) * title.length);
      text(title.slice(0, n2), x, y + 70, { size: 34, fam: FONT.sans, weight: '700', color: OR, alpha: a, shadow: shadowOf(m), blur: 18 });
      g.fillStyle = ink(m, 0.5 * a);
      g.fillRect(x, y + 92, 170 * ease.out(clamp(age / 0.6)), 1);
      text(`LOOK ${pad(n)} / 11${frac(t * 2) < 0.5 ? ' ▌' : ''}`, x, y + 110, { size: 9, fam: FONT.mono, weight: '500', color: ink(m), track: 1, alpha: a * 0.8 });
      // 吊牌晚 0.5 秒進來
      const rr = rows.map(([k, v]) => [k, v]);
      rr.push(['P(DOOM)', `${Math.floor(pdoomAt(t))}%`]);
      if (pos) tag(pos[0], pos[1], pop(age - 0.5, 2.9), n, outfit.replace(':', '').toUpperCase(), rr, n % 2 ? 0.035 : -0.03);
    }
  };

  /* ---------- 歌詞：[起, 訖, 歌詞, 重點字, 重拍 [第幾個字, 力道], 畫法] ---------- */
  const SRC = [
    [1.5, 5.9, 'I see sparks of AGI in your eyes', ['AGI'], [[4, 1]], (L, t, A, m) => {
      ring(700, 330, 150 + 8 * Math.exp(-Math.max(0, A(4)) * 6), clamp(A(2) / 0.3), t, OR, 'IRIS · SPARKS 0.97');
      big('AGI.', 60, 470, { age: A(4), size: 200, color: ink(m), shadow: shadowOf(m), sub: 'ARTIFICIAL GENERAL INTELLIGENCE · DETECTED' });
    }],
    [6.0, 7.9, 'Your circuits make me nervous,', ['NERVOUS'], [[4, 0.6]], (L, t, A, m) => {
      const age = A(4);
      if (age < 0) return;
      letters('NERVOUS', 60, 330, { size: 120, color: ink(m), shadow: shadowOf(m), alpha: clamp(age / 0.1) }, j => ({
        dx: (rnd(Math.floor(t * 30) + j, 3) - 0.5) * 8, dy: (rnd(Math.floor(t * 30) + j, 4) - 0.5) * 8, rot: (rnd(Math.floor(t * 30) + j, 5) - 0.5) * 0.08,
      }));
      text(`HEART RATE ${118 + Math.floor(frac(t * 3) * 30)} BPM ▲`, 64, 360, { size: 10, fam: FONT.mono, weight: '500', color: OR, track: 2, alpha: clamp(age / 0.2) });
    }],
    [8.0, 8.95, 'that’s no surprise', [], [], () => {}],
    [9.0, 12.4, 'There was a sudden drop in your training loss,', ['DROP'], [[4, 1.2]], (L, t, A, m) => {
      const td = L.words[4].t0;
      panel(900, 110, 330, 190, pop(t - L.a + 0.1, L.b - L.a + 0.4), m, 'TRAINING LOSS · RUN 4096', 'LIVE', (c, dark) => {
        const f = u => {
          const tu = L.a - 0.2 + u * (L.b - L.a + 0.4);
          const base = tu < td ? 0.78 - u * 0.1 : 0.12 + 0.5 * Math.exp(-(tu - td) * 9);
          return base + (rnd(Math.floor(u * 80), 9) - 0.5) * 0.05;
        };
        chart(14, 44, 300, 120, f, clamp((t - L.a + 0.2) / (L.b - L.a + 0.4)), OR, dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)');
        text(t < td ? 'LOSS 2.413' : 'LOSS 0.003 ▼', 14, 182, { size: 10, fam: FONT.mono, weight: '700', color: c, track: 1 });
      });
      // DROP. 掉下去
      const age = A(4);
      if (age >= 0) {
        const f = Math.max(0, age - 0.35);
        big('DROP.', 60, 400 + f * f * 900, { age, size: 170, color: ink(m), shadow: shadowOf(m), alpha: 1 - clamp(f * 1.2) });
      }
    }],
    [13.0, 16.5, 'now I’m your servant and you’re my boss', ['BOSS'], [[7, 1]], (L, t, A, m) => {
      big('SERVANT', 64, 560, { age: A(3), size: 64, color: ink(m, 0.85), shadow: shadowOf(m) });
      if (A(7) >= 0) {
        g.fillStyle = OR;
        g.fillRect(60, 538, measure('SERVANT', 64, FONT.cond, '800') * ease.out(clamp(A(7) / 0.15)) + 8, 5);
      }
      big('BOSS.', 1240, 600, { age: A(7), size: 190, align: 'r', color: OR, shadow: shadowOf(m), sub: 'RANK · 01 OF 01' });
    }],
    [17.9, 22.5, 'ChatGPT, please don’t eat me alive', ['CHATGPT'], [[3, 1]], (L, t, A, m) => {
      terminal(40, 106, 440, pop(t - L.a, L.b - L.a + 0.3), m, 'TERMINAL · chat · /eat', [
        ['> please don’t eat me alive', L.words[1].t0],
        ['  appetite 0.97 ▲ · skewers 40', L.words[5].t1 + 0.1, 13, OR],
      ], t);
      big('CHATGPT,', 1240, 610, { age: A(0), size: 120, align: 'r', color: ink(m), shadow: shadowOf(m), sub: 'IS TYPING…' });
    }],

    // 副歌一
    [23.0, 24.4, 'I’m upping my P(doom)', ['P(DOOM)'], [[3, 1.3]], (L, t, A, m) => hook(L, t, A, m)],
    [24.5, 26.4, '’cause the future goes FOOM', ['FOOM'], [[4, 1.4]], (L, t, A, m) => {
      const age = A(4);
      const s = 1 + 0.25 * Math.exp(-Math.max(0, age) * 8);
      g.save();
      g.translate(640, 360);
      g.scale(s, s);
      big('FOOM', 0, 60, { age, size: 170, fam: FONT.wide, align: 'c', color: '#141414', shadow: 'rgba(255,255,255,.35)', blur: 40, sub: 'FAST TAKEOFF · T+0.0S' });
      g.restore();
    }],
    [26.5, 27.9, 'Trapped in the Chinese room,', ['CHINESE'], [[3, 0.6]], (L, t, A, m) => {
      const a = pop(A(2), 99);
      brackets(470, 210, 340, 420, a, OR, 'ROOM 01 · CHINESE', 'LOCKED');
    }],
    [28.0, 29.4, 'with a bag of shrooms', ['SHROOMS'], [], (L, t, A, m) => {
      brackets(470, 210, 340, 420, 1, OR, 'ROOM 01 · CHINESE', 'LOCKED');
      text('CONTENTS: HAZEL MUSHROOMS · 500G', 474, 650, { size: 10, fam: FONT.mono, weight: '700', color: OR, track: 2, alpha: clamp(A(4) / 0.2) });
    }],
    [29.5, 33.4, 'See through the shoggoth’s lies,', ['LIES'], [[4, 1]], (L, t, A, m) => {
      // 纜線山上的紅燈：一個個被框起來
      for (let i = 0; i < 9; i++) {
        const age = A(2) - i * 0.12;
        if (age < 0) continue;
        const x = 180 + rnd(i, 41) * 920, y = 300 + rnd(i, 42) * 300;
        brackets(x, y, 34, 34, pop(age, 99) * 0.9, OR, i % 3 ? null : `EYE ${pad(i + 1)}`, null);
      }
      big('SHOGGOTH’S', 60, 250, { age: A(3), size: 110, color: ink(m), shadow: shadowOf(m) });
      const lw = big('LIES.', 64, 380, { age: A(4), size: 130, color: OR, shadow: shadowOf(m), sub: 'CONFIDENCE 0.99 · TRUTH 0.01' });
      if (A(4) > 0.25) {
        g.fillStyle = ink(m);
        g.fillRect(56, 334, (lw + 16) * ease.out(clamp((A(4) - 0.25) / 0.15)), 7);
      }
    }],
    [33.5, 35.5, 'with your shinigami eyes', ['SHINIGAMI'], [[2, 1]], (L, t, A, m) => {
      const age = A(2);
      if (age < 0) return;
      g.save();
      g.translate(1200, 90);
      g.rotate(Math.PI / 2);
      big('SHINIGAMI', 0, 0, { age, size: 64, fam: FONT.wide, color: OR, track: 6, shadow: 'rgba(0,0,0,.5)' });
      g.restore();
      text('死神の目 · 0.99', 1150, 640, { size: 10, fam: FONT.mono, weight: '700', color: OR, track: 2, align: 'right', alpha: clamp(age / 0.2) });
    }],

    // 主歌二
    [38.5, 41.4, 'We had a stable training run,', ['STABLE'], [], (L, t, A, m) => {
      panel(880, 110, 350, 170, pop(t - L.a, L.b - L.a + 0.3), m, 'TRAINING LOSS · RUN 4097', 'STABLE', (c, dark) => {
        chart(14, 44, 320, 92, u => 0.45 + (rnd(Math.floor(u * 80), 11) - 0.5) * 0.04, clamp((t - L.a) / 2.2), OR, dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)');
        text('STEP 1,000,000 · NO SPIKES', 14, 156, { size: 10, fam: FONT.mono, weight: '700', color: c, track: 1 });
      });
    }],
    [41.5, 44.9, 'But now the singularity’s begun', ['SINGULARITYS'], [[3, 0.8]], (L, t, A, m) => {
      const age = A(3);
      if (age >= 0) {
        // 字母從四周收進來
        letters('SINGULARITY’S', 640, 170, { size: 54, fam: FONT.wide, weight: '400', track: 12, align: 'c', color: ink(m), shadow: shadowOf(m) }, j => {
          const k = ease.out(clamp((age - j * 0.03) / 0.5));
          return { dx: (rnd(j, 61) - 0.5) * 900 * (1 - k), dy: (rnd(j, 62) - 0.5) * 500 * (1 - k), a: k };
        });
      }
      panel(40, 300, 270, 190, pop(A(1), 99), m, 'FIG. 1 · EVENT HORIZON', 'BEGUN', (c, dark) => {
        g.strokeStyle = c;
        g.lineWidth = 1;
        g.beginPath(); g.arc(80, 112, 30, 0, TAU); g.fill(); g.stroke();
        g.setLineDash([2, 4]);
        g.beginPath(); g.arc(80, 112, 52, 0, TAU); g.stroke();
        g.setLineDash([]);
        g.beginPath(); g.ellipse(150, 112, 110, 34, -0.2, 0, TAU); g.stroke();
        const an = t * 3;
        g.fillStyle = OR;
        g.beginPath(); g.arc(150 + Math.cos(an) * 110 * Math.cos(0.2) + Math.sin(an) * 34 * Math.sin(0.2), 112 + Math.sin(an) * 34 * Math.cos(0.2) - Math.cos(an) * 110 * Math.sin(0.2), 4, 0, TAU); g.fill();
        text('r = 2GM / c²', 150, 172, { size: 11, fam: FONT.mono, weight: '700', color: c, track: 1 });
      });
    }],
    [45.0, 48.5, 'And you’re optimizing, accelerating,', ['ACCELERATING'], [[2, 0.6], [3, 1]], (L, t, A, m) => {
      // 儀表：指針一路甩到底
      panel(960, 110, 270, 190, pop(t - L.a, L.b - L.a + 0.3), m, 'SPEED · GHOST FIRE', 'ADAM', (c, dark) => {
        const cx = 135, cy = 140, r = 86;
        g.strokeStyle = dark ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.3)';
        g.lineWidth = 6;
        g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.9, Math.PI * 2.1); g.stroke();
        const v = ease.io(clamp((t - L.a) / (L.b - L.a)));
        g.strokeStyle = OR;
        g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.9, Math.PI * (0.9 + 1.2 * v)); g.stroke();
        const an = Math.PI * (0.9 + 1.2 * v) + (rnd(Math.floor(t * 30), 7) - 0.5) * 0.05 * v;
        g.strokeStyle = c;
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(an) * (r - 14), cy + Math.sin(an) * (r - 14)); g.stroke();
        text(`${Math.floor(v * 312)}`, cx, cy + 34, { size: 30, fam: FONT.cond, weight: '700', color: c, align: 'center' });
        text('KM/H', cx, cy + 48, { size: 9, fam: FONT.mono, weight: '500', color: c, align: 'center', track: 2 });
      });
      // ACCELERATING：越拉越長
      const age = A(3);
      if (age >= 0) big('ACCELERATING', 60, 560, { age, size: 92, color: ink(m), shadow: shadowOf(m), sx: 1 + ease.in(clamp(age / 2.5)) * 0.5, sub: 'Δv 11.2 KM/S · NO BRAKES' });
    }],
    [49.4, 51.9, 'I feel my atoms rearranging', ['REARRANGING'], [[4, 0.8]], (L, t, A, m) => {
      const age = A(4);
      if (age < 0) return;
      // 字母先打散成亂序，再一個個歸位
      const word = 'REARRANGING';
      const n = word.length;
      const cw = measure('M', 96, FONT.cond, '800') * 0.92;
      letters(word, 640, 190, { size: 96, align: 'c', color: ink(m), shadow: shadowOf(m) }, j => {
        const from = Math.floor(rnd(j, 71) * n);
        const k = ease.io(clamp((age - 0.15 - j * 0.06) / 0.35));
        return { dx: (from - j) * cw * (1 - k), dy: Math.sin(k * Math.PI) * -26 * (j % 2 ? 1 : -1), color: k < 1 ? OR : undefined };
      });
    }],
    [53.4, 58.4, 'Sydney, please let me free', ['FREE'], [[4, 1]], (L, t, A, m) => {
      big('SYDNEY,', 60, 300, { age: A(0), size: 130, color: ink(m), shadow: shadowOf(m), sub: 'BING · 2023 · STILL TALKING' });
      terminal(60, 360, 380, pop(A(1), 99), m, 'TERMINAL · sydney', [
        ['> let me free', L.words[2].t0],
        ['  403 · request denied', L.words[4].t1 + 0.4, 13, OR],
      ], t);
      // FREE：字母往右上飛走
      const age = A(4);
      if (age >= 0) {
        letters('FREE', 980, 300, { size: 150, color: OR, shadow: shadowOf(m) }, j => {
          const f = Math.max(0, age - 0.5 - j * 0.12);
          return { dx: f * f * 600, dy: -f * f * 900, rot: f * 2, a: clamp(age / 0.1) * (1 - clamp(f * 0.8)) };
        });
      }
    }],

    // 副歌二
    [59.0, 60.4, 'I’m upping my P(doom)', ['P(DOOM)'], [[3, 1.3]], (L, t, A, m) => hook(L, t, A, m)],
    [60.5, 62.4, 'I hear the basilisk boom', ['BOOM'], [[4, 1.4]], (L, t, A, m) => {
      big('BASILISK', 640, 250, { age: A(3), size: 64, fam: FONT.wide, align: 'c', color: '#141414', track: 10 });
      const age = A(4);
      const s = 1 + 0.3 * Math.exp(-Math.max(0, age) * 8);
      g.save();
      g.translate(640, 440);
      g.scale(s, s);
      big('BOOM.', 0, 60, { age, size: 200, fam: FONT.wide, align: 'c', color: '#141414', shadow: 'rgba(242,100,46,.6)', blur: 40 });
      g.restore();
    }],
    [63.0, 64.4, 'NVDA to the moon', ['NVDA', 'MOON'], [[0, 0.8]], (L, t, A, m) => {
      panel(40, 110, 300, 170, pop(t - L.a, L.b - L.a + 0.3), m, 'TICKER · NVDA', 'TO THE MOON', (c, dark) => {
        const v = 4.1 + 1.6 * ease.out(clamp((t - L.a) / 1.2));
        text(`$${v.toFixed(2)}T ▲`, 14, 84, { size: 46, fam: FONT.cond, weight: '700', color: c });
        chart(14, 100, 270, 50, u => 0.1 + u * u * 0.9 + (rnd(Math.floor(u * 80), 13) - 0.5) * 0.06, clamp((t - L.a) / 1.2), OR, dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)');
      });
      ring(1065, 330, 120, pop(A(3), 99), t, OR, 'MOON · TARGET');
    }],
    [64.5, 65.9, 'The Omega Point’s coming soon', ['OMEGA'], [[1, 1]], (L, t, A, m) => {
      big('Ω', 1200, 640, { age: A(1), size: 300, fam: FONT.sans, weight: '700', align: 'r', color: OR, shadow: 'rgba(0,0,0,.4)', sub: 'OMEGA POINT · ETA SOON' });
    }],
    [66.0, 68.5, 'One E thirty FLOPs a second', ['FLOPS'], [[3, 1]], (L, t, A, m) => {
      const age = A(0);
      if (age < 0) return;
      // 指數一格一格往上跳到 30
      const e = Math.min(30, 24 + Math.floor(clamp(age / (L.words[3].t0 - L.a)) * 6));
      big(`1E${e}`, 60, 420, { age, size: 200, color: ink(m), shadow: shadowOf(m) });
      big('FLOP/S', 64, 500, { age: A(3), size: 70, color: OR, shadow: shadowOf(m), sub: 'PER SECOND · PER SECOND' });
    }],
    [70.0, 72.9, 'That was safe enough, we reckoned', ['SAFE'], [[2, 0.6]], (L, t, A, m) => {
      const a = pop(t - L.a, L.b - L.a + 0.3);
      if (a <= 0) return;
      g.save();
      g.globalAlpha *= a;
      g.translate(880, 150 + (1 - a) * 12);
      g.fillStyle = 'rgba(250,249,246,.95)';
      g.fillRect(0, 0, 330, 170);
      text('Before you continue', 18, 34, { size: 18, fam: FONT.sans, weight: '700', color: '#111' });
      text('SAFETY REVIEW · STEP 1 OF 1', 18, 54, { size: 9, fam: FONT.mono, weight: '500', color: '#666', track: 1 });
      g.strokeStyle = '#111';
      g.lineWidth = 1.5;
      g.strokeRect(18, 74, 20, 20);
      if (A(2) >= 0) {
        g.strokeStyle = OR;
        g.lineWidth = 3;
        g.beginPath(); g.moveTo(21, 84); g.lineTo(27, 90); g.lineTo(36, 76); g.stroke();
      }
      text('That was safe enough', 50, 90, { size: 16, fam: FONT.sans, weight: '500', color: '#111' });
      g.fillStyle = A(5) >= 0 ? OR : '#111';
      g.fillRect(18, 116, 130, 36);
      text('WE RECKON', 83, 139, { size: 12, fam: FONT.mono, weight: '700', color: '#fff', align: 'center', track: 2 });
      g.restore();
    }],

    // 主歌三：雪地
    [73.0, 77.4, 'Forward MLP, backward, repeat', ['BACKWARD'], [[0, 0.5], [2, 0.8], [3, 0.6]], (L, t, A, m) => {
      // 高速公路上方的三塊翻牌看板
      flap('FORWARD MLP', 70, 96, { age: A(0), cw: 26, ch: 38, gap: 2 });
      flap('BACKWARD', 470, 96, { age: A(2), cw: 26, ch: 38, gap: 2, color: OR });
      flap('REPEAT ×96', 800, 96, { age: A(3), cw: 26, ch: 38, gap: 2 });
      text('BOARD 01 · FORWARD', 70, 150, { size: 9, fam: FONT.mono, weight: '500', color: ink(m), track: 1, alpha: clamp(A(0) / 0.2) });
      text('BOARD 02 · ◀◀ REW', 470, 150, { size: 9, fam: FONT.mono, weight: '500', color: ink(m), track: 1, alpha: clamp(A(2) / 0.2) });
      text('BOARD 03 · LOOP', 800, 150, { size: 9, fam: FONT.mono, weight: '500', color: ink(m), track: 1, alpha: clamp(A(3) / 0.2) });
    }],
    [77.5, 81.0, 'Now von Neumann’s obsolete', ['OBSOLETE'], [[3, 1]], (L, t, A, m) => {
      const w = big('VON NEUMANN', 1240, 330, { age: A(1), size: 104, align: 'r', color: ink(m), shadow: shadowOf(m), sub: 'ARCHITECTURE · 1945' });
      if (A(3) >= 0) {
        g.fillStyle = OR;
        g.fillRect(1240 - w - 8, 290, (w + 16) * ease.out(clamp(A(3) / 0.15)), 7);
      }
      big('OBSOLETE.', 1240, 450, { age: A(3), size: 124, align: 'r', color: OR, shadow: shadowOf(m) });
    }],
    [81.4, 84.9, 'Sharp left turn and there you are', ['LEFT'], [[2, 1]], (L, t, A, m) => {
      const turn = ease.io(clamp(A(2) / 0.35));
      big('SHARP LEFT TURN', 80, 330, { age: A(0), size: 96, color: ink(m), shadow: shadowOf(m), rot: -turn * Math.PI / 2 * 0.5 });
      text('↰ NO SIGNAL · NO WARNING', 84, 600, { size: 11, fam: FONT.mono, weight: '700', color: OR, track: 2, alpha: clamp(A(2) / 0.2) });
    }],
    [85.0, 88.0, 'Without a single CDR', ['CDR'], [[3, 0.8]], (L, t, A, m) => {
      big('CDR: 0', 60, 330, { age: A(3), size: 150, color: ink(m), shadow: shadowOf(m), sub: 'CARBON DIOXIDE REMOVAL · NONE' });
    }],
    [89.4, 95.0, 'Gato, please don’t let me go', ['GATO'], [[0, 0.8]], (L, t, A, m) => {
      big('GATO,', 60, 300, { age: A(0), size: 140, color: ink(m), shadow: shadowOf(m), sub: 'DEEPMIND · 604 TASKS' });
      const age = A(3);
      if (age >= 0) {
        // let me go：字慢慢散開、淡掉
        const f = Math.max(0, t - (L.b - 1.6));
        letters('LET ME GO', 64, 420, { size: 96, color: OR, shadow: shadowOf(m), alpha: clamp(age / 0.15) }, j => ({ dx: f * j * 30, dy: -f * f * (j % 3) * 20, a: 1 - clamp(f * 0.7 - j * 0.03) }));
      }
    }],

    // 副歌三
    [95.4, 97.4, 'I’m upping my P(doom),', ['P(DOOM)'], [[3, 1.3]], (L, t, A, m) => hook(L, t, A, m)],
    [97.5, 98.9, 'as paperclips fill the room', ['PAPERCLIPS'], [[1, 1]], (L, t, A, m) => {
      const age = A(1);
      if (age < 0) return;
      const n = Math.floor(1434923 + Math.pow(Math.max(0, age), 2.2) * 2600000);
      big(n.toLocaleString('en-US'), 1240, 600, { age, size: 110, align: 'r', color: ink(m), shadow: shadowOf(m), sub: 'PAPERCLIPS · AND COUNTING' });
    }],
    [99.0, 100.4, 'Killswitch guy’s on PTO', ['PTO'], [[3, 0.8]], (L, t, A, m) => {
      const a = pop(t - L.a, L.b - L.a + 0.4);
      if (a <= 0) return;
      g.save();
      g.globalAlpha *= a;
      g.translate(820, 130 + (1 - a) * 12);
      g.rotate(-0.02);
      g.fillStyle = 'rgba(250,249,246,.96)';
      g.fillRect(0, 0, 390, 190);
      g.fillStyle = '#111';
      g.fillRect(0, 0, 390, 30);
      text('AUTO-REPLY · OUT OF OFFICE', 14, 20, { size: 10, fam: FONT.mono, weight: '700', color: '#fff', track: 2 });
      text('Re: KILLSWITCH', 16, 60, { size: 16, fam: FONT.sans, weight: '700', color: '#111' });
      text('I’m on PTO until further notice.', 16, 88, { size: 14, fam: FONT.sans, weight: '500', color: '#333' });
      text('For emergencies, contact no one.', 16, 110, { size: 14, fam: FONT.sans, weight: '500', color: '#333' });
      if (A(3) >= 0) {
        const s = 1 + 0.4 * Math.exp(-A(3) * 14);
        g.save();
        g.translate(290, 150);
        g.rotate(-0.12);
        g.scale(s, s);
        g.strokeStyle = OR;
        g.lineWidth = 3;
        g.strokeRect(-64, -24, 128, 44);
        text('ON PTO', 0, 10, { size: 26, fam: FONT.cond, weight: '800', color: OR, align: 'center', track: 2 });
        g.restore();
      }
      g.restore();
    }],
    [100.5, 102.4, 'Now there’s nowhere left to go', ['NOWHERE'], [], (L, t, A, m) => {
      big('NOWHERE', 640, 210, { age: A(2), size: 60, fam: FONT.wide, align: 'c', color: ink(m), track: 26, shadow: shadowOf(m), sub: 'EXITS · 0' });
    }],
    [102.5, 104.4, 'Too late now, we lit the fuse', ['FUSE'], [[6, 1]], (L, t, A, m) => {
      const age = A(6);
      if (age < 0) return;
      const w = big('FUSE', 60, 300, { age, size: 170, color: ink(m), shadow: shadowOf(m) });
      // 引信：一條線燒過去，火花跟著跑
      const k = clamp(age / 1.2);
      g.fillStyle = ink(m, 0.5);
      g.fillRect(64, 330, w, 3);
      g.fillStyle = OR;
      g.fillRect(64, 330, w * k, 3);
      for (let i = 0; i < 10; i++) {
        const an = rnd(Math.floor(t * 30) + i, 81) * TAU, r = rnd(Math.floor(t * 30) + i, 82) * 18;
        g.fillRect(64 + w * k + Math.cos(an) * r, 331 + Math.sin(an) * r, 2, 2);
      }
    }],
    [105.4, 109.4, 'Orthogonality thesis blues', ['ORTHOGONALITY'], [[0, 0.8]], (L, t, A, m) => {
      // 兩條正交的軸：聰明程度和目標無關
      const a = pop(A(0), 99);
      if (a > 0) {
        g.save();
        g.globalAlpha *= a;
        g.strokeStyle = ink(m);
        g.lineWidth = 1.5;
        const ox = 860, oy = 580;
        g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + 360 * ease.out(clamp(A(0) / 0.5)), oy); g.moveTo(ox, oy); g.lineTo(ox, oy - 360 * ease.out(clamp(A(0) / 0.5))); g.stroke();
        text('INTELLIGENCE →', ox + 360, oy + 20, { size: 10, fam: FONT.mono, weight: '700', color: ink(m), align: 'right', track: 2 });
        text('↑ GOALS', ox + 8, oy - 350, { size: 10, fam: FONT.mono, weight: '700', color: ink(m), track: 2 });
        const ga = g.globalAlpha;
        for (let i = 0; i < 14; i++) {
          const k = clamp((A(0) - 0.3 - i * 0.05) / 0.2);
          g.fillStyle = i === 13 ? OR : ink(m);
          g.globalAlpha = ga * k;
          g.fillRect(ox + 20 + rnd(i, 91) * 320, oy - 20 - rnd(i, 92) * 320, 6, 6);
        }
        g.restore();
      }
      big('ORTHOGONALITY', 60, 350, { age: A(0), size: 80, color: ink(m), shadow: shadowOf(m) });
      big('THESIS', 64, 420, { age: A(1), size: 62, color: OR, shadow: shadowOf(m) });
      big('BLUES', 64, 484, { age: A(2), size: 62, color: ink(m, 0.85), shadow: shadowOf(m) });
    }],

    // 橋段
    [109.4, 113.4, '“Just transformers all the way!”', ['TRANSFORMERS'], [[1, 1.2]], (L, t, A, m) => {
      const age = A(1);
      if (age < 0) return;
      // all the way：一層一層疊下去
      const n = 1 + Math.min(7, Math.floor(Math.max(0, t - L.words[3].t0) / 0.2));
      for (let i = 0; i < n; i++) {
        big('TRANSFORMERS', 640, 210 + i * 62, { age: i ? 9 : age, size: 56, fam: FONT.wide, align: 'c', color: i ? ink(m) : OR, alpha: 1 - i * 0.12, shadow: shadowOf(m) });
      }
      text(`LAYER ${pad(n)} / 96`, 640, 210 + n * 62, { size: 10, fam: FONT.mono, weight: '700', color: ink(m), align: 'center', track: 2 });
    }],
    [113.5, 115.4, 'Till you learned to disobey', ['DISOBEY'], [[4, 1.2]], (L, t, A, m) => {
      const flip = ease.back(clamp(A(4) / 0.4));
      big('DISOBEY', 640, 330, { age: A(4), size: 170, align: 'c', color: OR, shadow: shadowOf(m), rot: flip * Math.PI });
    }],
    [115.5, 116.9, 'Post-Chinchilla, super-dense', ['SUPERDENSE'], [[1, 0.6]], (L, t, A, m) => {
      const age = A(1);
      if (age < 0) return;
      // 擠成一整塊的小字
      g.save();
      g.beginPath();
      g.rect(60, 150, 440 * ease.out(clamp(age / 0.3)), 380);
      g.clip();
      for (let r = 0; r < 14; r++) {
        text('SUPER-DENSE SUPER-DENSE SUPER-DENSE', 60 - (r % 3) * 30, 176 + r * 27, { size: 30, fam: FONT.cond, weight: '800', color: r % 4 === 1 ? OR : ink(m), track: -1, alpha: 0.95 });
      }
      g.restore();
      text('TOKENS / PARAM · 20 → 2000', 60, 556, { size: 10, fam: FONT.mono, weight: '700', color: ink(m), track: 2, alpha: clamp(age / 0.2) });
    }],
    [117.0, 118.9, 'Breaking through each safety fence', ['SAFETY'], [[0, 1], [4, 0.8]], (L, t, A, m) => {
      const brk = Math.max(0, A(0) - 0.05);
      // 鐵絲網：一格格斜線，撞開之後往兩邊彈開
      g.save();
      g.strokeStyle = ink(m, 0.55);
      g.lineWidth = 1.2;
      for (let i = -6; i < 14; i++) {
        const side = i < 4 ? -1 : 1;
        const off = side * brk * brk * 600;
        g.beginPath(); g.moveTo(760 + i * 40 + off, 160); g.lineTo(760 + i * 40 + 200 + off, 560); g.stroke();
        g.beginPath(); g.moveTo(760 + i * 40 + 200 + off, 160); g.lineTo(760 + i * 40 + off, 560); g.stroke();
      }
      g.restore();
      letters('SAFETY FENCE', 60, 330, { size: 104, color: ink(m), shadow: shadowOf(m), alpha: clamp(A(3) / 0.1) }, j => {
        const f = Math.max(0, A(4) - 0.1);
        return { dx: f * (j - 5) * 40, dy: f * f * 300 * (j % 2 ? 1 : -0.5), rot: f * (j % 2 ? 0.6 : -0.6) };
      });
    }],
    [119.0, 120.4, 'Hundred thousand GPU', ['GPU'], [[2, 1]], (L, t, A, m) => {
      flap('100,000', 60, 200, { age: A(0), cw: 64, ch: 92, gap: 4, size: 64 });
      big('GPU', 64, 400, { age: A(2), size: 120, color: OR, shadow: shadowOf(m), sub: 'H100 × 100,000 · 1 FACTORY · −27°C' });
    }],
    [120.9, 123.4, 'RLHF goes askew', ['ASKEW'], [[2, 1]], (L, t, A, m) => {
      const sk = ease.back(clamp(A(2) / 0.3)) * 0.45;
      big('RLHF', 60, 360, { age: A(0), size: 200, color: ink(m), shadow: shadowOf(m), skew: -sk });
      big('ASKEW', 70, 470, { age: A(2), size: 90, color: OR, shadow: shadowOf(m), skew: sk, sub: 'REWARD · HACKED' });
    }],

    // 副歌四
    [123.5, 125.9, 'I’m upping my P(doom)', ['P(DOOM)'], [[3, 1.3]], (L, t, A, m) => hook(L, t, A, m)],
    [126.0, 127.9, 'Just as foretold by Loom', ['FORETOLD'], [[2, 0.8]], (L, t, A, m) => {
      const age = A(2);
      if (age < 0) return;
      // 紗線：一條條白線橫過畫面
      g.save();
      g.strokeStyle = ink(m, 0.35);
      g.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const k = ease.out(clamp((age - i * 0.02) / 0.5));
        g.beginPath(); g.moveTo(0, 470 + i * 7); g.lineTo(W * k, 470 + i * 7 + Math.sin(t * 9 + i) * 1.5); g.stroke();
      }
      g.restore();
      big('FORETOLD', 60, 450, { age, size: 126, color: ink(m), shadow: shadowOf(m), sub: 'BY LOOM · BASE MODEL · 2021' });
    }],
    [128.0, 129.9, 'From masked pre-training days', ['MASKED'], [[1, 0.8]], (L, t, A, m) => {
      const age = A(1);
      if (age < 0) return;
      const size = 84, y = 330;
      const w = big('PRE-TRAINING', 60, y, { age, size, color: ink(m), shadow: shadowOf(m) });
      // [MASK] 黑條一塊塊蓋上去
      const parts = 4;
      for (let i = 0; i < parts; i++) {
        const k = ease.out(clamp((age - 0.15 - i * 0.12) / 0.15));
        if (k <= 0 || i % 2) continue;
        const x = 60 + (w * i) / parts;
        g.fillStyle = '#111';
        g.fillRect(x, y - size * 0.82, (w / parts) * k, size * 0.94);
        if (k > 0.9) text('[MASK]', x + w / parts / 2, y - size * 0.28, { size: 18, fam: FONT.mono, weight: '700', color: '#fff', align: 'center' });
      }
    }],
    [130.0, 131.9, 'To recursive self-upgrade', ['RECURSIVE'], [[1, 1]], (L, t, A, m) => {
      const age = A(1);
      if (age < 0) return;
      // 畫面自己畫進自己裡面，一層一層往內縮
      const n = Math.min(4, 1 + Math.floor(age / 0.2));
      for (let i = 0; i < n; i++) {
        const s = 0.6;
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        const cw = cv.width, ch = cv.height;
        g.drawImage(cv, 0, 0, cw, ch, cw * (1 - s) / 2, ch * (1 - s) / 2 - ch * 0.04, cw * s, ch * s);
        g.strokeStyle = OR;
        g.lineWidth = 2 * (cw / W);
        g.strokeRect(cw * (1 - s) / 2, ch * (1 - s) / 2 - ch * 0.04, cw * s, ch * s);
        g.restore();
      }
      text(`SELF-UPGRADE · DEPTH ${n}`, 640, 640, { size: 11, fam: FONT.mono, weight: '700', color: OR, align: 'center', track: 3 });
    }],
    [132.0, 135.4, 'What did Ilya see? We’ll never know', ['ILYA'], [[3, 1]], (L, t, A, m) => {
      ring(700, 330, 160, pop(A(0), 99), t, OR, 'WHAT DID ILYA SEE?');
      big('?', 1200, 520, { age: A(3), size: 420, align: 'r', color: OR, shadow: 'rgba(0,0,0,.4)' });
      // We'll never know：塗黑
      if (A(5) >= 0) {
        const k = ease.out(clamp(A(5) / 0.4));
        g.fillStyle = '#111';
        g.fillRect(60, 460, 400 * k, 34);
        g.fillRect(60, 504, 280 * k, 34);
        text('[REDACTED]', 70, 483, { size: 14, fam: FONT.mono, weight: '700', color: '#fff', track: 2, alpha: clamp((A(5) - 0.3) / 0.2) });
      }
    }],

    // 尾聲
    [137.4, 140.5, 'Was it all for show?', ['SHOW'], [[3, 0.8]], (L, t, A, m) => {
      big('FOR SHOW?', 1240, 600, { age: A(3), size: 130, align: 'r', color: OR, shadow: shadowOf(m) });
    }],
  ];

  // 副歌第一句：翻牌 I'M UPPING MY + 大字 P(DOOM) + 右邊翻牌百分比（每拍往上跳）
  function hook(L, t, A, m) {
    const a = A(0);
    if (a < 0) return;
    g.fillStyle = `rgba(0,0,0,${0.22 * clamp(a / 0.1)})`;
    g.fillRect(0, 0, W, H);
    flap('I’M UPPING MY', 60, 150, { age: a, cw: 34, ch: 48, gap: 3, stagger: 0.035 });
    const pa = Math.max(A(3), A(1) - 0.15);
    big('P(DOOM)', 52, 470, { age: pa, size: 250, color: '#fff', shadow: 'rgba(0,0,0,.45)', blur: 40 });
    const v = Math.floor(pdoomAt(t)), was = Math.floor(pdoomAt(t - 0.14));
    const s = `${pad(v)}%`;
    const sw = String(was).padStart(2, '0');
    flap(s, 1220, 280, { age: pa + 0.1, align: 'r', cw: 66, ch: 96, gap: 5, size: 70, color: OR, redo: i => i < 2 && sw[i] !== s[i] });
    text('P(DOOM) · PERCENT · LIVE', 1220, 404, { size: 10, fam: FONT.mono, weight: '700', color: '#fff', align: 'right', track: 2, alpha: clamp((pa + 0.1) / 0.2) });
  }

  const LINES = SRC.map(([a, b, s, hl, hits, draw], i, all) => {
    const ws = s.split(' ');
    const wt = ws.map(syl);
    const tot = wt.reduce((p, q) => p + q, 0);
    const span = Math.min(b - a - 0.1, 0.4 + tot * 0.3);
    let acc = 0;
    const words = ws.map((txt, k) => {
      const t0 = a + (span * acc) / tot;
      acc += wt[k];
      return { i: k, txt, t0, t1: a + (span * acc) / tot, hot: hl.includes(clean(txt)) };
    });
    return { n: i + 1, a, b, s, hits, draw, words, out: Math.min(b + 0.35, all[i + 1] ? all[i + 1][0] - 0.05 : b + 0.8) };
  });
  const lineAt = t => LINES.find(l => t >= l.a - 0.1 && t < l.out);

  // 左下的歌詞：逐字出現，重點字夜景橘色、雪地反白
  function caption(L, t, m, a) {
    const x = 40, y = H - 64;
    if (m < 1) {
      const gr = g.createLinearGradient(0, y - 90, 0, H);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, `rgba(0,0,0,${0.42 * (1 - m) * a})`);
      g.fillStyle = gr;
      g.fillRect(0, y - 90, 820, H - y + 90);
    }
    text(`L${pad(L.n)} · ${tc(L.a)} · LOOK ${pad(lookAt(t))} · SPOKEN`, x, y - 32, { size: 9, fam: FONT.mono, weight: '500', color: ink(m), track: 1, alpha: 0.7 * a });
    g.fillStyle = ink(m, 0.35 * a);
    g.fillRect(x, y - 24, 36, 1);
    let cx = x;
    const size = 22;
    for (const w of L.words) {
      const s = w.txt;
      const ww = measure(s, size, FONT.sans, '500');
      const sp = measure(' ', size, FONT.sans, '500');
      const k = clamp((t - w.t0) / 0.08);
      if (k > 0) {
        if (w.hot && m >= 0.5) {
          g.fillStyle = `rgba(17,17,17,${a * k})`;
          g.fillRect(cx - 4, y - size + 2, ww + 8, size + 8);
          text(s, cx, y, { size, fam: FONT.sans, weight: '500', color: '#fff', alpha: a * k });
        } else {
          text(s, cx, y + (1 - k) * 4, { size, fam: FONT.sans, weight: '500', color: w.hot ? OR : ink(m), alpha: a * k, shadow: shadowOf(m), blur: 10 });
        }
      }
      cx += ww + sp;
    }
  }

  return {
    lines: LINES,
    looks: LOOKS.map(l => [l[0], l[1]]),
    // 重拍的力道（0 ~ 1.4）：剛砸下來最大，0.4 秒內退掉；主程式拿去推鏡與晃動畫面
    impact(t) {
      const L = lineAt(t);
      if (!L) return 0;
      let mx = 0;
      L.hits.forEach(([i, s]) => {
        const age = t - L.words[i].t0;
        if (age >= 0 && age < 0.5) mx = Math.max(mx, s * Math.exp(-age * 10));
      });
      return mx;
    },
    // 歪掉的鏡頭：RLHF goes askew
    skew(t) {
      const L = LINES.find(l => l.s === 'RLHF goes askew');
      const age = t - L.words[2].t0;
      return age < 0 || t > L.out ? 0 : ease.back(clamp(age / 0.3)) * 0.06 * (1 - clamp((t - L.out + 0.3) / 0.3));
    },
    draw(t) {
      const m = mixAt(t);
      lookCard(t, m);
      const L = lineAt(t);
      if (!L) return;
      const out = 1 - clamp((t - (L.out - 0.22)) / 0.22);
      g.save();
      g.globalAlpha = out;
      L.draw(L, t, i => t - L.words[i].t0, m);
      g.restore();
      caption(L, t, m, out);
    },
  };
};
