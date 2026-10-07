// P(doom) MV：用 Leonardo 生成劇照（Nano Banana Pro）與影片片段（Seedance 2.0）
// node scripts/pdoom-leonardo.mjs [只跑這些名稱...]（原檔存到 assets-src/pdoom/，已經生成過的會跳過）
// key 從環境變數 LEONARDO_API_KEY 讀，不會印出來
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const key = process.env.LEONARDO_API_KEY;
if (!key) { console.log('no key'); process.exit(1); }
const outDir = 'assets-src/pdoom';
const only = process.argv.slice(2);
mkdirSync(`${outDir}/clips`, { recursive: true });
const indexPath = `${outDir}/index.json`;
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};
// 主角定裝照沿用 Claude Pop 真人版那張
const cp = JSON.parse(readFileSync('assets-src/claude-pop/index.json', 'utf8'));
index['idol'] = index['idol'] || { imageId: cp['idol-test'].imageId, file: '../claude-pop/idol-test.jpg' };
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
const KPOP = 'Still frame from a high-budget K-pop girl group music video, shot on ARRI Alexa with anamorphic lenses, elaborate art-directed set, glossy saturated color grading, flawless idol makeup, photorealistic, no text, no watermark.';
const JPOP = 'Still frame from a Japanese pop music video, shot on 16mm film, soft halation, natural film grain, gentle pastel color grading, nostalgic and cinematic, photorealistic, no text, no watermark.';
const DANCERS = 'four female backup dancers (original fictional young East Asian women, not real people) in matching black crop tops, black pleated skirts, black boots and orange armbands';
const KPOP_V = 'High-budget K-pop girl group music video, cinematic, glossy color grading, her face stays consistent, smooth natural motion, photorealistic, no text.';
const JPOP_V = 'Japanese pop music video shot on 16mm film, soft halation and film grain, her face stays consistent, natural motion, photorealistic, no text.';

