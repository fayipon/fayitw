/* 02 動態字體：字寬波浪、單字替換、跑馬燈帶 */
MB.banners.kinetic = root => {
  const { $, $$, splitChars } = MB;
  const chars = splitChars($('.kt-l1', root));
  const slot = $('.kt-slot', root);
  const words = $$('.kt-word', slot);
  const track = $('.kt-track', root);
  let index = 0;

  // 替換框的寬度跟著當下的單字走
  const padX = () => {
    const cs = getComputedStyle(slot);
    return parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  };
  const widthOf = i => words[i].offsetWidth + padX();
  const fitSlot = () => gsap.set(slot, { width: widthOf(index) });

  function placeWords() {
    gsap.set(words, { autoAlpha: 1, yPercent: i => (i === index ? 0 : 110) });
  }

  placeWords();
  gsap.set(chars, { '--wdth': 100 });
  track.innerHTML += track.innerHTML;

  const intro = gsap.timeline({ paused: true })
    .from(chars, { yPercent: 120, duration: 1, ease: 'expo.out', stagger: 0.05 })
    .from(slot, { scaleX: 0, transformOrigin: '0% 50%', duration: 0.8, ease: 'expo.inOut' }, 0.3)
    .from(words[0], { yPercent: 110, duration: 0.7, ease: 'expo.out' }, 0.8)
    .from($('.kt-dot', root), { scale: 0, transformOrigin: '50% 80%', duration: 0.6, ease: 'back.out(3)' }, 1)
    .from($('.kt-band', root), { xPercent: -110, duration: 1.1, ease: 'expo.out' }, 0.6)
    .from($$('.kt-foot > *', root), { y: 20, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 }, 1);

  let swap;
  function nextWord() {
    const current = words[index];
    index = (index + 1) % words.length;
    swap = gsap.timeline({ defaults: { duration: 0.7, ease: 'expo.inOut' } })
      .to(current, { yPercent: -110 }, 0)
      .fromTo(words[index], { yPercent: 110 }, { yPercent: 0 }, 0)
      .to(slot, { width: widthOf(index) }, 0);
  }

  const loops = [
    // 每個字母輪流變窄、變寬，像波浪一樣傳過去
    gsap.to(chars, {
      keyframes: { '--wdth': [100, 70, 125, 100], easeEach: 'sine.inOut' },
      duration: 3.2,
      ease: 'none',
      stagger: { each: 0.12, repeat: -1 },
      paused: true,
    }),
    gsap.timeline({ repeat: -1, paused: true }).to({}, { duration: 1.8 }).call(nextWord),
    gsap.to(track, { xPercent: -50, duration: 18, ease: 'none', repeat: -1, paused: true }),
  ];

  if (document.fonts) document.fonts.ready.then(fitSlot);
  window.addEventListener('resize', fitSlot);

  return {
    intro,
    play: () => loops.forEach(l => l.play()),
    pause: () => loops.forEach(l => l.pause()),
    reset: () => {
      if (swap) swap.kill();
      index = 0;
      placeWords();
      fitSlot();
      loops[0].pause(0);
    },
  };
};
