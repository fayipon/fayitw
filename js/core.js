/* =========================================================
   共用工具 + banner 註冊表
   每個 banner 檔案用 MB.banners.名稱 = (root, env) => api 註冊，
   api 需要回傳：
     intro  暫停中的進場 timeline
     play   開始循環動畫（進場完成且在畫面內時呼叫）
     pause  暫停循環動畫
     reset  重播前把狀態還原（可省略）
   ========================================================= */
window.MB = (() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // 逐字拆開，空白換成不斷行空白，inline-block 才不會吃掉寬度
  function splitChars(el) {
    const text = el.textContent.trim();
    el.textContent = '';
    return [...text].map(ch => {
      const span = document.createElement('span');
      span.className = ch === ' ' ? 'char is-space' : 'char';
      span.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(span);
      return span;
    });
  }

  // 中文逐字、英文逐詞，保留 <em> / <strong> 等包裝
  const TOKEN = /[　-〿㐀-鿿＀-￯]|[^\s　-〿㐀-鿿＀-￯]+|\s+/g;
  function splitWords(el) {
    const words = [];
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) return walk(child);
        if (child.nodeType !== Node.TEXT_NODE) return;
        const frag = document.createDocumentFragment();
        (child.textContent.match(TOKEN) || []).forEach(token => {
          if (/^\s+$/.test(token)) return frag.appendChild(document.createTextNode(token));
          const span = document.createElement('span');
          span.className = 'w';
          span.textContent = token;
          frag.appendChild(span);
          words.push(span);
        });
        child.replaceWith(frag);
      });
    };
    walk(el);
    return words;
  }

  return { $, $$, splitChars, splitWords, banners: {} };
})();
