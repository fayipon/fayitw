/* =========================================================
   推廣頁（join.html）的站點資料：動畫和頁面內容都從這裡讀
   ⚠ 活動、特色、充提速度目前是「範例文字」，上線前請改成站上實際的內容，
     不要寫出做不到的承諾（到帳時間、獎勵金額都要跟實際一致）。
   ========================================================= */

window.SITE = {
  brand: 'FAYI',
  slogan: '熱門遊戲，一站玩遍',

  // 活動：tag 小標籤、title 活動名稱、desc 一句說明（動畫裡最多顯示 3 個）
  events: [
    { tag: '新會員', title: '首儲加碼', desc: '註冊完成首次儲值，加碼送遊戲金' },
    { tag: '每日', title: '簽到好禮', desc: '每天登入簽到，連續簽到獎勵更多' },
    { tag: '每週', title: '返水回饋', desc: '依有效投注回饋，每週自動派發' },
  ],

  // 站點特色：icon 可用 phone、games、support、shield、gift、bolt
  features: [
    { icon: 'phone', title: '手機直接玩', desc: '免下載，打開瀏覽器就能玩' },
    { icon: 'games', title: '熱門遊戲齊全', desc: 'PG、JILI 熱門老虎機，加上原創賽馬' },
    { icon: 'support', title: '24 小時客服', desc: '有問題隨時找得到人' },
    { icon: 'shield', title: '資料加密保護', desc: '帳號與交易資料全程加密' },
  ],

  // 極速充提：value + unit 會做成大數字，note 是補充說明
  pay: [
    { label: '充值', value: 1, unit: '分鐘', lead: '最快', note: '儲值後自動入帳' },
    { label: '出款', value: 3, unit: '分鐘', lead: '最快', note: '審核通過立即出款' },
  ],

  // 註冊步驟
  steps: ['輸入手機號碼', '設定登入密碼', '完成，開始遊戲'],
};
