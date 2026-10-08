// 自走SLOT：把 assets-src/auto-slot/ 的 Leonardo 原檔轉成 Godot 專案與網頁用的圖
// node scripts/auto-slot-assets.mjs（需要先 npm install，用到 sharp；先跑 python scripts/auto-slot-puppets.py）
// - 符號：從主題符號表（4 × 3）與撲克牌面（一排 5 個）切出來，從每格邊緣往內把灰底挖掉（顏色相近才算底），
//   邊緣用半透明過渡並扣掉灰底的顏色，發光與光點才不會帶灰邊 → godot/auto-slot/art/symbols/
// - 自走區前景道具（紅蘑菇、小白花、提燈）也從符號表切 → godot/auto-slot/art/props/
// - 背景：左右兩端交叉淡化，接成可以無限往左捲的長條 → art/bg-loop.webp，也給網頁 loading 畫面用
// - 首頁卡片封面 → assets/posters/auto-slot.webp
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const src = 'assets-src/auto-slot';
const art = 'godot/auto-slot/art';
const web = 'assets/auto-slot';
for (const dir of [`${art}/symbols`, `${art}/props`, web]) mkdirSync(dir, { recursive: true });

/* ---------- 符號與道具 ---------- */
const LO = 10, HI = 46, SIZE = 256;

// 切出一格並挖掉底色。holes：字母中間被包住的洞（0、Q、A）也要挖，從純底色的像素一起往外灌
async function keyOut(sheet, [x0, x1], [y0, y1], bgs, file, holes = false) {
  const w = x1 - x0 + 4, h = y1 - y0 + 4, left = x0 - 2, top = y0 - 2;
  const rgba = Buffer.alloc(w * h * 4);
  const dist = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((top + y) * sheet.info.width + left + x) * sheet.info.channels;
    const c = [sheet.data[i], sheet.data[i + 1], sheet.data[i + 2]];
    dist[y * w + x] = Math.min(...bgs.map(b => Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2])));
    rgba.set([...c, 255], (y * w + x) * 4);
  }
  // 從邊緣往內灌水：只有跟底色相近、而且連得到邊緣的像素才算底
  const isBg = new Uint8Array(w * h), queue = [];
  const push = p => { if (!isBg[p] && dist[p] < HI) { isBg[p] = 1; queue.push(p); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  if (holes) for (let p = 0; p < w * h; p++) if (dist[p] < LO / 2) push(p);
  while (queue.length) {
    const p = queue.pop(), x = p % w, y = (p - x) / w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  const bg = bgs[0];
  for (let p = 0; p < w * h; p++) {
    if (!isBg[p]) continue;
    const t = Math.min(1, Math.max(0, (dist[p] - LO) / (HI - LO)));
    const a = t * t * (3 - 2 * t);
    if (a < .04) { rgba[p * 4 + 3] = 0; continue; }
    for (let k = 0; k < 3; k++) rgba[p * 4 + k] = Math.max(0, Math.min(255, Math.round((rgba[p * 4 + k] - bg[k] * (1 - a)) / a)));
    rgba[p * 4 + 3] = Math.round(a * 255);
  }
  const icon = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer();
  await sharp(icon)
    .resize(SIZE - 16, SIZE - 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 88, alphaQuality: 92 })
    .toFile(file);
}

// 主題符號表：4 × 3，每格有一塊灰底圓角方塊
const themes = await sharp(`${src}/symbols.jpg`).raw().toBuffer({ resolveWithObject: true });
const SHEET = [
  ['symbols/hood', 'symbols/pie', 'symbols/rabbit', 'props/lantern'],
  ['props/flower', 'symbols/wolf', 'props/mushroom', 'symbols/basket'],
  ['symbols/cottage', 'symbols/crown', 'symbols/apple', 'symbols/coin'],
];
const XS = [[26, 255], [273, 503], [521, 750], [768, 998]];
const YS = [[79, 331], [390, 634], [692, 935]];
for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
  await keyOut(themes, XS[col], YS[row], [[161, 156, 152], [191, 188, 183]], `${art}/${SHEET[row][col]}.webp`);
}

// 撲克牌面：一排五個
const royals = await sharp(`${src}/royals.jpg`).raw().toBuffer({ resolveWithObject: true });
const ROYALS = [['ten', 40, 310], ['jack', 360, 552], ['queen', 584, 797], ['king', 837, 1063], ['ace', 1107, 1324]];
for (const [name, x0, x1] of ROYALS) await keyOut(royals, [x0, x1], [270, 500], [[187, 184, 179]], `${art}/symbols/${name}.webp`, true);

