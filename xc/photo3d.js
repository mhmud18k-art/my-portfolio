/* The hero as five photographs turned into places you can stand in. Each photo
   is projected back out of the camera that took it onto a rough model of the
   place it shows: a box for the rooms (back wall, side walls, floor and ceiling
   from the vanishing point), ground and a far backdrop for the landscapes, and
   a few flat cut-outs such as the house front or the opening onto the
   courtyard. Seen from where the photo was taken the mesh is exactly the
   photo; step aside or forward and near surfaces move more than far ones.

   draw(p, mx, my) renders scroll progress p (0..4, one unit per shot) with the
   pointer at mx, my (-1..1): each shot steps slowly forward, the cut to the
   next one walks through it, and the pointer moves the head and turns the view.
   Steps stay short, because the photo only covers what its camera saw; the
   rush of walking through is a lens zoom, which never leaves the photo. */
(() => {
  const T = window.THREE;

  // the photos' camera: an assumed vertical field of view at their 1376x768 aspect
  const FOV = 50;
  const ASPECT = 1376 / 768;
  const tanV = Math.tan((FOV * Math.PI) / 360), tanH = tanV * ASPECT;
  const ray = (u, v) => new T.Vector3((u - 0.5) * 2 * tanH, -(v - 0.5) * 2 * tanV, -1).normalize();
  const FWD = new T.Vector3(0, 0, -1);

  // ---------- models: planes dot(p, n) = c; a masked plane only applies inside an image polygon ----------
  const plane = (n, c, mask) => ({ n: n.clone().normalize(), c, mask });

  // a box room from its vanishing point and the back wall's rectangle in the image
  function room(vp, [u0, v0, u1, v1], D) {
    const f = ray(...vp);
    const r = new T.Vector3().crossVectors(f, new T.Vector3(0, 1, 0)).normalize();
    const up = new T.Vector3().crossVectors(r, f);
    const onBack = (u, v) => { const d = ray(u, v); return d.multiplyScalar(D / d.dot(f)); };
    const tl = onBack(u0, v0), br = onBack(u1, v1);
    return [plane(f, D), plane(r, tl.dot(r)), plane(r, br.dot(r)), plane(up, tl.dot(up)), plane(up, br.dot(up))];
  }
  // world up in camera space, from the height of the horizon in the image
  const levelAt = vh => new T.Vector3(0, 1, -(vh - 0.5) * 2 * tanV).normalize();
  // the horizontal direction the camera faces
  const aheadOf = U => FWD.clone().addScaledVector(U, U.z).normalize();
  // a vertical wall standing on the ground along two image points of its foot
  function wall(U, h, a, b, mask) {
    const onGround = ([u, v]) => { const d = ray(u, v); return d.multiplyScalar(-h / d.dot(U)); };
    const A = onGround(a), B = onGround(b);
    const n = new T.Vector3().crossVectors(new T.Vector3().subVectors(B, A), U);
    return plane(n, n.normalize().dot(A), mask);
  }

  const SHOTS = (() => {
    const out = [];
    // 1 courtyard
    out.push({ surfaces: room([0.54, 0.5], [0.345, 0.215, 0.79, 0.735], 7), far: 60, ref: 7, focus: 0.67 });
    // 2 the house against the mountains: lawn, far backdrop, and the long front of the house
    {
      const U = levelAt(0.63);
      const house = [[0.4, 0.52], [1.02, 0.25], [1.02, 0.8], [0.4, 0.675]];
      out.push({
        surfaces: [plane(U, -1.6), plane(aheadOf(U), 420), wall(U, 1.6, [0.4, 0.668], [1, 0.785], house)],
        far: 420, ref: 24, focus: 0.72,
      });
    }
    // 3 aerial: forest and lake as ground seen from high up, mountains as backdrop
    {
      const U = levelAt(0.04);
      out.push({ surfaces: [plane(U, -70), plane(aheadOf(U), 900)], far: 900, ref: 110, focus: 0.6 });
    }
    // 4 cedar corridor
    out.push({ surfaces: room([0.5, 0.36], [0.405, 0.127, 0.595, 0.573], 12), far: 60, ref: 12, focus: 0.5 });
    // 5 living room: floor, ceiling and the dark wall, the opening deeper and the bench nearer
    {
      const U = levelAt(0.5), F = aheadOf(U);
      const opening = [[0.525, 0.165], [0.95, 0.11], [0.95, 0.815], [0.6, 0.745], [0.525, 0.7]];
      const bench = [[0.195, 0.75], [0.455, 0.68], [0.6, 0.675], [0.6, 0.78], [0.3, 0.98], [0.195, 0.86]];
      out.push({
        surfaces: [plane(U, -1.2), plane(U, 1.5), plane(F, 4.2), plane(F, 9, opening), plane(F, 2.6, bench)],
        far: 40, ref: 4.2, focus: 0.78,
      });
    }
    return out;
  })();

  function inside(poly, u, v) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ui, vi] = poly[i], [uj, vj] = poly[j];
      if ((vi > v) !== (vj > v) && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) hit = !hit;
    }
    return hit;
  }
  // distance along a ray to the model: the nearest wall from inside, unless a cut-out claims the pixel
  function depthAt(shot, u, v, d) {
    let base = Infinity, cut = Infinity;
    for (const s of shot.surfaces) {
      const k = d.dot(s.n);
      if (Math.abs(k) < 1e-6) continue;
      const t = s.c / k;
      if (t <= 0) continue;
      if (!s.mask) base = Math.min(base, t);
      else if (inside(s.mask, u, v)) cut = Math.min(cut, t);
    }
    return Math.min(cut < Infinity ? cut : base, shot.far);
  }

  // the mesh runs a little past the photo's edges, where the texture's edge pixels stretch,
  // so turning the head never shows the void behind it
  const BLEED = 0.08, NX = 200, NY = 112;
  function mesh(shot, map) {
    const g = new T.PlaneGeometry(1, 1, NX, NY);
    const P = g.attributes.position, UV = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      const u = -BLEED + UV.getX(i) * (1 + 2 * BLEED);
      const v = -BLEED + (1 - UV.getY(i)) * (1 + 2 * BLEED);
      const d = ray(u, v);
      d.multiplyScalar(depthAt(shot, u, v, d.clone()));
      P.setXYZ(i, d.x, d.y, d.z);
      UV.setXY(i, Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, 1 - v)));
    }
    g.computeBoundingSphere();
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ map, transparent: true, side: T.DoubleSide }));
    m.frustumCulled = false;
    const scene = new T.Scene();
    scene.add(m);
    return { scene, material: m.material };
  }

  const smooth = t => t * t * (3 - 2 * t);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  // half the progress, in shots, that walking through from one shot to the next takes
  const CUT = 0.14;

  function init(canvas, sources, opts) {
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x0d0b09, 1);
    renderer.autoClear = false;

    const cam = new T.PerspectiveCamera(FOV, 1, 0.05, 5000);
    const loader = new T.TextureLoader();
    const built = SHOTS.map(() => null);
    let onReady = null;
    sources.forEach((src, k) => {
      loader.load(src, tex => {
        tex.colorSpace = T.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        built[k] = mesh(SHOTS[k], tex);
        if (onReady) onReady();
      });
    });

    let narrow = false;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      narrow = cam.aspect < 0.8;
      // a touch narrower than the photo in both directions, leaving room to look around
      const tv = Math.min(tanV * 0.9, (tanH * 0.9) / cam.aspect);
      cam.fov = (Math.atan(tv) * 360) / Math.PI;
      cam.updateProjectionMatrix();
    }
    resize();

    const aim = new T.Vector3(), eye = new T.Vector3();
    function view(k, dolly, zoom, mx, my) {
      const s = SHOTS[k], D = s.ref;
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
      // narrow screens turn toward the subject; turning in place keeps the photo exact
      aim.copy(ray(narrow ? s.focus : 0.5, 0.5)).multiplyScalar(D);
      eye.set(mx * 0.03 * D, -my * 0.02 * D, 0).addScaledVector(aim, dolly);
      aim.add(eye).x += mx * 0.06 * D;
      aim.y -= my * 0.04 * D;
      cam.position.copy(eye);
      cam.lookAt(aim);
    }

    function draw(p, mx, my) {
      const i = clamp(Math.round(p), 0, SHOTS.length - 1);
      const layers = [];
      // dolly is the step forward as a fraction of the shot's depth
      if (opts.still) {
        layers.push({ k: i, dolly: 0, zoom: 1, op: 1 });
      } else {
        // the shot ahead sits behind the one walking out, settling in from slightly wider;
        // the one walking out rushes on and fades
        for (let k = 0; k < SHOTS.length; k++) {
          const t = p - k;
          const step = 0.05 * clamp(t + 0.5);
          if (k > 0 && t >= -0.5 - CUT && t < -0.5 + CUT) {
            const q = smooth(clamp((t + 0.5 + CUT) / (2 * CUT)));
            layers.unshift({ k, dolly: 0, zoom: 0.94 + 0.06 * q, op: 1 });
          } else if (k < SHOTS.length - 1 && t > 0.5 - CUT && t <= 0.5 + CUT) {
            const q = clamp((t - (0.5 - CUT)) / (2 * CUT));
            layers.push({ k, dolly: step + 0.05 * q, zoom: 1 + 0.9 * q * q, op: 1 - smooth(q) });
          } else if (Math.abs(t) <= 0.5 - CUT) {
            layers.push({ k, dolly: step, zoom: 1, op: 1 });
          }
        }
      }
      renderer.clear();
      let drawn = false;
      for (const L of layers) {
        const b = built[L.k];
        if (!b || L.op <= 0.001) continue;
        b.material.opacity = L.op;
        view(L.k, L.dolly, L.zoom, mx, my);
        renderer.clearDepth();
        renderer.render(b.scene, cam);
        drawn = true;
      }
      return drawn;
    }

    return {
      draw, resize,
      ready: k => !!built[k],
      set onReady(fn) { onReady = fn; },
    };
  }

  window.Photo3D = {
    init(canvas, sources, opts = {}) {
      if (!T) return null;
      try { return init(canvas, sources, opts); } catch (e) { console.error(e); return null; }
    },
  };
})();
