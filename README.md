# Motion Banner Lab — FAYI

六種 Motion Graphic 風格的網站主視覺 banner。純 HTML / CSS / JavaScript，不需要 build，動畫由 [GSAP](https://gsap.com/) 與 ScrollTrigger 驅動（從 jsDelivr CDN 載入）。

## 本機預覽

```bash
npm run dev
```

然後打開 <http://localhost:5173>。伺服器是零依賴的 Node 腳本（`scripts/serve.mjs`），不需要 `npm install`。

## 六種樣式

| # | 樣式 | 效果 | 適合 |
|---|---|---|---|
| 01 | 幾何構成 Geometric | 九宮格拼貼彈出、遮罩文字、隨機旋轉、滑鼠 3D 傾斜 | 品牌首頁、設計工作室 |
| 02 | 動態字體 Kinetic Type | 可變字型字寬波浪、單字替換、跑馬燈帶 | 活動主打、音樂祭、潮流品牌 |
| 03 | 流體漸層 Liquid Gradient | 模糊色塊漂移、逐字模糊淡入、毛玻璃、游標光暈 | 科技產品、App 發表 |
| 04 | 切片輪播 Slice Carousel | 交錯百葉窗轉場、自動輪播進度條、懸停暫停 | 電商首頁、多檔活動 |
| 05 | 點陣波紋 Dot Matrix | Canvas 點陣拼字、擴散進場、游標推開、字詞輪替 | 科技感活動、遊戲、倒數 |
| 06 | 線條描繪 Line Drawing | SVG 線條描繪、襯線字、底線動畫、景深視差 | 品牌故事、藝文、雜誌風 |

## 結構

```
index.html            頁面與六個 banner 的 HTML
css/style.css         樣式（每個 banner 一個區塊，色票定義在 :root）
js/core.js            共用工具與 banner 註冊表
js/banners/*.js       每個 banner 的動畫，一個檔案一種
js/main.js            控制進場、循環、重播與導覽列
scripts/serve.mjs     本機靜態伺服器
```

## 把某一種 banner 拿去用

1. 複製 `index.html` 裡對應的 `<div class="banner banner-xxx">…</div>`。
2. 複製 `css/style.css` 的共用區塊（`:root`、`.btn`、`.banner`、`.rl`）和該 banner 的區塊。
3. 載入 GSAP、ScrollTrigger、`js/core.js` 和 `js/banners/xxx.js`，然後：

```js
const api = MB.banners.xxx(document.querySelector('.banner-xxx'), {
  motion: true,
  finePointer: matchMedia('(pointer: fine)').matches,
});
api.intro.eventCallback('onComplete', api.play);
api.intro.play();
```

每個 banner 都回傳 `{ intro, play, pause, reset }`：`intro` 是進場 timeline，`play` / `pause` 控制循環動畫，`reset` 在重播前還原狀態。

## 無障礙

- 系統開啟「減少動態效果」時，banner 直接顯示最終畫面，不自動播放；按「重播」或輪播按鈕才會動。
- 輪播有暫停按鈕，滑鼠移入或鍵盤聚焦時也會自動暫停。
- CDN 載入失敗時，頁面會退回可讀的靜態版面。