/* ---------- 背景：左右交叉淡化接成循環 ---------- */
const OVERLAP = 360;
const bgRaw = await sharp(`${src}/bg.jpg`).raw().toBuffer({ resolveWithObject: true });
const { width: BW, height: BH, channels: BC } = bgRaw.info;
const L = BW - OVERLAP;
const loop = Buffer.alloc(L * BH * 3);
for (let y = 0; y < BH; y++) for (let x = 0; x < L; x++) {
  const a = (y * BW + x) * BC;
  let r = bgRaw.data[a], g = bgRaw.data[a + 1], b = bgRaw.data[a + 2];
  if (x < OVERLAP) {
    const t = .5 - .5 * Math.cos(Math.PI * x / OVERLAP);
    const o = (y * BW + L + x) * BC;
    r = r * t + bgRaw.data[o] * (1 - t);
    g = g * t + bgRaw.data[o + 1] * (1 - t);
    b = b * t + bgRaw.data[o + 2] * (1 - t);
  }
  loop.set([r, g, b], (y * L + x) * 3);
}
const bgLoop = sharp(loop, { raw: { width: L, height: BH, channels: 3 } });
await bgLoop.clone().webp({ quality: 82 }).toFile(`${art}/bg-loop.webp`);
await bgLoop.clone().resize({ height: 480 }).webp({ quality: 74 }).toFile(`${web}/bg-loop.webp`);
console.log('bg loop', L, 'x', BH);

/* ---------- 首頁卡片封面（assets/posters/auto-slot.webp） ---------- */
{
  const W = 1280, H = 720, FONT = 'Microsoft JhengHei, Noto Sans TC, PingFang TC, sans-serif';
  const tiles = ['ace', 'hood', 'crown', 'cottage', 'wolf'];
  const S = 132, G = 14, X0 = (W - (S * 5 + G * 4)) / 2, Y0 = 520;
  const label = (x, y, fill, text, ink) => `<rect x="${x + 8}" y="${y + S - 40}" width="${S - 16}" height="30" rx="7" fill="url(#${fill})"/>
    <text x="${x + S / 2}" y="${y + S - 17}" text-anchor="middle" font-family="Arial Black, ${FONT}" font-size="21" fill="#fff" stroke="${ink}" stroke-width="4" paint-order="stroke">${text}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#140d09" stop-opacity="0"/><stop offset="1" stop-color="#140d09" stop-opacity=".92"/></linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset=".55" stop-color="#f2aa1e"/><stop offset="1" stop-color="#c27408"/></linearGradient>
      <linearGradient id="red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9c8a"/><stop offset=".55" stop-color="#e2301e"/><stop offset="1" stop-color="#9a1008"/></linearGradient>
      <linearGradient id="title" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="#ffd25a"/><stop offset="1" stop-color="#e07a10"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#fade)"/>
    <rect x="${X0 - 18}" y="${Y0 - 18}" width="${S * 5 + G * 4 + 36}" height="${S + 36}" rx="24" fill="#5a3416" stroke="#9a6834" stroke-width="4"/>
    ${tiles.map((id, k) => {
      const x = X0 + k * (S + G), wild = id === 'crown', bonus = id === 'cottage';
      return `<rect x="${x}" y="${Y0}" width="${S}" height="${S}" rx="14" fill="${wild ? '#4a300c' : bonus ? '#4a140c' : '#1d2125'}" stroke="${wild ? '#ffd25a' : bonus ? '#ff6a50' : '#3a3f44'}" stroke-width="${wild || bonus ? 4 : 2}"/>
        ${wild ? label(x, Y0, 'gold', 'WILD', '#6a3200') : bonus ? label(x, Y0, 'red', 'BONUS', '#4e0600') : ''}`;
    }).join('')}
    <text x="${W / 2}" y="132" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="104" fill="url(#title)" stroke="#5a2a00" stroke-width="10" paint-order="stroke">自走 SLOT</text>
  </svg>`;
  const symbol = async (id, size) => sharp(`${art}/symbols/${id}.webp`).resize(size, size).png().toBuffer();
  const layers = [
    { input: Buffer.from(svg), left: 0, top: 0 },
    { input: await sharp(`${web}/hero-stand.webp`).resize({ height: 440 }).png().toBuffer(), left: 170, top: 110 },
    { input: await sharp(`${web}/wolf-stand.webp`).resize({ height: 450 }).flop().png().toBuffer(), left: 800, top: 100 },
  ];
  for (const [k, id] of tiles.entries()) {
    const special = id === 'crown' || id === 'cottage';
    const size = special ? 96 : 116;
    layers.push({ input: await symbol(id, size), left: Math.round(X0 + k * (S + G) + (S - size) / 2), top: Y0 + (special ? 4 : 8) });
  }
  // sharp 在同一條管線裡會先縮放再疊圖，所以分兩步
  const bg = await sharp(`${src}/bg.jpg`).resize(W, H, { fit: 'cover' }).toBuffer();
  const poster = await sharp(bg).composite(layers).png().toBuffer();
  await sharp(poster).resize(640, 360).webp({ quality: 84 }).toFile('assets/posters/auto-slot.webp');
}
