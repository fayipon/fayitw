// HG-Fable01 -小紅帽：把 assets-src/auto-slot/ 的 Leonardo 原檔轉成 Godot 專案與網頁用的圖
// node scripts/auto-slot-assets.mjs（需要先 npm install，用到 sharp；轉輪符號與介面零件由 python scripts/auto-slot-gothic.py 產生）
// - 自走區（2026-10 繪本奇幻版，照設計稿 s-ref-a 的白天森林）：
//   遠景 s-far（陽光、樹林、外婆家的小屋、林間小路）不捲動 → godot/auto-slot/art/field/far.webp
//   近景 s-near（左右的大樹、前景草地）：洋紅底挖空，沿著頭尾最像的路線接成可以無限往左捲的長條 → art/field/near.webp
// - 怪物（已去背）：森林動物、BOSS（熊、雄鹿、敲門的狼→外婆狼）、EXTRA 的寶箱怪的站姿與受擊 → art/field/<id>.webp、<id>-hurt.webp
// - 角色（已去背）：小紅帽架式、揮砍、蓄力、跳起，大野狼與受擊 → art/field/<名稱>.webp
// - 網頁 loading 畫面的背景（用遠景：整張場景圖 s-scene 底下多畫了金色裝飾）、標題字與兩個角色 → assets/auto-slot/loading-*.webp
// - 首頁卡片封面 → assets/posters/auto-slot.webp
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const src = 'assets-src/auto-slot';
const art = 'godot/auto-slot/art';
const web = 'assets/auto-slot';
for (const dir of [`${art}/field`, web]) mkdirSync(dir, { recursive: true });

/* ---------- 循環接縫 ---------- */
// 頭尾重疊 OV 像素，沿著兩邊最像的那條路線（逐列動態規劃）切換，切線兩側再羽化 F 像素
function seamLoop(px, W, H, OV, F = 10) {
  const L = W - OV;
  const pre = (x, y, c) => { const i = (y * W + x) * 4; return c === 3 ? px[i + 3] : px[i + c] * px[i + 3] / 255; };
  const E = new Float64Array(H * OV), from = new Int16Array(H * OV);
  for (let y = 0; y < H; y++) for (let u = 0; u < OV; u++) {
    let d = 0;
    for (let c = 0; c < 4; c++) d += (pre(u, y, c) - pre(L + u, y, c)) ** 2;
    if (u < F || u >= OV - F) d = Infinity;
    let best = 0, at = u;
    if (y > 0) {
      best = Infinity;
      for (let k = Math.max(0, u - 1); k <= Math.min(OV - 1, u + 1); k++) if (E[(y - 1) * OV + k] < best) { best = E[(y - 1) * OV + k]; at = k; }
    }
    E[y * OV + u] = d + best;
    from[y * OV + u] = at;
  }
  const seam = new Int16Array(H);
  let u = F;
  for (let k = F; k < OV - F; k++) if (E[(H - 1) * OV + k] < E[(H - 1) * OV + u]) u = k;
  for (let y = H - 1; y >= 0; y--) { seam[y] = u; u = from[y * OV + u]; }
  // 切線左邊用圖尾（接上一輪的結尾），右邊用圖頭
  const out = Buffer.alloc(L * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    const o = (y * L + x) * 4;
    const t = x >= OV ? 1 : Math.min(1, Math.max(0, (x - seam[y] + F) / (2 * F)));
    const w = t * t * (3 - 2 * t);
    const a = pre(x, y, 3) * w + (x < OV ? pre(L + x, y, 3) * (1 - w) : 0);
    for (let c = 0; c < 3; c++) {
      const v = pre(x, y, c) * w + (x < OV ? pre(L + x, y, c) * (1 - w) : 0);
      out[o + c] = a > 0 ? Math.min(255, Math.round(v * 255 / a)) : 0;
    }
    out[o + 3] = Math.round(a);
  }
  return { data: out, width: L, height: H };
}

