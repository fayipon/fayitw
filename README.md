# Motion Banner Lab — FAYI

圖片主視覺 banner 的動態層實驗台。一張平面主視覺圖，依畫面中主體的座標疊上光束、閃光、粒子與場景特效，再加上鏡頭推移、滑鼠視差、文字進場和五種轉場。每一層都能在頁面上單獨開關比較。

純 HTML / CSS / JavaScript，不需要 build，動畫由 [GSAP](https://gsap.com/) 驅動（從 jsDelivr CDN 載入）。

## 本機預覽

```bash
npm run dev
```

然後打開 <http://localhost:5173>。伺服器是零依賴的 Node 腳本（`scripts/serve.mjs`），不需要 `npm install`。

## 動態層

| 層 | 做法 |
|---|---|
| 鏡頭推移 | 停留期間整個場景以主體為中心放大 8%，特效跟著一起放大不會錯位 |
| 滑鼠視差 | 背景與文字往相反方向微移，只在滑鼠裝置啟用 |
| 光束光暈 | 主體後方光暈呼吸、光束擺動，screen 混合模式只提亮 |
| 場景特效 | 依圖片內容設計：底座光環、螢幕閃爍掃描線、漩渦旋轉 |
| 閃光 | 在寶石、霓虹星、水晶位置隨機閃出十字星芒 |
| 粒子 | Canvas 繪製，三種模式：上升、光斑漂浮、被漩渦吸入 |
| 掃光 | 斜光定期掃過畫面，接著掃過按鈕 |
| 文字進場 | 小標字距收合、標題遮罩上推、重點字流光、按鈕彈出 |

轉場：視差滑動、淡入推近、光圈展開（從主體中心擴散）、斜切掃過、百葉窗。

## 結構

```
index.html            實驗台頁面
css/style.css         頁面樣式與 MotionBanner 元件樣式
js/slides.js          每張 banner 的文案與特效座標
js/banner.js          MotionBanner 元件（輪播、轉場、動態層、粒子）
js/main.js            控制面板
assets/banners/       主視覺圖（960×436）
scripts/serve.mjs     本機靜態伺服器
scripts/deploy.ps1    部署腳本（主機用 -Server 指定）
Dockerfile            nginx 映像
docker/nginx.conf     nginx 設定（快取、gzip）
compose.yaml          容器設定
```

## 新增或替換一張 banner

在 `js/slides.js` 加一筆設定。所有座標都是原圖 960×436 的百分比：

```js
{
  id: 'crown',
  image: 'assets/banners/crown.webp',
  label: 'Welcome to your kingdom',
  title: ['Your world.', 'Your rules.'],   // 最後一行會套重點色與流光
  desc: 'Discover a world of play.',
  cta: 'Explore games',
  accent: '#c9f2a8',                       // 重點字顏色
  glow: 'rgba(121, 245, 170, .4)',         // 光暈顏色
  focus: { x: 73.8, y: 33 },               // 主體中心
  rays: { x: 73.8, y: -8, color: '…', angles: [-17, -10, -4, 2, 8, 15] },
  ring: { x: 73.6, y: 68.5, w: 44, h: 9 },
  glintColor: '#b9ffd6',
  glints: [[73.8, 11.5, 3.6], [73.8, 31.5]],   // [x, y, 大小(選填)]
  particles: { mode: 'rise', count: 46, area: [50, 97, 45, 96], colors: ['#ffd98a'] },
}
```

`rays`、`ring`、`screen`、`vortex` 都是選填，依圖片內容挑適合的。

## 使用元件

```js
const banner = new MotionBanner(document.querySelector('#hero'), MB_SLIDES, {
  transition: 'slide',   // slide | fade | iris | wipe | blinds
  layers: { kenburns: true, parallax: true, light: true, scene: true, glints: true, particles: true, sweep: true, copy: true },
});
```

## 注意

- 被 GSAP 動到的元素不要用 CSS `translate` / `rotate` 屬性定位。GSAP 會把它們換算成像素寫死，尺寸一變就錯位；置中請用 GSAP 的 `xPercent` / `yPercent`。
- 舞台同時用 `aspect-ratio` 和 `min-height` 時要明確給 `width: 100%`，否則最小高度會反推出過寬的最小寬度。

## 無障礙

- 系統開啟「減少動態效果」時不自動輪播、不播循環動畫，轉場改為短暫淡入。
- 輪播有暫停按鈕，滑鼠移入或鍵盤聚焦時自動暫停；支援左右方向鍵與手機左右滑動。
- 不在畫面內或分頁隱藏時，所有循環動畫與粒子都會停止。
