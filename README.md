# Motion Banner Lab — FAYI

各頁面：

| 頁面 | 內容 |
|---|---|
| `index.html` | 首頁：所有頁面的入口卡片 |
| `auto-slot.html` | HG-Fable01 -小紅帽：用 Godot 做的繪本奇幻風小紅帽手機老虎機 Red Riding Hood（Web 匯出版用 iframe 嵌進頁面），畫面照設計稿。上方自走區是白天的森林小路，拿劍的小紅帽自己往外婆家跑，遇到擋路的森林動物與三關 BOSS（熊、雄鹿、假扮外婆的大灰狼）就把每段連鎖的獎金變成出招（連擊段數越多招式越多，第 2 段起出現格鬥遊戲式的 COMBO 計數；沒敵人可打時的傷害、打倒時多出來的傷害都存起來，下一隻一站定就一口氣打出去；左上角 EP 場景編號與關卡進度）；中間是 5 × 4、1024 路連鎖消除 SLOT（10、J、Q、K、A，大野狼、烏鴉、提燈、籃子、藥水，小紅帽 WILD、金鑰匙 SCATTER，倍率 ×1→×2→×3→×5，3 個 SCATTER 進 EXTRA 模式、出場的換成寶箱怪）；下方是照 PG Soft 排的投注區（餘額／押注／贏分、TURBO、AUTO、加減押注、轉動、選單，押注 = 每線 0.05 起 × 20 線）。網頁 loading 跑完直接進遊戲 |
| `pdoom-jingshen.html` | 精神版 I'm Upping My P(doom)：同一首歌拍成時裝秀，東北精神小妹 11 套 Look（洗浴中心、雪夜燒烤、迪廳社會搖、鐵西老廠房）；Seedance 2.0 生成的 31 段影片不帶任何字，Look 卡、吊牌、歌詞、翻牌看板、資料卡與時裝秀 HUD 由程式即時疊上 |
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

## HG-Fable01 -小紅帽（Godot）

遊戲本體是 Godot 4.7 專案 `godot/auto-slot/`（GDScript，Compatibility 渲染），匯出成 Web 版放在 `assets/auto-slot/game/`，`auto-slot.html` 用 iframe 嵌進來。部署時直接用匯出好的檔案，Docker 裡不需要 Godot。

