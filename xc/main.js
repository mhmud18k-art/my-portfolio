(() => {
  const hero = document.querySelector('.hero');
  const stageEl = document.querySelector('.stage');
  const chapters = [...document.querySelectorAll('.chapter')];
  const chaptersEl = document.querySelector('.chapters');
  const pills = [...document.querySelectorAll('.pills a[data-scene]')];
  const bar = document.querySelector('.progress i');
  const counter = document.querySelector('.counter');
  const hint = document.querySelector('.hint');
  const playBtn = document.querySelector('.play');
  const veil = document.querySelector('.veil');
  const photos = [...document.querySelectorAll('.photo')];
  const last = chapters.length - 1;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // a mouse looks around; touch screens get a slow sway instead
  const pointer = matchMedia('(pointer: fine)').matches;
  // a little hold at the start and the end of the scroll
  const HOLD = 0.3;
  // half the scroll distance, in shots, that a walk-through from one shot to the next takes
  const CUT = 0.14;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t * t * (3 - 2 * t);

  // which fallback photos have loaded
  const ready = photos.map(() => false);

  // the 3D world (scene3d.js), at a lighter tier on phones and modest machines
  const canvas = document.querySelector('.gl');
  const modest = !pointer || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  // ?tier=high or ?tier=low overrides the guess, for checking either on any machine;
  // ?debug hands the world to the console as window.world
  const params = new URLSearchParams(location.search);
  const tier = params.get('tier') || (modest ? 'low' : 'high');
  let world = window.Scene3D ? Scene3D.init(canvas, { still, tier, onFail: flatInstead }) : null;
  if (params.has('debug')) window.world = world;
  if (world) world.onReady = () => wake();
  else flatInstead();

  // without WebGL, or if the world fails to build, the photos play the journey as flat layers
  function flatInstead() {
    world = null;
    stageEl.classList.add('no-gl');
    photos.forEach((el, k) => {
      // each shot stacks above the next, so the one walking out stays in front
      el.style.zIndex = photos.length - k;
      const img = new Image();
      img.onload = () => {
        el.style.backgroundImage = `url("${el.dataset.src}")`;
        ready[k] = true;
        wake();
      };
      img.src = el.dataset.src;
    });
  }

  const span = () => hero.offsetHeight - innerHeight;
  const toProgress = y => clamp((y / span()) * (last + 2 * HOLD) - HOLD, 0, last);
  const toScroll = p => hero.offsetTop + ((p + HOLD) / (last + 2 * HOLD)) * span();

  // a photo's opacity and scale at progress p: it dollies in through its own shot, rushes past
  // the viewer on the way out, and grows in from the distance on the way in
  function photoAt(k, p) {
    if (still) return { op: Math.round(p) === k ? 1 : 0, s: 1, blur: 0 };
    const t = p - k;
    const dolly = 1 + 0.12 * clamp(t + 0.5);
    if (k < last && t > 0.5 - CUT) {
      const q = clamp((t - (0.5 - CUT)) / (2 * CUT));
      return { op: 1 - ease(q), s: dolly * (1 + 0.8 * q * q), blur: q * 10 };
    }
    if (k > 0 && t < -0.5 + CUT) {
      if (t < -0.5 - CUT) return { op: 0, s: 1, blur: 0 };
      const q = ease(clamp((t + 0.5 + CUT) / (2 * CUT)));
      // behind a photo that is rushing past it can stay at full strength, so nothing shows through
      return { op: ready[k - 1] ? 1 : q, s: (0.93 + 0.07 * q) * dolly, blur: 0 };
    }
    return { op: 1, s: dolly, blur: 0 };
  }

  function draw(p, mx, my, bob, sway) {
    const i = Math.round(p);

    if (world) {
      // keep the poster showing until the first photo has been built
      canvas.style.visibility = world.draw(p, mx, my, bob, sway) ? 'visible' : 'hidden';
    } else {
      flat(p, mx, my);
    }
    const b = Math.round(p - 0.5);
    const dip = still || (!world && (!ready[b] || !ready[b + 1]));
    const edge = Math.abs(p - b - 0.5);
    veil.style.opacity = (dip && p > 0.3 && p < last - 0.3 ? Math.max(0, 1 - edge / 0.09) : 0).toFixed(3);

    // the headlines sit nearer than the room, so they drift the other way
    chaptersEl.style.transform = `translate3d(${(mx * 10).toFixed(1)}px,${(my * 6).toFixed(1)}px,0)`;
    chapters.forEach((el, k) => {
      const d = p - k;
      const op = clamp(1 - Math.abs(d) * 2.6);
      el.style.opacity = op;
      el.style.setProperty('--y', `${still ? 0 : -d * 70}px`);
      el.classList.toggle('is-live', op > 0.5);
    });

    const inHero = scrollY - hero.offsetTop <= span();
    pills.forEach(a => a.classList.toggle('is-active', inHero && +a.dataset.scene === i));
    bar.style.transform = `scaleY(${p / last})`;
    counter.textContent = String(i + 1).padStart(2, '0');
    hint.style.opacity = p > 0.15 ? 0 : 1;
  }

  // the flat fallback: each photo plane turns a few degrees with the pointer and slides against it,
  // scaled up enough that its edges never come into view
  function flat(p, mx, my) {
    photos.forEach((el, k) => {
      const { op, s, blur } = ready[k] ? photoAt(k, p) : { op: 0, s: 1, blur: 0 };
      el.style.opacity = op.toFixed(3);
      el.style.visibility = op > 0 ? 'visible' : 'hidden';
      if (op > 0) {
        el.style.transform = `translate3d(${(-mx * 2.2).toFixed(2)}%,${(-my * 1.6).toFixed(2)}%,0) ` +
          `rotateY(${(mx * 6).toFixed(2)}deg) rotateX(${(-my * 4).toFixed(2)}deg) scale(${(s * 1.16).toFixed(4)})`;
        // the shot walking out blurs as it rushes past
        el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : '';
      }
    });
  }

  // scroll and pointer set targets; one loop eases toward them so the camera, the photos and the
  // headlines all move together, and it sleeps once everything has settled
  let target = toProgress(scrollY - hero.offsetTop), cur = target;
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  let running = false, visible = true, then = 0;

  // walking: the head rises and falls once a step and sways once a stride, as much as the
  // camera is actually moving, so it settles when the walk stops
  const STEPS = 9;          // steps per shot
  const PACE = 0.12;        // shots per second that count as a full walking pace
  const walk = { phase: 0, amount: 0 };
  // the tour plays on its own like a film until the visitor takes over
  const TOUR = 0.12;        // shots per second, about 35 s for the whole house
  let playing = false;

  function frame(now) {
    const dt = Math.min(0.1, (now - then) / 1000);
    then = now;
    if (playing) {
      target = Math.min(last, target + TOUR * dt);
      scrollTo({ top: toScroll(target), behavior: 'instant' });
      if (target >= last) setPlaying(false);
    }
    if (!pointer && !still) {
      look.tx = Math.sin(now * 0.00031) * 0.35;
      look.ty = Math.sin(now * 0.00022) * 0.2;
    }
    const prev = cur;
    cur = still ? target : cur + (target - cur) * Math.min(1, dt * 3.2);
    look.x += (look.tx - look.x) * Math.min(1, dt * 2.4);
    look.y += (look.ty - look.y) * Math.min(1, dt * 2.4);
    const moved = Math.abs(cur - prev);
    if (!still && dt > 0) {
      walk.amount += (clamp(moved / dt / PACE) - walk.amount) * Math.min(1, dt * 3);
      walk.phase += moved * STEPS * Math.PI * 2;
    }
    const bob = walk.amount * Math.sin(walk.phase), sway = walk.amount * Math.sin(walk.phase / 2);
    draw(cur, look.x, look.y, bob, sway);
    const moving = playing || Math.abs(target - cur) > 1e-4 || walk.amount > 1e-3 ||
      Math.abs(look.tx - look.x) > 1e-3 || Math.abs(look.ty - look.y) > 1e-3;
    running = visible && (moving || (!pointer && !still));
    if (running) requestAnimationFrame(frame);
  }
  function wake() {
    if (running) return;
    running = true;
    then = performance.now();
    requestAnimationFrame(frame);
  }

  // while the tour plays it sets the progress itself; reading it back from the rounded scroll
  // position would hold it back
  addEventListener('scroll', () => { if (!playing) target = toProgress(scrollY - hero.offsetTop); wake(); }, { passive: true });
  addEventListener('resize', () => {
    if (world) world.resize();
    target = toProgress(scrollY - hero.offsetTop);
    wake();
  });
  if (pointer && !still) {
    addEventListener('pointermove', e => {
      look.tx = (e.clientX / innerWidth) * 2 - 1;
      look.ty = (e.clientY / innerHeight) * 2 - 1;
      wake();
    }, { passive: true });
    // ease back to centre when the pointer leaves the window
    document.documentElement.addEventListener('pointerleave', () => { look.tx = look.ty = 0; wake(); });
  }
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) wake(); }).observe(stageEl);

  function setPlaying(on) {
    playing = on;
    playBtn.setAttribute('aria-pressed', String(on));
    playBtn.setAttribute('aria-label', on ? 'Mettre la visite en pause' : 'Lancer la visite');
    playBtn.querySelector('span').textContent = on ? '\u275A\u275A' : '\u25B6\uFE0E';
    if (on) wake();
  }
  if (still) {
    playBtn.hidden = true;
  } else {
    playBtn.addEventListener('click', () => {
      if (!playing && target >= last - 0.01) {
        target = 0;
        scrollTo({ top: toScroll(0), behavior: 'instant' });
      }
      setPlaying(!playing);
    });
    // any scroll, touch or key of the visitor's own hands the walk back to them
    const takeOver = () => { if (playing) setPlaying(false); };
    addEventListener('wheel', takeOver, { passive: true });
    addEventListener('touchstart', takeOver, { passive: true });
    addEventListener('keydown', e => { if (e.target !== playBtn) takeOver(); });
    // start the tour by itself if the page opens at the top of the house
    setTimeout(() => { if (target < 0.05) setPlaying(true); }, 1200);
  }

  // chapters live inside the sticky stage, so anchor jumps need translating to scroll positions
  pills.forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    scrollTo({ top: toScroll(+a.dataset.scene), behavior: still ? 'auto' : 'smooth' });
  }));
  document.querySelector('.brand').addEventListener('click', e => {
    e.preventDefault();
    scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
  });

  draw(cur, 0, 0, 0, 0);
  wake();
})();
