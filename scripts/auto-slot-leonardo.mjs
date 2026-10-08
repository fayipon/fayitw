// 自走SLOT：用 Leonardo 生成小紅帽主題的美術（Nano Banana Pro），需要去背的再走 remove-bg
// node scripts/auto-slot-leonardo.mjs [只跑這些名稱...]（原檔存到 assets-src/auto-slot/）
// 已經生成過的（index.json 裡有）會跳過；key 從環境變數 LEONARDO_API_KEY 讀，不會印出來
// 生成完再跑 node scripts/auto-slot-assets.mjs 轉成網頁用的檔案
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

const STYLE = 'Premium mobile slot game art, storybook fairy-tale 3D illustration, soft painterly rendering, warm cinematic lighting, rich detail, cute chibi proportions, Little Red Riding Hood theme, no text, no letters, no watermark.';
const ISOLATED = 'Isolated on a plain flat light-grey background, the entire figure visible with empty space around it, no ground, no cast shadow, no other objects.';
const HERO = 'Little Red Riding Hood: a cute chibi little girl with big blue eyes, rosy cheeks, wavy golden-blonde hair, a red hooded cape tied with a bow, white blouse, cream apron dress, brown lace-up boots, carrying a wicker basket on her arm';

// Candy Crush 那種關節紙板人偶：一片片印刷紙板、白色切邊、關節用黃銅雙腳釘固定
const PUPPET = 'Candy Crush Saga character style: an articulated jointed paper puppet made of flat printed cardboard pieces with visible white cut edges and a slight cardboard thickness, joined by round shiny brass split-pin fasteners, glossy candy-bright colors, cute cartoon proportions, clean illustration with soft shading. No text, no labels, no watermark.';
const RIG = 'A character rig sheet for 2D cutout animation on a plain flat solid light-grey background. Left third: the puppet fully assembled. Right two thirds: exactly the same puppet taken apart into its separate flat cardboard pieces, laid out in a tidy row with generous empty space between them so that no pieces touch or overlap; every piece is drawn complete (the parts hidden behind other parts are fully drawn) and shows one round brass split-pin fastener where it attaches to the torso.';

// refs = [名稱, 強度]；cut = 生成後去背
const JOBS = [
  {
    name: 'hero-rig', w: 1376, h: 768, refs: [],
    prompt: `${PUPPET} ${RIG} The puppet is ${HERO.replace('carrying a wicker basket on her arm', 'holding a small wicker basket in her front hand')}, standing in side view facing right with a cheerful smile. Separate pieces: 1) head with the red hood and golden hair, 2) torso with the red cape, white blouse and cream apron dress, 3) front arm with the hand holding the basket, 4) back arm with an open hand, 5) front leg with a brown boot, 6) back leg with a brown boot. Brass fasteners at the neck, both shoulders and both hips.`,
  },
  {
    name: 'wolf-rig', w: 1376, h: 768, refs: [['hero-rig', 'LOW']],
    prompt: `${PUPPET} ${RIG} Match the paper-puppet style of the reference image. The puppet is the Big Bad Wolf as a storybook game enemy: a big shaggy dark-grey wolf standing upright on his hind legs, side view facing left, amber eyes, a toothy cheeky grin, a torn dark-red scarf; menacing but suitable for all ages. Separate pieces: 1) head with ears and snout, 2) torso with the scarf, 3) front arm with claws, 4) back arm with claws, 5) front hind leg with paw, 6) back hind leg with paw, 7) bushy tail. Brass fasteners at the neck, both shoulders, both hips and the tail.`,
  },
  {
    name: 'symbols', w: 1024, h: 1024, refs: [], cut: true,
    prompt: `${STYLE} A sprite sheet of twelve separate slot-game symbol icons arranged in a neat grid of exactly 4 columns and 3 rows on a plain flat solid light-grey background. Every icon is centered in its own equal square cell with generous empty space between icons; icons never touch or overlap; no frames, no tiles, no borders, no labels. Row 1, left to right: a red hooded cape with a bow; a lattice cherry pie in a tin; a cute fluffy grey-and-white bunny sitting; a glowing brass lantern with a candle inside. Row 2: a white wildflower with green leaves; a snarling grey wolf head facing the viewer; two red-capped white-spotted mushrooms; a wicker basket with bread under a checkered cloth. Row 3: a tiny cozy forest cottage with glowing windows; a golden jeweled crown with red gems; a shiny red apple with a leaf; a thick gold coin with an embossed star.`,
  },
  {
    name: 'royals', w: 1376, h: 768, refs: [['symbols', 'HIGH']],
    prompt: `Slot-game card royal symbols in exactly the same storybook 3D icon style, lighting and level of detail as the reference image. Five separate symbols in a single evenly spaced row on a plain flat solid light-grey background, left to right: the number "10", the letter "J", the letter "Q", the letter "K", the letter "A". Each is a big chunky glossy 3D character with a thick bevel and a thin gold rim, decorated with a small fairy-tale forest touch: "10" sapphire blue with a tiny white flower, "J" emerald green with two small leaves, "Q" violet purple with a tiny red mushroom, "K" ruby red with a sprig of berries, "A" polished gold with a red ribbon bow. Generous empty space between symbols, they never touch; no tiles, no frames, no cards, no background shapes, no other text.`,
  },
  {
    name: 'hero-run', w: 1024, h: 1024, refs: [], cut: true,
    prompt: `${STYLE} Full-body character art of ${HERO}, running energetically to the right in side view with her face turned three-quarters toward the viewer and smiling, her left leg stretched forward and right leg pushing off behind, the cape flying behind her. ${ISOLATED}`,
  },
  {
    name: 'hero-run2', w: 1024, h: 1024, refs: [['hero-run', 'HIGH']], cut: true,
    prompt: `${STYLE} The same girl from the reference image, same face, same outfit, same basket, same size and same camera angle, still running to the right, now at the next step of the run cycle: both feet tucked under her body mid-stride, cape lifted, body slightly higher. ${ISOLATED}`,
  },
  {
    name: 'wolf', w: 1024, h: 1024, refs: [], cut: true,
    prompt: `${STYLE} Full-body character art of the Big Bad Wolf as a storybook game enemy: a large shaggy dark-grey wolf standing upright on his hind legs, side view facing to the left, hunched forward with clawed paws raised, glowing amber eyes, a toothy menacing grin, a torn dark-red scarf. Menacing but suitable for all ages. ${ISOLATED}`,
  },
  {
    name: 'bg', w: 1376, h: 768, refs: [],
    prompt: `${STYLE} Wide side-scrolling game background, side view: a winding dirt and cobblestone forest path runs horizontally across the lower third of the image from the left edge to the right edge. An enchanted misty forest with tall mossy trees, ferns, red spotted mushrooms, small wildflowers and a low wooden fence along the path; in the far distance on a hill a fairy-tale castle town with warm glowing windows; soft morning sun rays through the trees. The lower third must be the open path where characters will walk. No characters, no animals, no people.`,
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
