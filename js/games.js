/* =========================================================
   遊戲介紹頁的設定與遊戲資料
   ========================================================= */

window.AFF_CONFIG = {
  // 推廣連結：所有「立即遊玩」按鈕都連到這裡（例如帶邀請碼的註冊頁）。
  // 個別遊戲可以用自己的 url 覆蓋。
  playUrl: '#',
  // 註冊連結：推廣頁（join.html）的「立即註冊」都連到這裡；沒填就用 playUrl
  registerUrl: '#',
};

/*
  每款遊戲：
    id        網址用的代號，#game=<id> 可以直接打開這款的介紹
    name      英文名稱；zh 中文名稱（選填）
    img       500×500 方形主圖
    accent    主題色：光暈、光束、粒子、按鈕都用這個顏色
    tags      遊戲庫篩選：hot 熱門、big 高倍數、original 原創
    url       選填，覆蓋 AFF_CONFIG.playUrl
  有 intro 的遊戲會出現在精選輪播和遊戲介紹：
    pitch     輪播的一句話賣點
    specs     規格表 [名稱, 數值]；純數字的數值（96.81%、2,500 倍）會跑數字動畫
    stats     輪播上顯示哪三項規格（對應 specs 的名稱）
    features  特色玩法；steps 怎麼玩；tip 小提醒
    gallery   選填，額外的圖片列（例如賽馬的三個盃賽）
    trailer   選填，介紹動畫頁的網址

  RTP 與最高倍數是遊戲商公開的預設值，營運商可以選用不同 RTP 版本，
  上線前請以遊戲商提供的官方規格核對。
*/
window.AFF_GAMES = [
  {
    id: 'fortune-tiger',
    name: 'Fortune Tiger',
    zh: '虎虎生財',
    provider: 'PG Soft',
    type: '老虎機',
    img: 'assets/games/fortune-tiger.webp',
    accent: '#ffb43c',
    tags: ['hot'],
    pitch: '3×3 小盤面、節奏快，隨時可能轉出全盤 10 倍。',
    specs: [
      ['遊戲商', 'PG Soft'],
      ['類型', '老虎機'],
      ['盤面', '3×3 · 5 條連線'],
      ['RTP', '96.81%'],
      ['最高倍數', '2,500 倍'],
      ['波動度', '中'],
    ],
    stats: ['RTP', '最高倍數', '盤面'],
    intro: '只有 3 軸 3 列、5 條固定連線，是最容易上手的經典小盤面。每一轉的結果一眼就看得懂，適合想快速玩幾把、不想先研究規則的玩家。',
    features: [
      ['老虎百搭', '老虎是百搭符號，可以替代其他符號組成連線。'],
      ['Fortune Tiger 特色', '任何一轉都可能隨機觸發：盤面只會出現一種符號和百搭，並且一直重轉到出現贏分為止。'],
      ['全盤 10 倍', '9 格全部被同一種符號或百搭填滿時，這一轉的贏分乘以 10。'],
    ],
    steps: ['選好每轉的押注金額', '按下旋轉，連線從最左邊一軸開始計算', '等待老虎出場觸發特色，追全盤 10 倍'],
    tip: '盤面小、單轉贏分不高，適合小額多轉，慢慢等特色觸發。',
  },
  {
    id: 'mahjong-ways',
    name: 'Mahjong Ways',
    zh: '麻將胡了',
    provider: 'PG Soft',
    type: '老虎機 · 消除',
    img: 'assets/games/mahjong-ways.webp',
    accent: '#f5cf5a',
    tags: ['hot', 'big'],
    pitch: '連續消除倍數一路往上疊，免費旋轉最高到 10 倍。',
    specs: [
      ['遊戲商', 'PG Soft'],
      ['類型', '老虎機 · 消除'],
      ['盤面', '5 軸 · 消除玩法'],
      ['RTP', '96.92%'],
      ['最高倍數', '25,000 倍'],
    ],
    stats: ['RTP', '最高倍數', '盤面'],
    intro: '以麻將牌為主題的消除型老虎機。得分的牌會消失、上方補牌，只要一直有贏分就一直消下去，倍數也跟著升級，一轉之內就可能連續爆好幾次。',
    features: [
      ['連續消除', '每次贏分後，得分的牌消失並補上新牌，可以在同一轉裡連續得分。'],
      ['倍數升級', '連續消除時倍數依序提高到 1、2、3、5 倍。'],
      ['金色牌變百搭', '中間幾軸的金色牌參與贏分後，會翻成百搭留在盤面上。'],
      ['免費旋轉', '轉出 3 個以上「胡」觸發免費旋轉，倍數升級為 2、4、6、10 倍。'],
    ],
    steps: ['選好押注金額後旋轉', '看得分的牌消除，倍數跟著往上跳', '湊齊 3 個「胡」進入免費旋轉'],
    tip: '倍數要連續消除才會往上疊，免費旋轉是主要的大獎來源。',
  },
  {
    id: 'mahjong-ways-2',
    name: 'Mahjong Ways 2',
    zh: '麻將胡了2',
    provider: 'PG Soft',
    type: '老虎機 · 消除',
    img: 'assets/games/mahjong-ways-2.webp',
    accent: '#5fe39a',
    tags: ['big'],
    pitch: '延續一代的消除倍數，最高倍數拉到 100,000 倍。',
    specs: [
      ['遊戲商', 'PG Soft'],
      ['類型', '老虎機 · 消除'],
      ['盤面', '5 軸 · 消除玩法'],
      ['RTP', '97.11%'],
      ['最高倍數', '100,000 倍'],
    ],
    stats: ['RTP', '最高倍數', '盤面'],
    intro: '麻將胡了的續作。保留一代的消除、倍數升級和金色百搭，畫面更華麗，最高倍數從 25,000 倍拉高到 100,000 倍，適合喜歡一代又想追更大獎的玩家。',
    features: [
      ['連續消除', '得分的牌消失後補牌，同一轉可以連續得分。'],
      ['倍數升級', '連續消除越多次，倍數越高；免費旋轉中倍數更高。'],
      ['金色牌變百搭', '金色牌參與贏分後翻成百搭，幫下一次消除湊連線。'],
      ['免費旋轉', '轉出足夠的「胡」觸發免費旋轉，是衝高倍數的關鍵。'],
    ],
    steps: ['選好押注金額後旋轉', '連續消除讓倍數往上疊', '觸發免費旋轉，衝 100,000 倍上限'],
    tip: '最高倍數比一代高很多，波動也更大，建議先設定好這一局的預算。',
    trailer: 'slots.html#mahjong-ways-2',
  },
  {
    id: 'fortune-ox',
    name: 'Fortune Ox',
    zh: '十倍金牛',
    provider: 'PG Soft',
    type: '老虎機',
    img: 'assets/games/fortune-ox.webp',
    accent: '#ff6a4d',
    tags: ['hot'],
    pitch: '特色觸發後重轉到有贏分為止，全盤直接 10 倍。',
    specs: [
      ['遊戲商', 'PG Soft'],
      ['類型', '老虎機'],
      ['盤面', '3-4-3 · 10 條連線'],
      ['RTP', '96.75%'],
      ['最高倍數', '2,000 倍'],
    ],
    stats: ['RTP', '最高倍數', '盤面'],
    intro: 'Fortune 系列的金牛版本。中間一軸多一列，盤面變成 3-4-3，連線比虎虎生財多。玩法一樣簡單直接，主打特色觸發後的「保證贏分」和全盤 10 倍。',
    features: [
      ['金牛百搭', '金牛是百搭符號，可以替代其他符號組成連線。'],
      ['Fortune Ox 特色', '隨機觸發後，盤面會一直重轉到出現贏分為止。'],
      ['全盤 10 倍', '整個盤面被同一種符號或百搭填滿時，贏分乘以 10。'],
    ],
    steps: ['選好押注金額', '按下旋轉，10 條連線同時計算', '等金牛觸發特色，追全盤 10 倍'],
    tip: '和虎虎生財一樣屬於輕鬆型，適合想玩節奏快、規則簡單的玩家。',
  },
  {
    id: 'lucky-neko',
    name: 'Lucky Neko',
    zh: '招財喵',
    provider: 'PG Soft',
    type: '老虎機 · 消除',
    img: 'assets/games/lucky-neko.webp',
    accent: '#ff7cc4',
    tags: ['big'],
    pitch: '6 軸最多 32,400 種贏法，金框符號翻成百搭。',
    specs: [
      ['遊戲商', 'PG Soft'],
      ['類型', '老虎機 · 消除'],
      ['盤面', '6 軸 · 最多 32,400 種贏法'],
      ['RTP', '96.73%'],
      ['最高倍數', '100,000 倍'],
    ],
    stats: ['RTP', '最高倍數', '盤面'],
    intro: '日式招財貓主題的 6 軸消除型老虎機。每軸列數會變化，組合出最多 32,400 種贏法；金框符號參與贏分後會變成百搭，讓連續消除更容易接下去。',
    features: [
      ['最多 32,400 種贏法', '相鄰軸出現相同符號就算贏分，不必在固定連線上。'],
      ['金框符號變百搭', '帶金框的符號參與贏分後，翻成百搭留在盤面上。'],
      ['連續消除', '得分符號消失並補上新符號，同一轉可以連續得分。'],
      ['免費旋轉', '轉出足夠的分散符號觸發免費旋轉，倍數會隨贏分累加。'],
    ],
    steps: ['選好押注金額後旋轉', '留意金框符號，贏分後會翻成百搭', '觸發免費旋轉，倍數一路往上疊'],
    tip: '高倍數型遊戲，平常贏分較少、爆發時很大，適合有耐心的玩家。',
  },
  {
    id: 'treasures-of-aztec',
    name: 'Treasures of Aztec',
    provider: 'PG Soft',
    type: '老虎機 · 消除',
    img: 'assets/games/treasures-of-aztec.webp',
    accent: '#38dcc0',
    tags: ['big'],
    pitch: '阿茲特克黃金城，消除越多倍數越高。',
    specs: [
      ['遊戲商', 'PG Soft'],
      ['類型', '老虎機 · 消除'],
      ['盤面', '6 軸 · 最多 32,400 種贏法'],
      ['RTP', '96.71%'],
      ['最高倍數', '100,000 倍'],
    ],
    stats: ['RTP', '最高倍數', '盤面'],
    intro: '以阿茲特克黃金城為主題的 6 軸消除型老虎機。每次消除都會讓倍數往上加，連續消除越多次，一轉的贏分越可觀。',
    features: [
      ['倍數累加', '每一次消除，倍數都會再往上加。'],
      ['金框符號變百搭', '帶金框的符號參與贏分後翻成百搭，幫忙延續消除。'],
      ['免費旋轉', '轉出足夠的分散符號觸發免費旋轉，倍數累加得更快。'],
    ],
    steps: ['選好押注金額後旋轉', '連續消除讓倍數往上加', '觸發免費旋轉，衝最高 100,000 倍'],
    tip: '倍數靠連續消除累積，免費旋轉是主要的大獎來源。',
  },
  {
    id: 'horse-racing',
    name: 'Horse Racing',
    zh: '極速賽馬',
    provider: 'KUNKING 原創',
    type: '虛擬賽馬',
    img: 'assets/games/horse-racing.webp',
    accent: '#5df5c2',
    tags: ['original'],
    pitch: '每 2 分鐘開跑一場，三個盃賽 8 到 12 匹馬同場競速。',
    specs: [
      ['開發', 'KUNKING 原創'],
      ['類型', '虛擬賽馬'],
      ['參賽馬匹', '8–12 匹'],
      ['賽事間隔', '每 2 分鐘'],
      ['下注時間', '48 秒'],
      ['單注金額', '10–10,000'],
    ],
    stats: ['參賽馬匹', '賽事間隔', '下注時間'],
    intro: '平台自製的虛擬賽馬。每一場都照「開放下注 → 停止下注 → 賽事動畫 → 結算」的節奏跑，停止下注時就已經開獎，比賽畫面跑完才公布名次，結算後直接派彩到錢包。',
    features: [
      ['每 2 分鐘一場', '賽事不停輪替，錯過這場，兩分鐘後又是新的一場。'],
      ['每匹馬各有跑法', '領放、跟前、中段後追、後段爆發，每匹馬都有自己的跑法，看久了會有自己的愛馬。'],
      ['三個盃賽', 'Sunny Cup 8 匹、Thunder Cup 10 匹、Royal Cup 12 匹，各自獨立的賽程。'],
      ['結算即派彩', '比賽結束立刻結算，贏得的彩金直接進錢包。'],
    ],
    steps: ['選一個盃賽', '在 48 秒內選馬下注（10 的倍數，10–10,000）', '看比賽動畫揭曉名次，結算後自動派彩'],
    tip: '下注後不能取消；需要登入才能下注。',
    trailer: 'trailer.html',
    gallery: {
      title: '三個盃賽',
      items: [
        ['assets/games/cup-sunny.webp', 'Sunny Cup'],
        ['assets/games/cup-thunder.webp', 'Thunder Cup'],
        ['assets/games/cup-royal.webp', 'Royal Cup'],
      ],
    },
  },

  // 只在遊戲庫出現，沒有完整介紹
  { id: 'fortune-rabbit', name: 'Fortune Rabbit', provider: 'PG Soft', type: '老虎機', img: 'assets/games/fortune-rabbit.webp', accent: '#c78bff', tags: [] },
  { id: 'dragon-hatch', name: 'Dragon Hatch', provider: 'PG Soft', type: '老虎機 · 消除', img: 'assets/games/dragon-hatch.webp', accent: '#ff7a4a', tags: ['hot'] },
  { id: 'fortune-dragon', name: 'Fortune Dragon', provider: 'PG Soft', type: '老虎機', img: 'assets/games/fortune-dragon.webp', accent: '#ffcf4a', tags: [] },
  { id: 'medusa', name: 'Medusa', provider: 'PG Soft', type: '老虎機', img: 'assets/games/medusa.webp', accent: '#5fd9c5', tags: ['hot'] },
  { id: 'fortune-mouse', name: 'Fortune Mouse', provider: 'PG Soft', type: '老虎機', img: 'assets/games/fortune-mouse.webp', accent: '#ffc14d', tags: ['hot'] },
  { id: 'wild-bandito', name: 'Wild Bandito', provider: 'PG Soft', type: '老虎機', img: 'assets/games/wild-bandito.webp', accent: '#c46bff', tags: ['big'] },
  { id: 'candy-bonanza', name: 'Candy Bonanza', provider: 'PG Soft', type: '老虎機', img: 'assets/games/candy-bonanza.webp', accent: '#6fd8ff', tags: ['big'] },
  { id: 'ways-of-the-qilin', name: 'Ways of the Qilin', provider: 'PG Soft', type: '老虎機', img: 'assets/games/ways-of-the-qilin.webp', accent: '#ffc35c', tags: ['big'] },
  { id: 'totem-wonders', name: 'Totem Wonders', provider: 'PG Soft', type: '老虎機', img: 'assets/games/totem-wonders.webp', accent: '#4fc6ff', tags: ['big'] },
  { id: 'asgardian-rising', name: 'Asgardian Rising', provider: 'PG Soft', type: '老虎機', img: 'assets/games/asgardian-rising.webp', accent: '#ffb35c', tags: ['big'] },
  { id: 'dreams-of-macau', name: 'Dreams of Macau', provider: 'PG Soft', type: '老虎機', img: 'assets/games/dreams-of-macau.webp', accent: '#ff9f4a', tags: ['big'] },
  { id: 'fortune-gods', name: 'Fortune Gods', provider: 'PG Soft', type: '老虎機', img: 'assets/games/fortune-gods.webp', accent: '#ffcf5c', tags: ['hot'] },
  { id: 'fortune-snake', name: 'Fortune Snake', provider: 'PG Soft', type: '老虎機', img: 'assets/games/fortune-snake.webp', accent: '#62e8a0', tags: [] },
];
