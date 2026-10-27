(() => {
  const hero = document.querySelector('.hero');
  const chapters = [...document.querySelectorAll('.chapter')];
  const pills = [...document.querySelectorAll('.pills a[data-scene]')];
  const bar = document.querySelector('.progress i');
  const counter = document.querySelector('.counter');
  const hint = document.querySelector('.hint');
  const last = chapters.length - 1;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // a little hold at the start and the end of the scroll
  const HOLD = 0.3;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  const world = window.Scene3D && Scene3D.init(document.querySelector('.gl'));
  if (!world) document.querySelector('.stage').classList.add('no-gl');

  const span = () => hero.offsetHeight - innerHeight;
  const toProgress = y => clamp((y / span()) * (last + 2 * HOLD) - HOLD, 0, last);
  const toScroll = p => hero.offsetTop + ((p + HOLD) / (last + 2 * HOLD)) * span();

  let ticking = false;
  function render() {
    ticking = false;
    const p = toProgress(scrollY - hero.offsetTop);
    if (world) world.setProgress(p);

    chapters.forEach((el, i) => {
      const d = p - i;
      const op = clamp(1 - Math.abs(d) * 2.6);
      el.style.opacity = op;
      el.style.setProperty('--y', `${still ? 0 : -d * 70}px`);
      el.classList.toggle('is-live', op > 0.5);
    });

    const active = Math.round(p);
    const inHero = scrollY - hero.offsetTop <= span();
    pills.forEach(a => a.classList.toggle('is-active', inHero && +a.dataset.scene === active));
    bar.style.transform = `scaleY(${p / last})`;
    counter.textContent = String(active + 1).padStart(2, '0');
    hint.style.opacity = p > 0.15 ? 0 : 1;
  }

  const request = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(render); }
  };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request);

  // chapters live inside the sticky stage, so anchor jumps need translating to scroll positions
  pills.forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    scrollTo({ top: toScroll(+a.dataset.scene), behavior: still ? 'auto' : 'smooth' });
  }));
  document.querySelector('.brand').addEventListener('click', e => {
    e.preventDefault();
    scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
  });

  render();
})();
