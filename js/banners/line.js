/* 06 線條描繪：SVG 線條依序畫出、太陽上色，之後海浪與飛鳥微微漂動 */
MB.banners.line = (root, { finePointer }) => {
  const { $, $$ } = MB;
  const art = $('.ln-art', root);
  const strokes = [$('.ln-frame', art), ...$$('g .ln-stroke', art), $('.ln-base', art)];
  const sunFill = $('.ln-sun-fill', art);
  const link = $('.ln-link', root);

  const intro = gsap.timeline({ paused: true })
    // 透明度一起淡入，避免線頭的圓角在還沒畫之前先露出一個點
    .fromTo(strokes, { strokeDashoffset: 1, opacity: 0 }, {
      strokeDashoffset: 0, opacity: 1, duration: 1.4, ease: 'power2.inOut', stagger: 0.14,
    })
    .fromTo(sunFill, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 1.2, ease: 'expo.out' }, 1)
    .from($$('.ln-title .rl > span', root), { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.12 }, 0.2)
    .from([$('.ln-kicker', root), $('.ln-en', root), $('.ln-sub', root), link], {
      y: 18, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1,
    }, 0.5)
    .fromTo(link, { '--line': 0 }, { '--line': 1, duration: 0.8, ease: 'expo.inOut' }, 1.3);

  const loops = [
    gsap.to($('.ln-waves', art), { x: 14, duration: 2.4, ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true }),
    gsap.to($('.ln-birds', art), { x: 8, y: -8, duration: 1.8, ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true }),
    gsap.to(sunFill, { scale: 1.06, transformOrigin: '50% 50%', duration: 2.2, ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true }),
  ];

  // 太陽和山丘往相反方向移動，做出前後景深
  if (finePointer) {
    const sunX = gsap.quickTo($('.ln-sun', art), 'x', { duration: 1, ease: 'power3' });
    const hillX = gsap.quickTo($('.ln-hills', art), 'x', { duration: 1, ease: 'power3' });
    root.addEventListener('pointermove', e => {
      const r = root.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      sunX(nx * -18);
      hillX(nx * 10);
    });
    root.addEventListener('pointerleave', () => { sunX(0); hillX(0); });
  }

  return {
    intro,
    play: () => loops.forEach(l => l.play()),
    pause: () => loops.forEach(l => l.pause()),
    reset: () => loops.forEach(l => l.pause(0)),
  };
};
