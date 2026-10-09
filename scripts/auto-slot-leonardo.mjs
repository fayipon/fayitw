// 自走SLOT：用 Leonardo 生成小紅帽美術（Nano Banana Pro），需要去背的再走 remove-bg
// node scripts/auto-slot-leonardo.mjs [只跑這些名稱...]（原檔存到 assets-src/auto-slot/）
// 已經生成過的（index.json 裡有）會跳過；key 從環境變數 LEONARDO_API_KEY 讀，不會印出來
// 風格照設計稿 r-ref.jpg（PG Soft 風的動漫小紅帽）：先上傳成參考圖，其他圖都帶它當風格參考
// 生成完再跑 node scripts/auto-slot-symbols.mjs（符號去背）、python scripts/auto-slot-ui.py 與 node scripts/auto-slot-assets.mjs 轉成遊戲與網頁用的檔案
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const key = process.env.LEONARDO_API_KEY;
if (!key) { console.log('no key'); process.exit(1); }
const outDir = 'assets-src/auto-slot';
const only = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const indexPath = `${outDir}/index.json`;
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};
const save = () => writeFileSync(indexPath, JSON.stringify(index, null, 2));

const H = { authorization: `Bearer ${key}`, accept: 'application/json', 'content-type': 'application/json' };
const api = async (method, path, body) => {
  const r = await fetch('https://cloud.leonardo.ai/api/rest' + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, t };
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const STYLE = 'Premium mobile slot game art matching the art style of the reference image (PG Soft quality): polished anime-inspired 2.5D digital painting, Little Red Riding Hood fairy tale, moonlit deep-blue night forest, warm amber lantern glow, rich crimson red and antique gold accents, crisp clean shapes, soft glossy highlights, high detail, no watermark, no letters or words unless asked.';
const ISOLATED = 'Isolated on a plain flat light-grey background, the entire figure visible with empty space around it, no ground, no cast shadow, no scenery, no other objects.';
const HERO = 'Little Red Riding Hood with a short brown bob, a large flowing crimson hooded cape, white blouse, brown leather bracers and gloves, leather belts and pouches, white skirt with a crimson underskirt, brown laced leather boots, holding a long silver sword, painterly anime rendering with dramatic warm and cold rim lighting';

// upload = 上傳本機的設計稿當參考圖；refs = [名稱, 強度]；cut = 生成後去背
const JOBS = [
  // 設計稿（2026-10 第三版，PG Soft 風）
  { name: 'r-ref', upload: 'r-ref.jpg' },
  // 設計稿裡的小紅帽（裁出來當長相參考）
  { name: 'r-ref-hero', upload: 'r-ref-hero.jpg' },
  // 自走區：月夜森林（遠景固定、近景捲動）、拿劍的小紅帽（架式、跑、揮砍）、伏低的大野狼
  // 小紅帽試畫過三個方向（照設計稿／成熟寫實／精緻 Q 版），選了照設計稿：架式先畫，跑步與揮砍都照架式這張
  {
    name: 'r-hero-stance', w: 1024, h: 1024, refs: [['r-ref-hero', 'HIGH'], ['r-ref', 'LOW']], cut: true,
    prompt: `${STYLE} Full-body character art of exactly the same girl as in the first reference image, same face, same hairstyle, same outfit, same painterly anime rendering: ${HERO}. The same low lunge stance facing right as in the reference, front knee bent, the sword thrust forward and down toward the right, the cape sweeping behind her. ${ISOLATED}`,
  },
  {
    name: 'r-hero-run', w: 1024, h: 1024, refs: [['r-hero-stance', 'MID'], ['r-ref-hero', 'LOW']], cut: true,
    prompt: `${STYLE} The same girl as in the first reference image, same face, same hairstyle, same outfit, same sword, same painterly anime rendering: ${HERO}. Full body sprinting to the right at full speed in side view: upper body leaning forward, front leg reaching forward, back leg kicked up behind her off the ground, her free arm swinging forward, the sword held low and pointing backward in her trailing hand, the cape and hood streaming behind her in the wind. A clear running stride, not a fighting stance. ${ISOLATED}`,
  },
  {
    name: 'r-hero-slash', w: 1024, h: 1024, refs: [['r-hero-stance', 'HIGH'], ['r-ref-hero', 'MID']], cut: true,
    prompt: `${STYLE} The same girl as in the first reference image, same face, same hairstyle, same outfit, same sword, same painterly anime rendering: ${HERO}. Full body lunging forward to the right in the middle of a powerful horizontal sword slash, the sword arm fully extended to the right, front knee bent, the cape whipping behind her. ${ISOLATED} No motion blur.`,
  },
  {
    name: 'r-wolf', w: 1024, h: 1024, refs: [['r-ref', 'MID']], cut: true,
    prompt: `${STYLE} Full-body art of the giant Big Bad Wolf from the reference image: a huge menacing black wolf with thick shaggy dark fur, glowing amber-yellow eyes, snarling open jaws with sharp white fangs, a torn leather strap and a ragged cloth over one shoulder, big clawed paws. He crouches low on all four legs in side view facing left, head lowered and pushed forward, ready to pounce. ${ISOLATED}`,
  },
  {
    name: 'r-scene', w: 1376, h: 768, refs: [['r-ref', 'MID']],
    prompt: `${STYLE} Wide background plate for the top area of a vertical mobile slot game, matching the scenery of the reference image: a dark enchanted forest clearing at night, a glowing full moon in a deep-blue sky between tall dark pine trees, on the left a cozy village of old wooden cottages with warm glowing windows and hanging lanterns, a winding dirt path, drifting blue mist and tiny floating embers. Big dark tree trunks frame the far left and far right edges; the foreground is a dark earthy forest floor with rocks, roots and fallen leaves. No characters, no animals, no people, no text, no UI.`,
  },
  {
    name: 'r-far', w: 1376, h: 768, refs: [['r-scene', 'HIGH']],
    prompt: `${STYLE} The far background layer of the reference scene only, for a parallax game: the same night sky, the same full moon, the same distant pine forest, the same village with warm glowing windows and lanterns, the same mist. Remove the big tree trunks on the far left and far right and all foreground rocks, roots and leaves; the clearing and the dirt path continue down to the bottom edge. Same lighting and colors. No characters.`,
  },
  {
    name: 'r-near', w: 1376, h: 768, refs: [['r-scene', 'MID']],
    prompt: `Foreground layer for a side-scrolling parallax game, in the same painterly style, colors and lighting as the reference image. Only three things are painted: one huge dark gnarled tree trunk with a few branches at the far left edge, one huge dark gnarled tree trunk at the far right edge, and a strip of dark forest floor along the bottom fifth of the image with rocks, roots, ferns, fallen leaves and a few glowing embers. Everything else, the whole center and upper area, is flat solid pure magenta (#FF00FF). No village, no houses, no lanterns, no distant trees, no moon, no sky, no mist. No gradients or glow on the magenta. No text.`,
  },
  // 轉輪：方形符號磚（深色石板底、四角小綠葉，特殊符號帶框）、刻字牌面、細木框
  {
    name: 'r-symbols', w: 1376, h: 768, refs: [['r-ref', 'MID'], ['r-hero-stance', 'MID']],
    prompt: `${STYLE} A sprite sheet of eight separate square slot-game symbol tiles in the tile style of the first reference image, arranged in a neat grid of exactly 4 columns and 2 rows on a plain flat solid white background, with wide white gaps between the tiles. Every tile is a perfect square with sharp straight edges, completely filled edge to edge; plain tiles are dark charcoal slate stone with a thin dark border and tiny green leaves at the corners; tiles never touch or overlap. Row 1, left to right: 1) the head of a huge black wolf with glowing amber eyes and bared fangs in three-quarter view facing left, deep-blue misty background, framed by an ornate deep-blue and silver border; 2) a black raven with a glowing red eye perched on a thorny branch under the moon, slate tile; 3) an old black iron lantern with a warm glowing candle flame, slate tile; 4) a heart-shaped glass potion bottle filled with glowing crimson liquid and a cork stopper, slate tile. Row 2: 5) a wicker basket full of shiny red apples, slate tile; 6) an ornate antique golden key lying diagonally on a deep crimson background, framed by a thin gold border; 7) a portrait of the girl from the second reference image (same face, crimson hood, short brown bob, painterly anime rendering) on a deep red background, framed by an ornate glowing gold border, her face in the upper three quarters of the tile, the bottom quarter plain dark red; 8) an empty dark slate tile with nothing on it.`,
  },
  {
    name: 'r-royals', w: 1376, h: 768, refs: [['r-ref', 'MID'], ['r-symbols', 'LOW']],
    prompt: `${STYLE} Five separate square slot-game symbol tiles exactly in the style of the letter tiles in the first reference image, in a single evenly spaced horizontal row on a plain flat solid white background, with wide white gaps; tiles never touch. Each tile is a perfect square filled edge to edge with dark charcoal slate stone, a thin dark border and tiny green leaves at the corners. On each tile one big bold glossy 3D serif character with beveled edges and soft highlights, filling most of the tile, left to right: "10" in sapphire blue, "J" in emerald green, "Q" in amethyst purple, "K" in golden orange, "A" in ruby red. No other text.`,
  },
  {
    name: 'r-frame', w: 1152, h: 928, refs: [['r-ref', 'LOW']],
    prompt: `${STYLE} A front-facing rectangular slot machine reel frame matching the reel frame in the reference image, on a plain flat solid white background, filling almost the whole image. The border is thin, about one thirtieth of the image width: dark polished wood with a fine antique gold inner trim line, with ornate antique gold filigree ornaments only at the four corners. The large rectangular opening inside is flat solid pure black and completely empty: no symbols, no grid, no reels. Perfectly symmetric, straight-on view, no perspective, no text.`,
  },
  // 做舊外框的兩個方向（2026-10，原本的拋光紅木細金框太精緻）：A 粗木板＋黑鐵包角鉚釘，B 風化木頭＋磨損的古金雕花
  {
    name: 'r-frame-aged-a', w: 1152, h: 928, refs: [['r-frame', 'LOW'], ['r-ref', 'LOW']],
    prompt: `${STYLE} A front-facing rectangular slot machine reel frame on a plain flat solid white background, filling almost the whole image, the same layout as the first reference image but heavily weathered and old. The border is about one twentieth of the image width: thick rough dark old timber planks with deep cracks, knots, splinters, scratches and worn chipped edges, darkened by age and soot, a little green moss in the cracks; heavy blackened wrought-iron corner brackets with big round rivets and nails at the four corners, and a few iron straps along the sides. No polish, no fine filigree. The large rectangular opening inside is flat solid pure black and completely empty: no symbols, no grid, no reels. Perfectly symmetric, straight-on view, no perspective, no text.`,
  },
  {
    name: 'r-frame-aged-b', w: 1152, h: 928, refs: [['r-frame', 'LOW'], ['r-ref', 'LOW']],
    prompt: `${STYLE} A front-facing rectangular slot machine reel frame on a plain flat solid white background, filling almost the whole image, the same layout as the first reference image but antique and weathered like a centuries-old storybook relic. The border is about one twentieth of the image width: old weathered dark brown wood with visible grain, cracks, dents and worn rounded edges, the dark varnish rubbed off in places; at the four corners bold chunky carved antique gold corner ornaments that are tarnished, chipped and darkened with grime, with a worn thin gold inner trim line. Rustic, heavy and aged, not delicate. The large rectangular opening inside is flat solid pure black and completely empty: no symbols, no grid, no reels. Perfectly symmetric, straight-on view, no perspective, no text.`,
  },
  // 使用者選 A 方向但要更破、更舊、框更細：再畫兩張（C 照 A 的樣子做得更破，D 參考原本細框的比例）
  {
    name: 'r-frame-aged-c', w: 1152, h: 928, refs: [['r-frame-aged-a', 'MID']],
    prompt: `${STYLE} A front-facing rectangular slot machine reel frame on a plain flat solid white background, filling almost the whole image, in the same style as the reference image but much older, more broken and more decayed, with a much thinner border, only about one fortieth of the image width. Thin old rotten wooden planks, splintered and cracked, broken chipped edges with chunks missing, worm holes, peeling dark paint, scorch marks, dirt and soot; small rusty bent iron corner plates with crooked nails and missing rivets, flaking rust, a little moss and a few cobwebs in the corners. The large rectangular opening inside is flat solid pure black and completely empty: no symbols, no grid, no reels. Perfectly symmetric, straight-on view, no perspective, no text.`,
  },
  {
    name: 'r-frame-aged-d', w: 1152, h: 928, refs: [['r-frame', 'MID'], ['r-frame-aged-a', 'LOW']],
    prompt: `${STYLE} A front-facing rectangular slot machine reel frame on a plain flat solid white background, filling almost the whole image, with exactly the same thin border width and layout as the first reference image, but made of ancient weathered timber like the second reference image and heavily damaged: rough splintered grey-brown planks with deep cracks, knots, worm holes, broken chipped edges and missing chunks, scorch marks and grime; at the four corners small rusty broken iron brackets with crooked nails, flaking rust stains running down the wood, a little moss. No polish, no gold, no filigree. The large rectangular opening inside is flat solid pure black and completely empty: no symbols, no grid, no reels. Perfectly symmetric, straight-on view, no perspective, no text.`,
  },
  // 介面零件與圖示（灰底，程式挖空）、標題字、底部背景
  {
    name: 'r-ui', w: 1024, h: 1024, refs: [['r-ref', 'MID']],
    prompt: `${STYLE} A game UI asset sheet matching the buttons and panels of the reference image, on a plain flat solid light-grey background; every element is isolated with wide empty grey space around it, nothing touches or overlaps, front view, no text. Exactly four elements: 1) top left, large: a round spin button like the reference, a glossy deep crimson-red disc inside a thick ornate antique gold ring, the red center is completely empty with no arrows and no symbol; 2) top right, small: a round button frame, a thin polished antique gold ring around a flat empty dark navy center; 3) middle, wide: a horizontal button plaque like the Feature Buy button in the reference, a glossy crimson-red rounded plaque with an ornate antique gold border and gold scroll flourishes on both ends, empty inside; 4) bottom, wide: an info panel frame like the balance panel in the reference, a wide dark navy-charcoal rectangle with a thin gold border and small ornate gold filigree corners, empty inside.`,
  },
  {
    name: 'r-icons', w: 1024, h: 1024, refs: [['r-ref', 'MID']],
    prompt: `${STYLE} Four separate game icons in the style of the icons in the reference image, arranged in a 2 by 2 grid on a plain flat solid light-grey background with wide empty grey space between them, nothing touches, front view, no shadows on the background: top left, a brown leather wallet with a gold clasp; top right, a neat stack of shiny gold coins; bottom left, a golden "WIN" badge with ornate gold edges and the word WIN in bold red letters; bottom right, a single shiny gold coin with an embossed star.`,
  },
  {
    name: 'r-logo', w: 1376, h: 768, refs: [['r-ref', 'HIGH']], cut: true,
    prompt: `${STYLE} The "Red Riding Hood" game title logo from the top left of the reference image, isolated and centered, large: the words "Red", "Riding" and "Hood" stacked on three lines in an elegant silver-white decorative serif with crimson red accents and a thin red ribbon swirl, exactly like the reference. On a plain flat solid light-grey background, nothing else.`,
  },
  // BIG WIN 演出的三級標題字（跟 r-logo 同一種字風，去背）
  {
    name: 'r-title-big', w: 1376, h: 768, refs: [['r-logo', 'MID'], ['r-ref', 'LOW']], cut: true,
    prompt: `${STYLE} Slot game win title artwork: the words "BIG WIN" on one line in huge bold 3D letters of polished antique gold with beveled edges and bright highlights, a thick dark crimson outline, a crimson ribbon swirling behind the letters and a few tiny sparkles, in the lettering style of the "Red Riding Hood" logo in the first reference image. Centered, filling most of the width, on a plain flat solid light-grey background, nothing else, exactly the words BIG WIN and no other text.`,
  },
  {
    name: 'r-title-mega', w: 1376, h: 768, refs: [['r-title-big', 'HIGH']], cut: true,
    prompt: `${STYLE} The same win title style as the reference image, same gold 3D lettering, same crimson outline and ribbon, but the words "MEGA WIN" on one line, richer: glowing ruby gems set into the gold letters and a small ornate golden crown above the middle of the word. Centered, on a plain flat solid light-grey background, nothing else, exactly the words MEGA WIN and no other text.`,
  },
  {
    name: 'r-title-super', w: 1376, h: 768, refs: [['r-title-mega', 'HIGH']], cut: true,
    prompt: `${STYLE} The same win title style as the reference image, same gold 3D lettering with ruby gems, crimson outline, ribbon and golden crown, but two lines: the word "SUPER" smaller on top and "MEGA WIN" large below, the most luxurious version with golden laurel wings spreading from both sides and extra sparkles. Centered, on a plain flat solid light-grey background, nothing else, exactly the words SUPER MEGA WIN and no other text.`,
  },
  {
    name: 'r-floor', w: 768, h: 1376, refs: [['r-scene', 'LOW']],
    prompt: `${STYLE} A vertical background texture for the bottom half of a mobile slot game screen: a dark forest floor seen from the front, old dark weathered wooden boards across the middle, mossy dark ground, ferns, roots and fallen crimson leaves along the bottom edge, faint cold blue moonlight from above, deep vignette, dark and low-contrast overall. Absolutely no frames, no panels, no boxes, no rectangles, no borders, no UI, no text, no characters.`,
  },
];

const byName = Object.fromEntries(JOBS.map(j => [j.name, j]));
const todo = JOBS.filter(j => (!index[j.name] || (j.cut && !index[j.name].cut)) && (!only.length || only.includes(j.name)));
console.log('to generate:', todo.map(j => j.name).join(', ') || '(nothing)');

const balance = async () => (await api('GET', '/v1/me')).j?.user_details?.[0]?.apiPaidTokens;
const start = await balance();

async function cut(name) {
  const body = { model: 'remove-bg', public: false, parameters: { format: 'png', guidances: { image_reference: [{ image: { id: index[name].imageId, type: 'GENERATED' } }] } } };
  const r = await fetch('https://cloud.leonardo.ai/api/rest/v2/generationssync', { method: 'POST', headers: H, body: JSON.stringify(body) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  const sync = j?.generateSync || j;
  const res = sync?.results?.[0];
  // 失敗不重試，避免重複扣款
  if (!res) { console.log(name, 'cut failed', r.status, t.slice(0, 300)); return; }
  const buf = res.dataB64 ? Buffer.from(res.dataB64, 'base64') : Buffer.from(await (await fetch(res.url)).arrayBuffer());
  writeFileSync(`${outDir}/${name}-cut.png`, buf);
  index[name].cut = `${name}-cut.png`;
  save();
  console.log('cut', name, buf.length, 'bytes');
}

// 本機圖片上傳成參考圖（init image）：先拿預先簽好的網址，再把檔案用表單送上去
async function upload(job) {
  const file = `${outDir}/${job.upload}`;
  const ext = job.upload.split('.').pop();
  const r = await api('POST', '/v1/init-image', { extension: ext });
  const u = r.j?.uploadInitImage;
  if (!u) { console.log(job.name, 'upload init failed', r.status, r.t.slice(0, 300)); return false; }
  const form = new FormData();
  for (const [k, v] of Object.entries(JSON.parse(u.fields))) form.append(k, v);
  form.append('file', new Blob([readFileSync(file)]), job.upload);
  const put = await fetch(u.url, { method: 'POST', body: form });
  if (!put.ok) { console.log(job.name, 'upload failed', put.status); return false; }
  index[job.name] = { imageId: u.id, type: 'UPLOADED', file: job.upload };
  save();
  console.log('uploaded', job.name);
  return true;
}

const run = async job => {
  if (job.upload) return upload(job);
  if (index[job.name]) { await cut(job.name); return !!index[job.name].cut; }
  const refs = job.refs.map(([n, s]) => ({ image: { id: index[n].imageId, type: index[n].type || 'GENERATED' }, strength: s }));
  const body = {
    model: 'gemini-image-2',
    public: false,
    parameters: { width: job.w, height: job.h, quantity: 1, prompt_enhance: 'OFF', prompt: job.prompt, ...(refs.length ? { guidances: { image_reference: refs } } : {}) },
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const sub = await api('POST', '/v2/generations', body);
    const genId = sub.j?.generate?.generationId || sub.j?.generationId;
    if (!genId) { console.log(job.name, 'submit failed', sub.status, sub.t.slice(0, 300)); await sleep(3000); continue; }
    for (let i = 0; i < 100; i++) {
      await sleep(4000);
      const g = (await api('GET', `/v1/generations/${genId}`)).j?.generations_by_pk;
      if (g?.status === 'FAILED') { console.log(job.name, 'FAILED'); break; }
      if (g?.status === 'COMPLETE') {
        const im = g.generated_images?.[0];
        if (!im) { console.log(job.name, 'complete but no image (moderation?)'); break; }
        const buf = Buffer.from(await (await fetch(im.url)).arrayBuffer());
        const ext = (im.url.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
        writeFileSync(`${outDir}/${job.name}.${ext}`, buf);
        index[job.name] = { imageId: im.id, file: `${job.name}.${ext}`, generationId: genId };
        save();
        console.log('done', job.name, buf.length, 'bytes');
        if (job.cut) await cut(job.name);
        return true;
      }
    }
  }
  return false;
};

// 相依：refs 裡的圖都好了才跑；最多同時 4 張
const pending = new Set(todo.map(j => j.name));
const running = new Set();
const failed = new Set();
await new Promise(resolve => {
  const pump = () => {
    if (!pending.size && !running.size) return resolve();
    for (const name of [...pending]) {
      if (running.size >= 4) break;
      const job = byName[name];
      const deps = (job.refs || []).map(r => r[0]);
      if (deps.some(d => failed.has(d))) { pending.delete(name); failed.add(name); console.log('skip', name, '(dependency failed)'); continue; }
      if (deps.every(d => index[d])) {
        pending.delete(name);
        running.add(name);
        run(job).then(ok => { running.delete(name); if (!ok) failed.add(name); pump(); });
      }
    }
    if (!running.size && pending.size) { console.log('stuck:', [...pending].join(',')); resolve(); }
  };
  pump();
});
const end = await balance();
console.log('balance', start, '->', end, 'spent', start - end, 'failed:', [...failed].join(',') || 'none');