- 規則與數學在 `scripts/rules.gd`（純計算）：5 軸 × 4 列、1024 路，連鎖消除，第 1、2、3、4 段以後分別 ×1、×2、×3、×5，整串結束才結算；中間三軸的金框符號中獎後變成 WILD（小紅帽，只在第 2～4 軸）。
- 金額一律以「分」記（整數），畫面上最多兩位小數，小數點後多餘的 0 不顯示（0.2、1、1.5）。押注照 PG Soft：總押注 = 每線押注 × 20 線，每線押注 0.05、0.10、0.20、0.50、1.00、2.00、5.00、10.00（總押注 1.00～200.00），預設每線 0.10（總押注 2.00）；起始餘額 2,000.00，低於這個數可以在餘額格按「+」補 1,000.00（示範用）。
- 賠率表照美術給的 paytable：`pays` 是每一路在每線押注 20 時贏的金額，實際 = pays × 路數 × 每線押注 ÷ 20。低押注會有不到 1 分的零頭，每一段連鎖（含倍率）算完才四捨五入到分；`tests/test_rules.gd` 會拿同一批盤面比對每線 0.05 與 0.20 的回收率，差不到 1%。符號組照介面設計稿（藥水用 paytable 上魔法書那一級）。
- 金鑰匙是 SCATTER（出現在哪都算）：連鎖完的盤面上 3／4／5 個給總押注的 0.25／1／5 倍，並觸發 8／10／12 次 Free Spins；EXTRA 的連鎖倍率是 ×2 ×3 ×4 ×5 ×6 ×8 ×10，而且整段 EXTRA 一路累積不歸零：每連鎖一段往上爬一格，下一轉接著上一轉爬到的那一格（`Rules.resolve` 的 `level`），爬到 ×10 就停在那裡；外框頂端的倍率條一次顯示 4 格、爬上去時往右捲。再出 3 個以上會加次數。
- 打怪傷害不浪費：沒有狼可以打時（走路中、狼還在走進場、同一轉前面的連鎖已經把狼打倒）的傷害，以及打倒時多出來的傷害，都存進 `charge`（跟著存檔），小紅帽頭上出現藍色能量條（上限是總押注 × 100，不寫數字，存滿時一閃一閃）、身上發金光；下一隻狼站定就一次打出去，夠多的話可以一路連殺。EXTRA 期間的能量是另一筆、只在 EXTRA 裡用：進 EXTRA 時原本存的能量先收起來、能量條從 0 開始，條子、跳字、身上的光都換成紫色；EXTRA 結束時還沒打出去的能量作廢（不帶出 EXTRA），再把原本存的能量還回來。賞金 ÷ 血量跟押注無關，換押注不會多賺或少賺。
- 照現在的權重模擬（2026-10 EXTRA 改版後，每組 40 萬轉、三組）：主遊戲約 71%、打怪賞金約 17.7%、EXTRA 約 9.3%，合計約 97.8%；EXTRA 大約每 400 轉觸發一次，一次平均拿回總押注約 37 倍。EXTRA 改成倍率累積、打爆寶箱掉 WILD 之後，一次 EXTRA 從平均 16 倍變成將近 40 倍，所以把金鑰匙的權重從 2.2 降到 1.35（觸發從每 106 轉變成每 385 轉左右），金框的機率從 11.5% 降到 10.5%（金框影響很大：降到 7% 時整體掉到 81%），讓整體回收率回到 97% 上下。試過但沒用的：落下的 WILD 黏住到 EXTRA 結束（打爆寶箱 → WILD 變多 → 贏更多、打爆更多寶箱，一路滾雪球，一次 EXTRA 平均數百到上萬倍），倍率梯到 ×50（平均 255 倍）。
- 敵人照小紅帽劇本（`rules.gd` 的 `ENEMIES`／`STAGES`，畫面設定在 `field.gd` 的 `MONSTERS`）：三關輪流，每關 7 隻——前 6 隻是被大野狼使喚的森林小動物（每關 3 種輪流出），第 7 隻是這一關的 BOSS。林間小路是松鼠、刺蝟、浣熊，BOSS 是抱蜂蜜罐的大棕熊；花田是青蛙、扛紅蘿蔔的野兔、狐狸，BOSS 是大雄鹿；外婆家門口是抱起司的老鼠、烏鴉、野豬，BOSS 是大灰狼，分兩階段——先披著紅斗篷學小紅帽敲門（KNOCK KNOCK!，`knock`），打倒時給一次 BOSS 賞金，接著砰一團粉紫色的煙原地變身成外婆（睡帽、圓眼鏡、蕾絲披肩），血條從空補滿，外婆剩一半血時露餡、換成凶相，打倒再給一次 BOSS 賞金才算過關；眼鏡從鼻子上被打飛、翻著掉到地上（眼鏡是從露餡圖上拆下來的獨立小圖 `boss-glasses.webp`）。大野狼本人不出場（盤面上的大野狼符號照舊；網頁 loading 畫面與首頁封面的對手換成外婆狼）。小動物的血量是總押注的 1.5／2／2.5 倍（每關 6 隻加起來 12 倍，跟改版前 4 隻 3 倍的大野狼一樣），賞金 ÷ 血量都跟改版前的大野狼一樣，BOSS 的血量與賞金跟改版前的狼王一樣（`tests/test_rules.gd` 會驗）；第 3 關的大灰狼兩階段各一條 BOSS 血條、各一次賞金，第 3 關多了一段 BOSS（BOSS 每點血的賞金比小動物高），打怪的回收率約多 0.75 個百分點。每隻怪有自己的身高、走路速度與受擊反應：松鼠、青蛙、野兔蹦蹦跳，刺蝟、老鼠被打滾一圈，浣熊、狐狸後空翻，烏鴉飛在半空噴羽毛，野豬衝刺進場而且幾乎打不退；BOSS 身後有一圈光，熊被打縮脖子、滴蜂蜜，雄鹿被打只噴一口氣。只有 BOSS 登場時演橫幅：一條斜邊的深紅色帶子從右邊掃進來（左邊是菱形頭像），名字（HONEY BEAR!／GRUMPY STAG!／KNOCK KNOCK!）從很大砸下來、畫面震一下（`encounter.gd`）；外婆狼變身（GRANDMA?!）、露餡（IT'S THE WOLF!）時用快版，打中的同一拍橫幅直接拍進來。小動物安靜地走進來。
- 自走區左上角是場景編號：金色大字 EP01、EP02……（第幾關，三個場景輪流；EP99 之後回到 EP01，99 是 3 的倍數，場景也剛好回到第 1 關，`Rules.episode`），底下一行場景名稱，再一排關卡進度（6 顆小菱形是小動物，打倒的填金、正在打的那顆一閃一閃，最後一顆皇冠是 BOSS）；換關時放大彈回。EXTRA 模式時換成紫色的 EXTRA，底下寫 Extra Bonus Stage，不畫關卡進度（寶箱怪不算進度），進出 EXTRA 時一樣放大彈回。連擊計數出現在同一個位置時，場景編號先淡出讓位。
- 跳字顏色：傷害紅色、存進能量藍色（EXTRA 期間紫色，從能量條右邊冒出來，不會飄到左上角的 EP）、獲得獎勵金色。打倒的那一刀，紅色傷害跳字以怪物剩下的血為準（剩 2 打 5 就跳 −2），多出來的 3 默默存進能量條、不另外跳「+」，免得一個扣一個加。小紅帽站著等玩家轉時，超過 2 秒沒轉就耍一段劍花（待機 2，`s-hero-twirl` 4 格），之後每隔約 5 秒再耍一次。
- Free Spins 是 EXTRA 模式：出場的敵人換成寶箱怪（一般的木頭寶箱，不擬人：站著蓋子張開露出金幣、每隔幾秒喀一聲闔上再張開，走路邊跳邊一開一合，被打蓋子闔上往後倒、噴金幣；原本的敵人先淡掉收起來，血量、變身到哪都記著；寶箱怪的血量跟 BOSS 一樣（總押注 × 10）、不掉金幣，打倒時掉 WILD：小紅帽 WILD 從寶箱飛到倍率條右邊的小牌子（WILD ×次數，跟著存檔），下一轉轉輪停下時，中間三軸隨機 1～3 格（原本不是 WILD、也不是 SCATTER 的格子）落下 WILD，連鎖照落下後的盤面算；一轉落一次，打爆好幾隻就排著，EXTRA 最後一轉才打爆的留到之後的主遊戲（`rules.gd` 的 `drop_wilds`）。試過當場落（打爆的那一刀就落、接著連鎖），但要等小紅帽每一刀打完才知道有沒有打爆，轉輪停停走走，所以改回下一轉。EXTRA 是全自動的：轉動鍵中間顯示還剩幾轉（跟 AUTO 一樣），不用按。EXTRA 結束時沒打倒的寶箱淡掉離場，再把原本的敵人放回來，關卡進度不動）；SLOT 外框外圍一圈一呼一吸的紫光、框邊往上冒金色紫色光點，倍率條換成紫底，Feature Buy 改寫 EXTRA，Total Win 的字樣改成 EXTRA WIN，自走區罩一層金色魔法光、兩側淡紫，落葉換成金色紫色的光屑；進場、加次數、結束的大字也都叫 EXTRA。
- 畫面照設計稿（430 寬）由下往上排：控制列（照 PG：TURBO、減、轉動、加、AUTO、選單貼最右邊；TURBO 關著時閃電被斜線劃掉、底下寫 OFF，開著外圈發金光、寫 TURBO）、餘額／押注／贏分三格、Total Win（框跟三格一樣；沒派獎時是跑馬燈，輪播 SCATTER、金框 WILD、連鎖倍率、打狼的提示）、Feature Buy（壓在木框下緣；點了跳出購買框，照 PG Soft 排：外框是跟 SLOT 同一套的纏藤蔓木框（`Art.draw_vine_frame`，SLOT 外框也改用它）、裡面是羊皮紙，頂端壓著跟按鈕同一張的金邊木牌寫 Feature Buy，COST 放在 Total Win 那種金邊木板上，說明是深棕色的字，Cancel 是胡桃木、Start 是紅寶石色。價錢是總押注 × 150（`Rules.BUY_COST`，總押注 2 時是 300），按 Start 扣錢、這一轉從起手就有 3 個以上金鑰匙的盤面裡抽（`Rules.buy_board`，跟自然觸發那一轉同一個分布），照一般的一轉連鎖後進 EXTRA。價錢照設計定：照同一套流程模擬 1.5 萬次購買，一次平均拿回總押注約 39.5 倍，所以購買本身的回收率約 26%。Free Spins 時改寫兩行：大大的 EXTRA、下面「FREE SPINS 第幾轉 / 共幾轉」）。轉動中與 EXTRA 期間押注鎖住（加減鍵變暗、押注面板選了也不換，面板開著時空白鍵不會轉）、纏藤蔓的蜂蜜色木框 SLOT（四邊用上邊中段那段木板做成的無縫長條 `frame-edge.webp` 轉向貼滿；四角的雕花角塊從外框圖切下來稍微放大；格子之間的縫是深胡桃木色，頂端壓著連鎖倍率條 ×1 ×2 ×3 ×5，現在那一段亮起來）、上方自走區（右上是敵人血條與菱形頭像；遊戲裡不放標題字，標題字只在網頁 loading 畫面）；畫面窄或寬時整組等比縮放。按選單鈕，控制列換成選單列（排法照 PG Soft，按鈕用跟 TURBO、AUTO 一樣的古金細圈，在 `menu_bar.gd`）：QUIT 存檔後回網站首頁、SOUND 聲音總開關（音效和音樂一起；靜音時喇叭旁畫叉）、PAYTABLE 賠率表、RULES 規則（含等級與關卡進度、重設進度）、HISTORY 最近 50 轉的紀錄（時間、押注、贏分、盈虧，觸發 Free Spins、BIG WIN 的另外標出來；存在存檔裡）、CLOSE 收起來，點暗處也會收。
- 投注區照 PG Soft：點押注格會滑出押注選項（8 個總押注），按 AUTO 滑出自動旋轉次數（10、30、50、80、1000），自動中轉動鍵中間顯示剩幾轉，按轉動鍵或 AUTO 就停；餘額不夠也會停。
- 自走區 `field.gd`：白天森林的遠景（陽光、外婆家的小屋、林間小路）固定、暖白的光霧飄動、近景（左右的大樹、前景草地）往左捲、綠葉和白色花瓣飄落，三關各有自己的背景（林間小路、花田、傍晚的外婆家門口），換關時交叉淡換；角色 `fighter.gd` 是設計稿風格的立繪：小紅帽跑步是 4 格循環（一張圖畫完整個循環再切開，`s-hero-runsheet`），另有架式、揮砍、蓄力、跳起；大野狼走進場是 4 格走路循環（`s-wolf-walksheet`），另有站姿與受擊。動作用程式做（衝刺前傾、跑步著地壓扁、腳後揚起塵土、出刀前先蓄力、跳、空中轉身、落地壓扁、疊加混色的殘影）；大野狼被打時換受擊立繪、閃紅、往後仰再彈回，重擊頭上轉金星；劍光是金色月牙（外圈橘金柔光、白芯，劃過打中的位置、掃出去時閃一顆星光）；倒下時用 `fighter.gdshader` 從邊緣燒成灰。立繪比身高寬（披風、伏低的狼），身高同時用區域高度與寬度封頂，兩人中間留一段對峙的空隙。
- 其他：`slot_view.gd` 轉輪、外框與連鎖，`symbol_tile.gd` 符號磚，`icon_button.gd` 圓形按鈕，`main.gd` 排版、投注、自動旋轉、Free Spins、BIG WIN、面板（押注選項、自動旋轉、賠率表、規則、轉動紀錄）。音效在 `sfx.gd` 用程式合成，不需要音檔。背景音樂在 `music.gd`：主遊戲迴圈底下同步疊一軌戰鬥鼓（`AudioStreamSynchronized`，兩軌一樣長、拍點對齊），平常鼓聲關著，狼出現時淡入一點（狼王更大聲），每打中一下依連擊段數推高、停手後慢慢退回；Free Spins 換一首（主遊戲那首暫停在原位，回來接著播），BIG WIN 演出時換成 BIG WIN 曲。音樂走自己的 Music 匯流排，跟音效一起由選單列的 SOUND 開關。
- 開場先演一頁開發商 HAPPY GAME 的 LOGO（`web/shell.html` 的 `#hg-splash`，蓋在遊戲 loading 上面，引擎照常在背後下載）：象牙紙底上的紅色剪紙徽章（長髮女孩、緞帶上的 HAPPY GAME）放大淡入，左右花草從根部一圈圈長出來，翅膀從肩膀收著展開、往外用力拍兩下、之後一直輕輕拍，頭髮上的花綻開，HAPPY GAME 字樣一開始就在、字母由左到右一個個泛起金光，緞帶下的花轉著綻開、噴出光點，字上掃過一道金光、周圍星光閃爍，底下淡入標語 PLAY MORE · A KINDER WORLD；約 4 秒後淡出接回小紅帽的 loading（點一下可略過；圖載不到或超過 3 秒沒載完就不演；系統設定減少動態時只停一下完整的 LOGO）。網址加 `?splash=0.25` 用四分之一速度播，檢查動畫用。
- 沒有「TAP TO START」：網頁的 loading 畫面（`web/shell.html`）一路蓋著，引擎下載完、音效合成完（`main.gd` 透過 JavaScriptBridge 呼叫 `window.asReady()`）就淡出直接進遊戲。瀏覽器規定聲音要等第一次點擊，Godot 收到第一個輸入時會自動開聲音。
- 連擊：每段連鎖是一段連擊，小紅帽的招式跟著段數變多（`field.gd` 的 `strike`）——第 1 段衝上去一刀；第 2 段交叉兩刀；第 3 段再接升龍斬；第 4 段亂舞五刀拖殘影、收一記重斬；第 5 段以上亂舞後穿過狼身來回各兩刀，再跳起轉身落地重劈、畫面大震。狼存起來的傷害一站定打出去時出第 4 段的招。第 2 段起自走區左上角出現連擊計數（右上是敵人血條，不會被擋住） `combo_counter.gd`：斜體大數字＋COMBO，每多一段數字彈一下、閃白、噴火花，顏色由白、金、橘到紅熱，3 段起加評語（GREAT!／EXCELLENT!／AMAZING!／LEGENDARY!），這一轉的招式打完後滑出淡掉。盤面上每段的中獎跳字只寫金額（倍率看外框頂端的倍率條），後面一團金光，停一下就拖著金色火花飛進 Total Win，到了 Total Win 才跳數字、整塊亮一下、噴一圈火花；Total Win 的「TOTAL WIN」字樣和金額當一組置中。
- BIG WIN 演出在 `big_win.gd`（參考 PG Soft 的 Big Win）：總押注 10／25／50 倍以上分別是 BIG WIN／MEGA WIN／SUPER MEGA WIN，全畫面壓暗、金色光芒旋轉、金額跨過門檻時標題換圖閃白並噴一波金幣，金幣從底部噴出會翻面，MEGA 以上加金幣雨；點一下跳到最後金額，再點一下收起來。網址加 `?bigwin`（`assets/auto-slot/game/index.html?bigwin`）會在進遊戲後第一次點擊時（瀏覽器這時才讓網頁出聲）演一次 60 倍的預覽，`?tease` 轉一次第 1、2、4 軸有金鑰匙的盤面看 SCATTER 差一個的吊胃口，`?gold` 轉一次第 2～4 軸有幾格金框的盤面，`?combo` 等狼站定後連出第 1～6 段連擊的招式（`?combo=5` 從第 5 段開始），`?slow=0.25` 整個遊戲用四分之一速度跑（可以跟其他參數一起帶，檢查動作用），`?wilddrop` 演寶箱怪掉 WILD（飛到倍率條旁邊的小牌子）、再轉一次落 3 個 WILD、`?buy` 打開購買框，`?enemy=fox` 之後出來的敵人都換成這一種（寶箱怪只在 EXTRA 出現，不能這樣指定，看寶箱怪用 `?extra`）、`?stage=2` 從第 2 關第 1 隻開始（背景、EP、關卡進度、出的怪都跟著，存檔的打倒數照常加）、`?extra` 看 8 秒 EXTRA 模式的畫面、`?enemy=knock&reveal&stage=3` 看第 3 關 BOSS 打倒後變身、露餡，都只是畫面、不動餘額（`?combo` 每招扣狼 0.01）。
- SCATTER 差一個（前面已經停了兩把金鑰匙）：後面的軸一軸一軸輪流吊胃口，前一軸停好才輪到下一軸；輪到的軸繼續高速轉（帶動態模糊）1.8 秒（turbo 0.9 秒）、最後才煞車，套上竄火光框（`tease.gdshader`：框邊往外竄火、只溢出一點不蓋到隔壁軸，兩顆亮點貼著框線繞著跑，越接近停輪越亮越快），兩側冒火星，配越拉越高的嗡鳴和越打越密的鼓點；還在等的軸整條格子一起變暗（不蓋黑塊）、已停的軸除了 SCATTER 都壓暗、SCATTER 一跳一跳（不加框），自走區也壓暗；落定時光框閃一下，金鑰匙閃光炸開，湊滿 3 個時畫面震一下。不管有沒有吊胃口，SCATTER 落定（或連鎖補位掉下來）時都放一圈光環和光芒，之後一直亮著：不用框，整塊羊皮紙底淡入成「羊皮紙透金光」（`art/tiles/bg-lit.webp`，紋理還看得到、中間最亮），再一呼一吸，中獎時也不會被壓暗。SCATTER 落下時上方的小紅帽也跟著點燃：劍身一道橘光、沿著劍冒出火焰與火星（火焰留在原地往上竄，衝刺時拖出火尾），全身外圍泛出火光（`fighter_glow.gdshader` 把立繪的輪廓暈開）；1 張小火、2 張大火、3 張以上烈焰，Free Spins 期間一直燒著，下一轉開始才熄掉（`field.gd` 的 `scatter_fire`、`fighter.gd`）。
- 贏分分兩塊：三格裡的 WIN 是單次（這一段連鎖），Total Win 是這一轉所有連鎖的總和，Free Spins 時是整輪累計（含 SCATTER 獎金）。中間三軸偶爾出現的金框符號，中獎時不消失而是翻成 WILD 留在原位。`symbol_tile.gd` 每一格先畫同一塊羊皮紙底（`art/tiles/bg.webp`，符號表第 8 塊空白羊皮紙，留著做舊的邊、切圓角）；字母與金鑰匙是去背的透明圖，圖案符號（大野狼、烏鴉、提燈、藥水、籃子）是整塊木框圖塊、WILD 是整塊金框肖像，直接蓋在羊皮紙上；金框符號另外畫框：往內縮一點的細金線（外側墊淡暗影、內側再一道更細的淡亮金線），四角各一顆小菱形紅寶石。
- 遊戲裡的文字是英文，字型只帶 Cinzel（OFL，可變粗細）。
- 進度（金額、押注、等級、關卡、存著的傷害）存在 `user://save.cfg`，網頁版會存進瀏覽器；舊版存檔（金額單位、押注級距不同）只保留等級與關卡，金額與押注重新發。 遊戲原名「自走SLOT」，2026-10 改名 HG-Fable01 -小紅帽；`user://` 的資料夾跟著專案名稱走，所以讀不到存檔時會去同一層的舊資料夾「自走SLOT」讀，讀到就存一份到新位置（`main.gd` 的 `_load`），玩家的進度不會因為改名歸零。

