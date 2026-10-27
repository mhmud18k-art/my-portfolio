(() => {
  const hero = document.querySelector('.hero');
  const scenes = [...document.querySelectorAll('.scene')];
  const chapters = [...document.querySelectorAll('.chapter')];
  const pills = [...document.querySelectorAll('.pills a[data-scene]')];
  const bar = document.querySelector('.progress i');
  const counter = document.querySelector('.counter');
  const hint = document.querySelector('.hint');
  const last = scenes.length - 1;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // a little hold at the start and the end of the scroll
  const HOLD = 0.3;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t * t * (3 - 2 * t);

  // seeded so the drawings come out the same on every load
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  document.querySelectorAll('.stars').forEach(g => {
    const n = +g.dataset.count, h = +(g.dataset.h || 900);
    let out = '';
    for (let i = 0; i < n; i++) {
      const r = rand() < 0.08 ? 1.2 + rand() * 1.2 : 0.4 + rand() * 0.8;
      out += `<circle cx="${(rand() * 1600).toFixed(1)}" cy="${(rand() * h).toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" opacity="${(0.3 + rand() * 0.7).toFixed(2)}"/>`;
    }
    g.innerHTML = out;
  });

  // flat-roofed houses with a few lit windows
  document.querySelectorAll('.city').forEach(g => {
    seed = +g.dataset.seed;
    const base = +g.dataset.y, hmin = +g.dataset.hmin, hmax = +g.dataset.hmax;
    const fill = g.dataset.fill, lit = +g.dataset.lit;
    let out = '', x = -20;
    while (x < 1620) {
      const w = 70 + rand() * 110, h = hmin + rand() * (hmax - hmin), top = base - h;
      out += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${(w + 1).toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}"/>`;
      if (rand() < 0.4) out += `<rect x="${(x + 6).toFixed(1)}" y="${(top - 8).toFixed(1)}" width="${(w - 12).toFixed(1)}" height="8" fill="${fill}"/>`;
      for (let wy = top + 18; wy < base - 24; wy += 34) {
        for (let wx = x + 14; wx < x + w - 22; wx += 30) {
          if (rand() < lit) out += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="12" height="16" rx="1" fill="#ffc77a" opacity="${(0.55 + rand() * 0.45).toFixed(2)}"/>`;
        }
      }
      x += w;
    }
    g.innerHTML = out;
  });

  // the subjects sit left of centre to stay clear of the headlines, so narrow screens crop toward them
  const narrow = matchMedia('(max-width: 760px)');
  const frame = () => scenes.forEach(el => {
    const svg = el.querySelector('svg');
    svg.setAttribute('viewBox', narrow.matches ? '180 0 1600 900' : '0 0 1600 900');
    svg.setAttribute('preserveAspectRatio', narrow.matches ? 'xMinYMid slice' : 'xMidYMid slice');
  });
  narrow.addEventListener('change', frame);
  frame();

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
