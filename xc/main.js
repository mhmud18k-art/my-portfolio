(() => {
  const hero = document.querySelector('.hero');
  const scenes = [...document.querySelectorAll('.scene')];
  const chapters = [...document.querySelectorAll('.chapter')];
  const pills = [...document.querySelectorAll('.pills a')];
  const bar = document.querySelector('.progress i');
  const counter = document.querySelector('.counter');
  const hint = document.querySelector('.hint');
  const last = scenes.length - 1;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // a little hold at the start and the end of the scroll
  const HOLD = 0.3;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t * t * (3 - 2 * t);

  // pine silhouettes, seeded so the layout is the same on every load
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  document.querySelectorAll('.pines').forEach(g => {
    const n = +g.dataset.count, y = +g.dataset.y, h = +g.dataset.h;
    const x0 = +g.dataset.x0, x1 = +g.dataset.x1, spread = +(g.dataset.spread || 40);
    let out = '';
    for (let i = 0; i < n; i++) {
      const x = x0 + rand() * (x1 - x0);
      const dy = rand() * spread;
      const s = (0.6 + rand() * 0.6) * (1 + dy / 400);
      const ph = h * s, pw = ph * 0.34, by = y + dy + ph * 0.4;
      out += `<path d="M${x} ${by - ph}l${pw} ${ph}h${-pw * 2}z" fill="url(#g-pine)"/>`;
    }
    g.innerHTML = out;
  });

  // drop a real image at assets/scene-N.jpg and it replaces the drawing
  scenes.forEach(el => {
    const src = el.dataset.img;
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url("${src}")`;
      el.classList.add('has-img');
    };
    img.src = src;
  });

  const span = () => hero.offsetHeight - innerHeight;
  const toProgress = y => clamp((y / span()) * (last + 2 * HOLD) - HOLD, 0, last);
  const toScroll = p => hero.offsetTop + ((p + HOLD) / (last + 2 * HOLD)) * span();

  let ticking = false;
  function render() {
    ticking = false;
    const p = toProgress(scrollY - hero.offsetTop);

    scenes.forEach((el, i) => {
      // each scene fades in over the one before it, then the camera keeps pushing in
      const op = i === 0 ? 1 : ease(clamp((p - i + 0.65) / 0.4));
      const u = clamp((p - i + 1) / 2);
      el.style.opacity = op;
      el.style.visibility = op > 0 ? 'visible' : 'hidden';
      if (!still) {
        el.style.transform = `scale(${1 + 0.22 * u}) translate3d(${(0.5 - u) * 2.5}%,0,0)`;
      }
    });

    chapters.forEach((el, i) => {
      const d = p - i;
      const op = clamp(1 - Math.abs(d) * 2.6);
      el.style.opacity = op;
      el.style.setProperty('--y', `${still ? 0 : -d * 70}px`);
      el.classList.toggle('is-live', op > 0.5);
    });

    const active = Math.round(p);
    pills.forEach(a => a.classList.toggle('is-active', +a.dataset.scene === active));
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
