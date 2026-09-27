/* 01 幾何構成：九宮格拼貼彈出，之後隨機轉動其中一格 */
MB.banners.geo = (root, { finePointer }) => {
  const { $, $$ } = MB;
  const grid = $('.geo-grid', root);
  const tiles = $$('.tile', root);
  const shapes = $$('.sh', root);
  const stagger = { grid: [3, 3], from: 'start', amount: 0.6 };

  const intro = gsap.timeline({ paused: true })
    .from(tiles, { scale: 0, rotation: -90, duration: 0.8, ease: 'back.out(1.6)', stagger })
    .from(shapes, { scale: 0, duration: 0.6, ease: 'back.out(2.2)', stagger }, 0.35)
    .from($$('.geo-title .rl > span', root), { yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.1 }, 0.15)
    .from([$('.geo-eyebrow', root), $('.geo-sub', root), $('.btn', root)], {
      y: 20, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08,
    }, 0.45);

  const loop = gsap.timeline({ repeat: -1, paused: true })
    .call(() => {
      gsap.to(gsap.utils.random(shapes), {
        rotation: `+=${gsap.utils.random([90, 180, -90])}`,
        duration: 0.9,
        ease: 'expo.inOut',
      });
    })
    .to({}, { duration: 1.1 });

  // 滑鼠移動時整個拼貼跟著 3D 傾斜
  if (finePointer) {
    gsap.set(grid, { transformPerspective: 900 });
    const rx = gsap.quickTo(grid, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(grid, 'rotationY', { duration: 0.8, ease: 'power3' });
    root.addEventListener('pointermove', e => {
      const r = root.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 18);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 18);
    });
    root.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }

  return {
    intro,
    play: () => loop.play(),
    pause: () => loop.pause(),
    reset: () => {
      gsap.killTweensOf(shapes, 'rotation');
      gsap.set(shapes, { rotation: 0 });
    },
  };
};