匯出與測試（Godot 用 winget 安裝的 `Godot_v4.7.2-stable_win64_console.exe`，以下用 `godot` 代稱）：

```bash
godot --headless --path godot/auto-slot --export-release "Web"
```

```bash
godot --headless --path godot/auto-slot --script res://tests/test_rules.gd
```

`tests/test_rules.gd` 驗算 1024 路、WILD、SCATTER、連鎖與倍率，並模擬 3 萬轉（含 Free Spins）檢查回收率；`tests/smoke.gd` 載入主畫面、等它自動開始、轉一陣子、再直接跑一輪 Free Spins，確認不會卡住或報錯，再檢查溢出與走路時的傷害有存起來、下一隻狼站定時打出去，最後連出第 1～6 段連擊的招式，確認每一招都打得完。

美術用 Leonardo（Nano Banana Pro）生成，原檔放在 `assets-src/auto-slot/`（不會打包上線）。2026-10 從月夜動漫風改成繪本奇幻風：版面照舊設計稿 `r-ref.jpg`（PG Soft 風的動漫小紅帽），風格照新畫的整頁設計稿 `s-ref-a.jpg`（白天的森林、羊皮紙格、纏藤蔓的蜂蜜色木框；另一張黃昏深綠的 `s-ref-b.jpg` 沒選），小紅帽與大野狼從 A 裁成 `s-ref-hero.jpg`、`s-ref-wolf.jpg` 當長相參考。這一版的素材都用 `s-` 開頭，舊的月夜版 `r-` 原檔與腳本裡的工作都留著：

