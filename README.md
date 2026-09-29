# Motion Banner Lab — FAYI

各頁面：

| 頁面 | 內容 |
|---|---|
| `index.html` | 首頁：所有頁面的入口，下方是圖片主視覺 banner 的動態層實驗台 |
| `teaser.html` | KUNKING 站點預告：絕區零式的角色登場預告（全英文），最後收在註冊 |
| `join.html` | 推廣頁（主要目的是註冊）：全站推廣動畫 + 熱門遊戲、活動、站點特色、極速充提、註冊 |
| `affiliate.html` | 遊戲介紹頁（推廣用）：精選輪播、每款遊戲的玩法與規格、遊戲庫、常見問題 |
| `trailer.html` | 極速賽馬的介紹動畫：Motion Graphic 分鏡中穿插實機錄影 |
| `slots.html` | 老虎機介紹動畫：同一套分鏡套用到每款遊戲，可切換遊戲 |

實驗台：一張平面主視覺圖，依畫面中主體的座標疊上光束、閃光、粒子與場景特效，再加上鏡頭推移、滑鼠視差、文字進場和五種轉場。每一層都能在頁面上單獨開關比較。

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
index.html            首頁（所有頁面入口 + 實驗台）
teaser.html           站點預告
join.html             推廣頁（註冊）
affiliate.html        遊戲介紹頁
trailer.html          賽馬介紹動畫頁
slots.html            老虎機介紹動畫頁
css/style.css         頁面樣式與 MotionBanner 元件樣式
css/affiliate.css     遊戲介紹頁樣式（介紹動畫頁也共用按鈕與頁首）
css/trailer.css       介紹動畫的播放器與 1280×720 分鏡樣式
css/slots.css         老虎機分鏡樣式
css/join.css          推廣頁與推廣動畫樣式
css/teaser.css        站點預告的分鏡樣式
js/slides.js          每張 banner 的文案與特效座標
js/banner.js          MotionBanner 元件（輪播、轉場、動態層、粒子）
js/main.js            控制面板
js/games.js           推廣連結、註冊連結設定與遊戲資料
js/site.js            推廣頁的站點資料：活動、特色、充提速度、註冊步驟
js/join-page.js       推廣頁的區塊內容
js/join-mg.js         推廣動畫的分鏡
js/teaser.js          站點預告的分鏡
js/affiliate.js       遊戲介紹頁（輪播、介紹切換、遊戲庫篩選）
js/mg-player.js       動畫播放器（縮放、段落、影片同步、自動播放、全螢幕），各動畫頁共用
js/trailer.js         賽馬介紹動畫的分鏡
js/slot-trailers.js   老虎機的遊戲資料與分鏡樣板
assets/banners/       主視覺圖（960×436）
assets/games/         遊戲方圖（500×500）與盃賽徽章
assets/clips/         介紹動畫用的實機錄影片段
assets/posters/       首頁入口卡片的縮圖（各頁實際畫面截圖，640×360）
assets/chars/         站點預告的角色圖（PG Soft 官網主視覺與去背貼紙）
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

## 遊戲介紹頁

- 推廣連結在 `js/games.js` 最上面的 `AFF_CONFIG.playUrl`，所有「立即遊玩」都連到這裡；個別遊戲可用 `url` 覆蓋。
- 有 `intro` 的遊戲會出現在精選輪播和遊戲介紹，其他只在遊戲庫。欄位說明寫在 `js/games.js` 的註解。
- `#game=<id>` 可以直接打開某款遊戲的介紹，例如 `affiliate.html#game=fortune-tiger`。
- RTP 與最高倍數是遊戲商公開的預設值，營運商可能用不同的 RTP 版本，上線前請以官方規格核對。

## 推廣頁（join.html）

- 頁面的主要行動是「立即註冊」：連結設定在 `js/games.js` 的 `AFF_CONFIG.registerUrl`（沒填就用 `playUrl`）。
- 推廣動畫（46 秒）：開場 → 熱門遊戲（實機快剪、遊戲牆、三款實機）→ 活動 → 站點特色 → 極速充提 → 立即註冊。
- 活動、特色、充提速度、註冊步驟都寫在 `js/site.js`，動畫和頁面區塊一起更新。**目前是範例文字**，上線前要改成站上實際的內容，不要寫出做不到的承諾。
- 瀏覽器同時播兩支以上影片會掉到 30fps，所以「三款實機」是先用 ffmpeg 把三段並排合成一支 `join-trio.mp4`，再由三個 canvas 各畫自己那一段。
- 粒子（金幣、火花）、數字、結尾的遊戲環都只依時間軸的時間計算，暫停、拖回去重看都一致。

## 站點預告（teaser.html）

- 40 秒、畫面文字全英文：開機 → PICK YOUR GAME → 6 張角色登場卡 → 電視牆實機 → KUNKING 原創賽馬 → 註冊。
- 風格參考絕區零（Zenless Zone Zero）：白底、大塊黑、螢光綠點綴、粗斜體窄字（Barlow Condensed）、塗鴉角色名（Sedgwick Ave Display）、貼紙、映像管電視、漫畫分格。
- 角色登場前有 3 格的反白剪影（衝擊畫面）；角色每秒抖動 12 次，做出手繪動畫的感覺。
- 角色圖來自 PG Soft 官網各遊戲頁的主視覺（`pgsoft.com/masthead/...`），壓成 WebP 放在 `assets/chars/`：`*-art.webp` 是原圖，`*-cut.webp` 是去背加白邊黑框的貼紙版。
- 同一時間只播一支影片；電視牆的三台與漫畫的三格都是從同一支影片用 canvas 畫不同區塊。

## 首頁入口

- `index.html` 最上面的「所有頁面」列出每一頁；新增頁面時在那裡加一張卡片，縮圖放在 `assets/posters/`。

## 介紹動畫

- 整支動畫是一條 GSAP 時間軸，畫布固定 1280×720 再等比縮放。段落、字卡、轉場都在 `js/trailer.js`。
- 實機片段跟著時間軸播放：暫停、跳段落、停格都會同步到影片。`VIDEOS` 設定每段影片在時間軸上的起訖與停格點。
- 片段來自賽馬遊戲的單機版（racehorse 專案），用瀏覽器錄下一整場比賽後，以 ffmpeg 剪成 H.264、`+faststart` 的 MP4。
- 影片跳段需要伺服器支援 HTTP Range：nginx 預設支援，本機的 `scripts/serve.mjs` 也已支援。
- 老虎機動畫（`slots.html`）是資料驅動：在 `js/slot-trailers.js` 的 `GAMES` 加一筆，給四段實機片段（一般玩法、免費遊戲觸發、免費遊戲、結算）和各段字卡出現的秒數，就會套用同一套分鏡。
- 實機片段只保留盤面，裁掉下方的操作列、餘額與遊戲商標誌。

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
