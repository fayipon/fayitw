// HG-Fable01 -小紅帽：把 assets-src/auto-slot/ 的 Leonardo 原檔轉成 Godot 專案與網頁用的圖
// node scripts/auto-slot-assets.mjs（需要先 npm install，用到 sharp；轉輪符號與介面零件由 python scripts/auto-slot-gothic.py 產生）
// - 自走區（照設計稿的月夜森林）：
//   遠景 r-far（月亮、松林、亮著燈的村莊、林間小路）不捲動 → godot/auto-slot/art/field/far.webp
//   近景 r-near（左右的大樹、前景地面）：洋紅底挖空，沿著頭尾最像的路線接成可以無限往左捲的長條 → art/field/near.webp
// - 角色（已去背）：小紅帽跑步、架式、揮砍，大野狼 → art/field/<名稱>.webp
// - 網頁 loading 畫面的背景、標題字與兩個角色 → assets/auto-slot/loading-*.webp
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

/* ---------- 自走區：遠景與近景 ---------- */
await sharp(`${src}/r-far.jpg`).webp({ quality: 80 }).toFile(`${art}/field/far.webp`);

// 近景：洋紅程度 m = min(R, B) - G。門檻壓得比較低：一沾到洋紅就整個挖掉，
// 只留沒被染色的大樹與前景地面；邊緣再扣掉混進來的洋紅
{
  const raw = await sharp(`${src}/r-near.jpg`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
  const near = seamLoop(px, raw.info.width, raw.info.height, 420);
  await sharp(near.data, { raw: { width: near.width, height: near.height, channels: 4 } }).webp({ quality: 82, alphaQuality: 90 }).toFile(`${art}/field/near.webp`);
  console.log('field near', near.width, 'x', near.height);
}

/* ---------- 角色：切掉透明邊、統一高度 ---------- */
const trimmed = async (name, height) => sharp(await sharp(`${src}/${name}-cut.png`).trim({ threshold: 1 }).png().toBuffer()).resize({ height });
for (const [name, out] of [['r-hero-run', 'hero-run'], ['r-hero-stance', 'hero-stance'], ['r-hero-slash', 'hero-slash'], ['r-wolf', 'wolf']]) {
  await (await trimmed(name, 720)).webp({ quality: 86, alphaQuality: 92 }).toFile(`${art}/field/${out}.webp`);
}

/* ---------- 網頁 loading 畫面 ---------- */
await sharp(`${src}/r-scene.jpg`).resize({ height: 640 }).webp({ quality: 76 }).toFile(`${web}/loading-bg.webp`);
await (await trimmed('r-hero-stance', 520)).webp({ quality: 82 }).toFile(`${web}/loading-hero.webp`);
await (await trimmed('r-wolf', 440)).webp({ quality: 82 }).toFile(`${web}/loading-wolf.webp`);
await (await trimmed('r-logo', 420)).webp({ quality: 86, alphaQuality: 92 }).toFile(`${web}/loading-logo.webp`);

/* ---------- 首頁卡片封面（assets/posters/auto-slot.webp）：月夜森林、小紅帽與大野狼對峙、標題字 ---------- */
{
  const W = 1280, H = 720;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#070a12" stop-opacity="0"/><stop offset="1" stop-color="#070a12" stop-opacity=".85"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#fade)"/>
  </svg>`;
  const hero = await (await trimmed('r-hero-stance', 440)).png().toBuffer();
  const wolf = await (await trimmed('r-wolf', 400)).png().toBuffer();
  const logo = await (await trimmed('r-logo', 300)).png().toBuffer();
  const [heroMeta, wolfMeta, logoMeta] = await Promise.all([hero, wolf, logo].map(b => sharp(b).metadata()));
  // sharp 在同一條管線裡會先縮放再疊圖，所以分兩步
  const bg = await sharp(`${src}/r-scene.jpg`).resize(W, H, { fit: 'cover' }).modulate({ brightness: 0.85 }).toBuffer();
  const poster = await sharp(bg).composite([
    { input: Buffer.from(svg), left: 0, top: 0 },
    { input: hero, left: 110, top: 680 - heroMeta.height },
    { input: wolf, left: W - 90 - wolfMeta.width, top: 680 - wolfMeta.height },
    { input: logo, left: Math.round((W - logoMeta.width) / 2), top: 40 },
  ]).png().toBuffer();
  await sharp(poster).resize(640, 360).webp({ quality: 84 }).toFile('assets/posters/auto-slot.webp');
}
