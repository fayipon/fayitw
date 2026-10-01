# Motion Banner Lab — FAYI

各頁面：

| 頁面 | 內容 |
|---|---|
| `index.html` | 首頁：所有頁面的入口卡片 |
| `lab.html` | Banner 實驗台：圖片主視覺 banner 的動態層，每一層都能開關比較 |
| `battle.html` | 戰鬥場景：原創動畫戰鬥短片，夜裡的石橋上術師對上操控紅綢的面具術士，畫面全由程式繪製 |
| `cat.html` | 貓抓蝴蝶：水墨短片，黑煙色緬因貓與發光的白蝴蝶，畫面全由程式繪製 |
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
index.html            首頁（所有頁面入口）
lab.html              Banner 實驗台
battle.html           戰鬥場景（動畫戰鬥短片）
cat.html              貓抓蝴蝶（水墨短片）
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
css/cat.css           貓抓蝴蝶頁面樣式
css/battle.css        戰鬥場景頁面樣式
js/slides.js          每張 banner 的文案與特效座標
js/banner.js          MotionBanner 元件（輪播、轉場、動態層、粒子）
js/main.js            實驗台控制面板
js/games.js           推廣連結、註冊連結設定與遊戲資料
js/site.js            推廣頁的站點資料：活動、特色、充提速度、註冊步驟
js/join-page.js       推廣頁的區塊內容
js/join-mg.js         推廣動畫的分鏡
js/teaser.js          站點預告的分鏡
js/affiliate.js       遊戲介紹頁（輪播、介紹切換、遊戲庫篩選）
js/battle-film.js     戰鬥場景的分鏡（石橋與迴廊的 3D 投影、角色、光束、紅綢、轉場）
js/film-post.js       影片後製（撮影）：canvas 畫好的畫面交給 WebGL 做光暈、光芒、衝擊波、色彩校正
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

## 戰鬥場景（battle.html）

- 25 秒、五段：對峙 → 交鋒 → 追擊 → 停頓 → 決著。角色（黑色鮑伯頭的術師、白瓷面具的紅綢術士）與場景都是原創；分鏡照使用者提供的動畫戰鬥片段分析出來的鏡頭語言排：
  - 動靜交替：快剪的動作之間插靜止長鏡頭（跪地抬頭、面具術士站著不動）
  - 閃白藏剪接（4.6、5.8、15.2、18.6 秒）、紅綢掃過鏡頭的遮擋轉場（9.4 秒）、甩鏡（11 秒）、光束衝進鏡頭（12.7 秒）
  - 鏡頭跟著光束搖、跟著光束飛（追逐鏡頭會隨轉彎側傾）、同軸跳接到眼睛與面具特寫、攻擊直接闖進靜止的畫面
  - 刷白溶接：光碎成花瓣、畫面變白，接到高調的淡藍色收尾，最後淡出
- 整支片畫在一張 canvas 上（`js/battle-film.js`），沒有圖片或影片素材：
  - 石橋與橋下迴廊是簡單的 3D 投影（`cam3` 有位置、yaw、pitch、roll，多邊形會依近平面裁切），推近、拉遠、俯瞰、轉到橋的側面都是真的鏡頭移動；遠景的石橋側面、城塔是 2D 繪製。
  - 角色有正面、背面、俯拍跪姿、側面靴子幾套畫法；紅綢是會翻面的緞帶（正面亮紅、背面暗紅），光束是三層疊加的發光線，可以帶 3D 的遠近粗細。
  - 角色與紅綢一秒 12 張（一拍二），鏡頭與光束維持流暢；角色與紅綢有深藍黑的線稿，粗細依縮放換算（遠景細、特寫粗）。
- 最後一道是撮影（`js/film-post.js`，WebGL）：2D canvas 畫好的每一格再做後製，動畫製作裡上色之後的那一步
  - 發光層：光束、魔法陣、光點、火花、月亮在半解析度的發光層再畫一份，光暈只從這一層算（白衣服不會跟著發光）；角色在發光層畫成黑色剪影，擋住身後的光，邊緣只透一點
  - 光暈（1/2～1/16 四層模糊）、柔焦擴散、往光源拉長的光芒、撞擊點的衝擊波扭曲、色差、甩鏡與追逐的動態模糊、反相的衝擊格
  - 色彩校正：夜景暗部偏藍、對比高；高調的白天鏡頭暗部提亮、對比低；暗角與每格換的顆粒
  - 每個鏡頭用 `POST` 調參數（`shockAt` 加衝擊波、`rays` 設光源位置），座標都是 1280×720 的畫布座標
  - 解析度跟著播放器的實際像素，上限 1.6 倍（2048×1152），撮影後平均每格約 8ms；瀏覽器不支援 WebGL 時照原本的 2D 畫面顯示
  - 其他用 canvas 畫的短片也能接：`FilmPost.create(畫布, 發光層)`，每次畫完呼叫 `render(參數)`
- 剪接點上的轉場（閃白、紅綢遮擋、甩鏡、衝進鏡頭）寫在 `FX`，疊在畫面最上層，依剪接點前後的時間計算。
- 頁面下方的「用到的鏡頭語言」卡片連到 `#t=秒數`，點了會停在示範那個手法的那一格。

## 貓抓蝴蝶（cat.html）

- 16 秒、五段：霧中登場 → 墨圈 → 撲擊 → 躍起 → 捧蝶。風格與節奏參考使用者提供的參考影片（霧、正面特寫、橘色眼睛、發光的白蝴蝶、墨水漣漪與墨圈）。畫面裡沒有文字、UI、標誌。
- 整支片畫在一張 canvas 上（`js/cat-film.js`），沒有圖片或影片素材：
  - 貓有兩套畫法：正面（坐、走路、站起舉爪、胸前合攏雙爪）與側面骨架（坐、伏低、撲擊、衝刺、落地），都是剪影 + 一束束的毛，黑色毛尖下透出銀灰底毛。
  - 毛筆：濕的墨芯、暈開的邊、一根根筆毛，尾端乾筆飛白；墨圈、撲擊的墨痕都用它。
  - 宣紙、竹林、遠山、石叢、特寫用的深色毛、墨點、底片顆粒在載入時先畫好，播放時只貼上去。
- GSAP 時間軸只當時鐘，每一格只依時間計算；網址加 `#t=秒數` 會停在那一格，方便檢查分鏡。
- canvas 解析度跟著播放器大小，上限 1.25 倍。

## 首頁入口

- `index.html` 的「所有頁面」列出每一頁；新增頁面時在那裡加一張卡片，縮圖放在 `assets/posters/`。
- 每個內頁的頁首在 logo 旁有「返回首頁」鍵（`.home-back`，樣式在 `css/style.css`），新頁面也要加上；窄螢幕時導覽列會收起，返回鍵保留。

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
