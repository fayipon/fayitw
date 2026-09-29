/* =========================================================
   MG 動畫播放器（trailer.html、slots.html 共用）
   - 1280×720 畫布依外框寬度等比縮放
   - 播放／暫停、段落進度列、時間、說明文字
   - 實機影片跟著 GSAP 時間軸走：暫停、跳段落、停格都會同步
   - 捲到畫面上才自動播放，離開或切分頁就暫停
   用法：new MGPlayer({ root, tl, chapters, end, videos, onTick })
     root      .tr-player 外框（裡面要有 .tr-frame .mg 與控制列）
     tl        暫停中的 GSAP timeline
     chapters  [{ at, name, caption }]
     videos    [{ el, start, end, from, freeze? }]，同一支影片可以出現好幾段
     onTick    每次時間變動時呼叫 (t)，給依時間繪製的效果用
   ========================================================= */
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  class MGPlayer {
    constructor({ root, tl, chapters, end, videos = [], onTick }) {
      this.tl = tl;
      this.chapters = chapters;
      this.end = end;
      this.videos = videos;
      this.onTick = onTick;
      this.frame = $('.tr-frame', root);
      this.mg = $('.mg', root);
      this.toggle = $('.tr-toggle', root);
      this.bigPlay = $('.tr-big-play', root);
      this.timeEl = $('.tr-time', root);
      this.caption = $('.tr-caption', root);
      this.list = $('.tr-chapters', root);
      this.root = root;
      this.fsBtn = $('.tr-fs', root);
      this.current = -1;
      this.userPaused = reduced;
      this.inView = false;
      this.off = [];

      const on = (target, type, fn, opts) => {
        target.addEventListener(type, fn, opts);
        this.off.push(() => target.removeEventListener(type, fn, opts));
      };

      // 同一個 <video> 可能在時間軸上用好幾段：依元素分組
      this.groups = new Map();
      videos.forEach(v => {
        if (!this.groups.has(v.el)) this.groups.set(v.el, []);
        this.groups.get(v.el).push(v);
      });

      this.resize = new ResizeObserver(() => this.fit());
      this.resize.observe(this.frame);

      tl.eventCallback('onUpdate', () => this.sync());
      tl.eventCallback('onComplete', () => {
        this.setPlaying(false);
        this.sync();
      });

      this.list.replaceChildren();
      this.items = chapters.map((c, i) => {
        const next = chapters[i + 1] ? chapters[i + 1].at : end;
        const li = document.createElement('li');
        li.style.setProperty('--len', next - c.at);
        li.innerHTML = '<button type="button"><span class="bar"><i></i></span><span class="name"></span></button>';
        $('.name', li).textContent = c.name;
        const button = $('button', li);
        button.setAttribute('aria-label', `跳到「${c.name}」`);
        button.addEventListener('click', () => {
          tl.seek(c.at);
          this.userPaused = false;
          this.play();
        });
        this.list.append(li);
        return { li, bar: $('i', li), start: c.at, end: next };
      });

      on(this.toggle, 'click', () => {
        if (this.isPlaying()) {
          this.userPaused = true;
          this.pause();
        } else {
          this.userPaused = false;
          this.play();
        }
      });
      on(this.bigPlay, 'click', () => {
        this.userPaused = false;
        this.play();
      });
      // 點畫面也能暫停／播放
      on(this.frame, 'click', e => {
        if (!e.target.closest('.tr-big-play')) this.toggle.click();
      });

      this.io = new IntersectionObserver(([entry]) => {
        this.inView = entry.intersectionRatio > 0.4;
        this.autoplay();
      }, { threshold: [0, 0.4, 0.8] });
      this.io.observe(this.frame);
      on(document, 'visibilitychange', () => this.autoplay());

      // 全螢幕：整個播放器（含控制列）一起放大；不支援的瀏覽器（iPhone）就不顯示按鈕
      if (this.fsBtn) {
        this.fsBtn.hidden = !document.fullscreenEnabled;
        on(this.fsBtn, 'click', () => {
          if (document.fullscreenElement) document.exitFullscreen();
          else root.requestFullscreen().catch(() => {});
        });
        on(document, 'fullscreenchange', () => {
          const full = document.fullscreenElement === root;
          this.fsBtn.setAttribute('aria-pressed', String(full));
          this.fsBtn.setAttribute('aria-label', full ? '離開全螢幕' : '全螢幕');
        });
      }

      // 影片載入後再對一次時間（剛好停在影片段落時）
      videos.forEach(v => on(v.el, 'loadedmetadata', () => this.sync()));

      this.setPlaying(false);
      this.sync();
    }

    // 畫布等比縮放並置中（全螢幕時比例可能不是 16:9）
    fit() {
      const w = this.frame.clientWidth;
      const h = this.frame.clientHeight;
      const k = Math.min(w / 1280, h / 720);
      this.mg.style.setProperty('--k', k);
      this.mg.style.setProperty('--ox', `${(w - 1280 * k) / 2}px`);
      this.mg.style.setProperty('--oy', `${(h - 720 * k) / 2}px`);
    }

    isPlaying() {
      return !this.tl.paused() && this.tl.progress() < 1;
    }

    autoplay() {
      if (this.inView && !document.hidden && !this.userPaused && this.tl.progress() < 1) this.play();
      else if (this.isPlaying()) this.pause();
    }

    setPlaying(playing) {
      this.toggle.setAttribute('aria-pressed', String(!playing));
      this.toggle.setAttribute('aria-label', playing ? '暫停' : '播放');
      this.bigPlay.hidden = playing;
      this.bigPlay.setAttribute('aria-label', this.tl.progress() >= 1 ? '重新播放' : '播放動畫');
    }

    play() {
      if (this.tl.progress() >= 1) this.tl.seek(0);
      this.tl.play();
      this.setPlaying(true);
      this.sync();
    }

    pause() {
      this.tl.pause();
      this.setPlaying(false);
      this.sync();
    }

    syncVideos(t, playing) {
      this.groups.forEach((list, el) => {
        // 正在播的那段；沒有的話找 1 秒內要開始的那段，先把畫面跳好
        const v = list.find(w => t >= w.start && t < w.end) || list.find(w => t >= w.start - 1 && t < w.start);
        if (!v) {
          if (!el.paused) el.pause();
          return;
        }
        let target = v.from + Math.max(0, t - v.start);
        const frozen = v.freeze != null && target >= v.freeze;
        if (frozen) target = v.freeze;
        if (el.duration) target = Math.min(target, el.duration - 0.05);
        if (playing && t >= v.start && !frozen) {
          if (el.paused) el.play().catch(() => {});
          if (Math.abs(el.currentTime - target) > 0.3) el.currentTime = target;
        } else {
          if (!el.paused) el.pause();
          if (Math.abs(el.currentTime - target) > 0.04) el.currentTime = target;
        }
      });
    }

    sync() {
      const t = this.tl.time();
      this.syncVideos(t, this.isPlaying());
      if (this.onTick) this.onTick(t);
      this.timeEl.textContent = `${fmt(t)} / ${fmt(this.end)}`;
      let idx = 0;
      this.items.forEach((it, i) => {
        const p = Math.min(1, Math.max(0, (t - it.start) / (it.end - it.start)));
        it.bar.style.transform = `scaleX(${p})`;
        if (t >= it.start) idx = i;
      });
      if (idx !== this.current) {
        this.current = idx;
        this.items.forEach((it, i) => it.li.classList.toggle('is-on', i === idx));
        this.caption.textContent = this.chapters[idx].caption;
      }
    }

    // 換另一支動畫前先拆掉：停影片、解除事件、清掉時間軸
    destroy() {
      this.tl.pause();
      this.tl.kill();
      this.videos.forEach(v => v.el.pause());
      this.off.forEach(fn => fn());
      this.io.disconnect();
      this.resize.disconnect();
      this.list.replaceChildren();
    }
  }

  MGPlayer.reduced = reduced;
  window.MGPlayer = MGPlayer;
})();
