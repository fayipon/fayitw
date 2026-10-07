// Claude Pop 真人版：一次排好所有 MV 劇照，照相依順序生成（最多同時 4 張）
// node scripts/claude-pop-leonardo.mjs [只跑這些名稱...]（原檔存到 assets-src/claude-pop/）
// 已經生成過的（index.json 裡有）會跳過；key 從環境變數 LEONARDO_API_KEY 讀，不會印出來
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const key = process.env.LEONARDO_API_KEY;
if (!key) { console.log('no key'); process.exit(1); }
const outDir = 'assets-src/claude-pop';
const only = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const indexPath = `${outDir}/index.json`;
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};
index['idol-test'] = index['idol-test'] || { imageId: 'b1ef4cb4-4da4-44df-9e3d-737e4e0a328e', file: 'idol-test.jpg' };
index['title-a'] = index['title-a'] || { imageId: '669bec67-1b03-4b57-81ae-b29f08859184', file: 'title-a.jpg' };
const save = () => writeFileSync(indexPath, JSON.stringify(index, null, 2));

const H = { authorization: `Bearer ${key}`, accept: 'application/json', 'content-type': 'application/json' };
const api = async (method, path, body) => {
  const r = await fetch('https://cloud.leonardo.ai/api/rest' + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, t };
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CHAR = 'the same young woman from the reference image (same face, same glossy black chin-length bob with blunt straight bangs, orange eight-pointed star hair clip, white poplin blouse with puff sleeves and a black bow at the collar, black harness straps, black pleated mini skirt, black patent knee-high boots, white ID badge on an orange lanyard)';
const MV = 'Cinematic still frame from a K-pop music video, anamorphic lens, rich color grading, subtle film grain, photorealistic, no text, no watermark.';
const BLUE = 'the dancer from the blue reference (same face, long dark-brown hair in a high ponytail, cobalt-blue puff-sleeve blouse, white pleated mini skirt, white knee-high boots)';
const PINK = 'the dancer from the pink reference (same face, light-brown shoulder-length wavy hair with two small buns, hot-pink puff-sleeve blouse, black pleated mini skirt, black knee-high boots)';
const W = 1376, Hh = 768;

// refs: [名稱, 強度]；生成時換成那張圖的 imageId
const JOBS = [
  { name: 'dancer-blue', w: 1024, h: 1024, refs: [], prompt: 'Full-body fashion photograph of an original fictional K-pop idol backup dancer (not a real person, does not resemble any celebrity): a young East Asian woman in her early twenties with long dark-brown hair in a high ponytail, wearing a cobalt-blue blouse with voluminous puff sleeves, black harness straps, white high-waisted pleated mini skirt, white knee-high boots. Standing facing the camera, confident relaxed pose, slight smile. Clean seamless light grey studio backdrop, even soft lighting, entire figure visible head to boots with margin, 50mm lens, editorial K-pop concept photo, photorealistic.' },
  { name: 'dancer-pink', w: 1024, h: 1024, refs: [], prompt: 'Full-body fashion photograph of an original fictional K-pop idol backup dancer (not a real person, does not resemble any celebrity): a young East Asian woman in her early twenties with light-brown shoulder-length wavy hair styled with two small buns, wearing a hot-pink blouse with voluminous puff sleeves, black harness straps, black high-waisted pleated mini skirt, black knee-high boots. Standing facing the camera, playful confident pose, bright smile. Clean seamless light grey studio backdrop, even soft lighting, entire figure visible head to boots with margin, 50mm lens, editorial K-pop concept photo, photorealistic.' },

  { name: 'hook-bg', refs: [], prompt: 'Cinematic wide night shot of an elevated city freeway in light fog, long-exposure streaks of red tail lights and white headlights rushing toward the horizon, sodium street lamps, deep blue night sky, sense of extreme speed, no people. Dark moody color grading, anamorphic lens, film grain, photorealistic, no text.' },
  { name: 'title-b', refs: [['title-a', 'HIGH'], ['idol-test', 'HIGH']], prompt: `Same stage, same neon star, same lighting and camera as the first reference image. ${CHAR} now points straight up to the sky with her right arm fully raised, left hand on her hip, smiling at the camera, full body. ${MV}` },
  { name: 'wake-a', refs: [['idol-test', 'HIGH']], prompt: `${MV} A dark bedroom at night lit by cool moonlight through a window. ${CHAR}, wearing the white puff-sleeve blouse, is asleep in bed under a dark-blue duvet, eyes closed, her black bob spread on a white pillow, a smartphone lying face-up on the pillow beside her head glowing softly. Camera slightly above, her face and the window both in frame, blue nighttime color grading.` },
  { name: 'wake-b', refs: [['wake-a', 'HIGH'], ['idol-test', 'HIGH']], prompt: `Same bedroom, same camera angle and composition as the first reference image. ${CHAR} is now awake, lying in bed and holding the smartphone above her face with both hands, eyes wide open, her face lit by the cold white glow of the phone screen. ${MV}` },
  { name: 'roof-night', refs: [['idol-test', 'HIGH']], prompt: `${MV} Wide shot: ${CHAR} stands on the edge of a city rooftop at night, full body, small in the frame on the right third, wind blowing her hair, a glowing skyline of office towers with lit windows behind her, blue hour sky, empty space on the left side of the frame.` },
  { name: 'roof-dawn', refs: [['roof-night', 'HIGH'], ['idol-test', 'HIGH']], prompt: `Same rooftop, same camera, same composition and pose as the first reference image, but it is now sunrise: a big golden-orange sun rising behind the skyline, warm pink and orange sky, warm light on her face and hair, office windows dark. ${MV}` },
  { name: 'walk-cut', w: 1024, h: 1024, refs: [['idol-test', 'HIGH']], prompt: `Full-body photograph of ${CHAR} walking toward the camera mid-stride like a runway model, arms swinging naturally, confident expression. Clean seamless light grey studio backdrop, even soft lighting, entire figure visible from head to boots with margin, sharp focus, photorealistic.` },
  { name: 'face-pensive', refs: [['idol-test', 'HIGH']], prompt: `${MV} Close-up portrait, chest up, of ${CHAR} looking off to the left of the frame with a thoughtful, slightly tired expression, soft window light from the left, creamy warm background bokeh. She is placed on the right third of the frame, with soft empty space on the left.` },
  { name: 'runway-a', refs: [['idol-test', 'HIGH']], prompt: `${MV} A long futuristic corridor used as a fashion runway: rows of glowing white light panels on both walls converge to a vanishing point, wet reflective black floor, cold blue haze. ${CHAR} walks toward the camera mid-stride in the center of the corridor, full body, confident.` },
  { name: 'runway-b', refs: [['runway-a', 'HIGH'], ['idol-test', 'HIGH']], prompt: `Same corridor, same lighting and camera as the first reference image. ${CHAR} is one step closer to the camera with the other foot forward, hair swinging, still walking toward the camera. ${MV}` },
  { name: 'face-sing', refs: [['idol-test', 'HIGH']], prompt: `${MV} Extreme close-up of the face of ${CHAR} singing into a thin black headset microphone, mouth gently closed in a soft smile, eyes half closed, cobalt-blue rim light and a warm key light, the orange star hair clip visible. Her face fills the right half of the frame; the left half is soft dark-blue empty space.` },
  { name: 'face-sing-open', refs: [['face-sing', 'HIGH'], ['idol-test', 'MID']], prompt: 'Identical photo to the first reference image — same framing, same lighting, same pose, same head position — except that she is now singing a long open vowel with her mouth open wide, eyes half closed. Photorealistic, no text.' },
  { name: 'eye', refs: [['idol-test', 'LOW']], prompt: 'Extreme macro close-up of one eye of a young East Asian woman, filling the frame horizontally: dark-brown iris with fine detail, a small reflection of an orange eight-pointed star in the iris, long lashes, natural skin texture, the edge of black blunt bangs at the top of the frame. Cinematic K-pop music video still, shallow depth of field, photorealistic, no text.' },
  { name: 'eye-closed', refs: [['eye', 'HIGH']], prompt: 'Identical macro photo to the reference image — same framing, same lighting, same skin — except the eye is gently closed, lashes resting down. Photorealistic, no text.' },
  { name: 'face-feel', refs: [['idol-test', 'HIGH']], prompt: `${MV} Close-up of ${CHAR} tilting her head back slightly with her eyes closed, a blissful, overwhelmed expression, warm golden backlight with lens flare, strands of hair lifting in the wind, warm yellow and orange color grading. Her face is centered.` },
  { name: 'over-sad', refs: [['idol-test', 'HIGH']], prompt: `${MV} Wide shot of a dark empty concrete room: ${CHAR} sits alone on the floor hugging her knees under a single cold white spotlight, dust floating in the beam, cold blue color grading, she is small in the lower right of the frame, lots of dark empty space above.` },
  { name: 'back-jump', refs: [['idol-test', 'HIGH']], prompt: `${MV} ${CHAR} jumps high in the air with joy, both arms raised, knees bent, hair flying, full body, frozen mid-air, against a bright sunflower-yellow seamless studio backdrop, colorful paper confetti in the air, bright high-key lighting. She is on the right half of the frame.` },
  { name: 'outro-hill', refs: [['idol-test', 'HIGH']], prompt: `${MV} Very wide peaceful landscape at sunrise: rolling grassy hills, a huge pale golden sun low in a soft pastel sky, lots of empty sky. ${CHAR} sits small on top of a hill on the right side of the frame, seen from a distance, looking at the sun.` },
  { name: 'outro-wave', refs: [['outro-hill', 'HIGH'], ['idol-test', 'MID']], prompt: 'Identical photo to the first reference image — same landscape, same sun, same framing — except the girl sitting on the hill now turns toward the camera and waves with one raised hand. Photorealistic, no text.' },

  { name: 'stage-1', refs: [['idol-test', 'HIGH'], ['dancer-blue', 'HIGH'], ['dancer-pink', 'HIGH'], ['title-a', 'LOW']], prompt: `${MV} Wide shot of a K-pop stage performance: three girls dance in formation, full bodies — in the center ${CHAR}; on the left ${BLUE}; on the right ${PINK}. All three point up to the sky with the right arm in perfect sync. Behind them a giant glowing orange eight-pointed star neon sculpture, haze, orange and deep-navy stage lights, glossy black stage floor with reflections. Upper third of the frame is dark haze.` },
  { name: 'stage-2', refs: [['stage-1', 'HIGH'], ['idol-test', 'HIGH'], ['dancer-blue', 'MID'], ['dancer-pink', 'MID']], prompt: `Same stage, same camera, same lighting and same three girls in the same positions as the first reference image. Now all three stand with both hands on their hips, chins up, power pose, in perfect sync. ${MV}` },
  { name: 'stage-3', refs: [['stage-1', 'HIGH'], ['idol-test', 'HIGH'], ['dancer-blue', 'MID'], ['dancer-pink', 'MID']], prompt: `Same stage, same camera, same lighting and same three girls in the same positions as the first reference image. Now all three raise both arms high in a V shape, mid-jump energy, hair flying, in perfect sync. ${MV}` },
  { name: 'stage-4', refs: [['stage-1', 'HIGH'], ['idol-test', 'HIGH'], ['dancer-blue', 'MID'], ['dancer-pink', 'MID']], prompt: `Same stage, same camera, same lighting and same three girls in the same positions as the first reference image. Now all three make a big heart shape with both arms above their heads, smiling at the camera, in perfect sync. ${MV}` },
  { name: 'stage-final-1', refs: [['stage-1', 'MID'], ['idol-test', 'HIGH'], ['dancer-blue', 'MID'], ['dancer-pink', 'MID']], prompt: `${MV} The same three girls on the same stage, same positions, now lit in hot pink and electric blue with a giant glowing yellow eight-pointed star behind them, falling confetti, strobe-like light beams, all three with both arms raised in a V, full bodies, wide shot, upper third of the frame is dark haze.` },
  { name: 'stage-final-2', refs: [['stage-final-1', 'HIGH'], ['idol-test', 'HIGH'], ['dancer-blue', 'MID'], ['dancer-pink', 'MID']], prompt: 'Same stage, same pink and blue lighting, same camera and the same three girls in the same positions as the first reference image. Now all three point forward at the camera with the right arm, leaning in, in perfect sync. Cinematic K-pop music video still, photorealistic, no text.' },
  { name: 'topshot', refs: [['idol-test', 'HIGH'], ['dancer-blue', 'MID'], ['dancer-pink', 'MID']], prompt: `${MV} Straight top-down overhead shot looking down at a glossy black stage floor with a large orange eight-pointed star painted on it: three girls lie on their backs on the star with their heads touching at the center, arms stretched out, forming a symmetrical flower pattern, smiling up at the camera — ${CHAR}, ${BLUE}, and ${PINK}. Square-ish composition centered in the frame.` },
];

const byName = Object.fromEntries(JOBS.map(j => [j.name, j]));
const todo = JOBS.filter(j => !index[j.name] && (!only.length || only.includes(j.name)));
console.log('to generate:', todo.map(j => j.name).join(', ') || '(nothing)');

const balance = async () => (await api('GET', '/v1/me')).j?.user_details?.[0]?.apiPaidTokens;
const start = await balance();

const run = async job => {
  const refs = job.refs.map(([n, s]) => ({ image: { id: index[n].imageId, type: 'GENERATED' }, strength: s }));
  const body = {
    model: 'gemini-image-2',
    public: false,
    parameters: { width: job.w || W, height: job.h || Hh, quantity: 1, prompt_enhance: 'OFF', prompt: job.prompt, ...(refs.length ? { guidances: { image_reference: refs } } : {}) },
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
