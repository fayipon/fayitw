// HG-Fable01 -小紅帽：用 Leonardo 生成小紅帽美術（Nano Banana Pro），需要去背的再走 remove-bg
// node scripts/auto-slot-leonardo.mjs [只跑這些名稱...]（原檔存到 assets-src/auto-slot/）
// 已經生成過的（index.json 裡有）會跳過；key 從環境變數 LEONARDO_API_KEY 讀，不會印出來
// 風格照設計稿 r-ref.jpg（PG Soft 風的動漫小紅帽）：先上傳成參考圖，其他圖都帶它當風格參考
// 2026-10 改成繪本奇幻風：s- 開頭的工作，版面照 r-ref、風格照整頁設計稿 s-ref-a（白天的森林、羊皮紙格、纏藤蔓的蜂蜜色木框）
// 生成完再跑 node scripts/auto-slot-symbols.mjs（符號去背）、python scripts/auto-slot-ui.py 與 node scripts/auto-slot-assets.mjs 轉成遊戲與網頁用的檔案
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const key = process.env.LEONARDO_API_KEY;
if (!key) { console.log('no key'); process.exit(1); }
const outDir = 'assets-src/auto-slot';
const only = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const indexPath = `${outDir}/index.json`;
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};
// 存 index.json：Windows 上偶爾被別的程式短暫鎖住（UNKNOWN: open），等一下重試，免得已經扣點的圖沒記到
const save = () => {
  for (let i = 0; ; i++) {
    try { writeFileSync(indexPath, JSON.stringify(index, null, 2)); return; } catch (e) {
      if (i >= 20) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
};

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

// 繪本奇幻版（2026-10）：白天的童話繪本，暖陽、森林綠、蜂蜜色木頭、羊皮紙、寶石色點綴
const SB_STYLE = 'Premium mobile slot game art in a warm storybook fantasy style: a richly detailed painterly digital illustration like a high-end fairy tale picture book, semi-realistic cartoon characters with friendly expressive faces, bright sunny daytime, warm golden sunlight with soft light beams and dappled light through leaves, lush forest greens, warm honey-colored wood, parchment, jewel-tone accents of ruby red, emerald, amethyst and sapphire, polished gold trim, soft glossy highlights, crisp clean shapes, high detail, no watermark, no letters or words unless asked.';
const SB_HERO = 'Little Red Riding Hood as a cute storybook girl with big sparkling green eyes, rosy cheeks, a friendly brave smile and a short wavy brown bob, a crimson hooded cape tied with a bow, a white puff-sleeved blouse, a brown laced leather bodice, a red skirt with a white apron, brown leather boots, holding a short shiny silver sword with a gold crossguard, soft painterly storybook rendering in warm sunlight';
const SB_WOLF = 'the Big Bad Wolf as a big shaggy grey-brown storybook cartoon wolf with a long snout, yellow eyes, bushy eyebrows, a toothy mischievous grin, scruffy chest fur and a big bushy tail, a little goofy rather than scary, soft painterly storybook rendering in warm sunlight';
const SB_MOCKUP ='A complete vertical mobile slot game screen design mockup with exactly the same layout as the reference image, from top to bottom: the game title logo "Red Riding Hood" at the top left; a wolf health bar with a small diamond-shaped wolf portrait at the top right; the top third is a side-view scene where Little Red Riding Hood holding a sword faces the Big Bad Wolf on a forest path; below it a slot reel grid of exactly 5 columns and 4 rows inside a frame, with a row of four small multiplier badges "x1 x2 x3 x5" on the top edge of the frame; a "Feature Buy" plaque under the frame; three info panels "BALANCE", "BET" and "WIN"; a control row with a TURBO button, a minus button, a big round spin button, a plus button, an AUTO button and a menu button. Keep that layout but restyle everything completely into a bright sunlit storybook fairy tale, nothing dark or gloomy.';
const SB_MOCKUP_PARTS = 'Little Red Riding Hood: a friendly semi-realistic cartoon girl with big expressive eyes, rosy cheeks and a short brown bob, a crimson hooded cape, holding a short silver sword, a brave confident smile. The Big Bad Wolf: a big shaggy grey-brown cartoon wolf, mischievous and a little goofy rather than scary. Symbols: 10 J Q K A as big glossy jewel-colored 3D letters in sapphire, emerald, amethyst, topaz and ruby; picture symbols as framed square tiles: the wolf head, a black raven, an old oil lantern, a heart-shaped potion bottle and a basket of red apples; a golden key as the SCATTER; the girl\'s portrait in a glowing gold frame with the word WILD. Buttons: polished gold rings around warm wood centers; the spin button is a glossy ruby-red disc in a gold ring with golden arrows; the info panels are wooden plaques with gold trim and parchment insets. Bright, warm and inviting overall. All text in English.';

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
  // 2026-10 繪本奇幻改版：版面照舊設計稿 r-ref，風格整套換成白天的童話繪本。先畫兩張整頁設計稿（A 白天羊皮紙格、B 黃昏深綠格）選方向
  {
    name: 's-ref-a', w: 768, h: 1376, refs: [['r-ref', 'LOW']],
    prompt: `${SB_STYLE} ${SB_MOCKUP} Scene: a sunny enchanted forest path in the middle of the day, golden light beams falling through tall leafy trees, wildflowers, ferns and red-capped mushrooms, grandmother's cozy cottage with a red roof and a smoking chimney in the distance. Reel frame: carved warm honey-colored wood wrapped with green ivy vines, leaves and little flowers, with an apple basket, candles and mushrooms decorating the corners. Reel tiles: soft cream parchment squares with a thin worn edge. ${SB_MOCKUP_PARTS}`,
  },
  {
    name: 's-ref-b', w: 768, h: 1376, refs: [['r-ref', 'LOW']],
    prompt: `${SB_STYLE} ${SB_MOCKUP} Scene: the same storybook forest path in the late afternoon golden hour, warm orange sunlight slanting low between the tree trunks, long soft shadows, fireflies starting to glow, wildflowers and mushrooms, grandmother's cozy cottage with warm lit windows in the distance. Reel frame: carved rich walnut wood with gold leaf filigree, wrapped with green ivy vines, leaves and small white flowers, with an apple basket, candles and mushrooms decorating the corners. Reel tiles: deep emerald-green panels with a faint embossed leaf pattern and a thin gold edge. ${SB_MOCKUP_PARTS}`,
  },
  // 使用者選了 A：以下整套照 s-ref-a 畫。小紅帽與大野狼從 A 裁出來當長相參考
  { name: 's-ref-hero', upload: 's-ref-hero.jpg' },
  { name: 's-ref-wolf', upload: 's-ref-wolf.jpg' },
  // 自走區：白天的森林小路（遠景固定、近景捲動）、拿短劍的小紅帽（架式、跑、揮砍）、滑稽的大野狼
  {
    name: 's-hero-stance', w: 1024, h: 1024, refs: [['s-ref-hero', 'HIGH'], ['s-ref-a', 'LOW']], cut: true,
    prompt: `${SB_STYLE} Full-body character art of exactly the same girl as in the first reference image, same face, same hairstyle, same outfit, same storybook rendering: ${SB_HERO}. A brave ready-to-fight stance in side view facing right: feet apart, front knee slightly bent, the sword held forward and up toward the right, her free arm back for balance, the cape swinging behind her. ${ISOLATED}`,
  },
  {
    name: 's-hero-run', w: 1024, h: 1024, refs: [['s-hero-stance', 'MID'], ['s-ref-hero', 'LOW']], cut: true,
    prompt: `${SB_STYLE} The same girl as in the first reference image, same face, same hairstyle, same outfit, same sword, same storybook rendering: ${SB_HERO}. Full body sprinting to the right at full speed in side view: upper body leaning forward, front leg reaching forward, back leg kicked up behind her off the ground, her free arm swinging forward, the sword held low and pointing backward in her trailing hand, the cape and hood streaming behind her in the wind. A clear running stride, not a fighting stance. ${ISOLATED}`,
  },
  {
    name: 's-hero-slash', w: 1024, h: 1024, refs: [['s-hero-stance', 'HIGH'], ['s-ref-hero', 'MID']], cut: true,
    prompt: `${SB_STYLE} The same girl as in the first reference image, same face, same hairstyle, same outfit, same sword, same storybook rendering: ${SB_HERO}. Full body lunging forward to the right in the middle of a powerful horizontal sword slash, the sword arm fully extended to the right, front knee bent, a determined face, the cape whipping behind her. ${ISOLATED} No motion blur.`,
  },
  {
    name: 's-wolf', w: 1024, h: 1024, refs: [['s-ref-wolf', 'HIGH'], ['s-ref-a', 'LOW']], cut: true,
    prompt: `${SB_STYLE} Full-body art of exactly the same wolf as in the first reference image, same face, same fur, same storybook rendering: ${SB_WOLF}. He stands hunched on his hind legs in side view facing left, leaning forward with his clawed paws raised, ready to pounce, the bushy tail behind him. ${ISOLATED}`,
  },
  {
    name: 's-scene', w: 1376, h: 768, refs: [['s-ref-a', 'MID']],
    prompt: `${SB_STYLE} Wide background plate for the top area of a vertical mobile slot game, matching the scenery of the reference image: a sunny enchanted forest clearing in the middle of the day, golden light beams falling through tall leafy trees, a winding dirt path leading to grandmother's cozy thatched cottage with a smoking chimney in the middle distance, wildflowers, ferns and red-capped white-spotted mushrooms. Big leafy tree trunks frame the far left and far right edges; the foreground is a sunny grassy forest floor with flowers, small rocks and roots. No characters, no animals, no people, no text, no UI.`,
  },
  {
    name: 's-far', w: 1376, h: 768, refs: [['s-scene', 'HIGH']],
    prompt: `${SB_STYLE} The far background layer of the reference scene only, for a parallax game: the same sunny sky and light beams, the same distant leafy forest, the same cottage with the smoking chimney, the same wildflowers. Remove the big tree trunks on the far left and far right and all foreground rocks, roots and mushrooms; the grassy clearing and the dirt path continue down to the bottom edge. Same lighting and colors. No characters.`,
  },
  {
    name: 's-near', w: 1376, h: 768, refs: [['s-scene', 'MID']],
    prompt: `Foreground layer for a side-scrolling parallax game, in the same painterly storybook style, colors and sunny lighting as the reference image. Only three things are painted: one big leafy tree trunk with green foliage and a few branches at the far left edge, one big leafy tree trunk at the far right edge, and a strip of sunny grassy forest floor along the bottom fifth of the image with ferns, small rocks, roots, yellow and white wildflowers and red-capped mushrooms. Everything else, the whole center and upper area, is flat solid pure magenta (#FF00FF). No pink, purple or magenta flowers or objects anywhere. No cottage, no path, no distant trees, no sky, no light beams. No gradients or glow on the magenta. No text.`,
  },
  // 轉輪：圖案符號是木框圖塊（整塊直接用）、金鑰匙與字母放在羊皮紙磚上（去背）、第 8 塊空白羊皮紙當格子的底
  {
    name: 's-symbols', w: 1376, h: 768, refs: [['s-ref-a', 'MID'], ['s-hero-stance', 'MID']],
    prompt: `${SB_STYLE} A sprite sheet of eight separate square slot-game symbol tiles in the style of the symbol tiles in the first reference image, arranged in a neat grid of exactly 4 columns and 2 rows on a plain flat solid dark charcoal background, with wide dark gaps between the tiles. Every tile is a perfect square with sharp straight edges, completely filled edge to edge; tiles never touch or overlap. Row 1, left to right: 1) the head of the goofy grey-brown storybook wolf with a toothy mischievous grin in three-quarter view facing left, on a soft sky-blue background inside a carved honey-wood picture frame; 2) a black raven with a shiny eye perched on a leafy branch, on a fresh spring-green background inside a carved honey-wood picture frame; 3) an old brass oil lantern with a warm glowing flame, on a deep forest-green background inside a carved honey-wood picture frame; 4) a heart-shaped glass potion bottle filled with glowing ruby-red liquid and a cork stopper, on a soft lilac background inside a carved honey-wood picture frame. Row 2: 5) a wicker basket full of shiny red apples with a checkered cloth, on a warm golden-yellow background inside a carved honey-wood picture frame; 6) an ornate antique golden key with a red ribbon lying diagonally on a plain soft cream parchment tile; 7) a portrait of the girl from the second reference image (same face, crimson hood, short brown bob, storybook rendering) on a warm ruby-red background inside an ornate glowing gold frame, her face in the upper three quarters of the tile, the bottom quarter plain red; 8) an empty soft cream parchment tile with a thin worn darker edge and nothing on it. No text anywhere.`,
  },
  {
    name: 's-royals', w: 1376, h: 768, refs: [['s-ref-a', 'MID'], ['s-symbols', 'LOW']],
    prompt: `${SB_STYLE} Five separate square slot-game symbol tiles exactly in the style of the letter tiles in the first reference image, in a single evenly spaced horizontal row on a plain flat solid dark charcoal background, with wide dark gaps; tiles never touch. Each tile is a perfect square filled edge to edge with soft cream parchment and a thin worn darker edge. On each tile one big bold glossy 3D serif character with beveled edges, a thin dark outline and soft highlights, filling most of the tile, left to right: "10" in sapphire blue, "J" in emerald green, "Q" in amethyst purple, "K" in golden topaz orange, "A" in ruby red. No other text, no leaves, no decorations.`,
  },
  {
    name: 's-frame', w: 1152, h: 928, refs: [['s-ref-a', 'LOW']],
    prompt: `${SB_STYLE} A front-facing rectangular slot machine reel frame matching the reel frame in the reference image, on a plain flat solid white background, filling almost the whole image. The border is about one twenty-fifth of the image width: carved warm honey-colored wood with a fine polished gold inner trim line, wrapped evenly all the way around with green ivy vines, small leaves and tiny yellow flowers; at the four corners carved wooden corner pieces with a small cluster of leaves, yellow flowers and red berries. The large rectangular opening inside is flat solid pure black and completely empty: no symbols, no grid, no reels. Perfectly symmetric, straight-on view, no perspective, no text.`,
  },
  // 介面零件與圖示（深灰底，程式挖空；羊皮紙與淺色木頭在淺灰底上挖不乾淨）、標題字、底部背景
  {
    name: 's-ui', w: 1024, h: 1024, refs: [['s-ref-a', 'MID']],
    prompt: `${SB_STYLE} A game UI asset sheet matching the buttons and panels of the reference image, on a plain flat solid dark charcoal-grey background; every element is isolated with wide empty space around it, nothing touches or overlaps, front view, no text. Exactly four elements: 1) top left, large: a round spin button like the reference, a glossy ruby-red disc inside a thick ornate polished gold ring, the red center is completely empty with no arrows and no symbol; 2) top right, small: a round button frame, a polished gold ring around a flat empty warm honey-wood center; 3) middle, wide: a horizontal button plaque like the Feature Buy button in the reference, a rounded carved warm wooden plaque with an ornate gold border and gold scroll flourishes on both ends, empty inside; 4) bottom, wide: an info panel frame like the balance panel in the reference, a wide rectangle of warm brown wood with a thin gold border, small gold filigree corners and a flat empty darker wood inset, empty inside.`,
  },
  {
    name: 's-icons', w: 1024, h: 1024, refs: [['s-ref-a', 'MID']],
    prompt: `${SB_STYLE} Four separate game icons in the style of the icons in the reference image, arranged in a 2 by 2 grid on a plain flat solid dark charcoal-grey background with wide empty space between them, nothing touches, front view, no shadows on the background: top left, a brown leather wallet with a gold clasp; top right, a neat stack of shiny gold coins; bottom left, a golden "WIN" badge with ornate gold edges and the word WIN in bold red letters; bottom right, a single shiny gold coin with an embossed star.`,
  },
  {
    name: 's-logo', w: 1376, h: 768, refs: [['s-ref-a', 'HIGH']], cut: true,
    prompt: `${SB_STYLE} The "Red Riding Hood" game title logo from the top left of the reference image, isolated and centered, large: the words "Red", "Riding" and "Hood" stacked on three lines in a warm storybook serif with glossy ruby-red letters, cream highlights and a dark brown outline, decorated with green leaves, little pink and white flowers and a curling vine, exactly like the reference. On a plain flat solid light-grey background, nothing else.`,
  },
  // BIG WIN 演出的三級標題字（跟 s-logo 同一種字風，去背）
  {
    name: 's-title-big', w: 1376, h: 768, refs: [['s-logo', 'MID'], ['s-ref-a', 'LOW']], cut: true,
    prompt: `${SB_STYLE} Slot game win title artwork: the words "BIG WIN" on one line in huge bold glossy 3D storybook letters of polished gold with beveled edges and bright highlights, a thick dark brown outline, green ivy leaves, little flowers and a few shiny red apples tucked around the letters and a few sparkles, in the lettering style of the "Red Riding Hood" logo in the first reference image. Centered, filling most of the width, on a plain flat solid light-grey background, nothing else, exactly the words BIG WIN and no other text.`,
  },
  {
    name: 's-title-mega', w: 1376, h: 768, refs: [['s-title-big', 'HIGH']], cut: true,
    prompt: `${SB_STYLE} The same win title style as the reference image, same glossy gold storybook lettering, same dark brown outline, leaves, flowers and apples, but the words "MEGA WIN" on one line, richer: glowing ruby gems set into the gold letters and a small golden crown of leaves above the middle of the word. Centered, on a plain flat solid light-grey background, nothing else, exactly the words MEGA WIN and no other text.`,
  },
  {
    name: 's-title-super', w: 1376, h: 768, refs: [['s-title-mega', 'HIGH']], cut: true,
    prompt: `${SB_STYLE} The same win title style as the reference image, same glossy gold storybook lettering with ruby gems, dark brown outline, leaves, flowers, apples and golden leaf crown, but two lines: the word "SUPER" smaller on top and "MEGA WIN" large below, the most luxurious version with golden leafy wings spreading from both sides and extra sparkles. Centered, on a plain flat solid light-grey background, nothing else, exactly the words SUPER MEGA WIN and no other text.`,
  },
  // MEGA、SUPER MEGA 第一版字上鑲了太多紅寶石、MEGA 和 WIN 黏在一起：照 BIG WIN 的字風重畫，不要寶石
  {
    name: 's-title-mega2', w: 1376, h: 768, refs: [['s-title-big', 'HIGH']], cut: true,
    prompt: `${SB_STYLE} The same win title style as the reference image, same glossy polished gold storybook lettering with beveled edges, same thick dark brown outline, green ivy leaves, little flowers and a few shiny red apples tucked around the letters, but the words "MEGA WIN" on one line with a clear wide space between MEGA and WIN, and a small golden crown of leaves above the middle of the word. Plain solid gold letters: no gems, no jewels, no rubies, no stones set into the letters. Centered, on a plain flat solid light-grey background, nothing else, exactly the words MEGA WIN and no other text.`,
  },
  {
    name: 's-title-super2', w: 1376, h: 768, refs: [['s-title-mega2', 'HIGH']], cut: true,
    prompt: `${SB_STYLE} The same win title style as the reference image, same glossy polished gold storybook lettering, dark brown outline, ivy leaves, little flowers, red apples and small golden leaf crown, but two lines: the word "SUPER" smaller on top and "MEGA WIN" large below with a clear wide space between MEGA and WIN, the most luxurious version with golden leafy wings spreading from both sides and a few extra sparkles. Plain solid gold letters: no gems, no jewels, no rubies, no stones anywhere. Centered, on a plain flat solid light-grey background, nothing else, exactly the words SUPER MEGA WIN and no other text.`,
  },
  // 補動作：出刀前的蓄力、跳起往上砍（升龍斬、落地重劈、打倒狼時的歡呼都用這張）；大野狼被打到的受擊
  {
    name: 's-hero-windup', w: 1024, h: 1024, refs: [['s-hero-stance', 'HIGH'], ['s-ref-hero', 'MID']], cut: true,
    prompt: `${SB_STYLE} The same girl as in the first reference image, same face, same hairstyle, same outfit, same sword, same storybook rendering: ${SB_HERO}. Full body in side view facing right, winding up for a big sword strike: weight on the back foot, knees bent, upper body twisted back, the sword pulled far back behind her shoulder in both hands ready to swing forward, a determined face, the cape swinging forward around her. ${ISOLATED}`,
  },
  {
    name: 's-hero-jump', w: 1024, h: 1024, refs: [['s-hero-stance', 'HIGH'], ['s-ref-hero', 'MID']], cut: true,
    prompt: `${SB_STYLE} The same girl as in the first reference image, same face, same hairstyle, same outfit, same sword, same storybook rendering: ${SB_HERO}. Full body leaping high into the air toward the right in side view, both feet off the ground with the knees tucked up, swinging the sword upward in a rising slash high above her head, the cape fluttering below and behind her, a fierce happy face. ${ISOLATED}`,
  },
  // 跑步第二格：只換腳（另一隻腳在前），腰以上跟第一格一樣，兩張輪流就是跑步循環
  {
    name: 's-hero-run2', w: 1024, h: 1024, refs: [['s-hero-run', 'HIGH'], ['s-ref-hero', 'MID']], cut: true,
    prompt: `${SB_STYLE} The next frame of the same running cycle as the first reference image: exactly the same girl, same face, same outfit, same sword, same storybook rendering, same size and framing, sprinting to the right in side view with the same forward lean. Only the legs change: the leg that was behind now swings forward with the knee up, and the leg that was in front now pushes off far behind her with the foot off the ground. Everything above the waist stays like the reference: same arms, same hand holding the sword low and pointing backward, same streaming cape and hood. ${ISOLATED}`,
  },
  // run2 畫出來跟第一格幾乎一樣（腳沒換），改畫跑步循環裡差最多的「過渡姿勢」也一樣（參考圖調到 MID 還是照抄）：兩張都沒用，
  // 跑步維持一格、動作用程式做（著地壓扁、揚起塵土）
  {
    name: 's-hero-pass', w: 1024, h: 1024, refs: [['s-hero-run', 'MID'], ['s-ref-hero', 'LOW']], cut: true,
    prompt: `${SB_STYLE} The same girl as in the first reference image, same face, same hairstyle, same outfit, same sword, same storybook rendering: ${SB_HERO}. Full body running to the right in side view, caught in the passing pose of a run cycle: her supporting leg is straight with the foot flat on the ground directly under her hips, the other knee is lifted high in front of her with that foot tucked up under her skirt, the body is upright and slightly higher than in a stride. Her arms and sword stay like the reference: the sword held low in her trailing hand pointing backward, the free arm bent in front, the cape and hood streaming behind her. Clearly a different leg position from the reference image. ${ISOLATED}`,
  },
  // 改成一張圖畫完整個循環（同一張圖裡角色才會一致、腳才會真的不同）：小紅帽跑步 4 格、大野狼走進場 4 格，整張去背後再切
  {
    name: 's-hero-runsheet', w: 1376, h: 768, refs: [['s-hero-stance', 'MID'], ['s-ref-hero', 'MID']], cut: true,
    prompt: `${SB_STYLE} A sprite sheet for a 2D side-scrolling game: exactly four frames of one complete running cycle of the same girl as in the reference images (same face, same hairstyle, same outfit, same sword, same storybook rendering): ${SB_HERO}. The four frames stand in a single evenly spaced horizontal row with wide empty gaps between them, every frame the same size and drawn at the same scale on the same ground line, all in side view facing right, sprinting to the right with a forward lean, the sword held low in her trailing hand pointing backward, the cape and hood streaming behind her. Only the legs and the free arm change, in this order: 1) her right leg reaches forward and its heel touches the ground, the left leg pushes off far behind; 2) passing: the right leg straight under her hips carrying her weight, the left knee lifted high in front; 3) her left leg reaches forward and its heel touches the ground, the right leg pushes off far behind; 4) passing: the left leg straight under her hips, the right knee lifted high in front. Nothing overlaps, on a plain flat solid light-grey background, no ground, no shadows, no text, no numbers.`,
  },
  {
    name: 's-wolf-walksheet', w: 1376, h: 768, refs: [['s-wolf', 'MID'], ['s-ref-wolf', 'MID']], cut: true,
    prompt: `${SB_STYLE} A sprite sheet for a 2D side-scrolling game: exactly four frames of one complete walking cycle of the same wolf as in the reference images (same face, same fur, same storybook rendering): ${SB_WOLF}. The four frames stand in a single evenly spaced horizontal row with wide empty gaps between them, every frame the same size and drawn at the same scale on the same ground line, all in side view facing left, the wolf walking to the left on his hind legs, hunched forward with his clawed front paws raised, a sly grin, the bushy tail behind him. Only the legs and paws change, in this order: 1) his left hind leg steps forward onto its heel, the right leg behind; 2) passing: the left leg straight under him, the right knee lifted; 3) his right hind leg steps forward onto its heel, the left leg behind; 4) passing: the right leg straight under him, the left knee lifted. Nothing overlaps, on a plain flat solid light-grey background, no ground, no shadows, no text, no numbers.`,
  },
  {
    name: 's-wolf-hurt', w: 1024, h: 1024, refs: [['s-wolf', 'HIGH'], ['s-ref-wolf', 'MID']], cut: true,
    prompt: `${SB_STYLE} Full-body art of exactly the same wolf as in the first reference image, same face, same fur, same storybook rendering: ${SB_WOLF}. He stands on his hind legs in side view facing left, and has just been hit: recoiling backward to the right off balance, upper body leaning back, eyes squeezed shut in a comical pained grimace, tongue sticking out, ears flattened, front paws flailing in the air, fur puffed out. A funny cartoon hit reaction, not gory, no blood, no wounds. ${ISOLATED}`,
  },
  {
    name: 's-floor', w: 768, h: 1376, refs: [['s-ref-a', 'LOW']],
    prompt: `${SB_STYLE} A vertical background texture for the bottom half of a mobile slot game screen, like the bottom of the reference image: warm honey-brown wooden planks seen from the front across the middle and top, a sunny grassy forest floor along the bottom edge with ferns, wildflowers and red-capped mushrooms, soft warm sunlight from above, gentle vignette, calm and low-contrast so buttons stay readable. Absolutely no frames, no panels, no boxes, no buttons, no rectangles, no borders, no UI, no text, no characters.`,
  },
];

// 2026-10 怪物多樣化（照小紅帽劇本）：每關兩種被大野狼使喚的森林動物 + 那段劇情的狼，第 5 隻是假扮外婆的大灰狼。
// 每隻畫站姿、受擊、走路 4 格（一張圖畫完整個循環再切開），都去背；王另外畫一張露餡的站姿
const MONSTERS = [
  ['squirrel', 'a mischievous little red squirrel, one of the Big Bad Wolf\'s forest minions, with a huge bushy tail, big buck teeth and a cheeky scheming grin, standing on its hind legs and clutching a pinecone ready to throw', 'hopping forward on its hind legs'],
  ['hedgehog', 'a grumpy round little hedgehog, one of the Big Bad Wolf\'s forest minions, with a coat of brown spines, a pointy pink snout, a frowning face and tiny clawed paws, standing on its hind legs', 'scurrying forward on its tiny hind legs'],
  ['fox', 'a sly slender orange fox, one of the Big Bad Wolf\'s forest minions, with a big white-tipped bushy tail, narrow scheming eyes and a sneaky smile, standing on its hind legs', 'trotting forward on its hind legs'],
  ['badger', 'a stocky grumpy badger, one of the Big Bad Wolf\'s forest minions, with a black-and-white striped face, grey fur, big digging claws and a scowl, standing on its hind legs', 'waddling forward on its short hind legs'],
  ['raven', 'a big black raven, the Big Bad Wolf\'s spy, with glossy blue-black feathers, a sharp beak and a sly glaring eye, hovering in mid-air with its wings spread wide', 'flying forward with its wings flapping: wings raised high, wings level, wings swept down, wings level'],
  // 花田的大隻：原本是紳士狼（太醜，換掉），改成抱著蜂蜜罐的大棕熊
  ['bear', 'a big burly brown bear, one of the Big Bad Wolf\'s forest minions, with thick shaggy brown fur, small round ears, a big round belly, a sticky honey pot hugged under one arm with honey dripping, and a grumpy greedy scowl, standing upright on his hind legs', 'lumbering forward on his hind legs'],
  ['boar', 'a big hairy wild boar, one of the Big Bad Wolf\'s forest minions, with dark brown bristly fur, curved white tusks, a big snout and an angry glare, standing on all four legs', 'trotting forward on all four legs'],
  // 花田的中隻：原本是獾（辨識度不高，換掉），改成長耳朵、扛著紅蘿蔔的野兔
  ['hare', 'a cheeky big brown hare, one of the Big Bad Wolf\'s forest minions, with very long upright ears, big hind feet, a fluffy white tail, buck teeth and a smug mischievous grin, carrying a big orange carrot over his shoulder like a club, standing upright on his hind legs', 'hopping forward on his big hind feet'],
  // 每關改成 3 種小動物（關卡 7 隻），再補三種一眼就認得的：林間小路的浣熊、花田的青蛙、外婆家門口的老鼠
  ['raccoon', 'a mischievous little raccoon, one of the Big Bad Wolf\'s forest minions, with a black bandit mask around his eyes, a big ringed striped tail, grey fur, tiny clever paws and a sneaky grin, holding a stolen shiny red apple, standing upright on his hind legs', 'sneaking forward on his hind legs'],
  ['frog', 'a chubby green frog, one of the Big Bad Wolf\'s forest minions, with big round golden eyes, a wide cheeky grin, a pale yellow belly and long webbed back legs, squatting upright', 'hopping forward: crouched, leaping up with legs stretched, in mid-air, landing crouched'],
  ['mouse', 'a sneaky little grey mouse from Grandma\'s cottage, one of the Big Bad Wolf\'s minions, with big round pink ears, a long thin tail, twitchy whiskers and a greedy grin, hugging a big wedge of yellow cheese, standing upright on his hind legs', 'scurrying forward on his hind legs'],
  // 第 2 關 BOSS：原本是外婆家門口的大隻（只留動物，換掉披紅斗篷敲門的狼），後來改成第 2 關 BOSS 的大雄鹿
  ['stag', 'a big proud grumpy red stag, one of the Big Bad Wolf\'s forest minions, with huge branching antlers, a shaggy neck mane, a reddish-brown coat with a pale belly and a stubborn haughty glare, standing on all four legs with his head lowered ready to charge', 'walking forward on all four legs with a proud stride'],
];
const WOLVES = [
  ['boss', 'exactly the same wolf as in the reference image, disguised as Grandma: a white frilly nightcap with his big ears poking out, small round spectacles on his snout, a pink knitted lace shawl over a long flowery nightgown, a sugary fake-sweet smile showing a hint of big teeth, standing hunched on his hind legs'],
];
// 第一批的受擊寫了「被劍打到」，有幾張就把劍畫進去了：之後的都明確不要武器
const HURT = 'It has just been hit: recoiling backward to the right off balance, eyes squeezed shut in a comical pained grimace, arms or paws flailing. A funny cartoon hit reaction, not gory, no blood, no wounds. Only the character: no sword, no weapon, no blade, nothing else.';
const SHEET = (desc, gait) => `${SB_STYLE} A sprite sheet for a 2D side-scrolling game: exactly four frames of one complete walking cycle of the same character as in the reference images (same face, same colors, same outfit, same storybook rendering): ${desc}. The four frames stand in a single evenly spaced horizontal row with wide empty gaps between them, every frame the same size and drawn at the same scale on the same ground line, all in side view facing left, ${gait}. Only the legs, paws or wings change between frames, a clear alternating cycle. Nothing overlaps, on a plain flat solid light-grey background, no ground, no shadows, no text, no numbers.`;
for (const [id, desc, gait] of MONSTERS) {
  JOBS.push(
    { name: `s-m-${id}`, w: 1024, h: 1024, refs: [['s-wolf', 'LOW'], ['s-ref-a', 'LOW']], cut: true,
      prompt: `${SB_STYLE} Full-body character art in the same storybook style and rendering as the Big Bad Wolf in the first reference image: ${desc}. Side view facing left, a cute but naughty storybook villain, not scary. ${ISOLATED}` },
    { name: `s-m-${id}-hurt`, w: 1024, h: 1024, refs: [[`s-m-${id}`, 'HIGH']], cut: true,
      prompt: `${SB_STYLE} Full-body art of exactly the same character as in the reference image, same face, same colors, same storybook rendering: ${desc}. Side view facing left. ${HURT} ${ISOLATED}` },
    { name: `s-m-${id}-walk`, w: 1376, h: 768, refs: [[`s-m-${id}`, 'MID']], cut: true, prompt: SHEET(desc, gait) },
  );
}
for (const [id, desc] of WOLVES) {
  JOBS.push(
    { name: `s-m-${id}`, w: 1024, h: 1024, refs: [['s-wolf', 'HIGH'], ['s-ref-wolf', 'MID']], cut: true,
      prompt: `${SB_STYLE} Full-body art in the same storybook rendering as the reference image: ${desc}. Side view facing left. ${ISOLATED}` },
    { name: `s-m-${id}-hurt`, w: 1024, h: 1024, refs: [[`s-m-${id}`, 'HIGH']], cut: true,
      prompt: `${SB_STYLE} Full-body art of exactly the same character as in the reference image, same face, same clothes, same storybook rendering: ${desc}. Side view facing left. ${HURT} ${ISOLATED}` },
    { name: `s-m-${id}-walk`, w: 1376, h: 768, refs: [[`s-m-${id}`, 'MID']], cut: true, prompt: SHEET(desc, 'walking forward on his hind legs') },
  );
}
// 待機 2：玩家一陣子沒轉時，小紅帽站在原地耍一段劍花（4 格，切法跟跑步一樣）
JOBS.push({
  name: 's-hero-twirl', w: 1376, h: 768, refs: [['s-hero-stance', 'MID'], ['s-ref-hero', 'MID']], cut: true,
  prompt: `${SB_STYLE} A sprite sheet for a 2D side-scrolling game: exactly four frames of one sword-twirling flourish by the same girl as in the reference images (same face, same hairstyle, same outfit, same short silver sword, same storybook rendering): ${SB_HERO}. The four frames stand in a single evenly spaced horizontal row with wide empty gaps between them, every frame the same size and drawn at the same scale on the same ground line, all in side view facing right, standing in place with a playful confident smile, twirling the sword in one hand like a show-off: 1) the sword held up vertically in front of her face; 2) the sword spinning flat in front of her chest with a curved silver motion trail; 3) the sword swung around behind her back over her shoulder; 4) a finishing pose with the sword pointed forward to the right and her free hand on her hip, the cape swirling. Nothing overlaps, on a plain flat solid light-grey background, no ground, no shadows, no text, no numbers.`,
});
// 熊和雄鹿的受擊第一版畫進了一把劍：重畫，明確不要武器
for (const [id, desc] of MONSTERS.filter(([id]) => id === 'bear' || id === 'stag')) {
  JOBS.push({ name: `s-m-${id}-hurt2`, w: 1024, h: 1024, refs: [[`s-m-${id}`, 'HIGH']], cut: true,
    prompt: `${SB_STYLE} Full-body art of exactly the same character as in the reference image, same face, same colors, same storybook rendering: ${desc}. Side view facing left. It has just been hit: recoiling backward to the right off balance, eyes squeezed shut in a comical pained grimace, paws or legs flailing. A funny cartoon hit reaction, not gory, no blood, no wounds. Only the character: no sword, no weapon, no blade, no motion lines, no stars, nothing else. ${ISOLATED}` });
}
JOBS.push(
  { name: 's-m-boss-reveal', w: 1024, h: 1024, refs: [['s-m-boss', 'HIGH']], cut: true,
    prompt: `${SB_STYLE} Full-body art of exactly the same wolf in Grandma's clothes as in the reference image, same storybook rendering, side view facing left, but now the disguise falls apart: the nightcap knocked askew, the spectacles flying off, the shawl slipping off his shoulders, his huge eyes and huge toothy jaws wide open in a fierce comical roar, claws raised. Not gory. ${ISOLATED}` },
  // 第 2、3 關的背景（照故事：狼騙小紅帽去採花的花田、傍晚的外婆家門口），一樣拆成遠景與洋紅底的近景
  { name: 's-scene2', w: 1376, h: 768, refs: [['s-scene', 'MID']],
    prompt: `${SB_STYLE} Wide background plate for the top area of a vertical mobile slot game, in exactly the same painterly style as the reference image: a sunny flower meadow clearing deep in the enchanted forest in warm afternoon light, carpets of red poppies, white daisies and bluebells, butterflies, a winding dirt path through the flowers, soft light beams. Big leafy tree trunks frame the far left and far right edges; the foreground is grass full of flowers. No characters, no animals, no people, no text, no UI.` },
  { name: 's-far2', w: 1376, h: 768, refs: [['s-scene2', 'HIGH']],
    prompt: `${SB_STYLE} The far background layer of the reference scene only, for a parallax game: the same sky and light beams, the same distant trees, the same flower meadow and path. Remove the big tree trunks on the far left and far right and the foreground grass; the meadow and the path continue down to the bottom edge. Same lighting and colors. No characters.` },
  { name: 's-near2', w: 1376, h: 768, refs: [['s-scene2', 'MID']],
    prompt: `Foreground layer for a side-scrolling parallax game, in the same painterly storybook style, colors and warm afternoon lighting as the reference image. Only three things are painted: one big leafy tree trunk with green foliage at the far left edge, one big leafy tree trunk at the far right edge, and a strip of grass along the bottom fifth of the image full of red poppies, white daisies and yellow flowers. Everything else, the whole center and upper area, is flat solid pure magenta (#FF00FF). No pink, purple or magenta flowers anywhere. No path, no distant trees, no sky, no light beams. No gradients or glow on the magenta. No text.` },
  { name: 's-scene3', w: 1376, h: 768, refs: [['s-scene', 'MID']],
    prompt: `${SB_STYLE} Wide background plate for the top area of a vertical mobile slot game, in exactly the same painterly style as the reference image: the end of the forest path at golden sunset, Grandma's cozy thatched cottage in the middle distance at the center with a round wooden front door, flower boxes under warm glowing windows, smoke curling from the chimney, a little white picket fence and a garden gate, a warm orange and pink sunset sky. Big leafy tree trunks frame the far left and far right edges; the foreground is a grassy garden path with flowers. No characters, no animals, no people, no text, no UI.` },
  { name: 's-far3', w: 1376, h: 768, refs: [['s-scene3', 'HIGH']],
    prompt: `${SB_STYLE} The far background layer of the reference scene only, for a parallax game: the same sunset sky, the same cottage with the glowing windows and smoking chimney, the same fence and garden. Remove the big tree trunks on the far left and far right and the foreground grass; the garden path continues down to the bottom edge. Same lighting and colors. No characters.` },
  { name: 's-near3', w: 1376, h: 768, refs: [['s-scene3', 'MID']],
    prompt: `Foreground layer for a side-scrolling parallax game, in the same painterly storybook style, colors and golden sunset lighting as the reference image. Only three things are painted: one big leafy tree trunk at the far left edge, one big leafy tree trunk at the far right edge, and a strip of grassy garden along the bottom fifth of the image with flowers and small stones. Everything else, the whole center and upper area, is flat solid pure magenta (#FF00FF). No pink, purple or magenta flowers anywhere. No cottage, no fence, no sky. No gradients or glow on the magenta. No text.` },
);
// EXTRA 模式（Free Spins）出場的寶箱怪：第一版畫成有大眼睛、舌頭、小短腿的擬人寶箱（太擬人，換掉），
// 改成一般的木頭寶箱，只有蓋子一開一合當嘴巴
const CHEST = 'a classic storybook treasure chest made of honey-colored wooden planks with polished gold metal bands, gold corner caps and a gold lock plate on the front, a domed lid, a pile of shining gold coins and colorful gems inside. It is an ordinary object, not a character: no face, no eyes, no tongue, no teeth, no arms, no legs';
JOBS.push(
  { name: 's-m-chest2', w: 1024, h: 1024, refs: [['s-ref-a', 'LOW']], cut: true,
    prompt: `${SB_STYLE} Full-body game art: ${CHEST}. Three-quarter side view with the front of the chest facing left, sitting flat on its bottom, the lid propped wide open toward the upper right like a gaping mouth, warm golden light glowing from the treasure inside. ${ISOLATED}` },
  { name: 's-m-chest2-hurt', w: 1024, h: 1024, refs: [['s-m-chest2', 'HIGH']], cut: true,
    prompt: `${SB_STYLE} Full-body game art of exactly the same treasure chest as in the reference image, same wood, same gold bands, same storybook rendering: ${CHEST}. Three-quarter side view with the front facing left. It has just been hit: the lid slammed shut, the whole chest tipped backward to the right off balance, resting on its back bottom corner. Only the chest: no loose coins, no motion lines, no stars, no sword, nothing else. ${ISOLATED}` },
  // 開合 4 格：第一版半開的兩格裡面是空的（只有全開那格有金幣），播起來一閃一閃，重畫成每格都裝滿
  { name: 's-m-chest2-walk2', w: 1376, h: 768, refs: [['s-m-chest2', 'MID']], cut: true,
    prompt: `${SB_STYLE} A sprite sheet for a 2D side-scrolling game: exactly four frames of the same treasure chest as in the reference image (same wood, same gold bands, same storybook rendering): ${CHEST}. The four frames stand in a single evenly spaced horizontal row with wide empty gaps between them, every frame the same size and drawn at the same scale sitting on the same ground line, all in three-quarter side view with the front facing left. Only the lid moves, chomping like a mouth: 1) lid shut, 2) lid half open, 3) lid wide open, 4) lid half open. The chest is always full of treasure: in every frame where the lid is open, even a little, the same heaped pile of shining gold coins and colorful gems is visible inside with the same warm golden glow. Nothing overlaps, no loose coins, on a plain flat solid light-grey background, no ground, no shadows, no text, no numbers.` },
);

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