// 圖：refs = [名稱, 強度]；影片：video = { start: 名稱, end?: 名稱, duration }
const JOBS = [
  // 風格試做：K-pop 三張、日系三張
  { name: 'style-k1', refs: [['idol', 'HIGH']], prompt: `${KPOP} Wide shot of a surreal candy-colored set: a giant glossy baby-pink room filled with oversized chrome server racks and floating translucent orange eight-pointed stars, a mirrored floor. ${CHAR} strikes a sharp choreography pose in the center, one arm extended, chin up, staring into the lens. Soft high-key lighting with pink and cyan accents.` },
  { name: 'style-k2', refs: [['idol', 'HIGH']], prompt: `${KPOP} Close-up beauty shot of ${CHAR}: glitter on her cheekbones, glass skin, a single tear of liquid chrome on her cheek, iridescent holographic light reflecting across her face, a dark cyber background of blurred blue data lights. She looks straight into the lens, cool and unreadable.` },
  { name: 'style-k3', refs: [['idol', 'HIGH']], prompt: `${KPOP} Low-angle dynamic wide shot of ${CHAR} dancing in front of a huge red LED wall showing a giant warning gauge at 99 percent, smoke on the floor, strobe light beams cutting through haze, her hair flying mid-move, other blurred backup dancers in black behind her. Bold red, black and white color concept.` },
  { name: 'style-j1', refs: [['idol', 'HIGH']], prompt: `${JPOP} Tokyo suburb at blue hour: ${CHAR} stands at a railway crossing, the striped barrier down and the red signal lights glowing, a commuter train rushing past behind her in motion blur, overhead power lines against a pastel violet sky. She looks back at the camera over her shoulder.` },
  { name: 'style-j2', refs: [['idol', 'HIGH']], prompt: `${JPOP} Inside a Japanese convenience store late at night under flickering greenish fluorescent light: ${CHAR} stands in the snack aisle holding a can of soda, looking directly into the camera with a deadpan expression, shot with an on-camera flash, rows of colorful packages around her.` },
  { name: 'style-j3', refs: [['idol', 'HIGH']], prompt: `${JPOP} A school rooftop at golden hour with an enormous dramatic sky of towering cumulus clouds, lens flare, hundreds of loose paper sheets swirling in the wind around ${CHAR}, who stands at the chain-link fence with her hair and skirt blowing, gazing up at the sky. Anime-inspired composition.` },

  // 影片第一格：主歌是日系日常，副歌是 K-pop 布景
  { name: 's-eye', refs: [['idol', 'LOW']], prompt: `${JPOP} Extreme macro close-up of one eye of a young East Asian woman filling the frame horizontally: dark-brown iris with fine detail, tiny bright orange sparks and points of light reflected in the iris like electric sparks, long lashes, natural skin texture, the edge of black blunt bangs at the top of the frame, shallow depth of field.` },
  { name: 's-room', refs: [['idol', 'HIGH']], prompt: `${JPOP} Night in a small cluttered Tokyo apartment: ${CHAR} sits on the tatami floor hugging her knees in front of an open laptop placed on a low table, the laptop screen is the only light source and casts a cold glow on her face, dark room, city lights through a window behind her, wide shot from slightly above.` },
  { name: 's-pink-group', refs: [['style-k1', 'HIGH'], ['idol', 'HIGH']], prompt: `Same candy-pink set with chrome server racks, floating orange stars and mirrored floor as the first reference image. Wide shot: ${CHAR} in the center front with ${DANCERS} behind her in a V formation, all in the same sharp choreography pose with arms extended. ${KPOP}` },
  { name: 's-street', refs: [['idol', 'HIGH']], prompt: `${JPOP} A huge Tokyo scramble crossing at dusk under glowing giant video screens and neon signs: ${CHAR} stands perfectly still in the middle of the crosswalk facing the camera while a dense crowd of commuters walks past around her, wide shot, eye level, pastel blue-and-pink dusk sky.` },
  { name: 's-train', refs: [['idol', 'HIGH']], prompt: `${JPOP} Inside an almost empty Tokyo commuter train carriage late at night: ${CHAR} sits alone on the long bench seat holding her phone in her lap, looking up toward the camera, blurred city lights streaking past the dark windows behind her, greenish fluorescent ceiling lights, hanging straps swaying.` },
  { name: 's-chrome-dance', refs: [['idol', 'HIGH']], prompt: `${KPOP} A futuristic liquid-chrome set: mirrored chrome floor, a giant glossy chrome eight-pointed star sculpture, cool blue and violet light, haze. ${CHAR} in the center front with ${DANCERS} behind her, all hitting a powerful synchronized pose, low-angle wide shot.` },
  { name: 's-classroom', refs: [['idol', 'HIGH']], prompt: `${JPOP} An empty Japanese high-school classroom at sunset: a large blackboard behind her covered in chalk drawings of neural network diagrams with circles and arrows, warm orange sunlight streaming through the windows with dust in the air, rows of wooden desks, ${CHAR} sits on top of a desk by the window, swinging her boots, looking at the camera.` },
  { name: 's-taxi', refs: [['idol', 'HIGH']], prompt: `${JPOP} Night, in the back seat of a Tokyo taxi with white lace seat covers: ${CHAR} sits by the rain-speckled window, colorful neon signs reflected and streaking across the glass and her face, she glances toward the camera, close medium shot.` },
  { name: 's-paperclips', refs: [['idol', 'HIGH']], prompt: `${KPOP} A bright white seamless studio set: a towering mountain of giant shiny golden paperclips fills the room, more paperclips frozen mid-air falling from above, ${CHAR} stands in a confident power pose on top of the pile in the center, high-key lighting with warm gold reflections, wide shot.` },
  { name: 's-final', refs: [['idol', 'HIGH']], prompt: `${KPOP} Finale wide shot on a vast glossy white stage: a gigantic glowing orange eight-pointed star of light behind them, ${CHAR} in the center with ${DANCERS} around her in a symmetrical final formation, arms raised, orange confetti bursting in the air, dramatic backlight and haze, crane camera angle from slightly above.` },

  // Seedance 2.0：每段 5 秒，劇照當第一格
  ...[
    ['v-crossing', 'style-j1', `${JPOP_V} A commuter train rushes past behind her in motion blur; the wind from the train blows her hair and skirt; she slowly turns from looking over her shoulder to face the camera; the crossing signal lights blink red alternately. Handheld camera slowly drifts closer.`],
    ['v-eye', 's-eye', `${JPOP_V} Extreme macro close-up of the eye. The eye slowly opens; tiny orange sparks and points of light flicker and swirl in the reflection on the iris like electric sparks; the pupil contracts; the eyelashes flutter. Very slow push-in.`],
    ['v-konbini', 'style-j2', `${JPOP_V} She cracks open the soda can with one hand and keeps staring into the camera with a deadpan face; the fluorescent tubes flicker; the price labels and the security monitor glitch with orange light; the camera slowly pushes in.`],
    ['v-room', 's-room', `${JPOP_V} The glow of the laptop screen grows brighter and turns warm orange, flooding the whole room with light until everything is washed out to white; she lifts her head and looks into the light, wide-eyed. Slow push-in.`],
    ['v-pink', 'style-k1', `${KPOP_V} She performs a sharp, powerful K-pop dance solo in the pink server room: arm waves, a hair flip, a quick turn, ending pointing at the camera; floating orange stars drift; the camera orbits around her smoothly.`],
    ['v-pink-group', 's-pink-group', `${KPOP_V} She and the four backup dancers perform tight synchronized K-pop choreography with sharp hits on every beat, hair flying; reflections on the mirror floor; the camera cranes up and pushes in.`],
    ['v-rooftop', 'style-j3', `${JPOP_V} Hundreds of paper sheets swirl in the strong wind around her; she turns from the sky to the camera with a faint smile while her hair whips across her face; the clouds drift; the lens flare shifts.`],
    ['v-street', 's-street', `${JPOP_V} The crowd of commuters streams past her in fast motion with long motion blur, like a timelapse, while she stands perfectly still in the middle of the crossing, staring into the camera; the giant screens flicker. Locked-off camera.`],
    ['v-train', 's-train', `${JPOP_V} City lights stream past the dark windows; the carriage sways gently and the hanging straps swing; she slowly looks up from her phone straight into the camera; the fluorescent lights flicker once. Handheld.`],
    ['v-chrome', 'style-k2', `${KPOP_V} The liquid chrome tear rolls slowly down her cheek; holographic light sweeps across her face; she slowly tilts her head and a faint smirk appears; blurred blue data lights shimmer behind her. Slow push-in.`],
    ['v-chrome-dance', 's-chrome-dance', `${KPOP_V} She and the backup dancers perform a powerful synchronized K-pop dance break with sharp, robotic isolations and a group wave; blue and violet lights sweep; the camera glides low across the chrome floor toward them.`],
    ['v-classroom', 's-classroom', `${JPOP_V} She hops down from the desk and walks toward the camera; sunlight flickers through the windows; chalk dust and loose papers drift in the light; the curtains billow. Handheld camera walks backward with her.`],
    ['v-taxi', 's-taxi', `${JPOP_V} The taxi takes a sharp left turn; neon reflections slide quickly across the window and her face; she leans with the turn and then looks straight into the camera; raindrops streak across the glass.`],
    ['v-red', 'style-k3', `${KPOP_V} Strobe lights flash; the giant gauge needle on the red LED wall swings up to the maximum; she and the backup dancers hit a powerful synchronized K-pop move, hair flying, smoke rolling across the floor; low-angle camera pushes in.`],
    ['v-paperclips', 's-paperclips', `${KPOP_V} Thousands of shiny golden paperclips rain down from above and pile up around her while she dances calmly on top of the pile; glittering slow-motion particles; the camera slowly pulls back to reveal the whole room filling with paperclips.`],
    ['v-final', 's-final', `${KPOP_V} Finale: she and the backup dancers hit the final pose together; orange confetti bursts and swirls; the giant star of light pulses; the camera cranes up and back to reveal the whole formation.`],
  ].map(([name, start, prompt]) => ({ name, video: { start, duration: 5 }, prompt })),
];

