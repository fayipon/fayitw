# Motion Banner Lab — FAYI

各頁面：

| 頁面 | 內容 |
|---|---|
| `index.html` | 首頁：所有頁面的入口卡片 |
| `pdoom.html` | I'm Upping My P(doom) 的真人 MV：主歌是日系 16mm 的東京日常，副歌切進 K-pop 布景與群舞；Seedance 2.0 生成的 16 段影片照剪接表剪成一支含原曲的影片，鼓點推鏡、閃白、故障、調色、HUD、章節卡與 P(doom) 儀表由程式即時疊上 |
| `claude-pop.html` | Claude Pop：真人 × 剪紙的音樂錄影帶。原創歌曲在瀏覽器裡即時合成，從 104 BPM 一路加速到 330 BPM，在「奇點」一刀切斷；演員與場景是 Leonardo 生成的真人劇照，鏡頭、跟拍子切動作、對嘴、複製人海、歌詞排版與迷因由程式做出來，下方附演員表與原始需求對照 |
| `clay-farm.html` | Clay 農場：透視 3D 場景、3 × 4 方形土塊農田、GLB 農舍／藍瓦工具棚／蘋果樹／風車、旋轉葉片與炊煙，搭配前景水岸、湖谷圖片遠景、緩慢飄動的黏土雲與景深，可縮放與還原視角 |
| `lab.html` | Banner 實驗台：圖片主視覺 banner 的動態層，每一層都能開關比較 |
| `cat.html` | 貓抓蝴蝶：水墨短片，霧裡走出的長毛黑貓追一隻發光的白蝴蝶；毛由數千撮筆觸堆出，水墨由 WebGL 流體模擬與著色器產生 |
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

## Clay 農場作物配置

`clay-farm.html` 啟動時透過 `fetch` 讀取 `config/clay-farm.json`，配置載入或驗證失敗時會顯示重新載入提示。

- `crops` 列出 8 種作物；每筆的 `seeds` 是初始種子數量，`label` 是顯示名稱。
- `growth.initialStage: 1`：種植從幼苗開始；第 2 階為成長期，第 3 階為成熟期。
- 每種作物的 `stageDurationSeconds` 分別設定各階段秒數：`sprout` 為幼苗到成長期，`growing` 為成長期到成熟期，`mature: 0` 表示成熟不再倒數。目前 8 種作物都設為 `{"sprout":60,"growing":60,"mature":0}`，可各自修改。
- `growth.dryOnEnteringStage: 2`：幼苗升到成長期時土壤變乾。
- `growth.pauseWhenDry: true`：乾枯時暫停倒數，澆水後接續剩餘時間。種植成功（包含重新播種）會讓該格土壤立即變濕潤並開始計時。

每格田獨立計時；作物上方用綠色進度條顯示目前階段的成長進度，操作卡仍顯示下一階段的剩餘時間。未成熟作物乾枯時隱藏進度條並顯示帶底框的水滴圖示，操作卡改顯示「需要澆水」。成熟後移除進度條並顯示帶笑臉的收穫籃，操作卡顯示「可收穫」。切換田格、關閉操作卡或減少動態效果不會停止成長。背景分頁回來時依經過的時間更新，但不會跳過需要澆水的階段。Debug「催熟一階」也會套用同一套乾枯規則。

直接點擊乾枯且已有未成熟作物的田格，就會播放約 2.4 秒的小水壺、水滴與落地漣漪動畫，不需要操作卡內的澆水按鈕。空白田格仍開啟作物選單，濕潤且未成熟的作物則顯示狀態。動畫期間只鎖定該田格的重複操作，其他田格可同時澆水、收穫或種植。結束後才讓原本那格土壤變濕潤並恢復倒數，關閉操作卡不會取消澆水。開啟減少動態效果時改用短暫的靜態漣漪提示；Debug 保留「澆水」及「濕潤／乾枯」控制，僅切換 Debug 田格不會自動澆水。

