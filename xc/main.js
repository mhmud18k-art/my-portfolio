(() => {
  const hero = document.querySelector('.hero');
  const stageEl = document.querySelector('.stage');
  const chapters = [...document.querySelectorAll('.chapter')];
  const chaptersEl = document.querySelector('.chapters');
  const pills = [...document.querySelectorAll('.pills a[data-scene]')];
  const bar = document.querySelector('.progress i');
  const counter = document.querySelector('.counter');
  const hint = document.querySelector('.hint');
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

  const world = window.Scene3D ? Scene3D.init(document.querySelector('.gl'), { eased: true }) : null;
  if (!world) stageEl.classList.add('no-gl');

  const ready = photos.map(() => false);
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

  function draw(p, mx, my) {
    const i = Math.round(p);

    // photos, looking around with the pointer: the plane turns a few degrees and slides against
    // it, scaled up enough that its edges never come into view
    let covered = false;
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
      if (op >= 0.999) covered = true;
    });

    // the 3D scene fills any shot without a photo; cuts that involve it dip to black
    if (world) {
      world.setProgress(p);
      // the canvas is mirrored on screen, so its horizontal look is too
      world.setLook(-mx, my);
      world.setHidden(covered);
    }
    const b = Math.round(p - 0.5);
    const dip = still || !ready[b] || !ready[b + 1];
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

  // scroll and pointer set targets; one loop eases toward them so the camera, the photos and the
  // headlines all move together, and it sleeps once everything has settled
  let target = toProgress(scrollY - hero.offsetTop), cur = target;
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  let running = false, visible = true, then = 0;

  function frame(now) {
    const dt = Math.min(0.1, (now - then) / 1000);
    then = now;
    if (!pointer && !still) {
      look.tx = Math.sin(now * 0.00031) * 0.35;
      look.ty = Math.sin(now * 0.00022) * 0.2;
    }
    cur = still ? target : cur + (target - cur) * Math.min(1, dt * 3.2);
    look.x += (look.tx - look.x) * Math.min(1, dt * 2.4);
    look.y += (look.ty - look.y) * Math.min(1, dt * 2.4);
    draw(cur, look.x, look.y);
    const moving = Math.abs(target - cur) > 1e-4 || Math.abs(look.tx - look.x) > 1e-3 || Math.abs(look.ty - look.y) > 1e-3;
    running = visible && (moving || (!pointer && !still));
    if (running) requestAnimationFrame(frame);
  }
  function wake() {
    if (running) return;
    running = true;
    then = performance.now();
    requestAnimationFrame(frame);
  }

  addEventListener('scroll', () => { target = toProgress(scrollY - hero.offsetTop); wake(); }, { passive: true });
  addEventListener('resize', () => { target = toProgress(scrollY - hero.offsetTop); wake(); });
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

  // chapters live inside the sticky stage, so anchor jumps need translating to scroll positions
  pills.forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    scrollTo({ top: toScroll(+a.dataset.scene), behavior: still ? 'auto' : 'smooth' });
  }));
  document.querySelector('.brand').addEventListener('click', e => {
    e.preventDefault();
    scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
  });

  draw(cur, 0, 0);
  wake();
})();