/* ---------- 自走區：遠景與近景（三關：林間小路 s-far／s-near、花田 s-far2／s-near2、外婆家門口 s-far3／s-near3） ---------- */
for (const k of ['', '2', '3']) {
const out = k ? `-${k}` : '';
await sharp(`${src}/s-far${k}.jpg`).webp({ quality: 80 }).toFile(`${art}/field/far${out}.webp`);

// 近景：洋紅程度 m = min(R, B) - G。門檻壓得比較低：一沾到洋紅就整個挖掉，
// 只留沒被染色的大樹與前景地面；邊緣再扣掉混進來的洋紅
{
  const raw = await sharp(`${src}/s-near${k}.jpg`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = raw.data, LO = 14, HI = 56;
  for (let i = 0; i < px.length; i += 4) {
    const m = Math.min(px[i], px[i + 2]) - px[i + 1];
    const t = Math.min(1, Math.max(0, (m - LO) / (HI - LO)));
    const a = 1 - t * t * (3 - 2 * t);
    if (a <= 0.02) { px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0; continue; }
    const spill = Math.min(px[i], px[i + 2]) - px[i + 1];
    if (spill > 0) { px[i] -= spill; px[i + 2] -= spill; }
    px[i + 3] = Math.round(a * 255);
  }
  // 頭尾接起來的重疊寬度：林間小路的兩側大樹位置剛好合得上，重疊 420 接在草地上；花田、外婆家門口兩側都是整棵大樹，
  // 重疊太寬的話接縫會落在兩棵樹中間、把兩邊的樹幹都切掉（只剩樹冠浮在半空），只重疊最外側 60：右邊的樹幹直接接上左邊的樹幹
  const near = seamLoop(px, raw.info.width, raw.info.height, k ? 60 : 420);
  await sharp(near.data, { raw: { width: near.width, height: near.height, channels: 4 } }).webp({ quality: 82, alphaQuality: 90 }).toFile(`${art}/field/near${out}.webp`);
  console.log('field near' + out, near.width, 'x', near.height);
}
}

/* ---------- 角色：切掉透明邊、統一高度 ---------- */
const trimmed = async (name, height) => sharp(await sharp(`${src}/${name}-cut.png`).trim({ threshold: 1 }).png().toBuffer()).resize({ height });
for (const [name, out] of [['s-hero-stance', 'hero-stance'], ['s-hero-slash', 'hero-slash'], ['s-hero-windup', 'hero-windup'], ['s-hero-jump', 'hero-jump']]) {
  await (await trimmed(name, 720)).webp({ quality: 86, alphaQuality: 92 }).toFile(`${art}/field/${out}.webp`);
}
// 怪物（都面向左）：站姿、受擊，假扮外婆的大灰狼（boss）另有露餡的站姿；走路 4 格由 auto-slot-ui.py 切
// 外婆狼露餡圖用拆掉眼鏡的那張（s-m-boss-reveal2，auto-slot-ui.py 拆的；眼鏡另外存，遊戲裡露餡時才飛出去）
// 熊和雄鹿的受擊用重畫的那張（-hurt2，第一版畫進了一把劍）；寶箱怪用改畫成一般寶箱的 s-m-chest2
for (const id of ['squirrel', 'hedgehog', 'raccoon', 'frog', 'hare', 'fox', 'mouse', 'raven', 'boar', 'bear', 'stag', 'knock', 'boss', 'chest']) {
  for (const suf of ['', '-hurt', ...(id === 'boss' ? ['-reveal'] : [])]) {
    const name = id === 'chest' ? `s-m-chest2${suf}`
      : `s-m-${id}${suf}` + (suf === '-reveal' || (suf === '-hurt' && (id === 'bear' || id === 'stag')) ? '2' : '');
    await (await trimmed(name, 720)).webp({ quality: 86, alphaQuality: 92 }).toFile(`${art}/field/${id}${suf}.webp`);
  }
}

/* ---------- 網頁 loading 畫面 ---------- */
await sharp(`${src}/s-far.jpg`).resize({ height: 640 }).webp({ quality: 76 }).toFile(`${web}/loading-bg.webp`);
await (await trimmed('s-hero-stance', 520)).webp({ quality: 82 }).toFile(`${web}/loading-hero.webp`);
// 小紅帽的對手：假扮外婆的大灰狼（大野狼本人已經不出場）
await (await trimmed('s-m-boss', 440)).webp({ quality: 82 }).toFile(`${web}/loading-wolf.webp`);
await (await trimmed('s-logo', 420)).webp({ quality: 86, alphaQuality: 92 }).toFile(`${web}/loading-logo.webp`);

/* ---------- 首頁卡片封面（assets/posters/auto-slot.webp）：白天的森林、小紅帽與大野狼對峙、標題字 ---------- */
{
  const W = 1280, H = 720;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#2a1608" stop-opacity="0"/><stop offset="1" stop-color="#2a1608" stop-opacity=".7"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#fade)"/>
  </svg>`;
  const hero = await (await trimmed('s-hero-stance', 440)).png().toBuffer();
  const wolf = await (await trimmed('s-m-boss', 400)).png().toBuffer();
  const logo = await (await trimmed('s-logo', 300)).png().toBuffer();
  const [heroMeta, wolfMeta, logoMeta] = await Promise.all([hero, wolf, logo].map(b => sharp(b).metadata()));
  // sharp 在同一條管線裡會先縮放再疊圖，所以分兩步
  const bg = await sharp(`${src}/s-far.jpg`).resize(W, H, { fit: "cover" }).toBuffer();
  const poster = await sharp(bg).composite([
    { input: Buffer.from(svg), left: 0, top: 0 },
    { input: hero, left: 110, top: 680 - heroMeta.height },
    { input: wolf, left: W - 90 - wolfMeta.width, top: 680 - wolfMeta.height },
    { input: logo, left: Math.round((W - logoMeta.width) / 2), top: 40 },
  ]).png().toBuffer();
  await sharp(poster).resize(640, 360).webp({ quality: 84 }).toFile('assets/posters/auto-slot.webp');
}
