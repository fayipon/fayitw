// 精神版 P(doom) MV：用 Leonardo 生成定裝照、劇照（Nano Banana Pro）與影片片段（Seedance 2.0）
// node scripts/pdoom-jingshen-leonardo.mjs [只跑這些名稱...]（原檔存到 assets-src/pdoom-jingshen/，已經生成過的會跳過）
// key 從環境變數 LEONARDO_API_KEY 讀，不會印出來
// 畫面照時裝秀 MV 的拍法（35mm 閃光燈、顆粒、前半夜景後半霧白），主角換成東北精神小妹；
// 前半是東北雪夜縣城，後半是雪地白茫茫；畫面裡不放任何字，字全由網頁疊上去
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const key = process.env.LEONARDO_API_KEY;
if (!key) { console.log('no key'); process.exit(1); }
const outDir = 'assets-src/pdoom-jingshen';
const only = process.argv.slice(2);
mkdirSync(`${outDir}/clips`, { recursive: true });
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

const NOTEXT = 'No text, no letters, no Chinese characters, no logos, all signs and screens blank, no watermark.';
const NIGHT = `Still frame from an avant-garde high-fashion runway film, shot on 35mm film with a harsh on-camera flash, heavy film grain, cool desaturated night palette with teal shadows and sodium-orange practical lights, editorial composition, deadpan model attitude, photorealistic. ${NOTEXT}`;
const WHITE = `Still frame from an avant-garde high-fashion film, high-key washed-out white snowy daylight, soft diffused light, pale grey-white palette with a single orange accent, shot on 35mm film with film grain, minimalist editorial composition, photorealistic. ${NOTEXT}`;
const V_NIGHT = 'High-fashion runway film shot on 35mm film with an on-camera flash, film grain, cool night palette, her face, hair and tattoos stay consistent, smooth natural motion, photorealistic, no text.';
const V_WHITE = 'High-fashion film in high-key white snowy daylight, 35mm film grain, her face, hair and tattoos stay consistent, smooth natural motion, photorealistic, no text.';

// 主角：東北精神小妹（定裝照 char-d），衣服分三套在不同 Look 換
const INK = 'heavily tattooed: full sleeve tattoos of Chinese dragons, koi fish and peonies on both arms, a Siberian tiger tattoo on the side of her neck, small tattoos on her hands and fingers (all tattoos are pictures only, no lettering)';
const FACE = 'very pale skin, thick black winged eyeliner, huge false lashes, grey colored contact lenses, a nose ring and many ear piercings, a black face mask pulled down under her chin, a cold defiant stare';
const MINK = 'an oversized black mink fur coat slipping off her shoulders, a tight black tank top, two thick gold chain necklaces, a chunky gold watch, a black leather mini skirt, fishnet tights, black platform boots';
const FLOWER = 'an oversized cropped quilted cotton jacket in the classic bright Dongbei big-flower print (huge pink and red peonies with green leaves on a vivid red background) worn open and off the shoulders over a tight black tank top, a thick gold chain, black leather leggings, black chunky platform boots';
const ARMY = 'an army-green Chinese military greatcoat with a fake-fur collar draped over her shoulders, a tight white tank top, thick gold chains, black track pants with white side stripes, chunky white platform sneakers';
const WHO = 'the same young woman from the reference image (same face, same glossy black wolf-cut mullet with choppy bangs and orange-red streaks, same pale skin, winged eyeliner, false lashes, grey contacts and nose ring, same dragon, koi and peony sleeve tattoos and tiger neck tattoo, black face mask pulled down under her chin, a small orange eight-pointed star hair clip)';
const CREW = 'a crew of young Northeastern Chinese men (fictional adults) with shaved heads and buzz cuts, thick gold chains, tattooed necks and hands and black mink coats';
const SHEHUI = 'the Chinese "shehui yao" street dance: fast rhythmic shaking of the shoulders and chest, hands chopping and swinging side to side on every beat, sharp head nods, hair whipping';
const D = [['char-d', 'HIGH']];

