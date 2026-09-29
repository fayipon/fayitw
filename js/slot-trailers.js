/* =========================================================
   老虎機介紹動畫：每款遊戲一份資料，套同一個 Motion Graphic 分鏡
   開場 → 實機玩法 → 倍數說明 → 實機免費遊戲觸發 → 實機倍數翻倍 → 數據 → 開始遊玩
   實機片段放在 assets/clips/，時間點（cue）對齊片段內的畫面
   ========================================================= */
(() => {
  /*
    每款遊戲：
      colors   a 主色、b 輔色、bg1/bg2 背景漸層
      deco     開場漂浮的符號
      screen   實機畫面外框尺寸（依片段比例）
      clips    base / trigger / free / won 四段實機片段與秒數
      base     實機玩法段的字卡 [{ t, k?, h, s?, grid? }]（t = 片段內秒數）
      board    盤面格子（grid 字卡用）
      ladder   倍數說明
      trigger  免費遊戲觸發段的字卡
      free     倍數翻倍段：mult = [{ t, m }] 倍數跳動的時間點
      stats    三個數據；vol 波動度（level / of）
    規格來自遊戲商公開資料或遊戲內說明，實際以遊戲內說明為準。
  */
  const GAMES = [
    {
      id: 'super-ace',
      name: 'Super Ace',
      zh: '超級王牌',
      provider: 'JILI',
      colors: { a: '#ffc93c', b: '#e8413a', bg1: '#1f6a45', bg2: '#06160e' },
      deco: ['♠', '♥', '♦', '♣'],
      tagline: '撲克牌消除・金色牌變 Joker・免費遊戲倍數最高 ×10',
      screen: { w: 400, h: 578 },
      clips: {
        base: { src: 'assets/clips/superace-base.mp4', dur: 5.0 },
        trigger: { src: 'assets/clips/superace-trigger.mp4', dur: 10.6 },
        free: { src: 'assets/clips/superace-free.mp4', dur: 10.8 },
        won: { src: 'assets/clips/superace-won.mp4', dur: 5.8 },
      },
      board: { cols: 5, rows: 4 },
      base: [
        { t: 0.2, k: '5×4 盤面', h: '<em>1,024</em> 種贏法', s: '由左到右，相鄰三軸以上出現同樣的牌就贏', grid: true },
        { t: 2.5, h: '金色牌<br>變成 <em>Joker</em>', s: '第 2～4 軸的金色牌參與贏分後，翻成百搭' },
      ],
      ladder: {
        title: '連續消除，<em>倍數</em>一路往上跳',
        rows: [['一般遊戲', ['×1', '×2', '×3', '×5']], ['免費遊戲', ['×2', '×4', '×6', '×10']]],
        note: '同一轉裡消除越多次，倍數越高；免費遊戲全部加倍',
      },
      trigger: [
        { t: 0.4, k: '實機畫面', h: '金幣 <em>Scatter</em>', s: '盤面上出現就先記著' },
        { t: 5.0, h: '湊齊 <em>3 個</em>', s: 'Scatter 3 個以上觸發免費遊戲' },
        { t: 8.1, h: '<em>10 次</em><br>免費遊戲', s: '免費遊戲中再出現 Scatter 還能加場' },
      ],
      free: {
        h: '免費遊戲<br>倍數 <em>×2 → ×10</em>',
        mult: [{ t: 0.2, m: '×2' }, { t: 3.6, m: '×4' }, { t: 6.1, m: '×6' }, { t: 8.6, m: '×10' }],
      },
      stats: [
        { v: 97, d: 0, u: '%', l: 'RTP' },
        { v: 1500, d: 0, u: '倍', l: '最高倍數' },
        { v: 1024, d: 0, u: '', l: '種贏法' },
      ],
      vol: { text: '低～中', level: 2, of: 5 },
      end: '5×4 撲克牌消除・免費遊戲倍數 ×10',
      endCaption: '實機畫面：免費遊戲結算。',
    },
    {
      id: 'pinata-wins',
      name: 'Piñata Wins',
      provider: 'PG SOFT',
      colors: { a: '#ffd23f', b: '#ff4f8b', bg1: '#7b2d73', bg2: '#190a22' },
      deco: ['★', '◆', '●', '▲'],
      tagline: '金框符號藏倍數・皮納塔倍數加成・最高 5,000 倍',
      screen: { w: 470, h: 548 },
      labels: { feat: '金框倍數', trig: '連續消除', free: '皮納塔倍數' },
      clips: {
        base: { src: 'assets/clips/pinata-base.mp4', dur: 6.6 },
        trigger: { src: 'assets/clips/pinata-chain.mp4', dur: 7.0 },
        free: { src: 'assets/clips/pinata-mult.mp4', dur: 11.0 },
        won: { src: 'assets/clips/pinata-end.mp4', dur: 5.0 },
      },
      board: { cols: 5, rows: 4 },
      base: [
        { t: 0.2, k: '5×4 盤面', h: '<em>金框</em>符號', s: '盤面上會出現帶金色外框的符號', grid: true },
        { t: 4.7, h: '連線就<em>消除</em>', s: '贏分的符號消失，上方補牌再算一次' },
      ],
      ladder: {
        title: '金框符號裡藏著<em>倍數</em>',
        rows: [['可能出現', ['×2', '×10', '×50', '×100']]],
        note: '遊戲內說明：金框符號可能帶 ×2 到 ×100 的倍數',
      },
      trigger: [
        { t: 0.3, k: '實機畫面', h: '一轉<em>連續</em>贏', s: '消除後補上的符號還能再連線' },
        { t: 4.6, h: '越消<em>越多</em>', s: '同一轉裡連續贏分' },
      ],
      free: {
        h: '皮納塔出現<br>贏分直接 <em>×2</em>',
        mult: [{ t: 5.0, m: '×2' }],
      },
      stats: [
        { v: 96.38, d: 2, u: '%', l: 'RTP' },
        { v: 5000, d: 0, u: '倍', l: '最高倍數' },
        { v: 100, d: 0, p: '×', u: '', l: '金框最高倍數' },
      ],
      end: '3 個以上 Scatter 觸發 15 次以上免費遊戲',
      endCaption: '實機畫面：連續旋轉。',
    },
    {
      id: 'mahjong-ways-2',
      name: 'Mahjong Ways 2',
      zh: '麻將胡了2',
      provider: 'PG SOFT',
      colors: { a: '#f5c542', b: '#e0452f', bg1: '#8c2a1c', bg2: '#1f0805' },
      deco: ['中', '發', '胡', '萬'],
      tagline: '2,000 種贏法・連續消除倍數往上跳・免費遊戲最高 ×10',
      screen: { w: 420, h: 572 },
      labels: { trig: '連續消除', free: '倍數升級' },
      clips: {
        base: { src: 'assets/clips/mw2-base.mp4', dur: 7.0 },
        trigger: { src: 'assets/clips/mw2-chain.mp4', dur: 7.0 },
        free: { src: 'assets/clips/mw2-mult.mp4', dur: 9.5 },
        won: { src: 'assets/clips/mw2-end.mp4', dur: 6.5 },
      },
      board: { cols: 5, rows: 5 },
      base: [
        { t: 0.2, k: '5 軸盤面', h: '<em>2,000</em> 種贏法', s: '由左到右，相鄰軸出現同樣的牌就贏', grid: true },
        { t: 5.0, h: '<em>金色</em>麻將<br>變成百搭', s: '金色麻將參與贏分後翻成百搭' },
      ],
      ladder: {
        title: '連續消除，<em>倍數</em>一路往上跳',
        rows: [['一般遊戲', ['×1', '×2', '×3', '×5']], ['免費遊戲', ['×2', '×4', '×6', '×10']]],
        note: '同一轉裡消除越多次，倍數越高；免費遊戲最高 ×10',
      },
      trigger: [
        { t: 0.2, k: '實機畫面', h: '一轉<em>連續</em>消除', s: '贏分的麻將消失，上方補牌再算一次' },
        { t: 4.0, h: '贏分一路<br><em>往上疊</em>', s: '同一轉裡連續消除' },
      ],
      free: {
        h: '連續消除<br>倍數 <em>×1 → ×3</em>',
        mult: [{ t: 0.3, m: '×1' }, { t: 3.3, m: '×2' }, { t: 6.5, m: '×3' }],
      },
      stats: [
        { v: 97.11, d: 2, u: '%', l: 'RTP' },
        { v: 100000, d: 0, u: '倍', l: '最高倍數' },
        { v: 2000, d: 0, u: '', l: '種贏法' },
      ],
      end: '3 個以上 Scatter 觸發 10 次以上免費遊戲',
      endCaption: '實機畫面：連續消除。',
    },
  ];

  const G = window.gsap;
  const cfg = window.AFF_CONFIG || {};
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const root = $('.tr-player');
  const mg = $('.mg', root);
  const picker = $('.sl-pick');
  if (!root || !mg || !G || !window.MGPlayer) return;

  const words = text => text.split(' ').map(w => `<span>${w}</span>`).join(' ');
  const hexA = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;
  const fmtNum = (n, d) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---------- 依資料建立分鏡與時間軸 ---------- */

  function build(game) {
    const { w: SW, h: SH } = game.screen;
    const c = game.clips;
    const T = {};
    T.open = 0;
    T.base = 4.5;
    T.feat = T.base + Math.max(c.base.dur, 5.5);
    T.trig = T.feat + 5.5;
    T.free = T.trig + c.trigger.dur;
    T.stats = T.free + c.free.dur;
    T.end = T.stats + 5;
    const END = T.end + Math.max(c.won.dur + 0.6, 6.5);

    const devLeft = { x: 150, y: (720 - SH) / 2 + 12 };
    const devRight = { x: 1280 - 150 - SW, y: devLeft.y };
    const coLeft = 100;
    const coRight = devLeft.x + SW + 90;

    Object.entries({ '--a': game.colors.a, '--b': game.colors.b, '--bg1': game.colors.bg1, '--bg2': game.colors.bg2 })
      .forEach(([k, v]) => mg.style.setProperty(k, v));
    mg.classList.add('sl');

    const coWidth = { [coRight]: Math.min(600, 1280 - coRight - 40), [coLeft]: devRight.x - coLeft - 40 };
    const cue = (x, item) => `<div class="co" style="left:${x}px;top:${item.grid ? 110 : 210}px;width:${coWidth[x]}px">
        ${item.k ? `<span class="co-k">${item.k}</span>` : ''}
        <p class="co-h">${item.h}</p>${item.s ? `<p class="co-s">${item.s}</p>` : ''}</div>`;

    mg.innerHTML = `
    <div class="mg-cam">
      <div class="mg-bg"></div>
      <div class="mg-dots"></div>

      <section class="sc sc-open">
        <div class="sl-rays"></div>
        <div class="sl-deco">${game.deco.map(d => `<span>${d}</span>`).join('')}</div>
        <p class="sl-prov"><b>${game.provider}</b></p>
        <h2 class="sl-name">${words(game.name)}</h2>
        ${game.zh ? `<p class="sl-zh">${game.zh}</p>` : ''}
        <p class="sl-tag">${game.tagline}</p>
      </section>

      <section class="sc sc-base">
        ${game.base.map(item => cue(coRight, item)).join('')}
        <div class="sp-grid" style="left:${coRight}px;top:390px;grid-template-columns:repeat(${game.board.cols},52px)">${'<i></i>'.repeat(game.board.cols * game.board.rows)}</div>
      </section>

      <section class="sc sc-feat">
        <h3 class="ld-title">${game.ladder.title}</h3>
        ${game.ladder.rows.map(([label, steps], r) => `<div class="ld-row" style="top:${game.ladder.rows.length === 1 ? 290 : 220 + r * 170}px"><b>${label}</b>${steps.map(s => `<span class="ld-box">${s}</span>`).join('')}</div>`).join('')}
        <p class="ld-note">${game.ladder.note}</p>
      </section>

      <section class="sc sc-trig">
        ${game.trigger.map(item => cue(coLeft, item)).join('')}
      </section>

      <section class="sc sc-free">
        <div class="co" style="left:${coRight}px;top:90px;width:${coWidth[coRight]}px"><span class="co-k">實機畫面</span><p class="co-h">${game.free.h}</p></div>
        <div class="mx-ring" style="left:${coRight + 70}px;top:300px"></div>
        ${game.free.mult.map(m => `<p class="mx" style="left:${coRight + 40}px;top:330px">${m.m}</p>`).join('')}
      </section>

      <section class="sc sc-stats">
        <div class="st3">${game.stats.map(s => `<div><b style="${fmtNum(s.v, s.d).length > 5 ? 'font-size:84px' : ''}">${s.p ? `<small>${s.p}</small>` : ''}<em class="num">0</em><small>${s.u}</small></b><span class="lbl">${s.l}</span></div>`).join('')}</div>
        ${game.vol ? `<p class="st-vol">波動度 ${Array.from({ length: game.vol.of }, (_, i) => `<i class="${i < game.vol.level ? 'on' : ''}"></i>`).join('')} ${game.vol.text}</p>` : ''}
        <p class="st-fine">規格依遊戲內說明與遊戲商公開資料，實際以遊戲內說明為準</p>
      </section>

      <section class="sc sc-end">
        <div class="sl-end-copy">
          <p>${game.provider}</p>
          <h3>${game.name}</h3>
          <p class="sub">${game.end}</p>
          <span class="btn">立即遊玩 →<i></i></span>
          <small>18+ 請理性遊戲</small>
        </div>
      </section>

      <div class="dev" style="width:${SW}px;height:${SH}px">
        ${Object.entries(c).map(([k, v]) => `<video data-clip="${k}" src="${v.src}" muted playsinline preload="auto"></video>`).join('')}
      </div>
      <p class="dev-tag"><i></i>實機畫面</p>
    </div>
    <div class="mg-wipe"><i></i><i></i><i></i><i></i></div>`;

    const S = name => $(`.sc-${name}`, mg);
    const cam = $('.mg-cam', mg);
    const dev = $('.dev', mg);
    const tag = $('.dev-tag', mg);
    const vid = name => $(`video[data-clip="${name}"]`, dev);
    const tl = G.timeline({ paused: true });
    const show = (name, at, until) => {
      tl.set(S(name), { autoAlpha: 1 }, at);
      if (until != null) tl.set(S(name), { autoAlpha: 0 }, until);
    };

    // 斜條轉場，顏色跟著遊戲
    const wipe = $$('.mg-wipe i', mg);
    const wipeColors = [game.colors.a, game.colors.b, game.colors.bg2, '#ffffff'];
    G.set(wipe, { left: i => -300 + i * 400, width: 640, skewX: -20, scaleX: 0, background: i => wipeColors[i] });
    const wipeAt = at => {
      tl.set(wipe, { transformOrigin: '0% 50%' }, at - 0.6)
        .to(wipe, { scaleX: 1, duration: 0.4, stagger: 0.05, ease: 'power3.in' }, at - 0.55)
        .set(wipe, { transformOrigin: '100% 50%' }, at)
        .to(wipe, { scaleX: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out' }, at + 0.02);
    };

    // 字卡依序出現、換下一張時淡出
    const cues = (scene, list, start) => {
      const cards = $$('.co', scene);
      list.forEach((item, i) => {
        const at = start + item.t;
        const next = list[i + 1] ? start + list[i + 1].t : null;
        tl.fromTo(cards[i].children, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, ease: 'power3.out', immediateRender: false }, at);
        tl.set(cards[i], { autoAlpha: 1 }, at);
        if (next != null) tl.to(cards[i], { autoAlpha: 0, duration: 0.25 }, next - 0.25);
      });
      G.set(cards, { autoAlpha: 0 });
    };

    // 實機畫面外框：位置與顯示中的片段
    const clipWindow = (name, at, until) => {
      tl.set(vid(name), { opacity: 1 }, at).set(vid(name), { opacity: 0 }, until);
    };

    /* 開場 */
    const open = S('open');
    const deco = $$('.sl-deco span', open);
    G.set(deco, { left: i => [120, 1020, 170, 980][i % 4], top: i => [80, 90, 470, 460][i % 4], color: i => (i % 2 ? game.colors.b : game.colors.a) });
    show('open', 0, T.base);
    tl.fromTo($('.sl-rays', open), { opacity: 0, rotation: -30, scale: 0.6 }, { opacity: 1, rotation: 20, scale: 1, duration: T.base, ease: 'power2.out' }, 0)
      .fromTo(deco, { opacity: 0, scale: 0, rotation: i => (i % 2 ? 90 : -90) }, { opacity: 0.9, scale: 1, rotation: i => (i % 2 ? 12 : -12), duration: 0.7, stagger: 0.1, ease: 'back.out(2.2)' }, 0.1)
      .to(deco, { y: i => (i % 2 ? 18 : -18), duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.9)
      .fromTo($('.sl-prov', open), { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.4)
      .fromTo($$('.sl-name span', open), { opacity: 0, y: 120, scale: 1.5, rotation: i => (i % 2 ? 8 : -8) }, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.6, stagger: 0.12, ease: 'back.out(2)' }, 0.7)
      .to(cam, { keyframes: { x: [0, -12, 10, -6, 3, 0] }, duration: 0.35, ease: 'none' }, 1.25)
      .fromTo($$('.sl-zh, .sl-tag', open), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.15, ease: 'power3.out' }, 1.4);
    wipeAt(T.base);

    /* 實機玩法 */
    const base = S('base');
    show('base', T.base, T.feat);
    tl.set([dev, tag], { autoAlpha: 1 }, T.base)
      .fromTo(dev, { x: devLeft.x, y: devLeft.y + 60, rotation: -4, scale: 0.9 }, { x: devLeft.x, y: devLeft.y, rotation: 0, scale: 1, duration: 0.7, ease: 'back.out(1.6)' }, T.base)
      .fromTo(tag, { x: devLeft.x + 16, y: devLeft.y - 52, opacity: 0 }, { opacity: 1, duration: 0.4 }, T.base + 0.4);
    clipWindow('base', T.base, T.feat);
    cues(base, game.base, T.base);
    const gridCue = game.base.findIndex(item => item.grid);
    const cells = $$('.sp-grid i', base);
    if (gridCue >= 0) {
      const at = T.base + game.base[gridCue].t + 0.3;
      const cols = game.board.cols;
      tl.fromTo(cells, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.3, stagger: { each: 0.02, from: 'start' }, ease: 'back.out(2)' }, at)
        .to(cells, { background: game.colors.a, borderColor: game.colors.a, duration: 0.2, stagger: i => (i % cols) * 0.18 }, at + 0.8);
      const hide = game.base[gridCue + 1] ? T.base + game.base[gridCue + 1].t - 0.25 : T.feat;
      tl.to(cells, { opacity: 0, duration: 0.25 }, hide);
    } else {
      G.set(cells, { display: 'none' });
    }
    tl.to(dev, { x: -SW - 60, rotation: -8, duration: 0.5, ease: 'power3.in' }, T.feat - 0.55)
      .to(tag, { opacity: 0, duration: 0.2 }, T.feat - 0.55);
    wipeAt(T.feat);

    /* 倍數說明 */
    const feat = S('feat');
    const rows = $$('.ld-row', feat);
    show('feat', T.feat, T.trig);
    tl.fromTo($('.ld-title', feat), { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, T.feat + 0.1);
    rows.forEach((row, r) => {
      const boxes = $$('.ld-box', row);
      const at = T.feat + 0.4 + r * 1.9;
      tl.fromTo(row.children, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.07, ease: 'back.out(2)' }, at);
      // 倍數一格一格亮起來（用補間而不是切 class，拖回去看也正確）
      boxes.forEach((box, i) => {
        const on = at + 0.5 + i * 0.3;
        tl.to(box, { borderColor: game.colors.a, backgroundColor: hexA(game.colors.a, 0.22), color: '#ffffff', boxShadow: `0 0 40px ${hexA(game.colors.a, 0.55)}`, duration: 0.2 }, on)
          .fromTo(box, { scale: 1 }, { scale: 1.15, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, on);
      });
    });
    tl.fromTo($('.ld-note', feat), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, T.feat + 4.2);

    /* 免費遊戲觸發（外框在右） */
    const trig = S('trig');
    show('trig', T.trig, T.free);
    tl.set(dev, { x: 1280 + 40, y: devRight.y, rotation: 8 }, T.trig)
      .to(dev, { x: devRight.x, rotation: 0, duration: 0.65, ease: 'back.out(1.4)' }, T.trig)
      .set(tag, { x: devRight.x + 16, y: devRight.y - 52 }, T.trig)
      .to(tag, { opacity: 1, duration: 0.3 }, T.trig + 0.5);
    clipWindow('trigger', T.trig, T.free);
    cues(trig, game.trigger, T.trig);

    /* 倍數翻倍（外框移到左邊） */
    const free = S('free');
    const mx = $$('.mx', free);
    const ring = $('.mx-ring', free);
    show('free', T.free, T.stats);
    tl.to(tag, { opacity: 0, duration: 0.15 }, T.free - 0.2)
      .to(dev, { x: devLeft.x, duration: 0.6, ease: 'power3.inOut' }, T.free - 0.1)
      .set(tag, { x: devLeft.x + 16, y: devLeft.y - 52 }, T.free + 0.5)
      .to(tag, { opacity: 1, duration: 0.3 }, T.free + 0.5)
      .fromTo($('.co', free).children, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, ease: 'power3.out' }, T.free + 0.2);
    clipWindow('free', T.free, T.stats);
    G.set(mx, { autoAlpha: 0, transformOrigin: '30% 60%' });
    game.free.mult.forEach((m, i) => {
      const at = T.free + m.t;
      if (i > 0) tl.to(mx[i - 1], { autoAlpha: 0, scale: 0.6, duration: 0.2 }, at - 0.05);
      tl.fromTo(mx[i], { autoAlpha: 0, scale: 2.6, rotation: -10 }, { autoAlpha: 1, scale: 1, rotation: -4, duration: 0.32, ease: 'power4.in', immediateRender: false }, at)
        .fromTo(ring, { opacity: 0.9, scale: 0.3 }, { opacity: 0, scale: 1.4, duration: 0.6, ease: 'power2.out', immediateRender: false }, at + 0.3)
        .to(cam, { keyframes: { x: [0, 10, -8, 4, 0] }, duration: 0.25, ease: 'none' }, at + 0.32);
    });
    tl.to(dev, { y: 760, rotation: 6, duration: 0.5, ease: 'power3.in' }, T.stats - 0.55)
      .to(tag, { opacity: 0, duration: 0.2 }, T.stats - 0.55);
    wipeAt(T.stats);

    /* 數據 */
    const stats = S('stats');
    show('stats', T.stats, T.end);
    $$('.st3 > div', stats).forEach((el, i) => {
      const s = game.stats[i];
      const num = $('.num', el);
      const state = { n: 0 };
      const at = T.stats + 0.3 + i * 0.25;
      tl.fromTo(el, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2)' }, at)
        .fromTo(state, { n: 0 }, { n: s.v, duration: 1.4, ease: 'power3.out', onUpdate: () => { num.textContent = fmtNum(state.n, s.d); } }, at);
    });
    if (game.vol) {
      tl.fromTo($('.st-vol', stats), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5 }, T.stats + 1.4)
        .fromTo($$('.st-vol i.on', stats), { scaleX: 0 }, { scaleX: 1, duration: 0.3, stagger: 0.15, transformOrigin: '0% 50%' }, T.stats + 1.7);
    }
    tl.fromTo($('.st-fine', stats), { opacity: 0 }, { opacity: 1, duration: 0.5 }, T.stats + 2.2);
    wipeAt(T.end);

    /* 結尾 */
    const end = S('end');
    show('end', T.end);
    tl.set(dev, { x: devLeft.x, y: devLeft.y, rotation: 0 }, T.end)
      .fromTo(dev, { scale: 0.7, rotation: -6 }, { scale: 1, rotation: -2, duration: 0.7, ease: 'back.out(1.8)', immediateRender: false }, T.end)
      .set(tag, { x: devLeft.x + 16, y: devLeft.y - 52 }, T.end)
      .to(tag, { opacity: 1, duration: 0.3 }, T.end + 0.4)
      .fromTo($$('.sl-end-copy > *', end), { opacity: 0, x: 50 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.12, ease: 'power3.out' }, T.end + 0.3)
      .fromTo($('.sl-end-copy .btn i', end), { xPercent: -120 }, { xPercent: 330, duration: 0.9, ease: 'power2.inOut', repeat: 2, repeatDelay: 0.9 }, T.end + 1.6)
      .to($('.sl-end-copy .btn', end), { scale: 1.06, duration: 0.45, yoyo: true, repeat: 5, ease: 'sine.inOut' }, T.end + 1.8)
      .set({}, {}, END);
    clipWindow('won', T.end, END + 1);

    const label = { base: '實機玩法', feat: '倍數', trig: '免費遊戲', free: '倍數翻倍', ...game.labels };
    const chapters = [
      { at: 0, name: '開場', caption: `${game.name}${game.zh ? `（${game.zh}）` : ''}：${game.tagline}。` },
      { at: T.base, name: label.base, caption: `實機畫面：${game.base.map(b => b.h.replace(/<[^>]+>/g, '')).join('；')}。` },
      { at: T.feat, name: label.feat, caption: game.ladder.note + '。' },
      { at: T.trig, name: label.trig, caption: `實機畫面：${game.trigger.map(b => b.h.replace(/<[^>]+>/g, '')).join('、')}。` },
      { at: T.free, name: label.free, caption: `實機畫面：${game.free.h.replace(/<[^>]+>/g, ' ')}。` },
      { at: T.stats, name: '數據', caption: game.stats.map(s => `${s.l} ${s.p || ''}${fmtNum(s.v, s.d)}${s.u}`).join('、') + (game.vol ? `，波動度${game.vol.text}` : '') + '。' },
      { at: T.end, name: '開始遊玩', caption: `${game.endCaption || ''}立即開始遊玩 ${game.name}。` },
    ];
    const videos = [
      { el: vid('base'), start: T.base, end: T.feat, from: 0 },
      { el: vid('trigger'), start: T.trig, end: T.free, from: 0 },
      { el: vid('free'), start: T.free, end: T.stats, from: 0 },
      { el: vid('won'), start: T.end, end: END + 1, from: 0 },
    ];
    return { tl, chapters, end: END, videos };
  }

  /* ---------- 選遊戲 ---------- */

  let player = null;
  const playLinks = $$('[data-play]');
  const tabs = GAMES.map(game => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.innerHTML = `<i style="--c:${game.colors.a}">${game.provider}</i><span></span>`;
    $('span', b).textContent = game.zh ? `${game.zh} ${game.name}` : game.name;
    b.addEventListener('click', () => select(game.id, true));
    picker.append(b);
    return b;
  });

  function select(id, user) {
    const game = GAMES.find(g => g.id === id) || GAMES[0];
    tabs.forEach((b, i) => b.setAttribute('aria-selected', String(GAMES[i] === game)));
    if (player) player.destroy();
    const built = build(game);
    player = new MGPlayer({ root, ...built });
    if (user) {
      history.replaceState(null, '', `#${game.id}`);
      player.userPaused = false;
      player.play();
    }
    const url = game.url || cfg.playUrl || '#';
    playLinks.forEach(a => {
      a.href = url;
      if (/^https?:/.test(url)) a.rel = 'sponsored noopener';
    });
    $('#sl-title').textContent = `${game.zh || game.name}，一支動畫看懂`;
  }

  select(location.hash.slice(1), false);
  window.addEventListener('hashchange', () => select(location.hash.slice(1), true));
})();