點擊成熟作物的田格會直接收穫：播放約 2.2 秒的作物彈起、飛入籃子、金色光點與「作物 +1」動畫，完成後清空該格並累計 1 份收成，種子庫存不變。土壤即使被 Debug 改乾也能直接收穫。各田格使用獨立動畫，同一格在完成前不能重複收穫、改種或清除；切換田格與關閉操作卡不會取消收穫，也不會把收成套用到其他田格。減少動態效果時改為短暫的靜態收穫提示。Debug 僅在成熟期顯示「收穫」按鈕，並按作物分別顯示已收穫數量。

修改配置後重新整理頁面生效；目前種子庫存、收成數量與種植進度只保存在本次頁面中。配置、計時與多田格操作測試：`node --test tests/clay-growth.test.js tests/clay-plot-actions.test.js`。

這份 JSON 是遊戲配置，供未來編輯器讀寫；作物 ID 與階段 ID 為穩定鍵值，時間單位統一為秒。模型尺寸等渲染參數留在程式中，倒數剩餘時間等執行狀態不寫回配置檔。

## Clay 農場素材

原始模型與載入畫面圖片放在 `assets-src/`（不會打包上線），網站用的是壓縮後輸出到 `assets/` 同一路徑的版本。新增或替換素材時，把原檔放進 `assets-src/`，然後：

```bash
npm install
npm run optimize:farm
```

腳本（`scripts/optimize-farm-assets.mjs`）會把模型減面、貼圖縮成 1024（作物與小魚 512）並轉 WebP、再用 Draco 壓縮；每個模型的目標面數寫在腳本最上面。減面只刪頂點、不搬動座標，所以 `clay-farm.js` 依局部座標切割欄杆、移除煙囪煙霧等處理照常運作。也可以只處理部分模型：`npm run optimize:farm -- cottage fence`。頁面透過 `js/clay-models.js` 讀取模型，一開始就並行下載全部場景模型，再依序組裝。

## Claude Pop 真人劇照