const byName = Object.fromEntries(JOBS.map(j => [j.name, j]));
const todo = JOBS.filter(j => !index[j.name] && (!only.length || only.includes(j.name)));
console.log('to generate:', todo.map(j => j.name).join(', ') || '(nothing)');

const balance = async () => (await api('GET', '/v1/me')).j?.user_details?.[0]?.apiPaidTokens;
const start = await balance();

const bodyOf = job => {
  if (job.video) {
    const v = job.video;
    const guid = { start_frame: [{ image: { id: index[v.start].imageId, type: 'GENERATED' } }] };
    if (v.end) guid.end_frame = [{ image: { id: index[v.end].imageId, type: 'GENERATED' } }];
    return { model: v.model || 'seedance-2.0', public: false, parameters: { prompt: job.prompt, quantity: 1, width: 1280, height: 720, duration: v.duration || 5, motion_has_audio: false, guidances: guid } };
  }
  const refs = job.refs.map(([n, s]) => ({ image: { id: index[n].imageId, type: 'GENERATED' }, strength: s }));
  return { model: 'gemini-image-2', public: false, parameters: { width: job.w || 1376, height: job.h || 768, quantity: 1, prompt_enhance: 'OFF', prompt: job.prompt, ...(refs.length ? { guidances: { image_reference: refs } } : {}) } };
};
const depsOf = job => job.video ? [job.video.start, job.video.end].filter(Boolean) : job.refs.map(r => r[0]);

// 只有送出失敗才重送（送出成功就不再重送，避免重複扣點）
const run = async job => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const sub = await api('POST', '/v2/generations', bodyOf(job));
    const genId = sub.j?.generate?.generationId || sub.j?.generationId;
    if (!genId) { console.log(job.name, 'submit failed', sub.status, sub.t.slice(0, 300)); await sleep(3000); continue; }
    for (let i = 0; i < 200; i++) {
      await sleep(job.video ? 8000 : 4000);
      const g = (await api('GET', `/v1/generations/${genId}`)).j?.generations_by_pk;
      if (g?.status === 'FAILED') { console.log(job.name, 'FAILED'); return false; }
      if (g?.status === 'COMPLETE') {
        const im = g.generated_images?.[0];
        if (!im) { console.log(job.name, 'complete but no output (moderation?)'); return false; }
        const url = job.video ? (im.motionMP4URL || im.url) : im.url;
        const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
        const ext = job.video ? 'mp4' : (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
        const file = job.video ? `clips/${job.name}.${ext}` : `${job.name}.${ext}`;
        writeFileSync(`${outDir}/${file}`, buf);
        index[job.name] = { imageId: im.id, file, generationId: genId };
        save();
        console.log('done', job.name, buf.length, 'bytes');
        return true;
      }
    }
    console.log(job.name, 'timed out (generation', genId, ')');
    return false;
  }
  return false;
};

// 相依：要用到的圖都好了才跑；最多同時 4 個
const pending = new Set(todo.map(j => j.name));
const running = new Set();
const failed = new Set();
await new Promise(resolve => {
  const pump = () => {
    if (!pending.size && !running.size) return resolve();
    for (const name of [...pending]) {
      if (running.size >= 4) break;
      const job = byName[name];
      const deps = depsOf(job);
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
