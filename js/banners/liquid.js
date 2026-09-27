/* 03 流體漸層：模糊色塊隨機漂移、文字模糊淡入、游標光暈 */
MB.banners.liquid = (root, { finePointer }) => {
  const { $, $$, splitWords } = MB;
  const blobs = $$('.blob:not(.b-cursor)', root);
  const pill = $('.lq-pill', root);
  const titleWords = splitWords($('.lq-title', root));
  const subWords = splitWords($('.lq-sub', root));
  const blurred = [pill, ...titleWords, ...subWords];

  const intro = gsap.timeline({ paused: true })
    .from(blobs, { scale: 0.2, opacity: 0, duration: 2, ease: 'power2.out', stagger: 0.15 })
    .from(pill, { y: 16, opacity: 0, filter: 'blur(8px)', duration: 0.8, ease: 'power3.out' }, 0.3)
    .from(titleWords, { y: 40, opacity: 0, filter: 'blur(16px)', duration: 1.1, ease: 'power3.out', stagger: 0.07 }, 0.45)
    .from(subWords, { opacity: 0, filter: 'blur(6px)', duration: 0.8, ease: 'power2.out', stagger: 0.012 }, 0.9)
    .from($$('.lq-actions .btn', root), { y: 16, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.1 }, 1.2)
    // 進場結束後拿掉 filter，避免殘留的 blur(0px) 占用合成層
    .set(blurred, { clearProps: 'filter' });

  const wander = blobs.map(blob => gsap.to(blob, {
    xPercent: 'random(-35, 35)',
    yPercent: 'random(-30, 30)',
    scale: 'random(0.8, 1.25)',
    duration: 'random(5, 8)',
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true,
    repeatRefresh: true,
    paused: true,
  }));

  if (finePointer) {
    const glow = $('.b-cursor', root);
    const xTo = gsap.quickTo(glow, 'x', { duration: 1.2, ease: 'power3' });
    const yTo = gsap.quickTo(glow, 'y', { duration: 1.2, ease: 'power3' });
    root.addEventListener('pointermove', e => {
      const r = root.getBoundingClientRect();
      xTo(e.clientX - r.left - glow.offsetWidth / 2);
      yTo(e.clientY - r.top - glow.offsetHeight / 2);
      gsap.to(glow, { opacity: 0.85, duration: 0.6, overwrite: 'auto' });
    });
    root.addEventListener('pointerleave', () => gsap.to(glow, { opacity: 0, duration: 0.8, overwrite: 'auto' }));
  }

  return {
    intro,
    play: () => wander.forEach(t => t.play()),
    pause: () => wander.forEach(t => t.pause()),
    reset: () => wander.forEach(t => t.pause(0)),
  };
};