`claude-pop.html` 的演員與場景是用 [Leonardo](https://leonardo.ai/) API 生成的原創角色劇照（Nano Banana Pro），動態全部由 `js/claude-pop.js` 做。原檔放在 `assets-src/claude-pop/`（不會打包上線），網站用的是轉好的 WebP（`assets/claude-pop/`，約 1.8 MB）。

要重新生成或加新的劇照：

1. 在 Leonardo 的 API 頁面建立 API key，設成環境變數 `LEONARDO_API_KEY`（不要寫進程式或貼到別處）。
2. 在 `scripts/claude-pop-leonardo.mjs` 的 `JOBS` 加一筆（`refs` 帶主角定裝照 `idol-test` 當長相參考），然後 `node scripts/claude-pop-leonardo.mjs 名稱`；已經生成過的會跳過。
3. 要把字夾在人後面或當貼紙用的，再去背：`node scripts/claude-pop-rembg.mjs 名稱`。
4. 轉成網頁用的檔案：`python scripts/claude-pop-photos.py assets-src/claude-pop assets/claude-pop`。

費用參考（2026-10）：一張 1376×768 的劇照約 140 點 API 額度，去背一張約 70 點。

## P(doom) MV

`pdoom.html` 播的是一支剪好的影片（`assets/pdoom/pdoom.mp4`，含原曲），`js/pdoom.js` 把它一格一格畫到 canvas 上，再疊上鼓點推鏡、閃白、故障、調色、底片顆粒、黑邊、章節卡、關鍵字與 P(doom) 儀表。原曲〈I'm Upping My P(doom)〉經授權使用，音檔不放在 repo 裡。

1. 劇照與影片片段：在 `scripts/pdoom-leonardo.mjs` 的 `JOBS` 加一筆，然後 `node scripts/pdoom-leonardo.mjs 名稱`（需要環境變數 `LEONARDO_API_KEY`）。劇照用 Nano Banana Pro、帶 Claude Pop 的主角定裝照當長相參考；影片用 Seedance 2.0，以劇照當第一格拍 5 秒。原檔存在 `assets-src/pdoom/`（不上線）。
2. 剪接：改 `assets/pdoom/edl.json`（切點寫第幾拍，88 BPM、第 0 拍在 0.21 秒；`in` 入點、`rate` 倍速、`rev` 倒放），然後 `python scripts/pdoom-edit.py 原曲.mp3` 重新輸出 `assets/pdoom/pdoom.mp4`。需要 `pip install imageio-ffmpeg`。
3. 章節卡、地點、閃光、故障、儀表的時間寫在 `js/pdoom.js` 最上面；歌詞的排版在 `js/pdoom-lyrics.js`，每一句一段畫法（剪紙字、撕邊紙條、勒索信、翻牌、印章、滿版色紙），跟 Claude Pop 共用 `js/claude-pop-kit.js`。

費用參考（2026-10）：Seedance 2.0 一段 5 秒 720p 約 1,512 點。

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
cat.html              貓抓蝴蝶（水墨短片）
pdoom.html            P(doom) 真人 MV
claude-pop.html       Claude Pop（真人 × 剪紙的音樂錄影帶）
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
css/claude-pop.css    Claude Pop 頁面樣式（聲音按鈕、演員表、需求對照）
css/pdoom.css         P(doom) MV 頁面樣式（聲音按鈕、兩種畫面的劇照、製作說明）
js/slides.js          每張 banner 的文案與特效座標
js/banner.js          MotionBanner 元件（輪播、轉場、動態層、粒子）
js/main.js            實驗台控制面板
js/games.js           推廣連結、註冊連結設定與遊戲資料
js/site.js            推廣頁的站點資料：活動、特色、充提速度、註冊步驟
js/join-page.js       推廣頁的區塊內容
js/join-mg.js         推廣動畫的分鏡
js/teaser.js          站點預告的分鏡
js/affiliate.js       遊戲介紹頁（輪播、介紹切換、遊戲庫篩選）
js/ink-gl.js          水墨引擎（WebGL2）：GPU 流體模擬、宣紙著色器、水墨濾鏡
js/mg-player.js       動畫播放器（縮放、段落、影片同步、自動播放、全螢幕），各動畫頁共用
js/trailer.js         賽馬介紹動畫的分鏡
js/claude-pop-song.js Claude Pop 的歌：段落、拍點表、和弦、旋律與歌詞，以及 Web Audio 合成器
js/claude-pop-kit.js  Claude Pop 的剪紙工具箱：紙的陰影、撕邊、錯版字、翻牌、吊牌、網點
js/claude-pop.js      Claude Pop 的 26 個鏡頭（真人劇照 + 動態）、HUD、跟著音軌走的播放器
js/pdoom.js           P(doom) MV：把剪好的影片畫到 canvas 上，疊動態效果、字卡、HUD 與 P(doom) 儀表
js/pdoom-lyrics.js    P(doom) MV 的歌詞動態排版：每一句一段剪紙排版（共用 claude-pop-kit.js），重拍帶動鏡頭震動
js/slot-trailers.js   老虎機的遊戲資料與分鏡樣板
assets/banners/       主視覺圖（960×436）
assets/games/         遊戲方圖（500×500）與盃賽徽章
assets/clips/         介紹動畫用的實機錄影片段
assets/claude-pop/    Claude Pop 的真人劇照與去背（Leonardo 生成的原創角色，photos.json 記尺寸與人物外框）
assets/pdoom/         P(doom) MV 的影片（pdoom.mp4，含原曲）、剪接表 edl.json 與頁面劇照
assets/posters/       首頁入口卡片的縮圖（各頁實際畫面截圖，640×360）
assets/chars/         站點預告的角色圖（PG Soft 官網主視覺與去背貼紙）
assets-src/           Clay 農場的原始模型與圖片、Claude Pop 與 P(doom) 的 Leonardo 原檔（不上線，壓縮後輸出到 assets/）
scripts/serve.mjs     本機靜態伺服器
scripts/optimize-farm-assets.mjs  Clay 農場素材壓縮（減面、WebP、Draco）
scripts/claude-pop-*   Claude Pop 真人劇照：Leonardo 生成、去背、轉 WebP
scripts/pdoom-*        P(doom) MV：Leonardo 生成劇照與 Seedance 影片、照剪接表剪成影片
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

## 貓抓蝴蝶（cat.html）

- 15 秒、十二個鏡頭、四段：現身 → 凝視 → 撲蝶 → 落空。霧裡走出一隻長毛黑貓（原創角色），追一隻發光的白蝴蝶，畫面裡沒有文字、UI、標誌。
- 分鏡：霧中湖面的遠景 → 腳掌落地的低角度特寫（墨一圈圈漾開）→ 從霧裡走近、橙色的眼睛亮起、墨圈在身邊捲開、白蝴蝶飛來 → 眼睛大特寫 → 竹林裡伏低 → 撲向鏡頭 → 追逐、揮爪、閃白後一記大撲 → 瞳孔放大的特寫 → 墨圈裡合攏雙爪 → 蝴蝶從爪縫溜走、從臉前飛過 → 坐在竹林裡，蝴蝶停在頭上。
- 畫面：淡墨的宣紙、大片霧氣、遠山與竹林；全片的顏色只有貓的橙色眼睛與蝴蝶的白光。
- 貓的毛：身體、四肢、尾巴、臉都由數千撮「毛」堆出來。每撮是一道尖端收細的筆觸，順著毛流方向長；邊緣的毛較長、往外張，成為蓬鬆的輪廓；同一個深淺的毛合成一條路徑一次畫完（`furTube` 沿骨線長毛、`furDisc` 從焦點往外放射）。
  - 毛先畫進半解析度的緩衝再放大（邊緣柔一點，像畫的），眼睛、鼻子、鬍鬚再清楚地疊上去（`drawCat` 分兩趟）。
  - 毛的位置綁在骨架上：正面（坐、走、舉手）與側面（站、伏低、收腿、躍起、落地、揮爪、站起來）的姿勢互相混合出動作；臉可以轉向、抬頭，眼睛有瞪人的眼瞼、會放大的瞳孔、看的方向。
- 墨：乾筆（`dryBrush`，一根根筆毛各自沾墨、外側先乾、露出飛白）畫墨圈與揮爪的弧，墨團與噴出的墨點疊在上面。
- 水墨由 WebGL2 實現（`js/ink-gl.js`）：
  - GPU 流體（stable fluids，模擬 192×108、顏料 1024×576）。顏料有黑墨與白色顏料兩種，可以用不同速度淡掉：湖上與地上飄的霧、蓋住貓再被風吹散的濃霧、腳掌落地的漣漪、墨圈上暈開的墨團。
  - 宣紙由著色器產生（`tint` 調紙色）；canvas 畫的背景與前景圖層經過水墨濾鏡（邊緣暈開、洇、紙纖維打散深色）。
  - 後製：動態模糊（撲擊、追逐）、閃白、淡入淡出、暗角、顆粒。
- 流體固定每步 1/60 秒、每一刀重新開始（`INKSEG`）。跳到某一格時從那一刀開頭重算，順著播或拖回去看，同一格都一樣。
- 瀏覽器不支援 WebGL2 時改用 2D 合成：宣紙圖 + 背景 + 前景，沒有流體與後製。
- GSAP 時間軸只當時鐘；網址加 `#t=秒數` 會停在那一格。解析度跟著播放器的實際像素，水墨版上限 1.6 倍。

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
