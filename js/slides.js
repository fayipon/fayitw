/* =========================================================
   Banner 設定：文案 + 特效位置
   所有座標都是「原圖 960×436 的百分比」，換圖時只要重新量主體位置。
   focus     主體中心：光暈位置、鏡頭推移的中心、光圈轉場的起點
   rays      光束光源（x, y）與每道光的角度
   ring      底座光環（中心 x, y，寬 w、高 h）
   screen    螢幕範圍（左上 x, y，寬 w、高 h）
   vortex    漩渦中心與直徑（size，佔圖寬 %）
   glints    閃光位置 [x, y, 大小(選填)]
   particles 粒子：rise 上升、bokeh 光斑、swirl 被吸入漩渦
   ========================================================= */
window.MB_SLIDES = [
  {
    id: 'crown',
    image: 'assets/banners/crown.webp',
    label: 'Welcome to your kingdom',
    title: ['Your world.', 'Your rules.'],
    desc: 'Discover a world of play.',
    cta: 'Explore games',
    accent: '#c9f2a8',
    glow: 'rgba(121, 245, 170, .4)',
    focus: { x: 73.8, y: 33 },
    rays: { x: 73.8, y: -8, color: 'rgba(190, 255, 215, .55)', angles: [-17, -10, -4, 2, 8, 15] },
    ring: { x: 73.6, y: 68.5, w: 44, h: 9 },
    glintColor: '#b9ffd6',
    glints: [[73.8, 11.5, 3.6], [73.8, 31.5, 4.6], [64.7, 39.4], [83.2, 39.4], [73.8, 48.9], [73.6, 80.7, 3.2], [55.1, 79], [91.9, 79]],
    particles: { mode: 'rise', count: 46, area: [50, 97, 45, 96], colors: ['#ffd98a', '#fff1c4', '#a6ffcc'] },
  },
  {
    id: 'arcade',
    image: 'assets/banners/arcade.webp',
    label: 'Find your next favorite',
    title: ['Great games.', 'All yours.'],
    desc: 'Find your next favorite.',
    cta: 'View picks',
    accent: '#f1b7ff',
    glow: 'rgba(236, 139, 255, .38)',
    focus: { x: 76.5, y: 38 },
    screen: { x: 68.6, y: 23, w: 16, h: 29.5 },
    glintColor: '#ffc4f4',
    glints: [[62, 37.4, 4], [89.2, 29.1, 3.6], [88.4, 51.8, 4.2], [56.3, 66.5, 4], [94.4, 46.6, 3]],
    particles: { mode: 'bokeh', count: 22, area: [42, 100, 0, 100], colors: ['#f1b7ff', '#c77dff', '#ff9ee6'] },
  },
  {
    id: 'portal',
    image: 'assets/banners/portal.webp',
    label: 'A new adventure awaits',
    title: ['New worlds.', 'Await you.'],
    desc: 'A new adventure starts here.',
    cta: 'Discover new',
    accent: '#8be9f4',
    glow: 'rgba(117, 234, 255, .38)',
    focus: { x: 74.8, y: 29 },
    vortex: { x: 74.8, y: 29, size: 11 },
    glintColor: '#c8fbff',
    glints: [[63.75, 36.7], [78.85, 54.6], [94.8, 56.2], [95, 68.3]],
    particles: { mode: 'swirl', count: 50, center: [74.8, 29], rMin: 5, rMax: 20, rEnd: 2.5, squash: 0.55, colors: ['#8be9f4', '#e3fdff', '#6ee7ff'] },
  },
];