1. `node scripts/auto-slot-leonardo.mjs [名稱...]`：先把設計稿上傳成參考圖，再生成美術（需要環境變數 `LEONARDO_API_KEY`，已經生成過的會跳過，只差去背的會補去背）。繪本奇幻版：整張場景 `s-scene`（只拿來畫遠景與近景，底下多畫了金色裝飾，不直接用）、遠景 `s-far`、洋紅底的近景 `s-near`、小紅帽 `s-hero-stance`（先畫）與照它畫的 `s-hero-run`、`s-hero-slash`、大野狼 `s-wolf`（都去背）；介面：符號 `s-symbols`（圖案符號是木框圖塊、第 8 塊是空白羊皮紙）、字母 `s-royals`（羊皮紙磚），外框 `s-frame`，按鈕與面板 `s-ui`、圖示 `s-icons`（素材表都用深灰底，羊皮紙和淺色木頭在淺灰底上挖不乾淨），標題字 `s-logo`（去背），BIG WIN 三級標題 `s-title-big`／`s-title-mega`／`s-title-super`（去背），底部背景 `s-floor`；之後補的怪物（`s-m-<id>` 站姿、`-hurt` 受擊、`-walk` 走路 4 格，外婆狼另有 `s-m-boss-reveal`；紳士狼、獾畫了不用，換成熊、雄鹿、野兔，再補浣熊、青蛙、老鼠與 EXTRA 的寶箱怪 `s-m-chest`（太擬人，後來改畫成一般寶箱 `s-m-chest2`，開合 4 格用重畫、每格都裝滿金幣的 `s-m-chest2-walk2`）；敲門的狼改當第 3 關 BOSS 的第一階段；熊和雄鹿的受擊第一版畫進了一把劍，用重畫的 `-hurt2`；雄鹿的走路畫成 2 × 2 四宮格、面向右，切的時候翻過來）、第 2、3 關背景（`s-scene2`／`s-far2`／`s-near2`、`s-scene3`／`s-far3`／`s-near3`）與耍劍花 `s-hero-twirl` 共 6,930 點；之後換怪（熊、雄鹿、野兔、浣熊、青蛙、老鼠、寶箱怪，含試畫三張不用的紳士狼）再 5,460 點；寶箱怪改成一般寶箱 840 點（含一張半開時裡面是空的、不用的開合圖）。2026-10 這一版兩張整頁設計稿 280 點、其他素材 2,940 點（含去背），金鑰匙去背 70 點。舊的月夜版約 4,900 點，另有四張做舊外框 560 點、七張符號去背 490 點。
2. `python scripts/auto-slot-ui.py`：切符號磚（每塊原圖存成 `assets-src/auto-slot/s-sym-<id>.png`；木框圖塊挖掉框外的深灰底整塊用，WILD 金框肖像直接裁，字母 10 J Q K A 在本機依飽和度去背、不要碰到磚邊的焦痕）、做出格子的羊皮紙底與 SCATTER 高亮用的金光羊皮紙、挖掉介面零件與圖示的深灰底、切標題字、量出木框開口與厚度（`art/ui/ui.json`，開口挖成透明），輸出到 `godot/auto-slot/art/tiles/` 與 `art/ui/`。
   金鑰匙的去背要先跑 `node scripts/auto-slot-symbols.mjs`：把 `s-sym-key.png` 上傳到 Leonardo 走 remove-bg，存成 `s-sym-key-cut.png`（已經有的會跳過；一張約 70 點）。第一次跑 `auto-slot-ui.py` 會在缺 `s-sym-key-cut.png` 時停下，去完背再跑一次。
