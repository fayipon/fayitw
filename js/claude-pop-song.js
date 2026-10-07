/* =========================================================
   Claude Pop（claude-pop.html）：歌曲資料與合成器
   - 整首歌（原創詞曲）寫成資料：段落、和弦、鼓組、旋律（每個音節的拍點、音高、母音）
   - 越來越快：104 → 112 → 120 → 128 → 136 → 148 BPM，「奇點」段從 150 一路加速到 330，
     然後整首歌一刀切斷，留下一小段空白，再用很輕的鋼琴收尾
   - 拍點表 BEATS 由各段速度推出來；畫面、歌詞、嘴型、聲音都從同一張拍點表取時間，所以一定對拍
   - 聲音用 OfflineAudioContext 在瀏覽器裡合成（分段算，再一起加殘響與壓縮）：鼓、貝斯、和弦墊、琶音，
     「人聲」是鋸齒波經過母音共振峰濾波器，每個音節依發音唱出 a / e / i / o / u
   用法：window.ClaudePopSong = { SECTIONS, BEATS, END, CUT, tb, bt, lines, syllables, mouth, bpmAt, render(onProgress) }
   ========================================================= */
(() => {
  // 段落：小節數、速度（起 → 迄，奇點段用指數加速）、移調（再副歌升兩個半音）
  const SECTIONS = [
    { id: 'intro', name: '開場', bars: 4, bpm: [104, 104], key: 0 },
    { id: 'verse', name: '主歌', bars: 8, bpm: [112, 112], key: 0 },
    { id: 'pre', name: '倒數', bars: 4, bpm: [120, 120], key: 0 },
    { id: 'chorus', name: '副歌', bars: 8, bpm: [128, 128], key: 0 },
    { id: 'break', name: '時間軸', bars: 8, bpm: [136, 136], key: 0 },
    { id: 'final', name: '再副歌', bars: 8, bpm: [148, 148], key: 2 },
    { id: 'sing', name: '奇點', bars: 4, bpm: [150, 330], key: 2 },
    { id: 'outro', name: '之後', bars: 4, bpm: [96, 96], key: 2 },
  ];
  const BY = Object.fromEntries(SECTIONS.map(s => [s.id, s]));

  /* ---------- 拍點表 ---------- */
  const T0 = 0.06;
  const BEATS = [T0];
  let nb = 0;
  for (const s of SECTIONS) {
    const n = s.bars * 4;
    s.b0 = nb;
    s.b1 = nb + n;
    for (let i = 0; i < n; i++) {
      const bpm = s.bpm[0] * Math.pow(s.bpm[1] / s.bpm[0], i / n);
      BEATS.push(BEATS[BEATS.length - 1] + 60 / bpm);
    }
    nb += n;
  }
  const NB = nb;
  // 拍 → 秒（可以是小數拍）
  const tb = b => {
    if (b <= 0) return T0 + b * (BEATS[1] - BEATS[0]);
    if (b >= NB) return BEATS[NB] + (b - NB) * (BEATS[NB] - BEATS[NB - 1]);
    const i = Math.floor(b);
    return BEATS[i] + (b - i) * (BEATS[i + 1] - BEATS[i]);
  };
  // 秒 → 拍
  const bt = t => {
    if (t <= T0) return (t - T0) / (BEATS[1] - BEATS[0]);
    if (t >= BEATS[NB]) return NB + (t - BEATS[NB]) / (BEATS[NB] - BEATS[NB - 1]);
    let lo = 0, hi = NB;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (BEATS[m] <= t) lo = m; else hi = m;
    }
    return lo + (t - BEATS[lo]) / (BEATS[lo + 1] - BEATS[lo]);
  };
  for (const s of SECTIONS) {
    s.t0 = tb(s.b0);
    s.t1 = tb(s.b1);
  }
  // 奇點段結束的那一刻整首歌切斷
  const CUT = BY.sing.t1;
  const END = BY.outro.t1 + 0.4;
  const sectionAt = t => {
    let s = SECTIONS[0];
    for (const x of SECTIONS) if (t >= x.t0) s = x;
    return s;
  };
  const bpmAt = t => {
    const b = Math.min(NB - 1, Math.max(0, Math.floor(bt(t))));
    return 60 / (BEATS[b + 1] - BEATS[b]);
  };

  /* ---------- 和弦（C 大調的寫法，移調另外加） ---------- */
  const CH = {
    Am: { root: 45, notes: [57, 60, 64, 69] },
    F: { root: 41, notes: [53, 57, 60, 65] },
    C: { root: 48, notes: [55, 60, 64, 67] },
    G: { root: 43, notes: [55, 59, 62, 67] },
    Em: { root: 40, notes: [55, 59, 64, 67] },
    Dm: { root: 38, notes: [53, 57, 62, 65] },
    A: { root: 45, notes: [57, 61, 64, 69] },
    Bb: { root: 46, notes: [53, 58, 62, 65] },
    C9: { root: 36, notes: [55, 60, 62, 64, 67] },
    F7: { root: 41, notes: [53, 57, 60, 64] },
  };
  const PROG = {
    intro: ['Am', 'F', 'C', 'G'],
    verse: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'],
    pre: ['Dm', 'Em', 'F', 'G'],
    chorus: ['F', 'G', 'Em', 'Am', 'F', 'G', 'Em', 'Am'],
    break: ['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G'],
    final: ['F', 'G', 'Em', 'Am', 'F', 'G', 'Em', 'Am'],
    sing: ['F', 'G', 'A', 'Bb'],
    outro: [null, 'C9', 'F7', 'C9'],
  };

  /* ---------- 旋律與歌詞（原創） ----------
     每個 token 是「音節:拍數:MIDI」，「_」是休止；音節結尾的「-」表示同一個字還沒唱完
     每一行剛好填滿它的小節數（主歌、副歌一行兩小節；時間軸段一行一小節） */
  const LYRICS = {
    intro: [
      'ev-:.5:76 ery-:.5:76 thing:1:74 is:.5:72 speed-:.5:74 ing:.5:76 up:4.5:79',
      '_:6 claude:.5:72 pop!:1.5:79',
    ],
    verse: [
      '_:.5 woke:.5:64 up:.5:64 and:.5:64 the:.5:62 world:1:64 was:.5:67 a:.5:69 ver-:.5:69 sion:.5:67 be-:.5:64 hind:1.5:64 _:.5',
      '_:.5 shipped:.5:64 it:.5:64 at:.5:67 mid-:.5:72 night,:1:71 it\'s:.5:67 old:1:69 by:.5:67 sun-:.5:67 rise:1.5:62 _:.5',
      'ev-:.5:69 ery:.5:69 chart:.5:72 on:.5:72 my:.5:71 feed:1:69 is:.5:67 a:.5:67 line:1:69 go-:.5:72 ing:.5:71 up:1.5:69',
      'ev-:.5:72 ery:.5:72 week:.5:72 is:.5:71 a:.5:72 year:1:74 and:.5:72 it\'s:.5:71 nev-:.5:71 er:.5:67 e-:.5:69 nough:2:71',
    ],
    pre: [
      '_:.5 can:.5:69 you:.5:69 feel:1:72 the:.5:69 floor:1:72 be-:.5:74 gin:.5:72 to:.5:74 move?:2.5:76',
      'ten:1:72 nine:1:74 eight:1:76 sev-:.5:77 en:.5:77 six:.5:79 five:.5:79 four:.5:81 three:.5:81 two:.5:83 one:.5:84 _:1',
    ],
    chorus: [
      'fast-:.5:81 er,:.5:79 fast-:.5:81 er,:.5:79 _:.5 we\'re:.5:76 go-:.5:77 ing:.5:79 ver-:1:84 ti-:.5:83 cal:2.5:79',
      'ev-:.5:79 ery:.5:79 lit-:.5:79 tle:.5:76 to-:.5:79 ken:.5:81 turn-:.5:83 ing:.5:79 in-:.5:81 to:.5:79 light:3:76',
      'don\'t:1:81 blink,:1:84 _:.5 you\'ll:.5:79 miss:.5:81 the:.5:79 whole:1:83 thing:3:79',
      'this:.5:76 is:.5:79 claude:1:79 pop,:1:83 _:.5 up,:.5:81 up,:.5:83 up!:2.5:84 _:1',
    ],
    break: [
      'line:.5:76 goes:.5:76 up:1:81 _:2',
      'line:.5:76 goes:.5:76 up:1:84 _:2',
      'math:.5:72 got:.5:72 eat-:.5:76 en:1.5:74 _:1',
      'feel:.5:77 the:.5:76 A-:.5:72 G-:.5:74 I:1:77 _:1',
      'it\'s:.5:72 so:.5:72 o-:.5:76 ver:1.5:72 _:1',
      'we\'re:.5:72 so:.5:74 back:2:79 _:1',
      'get:.5:74 in:.5:74 the:.5:74 ro-:.5:79 bot:1.5:74 _:.5',
      '_:4',
    ],
    sing: [
      'fast-:.5:72 er:.5:72 fast-:.5:73 er:.5:73 fast-:.5:74 er:.5:74 fast-:.5:75 er:.5:75',
      'fast-:.5:76 er:.5:76 fast-:.5:77 er:.5:77 fast-:.5:78 er:.5:78 fast-:.5:79 er:.5:79',
      'fast-:.5:80 er:.5:80 fast-:.5:81 er:.5:81 fast-:.5:82 er:.5:82 fast-:.5:83 er:.5:83',
      'fast-:.5:84 er:.5:84 fast-:.5:85 er:.5:85 fast-:.5:86 er:.5:86 fast-:.5:87 er:.5:87',
    ],
    outro: [
      '_:4',
      'hi.:2:72 _:2',
      'see:.5:74 you:.5:72 on:.5:71 the:.5:72 oth-:.5:74 er:.5:76 side.:1:79',
      '_:4',
    ],
  };
  LYRICS.final = LYRICS.chorus;

  // 母音：決定「人聲」的共振峰，也決定嘴型（照發音，不照拼字）
  const VOWEL = {
    a: 'e', g: 'i', i: 'a', hi: 'a', my: 'a', by: 'a', night: 'a', hind: 'a', side: 'a', light: 'a', line: 'a',
    nine: 'a', five: 'a', rise: 'a', up: 'a', sun: 'a', nough: 'a', one: 'a', oth: 'a', claude: 'o', floor: 'o',
    four: 'o', was: 'o', world: 'e', turn: 'e', move: 'u', to: 'u', two: 'u', you: 'u', youll: 'u', the: 'e',
  };
  const vowelOf = txt => {
    const s = txt.toLowerCase().replace(/[^a-z]/g, '');
    if (VOWEL[s]) return VOWEL[s];
    if (/ee|ea|ie/.test(s)) return 'i';
    if (/oo|ou|ugh/.test(s)) return 'u';
    if (/er$|ir|ur/.test(s) && s.length <= 3) return 'e';
    const m = /[aeiouy]/.exec(s);
    if (!m) return 'e';
    return m[0] === 'y' ? 'i' : m[0];
  };

  const syllables = [];
  const lines = [];
  for (const s of SECTIONS) {
    let beat = s.b0;
    (LYRICS[s.id] || []).forEach((src, li) => {
      const line = { id: `${s.id}${li}`, sec: s.id, idx: li, b0: beat, syl: [], words: [] };
      let word = null;
      src.trim().split(/\s+/).forEach(tok => {
        const [txt, d, m] = tok.split(':');
        const dur = parseFloat(d);
        if (txt !== '_') {
          const syl = {
            txt: txt.replace(/-$/, ''),
            b0: beat,
            b1: beat + dur,
            t0: tb(beat),
            t1: tb(beat + dur),
            midi: +m + s.key,
            vowel: vowelOf(txt),
            line,
          };
          line.syl.push(syl);
          syllables.push(syl);
          if (!word) {
            word = { txt: '', b0: beat, t0: syl.t0, syl: [] };
            line.words.push(word);
          }
          word.txt += syl.txt;
          word.syl.push(syl);
          word.b1 = syl.b1;
          word.t1 = syl.t1;
          if (!txt.endsWith('-')) word = null;
        }
        beat += dur;
      });
      line.b1 = beat;
      line.t0 = tb(line.b0);
      line.t1 = tb(line.b1);
      line.text = line.words.map(w => w.txt).join(' ');
      if (line.syl.length) {
        line.v0 = line.syl[0].t0;
        line.v1 = line.syl[line.syl.length - 1].t1;
        lines.push(line);
      }
    });
    if (LYRICS[s.id] && beat !== s.b1) console.warn(`[claude-pop] ${s.id} 的歌詞拍數 ${beat - s.b0} ≠ ${s.b1 - s.b0}`);
  }
  const lineById = Object.fromEntries(lines.map(l => [l.id, l]));

  // 嘴型：正在唱的音節（開口程度依母音，音頭張開、音尾收起）
  const OPEN = { a: 1, o: 0.8, e: 0.62, u: 0.45, i: 0.38 };
  let mCursor = 0;
  const mouth = t => {
    if (mCursor >= syllables.length || syllables[mCursor].t0 > t) mCursor = 0;
    while (mCursor < syllables.length - 1 && syllables[mCursor].t1 < t - 0.1) mCursor++;
    for (let i = mCursor; i < syllables.length && syllables[i].t0 <= t + 0.02; i++) {
      const s = syllables[i];
      if (t > s.t1 + 0.06) continue;
      const a = Math.min(1, (t - s.t0 + 0.02) / 0.05);
      const r = t > s.t1 - 0.04 ? Math.max(0, 1 - (t - (s.t1 - 0.04)) / 0.1) : 1;
      const len = s.t1 - s.t0;
      const hold = len > 0.5 ? 0.85 + 0.15 * Math.sin((t - s.t0) * 34) : 1;
      return { open: Math.max(0, a * r * hold) * OPEN[s.vowel], vowel: s.vowel, syl: s };
    }
    return { open: 0, vowel: 'e', syl: null };
  };

  const lerp = (a, b, k) => a + (b - a) * k;

  /* ---------- 合成 ----------
     整首一次排進同一個 OfflineAudioContext 會很慢（幾千個節點每一小段都要算），
     所以分成 5 秒一段：每段只放這段開始的音符，輸出成 5 條單聲道音軌
     （主乾聲、殘響送出、延遲送出、尾聲乾聲、尾聲殘響），疊加起來之後，
     最後再用一個小的 context 加殘響、延遲、壓縮，並在奇點那一刻切斷主音軌 */
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const FORMANTS = {
    a: [850, 1220, 2810],
    e: [560, 1900, 2850],
    i: [330, 2700, 3300],
    o: [480, 880, 2830],
    u: [380, 940, 2670],
  };

  // 編曲 → 事件表：{ t（開始秒數）, fn(c, D, t) }
  function arrange(only) {
    const ev = [];
    const kicks = [];
    let type = '';
    const at = (t, fn) => { if (!only || only.includes(type)) ev.push({ t, fn }); };
    const as = (name, f) => (...args) => { type = name; return f(...args); };

    const env = (g, t, a, peak, d) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    };
    const filt = (c, type, f, q = 0.7) => {
      const x = c.createBiquadFilter();
      x.type = type;
      x.frequency.value = f;
      x.Q.value = q;
      return x;
    };
    const chain = (...nodes) => {
      for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
      return nodes[nodes.length - 1];
    };
    const noiseSrc = (c, D, t, dur) => {
      const n = c.createBufferSource();
      n.buffer = D.noise;
      n.start(t, (t * 7.31) % 0.5);
      n.stop(t + dur);
      return n;
    };

    /* 樂器（c：這一段的 context；D：這一段的匯流排） */
    const kick = (T, v = 1) => {
      kicks.push(T);
      at(T, (c, D, t) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.setValueAtTime(160, t);
        o.frequency.exponentialRampToValueAtTime(46, t + 0.09);
        env(g, t, 0.003, v, 0.36);
        chain(o, g, D.drum);
        o.start(t);
        o.stop(t + 0.4);
        const ng = c.createGain();
        env(ng, t, 0.001, 0.22 * v, 0.018);
        chain(noiseSrc(c, D, t, 0.03), filt(c, 'highpass', 2600), ng, D.drum);
      });
    };
    const snare = (T, v = 1) => at(T, (c, D, t) => {
      const ng = c.createGain();
      env(ng, t, 0.002, 0.55 * v, 0.2);
      const f = chain(noiseSrc(c, D, t, 0.24), filt(c, 'bandpass', 1900, 0.8), ng);
      f.connect(D.drum);
      f.connect(D.rev);
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(210, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      const og = c.createGain();
      env(og, t, 0.002, 0.42 * v, 0.12);
      chain(o, og, D.drum);
      o.start(t);
      o.stop(t + 0.14);
    });
    const clap = (T, v = 1) => at(T, (c, D, t) => {
      [0, 0.011, 0.024].forEach((d, i) => {
        const g = c.createGain();
        env(g, t + d, 0.001, 0.42 * v, i === 2 ? 0.17 : 0.02);
        const f = chain(noiseSrc(c, D, t + d, 0.2), filt(c, 'bandpass', 1250, 1.3), g);
        f.connect(D.drum);
        if (i === 2) f.connect(D.rev);
      });
    });
    const hat = (T, v = 0.18, open = false) => at(T, (c, D, t) => {
      const g = c.createGain();
      env(g, t, 0.001, v, open ? 0.24 : 0.045);
      chain(noiseSrc(c, D, t, open ? 0.3 : 0.06), filt(c, 'highpass', open ? 7000 : 8500), g, D.drum);
    });
    const crash = (T, v = 0.22) => at(T, (c, D, t) => {
      const g = c.createGain();
      env(g, t, 0.002, v, 1.6);
      const f = chain(noiseSrc(c, D, t, 1.7), filt(c, 'highpass', 4800), g);
      f.connect(D.drum);
      f.connect(D.rev);
    });
    const impact = (T, v = 0.8) => at(T, (c, D, t) => {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 0.6);
      const g = c.createGain();
      env(g, t, 0.004, v, 1.1);
      chain(o, g, D.drum);
      o.start(t);
      o.stop(t + 1.2);
      const ng = c.createGain();
      env(ng, t, 0.002, 0.35 * v, 0.5);
      const f = chain(noiseSrc(c, D, t, 0.6), filt(c, 'lowpass', 1400), ng);
      f.connect(D.drum);
      f.connect(D.rev);
    });
    const riser = (T0, T1, v = 0.2) => at(T0, (c, D, t) => {
      const t1 = t + (T1 - T0);
      const n = c.createBufferSource();
      n.buffer = D.noise;
      n.loop = true;
      const f = filt(c, 'bandpass', 300, 2.2);
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(7600, t1);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t1 - 0.01);
      g.gain.linearRampToValueAtTime(0, t1);
      chain(n, f, g);
      g.connect(D.main);
      g.connect(D.rev);
      n.start(t);
      n.stop(t1 + 0.02);
    });
    const bass = (T, d, m, v = 0.42) => at(T, (c, D, t) => {
      const f = mtof(m);
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const s = c.createOscillator();
      s.frequency.value = f;
      const lp = filt(c, 'lowpass', 1300, 2);
      lp.frequency.setValueAtTime(1500, t);
      lp.frequency.exponentialRampToValueAtTime(320, t + Math.max(0.08, d));
      // 混音：貝斯整體壓低，讓大鼓出得來
      const lv = v * 0.3;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(lv, t + 0.006);
      g.gain.setValueAtTime(lv, t + Math.max(0.01, d - 0.03));
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.04);
      const sg = c.createGain();
      sg.gain.value = 0.5;
      chain(o, lp, g);
      chain(s, sg, g);
      g.connect(D.main);
      o.start(t);
      s.start(t);
      o.stop(t + d + 0.06);
      s.stop(t + d + 0.06);
    });
    const pad = (T, d, notes, cutoff = 1500, v = 0.05) => at(T, (c, D, t) => {
      notes.forEach(m => {
        [-7, 7].forEach(cents => {
          const o = c.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = mtof(m);
          o.detune.value = cents;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.3, d * 0.4));
          g.gain.setValueAtTime(v, t + d * 0.85);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35);
          chain(o, filt(c, 'lowpass', cutoff, 0.6), g, D.pad);
          o.start(t);
          o.stop(t + d + 0.4);
        });
      });
    });
    const pluck = (T, m, v = 0.07, type = 'square', dec = 0.16) => at(T, (c, D, t) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = mtof(m);
      const lp = filt(c, 'lowpass', 3600, 1);
      lp.frequency.setValueAtTime(4200, t);
      lp.frequency.exponentialRampToValueAtTime(500, t + dec);
      const g = c.createGain();
      env(g, t, 0.003, v * 2.4, dec + 0.05);
      const x = chain(o, lp, g);
      x.connect(D.main);
      x.connect(D.rev);
      o.start(t);
      o.stop(t + dec + 0.08);
    });
    const piano = (T, m, v = 0.16) => at(T, (c, D, t) => {
      const f = mtof(m);
      [[1, 1], [2, 0.38], [3, 0.14], [4.02, 0.06]].forEach(([k, a], i) => {
        const o = c.createOscillator();
        o.frequency.value = f * k;
        o.detune.value = i ? 3 : 0;
        const g = c.createGain();
        env(g, t, 0.006, v * a, 3.6 / (1 + i * 0.6));
        o.connect(g);
        g.connect(D.outro);
        g.connect(D.outroRev);
        o.start(t);
        o.stop(t + 4);
      });
    });
    const bell = (T, m, v = 0.08) => at(T, (c, D, t) => {
      const f = mtof(m);
      [[1, 1], [2.76, 0.4], [5.4, 0.18]].forEach(([k, a], i) => {
        const o = c.createOscillator();
        o.frequency.value = f * k;
        const g = c.createGain();
        env(g, t, 0.003, v * a, 2.6 / (1 + i));
        o.connect(g);
        g.connect(D.outro);
        g.connect(D.outroRev);
        o.start(t);
        o.stop(t + 2.8);
      });
    });
    // 「人聲」：鋸齒波 + 三組共振峰帶通，加一點正弦波的身體；長音才有抖音
    const vox = (s, prev, outro) => at(s.t0, (c, D, t) => {
      const level = outro ? 0.2 : 0.3;
      const d = Math.max(0.07, s.t1 - s.t0 - 0.03);
      const f = mtof(s.midi);
      const glide = prev && s.t0 - prev.t1 < 0.08 && prev.midi !== s.midi;
      const oscs = ['sawtooth', 'sine'].map(type => {
        const o = c.createOscillator();
        o.type = type;
        if (glide) {
          o.frequency.setValueAtTime(mtof(prev.midi), t);
          o.frequency.exponentialRampToValueAtTime(f, t + 0.045);
        } else {
          o.frequency.setValueAtTime(f, t);
        }
        return o;
      });
      if (d > 0.3) {
        const lfo = c.createOscillator();
        lfo.frequency.value = 5.6;
        const lg = c.createGain();
        lg.gain.setValueAtTime(0, t);
        lg.gain.setValueAtTime(0, t + 0.16);
        lg.gain.linearRampToValueAtTime(f * 0.014, t + Math.min(d, 0.5));
        lfo.connect(lg);
        oscs.forEach(o => lg.connect(o.frequency));
        lfo.start(t);
        lfo.stop(t + d + 0.1);
      }
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + 0.022);
      g.gain.exponentialRampToValueAtTime(level * 0.78, t + 0.12);
      g.gain.setValueAtTime(level * 0.78, t + d);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.07);
      const fm = FORMANTS[s.vowel];
      [[fm[0], 5, 1], [fm[1], 7, 0.62], [fm[2], 9, 0.3]].forEach(([ff, q, a]) => {
        const ag = c.createGain();
        ag.gain.value = a * 2.1;
        oscs[0].connect(filt(c, 'bandpass', Math.max(ff, f * 1.08), q)).connect(ag).connect(g);
      });
      const body = c.createGain();
      body.gain.value = 0.34;
      chain(oscs[1], body, g);
      if (outro) {
        g.connect(D.outro);
        g.connect(D.outroRev);
      } else {
        g.connect(D.vox);
      }
      oscs.forEach(o => { o.start(t); o.stop(t + d + 0.1); });
    });

    // 依樂器分類（render 的 only 參數可以只合成某幾類，拿來檢查混音）
    const I = { kick: as('drums', kick), snare: as('drums', snare), clap: as('drums', clap), hat: as('drums', hat), crash: as('fx', crash), impact: as('fx', impact), riser: as('fx', riser), bass: as('bass', bass), pad: as('pad', pad), pluck: as('pluck', pluck), piano: as('outro', piano), bell: as('outro', bell) };

    /* 編曲：每一段的鼓、貝斯、和弦墊、琶音 */
    for (const s of SECTIONS) {
      const prog = PROG[s.id];
      for (let i = 0; i < s.bars; i++) {
        const b = s.b0 + i * 4;
        const T = x => tb(b + x);
        const name = prog[i];
        const ch = name && CH[name];
        const k = s.key;
        const notes = ch ? ch.notes.map(n => n + k) : [];
        const root = ch ? ch.root + k : 0;
        const dur = T(4) - T(0);

        switch (s.id) {
          case 'intro':
            I.pad(T(0), dur, notes, i < 2 ? 700 : 1200, 0.045);
            I.kick(T(0), 0.8);
            if (i >= 2) {
              I.kick(T(2), 0.7);
              [0.5, 1.5, 2.5, 3.5].forEach(x => I.hat(T(x), 0.1));
              I.bass(T(0), T(1.5) - T(0), root, 0.32);
              I.bass(T(2), T(3.5) - T(2), root, 0.32);
            }
            if (i === 3) {
              I.clap(T(2.5), 1);
              I.riser(T(0), T(4), 0.18);
              for (let x = 3; x < 4; x += 0.25) I.snare(T(x), 0.25 + (x - 3) * 0.6);
            }
            break;
          case 'verse':
            if (i === 0) { I.impact(T(0), 0.6); I.crash(T(0), 0.16); }
            I.pad(T(0), dur, notes, 1300, 0.04);
            I.kick(T(0));
            I.kick(T(2));
            if (i % 2) I.kick(T(2.5), 0.7);
            I.snare(T(1), 0.8);
            I.snare(T(3), 0.8);
            for (let x = 0; x < 4; x += 0.5) I.hat(T(x), x % 1 ? 0.15 : 0.08);
            for (let x = 0; x < 4; x += 0.5) I.bass(T(x), (T(x + 0.5) - T(x)) * 0.8, root + (x === 1.5 || x === 3.5 ? 12 : 0), 0.38);
            [0.5, 1.5, 2.5, 3.5].forEach(x => notes.slice(0, 3).forEach(n => I.pluck(T(x), n + 12, 0.028, 'triangle', 0.14)));
            break;
          case 'pre':
            I.pad(T(0), dur, notes, 1500 + i * 500, 0.045);
            for (let x = 0; x < 4; x++) I.kick(T(x), 0.9);
            if (i < 2) {
              I.snare(T(1), 0.8);
              I.snare(T(3), 0.8);
              for (let x = 0; x < 4; x += 0.5) I.hat(T(x), 0.14);
              for (let x = 0; x < 4; x += 0.5) I.bass(T(x), (T(x + 0.5) - T(x)) * 0.8, root, 0.4);
            } else {
              const step = i === 2 ? 0.5 : 0.25;
              for (let x = 0; x < 4; x += step) I.snare(T(x), 0.35 + ((i - 2) * 4 + x) / 8 * 0.6);
              for (let x = 0; x < 4; x += 0.5) I.bass(T(x), (T(x + 0.5) - T(x)) * 0.8, root + (x % 1 ? 12 : 0), 0.4);
              if (i === 2) I.riser(T(0), tb(s.b1), 0.24);
            }
            break;
          case 'chorus':
          case 'final': {
            const big = s.id === 'final';
            if (i === 0 || i === 4) I.crash(T(0), big ? 0.26 : 0.2);
            if (i === 0) I.impact(T(0), big ? 1 : 0.8);
            I.pad(T(0), dur, notes, big ? 2600 : 2000, big ? 0.05 : 0.045);
            if (big) I.pad(T(0), dur, notes.map(n => n + 12), 3200, 0.022);
            for (let x = 0; x < 4; x++) I.kick(T(x));
            I.clap(T(1));
            I.clap(T(3));
            if (big && i % 2) I.clap(T(3.5), 0.6);
            [0.5, 1.5, 2.5, 3.5].forEach(x => I.hat(T(x), 0.15, true));
            for (let x = 0; x < 4; x += 0.25) if (x % 0.5) I.hat(T(x), 0.06);
            for (let x = 0; x < 4; x += 0.5) I.bass(T(x), (T(x + 0.5) - T(x)) * 0.78, root + (x % 1 ? 12 : 0), 0.4);
            const arp = [0, 1, 2, 3, 2, 1, 2, 3];
            for (let x = 0, j = 0; x < 4; x += 0.25, j++) I.pluck(T(x), notes[arp[j % 8] % notes.length] + 12, big ? 0.05 : 0.042, 'square', 0.12);
            break;
          }
          case 'break':
            if (i === 0) { I.impact(T(0), 0.7); I.crash(T(0), 0.18); }
            if (i < 6) {
              I.pad(T(0), dur, notes, 900 + i * 180, 0.04);
              for (let x = 0; x < 4; x++) I.kick(T(x), 0.95);
              if (i === 5) [3.25, 3.5, 3.75].forEach(x => I.kick(T(x), 0.7));
              I.snare(T(1), 0.7);
              I.snare(T(3), 0.7);
              for (let x = 0; x < 4; x += 0.5) I.hat(T(x), x % 1 ? 0.16 : 0.07);
              for (let x = 0; x < 4; x += 0.25) I.bass(T(x), (T(x + 0.25) - T(x)) * 0.7, root + ((x * 4) % 3 === 2 ? 12 : 0), 0.36);
              [0.75, 2.25, 3.5].forEach(x => I.pluck(T(x), notes[2] + 24, 0.04, 'square', 0.08));
            } else if (i === 6) {
              I.impact(T(0), 0.9);
              I.pad(T(0), dur, notes, 600, 0.05);
              I.bass(T(0), dur * 0.95, root, 0.45);
            } else {
              I.riser(T(0), tb(s.b1), 0.26);
              for (let x = 0; x < 4; x += 0.25) I.snare(T(x), 0.3 + x / 4 * 0.6);
              for (let x = 0; x < 4; x += 0.5) I.kick(T(x), 0.5 + x / 8);
            }
            break;
          case 'sing': {
            I.pad(T(0), dur, notes, 2400 + i * 900, 0.05);
            const ks = [1, 0.5, 0.5, 0.25][i];
            const ss = [0.5, 0.5, 0.25, 0.25][i];
            for (let x = 0; x < 4; x += ks) I.kick(T(x), 0.9);
            for (let x = 0; x < 4; x += ss) I.snare(T(x), 0.35 + (i * 4 + x) / 16 * 0.55);
            for (let x = 0; x < 4; x += 0.25) I.hat(T(x), 0.12);
            for (let x = 0; x < 4; x += 0.5) I.bass(T(x), (T(x + 0.5) - T(x)) * 0.8, root + (x % 1 ? 12 : 0), 0.42);
            for (let x = 0, j = 0; x < 4; x += 0.25, j++) I.pluck(T(x), notes[j % notes.length] + 12 + (j % 8 > 3 ? 12 : 0), 0.045, 'square', 0.08);
            if (i === 0) { I.crash(T(0), 0.24); I.riser(T(0), tb(s.b1), 0.3); }
            break;
          }
          case 'outro':
            if (i === 0) {
              // 一刀切斷之後：只剩一個很輕的鈴聲
              I.bell(T(1.2), 86 + k - 2, 0.05);
            } else if (ch) {
              notes.forEach((n, j) => I.piano(T(0) + j * 0.022, n, 0.1));
              I.piano(T(0), root, 0.12);
              if (i === 3) notes.forEach((n, j) => I.bell(T(1) + j * 0.05, n + 24, 0.03));
            }
            break;
        }
      }
    }
    const V = as('vox', vox);
    syllables.forEach((s, i) => V(s, syllables[i - 1], s.line.sec === 'outro'));
    ev.sort((a, b) => a.t - b.t);
    kicks.sort((a, b) => a - b);
    return { ev, kicks };
  }

  // 殘響的脈衝響應（立體聲噪音 × 指數衰減）
  const impulse = (c, dur, decay, seed) => {
    const sr = c.sampleRate;
    const n = Math.floor(dur * sr);
    const b = c.createBuffer(2, n, sr);
    let x = seed;
    const rand = () => ((x = (x * 16807) % 2147483647) / 2147483647);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 0.012 * sr ? i / (0.012 * sr) : 1);
    }
    return b;
  };

  async function render(onProgress, sampleRate = 44100, only) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) throw new Error('no OfflineAudioContext');
    const sr = sampleRate;
    const { ev, kicks } = arrange(only);
    const SEG = 5, TAIL = 5;
    const NM = Math.ceil((CUT + 0.05) * sr);          // 主音軌只到切斷為止
    const O0 = Math.floor(CUT * sr);                   // 尾聲音軌從切斷開始
    const NO = Math.ceil((END + 0.3 - CUT) * sr);
    const N = Math.ceil((END + 0.3) * sr);
    const stems = [NM, NM, NM, NO, NO].map(n => new Float32Array(n));
    const stemStart = [0, 0, 0, O0, O0];

    let seed = 1234567;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const noiseData = new Float32Array(sr);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = rand() * 2 - 1;
    // 紙張的沙沙聲：稀疏的爆音加一點點底噪
    const crackleData = new Float32Array(sr * 3);
    for (let i = 0; i < crackleData.length; i++) {
      crackleData[i] += (rand() * 2 - 1) * 0.04;
      if (rand() < 0.0009) {
        const a = (rand() * 2 - 1) * (0.4 + rand() * 0.6);
        for (let j = 0; j < 60 && i + j < crackleData.length; j++) crackleData[i + j] += a * Math.exp(-j / 9) * (rand() * 2 - 1);
      }
    }
    const crackleAt = t => (t < CUT ? (t < BY.verse.t0 ? lerp(0.5, 0.18, t / BY.verse.t0) : 0.18) : 0.22);

    const segs = Math.ceil(END / SEG);
    let ei = 0;
    for (let k = 0; k < segs; k++) {
      const a = k * SEG, bEnd = a + SEG;
      const c = new OAC(5, Math.ceil((SEG + TAIL) * sr), sr);
      c.destination.channelInterpretation = 'discrete';
      const merger = c.createChannelMerger(5);
      merger.connect(c.destination);
      const tap = i => {
        const g = c.createGain();
        g.channelCount = 1;
        g.channelCountMode = 'explicit';
        g.connect(merger, 0, i);
        return g;
      };
      const D = { main: tap(0), rev: tap(1), dly: tap(2), outro: tap(3), outroRev: tap(4) };
      D.noise = c.createBuffer(1, noiseData.length, sr);
      D.noise.copyToChannel(noiseData, 0);
      D.drum = c.createGain();
      D.drum.gain.value = 1.3;
      D.drum.connect(D.main);
      D.pad = c.createGain();
      D.pad.connect(D.main);
      D.pad.connect(D.rev);
      D.vox = c.createGain();
      D.vox.gain.value = 0.9;
      D.vox.connect(D.main);
      const vs = c.createGain();
      vs.gain.value = 0.5;
      D.vox.connect(vs);
      vs.connect(D.rev);
      vs.connect(D.dly);
      // 和弦墊跟著大鼓壓縮（sidechain 的抽吸感）
      D.pad.gain.setValueAtTime(1, 0);
      kicks.forEach((kt, i) => {
        if (kt < a - 0.3 || kt > bEnd + TAIL || kt >= CUT) return;
        const next = i + 1 < kicks.length ? kicks[i + 1] : kt + 0.3;
        if (next - kt < 0.06) return;
        const t = kt - a;
        if (t < 0) return;
        D.pad.gain.setValueAtTime(1, t);
        D.pad.gain.linearRampToValueAtTime(0.32, t + 0.012);
        D.pad.gain.linearRampToValueAtTime(1, Math.min(t + 0.22, next - a - 0.005));
      });
      // 紙張沙沙聲（每段各自一條，只填這一段）
      const ca = Math.max(a, 0), cb = Math.min(bEnd, END);
      if (cb > ca && (!only || only.includes('fx'))) {
        const cr = c.createBufferSource();
        const crb = c.createBuffer(1, crackleData.length, sr);
        crb.copyToChannel(crackleData, 0);
        cr.buffer = crb;
        cr.loop = true;
        const cg = c.createGain();
        cg.gain.setValueAtTime(crackleAt(ca), ca - a);
        cg.gain.linearRampToValueAtTime(crackleAt(cb), cb - a);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2600;
        bp.Q.value = 0.5;
        cr.connect(bp).connect(cg);
        if (ca < CUT) {
          cg.connect(D.main);
          cr.start(ca - a, (ca * 1.37) % 3);
          cr.stop(Math.min(cb, CUT) - a);
        } else if (ca >= CUT + 0.4) {
          cg.connect(D.outro);
          cr.start(ca - a, (ca * 1.37) % 3);
          cr.stop(cb - a);
        }
      }
      while (ei < ev.length && ev[ei].t < bEnd) {
        const e = ev[ei++];
        if (e.t >= a) e.fn(c, D, e.t - a);
      }
      const buf = await c.startRendering();
      const off = Math.floor(a * sr);
      for (let ch = 0; ch < 5; ch++) {
        const src = buf.getChannelData(ch);
        const dst = stems[ch];
        const base = off - stemStart[ch];
        for (let i = 0; i < src.length; i++) {
          const j = base + i;
          if (j >= 0 && j < dst.length) dst[j] += src[i];
        }
      }
      if (onProgress) onProgress((k + 1) / (segs + 1));
    }

    // 最後一道：殘響、延遲、壓縮；主音軌在奇點那一刻切斷（連殘響一起）
    const fc = new OAC(2, N, sr);
    const comp = fc.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    // 最後再一道很快的限幅，避免削峰
    const lim = fc.createDynamicsCompressor();
    lim.threshold.value = -4;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.08;
    const out = fc.createGain();
    out.gain.value = 0.9;
    comp.connect(lim).connect(out).connect(fc.destination);
    const mainBus = fc.createGain();
    mainBus.connect(comp);
    mainBus.gain.setValueAtTime(1, 0);
    mainBus.gain.setValueAtTime(1, CUT - 0.006);
    mainBus.gain.linearRampToValueAtTime(0, CUT);
    const outroBus = fc.createGain();
    outroBus.connect(comp);
    const verb = (bus, dur, decay, wet, s) => {
      const cv = fc.createConvolver();
      cv.buffer = impulse(fc, dur, decay, s);
      const g = fc.createGain();
      g.gain.value = wet;
      cv.connect(g).connect(bus);
      return cv;
    };
    const rev = verb(mainBus, 2.2, 3.2, 0.34, 99991);
    const revOut = verb(outroBus, 4.2, 2.4, 0.5, 77777);
    const delay = fc.createDelay(1);
    delay.delayTime.value = 0.33;
    const fb = fc.createGain();
    fb.gain.value = 0.3;
    const tone = fc.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3200;
    const dWet = fc.createGain();
    dWet.gain.value = 0.2;
    delay.connect(tone);
    tone.connect(fb);
    fb.connect(delay);
    tone.connect(dWet);
    dWet.connect(mainBus);
    dWet.connect(rev);
    const play = (data, start, dest) => {
      const b = fc.createBuffer(1, data.length, sr);
      b.copyToChannel(data, 0);
      const s = fc.createBufferSource();
      s.buffer = b;
      s.connect(dest);
      s.start(start / sr);
    };
    play(stems[0], 0, mainBus);
    play(stems[1], 0, rev);
    play(stems[2], 0, delay);
    play(stems[3], O0, outroBus);
    play(stems[4], O0, revOut);
    const result = await fc.startRendering();
    if (onProgress) onProgress(1);
    return result;
  }

  window.ClaudePopSong = {
    SECTIONS, BY, BEATS, NB, END, CUT, T0,
    tb, bt, bpmAt, sectionAt,
    lines, lineById, syllables, mouth,
    render,
  };
})();
