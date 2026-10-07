/* =========================================================
   Claude Pop（claude-pop.html）：剪紙工具箱
   每個場景共用的畫法：紙的陰影、撕邊、錯版印刷的字、剪貼字、翻牌看板、
   吊牌、條碼、印章、網點、放射光、紙紋
   - 陰影大小用裝置像素算（canvas 的陰影不吃 transform），所以要知道目前的縮放 env.px()
   - 「抖」：剪紙每秒 12 格換一次微小的位移與角度（boil），像定格動畫
   用法：const K = ClaudePopKit(ctx, { px: () => 目前每單位幾個裝置像素, frame: () => 12 格的格數 })
   ========================================================= */
(() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const rnd = (i, n = 0) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };

  const C = {
    paper: '#efe9dd', cream: '#f7f3ea', ink: '#141210', night: '#141a33', deep: '#0d1024',
    orange: '#f26a36', orangeDeep: '#bf451d', blue: '#3550c8', pink: '#ff6fa3', yellow: '#ffd23f',
    gray: '#8c877d', red: '#e5432f', mint: '#5df5c2', kraft: '#c9a878', green: '#cfe3c4',
  };
  const FALL = 'system-ui, sans-serif';
  const F = {
    cond: `Anton, Impact, "Arial Narrow", ${FALL}`,
    wide: `"Archivo Black", "Arial Black", ${FALL}`,
    serif: `"Instrument Serif", Georgia, "Times New Roman", serif`,
    mono: `"JetBrains Mono", ui-monospace, Consolas, monospace`,
    sans: `Inter, "Helvetica Neue", Arial, ${FALL}`,
    jp: `"Noto Serif JP", "Noto Serif TC", serif`,
    times: `"Times New Roman", Times, serif`,
  };

  window.ClaudePopKit = function (g, env) {
    const px = () => env.px();
    const frame = () => env.frame();

    const shadow = (lvl = 1, a) => {
      if (!lvl) { g.shadowColor = 'rgba(0,0,0,0)'; return; }
      const k = px();
      const L = [null, [4, 1.5, 2.5, 0.26], [9, 3, 5, 0.28], [16, 5, 9, 0.3], [26, 8, 14, 0.32]][lvl];
      g.shadowColor = `rgba(18,10,6,${a != null ? a : L[3]})`;
      g.shadowBlur = L[0] * k;
      g.shadowOffsetX = L[1] * k;
      g.shadowOffsetY = L[2] * k;
    };
    const noShadow = () => { g.shadowColor = 'rgba(0,0,0,0)'; };
    const font = (size, fam = F.cond, weight = '', italic = false) => `${italic ? 'italic ' : ''}${weight ? weight + ' ' : ''}${size}px ${fam}`;

    // 定格動畫的抖動：同一個 seed 每 1/12 秒換一次
    const boil = (seed, amp = 1) => {
      const f = frame();
      return [(rnd(f, seed) - 0.5) * 2 * amp, (rnd(f, seed + 7.3) - 0.5) * 2 * amp, (rnd(f, seed + 3.1) - 0.5) * 0.012 * amp];
    };

    // 撕邊：沿著一條線加上鋸齒
    const torn = (x0, y0, x1, y1, seed = 1, amp = 6, step = 14, first = true) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(2, Math.round(len / step));
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const j = i === 0 || i === n ? 0 : (rnd(i, seed) - 0.5) * 2 * amp;
        const x = x0 + (x1 - x0) * k + nx * j, y = y0 + (y1 - y0) * k + ny * j;
        if (i === 0 && first) g.moveTo(x, y); else g.lineTo(x, y);
      }
    };
    const tornRect = (x, y, w, h, seed = 1, amp = 5, edges = 'tb') => {
      g.beginPath();
      if (edges.includes('t')) torn(x, y, x + w, y, seed, amp); else { g.moveTo(x, y); g.lineTo(x + w, y); }
      if (edges.includes('r')) torn(x + w, y, x + w, y + h, seed + 1, amp, 14, false); else g.lineTo(x + w, y + h);
      if (edges.includes('b')) torn(x + w, y + h, x, y + h, seed + 2, amp, 14, false); else g.lineTo(x, y + h);
      if (edges.includes('l')) torn(x, y + h, x, y, seed + 3, amp, 14, false);
      g.closePath();
    };
    const fillPaper = (color, lvl = 2) => {
      shadow(lvl);
      g.fillStyle = color;
      g.fill();
      noShadow();
    };
    const rect = (x, y, w, h, color, lvl = 2) => {
      g.beginPath();
      g.rect(x, y, w, h);
      fillPaper(color, lvl);
    };

    const measure = (s, f) => {
      g.font = f;
      return g.measureText(s).width;
    };
    // 字：可錯版（兩種顏色錯開）、可加字距、可旋轉
    const text = (s, x, y, o = {}) => {
      const f = o.font || font(o.size || 40, o.fam || F.cond, o.weight, o.italic);
      g.save();
      g.translate(x, y);
      if (o.rot) g.rotate(o.rot);
      if (o.scale) g.scale(o.scale, o.scaleY || o.scale);
      g.font = f;
      g.textAlign = o.align || 'left';
      g.textBaseline = o.base || 'alphabetic';
      const tr = o.track || 0;
      const draw = (dx, dy) => {
        if (!tr) {
          if (o.stroke) g.strokeText(s, dx, dy);
          g.fillText(s, dx, dy);
          return;
        }
        const w = measure(s, f) + tr * (s.length - 1);
        let cx = o.align === 'center' ? -w / 2 : o.align === 'right' ? -w : 0;
        g.textAlign = 'left';
        for (const ch of s) {
          if (o.stroke) g.strokeText(ch, dx + cx, dy);
          g.fillText(ch, dx + cx, dy);
          cx += g.measureText(ch).width + tr;
        }
        g.textAlign = o.align || 'left';
      };
      if (o.riso) {
        // 錯版色乘上外面原本的透明度（淡出時錯版色也跟著淡）
        const d = o.risoD || Math.max(2, (o.size || 40) * 0.035);
        const ga = g.globalAlpha;
        g.globalAlpha = ga * (o.risoA || 0.9);
        g.fillStyle = o.riso[0];
        draw(d, d * 0.6);
        if (o.riso[1]) {
          g.fillStyle = o.riso[1];
          draw(-d * 0.8, -d * 0.4);
        }
        g.globalAlpha = ga;
      }
      if (o.stroke) {
        g.strokeStyle = o.stroke;
        g.lineWidth = o.strokeW || 6;
        g.lineJoin = 'round';
      }
      if (o.shadow !== 0) shadow(o.shadow || 2);
      g.fillStyle = o.color || C.ink;
      draw(0, 0);
      noShadow();
      g.restore();
      return measure(s, f) + tr * (s.length - 1);
    };

    // 衝進畫面的大字：從大縮回來、帶一點過衝；age 是出現後經過的秒數
    const slam = (s, x, y, age, o = {}) => {
      if (age < 0) return 0;
      const d = o.dur || 0.14;
      const k = clamp(age / d);
      const back = 1 - Math.pow(1 - k, 3);
      const sc = (o.from || 1.5) + (1 - (o.from || 1.5)) * back + Math.sin(k * Math.PI) * 0.06;
      const [bx, by, br] = boil(o.seed || 3, o.boil == null ? 1.2 : o.boil);
      return text(s, x + bx, y + by, { ...o, scale: sc * (o.scale || 1), rot: (o.rot || 0) + br });
    };

    // 每個字母都是一片剪紙：各自歪一點、各自有陰影
    const letters = (s, x, y, o = {}) => {
      const f = font(o.size || 120, o.fam || F.cond, o.weight, o.italic);
      g.font = f;
      const tr = o.track || 0;
      const widths = [...s].map(ch => g.measureText(ch).width);
      const total = widths.reduce((a, b) => a + b, 0) + tr * (s.length - 1);
      let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
      [...s].forEach((ch, i) => {
        const age = o.ages ? o.ages[i] : o.age != null ? o.age - i * (o.stagger || 0) : 1;
        if (age >= 0 && ch !== ' ') {
          const seed = (o.seed || 1) * 31 + i * 7;
          const [bx, by, br] = boil(seed, o.boil == null ? 1 : o.boil);
          const k = clamp(age / 0.12);
          const sc = 1 + (1 - k) * 0.6;
          const rot = (rnd(i, o.seed || 1) - 0.5) * (o.tilt == null ? 0.1 : o.tilt) + br;
          const jy = (rnd(i, (o.seed || 1) + 2) - 0.5) * (o.jitter || 0);
          const col = Array.isArray(o.color) ? o.color[i % o.color.length] : o.color;
          text(ch, cx + widths[i] / 2 + bx, y + by + jy, { font: f, align: 'center', base: o.base, color: col, rot, scale: sc, shadow: o.shadow, riso: o.riso, stroke: o.stroke, strokeW: o.strokeW });
        }
        cx += widths[i] + tr;
      });
      return total;
    };

    // 剪貼字（勒索信）：每個字元貼在一小片不同顏色的紙上
    const ransom = (s, x, y, size, o = {}) => {
      const fams = [F.cond, F.wide, F.serif, F.times, F.mono];
      const bgs = o.bgs || [C.cream, C.yellow, C.ink, C.pink, '#ffffff', C.blue, C.orange];
      let cx = x;
      const chars = [...s];
      const w = chars.map((ch, i) => {
        const fam = fams[Math.floor(rnd(i, o.seed || 4) * fams.length)];
        return measure(ch === ' ' ? 'M' : ch, font(size, fam, fam === F.serif ? '' : '', rnd(i, 9) > 0.7)) * (ch === ' ' ? 0.5 : 1) + size * 0.22;
      });
      const total = w.reduce((a, b) => a + b, 0);
      if (o.align === 'center') cx = x - total / 2;
      chars.forEach((ch, i) => {
        const age = o.age != null ? o.age - i * (o.stagger || 0.03) : 1;
        if (ch !== ' ' && age >= 0) {
          const seed = (o.seed || 4) * 13 + i;
          const fam = fams[Math.floor(rnd(i, o.seed || 4) * fams.length)];
          const bg = bgs[Math.floor(rnd(i, (o.seed || 4) + 1) * bgs.length)];
          const dark = bg === C.ink || bg === C.blue;
          const [bx, by, br] = boil(seed, 1);
          const rot = (rnd(i, (o.seed || 4) + 3) - 0.5) * 0.24 + br;
          const k = clamp(age / 0.1);
          g.save();
          g.translate(cx + w[i] / 2 + bx, y + by);
          g.rotate(rot);
          g.scale(1 + (1 - k) * 0.5, 1 + (1 - k) * 0.5);
          const hw = w[i] / 2, hh = size * 0.62;
          tornRect(-hw, -hh, hw * 2, hh * 1.25, seed, 2.5, 'tblr');
          fillPaper(bg, 1);
          g.font = font(size * 0.92, fam, fam === F.cond || fam === F.wide || fam === F.mono ? '' : '', rnd(i, 9) > 0.7);
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = dark ? C.cream : (bg === C.orange || bg === C.pink ? C.ink : (rnd(i, 5) > 0.6 ? C.red : C.ink));
          g.fillText(ch, 0, -hh * 0.06);
          g.restore();
        }
        cx += w[i];
      });
      return total;
    };

    // 翻牌看板：每一格先亂翻，再停在正確的字；age 是開始翻的秒數，每格依序延遲
    const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const flap = (s, x, y, o = {}) => {
      const cw = o.w || 44, ch = o.h || 64, gap = o.gap || 5;
      const age = o.age == null ? 9 : o.age;
      [...s].forEach((c, i) => {
        const cx = x + i * (cw + gap);
        g.save();
        shadow(1);
        g.fillStyle = o.tile || '#1d1b19';
        g.fillRect(cx, y, cw, ch);
        noShadow();
        const settle = (o.stagger || 0.035) * i + (o.spin || 0.28);
        let glyph = c;
        let flip = 0;
        if (age < settle && c !== ' ') {
          const n = Math.floor(age / 0.045);
          glyph = age < 0 ? ' ' : GLYPHS[Math.floor(rnd(n, i + (o.seed || 0)) * GLYPHS.length)];
          flip = (age / 0.045) % 1;
        }
        g.font = font(ch * 0.72, o.fam || F.mono, '700');
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = (o.hl && o.hl.includes(i)) ? (o.hlColor || C.orange) : (o.color || C.cream);
        g.save();
        g.translate(cx + cw / 2, y + ch / 2);
        g.scale(1, 1 - flip * 0.6);
        g.fillText(glyph, 0, 2);
        g.restore();
        g.fillStyle = 'rgba(0,0,0,.55)';
        g.fillRect(cx, y + ch / 2 - 1, cw, 2);
        g.restore();
      });
      return s.length * (cw + gap) - gap;
    };

    const barcode = (x, y, w, h, seed = 1, color = C.ink) => {
      g.fillStyle = color;
      let cx = x;
      let i = 0;
      while (cx < x + w) {
        const bw = 1 + Math.floor(rnd(i, seed) * 3.2);
        if (i % 2 === 0) g.fillRect(cx, y, Math.min(bw, x + w - cx), h);
        cx += bw + (rnd(i + 99, seed) > 0.6 ? 1 : 0);
        i++;
      }
    };

    // 吊牌：上面打洞、穿一條線
    const tag = (x, y, w, h, o = {}) => {
      g.save();
      g.translate(x, y);
      g.rotate(o.rot || 0);
      g.beginPath();
      g.moveTo(-w / 2 + 10, 0);
      g.lineTo(w / 2 - 10, 0);
      g.lineTo(w / 2, 12);
      g.lineTo(w / 2, h);
      g.lineTo(-w / 2, h);
      g.lineTo(-w / 2, 12);
      g.closePath();
      fillPaper(o.color || C.cream, o.lvl || 2);
      g.fillStyle = o.hole || C.ink;
      g.beginPath();
      g.arc(0, 14, 5, 0, TAU);
      g.fill();
      if (o.string !== false) {
        g.strokeStyle = o.stringColor || C.orange;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, 14);
        g.quadraticCurveTo(-10, -30, -4, -70);
        g.stroke();
      }
      if (o.draw) o.draw(w, h);
      g.restore();
    };

    // 橡皮章：框線 + 字，有點歪、有點缺墨
    const stamp = (s, x, y, o = {}) => {
      const size = o.size || 48;
      const age = o.age == null ? 1 : o.age;
      if (age < 0) return;
      const k = clamp(age / 0.08);
      g.save();
      g.translate(x, y);
      g.rotate(o.rot == null ? -0.12 : o.rot);
      const sc = 1 + (1 - k) * 0.8;
      g.scale(sc, sc);
      g.globalAlpha = (o.alpha || 0.92) * k;
      g.font = font(size, o.fam || F.wide);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const w = g.measureText(s).width + size * 0.7;
      const h = size * 1.35;
      g.strokeStyle = o.color || C.red;
      g.lineWidth = size * 0.09;
      g.strokeRect(-w / 2, -h / 2, w, h);
      g.fillStyle = o.color || C.red;
      g.fillText(s, 0, size * 0.04);
      // 缺墨：用背景色點掉一些
      if (o.bg) {
        g.fillStyle = o.bg;
        for (let i = 0; i < 26; i++) {
          g.globalAlpha = 0.55 * k;
          g.beginPath();
          g.arc((rnd(i, 3) - 0.5) * w, (rnd(i, 4) - 0.5) * h, 1 + rnd(i, 5) * size * 0.05, 0, TAU);
          g.fill();
        }
      }
      g.restore();
    };

    // 網點：dot 大小可以依位置變（f 回傳 0~1）
    const halftone = (x, y, w, h, o = {}) => {
      const step = o.step || 14;
      const ang = o.angle == null ? 0.26 : o.angle;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const cx = x + w / 2, cy = y + h / 2;
      const r = Math.hypot(w, h) / 2 + step;
      g.fillStyle = o.color || C.ink;
      g.beginPath();
      for (let v = -r; v <= r; v += step) {
        for (let u = -r; u <= r; u += step) {
          const px2 = cx + u * cs - v * sn, py2 = cy + u * sn + v * cs;
          if (px2 < x - step || px2 > x + w + step || py2 < y - step || py2 > y + h + step) continue;
          const k = o.f ? o.f(px2, py2) : (o.k == null ? 0.5 : o.k);
          if (k <= 0.02) continue;
          const rr = step * 0.5 * Math.sqrt(k) * (o.max || 1);
          g.moveTo(px2 + rr, py2);
          g.arc(px2, py2, rr, 0, TAU);
        }
      }
      g.fill();
    };

    // 放射光（K-pop 舞台背景的那種）
    const sunburst = (cx, cy, r, n, rot, color, alpha = 1) => {
      g.save();
      g.globalAlpha = alpha;
      g.fillStyle = color;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const a0 = rot + (i / n) * TAU, a1 = a0 + (TAU / n) * 0.5;
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
        g.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
        g.closePath();
      }
      g.fill();
      g.restore();
    };

    // 八角星（Claude 的星形）：只建立路徑，填色由呼叫的人決定
    const star = (x, y, r, inner = 0.4, rot = 0, n = 8) => {
      g.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = rot + (i / (n * 2)) * TAU - Math.PI / 2;
        const rr = i % 2 ? r * inner : r;
        const px2 = x + Math.cos(a) * rr, py2 = y + Math.sin(a) * rr;
        if (i) g.lineTo(px2, py2); else g.moveTo(px2, py2);
      }
      g.closePath();
    };

    // 一張紙（可撕邊）＋ 陰影，拿來當卡片、看板、海報
    const card = (x, y, w, h, color, o = {}) => {
      g.save();
      g.translate(x, y);
      if (o.rot) g.rotate(o.rot);
      if (o.torn) tornRect(-w / 2, -h / 2, w, h, o.seed || 2, o.amp || 4, o.torn);
      else { g.beginPath(); g.rect(-w / 2, -h / 2, w, h); }
      fillPaper(color, o.lvl == null ? 2 : o.lvl);
      if (o.draw) o.draw(w, h);
      g.restore();
    };

    return { C, F, TAU, rnd, clamp, shadow, noShadow, font, boil, torn, tornRect, fillPaper, rect, measure, text, slam, letters, ransom, flap, barcode, tag, stamp, halftone, sunburst, star, card };
  };
  window.ClaudePopKit.C = C;
  window.ClaudePopKit.F = F;
})();