// 圖：refs = [名稱, 強度]；影片：video = { start: 名稱, end?: 名稱, duration }
const JOBS = [
  // 定裝照（第二輪選定 D）；洗浴中心那張風格照直接當影片第一格
  { name: 'char-d', refs: [], prompt: `${NIGHT} Medium-full shot from the knees up, eye level: an adult Northeastern Chinese woman, 22 years old, in extreme "jingshen xiaomei" style, ${INK}, ${FACE}, a glossy black wolf-cut mullet with choppy bangs and vivid orange-red streaks, ${MINK}. She stands with one hand on her hip, chin up, staring straight into the lens, in a snowy Northeast Chinese county-town street at night, snow falling and lit up by the camera flash, sodium streetlights, old Soviet-era apartment blocks, red lanterns, white steam rising from a roadside barbecue stall behind her. Her face and tattoos are sharp and clearly visible.` },
  { name: 'style-d', refs: D, prompt: `${NIGHT} Wide symmetrical shot inside the grand kitschy lobby of a Northeast Chinese bathhouse (xiyu zhongxin): golden Roman columns, huge crystal chandeliers, a long red carpet over a glossy marble floor, fake palm trees. The same woman from the reference image (same face, hair, tattoos, makeup and outfit) struts down the red carpet toward the camera like a runway model, while a crew of young men with shaved heads, thick gold chains, tattooed necks and black mink coats line up on both sides.` },

  // ---------- 前半：東北雪夜 ----------
  { name: 's-eye', refs: [['char-d', 'LOW']], prompt: `${NIGHT} Extreme macro close-up of one eye of a young East Asian woman filling the frame horizontally: a light-grey colored contact lens over the iris, thick black winged eyeliner, huge false lashes with tiny snowflakes caught on them, tiny bright orange sparks and points of light reflected in the iris like electric sparks, the edge of black bangs with an orange-red streak at the top of the frame, pale skin texture, shallow depth of field, dark background.` },
  { name: 's-netcafe', refs: D, prompt: `${NIGHT} A huge dark Northeast Chinese internet cafe late at night: endless rows of glowing gaming monitors (screens show only abstract blue light), black gaming chairs, cigarette haze in the air, frosted windows. ${WHO}, wearing ${MINK}, sits on top of a desk in the center aisle in the right third of the frame, platform boots on a chair, elbows on her knees, staring into the lens.` },
  { name: 's-drop', refs: D, prompt: `${NIGHT} A snowy Northeast Chinese county-town street at night with deep fresh snow, sodium streetlights, falling snow lit by the flash. ${WHO}, wearing ${MINK}, stands on top of a high snowbank with her arms spread wide and her eyes closed, leaning backward as if about to fall, full body, low angle.` },
  { name: 's-bbq', refs: D, prompt: `${NIGHT} A Northeast Chinese barbecue stall on a snowy night: a plastic tent lit by bare bulbs, thick white smoke and steam from the charcoal grill, red plastic stools in the snow. ${WHO}, wearing ${MINK}, sits on a red plastic stool in the center front like it is a throne, legs crossed, holding a long metal skewer of grilled lamb, with ${CREW} standing behind her with arms folded.` },
  { name: 's-disco', refs: D, prompt: `${NIGHT} An old-school Northeast Chinese disco hall: green and red laser beams cutting through thick smoke, a mirror ball, a packed dance floor. ${WHO}, wearing ${MINK}, dances in the center front with ${CREW} and girls in black dancing behind her, low-angle wide shot, strobe light.` },
  { name: 's-sing', refs: D, prompt: `${NIGHT} Close-up from the chest up, slightly low angle: ${WHO}, wearing ${MINK}, sings fiercely into a thin skin-tone headset microphone, mouth open mid-note, gold chains glinting, deep red light on one side of her face, snowflakes in the flash, black background.` },
  { name: 's-fuse', refs: D, prompt: `${NIGHT} A snowy empty lot in a Northeast Chinese county town at night, old apartment blocks behind. ${WHO}, wearing ${MINK}, crouches in the snow holding a lighter to the fuse of a big red firework launcher box, the flame lighting her face, the fuse just starting to spark, medium wide shot.` },
  { name: 's-kang', refs: D, prompt: `${NIGHT} Symmetrical wide shot of a tiny cramped old Northeast Chinese room: a heated brick kang bed covered with a floral quilt, faded floral wallpaper, a red thermos flask, a frosted window, a single bare bulb hanging from the ceiling, a closed wooden door. ${WHO}, wearing ${FLOWER}, sits cross-legged on the kang in the center, staring into the lens.` },
  { name: 's-shoggoth', refs: D, prompt: `${NIGHT} An abandoned dark factory hall at night: a gigantic tangled mountain of black cables, wires and old electronics fills the background, covered with hundreds of tiny glowing red LED lights like eyes, snow drifting down through a broken roof in a shaft of cold light. ${WHO}, wearing ${MINK}, stands small in the foreground with her back to the camera, looking up at it.` },
  { name: 's-train', refs: D, prompt: `${NIGHT} Inside an old green Chinese passenger train carriage at night: hard seats, warm yellow lights, small tables, frosted windows, snowy darkness outside. ${WHO}, wearing ${FLOWER}, sits alone by the window with her boots up on the opposite seat, looking at the camera, medium wide shot.` },
  { name: 's-aurora', refs: D, prompt: `${NIGHT} A frozen river in the far north of China at night under a huge swirling green aurora and an enormous full moon low over the horizon, endless snowy plain. ${WHO}, wearing ${ARMY}, stands small in the center of the frame, looking up, her coat blowing in the wind, wide shot.` },
  { name: 's-guihuo', refs: D, prompt: `${NIGHT} A snowy Northeast Chinese street at night: a pack of motor scooters with bright colorful LED underglow lights (rainbow light strips), ridden by ${CREW}. ${WHO}, wearing ${MINK}, sits sideways on the back of the lead scooter, one hand raised, looking into the lens, tracking shot, snow spraying from the wheels.` },
  { name: 's-mahjong', refs: D, prompt: `${NIGHT} A smoky Northeast Chinese mahjong parlor at night: a green automatic mahjong table under a hanging lamp, cigarette smoke curling, thermos flasks, ${CREW} sitting and standing around the table. ${WHO}, wearing ${FLOWER}, sits at the far side of the table facing the camera, one hand flat on the tiles.` },
  { name: 's-window', refs: D, prompt: `${NIGHT} Inside an old city bus at night in a snowstorm, the windows thick with frost, blurred orange streetlights outside. ${WHO}, wearing ${FLOWER}, sits by the window with her tattooed palm pressed flat against the frosted glass, looking into the camera, close medium shot.` },
  { name: 's-crew', refs: D, prompt: `${NIGHT} Wide shot of a snowy Northeast Chinese street at night, backlit by the headlights of a row of motorbikes through falling snow. ${WHO}, wearing ${MINK}, stands in the center front with ${CREW} in a V formation behind her, everyone frozen in the same sharp dance pose with one arm swinging across the chest.` },
  { name: 's-stage', refs: D, prompt: `${NIGHT} A small gaudy Northeast Chinese folk-performance stage (errenzhuan): red velvet curtains, colored spotlights, a row of cold-spark fountains along the stage edge. ${WHO}, wearing ${FLOWER}, stands center stage spinning a red square handkerchief on one finger in the errenzhuan style, chin up, low-angle wide shot.` },

  // ---------- 後半：雪地白茫茫 ----------
  { name: 's-highway', refs: D, prompt: `${WHITE} An empty snowy expressway in a whiteout, big blank green overhead gantry signs fading into the white mist, guardrails, snow blowing across the asphalt. ${WHO}, wearing ${ARMY}, walks toward the camera along the dashed center line, small in the frame.` },
  { name: 's-factory', refs: D, prompt: `${WHITE} Inside an abandoned Soviet-era steel factory in Northeast China in daylight: giant rusted machines, an overhead crane with a hanging hook, shafts of white light, snow falling through a broken roof. ${WHO}, wearing ${ARMY}, walks between the machines in the left third of the frame.` },
  { name: 's-drift', refs: D, prompt: `${WHITE} High aerial top-down view of a frozen white lake: an old boxy dark car drifting sideways in a sharp left turn, spraying a huge arc of snow, long curved tire tracks on the ice, ${WHO}, wearing ${ARMY}, leans out of the passenger window looking up at the camera.` },
  { name: 's-ice', refs: D, prompt: `${WHITE} Top-down view: ${WHO}, wearing ${MINK}, lies on her back on the snow-dusted frozen river ice, arms spread wide, the black mink coat spread around her like a shadow, white cracks in the ice, staring straight up into the lens, pure white surroundings.` },
  { name: 's-snowdance', refs: D, prompt: `${WHITE} Wide shot of a pure white snowfield in a whiteout: ${WHO}, wearing ${MINK}, stands in the center front with ${CREW} in formation behind her, black figures on pure white, all in a sharp synchronized dance pose, snow kicked up around their boots.` },
  { name: 's-paperclips', refs: D, prompt: `${WHITE} A bright white seamless studio: a towering mountain of giant shiny silver paperclips fills the room, more paperclips frozen mid-air falling from above. ${WHO}, wearing ${MINK}, sits on top of the pile in a confident power pose, legs crossed, wide shot.` },
  { name: 's-pool', refs: D, prompt: `${WHITE} An abandoned empty indoor swimming pool: pale blue square tiles forming a perfect grid on every surface, snow drifting in through broken skylights, cold blue-white light. ${WHO}, wearing ${FLOWER}, sits alone at the bottom of the empty pool hugging her knees, symmetrical high-angle wide shot.` },
  { name: 's-pylons', refs: D, prompt: `${WHITE} A snowy plain under a white sky with giant steel power transmission pylons and an electrical substation full of big transformers and insulators, cables crossing the sky. ${WHO}, wearing ${ARMY}, walks beneath them, small in the frame, low-angle wide shot.` },
  { name: 's-fence', refs: D, prompt: `${WHITE} A snowy field with a tall snow-covered chain-link fence across it. ${WHO}, wearing ${ARMY}, sprints toward the fence and the camera, mid-stride, coat flying, snow kicked up, low-angle wide shot.` },
  { name: 's-gpu', refs: D, prompt: `${WHITE} Inside an old factory turned into a cryptocurrency mining farm in daylight: endless rows of open-frame racks full of graphics cards with small blinking green lights and spinning fans, frost on the tall windows, cold white light. ${WHO}, wearing ${ARMY}, walks down the long aisle toward the camera.` },
  { name: 's-loom', refs: D, prompt: `${WHITE} An old Northeast Chinese textile mill in soft white daylight: rows of vintage weaving looms, thousands of white threads stretched taut, cotton dust in the light. ${WHO}, wearing ${FLOWER}, stands between the looms looking into the lens, medium wide shot.` },
  { name: 's-mask', refs: D, prompt: `${WHITE} Close-up portrait in heavy falling snow against a white background: ${WHO}, wearing ${ARMY}, looks straight into the lens with a cold stare, snowflakes on her false lashes and hair, holding the black face mask with two tattooed fingers about to pull it up.` },
  { name: 's-clones', refs: D, prompt: `${WHITE} A pure white snowfield in a whiteout: dozens of identical copies of ${WHO}, all wearing ${MINK}, stand in a perfect grid formation facing the camera, receding into the white mist, wide symmetrical shot.` },
  { name: 's-star', refs: [['char-d', 'LOW']], prompt: `${WHITE} Extreme macro close-up of a small glossy orange eight-pointed star hair clip in glossy black hair with an orange-red streak, big soft snowflakes landing on the hair, pale white background, shallow depth of field.` },

  // ---------- Seedance 2.0：每段 5 秒，劇照當第一格 ----------
  ...[
    ['v-eye', 's-eye', `${V_NIGHT} Extreme macro close-up of the eye. The eye slowly opens; tiny orange sparks and points of light flicker and swirl in the reflection on the grey iris like electric sparks; snowflakes on the lashes melt; the pupil contracts. Very slow push-in.`],
    ['v-netcafe', 's-netcafe', `${V_NIGHT} The rows of monitors flicker and go dark and light again row by row like a wave; she slowly leans forward toward the camera chewing gum, staring into the lens; haze drifts. Slow dolly in along the aisle.`],
    ['v-drop', 's-drop', `${V_NIGHT} She lets herself fall straight backward off the snowbank into the deep powdery snow in slow motion, arms spread, the mink coat flaring; a burst of powder snow sparkles in the camera flash. The camera tilts down following her.`],
    ['v-bathhouse', 'style-d', `${V_NIGHT} She struts down the red carpet toward the camera like a runway model; as she passes, the men on both sides bow deeply in unison; the crystal chandeliers sparkle. The camera dollies backward in front of her.`],
    ['v-bbq', 's-bbq', `${V_NIGHT} She bites a piece of lamb off the skewer while staring into the lens; thick smoke billows from the grill; snow falls; the men behind her nod slowly together. Slow push-in.`],
    ['v-disco', 's-disco', `${V_NIGHT} She and the crowd behind her perform ${SHEHUI}, all in sync; green and red lasers sweep through the smoke; strobe flashes; the mirror ball spins. Low-angle camera pushes in.`],
    ['v-sing', 's-sing', `${V_NIGHT} She sings a line with fierce attitude into the headset microphone, head snapping to the beat, gold chains swinging; the red light pulses; at the end her grey eyes catch a red glow. Handheld camera, strobe flash.`],
    ['v-fuse', 's-fuse', `${V_NIGHT} The fuse sparks and burns; she stands up and walks toward the camera without looking back while huge golden fireworks erupt into the sky behind her, lighting the snow and the apartment blocks gold. Camera slowly pulls back.`],
    ['v-kang', 's-kang', `${V_NIGHT} The bare bulb sways slowly and the shadows swing across the room; frost spreads across the window; a blank sheet of paper slides in under the door; she slowly turns her head to look at it, then pulls her face mask down under her chin and stares back into the lens. Locked-off camera.`],
    ['v-shoggoth', 's-shoggoth', `${V_NIGHT} The hundreds of red lights on the cable mountain blink and shift like eyes opening; the whole mass seems to slowly breathe; snow drifts down; she turns around to face the camera. Slow push-in.`],
    ['v-train', 's-train', `${V_NIGHT} The carriage sways; lights from the snowy darkness stream past the frosted window; she wipes a clear patch in the frost with her tattooed hand and then looks back into the camera. Handheld.`],
    ['v-aurora', 's-aurora', `${V_NIGHT} The green aurora ripples and swirls fast across the sky like a timelapse; she slowly raises one tattooed hand toward the giant moon; her coat blows in the wind. Slow crane up.`],
    ['v-guihuo', 's-guihuo', `${V_NIGHT} The pack of LED-lit scooters accelerates down the snowy street, the colored lights streaking into long trails, snow spraying; her hair and coat whip in the wind as she stares into the lens. Fast tracking shot alongside.`],
    ['v-mahjong', 's-mahjong', `${V_NIGHT} The automatic mahjong table opens and all the tiles shuffle and rearrange themselves in fast motion; she slams her tattooed hand down on the table; the men lean in; smoke swirls. Slow push-in.`],
    ['v-window', 's-window', `${V_NIGHT} She slides the frosted bus window open and leans out into the snowstorm, her hair and jacket blowing wildly, snow rushing past her face, eyes half-closed. Handheld camera beside her.`],
    ['v-crew', 's-crew', `${V_NIGHT} She and the crew perform ${SHEHUI}, perfectly synchronized; the motorbike headlights flare through the falling snow; breath steams. Low-angle camera slowly pushes in.`],
    ['v-stage', 's-stage', `${V_NIGHT} She spins the red handkerchief fast on her finger, tosses it high into the air and catches it still spinning; the cold-spark fountains erupt along the stage edge; colored spotlights sweep. Camera pushes in.`],
    ['v-highway', 's-highway', `${V_WHITE} She walks steadily toward the camera along the center line; snow blows across the road; the blank gantry signs loom out of the mist above. The camera slowly moves backward in front of her.`],
    ['v-factory', 's-factory', `${V_WHITE} Snow drifts down through the shafts of light; she walks between the giant rusted machines; the crane hook swings slowly overhead. The camera tracks sideways with her.`],
    ['v-drift', 's-drift', `${V_WHITE} The car whips around in a sharp left drift on the frozen lake, spraying a huge arc of snow; she leans out of the open window, hair and coat flying, staring up into the lens; the high camera follows the spin from above.`],
    ['v-ice', 's-ice', `${V_WHITE} The camera rises slowly straight up from her face, revealing more and more of the vast empty white frozen river until she is a tiny black shape; wind blows thin streams of snow across the ice.`],
    ['v-snowdance', 's-snowdance', `${V_WHITE} She and the crew perform ${SHEHUI}, perfectly synchronized, black figures on pure white; snow is kicked up into the air with every step. Low-angle camera pushes in.`],
    ['v-paperclips', 's-paperclips', `${V_WHITE} Thousands of shiny silver paperclips rain down from above and pile up around her while she sits calmly on top of the pile; glittering slow motion. The camera slowly pulls back to reveal the whole room filling with paperclips.`],
    ['v-pool', 's-pool', `${V_WHITE} Snow drifts down into the empty tiled pool; the cold light slowly shifts across the blue grid of tiles; she slowly lies back on the tiles and spreads her arms. The camera cranes slowly upward.`],
    ['v-pylons', 's-pylons', `${V_WHITE} Snow blows across the plain; bright blue electric sparks crackle and arc between the transformer insulators; the cables sway; she keeps walking without flinching. Low wide tracking shot.`],
    ['v-fence', 's-fence', `${V_WHITE} She sprints to the right and throws herself shoulder-first into the chain-link fence, which tears open as she bursts through; snow explodes off the fence into the air around her in slow motion. The camera tracks with her.`],
    ['v-gpu', 's-gpu', `${V_WHITE} Thousands of fans spin; the small lights on the racks blink in waves down the aisle; her breath steams in the cold; she walks toward the camera. The camera slowly moves backward.`],
    ['v-loom', 's-loom', `${V_WHITE} The old looms clatter to life around her; shuttles fly back and forth; the white threads vibrate; cotton dust swirls in the light; she stays perfectly still, staring into the lens. Slow dolly sideways.`],
    ['v-mask', 's-mask', `${V_WHITE} She slowly pulls the black face mask up over her nose and mouth, keeping her cold stare on the lens; snowflakes land on her lashes; she lifts her chin slightly. Very slow push-in.`],
    ['v-clones', 's-clones', `${V_WHITE} All the copies of her turn their heads at exactly the same moment to stare into the camera; snow blows between the rows. The camera slowly pushes in toward the front row.`],
    ['v-star', 's-star', `${V_WHITE} Big soft snowflakes land on the hair and the orange star hair clip and slowly melt; the focus breathes; the camera slowly orbits around the clip.`],
  ].map(([name, start, prompt]) => ({ name, video: { start, duration: 5 }, prompt })),
];

const byName = Object.fromEntries(JOBS.map(j => [j.name, j]));
// 參數：名稱、或 stills / videos 代表全部劇照／全部影片
const pick = j => !only.length || only.includes(j.name) || (only.includes('stills') && j.name.startsWith('s-')) || (only.includes('videos') && j.video);
const todo = JOBS.filter(j => !index[j.name] && pick(j));
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