3. `node scripts/auto-slot-assets.mjs`：近景挖掉洋紅、沿著頭尾最像的路線接成循環長條，角色切掉透明邊，輸出到 `godot/auto-slot/art/field/`；另外產生網頁 loading 畫面的圖（`assets/auto-slot/loading-*.webp`，含標題字）與首頁封面（需要 `npm install`）。
4. `python scripts/auto-slot-music.py`：背景音樂。原曲是 Suno 生成的三首（`assets-src/auto-slot/music/`：主遊戲 `base.mp3`〈Box of Shadows〉、Free Spins `free.mp3`〈Cyclical Dark Fairytale〉、BIG WIN `bigwin.mp3`〈Triumphant Dark Fairytale〉），先量出拍子（主遊戲四分 92.085 BPM、Free Spins 94.025），再逐格比對和聲與頻譜，找出頭尾最像、剛好整數個八分音符的一段（主遊戲 66.46 秒、Free Spins 51.05 秒），結尾最後一小節跟開頭前一小節交叉淡入（約 2.6 秒；頭尾只是很像、旋律細節對不上，原本只淡入一拍時聽得出斷層），當成週期訊號重新取樣成 32 kHz，輸出 `godot/auto-slot/music/base.wav`、`free.wav`（匯入時壓成 QOA、向前循環，迴圈點精準到樣本）；戰鬥鼓 `drums.wav` 是自己合成的大太鼓、中太鼓、小鼓，照原曲低頻每 12 個八分音符一循環的重音打，每 4 小段一次滾奏，長度跟主遊戲迴圈完全一樣；BIG WIN 取開頭 24 秒、最後淡出，存成 `bigwin.mp3`（只播一次）。需要 ffmpeg（PATH 上的、環境變數 `FFMPEG`，或 `pip install imageio-ffmpeg`）。
5. `python scripts/happy-game-logo.py`：開場動畫的圖層，不生成新圖，只用兩張 LOGO 原圖（徽章位置一模一樣）：`assets-src/happy-game/logo.png` 是完整的 LOGO，從這張拆出翅膀、左邊花枝（連小鳥）、右邊花草、頭髮上的花、緞帶下的花、字母；`logo2.png` 是沒有翅膀和花草、頭髮完整的同一個徽章，直接當底圖（紙底挖成透明），所以翅膀展開前、花草長出來前看到的是完整的人物。輸出到 `assets/happy-game/`，另有 `logo.json`（各層位置、花草生長的根部、翅膀的支點、每個字母的範圍）。拆法：紅色以外的淺色都是剪紙片，切開金環與外緣後腐蝕成小碎片，依碎片中心落在哪個範圍分類，再用分水嶺沿剪紙之間的陰影線長回原形；每層多帶 4 px 的剪紙陰影。

