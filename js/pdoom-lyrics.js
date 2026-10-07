/* =========================================================
   P(doom) MV 的歌詞動態排版（由 pdoom.js 每一格呼叫）
   跟 Claude Pop 剪紙版用同一套剪紙工具箱（js/claude-pop-kit.js）：
   - 字是一片片剪下來的紙：各自歪一點、各自有陰影、錯版印刷、每秒 12 格微微抖動
   - 短句印在撕邊紙條上「啪」地貼上去；名字用勒索信剪貼字；數字用翻牌看板；重話蓋橡皮章
   - 重拍上的字（FOOM、BOOM、TRANSFORMERS）整張色紙衝進來蓋住畫面，停半秒再被扯走
   - 重的字一砸下來，鏡頭也跟著震（impact()，pdoom.js 拿去推鏡與晃動）
   - 每一句一段排版，跟著鏡頭構圖排在人物旁邊，並跟歌詞的意思動（drop 掉下去、nervous 發抖、
     free 飛走、rearranging 字母重組、backward 倒著寫、sharp left turn 急轉、disobey 翻倒……）
   - 原曲字幕只有每句的起訖時間；每個字的時間照音節數在這句裡分配
   ========================================================= */
window.PDoomLyrics = env => {
  const { g, W, H, clamp, lerp, frac, ease, vtext } = env;
  let FR12 = 0;
  const K = window.ClaudePopKit(g, { px: env.px, frame: () => FR12 });
  const { C, F, rnd } = K;
  const TAU = Math.PI * 2;
  const GOLD = '#e0ac2b', ACID = '#a6ff4d';

  /* ---------- 歌詞與每個字的時間 ---------- */
  // 母音群數當音節數；全大寫的縮寫一個字母算將近一個音節（AGI、MLP、NVDA、PTO、RLHF……）
  const syl = w => {
    const s = w.replace(/[^A-Za-z0-9]/g, '');
    if (!s) return 1;
    if (/^[A-Z0-9]{2,5}s?$/.test(s)) return s.replace(/s$/, '').length * 0.8;
    const m = s.toLowerCase().match(/[aeiouy]+/g);
    let n = m ? m.length : 1;
    if (/[^aeiouy]e$/i.test(s) && n > 1) n--;
    return Math.max(1, n);
  };

  /* ---------- 畫法 ---------- */
  // 剪紙字：每個字母一片紙，fx(j) 可以再給每個字母加位移／旋轉／縮放／透明度
  const lets = (txt, x, y, o, fx) => {
    if (o.age < 0) return 0;
    const f = K.font(o.size, o.fam || F.cond, o.weight, o.italic);
    g.font = f;
    const chars = [...txt];
    const ws = chars.map(ch => g.measureText(ch).width);
    const tr = o.track || 0;
    const total = ws.reduce((p, q) => p + q, 0) + tr * (chars.length - 1);
    let cx = o.align === 'c' ? x - total / 2 : o.align === 'r' ? x - total : x;
    chars.forEach((ch, j) => {
      const w = ws[j];
      const age = o.age - j * (o.stagger == null ? 0.025 : o.stagger);
      if (ch !== ' ' && age >= 0) {
        const e = (fx && fx(j, chars.length)) || {};
        const a = e.a == null ? 1 : e.a;
        if (a > 0.01) {
          const k = clamp(age / 0.12);
          const [bx, by, br] = K.boil((o.seed || 1) * 31 + j * 7, o.boil == null ? 1 : o.boil);
          g.save();
          g.globalAlpha *= a;
          K.text(ch, cx + w / 2 + bx + (e.dx || 0), y + by + (e.dy || 0), {
            font: f, align: 'center', color: Array.isArray(o.color) ? o.color[j % o.color.length] : o.color || C.cream,
            rot: (rnd(j, o.seed || 1) - 0.5) * (o.tilt == null ? 0.1 : o.tilt) + br + (e.rot || 0),
            scale: (1 + (1 - k) * 0.6) * (e.sc == null ? 1 : e.sc),
            shadow: o.shadow == null ? 3 : o.shadow, riso: o.riso, risoD: o.risoD,
          });
          g.restore();
        }
      }
      cx += w + tr;
    });
    return total;
  };
  const widthOf = (txt, size, fam = F.cond, weight, italic) => K.measure(txt, K.font(size, fam, weight, italic));

  // 撕邊紙條：一句短句印在一條紙上，啪地貼上去
  const strip = (txt, x, y, age, o = {}) => {
    if (age < 0) return;
    const size = o.size || 46;
    const fam = o.fam || F.serif, italic = o.italic == null ? fam === F.serif : o.italic;
    const w = widthOf(txt, size, fam, o.weight, italic);
    const padX = size * 0.4, padY = size * 0.32;
    const left = o.align === 'c' ? x - w / 2 : o.align === 'r' ? x - w : x;
    const k = clamp(age / 0.12);
    const seed = o.seed || 1;
    const [bx, by, br] = K.boil(seed * 17, 0.8);
    g.save();
    g.translate(left + w / 2 + bx, y - size * 0.32 + by);
    g.rotate((o.rot || 0) + br + (1 - k) * 0.14 * (seed % 2 ? 1 : -1));
    g.scale(1 + (1 - k) * 0.35, 1 + (1 - k) * 0.35);
    K.tornRect(-w / 2 - padX, -size * 0.5 - padY, w + padX * 2, size + padY * 2, seed, 3.5, 'tblr');
    K.fillPaper(o.paper || C.cream, 2);
    K.text(txt, -w / 2, size * 0.32, { size, fam, italic, weight: o.weight, color: o.ink || C.ink, shadow: 0, riso: o.riso, risoD: 2.5 });
    g.restore();
  };
  // 勒索信剪貼字
  const ransom = (txt, x, y, size, age, o = {}) => {
    if (age < 0) return;
    K.ransom(txt, x, y, size, { age, seed: o.seed || 4, align: o.align === 'c' ? 'center' : undefined, stagger: o.stagger || 0.035 });
  };
  const stamp = (txt, x, y, age, o = {}) => {
    if (age < 0) return;
    K.stamp(txt, x, y, { age, size: o.size || 80, rot: o.rot, color: o.color || C.red, fam: o.fam });
  };
  const flap = (txt, x, y, age, o = {}) => {
    if (age < 0) return;
    K.flap(txt, x, y, { age, w: o.w || 44, h: o.h || 64, color: o.color, hl: o.hl, hlColor: o.hlColor, seed: o.seed });
  };
  // 整張色紙衝進來蓋住畫面（撕邊、帶陰影），停 hold 秒再被扯走；上面一個超大的字
  const card = (age, o) => {
    if (age < 0) return;
    const hold = o.hold == null ? 0.45 : o.hold;
    const kin = ease.out(clamp(age / 0.08)), kout = ease.in(clamp((age - hold) / 0.14));
    if (kout >= 1) return;
    const off = 1 - kin + kout * 1.05;
    const from = o.from || 'r';
    const dx = from === 'r' ? off * (W + 120) : from === 'l' ? -off * (W + 120) : 0;
    const dy = from === 'b' ? off * (H + 120) : from === 't' ? -off * (H + 120) : 0;
    g.save();
    g.translate(dx, dy);
    g.rotate((from === 'b' ? 0.04 : -0.03) * (1 - kin + kout));
    K.tornRect(-60, -60, W + 120, H + 120, o.seed || 5, 16, 'tblr');
    K.fillPaper(o.bg, 4);
    if (o.burst) K.sunburst(W / 2, H / 2, 1000, 28, age * 0.5, o.burst, 0.35);
    if (o.dots) K.halftone(0, 0, W, H, { step: 22, color: o.dots, f: (x, y) => clamp(1 - Math.hypot(x - W / 2, y - H / 2) / 760) * 0.55 });
    if (o.rings) {
      for (let r = 0; r < 3; r++) {
        const k = clamp((age - r * 0.07) / 0.5);
        if (k <= 0 || k >= 1) continue;
        g.save();
        g.globalAlpha *= 1 - k;
        g.strokeStyle = r === 1 ? C.cream : C.ink;
        g.lineWidth = 18 * (1 - k) + 2;
        g.beginPath();
        g.arc(W / 2, H / 2 - 40, 120 + 700 * ease.out(k), 0, TAU);
        g.stroke();
        g.restore();
      }
    }
    const size = Math.min(o.size || 430, (1120 / widthOf(o.txt, 100)) * 100);
    lets(o.txt, W / 2, H / 2 + size * 0.36, { size, color: o.ink, riso: o.riso, risoD: size * 0.03, align: 'c', age, stagger: 0.02, seed: o.seed || 5, tilt: 0.12, shadow: 4 });
    g.restore();
  };
  // 字母一個一個從右邊高速衝進來，拖著殘影
  const speedLets = (txt, x, y, age, o) => {
    if (age < 0) return;
    for (let e = 3; e >= 1; e--) {
      g.save();
      g.globalAlpha *= 0.22 / e;
      lets(txt, x, y, { ...o, age, shadow: 0, riso: null }, j => {
        const p = ease.out(clamp((age - j * 0.02) / 0.3));
        return { dx: (1 - p) * 760 + e * 60 * (1 - p) + e * 14 };
      });
      g.restore();
    }
    lets(txt, x, y, { ...o, age }, j => ({ dx: (1 - ease.out(clamp((age - j * 0.02) / 0.3))) * 760 }));
  };
  // 拿一組字當成一張紙，繞著 (cx, cy) 轉／縮放（turn、disobey、dense 用）
  const around = (cx, cy, rot, sx, sy, draw) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.scale(sx, sy);
    g.translate(-cx, -cy);
    draw();
    g.restore();
  };

  /* ---------- 每一句的排版 ----------
     [開始, 結束, 句子, 重拍（[第幾個字, 力道]，鏡頭跟著震）, 畫法 (L, t, A)]；A(i) = 第 i 個字唱到之後經過的秒數 */
  const SRC = [
    // 第一話：她眼裡的火花（眼睛特寫，字在左下臉頰上）
    [1.5, 5.9, 'I see sparks of AGI in your eyes', [[4, 0.5]], (L, t, A) => {
      strip('I see sparks of', 80, 396, A(0), { size: 44, rot: -0.035, seed: 1 });
      lets('AGI', 84, 604, { size: 210, color: C.orange, riso: [C.blue], age: A(4), stagger: 0.06, seed: 2 });
      strip('in your eyes', 400, 590, A(5), { size: 40, rot: 0.03, seed: 3 });
    }],
    // 平交道（她在右半邊）：nervous 一直發抖
    [6.0, 7.9, 'Your circuits make me nervous,', [], (L, t, A) => {
      strip('Your circuits', 70, 232, A(0), { size: 50, rot: -0.04, seed: 4 });
      lets('make me', 74, 352, { size: 92, fam: F.serif, italic: true, age: A(2), seed: 5 });
      lets('nervous,', 74, 474, { size: 128, fam: F.serif, italic: true, riso: [C.pink], age: A(4), seed: 6, boil: 4, tilt: 0.22 });
    }],
    [8.0, 8.95, 'that’s no surprise', [[2, 0.4]], (L, t, A) => {
      strip('that’s no', 70, 272, A(0), { size: 56, rot: 0.03, seed: 7 });
      lets('surprise', 74, 432, { size: 150, fam: F.serif, italic: true, color: C.orange, riso: [C.blue], age: A(2), seed: 8 });
    }],
    // 便利商店：右邊吐出收據，左邊 DROP 真的掉下去
    [9.0, 12.4, 'There was a sudden drop in your training loss,', [[4, 0.5]], (L, t, A) => {
      const ad = A(4);
      lets('DROP', 70, 330, { size: 176, riso: [C.red], age: ad, seed: 9 }, j => {
        const f = Math.max(0, ad - 0.4 - j * 0.08);
        return { dy: 1100 * f * f, rot: f * (j % 2 ? 2.4 : -2.4) };
      });
      receipt(L, t);
    }],
    [13.0, 16.5, 'now I’m your servant and you’re my boss', [[7, 0.7]], (L, t, A) => {
      strip('now I’m your', 70, 200, A(0), { size: 46, rot: -0.03, seed: 10 });
      lets('servant', 74, 332, { size: 132, fam: F.serif, italic: true, age: A(3), seed: 11 });
      strip('and you’re my', 70, 432, A(4), { size: 46, rot: 0.025, seed: 12 });
      stamp('BOSS', 250, 540, A(7), { size: 92, rot: -0.14 });
    }],
    // 房間：她看著筆電，光越來越亮；alive 抖得越來越厲害
    [17.9, 22.5, 'ChatGPT, please don’t eat me alive', [[0, 0.4], [5, 0.5]], (L, t, A) => {
      ransom('ChatGPT,', 80, 272, 84, A(0), { seed: 13 });
      strip('please don’t eat', 80, 392, A(1), { size: 50, rot: -0.03, seed: 14 });
      lets('me alive', 84, 534, { size: 132, fam: F.serif, italic: true, color: C.orange, riso: [C.pink], age: A(4), seed: 15, boil: 1 + clamp(A(5) / 1.5) * 4 });
    }],
    // 副歌第一句
    [23.0, 24.4, 'I’m upping my P(doom)', [[3, 1.3]], (L, t, A) => hook(L, t, A)],
    // 副歌一（粉紅機房）：FOOM 整張黃紙蓋上來
    [24.5, 26.4, '’cause the future goes FOOM', [[2, 0.5], [4, 1.4]], (L, t, A) => {
      strip('’CAUSE THE', 70, 150, A(0), { size: 50, fam: F.cond, rot: -0.03, seed: 16, paper: C.yellow });
      lets('FUTURE', 70, 334, { size: 200, color: C.ink, riso: [C.yellow, C.blue], age: A(2), seed: 17 });
      lets('GOES', 74, 456, { size: 112, riso: [C.pink], age: A(3), seed: 18 });
      card(A(4), { txt: 'FOOM', bg: C.yellow, ink: C.ink, riso: [C.pink], from: 'b', hold: 0.5, burst: C.orange, seed: 19 });
    }],
    // 中文房間：一張紙卡被紅線框住
    [26.5, 27.9, 'Trapped in the Chinese room,', [[3, 0.6]], (L, t, A) => {
      const a0 = A(0);
      if (a0 < 0) return;
      const k = clamp(a0 / 0.12);
      g.save();
      g.translate(640, 190);
      g.rotate(-0.02 + (1 - k) * 0.1);
      g.scale(1 + (1 - k) * 0.3, 1 + (1 - k) * 0.3);
      K.tornRect(-420, -130, 840, 260, 20, 5, 'tblr');
      K.fillPaper(C.cream, 3);
      K.text('TRAPPED IN THE', 0, -52, { size: 52, fam: F.cond, color: C.ink, align: 'center', shadow: 0, track: 4 });
      lets('CHINESE ROOM,', 0, 86, { size: 124, color: C.ink, shadow: 1, align: 'c', age: A(3), seed: 21 });
      const per = 2 * (760 + 210), kb = ease.io(clamp(a0 / 0.9));
      g.strokeStyle = C.red;
      g.lineWidth = 7;
      g.setLineDash([per * kb, per]);
      g.strokeRect(-380, -105, 760, 210);
      g.setLineDash([]);
      g.restore();
    }],
    [28.0, 29.4, 'with a bag of shrooms', [[4, 0.6]], (L, t, A) => {
      ransom('with a bag of', 90, 220, 58, A(0), { seed: 22, stagger: 0.025 });
      ransom('SHROOMS', 90, 606, 132, A(4), { seed: 23 });
    }],
    // 修格斯：字母像觸手一樣晃
    [29.5, 33.4, 'See through the shoggoth’s lies,', [[3, 0.6], [4, 0.5]], (L, t, A) => {
      strip('SEE THROUGH THE', 640, 470, A(0), { size: 50, fam: F.cond, align: 'c', rot: 0.02, seed: 24 });
      const amp = 16 * ease.out(clamp(A(3) / 0.5));
      lets('SHOGGOTH’S', 640, 644, { size: 172, color: ACID, riso: [C.ink], align: 'c', age: A(3), seed: 25 }, j => ({ dy: Math.sin(t * 7 + j * 0.9) * amp, rot: Math.sin(t * 5 + j * 1.3) * amp * 0.01 }));
      stamp('LIES', 1010, 400, A(4), { size: 82, rot: 0.16 });
    }],
    // 死神の目（眼睛特寫）
    [33.5, 35.5, 'with your shinigami eyes', [[2, 0.6]], (L, t, A) => {
      strip('with your', 90, 170, A(0), { size: 50, rot: -0.03, seed: 26 });
      lets('SHINIGAMI', 90, 332, { size: 150, color: C.red, riso: [C.ink], age: A(2), seed: 27 });
      lets('EYES', 94, 474, { size: 150, riso: [C.red], age: A(3), seed: 28 });
      if (A(2) >= 0) vtext('死神の目', 1100, 140, { size: 84, fam: '"Noto Serif JP", serif', weight: '900', color: C.red, ages: [...'死神の目'].map((_, i) => A(2) - i * 0.08) });
    }],
    // 第二話：屋頂
    [38.5, 41.4, 'We had a stable training run,', [], (L, t, A) => {
      strip('We had a stable', 90, 292, A(0), { size: 52, rot: -0.02, seed: 29 });
      lets('training run,', 94, 424, { size: 112, fam: F.serif, italic: true, age: A(4), seed: 30 });
    }],
    // 澀谷：singularity 的字母從四面八方聚到一起
    [41.5, 44.9, 'But now the singularity’s begun', [[3, 0.5]], (L, t, A) => {
      strip('But now the', 80, 182, A(0), { size: 46, rot: 0.03, seed: 31 });
      const as = A(3);
      lets('singularity’s', 80, 312, { size: 96, fam: F.serif, italic: true, color: C.orange, riso: [C.blue], age: as, stagger: 0, seed: 32 }, j => {
        const k = ease.io(clamp((as - j * 0.02) / 0.8));
        return { dx: (rnd(j, 3) - 0.5) * 1100 * (1 - k), dy: (rnd(j, 5) - 0.5) * 600 * (1 - k), rot: (rnd(j, 7) - 0.5) * 4 * (1 - k), sc: 1 + (1 - k) * 1.2 };
      });
      lets('begun', 84, 412, { size: 86, fam: F.serif, italic: true, age: A(4), seed: 33 });
    }],
    [45.0, 48.5, 'And you’re optimizing, accelerating,', [[2, 0.4], [3, 0.5]], (L, t, A) => {
      strip('AND YOU’RE', 80, 150, A(0), { size: 44, fam: F.cond, seed: 34 });
      speedLets('OPTIMIZING,', 80, 252, A(2), { size: 82, riso: [C.pink], seed: 35 });
      speedLets('ACCELERATING,', 80, 344, A(3), { size: 82, color: C.yellow, riso: [C.blue], seed: 36 });
    }],
    // 平交道倒放：rearranging 的字母先亂排再換回來
    [49.4, 51.9, 'I feel my atoms rearranging', [[4, 0.5]], (L, t, A) => {
      strip('I feel my atoms', 80, 252, A(0), { size: 50, rot: -0.03, seed: 37 });
      const ar = A(4), word = 'REARRANGING';
      g.font = K.font(88, F.cond);
      const adv = [...word].map((_, j) => g.measureText(word.slice(0, j)).width);
      const perm = [...Array(word.length).keys()].sort((p, q) => rnd(p, 11) - rnd(q, 11));
      lets(word, 84, 400, { size: 88, color: C.orange, riso: [C.blue], age: ar, stagger: 0, seed: 38 }, j => {
        const k = ease.io(clamp((ar - 0.15 - j * 0.05) / 0.45));
        return { dx: (adv[perm[j]] - adv[j]) * (1 - k), dy: -Math.sin(k * Math.PI) * 40 * (j % 2 ? 1 : -1) };
      });
    }],
    // 末班電車：free 最後飛走
    [53.4, 58.4, 'Sydney, please let me free', [[0, 0.4], [4, 0.5]], (L, t, A) => {
      ransom('Sydney,', 80, 272, 92, A(0), { seed: 39 });
      strip('please let me', 80, 392, A(1), { size: 50, rot: 0.02, seed: 40 });
      const fly = Math.max(0, t - (L.b - 0.7));
      lets('free', 84, 542, { size: 150, fam: F.serif, italic: true, color: C.orange, riso: [C.pink], age: A(4), seed: 41 }, j => ({ dy: -fly * fly * 1200 - fly * 90 * j, dx: fly * 160 * j, rot: fly * (j % 2 ? 1.2 : -1.2) }));
    }],
    [59.0, 60.4, 'I’m upping my P(doom)', [[3, 1.3]], (L, t, A) => hook(L, t, A)],
    // 副歌二（鉻金屬）：BOOM 整張紅紙蓋上來
    [60.5, 62.4, 'I hear the basilisk boom', [[3, 0.5], [4, 1.4]], (L, t, A) => {
      strip('I HEAR THE', 70, 150, A(0), { size: 50, fam: F.cond, rot: -0.03, seed: 42, paper: C.yellow });
      ransom('BASILISK', 70, 292, 70, A(3), { seed: 43 });
      card(A(4), { txt: 'BOOM', bg: C.red, ink: C.cream, riso: [C.ink], from: 'l', hold: 0.42, rings: true, seed: 44 });
    }],
    // NVDA：上面跑股價紙條，字一路往上衝
    [63.0, 64.4, 'NVDA to the moon', [[0, 0.5], [3, 0.6]], (L, t, A) => {
      const lift = -300 * ease.in(clamp((t - L.a) / (L.out - L.a)));
      g.save();
      K.tornRect(-20, 30, W + 40, 50, 45, 4, 'tb');
      K.fillPaper(C.yellow, 2);
      g.font = K.font(28, F.mono, '700');
      g.fillStyle = C.ink;
      const unit = 'NVDA ▲ +∞%    ';
      const uw = g.measureText(unit).width;
      for (let x = -((t * 420) % uw); x < W; x += uw) g.fillText(unit, x, 66);
      g.restore();
      flap('NVDA', 70, 150 + lift, A(0), { w: 62, h: 90, color: '#4dff88' });
      lets('TO THE', 74, 420 + lift, { size: 76, age: A(1), seed: 46 });
      const am = A(3);
      const mw = lets('MOON', 74, 572 + lift, { size: 168, color: C.yellow, riso: [C.orange], age: am, seed: 47 });
      if (am > 0) {
        g.save();
        g.strokeStyle = C.cream;
        g.lineWidth = 6;
        g.beginPath();
        g.arc(74 + mw / 2, 512 + lift, (mw / 2 + 40) * ease.back(clamp(am / 0.3)), 0, TAU * ease.out(clamp(am / 0.4)));
        g.stroke();
        g.restore();
      }
    }],
    // Ω：左邊一個大剪紙 Ω
    [64.5, 65.9, 'The Omega Point’s coming soon', [[1, 0.6]], (L, t, A) => {
      lets('Ω', 230, 560, { size: 420, fam: F.serif, align: 'c', riso: [C.pink, C.blue], risoD: 10, age: A(1), seed: 48, shadow: 4 });
      strip('THE OMEGA POINT’S', 470, 150, A(0), { size: 50, fam: F.cond, rot: 0.02, seed: 49 });
      lets('COMING SOON', 474, 284, { size: 118, color: C.pink, riso: [C.ink], age: A(3), seed: 50 });
    }],
    // 1E30 FLOP/s：翻牌看板 + 一直多一個零的大數字
    [66.0, 68.5, 'One E thirty FLOPs a second', [[3, 0.5]], (L, t, A) => {
      flap('ONE E THIRTY', 70, 96, A(0), { w: 40, h: 58, seed: 51 });
      flap('FLOPS A SECOND', 70, 164, A(3), { w: 40, h: 58, seed: 52, hl: [0, 1, 2, 3, 4], hlColor: C.yellow });
      const a3 = A(3);
      if (a3 < 0) return;
      const dur = L.b - L.words[3].t0 - 0.2;
      const zeros = Math.floor(clamp(a3 / dur) * 30);
      const num = ('1' + '0'.repeat(zeros)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const size = Math.min(120, 1060 / (num.length * 0.6));
      // 每多一個零，最後那個數字就重新砸一次
      const since = a3 - (zeros / 30) * dur;
      lets(num, 70, 600, { size, fam: F.mono, weight: '700', color: C.yellow, riso: [C.pink], age: 9, stagger: 0, seed: 53, tilt: 0.04 }, (j, n) => (j === n - 1 ? { sc: 1 + (1 - clamp(since / 0.1)) * 0.6 } : {}));
    }],
    // 便利商店的面無表情：蓋一個 SAFE 章
    [70.0, 72.9, 'That was safe enough, we reckoned', [[3, 0.4]], (L, t, A) => {
      strip('That was', 80, 250, A(0), { size: 48, rot: -0.03, seed: 54 });
      lets('safe enough,', 84, 372, { size: 92, fam: F.serif, italic: true, age: A(2), seed: 55 });
      stamp('SAFE', 300, 470, A(3) - 0.25, { size: 64, rot: -0.1, color: '#2f9e5b' });
      strip('we reckoned', 80, 572, A(4), { size: 44, rot: 0.03, seed: 56 });
    }],
    // 第三話：教室黑板
    [73.0, 77.4, 'Forward MLP, backward, repeat', [], (L, t, A) => chalk(L, t)],
    // von Neumann 被劃掉、蓋 OBSOLETE
    [77.5, 81.0, 'Now von Neumann’s obsolete', [[3, 0.7]], (L, t, A) => {
      strip('Now', 70, 232, A(0), { size: 46, rot: -0.04, seed: 57 });
      const w1 = lets('von Neumann’s', 74, 340, { size: 82, fam: F.serif, italic: true, age: A(1), seed: 58 });
      const ks = ease.out(clamp((A(3) + 0.1) / 0.25));
      if (ks > 0) {
        g.save();
        g.strokeStyle = C.red;
        g.lineWidth = 9;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(64, 312);
        g.lineTo(64 + (w1 + 20) * ks, 312 - 8 * ks);
        g.stroke();
        g.restore();
      }
      stamp('OBSOLETE', 290, 472, A(3) - 0.2, { size: 78, rot: -0.12 });
    }],
    // 計程車：整排字在 turn 唱完時急轉 90 度
    [81.4, 84.9, 'Sharp left turn and there you are', [[2, 0.6]], (L, t, A) => {
      const kr = ease.back(clamp((t - L.words[2].t1) / 0.3));
      around(90, 520, -Math.PI / 2 * kr, 1, 1, () => {
        lets('SHARP LEFT', 90, 520, { size: 76, riso: [C.orange], age: A(0), seed: 59 });
        lets('TURN', 90 + widthOf('SHARP LEFT ', 76), 520, { size: 76, color: C.orange, riso: [C.ink], age: A(2), seed: 60 });
      });
      strip('and there', 190, 452, A(3), { size: 50, rot: -0.02, seed: 61 });
      lets('you are', 194, 560, { size: 96, fam: F.serif, italic: true, color: C.orange, age: A(5), seed: 62 });
    }],
    // CDR：一張吊牌晃進來
    [85.0, 88.0, 'Without a single CDR', [[3, 0.4]], (L, t, A) => {
      strip('Without a single', 90, 290, A(0), { size: 52, rot: -0.03, seed: 63 });
      const a = A(3);
      if (a < 0) return;
      K.tag(250, 350, 260, 170, {
        rot: 0.06 + Math.sin(a * 7) * Math.exp(-a * 2.5) * 0.35, lvl: 3,
        draw: () => {
          K.text('CDR', 0, 96, { size: 74, fam: F.mono, weight: '700', color: C.ink, align: 'center', shadow: 0 });
          K.text('QTY  × 0', 0, 130, { size: 22, fam: F.mono, weight: '700', color: C.red, align: 'center', shadow: 0 });
          K.barcode(-80, 142, 160, 18, 64);
        },
      });
    }],
    // 電車：let me go 最後散開
    [89.4, 95.0, 'Gato, please don’t let me go', [[0, 0.4]], (L, t, A) => {
      ransom('Gato,', 80, 272, 104, A(0), { seed: 65 });
      strip('please don’t', 80, 390, A(1), { size: 50, rot: 0.02, seed: 66 });
      const go = Math.max(0, t - (L.b - 1.2));
      lets('let me go', 84, 534, { size: 124, fam: F.serif, italic: true, color: C.orange, riso: [C.pink], age: A(3), seed: 67 }, j => ({ dx: go * (j - 4) * 60, dy: go * go * 40 * (j % 3), a: 1 - clamp(go / 1.2) * 0.6 }));
    }],
    [95.4, 97.4, 'I’m upping my P(doom),', [[3, 1.1]], (L, t, A) => hook(L, t, A)],
    // 副歌三（迴紋針）：字從天上掉下來
    [97.5, 98.9, 'as paperclips fill the room', [[1, 0.5]], (L, t, A) => {
      const drop = (txt, x, y, age, o, seed) => {
        if (age < 0) return;
        const p = clamp(age / 0.42);
        const dy = p < 1 ? -780 * (1 - p) * (1 - p) : -Math.abs(Math.sin((age - 0.42) * 13)) * 24 * Math.exp(-(age - 0.42) * 6);
        const rot = (rnd(seed, 21) - 0.5) * 0.5 * (1 - ease.out(clamp(age / 0.6)));
        around(x, y - o.size * 0.3, rot, 1, 1, () => lets(txt, x, y + dy, { ...o, age: 9, seed, align: 'c' }));
      };
      drop('AS', 640, 470, A(0), { size: 66 }, 68);
      drop('PAPERCLIPS', 640, 598, A(1), { size: 136, color: GOLD, riso: [C.ink] }, 69);
      drop('FILL THE ROOM', 640, 690, A(2), { size: 76 }, 70);
    }],
    // PTO：自動回覆貼在一張紙上，打字機打出來
    [99.0, 100.4, 'Killswitch guy’s on PTO', [[3, 0.4]], (L, t, A) => {
      const a0 = A(0);
      if (a0 < 0) return;
      const k = clamp(a0 / 0.12);
      g.save();
      g.translate(380, 200);
      g.rotate(-0.03 + (1 - k) * 0.12);
      g.scale(1 + (1 - k) * 0.3, 1 + (1 - k) * 0.3);
      K.tornRect(-310, -90, 620, 180, 71, 4, 'tblr');
      K.fillPaper(C.cream, 3);
      g.fillStyle = C.yellow;
      g.fillRect(-310, -90, 620, 34);
      K.text('AUTO-REPLY · killswitch@lab', -292, -67, { size: 16, fam: F.mono, weight: '700', color: C.ink, shadow: 0 });
      let typed = '';
      L.words.forEach((wd, i) => {
        const n = [...wd.txt].length, p = clamp((t - wd.t0) / Math.max(0.12, wd.t1 - wd.t0));
        if (p > 0) typed += (i ? ' ' : '') + wd.txt.slice(0, Math.ceil(p * n));
      });
      K.text(typed + (frac(t * 2.5) < 0.5 ? '▌' : ''), -290, 10, { size: 36, fam: F.mono, weight: '700', color: C.ink, shadow: 0 });
      g.restore();
      stamp('OUT OF OFFICE', 520, 320, A(3) - 0.15, { size: 46, rot: 0.08 });
    }],
    // 無處可去：字散在四角，最後一起被吸進畫面中心
    [100.5, 102.4, 'Now there’s nowhere left to go', [[2, 0.5]], (L, t, A) => {
      const kk = ease.in(clamp((t - (L.b - 0.55)) / 0.7));
      const pos = [[90, 180, 'l', 92], [1120, 180, 'r', 92], [640, 432, 'c', 140], [90, 650, 'l', 86], [1000, 650, 'r', 86], [1120, 650, 'r', 86]];
      L.words.forEach((wd, i) => {
        const [x, y, al, size] = pos[i];
        const txt = wd.txt.toUpperCase();
        const w = widthOf(txt, size);
        const cx = al === 'c' ? x : al === 'r' ? x - w / 2 : x + w / 2;
        g.save();
        g.globalAlpha *= 1 - kk;
        around(lerp(cx, 640, kk), y - size * 0.32, 0, 1 - kk * 0.95, 1 - kk * 0.95, () => {
          lets(txt, lerp(cx, 640, kk), lerp(y, 340 + size * 0.32, kk), { size, color: i === 2 ? C.pink : C.cream, riso: [C.ink], age: A(i), align: 'c', seed: 72 + i });
        });
        g.restore();
      });
    }],
    // 房間：一條引信燒過去，FUSE 跟著燒出來
    [102.5, 104.4, 'Too late now, we lit the fuse', [[6, 0.6]], (L, t, A) => {
      strip('Too late now,', 800, 232, A(0), { size: 50, rot: -0.03, seed: 78 });
      strip('we lit the', 800, 312, A(3), { size: 50, rot: 0.03, seed: 79 });
      if (A(4) < 0) return;
      const x0 = 780, x1 = 1150, y = 486;
      const k = clamp((A(6) + 0.2) / 0.9);
      g.save();
      g.strokeStyle = 'rgba(247,243,234,.7)';
      g.lineWidth = 4;
      g.setLineDash([12, 8]);
      g.beginPath();
      g.moveTo(lerp(x0, x1, k), y);
      g.lineTo(x1, y);
      g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.rect(0, 0, lerp(x0, x1, k), H);
      g.clip();
      lets('FUSE', 800, 460, { size: 160, color: C.orange, riso: [C.red], age: 9, seed: 80 });
      g.restore();
      if (k > 0 && k < 1) {
        const sx = lerp(x0, x1, k);
        g.save();
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 20; i++) {
          const a = rnd(i, FR12) * TAU, r = 6 + rnd(i, FR12 + 1) * 38;
          g.fillStyle = i % 3 ? '#ffb547' : '#fff';
          g.fillRect(sx + Math.cos(a) * r, y + Math.sin(a) * r, 4, 4);
        }
        const gr = g.createRadialGradient(sx, y, 0, sx, y, 46);
        gr.addColorStop(0, 'rgba(255,220,150,.95)');
        gr.addColorStop(1, 'rgba(255,120,30,0)');
        g.fillStyle = gr;
        g.fillRect(sx - 46, y - 46, 92, 92);
        g.restore();
      }
    }],
    // 正交：thesis 直著穿過 Orthogonality
    [105.4, 109.4, 'Orthogonality thesis blues', [], (L, t, A) => {
      const w0 = lets('Orthogonality', 80, 332, { size: 98, fam: F.serif, italic: true, color: C.ink, riso: [C.orange], age: A(0), seed: 81 });
      if (A(1) >= 0) {
        const cx = 80 + widthOf('Orthog', 98, F.serif, '', true) + widthOf('o', 98, F.serif, '', true) / 2;
        around(cx, 300, Math.PI / 2, 1, 1, () => lets('thesis', cx - 70, 300 + 28, { size: 86, fam: F.serif, italic: true, color: C.pink, riso: [C.blue], age: A(1), seed: 82 }));
      }
      lets('blues', 80 + w0 * 0.45, 486, { size: 96, fam: F.serif, italic: true, color: C.blue, riso: [C.cream], age: A(2), seed: 83 });
    }],
    // 橋段（紅色警報）：TRANSFORMERS 整張黑紙蓋上來
    [109.4, 113.4, '“Just transformers all the way!”', [[0, 0.6], [1, 1.4], [2, 0.8]], (L, t, A) => {
      if (A(2) < 0) lets('“JUST', 640, 610, { size: 230, riso: [C.ink], align: 'c', age: A(0), seed: 84 });
      card(A(1), { txt: 'TRANSFORMERS', bg: C.ink, ink: C.yellow, riso: [C.red], from: 'r', hold: 0.6, seed: 85, dots: '#2a2622' });
      if (A(2) >= 0) lets('ALL THE WAY!”', 640, 620, { size: 170, riso: [C.red], align: 'c', age: A(2), seed: 86 });
    }],
    // disobey：砸下來之後整個翻倒
    [113.5, 115.4, 'Till you learned to disobey', [[4, 0.8]], (L, t, A) => {
      strip('TILL YOU LEARNED TO', 70, 170, A(0), { size: 50, fam: F.cond, rot: -0.03, seed: 87, paper: C.yellow });
      const ad = A(4), w = widthOf('DISOBEY', 176);
      around(70 + w / 2, 400 - 60, Math.PI * ease.io(clamp((ad - 0.3) / 0.35)), 1, 1, () => lets('DISOBEY', 70, 400, { size: 176, riso: [C.red], age: ad, seed: 88 }));
    }],
    // super-dense：越壓越扁
    [115.5, 116.9, 'Post-Chinchilla, super-dense', [[0, 0.5], [1, 0.5]], (L, t, A) => {
      const k = ease.io(clamp((t - L.a) / (L.b - L.a)));
      const sx = lerp(1, 0.46, k), sy = lerp(1, 1.2, k);
      around(70, 300, 0, sx, sy, () => lets('POST-CHINCHILLA,', 70, 300, { size: 118, riso: [C.ink], age: A(0), seed: 89 }));
      around(70, 300, 0, sx, sy, () => lets('SUPER-DENSE', 70, 410, { size: 118, color: C.yellow, riso: [C.red], age: A(1), seed: 90 }));
    }],
    // safety fence：一排紙條欄杆，Breaking 一出來就被撞飛
    [117.0, 118.9, 'Breaking through each safety fence', [[0, 1]], (L, t, A) => {
      const kb = clamp((A(0) - 0.08) / 0.7);
      if (kb < 1 && t >= L.a - 0.1) {
        for (let i = 0; i < 10; i++) {
          const x = 80 + i * 62;
          const dx = (rnd(i, 31) - 0.5) * 1000 * kb, dy = -280 * kb + 1100 * kb * kb, rot = (rnd(i, 33) - 0.5) * 5 * kb;
          g.save();
          g.translate(x + dx, 380 + dy);
          g.rotate(rot);
          K.tornRect(-9, -250, 18, 500, 91 + i, 2, 'tb');
          K.fillPaper(C.cream, 2);
          g.restore();
        }
      }
      lets('BREAKING', 80, 236, { size: 124, riso: [C.red], age: A(0), seed: 92 });
      strip('THROUGH EACH', 80, 318, A(1), { size: 48, fam: F.cond, rot: 0.02, seed: 93 });
      lets('SAFETY FENCE', 84, 450, { size: 104, color: C.yellow, riso: [C.ink], age: A(3), seed: 94 });
    }],
    // 十萬張 GPU：背後的格子一格格亮起，前面翻牌 100,000
    [119.0, 120.4, 'Hundred thousand GPU', [[2, 0.9]], (L, t, A) => {
      const k = clamp((t - L.a) / 1.2);
      g.save();
      g.globalAlpha *= 0.45;
      g.font = K.font(13, F.mono, '700');
      g.fillStyle = '#7ff0ff';
      const n = Math.floor(k * 240);
      for (let i = 0; i < 240; i++) if (rnd(i, 41) * 240 <= n) g.fillText('GPU', 14 + (i % 20) * 64, 30 + Math.floor(i / 20) * 60);
      g.restore();
      flap('100,000', 70, 120, A(0), { w: 76, h: 110, color: C.yellow, seed: 95 });
      lets('GPU', 70, 560, { size: 280, riso: [C.pink, C.blue], risoD: 9, age: A(2), seed: 96 });
    }],
    // RLHF goes askew：一直歪下去
    [120.9, 123.4, 'RLHF goes askew', [[0, 0.6], [2, 0.6]], (L, t, A) => {
      const drift = (t - L.a) * 0.06;
      around(200, 230, -0.08 - drift, 1, 1, () => ransom('RLHF', 80, 260, 140, A(0), { seed: 97 }));
      around(170, 360, 0.06 + drift, 1, 1, () => lets('GOES', 84, 380, { size: 96, age: A(1), seed: 98 }));
      const w = widthOf('ASKEW', 150);
      g.save();
      g.translate(84 + w / 2, 480);
      g.rotate(-0.14 - drift * 1.5);
      g.transform(1, 0, -0.3 - drift, 1, 0, 0);
      g.translate(-84 - w / 2, -480);
      lets('ASKEW', 84, 530, { size: 150, color: C.yellow, riso: [C.red], age: A(2), seed: 99 });
      g.restore();
    }],
    [123.5, 125.9, 'I’m upping my P(doom)', [[3, 1.3]], (L, t, A) => hook(L, t, A)],
    // 副歌四：foretold by Loom（紗線織過字）
    [126.0, 127.9, 'Just as foretold by Loom', [[2, 0.6], [4, 0.6]], (L, t, A) => {
      strip('JUST AS', 70, 150, A(0), { size: 50, fam: F.cond, rot: -0.03, seed: 100, paper: C.yellow });
      lets('FORETOLD', 70, 312, { size: 160, riso: [C.pink], age: A(2), seed: 101 });
      lets('BY LOOM', 74, 456, { size: 124, color: C.pink, riso: [C.ink], age: A(3), seed: 102 });
      const k = clamp((t - L.a) / 0.4);
      g.save();
      g.lineWidth = 4;
      for (let y = 160, r = 0; y < 470; y += 24, r++) {
        g.strokeStyle = r % 2 ? C.yellow : C.cream;
        g.setLineDash([28, 26]);
        g.lineDashOffset = t * 100 * (r % 2 ? 1 : -1);
        g.beginPath();
        g.moveTo(40, y);
        g.lineTo(40 + 760 * k, y);
        g.stroke();
      }
      g.setLineDash([]);
      g.restore();
    }],
    // masked pre-training：每個字蓋著一條 [MASK] 紙條，唱到才撕開；masked 只撕一半
    [128.0, 129.9, 'From masked pre-training days', [[1, 0.5], [2, 0.5]], (L, t, A) => {
      const rows = [['FROM', 'MASKED'], ['PRE-TRAINING', 'DAYS']];
      let wi = 0;
      rows.forEach((row, r) => {
        const y = r ? 286 : 166, size = 96;
        const sp = widthOf(' ', size) * 0.8;
        const total = row.reduce((p, s) => p + widthOf(s, size), 0) + sp * (row.length - 1);
        let x = 640 - total / 2;
        row.forEach(s => {
          const i = wi++, w = widthOf(s, size), age = A(i);
          lets(s, x, y, { size, color: i === 1 ? C.pink : C.cream, riso: [C.ink], age, seed: 103 + i });
          const open = ease.io(clamp((age - 0.04) / 0.3)) * (i === 1 ? 0.5 : 1);
          if (open < 1) {
            g.save();
            const bx = x - 10 + (w + 20) * open, bw = (w + 20) * (1 - open);
            K.tornRect(bx, y - size * 0.82, bw, size * 0.96, 110 + i, 3, open > 0 ? 'tbl' : 'tb');
            K.fillPaper(C.ink, 2);
            g.beginPath();
            g.rect(bx, y - size, bw, size * 1.2);
            g.clip();
            K.text('[MASK]', x + w / 2, y - size * 0.24, { size: 30, fam: F.mono, weight: '700', color: '#7ff0ff', align: 'center', shadow: 0 });
            g.restore();
          }
          x += w + sp;
        });
      });
    }],
    // recursive self-upgrade：同一組字一層層往左下角縮進去
    [130.0, 131.9, 'To recursive self-upgrade', [[2, 0.6]], (L, t, A) => {
      const draw = acc => {
        lets('TO RECURSIVE', 70, 180, { size: 64, riso: [C.ink], age: A(0), seed: 115 });
        lets('SELF-', 70, 310, { size: 110, color: acc, riso: [C.ink], age: A(2), seed: 116 });
        lets('UPGRADE', 70, 430, { size: 110, color: acc, riso: [C.ink], age: A(2) - 0.15, seed: 117 });
      };
      const z = frac((t - L.a) * 0.9);
      for (let k = 6; k >= 1; k--) {
        const s = Math.pow(0.68, k - z);
        g.save();
        g.translate(70, 690);
        g.scale(s, s);
        g.translate(-70, -690);
        g.globalAlpha *= Math.pow(0.62, k - z);
        draw(k % 2 ? '#7ff0ff' : C.pink);
        g.restore();
      }
      draw(C.pink);
    }],
    // What did Ilya see?：勒索信大字，We’ll never know 一個字一個字消失
    [132.0, 135.4, 'What did Ilya see? We’ll never know', [[2, 0.8]], (L, t, A) => {
      ransom('WHAT DID', 640, 250, 76, A(0), { seed: 117, align: 'c' });
      ransom('ILYA SEE?', 640, 360, 96, A(2), { seed: 118, align: 'c' });
      const fade = clamp((t - (L.b - 0.9)) / 0.9);
      lets('We’ll never know', 640, 480, { size: 70, fam: F.serif, italic: true, align: 'c', age: A(4), seed: 119, shadow: 2 }, j => ({ a: 1 - clamp(fade * 3 - j * 0.15) }));
    }],
    // 尾聲：for show? 最後一個字母一個字母掉下去
    [137.4, 140.5, 'Was it all for show?', [], (L, t, A) => {
      strip('Was it all', 80, 300, A(0), { size: 56, rot: -0.03, seed: 120 });
      const fall = Math.max(0, t - (L.b - 0.4));
      lets('for show?', 84, 444, { size: 136, fam: F.serif, italic: true, color: C.orange, riso: [C.pink], age: A(3), seed: 121 }, j => {
        const f = Math.max(0, fall - j * 0.05);
        return { dy: f * f * 1400, rot: f * (j % 2 ? 1.5 : -1.5) };
      });
    }],
  ];

  // 副歌第一句：黃色紙條 I’M UPPING MY + 滿版剪紙 P(DOOM)
  function hook(L, t, A) {
    const a = A(0);
    if (a < 0) return;
    g.save();
    g.fillStyle = `rgba(0,0,0,${0.32 * clamp(a / 0.1)})`;
    g.fillRect(0, 0, W, H);
    g.restore();
    strip('I’M UPPING MY', 640, 200, a, { size: 54, fam: F.cond, align: 'c', rot: -0.03, seed: 130, paper: C.yellow });
    lets('P(DOOM)', 640, 520, { size: 290, riso: [C.pink, C.blue], risoD: 10, align: 'c', age: A(1), stagger: 0.07, seed: 131, tilt: 0.14, shadow: 4 });
  }

  // 便利商店的收據從右邊吐出來，一個字一個字印上去
  function receipt(L, t) {
    const age = t - L.a;
    const k = ease.out(clamp((age + 0.1) / 0.45));
    const x = 900, w = 290, top = 118;
    g.font = K.font(22, F.mono, '700');
    const rows = [];
    let line = '';
    L.words.forEach(wd => {
      if (t < wd.t0) return;
      const s = wd.txt.toUpperCase();
      const next = line ? line + ' ' + s : s;
      if (g.measureText(next).width > w - 40 && line) { rows.push(line); line = s; } else line = next;
    });
    if (line) rows.push(line);
    const done = t >= L.words[L.words.length - 1].t1;
    const all = ['* TRAINING RUN *', '#4096   01:13', '- - - - - - - - - -', ...rows, ...(done ? ['- - - - - - - - - -', 'LOSS      0.0031 ▼', 'THANK YOU'] : [])];
    const h = 36 + all.length * 30;
    g.save();
    g.translate(x + (1 - k) * 380, top);
    g.rotate(0.035);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(w, 0);
    g.lineTo(w, h);
    for (let i = 0; i <= 14; i++) g.lineTo(w - (w * i) / 14, h + (i % 2 ? 9 : 0));
    g.closePath();
    K.fillPaper('#f7f4ec', 3);
    g.fillStyle = '#26221d';
    all.forEach((r, i) => {
      const center = i < 2 || r === 'THANK YOU';
      g.font = K.font(i < 1 || r === 'THANK YOU' ? 20 : 22, F.mono, '700');
      g.textAlign = center ? 'center' : 'left';
      g.fillText(r, center ? w / 2 : 20, 40 + i * 30);
    });
    g.restore();
  }

  // 黑板：Forward 往前寫、backward 鏡像倒著寫、repeat 一直重複
  function chalk(L, t) {
    const w = L.words;
    const x = 700, size = 56;
    const col = 'rgba(244,242,232,.9)';
    const write = (txt, y, t0, dur, rev, mirror) => {
      if (t < t0) return;
      const n = [...txt].length;
      const p = clamp((t - t0) / dur) * n;
      const tw = widthOf(txt, size, F.serif, '', true);
      around(x + tw / 2, y, 0, mirror ? -1 : 1, 1, () => lets(txt, x, y, { size, fam: F.serif, italic: true, color: col, shadow: 0, age: 9, stagger: 0, seed: 140, boil: 0.6 }, j => ({ a: clamp(p - (rev ? n - 1 - j : j)) })));
    };
    write('Forward MLP,', 196, w[0].t0, 0.7, false, false);
    write('backward,', 268, w[2].t0, 0.5, true, true);
    for (let e = 0; e < 3; e++) {
      const t0 = w[3].t0 + e * 0.35;
      if (t < t0) continue;
      g.save();
      g.globalAlpha *= (1 - e * 0.3) * clamp((t - t0) / 0.2);
      lets('repeat', x + e * 22, 340 + e * 16, { size, fam: F.serif, italic: true, color: col, shadow: 0, age: 9, seed: 141 + e, boil: 0.6 });
      g.restore();
    }
  }

  const LINES = SRC.map(([a, b, s, hits, draw], i, all) => {
    const ws = s.split(' ');
    const wt = ws.map(syl);
    const tot = wt.reduce((p, q) => p + q, 0);
    const span = Math.min(b - a - 0.1, 0.4 + tot * 0.3);
    let acc = 0;
    const words = ws.map((txt, k) => {
      const t0 = a + (span * acc) / tot;
      acc += wt[k];
      return { i: k, txt, t0, t1: a + (span * acc) / tot };
    });
    return { a, b, s, hits, draw, words, out: Math.min(b + 0.35, all[i + 1] ? all[i + 1][0] - 0.05 : b + 0.8) };
  });
  const lineAt = t => LINES.find(l => t >= l.a - 0.1 && t < l.out);

  return {
    lines: LINES,
    // 重拍的力道（0 ~ 1.4）：剛砸下來最大，0.4 秒內退掉；pdoom.js 拿去推鏡與晃動畫面
    impact(t) {
      const L = lineAt(t);
      if (!L) return 0;
      let m = 0;
      L.hits.forEach(([i, s]) => {
        const age = t - L.words[i].t0;
        if (age >= 0 && age < 0.5) m = Math.max(m, s * Math.exp(-age * 10));
      });
      return m;
    },
    draw(t) {
      const L = lineAt(t);
      if (!L) return;
      FR12 = Math.floor(t * 12);
      const out = 1 - clamp((t - (L.out - 0.22)) / 0.22);
      g.save();
      g.globalAlpha = out;
      L.draw(L, t, i => t - L.words[i].t0);
      g.restore();
    },
  };
};
