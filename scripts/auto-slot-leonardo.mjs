// 自走SLOT：用 Leonardo 生成暗黑童話風的小紅帽美術（Nano Banana Pro），需要去背的再走 remove-bg
// node scripts/auto-slot-leonardo.mjs [只跑這些名稱...]（原檔存到 assets-src/auto-slot/）
// 已經生成過的（index.json 裡有）會跳過；key 從環境變數 LEONARDO_API_KEY 讀，不會印出來
// 生成完再跑 python scripts/auto-slot-gothic.py 與 node scripts/auto-slot-assets.mjs 轉成遊戲與網頁用的檔案
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

const GOTHIC = 'Dark gothic fairy-tale mobile slot game art, Little Red Riding Hood theme, moonlit night forest mood, highly detailed semi-realistic digital painting, dramatic rim lighting, deep shadows, rich crimson red, antique gold and cold moonlight blue accents, premium AAA slot game quality, no letters or words unless asked, no watermark.';

// refs = [名稱, 強度]；cut = 生成後去背
const JOBS = [
  // 暗黑哥德風介面（2026-10 換版）：方形滿版符號磚、刻字牌面、按鈕與裝飾零件、轉輪外框、森林地面背景
  {
    name: 'g-symbols', w: 1376, h: 768, refs: [],
    prompt: `${GOTHIC} A sprite sheet of eight separate square slot-game symbol tiles arranged in a neat grid of exactly 4 columns and 2 rows on a plain flat solid white background, with wide white gaps between the tiles. Every tile is a perfect square with sharp straight edges, completely filled edge to edge with its own painted dark background and a thin dark iron border; tiles never touch or overlap. Row 1, left to right: 1) the head of a huge black wolf with glowing red eyes and bared fangs facing the viewer, dark misty blue forest background; 2) a black raven with a red eye perched on a thorny branch, cold blue moonlit background; 3) an old black iron lantern with a warm glowing candle flame, dark background lit by its warm glow; 4) a heart-shaped glass potion bottle filled with glowing crimson liquid and a cork stopper, dark background. Row 2: 5) a wicker basket covered with a red cloth, dark background; 6) an ornate antique golden key with a filigree bow, lying diagonally on a deep crimson background with scattered rose petals, the key in the upper three quarters of the tile; 7) a portrait of a beautiful young girl wearing a crimson red hood, wavy brown hair, determined amber eyes, anime-inspired semi-realistic style, deep red background, her face in the upper three quarters of the tile; 8) an empty dark cracked black stone tile with a subtle carved border and nothing on it.`,
  },
  {
    name: 'g-royals', w: 1376, h: 768, refs: [['g-symbols', 'MID']],
    prompt: `${GOTHIC} Match the tile style of the reference image. Five separate square slot-game symbol tiles in a single evenly spaced horizontal row on a plain flat solid white background, with wide white gaps; tiles never touch. Each tile is a perfect square filled edge to edge with dark cracked black stone and a thin dark iron border. On each tile one big engraved metallic serif character in a classic Roman inscription typeface with sharp bevels, fine scratches and a subtle inner glow, filling most of the tile, left to right: "10" in polished sapphire-blue metal, "J" in emerald-green metal, "Q" in amethyst-purple metal, "K" in antique gold-bronze metal, "A" in crimson-red metal. No other text.`,
  },
  {
    name: 'g-ui', w: 1024, h: 1024, refs: [['g-symbols', 'LOW']],
    prompt: `${GOTHIC} A game UI asset sheet on a plain flat solid light-grey background; every element is isolated with wide empty grey space around it, nothing touches or overlaps, front view, no text. Exactly five elements: 1) top left, large: a circular spin-button frame, an ornate antique gold ring with engraved filigree, a few thin thorny black vines with tiny crimson leaves wrapped around the ring, the center is a flat empty very dark disc with nothing inside; 2) top right, small: a round button frame, a dark bronze ring with a thin gold edge and a flat empty dark center; 3) middle, wide: a symmetric horizontal antique gold filigree crest ornament with scrolls and a small red gem in the middle, like the decoration on top of a frame; 4) bottom left, small: a shiny gold coin with an embossed dollar sign; 5) bottom right, wide: a horizontal name-plate frame, a dark charcoal panel with ornate antique gold corners and a thin gold border, empty inside.`,
  },
  // 照設計稿：細框、符號磚幾乎填滿；藤蔓只在四個角
  {
    name: 'g-frame2', w: 1152, h: 928, refs: [['g-symbols', 'LOW']],
    prompt: `${GOTHIC} A front-facing elegant rectangular slot machine reel frame on a plain flat solid white background, filling almost the whole image. The border is very thin, only about one fortieth of the image width: dark carved wood with a fine antique gold inner trim line and a thin dark outer edge. A small pointed antique gold filigree crest with a red gem sits at the top center, rising slightly above the border, and a much smaller matching gold ornament at the bottom center. Thin thorny black vines with small crimson leaves creep only around the four corners, curling just outside the border. The large rectangular opening inside is flat solid pure black and completely empty: no symbols, no grid, no reels. Perfectly symmetric, straight-on view, no perspective, no text.`,
  },
  // 自走區照設計稿：月夜森林（遠景固定、近景捲動）、拿劍的小紅帽（跑、架式、揮砍）、狼人
  {
    name: 'n-scene', w: 1376, h: 768, refs: [['g-floor', 'LOW']],
    prompt: `${GOTHIC} Wide background plate for the top area of a vertical mobile slot game: a dark enchanted forest at night. A large glowing full moon in a deep blue night sky between tall dark pine trees; far away at the center a small cottage with warm glowing windows at the end of a misty winding forest path that recedes into the distance; drifting blue mist; huge gnarled dark tree trunks frame the left and right sides, an old black iron lantern with a warm candle flame hangs from a branch of the left tree; the foreground is a dark mossy forest floor with roots, ferns, small red-capped mushrooms and scattered crimson leaves. Cold blue moonlight with warm lantern accents. No characters, no animals, no people.`,
  },
  {
    name: 'n-far', w: 1376, h: 768, refs: [['n-scene', 'HIGH']],
    prompt: `${GOTHIC} The far background layer of the reference scene only, for a parallax game: the same night sky, the same full moon, the same distant dark pine forest, the same small cottage with warm glowing windows and the same misty path receding toward it, the same blue mist. Remove the big tree trunks on the left and right, the hanging lantern and all foreground roots, ferns, mushrooms and leaves; the misty forest floor and path continue down to the bottom edge. Same lighting and colors. No characters.`,
  },
  {
    name: 'n-near', w: 1376, h: 768, refs: [['n-scene', 'HIGH']],
    prompt: `Exactly the same image as the reference, same composition, same painterly dark gothic style and lighting. Keep the big gnarled tree trunks on the left and right with their branches, the hanging iron lantern, and the whole dark foreground forest floor with roots, moss, ferns, red mushrooms and crimson leaves exactly as they are. Replace everything that is far away with a flat solid pure magenta color (#FF00FF): the sky, the moon, the distant pine forest, the cottage, the misty path in the distance and the mist all become flat uniform magenta. No gradients or glow on the magenta. No text.`,
  },
  {
    name: 'n-hero-run', w: 1024, h: 1024, refs: [], cut: true,
    prompt: `${GOTHIC} Full-body character art of a beautiful young woman as Little Red Riding Hood, anime-inspired semi-realistic dark fantasy style: a long crimson red hooded cape, wavy brown hair, amber eyes, white frilled blouse, black leather corset, dark red tattered skirt over a white petticoat, black knee-high laced leather boots, a small leather belt pouch, holding a slender silver sword with a gold hilt. She is running to the right in side view, dynamic stride, sword held low behind her, the cape flying behind her. Isolated on a plain flat light-grey background, the entire figure visible with empty space around it, no ground, no cast shadow, no other objects.`,
  },
  {
    name: 'n-hero-stance', w: 1024, h: 1024, refs: [['n-hero-run', 'HIGH']], cut: true,
    prompt: `${GOTHIC} The same young woman from the reference image, same face, same red hooded cape, same outfit, same silver sword, same art style. Full body in a low combat stance facing right, legs wide apart, knees bent, the sword held low and angled back, her free hand forward, the cape sweeping behind her, fierce focused expression. Isolated on a plain flat light-grey background, the entire figure visible with empty space around it, no ground, no cast shadow, no other objects.`,
  },
  {
    name: 'n-hero-slash', w: 1024, h: 1024, refs: [['n-hero-run', 'HIGH']], cut: true,
    prompt: `${GOTHIC} The same young woman from the reference image, same face, same red hooded cape, same outfit, same silver sword, same art style. Full body lunging forward to the right in the middle of a powerful horizontal sword slash, the sword arm fully extended to the right, front knee bent, the cape whipping behind her. Isolated on a plain flat light-grey background, the entire figure visible with empty space around it, no ground, no cast shadow, no motion blur, no other objects.`,
  },
  {
    name: 'n-wolf', w: 1024, h: 1024, refs: [], cut: true,
    prompt: `${GOTHIC} Full-body art of the Big Bad Wolf as a huge menacing werewolf, dark fantasy semi-realistic style: shaggy black and dark grey fur, glowing red eyes, snarling mouth with sharp fangs, long black claws, broken iron chains and a gold ring hanging from his neck and arms, a torn dark cloth around the waist. He stands hunched forward on his hind legs in side view facing left, clawed hands raised and ready to strike. Isolated on a plain flat light-grey background, the entire figure visible with empty space around it, no ground, no cast shadow, no other objects.`,
  },
  {
    name: 'g-floor', w: 768, h: 1376, refs: [['g-symbols', 'LOW']],
    prompt: `${GOTHIC} A dark moonlit forest floor background for the lower part of a vertical mobile slot game screen: gnarled black tree roots, moss, ferns, small red-capped mushrooms, scattered crimson autumn leaves and damp dark soil, faint cold blue moonlight, deep vignette, dark and low-contrast overall so game panels can sit on top. Nothing in the center that draws attention. No characters, no text.`,
  },
];

const byName = Object.fromEntries(JOBS.map(j => [j.name, j]));
const todo = JOBS.filter(j => !index[j.name] && (!only.length || only.includes(j.name)));
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

const run = async job => {
  const refs = job.refs.map(([n, s]) => ({ image: { id: index[n].imageId, type: 'GENERATED' }, strength: s }));
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
      const deps = job.refs.map(r => r[0]);
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