## P(doom) MV

`pdoom.html` 播的是一支剪好的影片（`assets/pdoom/pdoom.mp4`，含原曲），`js/pdoom.js` 把它一格一格畫到 canvas 上，再疊上鼓點推鏡、閃白、故障、調色、底片顆粒、黑邊、章節卡、關鍵字與 P(doom) 儀表。原曲〈I'm Upping My P(doom)〉經授權使用，音檔不放在 repo 裡。

1. 劇照與影片片段：在 `scripts/pdoom-leonardo.mjs` 的 `JOBS` 加一筆，然後 `node scripts/pdoom-leonardo.mjs 名稱`（需要環境變數 `LEONARDO_API_KEY`）。劇照用 Nano Banana Pro、帶 Claude Pop 的主角定裝照當長相參考；影片用 Seedance 2.0，以劇照當第一格拍 5 秒。原檔存在 `assets-src/pdoom/`（不上線）。
2. 剪接：改 `assets/pdoom/edl.json`（切點寫第幾拍，88 BPM、第 0 拍在 0.21 秒；`in` 入點、`rate` 倍速、`rev` 倒放），然後 `python scripts/pdoom-edit.py 原曲.mp3` 重新輸出 `assets/pdoom/pdoom.mp4`。需要 `pip install imageio-ffmpeg`。
3. 章節卡、地點、閃光、故障、儀表的時間寫在 `js/pdoom.js` 最上面；歌詞的排版在 `js/pdoom-lyrics.js`，每一句一段畫法（剪紙字、撕邊紙條、勒索信、翻牌、印章、滿版色紙），跟 Claude Pop 共用 `js/claude-pop-kit.js`。

