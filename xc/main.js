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

  const veil = document.querySelector('.veil');
  // assigned below; the scene calls stage() on its first frame, before init returns
  let world = null;
  const photos = [...document.querySelectorAll('.photo')];
  const ready = photos.map(() => false);

  // p is the eased camera progress when the 3D scene runs, the raw scroll progress otherwise
  let shown = 0;
  function stage(p) {
    shown = p;
    const i = Math.min(last, Math.max(0, Math.round(p)));
    // dip to black around each cut between shots
    const edge = Math.abs(p - Math.round(p - 0.5) - 0.5);
    veil.style.opacity = (p > 0.3 && p < last - 0.3 ? Math.max(0, 1 - edge / 0.09) : 0).toFixed(3);
    // a photo, where there is one, takes over its shot and dollies in like the camera would
    const u = clamp(p - i + 0.5);
    photos.forEach((el, k) => {
      el.style.opacity = ready[k] && k === i ? 1 : 0;
      if (k === i && !still) el.style.transform = `scale(${1.04 + 0.1 * u}) translate3d(${((0.5 - u) * 1.6).toFixed(2)}%,0,0)`;
    });
    if (world) world.setHidden(ready[i]);
  }

  world = window.Scene3D ? Scene3D.init(document.querySelector('.gl'), { onFrame: stage }) : null;
  if (!world) document.querySelector('.stage').classList.add('no-gl');

  photos.forEach((el, k) => {
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url("${el.dataset.src}")`;
      ready[k] = true;
      stage(shown);
    };
    img.src = el.dataset.src;
  });

  const span = () => hero.offsetHeight - innerHeight;
  const toProgress = y => clamp((y / span()) * (last + 2 * HOLD) - HOLD, 0, last);
  const toScroll = p => hero.offsetTop + ((p + HOLD) / (last + 2 * HOLD)) * span();

  let ticking = false;
  function render() {
    ticking = false;
    const p = toProgress(scrollY - hero.offsetTop);
    if (world) world.setProgress(p);
    else stage(p);

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
