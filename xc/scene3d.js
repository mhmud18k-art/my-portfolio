/* The hero's 3D world: a concrete house with a bonsai courtyard, a wood-slat
   corridor and a lit interior, set on a forested plateau ringed by mountains.
   Scroll progress (0..4) picks one of five camera shots; each shot dollies
   slowly; opts.onFrame(p) gets the eased progress every frame so the page
   can time the cuts between shots to the camera. */
(() => {
  const T = window.THREE;

  // ---------- noise ----------
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const smooth = t => t * t * (3 - 2 * t);
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }
  function fbm(x, y, oct = 5) {
    let v = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { v += amp * noise(x * f, y * f); f *= 2.02; amp *= 0.5; }
    return v;
  }
  function ridged(x, y) {
    let v = 0, amp = 0.55, f = 1;
    for (let i = 0; i < 6; i++) { v += amp * (1 - Math.abs(noise(x * f, y * f) * 2 - 1)) ** 2; f *= 2.1; amp *= 0.5; }
    return v;
  }
  const step = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return smooth(t); };

  // concatenates geometries (positions and normals) into one, so a cluster can be a single mesh
  function merge(geos) {
    const parts = geos.map(g => (g.index ? g.toNonIndexed() : g));
    const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
    const P = new Float32Array(count * 3), N = new Float32Array(count * 3);
    let o = 0;
    for (const g of parts) {
      P.set(g.attributes.position.array, o);
      N.set(g.attributes.normal.array, o);
      o += g.attributes.position.array.length;
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(P, 3));
    out.setAttribute('normal', new T.BufferAttribute(N, 3));
    return out;
  }
  // a sphere pushed in and out by noise; indexed, so its normals stay smooth
  function lump(seg, amount, seed, freq = 1.6) {
    const g = new T.SphereGeometry(1, seg, Math.round(seg * 0.7));
    const P = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      v.multiplyScalar(1 - amount / 2 + fbm(v.x * freq + seed, v.y * freq + v.z * freq * 0.7 + seed * 0.3, 4) * amount);
      P.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }

  // ---------- terrain ----------
  const LAKE = -14;
  function heightAt(x, z) {
    const r = Math.hypot(x - 6, z - 2);
    const open = step(32, 80, r);                      // 0 on the plateau the house sits on
    let h = (fbm(x * 0.012 + 3, z * 0.012) - 0.45) * 34 * open;
    const lake = step(-70, -150, z) * (1 - step(-250, -320, z)) * (1 - step(160, 260, Math.abs(x)));
    h -= lake * 30 * open;
    const ring = step(300, 560, Math.hypot(x, z * 0.85 + 60));
    h += ring * (20 + ridged(x * 0.0038 + 7, z * 0.0038) * 230);
    return h;
  }

  // ---------- canvas textures ----------
  function canvasTex(size, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 8;
    return t;
  }
  const concrete = (base, repeat) => canvasTex(512, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      const x = hash(i, 1) * s, y = hash(i, 2) * s, r = 20 + hash(i, 3) * 90;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const dark = hash(i, 4) > 0.5;
      grd.addColorStop(0, dark ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + hash(i, 9) * 0.08})`;
      g.fillRect(hash(i, 5) * s, hash(i, 6) * s, 1 + hash(i, 7) * 1.5, 1 + hash(i, 8) * 1.5);
    }
    g.strokeStyle = 'rgba(0,0,0,.05)';
    for (let y = s / 4; y < s; y += s / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); }
  }, repeat);
  const gravel = canvasTex(512, (g, s) => {
    g.fillStyle = '#cfcac0'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 14000; i++) {
      const v = 150 + hash(i, 11) * 90;
      g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      g.fillRect(hash(i, 12) * s, hash(i, 13) * s, 1.5, 1.5);
    }
    g.strokeStyle = 'rgba(80,70,60,.22)'; g.lineWidth = 3;
    for (let y = 8; y < s; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + Math.sin(y) * 2); g.stroke(); }
  }, [2, 2]);
  const woodTex = canvasTex(256, (g, s) => {
    g.fillStyle = '#3b2a1e'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${hash(i, 21) > 0.5 ? '20,12,8' : '90,64,44'},${0.15 + hash(i, 22) * 0.3})`;
      g.lineWidth = 1 + hash(i, 23) * 2;
      const x = hash(i, 24) * s;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, s * 0.3, x - 6, s * 0.7, x + 3, s); g.stroke();
    }
  });
  const grain = canvasTex(256, (g, s) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 7000; i++) {
      g.fillStyle = `rgba(0,0,0,${0.05 + hash(i, 41) * 0.22})`;
      g.fillRect(hash(i, 42) * s, hash(i, 43) * s, 1 + hash(i, 44) * 2, 1 + hash(i, 45) * 3);
    }
  }, [520, 520]);
  const glowTex = canvasTex(128, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,190,110,1)');
    grd.addColorStop(0.35, 'rgba(255,160,80,.35)');
    grd.addColorStop(1, 'rgba(255,150,70,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  });

  // ---------- materials ----------
  const M = {
    wall: new T.MeshStandardMaterial({ map: concrete('#e6e2da', [2, 1]), roughness: 0.92 }),
    slab: new T.MeshStandardMaterial({ map: concrete('#efece6', [4, 3]), roughness: 0.9 }),
    plinth: new T.MeshStandardMaterial({ map: concrete('#b9b4ab', [6, 4]), roughness: 0.95 }),
    gravel: new T.MeshStandardMaterial({ map: gravel, roughness: 1 }),
    wood: new T.MeshStandardMaterial({ map: woodTex, roughness: 0.75 }),
    floor: new T.MeshStandardMaterial({ map: woodTex, color: 0x7a6c60, roughness: 0.62 }),
    glass: new T.MeshStandardMaterial({ color: 0x1b2226, roughness: 0.04, metalness: 0.9, envMapIntensity: 1.4 }),
    dark: new T.MeshStandardMaterial({ color: 0x15120f, roughness: 0.8 }),
    led: new T.MeshBasicMaterial({ color: 0xffd3a0 }),
    trunk: new T.MeshStandardMaterial({ color: 0x4a3a2e, roughness: 0.85 }),
    leaf: new T.MeshStandardMaterial({ color: 0x3c5531, roughness: 0.85, emissive: 0x0a1006 }),
    rock: new T.MeshStandardMaterial({ color: 0xb9b2a6, roughness: 0.75 }),
    pine: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: T.DoubleSide }),
    lake: new T.MeshStandardMaterial({ color: 0x3b4d5c, roughness: 0.12, metalness: 0.6, envMapIntensity: 1.2 }),
  };
  // the environment map is for reflections in glass and water; everything else only takes a hint of it
  for (const k in M) if (!['glass', 'lake', 'led'].includes(k)) M[k].envMapIntensity = 0.28;

  function init(canvas, opts) {
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    const scene = new T.Scene();
    const HORIZON = new T.Color(0xc4ccd3);
    scene.fog = new T.Fog(HORIZON, 140, 820);

    // sky dome
    const sky = new T.Mesh(
      new T.SphereGeometry(2000, 32, 16),
      new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new T.Color(0x4e6584) }, mid: { value: new T.Color(0x9fb1c4) }, bottom: { value: HORIZON } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
          void main(){ float h = vP.y; vec3 c = mix(bottom, mid, smoothstep(0., .18, h)); c = mix(c, top, smoothstep(.18, .7, h));
          gl_FragColor = vec4(c, 1.); }`,
      })
    );
    scene.add(sky);

    // environment for reflections: the sky plus a bright ground band
    const pmrem = new T.PMREMGenerator(renderer);
    const envScene = new T.Scene();
    envScene.add(new T.Mesh(new T.SphereGeometry(60, 32, 16), sky.material));
    const band = new T.Mesh(new T.CylinderGeometry(50, 50, 6, 32, 1, true), new T.MeshBasicMaterial({ color: 0xf4f1ec, side: T.BackSide }));
    band.position.y = 4;
    envScene.add(band);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;

    // light
    scene.add(new T.HemisphereLight(0xcfdbe8, 0x4a4438, 0.55));
    const sun = new T.DirectionalLight(0xfff1dc, 3.1);
    sun.position.set(-34, 62, 30);
    sun.target.position.set(4, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 34, bottom: -34, near: 10, far: 180 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    // ---------- terrain ----------
    const SIZE = 1800, SEG = 300;
    const tg = new T.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    tg.rotateX(-Math.PI / 2);
    const pos = tg.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const cForest = new T.Color(0x34432c), cGrass = new T.Color(0x56603f), cRock = new T.Color(0x6e7074), cSnow = new T.Color(0xf3f5f7), cShore = new T.Color(0x6f6a5c);
    const tmp = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z);
      pos.setY(i, h);
      const slope = Math.abs(heightAt(x + 2, z) - h) + Math.abs(heightAt(x, z + 2) - h);
      tmp.copy(cForest).lerp(cGrass, fbm(x * 0.05, z * 0.05, 3) * 0.6);
      if (h < LAKE + 2.5) tmp.lerp(cShore, 0.7);
      tmp.lerp(cRock, step(1.2, 3.5, slope) * step(30, 90, h));
      tmp.lerp(cSnow, step(120 + fbm(x * 0.02, z * 0.02, 3) * 60, 170, h));
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    tg.setAttribute('color', new T.BufferAttribute(col, 3));
    tg.computeVertexNormals();
    const terrain = new T.Mesh(tg, new T.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 1, envMapIntensity: 0.28 }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    const lake = new T.Mesh(new T.PlaneGeometry(1400, 600), M.lake);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(0, LAKE, -240);
    scene.add(lake);

    // pines
    const tiers = [[1, 0.55, 0.12], [0.78, 0.48, 0.38], [0.52, 0.42, 0.6]].map(([r, h, y]) => {
      const c = new T.ConeGeometry(r, h, 9, 1, true);
      c.translate(0, y + h / 2, 0);
      return c;
    });
    const stem = new T.CylinderGeometry(0.06, 0.09, 0.2, 5);
    stem.translate(0, 0.1, 0);
    const pineGeo = merge([...tiers, stem]);
    const N = 2600;
    const pines = new T.InstancedMesh(pineGeo, M.pine, N);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), p3 = new T.Vector3();
    let n = 0, tries = 0;
    while (n < N && tries < 60000) {
      tries++;
      const a = hash(tries, 31) * Math.PI * 2, r = 24 + Math.pow(hash(tries, 32), 0.8) * 330;
      const x = 6 + Math.cos(a) * r, z = 2 + Math.sin(a) * r * 0.9;
      const h = heightAt(x, z);
      if (h < LAKE + 1.5 || h > 70) continue;
      if (fbm(x * 0.03, z * 0.03, 3) < 0.42) continue;            // clearings
      if (x > -20 && x < 38 && z > -14 && z < 20) continue;       // keep the house clear
      if (x > 0 && x < 46 && z > 10 && z < 40) continue;          // and the lawn the camera stands on
      const s = 5 + hash(tries, 33) * 9;
      p3.set(x, h - 0.5, z);
      sc.set(s * 0.32, s, s * 0.32);
      m4.compose(p3, q, sc);
      pines.setMatrixAt(n, m4);
      pines.setColorAt(n, tmp.setHSL(0.27 + hash(tries, 34) * 0.05, 0.35, 0.12 + hash(tries, 35) * 0.08));
      n++;
    }
    pines.count = n;
    pines.castShadow = true;
    scene.add(pines);

    // ---------- house ----------
    const house = new T.Group();
    scene.add(house);
    const box = (w, h, d, x, y, z, mat, shadow = true) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = shadow; m.receiveShadow = true;
      house.add(m);
      return m;
    };
    const FLOOR = 0.3, CEIL = 3.85, WH = CEIL - FLOOR, WY = FLOOR + WH / 2;

    box(36, 0.6, 24, 0, 0, 0, M.plinth);
    // roof slab, open over the courtyard x[-4,4] z[-4,5]
    box(13, 0.55, 23, -10.5, 4.1, 0, M.slab);
    box(13, 0.55, 23, 10.5, 4.1, 0, M.slab);
    box(8, 0.55, 7.5, 0, 4.1, -7.75, M.slab);
    box(8, 0.55, 6.5, 0, 4.1, 8.25, M.slab);

    // outer walls
    box(30.4, WH, 0.4, 0, WY, -9.5, M.wall);
    box(0.4, WH, 19, -15, WY, 0, M.wall);
    box(0.4, WH, 19, 15, WY, 0, M.wall);
    // front facade: concrete fins and dark glass
    for (let x = -15; x <= 15; x += 5) box(0.35, WH, 0.6, x, WY, 9.5, M.wall);
    box(30, WH, 0.06, 0, WY, 9.45, M.glass, false);

    // courtyard: white back wall, glass to the front, corridor opening west, big opening east
    box(8, WH, 0.4, 0, WY, -4, M.wall);
    box(8, WH, 0.06, 0, WY, 5, M.glass, false);
    box(0.4, WH, 2.7, -4, WY, -2.65, M.wall);
    box(0.4, WH, 3.7, -4, WY, 3.15, M.wall);
    box(0.4, WH, 2, 4, WY, -3, M.wall);
    box(0.4, WH, 1.5, 4, WY, 4.25, M.wall);
    const court = new T.Mesh(new T.PlaneGeometry(8, 9), M.gravel);
    court.rotation.x = -Math.PI / 2;
    court.position.set(0, FLOOR + 0.01, 0.5);
    court.receiveShadow = true;
    house.add(court);

    // corridor x[-14.6,-4]: slatted cedar both sides, a light line down the floor
    const slatGeo = new T.BoxGeometry(0.07, WH, 0.22);
    const slats = new T.InstancedMesh(slatGeo, M.wood, 200);
    let s = 0;
    for (const zSide of [-1.3, 1.3]) {
      for (let x = -14.6; x < -4.3; x += 0.2) {
        m4.makeTranslation(x, WY, zSide);
        slats.setMatrixAt(s, m4);
        slats.setColorAt(s, tmp.setHSL(0.07, 0.3, 0.55 + hash(x, zSide) * 0.25));
        s++;
      }
    }
    slats.count = s;
    slats.castShadow = slats.receiveShadow = true;
    house.add(slats);
    box(10.6, 0.02, 2.4, -9.5, FLOOR + 0.005, 0, M.plinth, false);
    box(10.4, 0.025, 0.05, -9.5, FLOOR + 0.02, 0.15, M.led, false);
    box(10.6, 0.1, 2.6, -9.5, CEIL - 0.05, 0, M.dark, false);

    // living room x[4,15]: wood floor, a long bench with an amber line under it
    const floor = new T.Mesh(new T.PlaneGeometry(10.8, 18.6), M.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(9.6, FLOOR + 0.01, 0);
    floor.receiveShadow = true;
    house.add(floor);
    box(1.3, 0.42, 5.2, 7.4, FLOOR + 0.36, 0.7, M.wood);
    box(0.04, 0.03, 5.2, 8.07, FLOOR + 0.12, 0.7, M.led, false);
    box(0.3, 0.02, 10, 14.6, FLOOR + 0.02, 0, M.led, false);
    const amber = new T.PointLight(0xffa456, 3.2, 6, 1.8);
    amber.position.set(8.5, FLOOR + 0.25, 0.7);
    house.add(amber);
    const amber2 = new T.PointLight(0xffb26b, 6, 9, 1.6);
    amber2.position.set(-9.5, FLOOR + 0.3, 0);
    house.add(amber2);

    // the second, lower volume to the east
    box(16, 0.5, 13, 25, 3.55, 5, M.slab);
    box(14, 3.1, 11, 25, 1.85, 5, M.wall);
    box(14.1, 1.6, 11.1, 25, 1.9, 5, M.glass, false);
    box(18, 0.5, 15, 25, 0.05, 5, M.plinth);

    // a stepping-stone path down the slope
    for (let i = 0; i < 9; i++) {
      const sx = 6 + i * 1.6, sz = 13 + i * 2.2;
      const stone = box(1.4, 0.2, 0.8, sx, heightAt(sx, sz) + 0.05, sz, M.plinth);
      stone.rotation.y = 0.5;
    }

    // glow sprites for the light lines
    const glow = (x, y, z, w, h, o) => {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffb06a, transparent: true, opacity: o, blending: T.AdditiveBlending, depthWrite: false }));
      sp.position.set(x, y, z); sp.scale.set(w, h, 1);
      house.add(sp);
    };
    for (let x = -14; x < -4.5; x += 1.3) glow(x, FLOOR + 0.1, 0.15, 1.6, 0.6, 0.5);
    for (let z = -1.6; z < 3.2; z += 0.9) glow(8.15, FLOOR + 0.1, z, 1.1, 0.3, 0.35);

    // ---------- bonsai ----------
    const tree = new T.Group();
    tree.position.set(-1.1, FLOOR, -1.4);
    tree.scale.setScalar(0.85);
    house.add(tree);
    function limb(points, r0, r1) {
      const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
      const TS = 40, RS = 10;
      const g = new T.TubeGeometry(curve, TS, 1, RS, false);
      const P = g.attributes.position, c = new T.Vector3(), v = new T.Vector3();
      for (let i = 0; i <= TS; i++) {
        curve.getPointAt(i / TS, c);
        const r = r0 + (r1 - r0) * (i / TS);
        for (let j = 0; j <= RS; j++) {
          const k = i * (RS + 1) + j;
          v.fromBufferAttribute(P, k).sub(c).multiplyScalar(r).add(c);
          P.setXYZ(k, v.x, v.y, v.z);
        }
      }
      g.computeVertexNormals();
      const m = new T.Mesh(g, M.trunk);
      m.castShadow = m.receiveShadow = true;
      tree.add(m);
      return curve;
    }
    function pad(x, y, z, sx, sy, sz, seed) {
      const parts = [];
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + hash(seed, i) * 0.8, r = i === 0 ? 0 : 0.45 + hash(i, seed) * 0.4;
        const g = lump(18, 0.5, seed * 7 + i);
        const s = 0.42 + hash(seed + i, 3) * 0.25;
        g.scale(s, s * 0.7, s);
        g.translate(Math.cos(a) * r, (hash(i, seed + 5) - 0.3) * 0.25, Math.sin(a) * r);
        parts.push(g);
      }
      const m = new T.Mesh(merge(parts), M.leaf);
      m.position.set(x, y, z); m.scale.set(sx, sy * 1.6, sz);
      m.castShadow = m.receiveShadow = true;
      tree.add(m);
    }
    limb([[0, 0, 0], [0.25, 0.5, 0.1], [-0.2, 1.1, 0.15], [0.35, 1.7, -0.1], [0.05, 2.3, 0], [0.45, 2.8, 0.1]], 0.2, 0.07);
    limb([[0.3, 1.65, -0.1], [0.9, 1.85, 0.0], [1.6, 1.8, 0.2]], 0.08, 0.035);
    limb([[-0.15, 1.15, 0.15], [-0.8, 1.3, 0.3], [-1.5, 1.2, 0.35]], 0.08, 0.035);
    limb([[0.08, 2.2, 0], [-0.5, 2.45, -0.2], [-1.0, 2.5, -0.3]], 0.06, 0.03);
    pad(1.7, 1.95, 0.2, 0.95, 0.32, 0.75, 1);
    pad(-1.55, 1.35, 0.35, 0.85, 0.3, 0.7, 2);
    pad(-1.05, 2.62, -0.3, 0.8, 0.28, 0.65, 3);
    pad(0.5, 2.95, 0.1, 1.05, 0.36, 0.85, 4);
    pad(0.15, 3.3, 0.0, 0.6, 0.22, 0.5, 5);
    const rock = new T.Mesh(lump(64, 0.4, 9, 1.3), M.rock);
    rock.position.set(-2.4, FLOOR + 0.45, -0.6);
    rock.scale.set(1.4, 0.9, 1.0);
    rock.rotation.y = 0.6;
    rock.castShadow = rock.receiveShadow = true;
    house.add(rock);

    // ---------- shots ----------
    // [from position, from target, to position, to target]
    const v = (x, y, z) => new T.Vector3(x, y, z);
    const SHOTS = [
      [v(2.9, 1.35, 4.75), v(1.1, 1.65, -1.6), v(2.3, 1.45, 4.1), v(0.9, 1.7, -1.6)],      // courtyard, bonsai on the white wall
      [v(16, 2.2, 31), v(-3, 4.6, -4), v(12.5, 2.4, 26), v(-4, 4.8, -4)],               // the house against the mountains
      [v(58, 34, 74), v(-6, 0, -12), v(84, 64, 104), v(-10, -6, -20)],                    // aerial pull-back
      [v(-14.2, 1.45, 0.25), v(-3.0, 1.55, 1.0), v(-11.6, 1.5, 0.15), v(-3.0, 1.6, 0.9)], // down the cedar corridor
      [v(13.8, 1.35, 0.6), v(-0.4, 1.7, -1.9), v(11.6, 1.4, 0.5), v(-0.6, 1.75, -1.9)],   // from the bench, through the opening
    ];

    // what each shot is about; narrow screens aim straight at it and keep it in the top half, above the text
    const FOCUS = [v(-1.1, 2.0, -1.4), v(0, 3, 0), v(8, 0, 0), v(-4, 1.6, 0.5), v(-1.1, 1.8, -1.4)];
    let narrow = false;

    const camera = new T.PerspectiveCamera(42, 1, 0.1, 4000);
    const eye = new T.Vector3(), look = new T.Vector3();
    let target = 0, current = 0, last = performance.now(), dirty = true, running = true;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let hidden = false;

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      narrow = w / h < 0.8;
      camera.fov = narrow ? 60 : 42;
      camera.updateProjectionMatrix();
      dirty = true;
    }

    function place(p, time) {
      const i = Math.min(SHOTS.length - 1, Math.max(0, Math.round(p)));
      const u = Math.min(1, Math.max(0, p - i + 0.5));
      const e = smooth(u);
      const [a, ta, b, tb] = SHOTS[i];
      eye.lerpVectors(a, b, e);
      look.lerpVectors(ta, tb, e);
      if (narrow) {
        look.lerp(FOCUS[i], 0.9);
        look.y -= eye.distanceTo(look) * 0.28;
      }
      if (!still) {
        eye.y += Math.sin(time * 0.0004) * 0.04;
        look.x += Math.sin(time * 0.00027) * 0.06;
      }
      eye.y = Math.max(eye.y, heightAt(eye.x, eye.z) + 1.2);
      camera.position.copy(eye);
      camera.lookAt(look);
      if (opts.onFrame) opts.onFrame(p);
    }

    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const prev = current;
      current = still ? target : current + (target - current) * Math.min(1, dt * 3.2);
      if (Math.abs(current - prev) > 1e-5 || dirty || !still) {
        place(current, now);
        if (!hidden) renderer.render(scene, camera);
        dirty = false;
      }
      requestAnimationFrame(frame);
    }

    resize();
    addEventListener('resize', resize);
    new IntersectionObserver(([en]) => {
      const was = running;
      running = en.isIntersecting;
      if (running && !was) { last = performance.now(); requestAnimationFrame(frame); }
    }).observe(canvas);
    place(0, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);

    return {
      setProgress(p) { target = p; },
      // while a photo covers the current shot there is no point drawing the scene under it
      setHidden(h) {
        if (h === hidden) return;
        hidden = h;
        canvas.style.visibility = h ? 'hidden' : '';
        dirty = true;
      },
    };
  }

  window.Scene3D = {
    init(canvas, opts = {}) {
      if (!T) return null;
      try { return init(canvas, opts); } catch (e) { console.error(e); return null; }
    },
  };
})();