費用參考（2026-10）：Seedance 2.0 一段 5 秒 720p 約 1,512 點。

### 精神版

`pdoom-jingshen.html` 是同一首歌的另一支 MV，畫面照時裝秀 MV 的拍法（35mm 閃光燈、網點與顆粒，前半東北雪夜、後半雪地白茫茫），主角是東北精神小妹。流程跟上面一樣，檔名換成 `pdoom-jingshen`：

1. 劇照與影片：`node scripts/pdoom-jingshen-leonardo.mjs 名稱`（`stills` = 全部劇照、`videos` = 全部影片）。定裝照是 `char-d`，其他劇照都帶它當長相參考；提示詞要求招牌與螢幕留白，畫面裡不放字。原檔在 `assets-src/pdoom-jingshen/`。
2. 剪接：改 `assets/pdoom-jingshen/edl.json`，然後 `python scripts/pdoom-edit.py 原曲.mp3 --name pdoom-jingshen`。鏡頭可以加 `face: [x, y, w, h]`（或逐點的 `[[鏡頭內秒數, x, y, w, h], ...]`）畫臉部追蹤框。
3. HUD、片頭片尾、馬賽克收尾在 `js/pdoom-jingshen.js`；夜景白字、雪地黑字由鏡頭的片段決定（`WHITE_CLIPS`）。歌詞、Look 卡、吊牌與每句的資料卡在 `js/pdoom-jingshen-type.js`。

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
pdoom-jingshen.html   精神版 P(doom) MV（時裝秀）
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
css/pdoom-jingshen.css 精神版的主色與 Look 索引（其餘沿用 pdoom.css）
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
js/pdoom-jingshen.js  精神版 P(doom) MV：影片畫到 canvas、調色、網點、時裝秀 HUD、片頭片尾與馬賽克收尾
js/pdoom-jingshen-type.js 精神版的字：左下逐字歌詞、大字、Look 卡、吊牌、資料卡與翻牌看板
js/slot-trailers.js   老虎機的遊戲資料與分鏡樣板
assets/banners/       主視覺圖（960×436）
assets/games/         遊戲方圖（500×500）與盃賽徽章
assets/clips/         介紹動畫用的實機錄影片段
assets/claude-pop/    Claude Pop 的真人劇照與去背（Leonardo 生成的原創角色，photos.json 記尺寸與人物外框）
assets/pdoom/         P(doom) MV 的影片（pdoom.mp4，含原曲）、剪接表 edl.json 與頁面劇照
assets/pdoom-jingshen/ 精神版的影片（pdoom-jingshen.mp4，含原曲）、剪接表與 Look 劇照
assets/posters/       首頁入口卡片的縮圖（各頁實際畫面截圖，640×360）
assets/chars/         站點預告的角色圖（PG Soft 官網主視覺與去背貼紙）
assets-src/           Clay 農場的原始模型與圖片、Claude Pop 與 P(doom) 的 Leonardo 原檔（不上線，壓縮後輸出到 assets/）
scripts/serve.mjs     本機靜態伺服器
scripts/optimize-farm-assets.mjs  Clay 農場素材壓縮（減面、WebP、Draco）
scripts/claude-pop-*   Claude Pop 真人劇照：Leonardo 生成、去背、轉 WebP
scripts/pdoom-*        P(doom) MV 與精神版：Leonardo 生成劇照與 Seedance 影片、照剪接表剪成影片
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
