/* The hero's 3D world, flown and then walked in one continuous camera move.

   A concrete house on a forested plateau above an alpine lake at golden hour:
   a road climbs from the lake shore through spruce forest to its west door, a
   cedar-slatted corridor leads to a bonsai courtyard, and the living room
   looks south through glass toward the low sun.

   Scroll progress p (0..4) is a position along one camera path with a station
   at every whole number, where the headlines sit: the aerial opening (0), the
   house revealed from the edge of the forest (1), a crane shot of its front
   (2), the corridor (3) and the living room (4). Between stations the camera
   travels at an even speed and eases into each station, so scrolling back
   plays the same journey in reverse.

   draw(p, mx, my, bob, sway) renders one frame: mx, my (-1..1) turn the head
   toward the pointer, and bob and sway (-1..1, zero when standing still) are the
   rise and fall and roll of a walking step, applied only near the ground. */
(() => {
  const T = window.THREE;

  // ---------- noise and small helpers ----------
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const smooth = t => t * t * (3 - 2 * t);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const step = (e0, e1, x) => smooth(clamp((x - e0) / (e1 - e0)));
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
  // value noise with its derivatives, and an fbm that damps each octave where the slope is already
  // steep: ridges stay sharp and the slopes between them read as worn by water and ice
  const ND = [0, 0, 0];
  function noised(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const dux = 30 * fx * fx * (fx * (fx - 2) + 1), duy = 30 * fy * fy * (fy * (fy - 2) + 1);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    const k1 = b - a, k2 = c - a, k4 = a - b - c + d;
    ND[0] = a + k1 * ux + k2 * uy + k4 * ux * uy; ND[1] = dux * (k1 + k4 * uy); ND[2] = duy * (k2 + k4 * ux);
  }
  function eroded(x, y) {
    let a = 0, b = 0.5, dx = 0, dy = 0;
    for (let i = 0; i < 9; i++) {
      noised(x, y);
      dx += ND[1]; dy += ND[2];
      a += (b * ND[0]) / (1 + dx * dx + dy * dy);
      b *= 0.5;
      const nx = 1.6 * x - 1.2 * y; y = 1.2 * x + 1.6 * y; x = nx;
    }
    return a;
  }
  // seeded, so the forest grows the same way on every load
  function rng(seed) { let s = (seed >>> 0) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  // ---------- the land ----------
  const LAKE = -14;
  const PLATEAU = [6, 2];
  // the low sun's bearing, flattened onto the ground
  const SUN_H = [-0.885, 0.465];
  // the mountains ring the valley around this centre, rising from MOUNT_R
  const MC = [-40, -60], MOUNT_R = 430;
  function mountains(x, z) {
    const dx = x - MC[0], dz = z - MC[1], r = Math.hypot(dx, dz);
    if (r < MOUNT_R) return 0;
    const ring = step(MOUNT_R, 900, r);
    // the valley opens toward the setting sun, which is how the low light gets in
    const toward = Math.max(0, (dx * SUN_H[0] + dz * SUN_H[1]) / r);
    const open = 1 - 0.62 * smooth(clamp(toward * 1.4 - 0.2));
    const e = eroded(x * 0.0017 + 7.3, z * 0.0017 - 2.1);
    const crest = ridged(x * 0.0021 + 1.7, z * 0.0021 + 4.2);
    const m = clamp(e * 0.95 + crest * 0.22 - 0.12, 0, 1.4);
    return ring * open * (20 + 980 * m * m) * (0.55 + 0.45 * step(900, 1700, r));
  }
  function baseHeight(x, z) {
    const r = Math.hypot(x - PLATEAU[0], z - PLATEAU[1]);
    const open = step(32, 80, r);                      // 0 on the plateau the house sits on
    let h = (fbm(x * 0.012 + 3, z * 0.012) - 0.45) * 34 * open;
    const lake = step(-70, -150, z) * (1 - step(-250, -320, z)) * (1 - step(160, 260, Math.abs(x)));
    h -= lake * 30 * open;
    h += mountains(x, z);
    h += (fbm(x * 0.07 + 5, z * 0.07 - 3, 3) - 0.5) * 0.55 * step(22, 40, r);
    return h;
  }

  // the road: from the lake shore up through the forest to the west door
  const ROAD_HALF = 3;
  const road = (() => {
    const pts = [[-215, -150], [-190, -118], [-160, -88], [-132, -55], [-108, -22], [-86, 4], [-64, 18],
      [-44, 21], [-30, 12], [-22, 4], [-17.5, 0]].map(([x, z]) => new T.Vector3(x, 0, z));
    const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength(), n = Math.ceil(len / 1.5);
    const xs = new Float32Array(n + 1), zs = new Float32Array(n + 1), hs = new Float32Array(n + 1), raw = [];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(i / n);
      xs[i] = p.x; zs[i] = p.z; raw.push(baseHeight(p.x, p.z));
    }
    // a road can't follow every bump: it takes the ground's profile smoothed, kept above the lake,
    // and arrives level with the door
    for (let i = 0; i <= n; i++) {
      let s = 0, c = 0;
      for (let k = -12; k <= 12; k++) { const j = i + k; if (j >= 0 && j <= n) { s += raw[j]; c++; } }
      hs[i] = mix(Math.max(s / c, LAKE + 2.5), 0, step(n - 34, n - 6, i));
    }
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i <= n; i++) { x0 = Math.min(x0, xs[i]); x1 = Math.max(x1, xs[i]); z0 = Math.min(z0, zs[i]); z1 = Math.max(z1, zs[i]); }
    return { curve, len, n, xs, zs, hs, box: [x0 - 20, x1 + 20, z0 - 20, z1 + 20] };
  })();
  // nearest point of the road: distance from its centre line, its height there, and how far along it is
  function roadNear(x, z) {
    const b = road.box;
    if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) return null;
    let best = Infinity, bi = 0;
    for (let i = 0; i <= road.n; i++) {
      const dx = x - road.xs[i], dz = z - road.zs[i], d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    let out = { d: Math.sqrt(best), h: road.hs[bi], s: bi / road.n };
    for (const j of [bi - 1, bi]) {
      if (j < 0 || j >= road.n) continue;
      const ax = road.xs[j], az = road.zs[j], vx = road.xs[j + 1] - ax, vz = road.zs[j + 1] - az;
      const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz));
      const d = Math.hypot(x - ax - vx * t, z - az - vz * t);
      if (d < out.d) out = { d, h: mix(road.hs[j], road.hs[j + 1], t), s: (j + t) / road.n };
    }
    return out;
  }
  // the ground, with a level bed cut for the road a touch below its surface
  function heightAt(x, z) {
    const h = baseHeight(x, z), r = roadNear(x, z);
    if (!r || r.d > ROAD_HALF + 11) return h;
    return mix(h, r.h - 0.12, 1 - step(ROAD_HALF + 0.8, ROAD_HALF + 11, r.d));
  }
  const forestAt = (x, z) => fbm(x * 0.018 + 11, z * 0.018 - 4, 4);
  // where the meadow around the house gives way to forest: further out toward the low sun in the
  // west, so the house stands in light instead of in the forest's long shadows
  const MEADOW = 46;
  const meadowAt = (x, z) => {
    const dx = x - PLATEAU[0], dz = z - PLATEAU[1], r = Math.hypot(dx, dz) || 1;
    return MEADOW + 48 * Math.max(0, (dx * SUN_H[0] + dz * SUN_H[1]) / r) ** 2;
  };
  // where forest grows: patches in the valley, and on the mountains a belt on the gentler slopes
  // below the tree line
  const forestMask = (x, y, z, ny) => step(0.44, 0.56, forestAt(x, z)) *
    (1 - step(150, 250, y + (fbm(x * 0.01, z * 0.01, 3) - 0.5) * 80)) * (1 - step(0.3, 0.5, 1 - ny));
  // the house's footprint, kept clear of trees, rocks and grass
  const inHouse = (x, z, pad = 0) => x > -21 - pad && x < 34 + pad && z > -12 - pad && z < 13 + pad;

  // ---------- geometry helpers ----------
  // concatenates geometries into one (positions, normals, colours)
  function merge(geos) {
    const parts = geos.map(g => (g.index ? g.toNonIndexed() : g));
    const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
    const P = new Float32Array(count * 3), N = new Float32Array(count * 3), C = new Float32Array(count * 3).fill(1);
    let o = 0;
    for (const g of parts) {
      P.set(g.attributes.position.array, o);
      N.set(g.attributes.normal.array, o);
      if (g.attributes.color) C.set(g.attributes.color.array, o);
      o += g.attributes.position.array.length;
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(P, 3));
    out.setAttribute('normal', new T.BufferAttribute(N, 3));
    out.setAttribute('color', new T.BufferAttribute(C, 3));
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
  // a spruce of unit height made of branch cards: whorls of drooping branches round a trunk, each
  // branch two crossed cards carrying the photographed branch. Normals point out from the crown,
  // so it shades as a mass rather than as flat cards, and colour darkens toward the trunk.
  // aBark marks the trunk, which takes a bark colour instead of the texture.
  function spruceCards(seed, light = false) {
    const R = rng(seed * 977 + 13);
    const pos = [], nor = [], uv = [], col = [], bark = [], idx = [];
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const vert = (p, n, u, v, c, b) => { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(u, v); col.push(c, c, c); bark.push(b); return pos.length / 3 - 1; };
    // the trunk
    const TS = light ? 4 : 7;
    for (let i = 0; i <= TS; i++) {
      const a = (i / TS) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      vert(v3(cx * 0.028, 0, cz * 0.028), v3(cx, 0, cz), 0, 0, 1, 1);
      vert(v3(cx * 0.006, 0.97, cz * 0.006), v3(cx, 0, cz), 0, 1, 1, 1);
      if (i < TS) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const ASPECT = 0.61;                                   // the branch picture's width over its length
    const card = (base, dir, len, tilt, droop, f) => {
      const side0 = new T.Vector3().crossVectors(dir, v3(0, 1, 0)).normalize();
      const up0 = new T.Vector3().crossVectors(side0, dir);
      const side = side0.multiplyScalar(Math.cos(tilt)).addScaledVector(up0, Math.sin(tilt));
      const w = len * ASPECT * (light ? 0.6 : 0.5), first = pos.length / 3, S = light ? 1 : 2;
      for (let s = 0; s <= S; s++) {
        const k = s / S;
        const c = base.clone().addScaledVector(dir, len * k);
        c.y -= droop * len * k * k;
        // out from the crown and a little up
        const n = v3(c.x, 0, c.z).normalize().multiplyScalar(0.8).add(v3(0, 0.55, 0)).normalize();
        const ao = mix(0.5, 1, k) * (0.62 + 0.38 * f);
        vert(c.clone().addScaledVector(side, -w), n, 0, k, ao, 0);
        vert(c.clone().addScaledVector(side, w), n, 1, k, ao, 0);
      }
      for (let s = 0; s < S; s++) { const a = first + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    };
    // seen from afar a spruce needs only a few, wider cards, one per branch, tilted alternately
    const whorls = light ? 7 : 12;
    for (let i = 0; i < whorls; i++) {
      const f = i / (whorls - 1);
      const y = 0.1 + f * 0.8 + (R() - 0.5) * 0.02;
      const len = (0.4 * Math.pow(1 - f, 0.85) + 0.07) * (0.85 + R() * 0.3);
      const count = light ? (f > 0.8 ? 3 : 4) : f > 0.82 ? 4 : 5 + ((R() * 2) | 0);
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + i * 0.9 + R() * 0.5;
        const pitch = -0.15 - (1 - f) * 0.25 + (R() - 0.5) * 0.1;      // lower branches slope down more
        const dir = v3(Math.cos(a), pitch, Math.sin(a)).normalize();
        const base = v3(Math.cos(a) * 0.015, y, Math.sin(a) * 0.015);
        const droop = 0.18 + (1 - f) * 0.22;
        card(base, dir, len, light ? (k % 2 ? 0.6 : -0.6) : 0.55, droop, f);
        if (!light) card(base, dir, len, -0.55, droop, f);
      }
    }
    // the leader at the top
    card(v3(0, 0.86, 0), v3(0.02, 1, 0).normalize(), 0.14, 0, 0, 1);
    card(v3(0, 0.86, 0), v3(0.02, 1, 0).normalize(), 0.14, Math.PI / 2, 0, 1);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setAttribute('aBark', new T.Float32BufferAttribute(bark, 1));
    g.setIndex(idx);
    return g;
  }
  // a low tuft of grass blades, unit height
  function tuft() {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + hash(i, 4);
      const g = new T.BufferGeometry();
      const lean = 0.25 + hash(i, 8) * 0.3, w = 0.045;
      const tip = [Math.cos(a) * lean, 1, Math.sin(a) * lean];
      g.setAttribute('position', new T.BufferAttribute(new Float32Array([
        -w * Math.sin(a), 0, w * Math.cos(a), w * Math.sin(a), 0, -w * Math.cos(a), ...tip]), 3));
      g.setAttribute('color', new T.BufferAttribute(new Float32Array([0.03, 0.04, 0.015, 0.03, 0.04, 0.015, 0.17, 0.17, 0.06]), 3));
      g.computeVertexNormals();
      parts.push(g);
    }
    return merge(parts);
  }
  // box UVs from world position, so a texture keeps its scale across walls of any size
  function worldUV(g, ox, oy, oz, size) {
    const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) + ox, y = P.getY(i) + oy, z = P.getZ(i) + oz;
      const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i));
      if (nx > 0.5) UV.setXY(i, z / size, y / size);
      else if (ny > 0.5) UV.setXY(i, x / size, z / size);
      else UV.setXY(i, x / size, y / size);
    }
  }

  // ---------- textures ----------
  function canvasTex(size, draw, repeat, srgb = true) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new T.CanvasTexture(c);
    if (srgb) t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 8;
    return t;
  }
  // board-formed concrete, one tile per 2.4 m: eight boards, their seams, tie holes and weathering
  const boardConcrete = base => canvasTex(512, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const bh = s / 8;
    for (let b = 0; b < 8; b++) {
      g.fillStyle = `rgba(${hash(b, 1) > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + hash(b, 2) * 0.035})`;
      g.fillRect(0, b * bh, s, bh);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(0,0,0,${0.015 + hash(b, k) * 0.03})`;
        g.fillRect(hash(k, b + 7) * s, b * bh + hash(b, k + 3) * bh, 20 + hash(k, b) * 120, 1);
      }
      g.fillStyle = 'rgba(0,0,0,.09)'; g.fillRect(0, b * bh, s, 1.5);
    }
    for (let i = 0; i < 70; i++) {
      const x = hash(i, 1) * s, y = hash(i, 2) * s, r = 20 + hash(i, 3) * 100;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, hash(i, 4) > 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.05)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + hash(i, 9) * 0.07})`;
      g.fillRect(hash(i, 5) * s, hash(i, 6) * s, 1 + hash(i, 7) * 1.4, 1 + hash(i, 8) * 1.4);
    }
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (let y = bh; y < s; y += bh * 2) for (let x = s / 8; x < s; x += s / 4) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
  });
  const woodTex = canvasTex(256, (g, s) => {
    g.fillStyle = '#3b2a1e'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${hash(i, 21) > 0.5 ? '20,12,8' : '90,64,44'},${0.15 + hash(i, 22) * 0.3})`;
      g.lineWidth = 1 + hash(i, 23) * 2;
      const x = hash(i, 24) * s;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, s * 0.3, x - 6, s * 0.7, x + 3, s); g.stroke();
    }
  });
  const gravelTex = canvasTex(512, (g, s) => {
    g.fillStyle = '#cfcac0'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 14000; i++) {
      const v = 150 + hash(i, 11) * 90;
      g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      g.fillRect(hash(i, 12) * s, hash(i, 13) * s, 1.5, 1.5);
    }
    g.strokeStyle = 'rgba(80,70,60,.22)'; g.lineWidth = 3;
    for (let y = 8; y < s; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + Math.sin(y) * 2); g.stroke(); }
  }, [2, 2]);
  // asphalt along the road (v runs along it): aggregate, wear in the wheel tracks, faded edge lines
  const asphaltTex = canvasTex(256, (g, s) => {
    g.fillStyle = '#3a3936'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const v = 40 + hash(i, 31) * 50;
      g.fillStyle = `rgba(${v},${v},${v - 3},.8)`;
      g.fillRect(hash(i, 32) * s, hash(i, 33) * s, 1.2, 1.2);
    }
    for (const x of [0.3, 0.7]) {
      const grd = g.createLinearGradient((x - 0.1) * s, 0, (x + 0.1) * s, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(255,255,255,.05)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect((x - 0.1) * s, 0, 0.2 * s, s);
    }
    g.fillStyle = 'rgba(225,220,205,.55)';
    g.fillRect(0.055 * s, 0, 3, s); g.fillRect(0.945 * s - 3, 0, 3, s);
  });
  // ripples for the lake, as a tangent-space normal map
  const rippleTex = canvasTex(256, (g, s) => {
    const img = g.createImageData(s, s);
    const hgt = (x, y) => fbm(x / 24, y / 24, 4) + 0.5 * fbm(x / 9 + 7, y / 9, 3);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
      const n = new T.Vector3(-dx * 6, -dy * 6, 1).normalize(), k = (y * s + x) * 4;
      img.data[k] = (n.x * 0.5 + 0.5) * 255; img.data[k + 1] = (n.y * 0.5 + 0.5) * 255; img.data[k + 2] = (n.z * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, [24, 12], false);

  // ---------- light ----------
  // golden hour: a low sun in the west-south-west, raking across the front of the house
  const SUN = new T.Vector3(-0.8, 0.19, 0.42).normalize();
  const lin = (r, g, b) => new T.Color().setRGB(r, g, b);
  const SKY = {
    zenith: lin(0.09, 0.17, 0.38), horizon: lin(1.45, 0.78, 0.4), horizonCool: lin(0.38, 0.48, 0.66),
    haze: lin(1.6, 0.85, 0.42), sun: lin(1.0, 0.72, 0.45),
  };
  const glsl = c => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
  // the horizon is warm toward the sun and cool away from it; the sky and the haze share this
  const HORIZON_GLSL = `vec3 horizonAt(vec3 d){ float s = dot(normalize(d), vec3(${SUN.x.toFixed(4)}, ${SUN.y.toFixed(4)}, ${SUN.z.toFixed(4)})) * .5 + .5;
    return mix(${glsl(SKY.horizonCool)}, ${glsl(SKY.horizon)}, pow(s, 2.5)); }`;

  // aerial perspective instead of three's flat fog: thicker low in the valley, warm toward the
  // sun and cool away from it, so distant ridges dissolve into the sky behind them
  T.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying vec3 vFogDir;\n#endif';
  T.ShaderChunk.fog_vertex = `#ifdef USE_FOG
    vec4 fogWorld = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      fogWorld = instanceMatrix * fogWorld;
    #endif
    vFogDir = (modelMatrix * fogWorld).xyz - cameraPosition;
  #endif`;
  T.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
    uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying vec3 vFogDir;
    ${HORIZON_GLSL}
  #endif`;
  T.ShaderChunk.fog_fragment = `#ifdef USE_FOG
    float fogDist = length(vFogDir);
    float fogMid = cameraPosition.y + vFogDir.y * .5 - (${LAKE.toFixed(1)});
    float fogAmt = 1. - exp(-fogDist * (.0010 * exp(-max(fogMid, 0.) / 90.) + .00011));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, horizonAt(vFogDir) * .85, fogAmt * fogAmt * (3. - 2. * fogAmt));
  #endif`;
  const skyMaterial = () => new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uSun: { value: SUN }, uZenith: { value: SKY.zenith },
      uHaze: { value: SKY.haze }, uSunColor: { value: SKY.sun }, uTime: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `
      uniform vec3 uSun, uZenith, uHaze, uSunColor; uniform float uTime; varying vec3 vDir;
      ${HORIZON_GLSL}
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * n2(p); p *= 2.03; a *= .5; } return v; }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        float sd = max(dot(d, uSun), 0.);
        vec3 hor = horizonAt(d);
        vec3 col = mix(hor, uZenith, pow(smoothstep(-0.02, 0.65, h), 0.55));
        col += uHaze * pow(sd, 5.) * (1. - smoothstep(0., 0.45, h)) * .75;      // the warm haze around the sun
        col += uSunColor * (pow(sd, 1800.) * 60. + pow(sd, 90.) * 1.6);          // its disc and glow
        // high thin cloud, lit from the sun's side
        vec2 cp = d.xz / max(h + 0.12, 0.05) * 0.55 + vec2(uTime * 0.003, 0.);
        float c = smoothstep(0.52, 0.9, fbm(cp)) * smoothstep(0.03, 0.3, h) * (1. - smoothstep(0.6, 0.95, h));
        vec3 cloud = mix(vec3(0.55, 0.5, 0.55), vec3(1.5, 0.95, 0.65), pow(sd, 3.) * 0.8 + 0.2);
        col = mix(col, cloud, c * 0.55);
        col = mix(col, hor * 0.8, smoothstep(0.0, -0.15, h));
        gl_FragColor = vec4(col, 1.);
      }`,
  });

  // ---------- the camera's journey ----------
  // eye and aim positions; their indices line up, and stations are the ones the headlines sit on
  function journey() {
    const V = (x, y, z) => new T.Vector3(x, y, z);
    const G = (x, dy, z) => V(x, heightAt(x, z) + dy, z);           // dy above the ground
    const R = (s, dy, side = 0) => {                                   // dy above the road, s along it (0..1)
      const p = road.curve.getPointAt(s), t = road.curve.getTangentAt(s);
      const r = roadNear(p.x, p.z);
      return V(p.x - t.z * side, (r ? r.h : 0) + dy, p.z + t.x * side);
    };
    const eye = [], aim = [], stations = [];
    const at = (e, a, station) => { if (station) stations.push(eye.length); eye.push(e); aim.push(a); };
    // (aimed left of the house, so it sits right of the headline)
    at(V(205, 46, -175), V(43, 33, 51), true);           // 0  over the lake, the house against the low sun
    at(V(70, 50, -222), V(-70, 6, -70));                  //    gliding west across the water
    at(V(-120, 34, -196), R(0.24, 4));                    //    banking toward the shore where the road begins
    at(V(-150, 15, -146), R(0.32, 2.5));                  //    settling down over the shore
    // down onto the road and along it through the forest, close enough to follow its bends
    for (let s = 0.34; s < 0.8; s += 0.05) {
      const k = (s - 0.34) / 0.46;
      at(R(s, mix(7.5, 2.8, Math.sqrt(k))), R(s + 0.07, mix(3, 2.2, k)));
    }
    at(R(0.83, 2.6, 0.5), V(2, 3.5, -12), true);           // 1  out of the trees: the house across the meadow
    at(G(-22, 6.5, 30), V(2, 3, 2));                       //    rising and swinging south
    at(G(-15, 2.3, 31), V(9, 2.6, 3), true);               // 2  the front of the house at an angle
    at(G(-25, 3.6, 15), V(-14, 2.2, 1));                   //    back round to the west door
    at(V(-27.5, 1.75, 1), V(-15, 1.75, 0));
    at(V(-17, 1.68, 0.1), V(-6, 1.65, 0.1));               //    the threshold
    at(V(-10.5, 1.62, 0.05), V(1.3, 1.55, -0.15), true);   // 3  in the cedar corridor, the bonsai at its end
    at(V(-4.3, 1.62, 0.35), V(1.3, 1.9, -0.25));           //    into the courtyard
    at(V(-0.4, 1.62, 2.75), V(1.4, 1.8, -0.4));            //    past the bonsai
    at(V(5.2, 1.55, 2.9), V(11, 1.5, 4));                  //    through to the living room
    at(V(9, 1.45, -2.2), V(8, 1.35, 9.5), true);           // 4  facing the glass and the sun
    return {
      eye: new T.CatmullRomCurve3(eye, false, 'centripetal'),
      aim: new T.CatmullRomCurve3(aim, false, 'centripetal'),
      stations, last: eye.length - 1,
    };
  }

  // ---------- photographed surfaces ----------
  // the textures (textures/textures.js, photographed and made tileable) once they have loaded
  const TX = {};
  // world position and normal, for texturing by where a surface is rather than by its UVs
  const WORLD_VARYINGS_VS = `#include <worldpos_vertex>
    vec4 wPos = vec4(transformed, 1.); vec3 wNrm = objectNormal;
    #ifdef USE_INSTANCING
      wPos = instanceMatrix * wPos; wNrm = mat3(instanceMatrix) * wNrm;
    #endif
    vWP = (modelMatrix * wPos).xyz; vWN = normalize(mat3(modelMatrix) * wNrm);`;
  const SURFACE_GLSL = `varying vec3 vWP; varying vec3 vWN;
    float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }
    // a texture projected along the three axes and blended by the surface's facing
    vec3 tri(sampler2D t, vec3 p, vec3 w){ return texture2D(t, p.zy).rgb * w.x + texture2D(t, p.xz).rgb * w.y + texture2D(t, p.xy).rgb * w.z; }
    // the same, blurred by reading smaller mip levels: for heights, whose slopes must stay gentle
    float triH(sampler2D t, vec3 p, vec3 w, float b){ return dot(texture2D(t, p.zy, b).rgb * w.x + texture2D(t, p.xz, b).rgb * w.y + texture2D(t, p.xy, b).rgb * w.z, vec3(.33)); }`;
  // the colour code may set gH, a height in metres-ish, which then bumps the shading normal: the
  // rock's cracks and gullies catch the low light instead of being only painted on
  function worldShaded(material, uniforms, fragmentCode) {
    material.extensions = { derivatives: true };
    material.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
        .replace('#include <worldpos_vertex>', WORLD_VARYINGS_VS);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tRock, tMeadow, tForest;\n' + SURFACE_GLSL)
        .replace('void main() {', 'void main() {\n  float gH = 0.;')
        .replace('#include <color_fragment>', fragmentCode)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
            vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
            float det = dot(sx, r1);
            vec3 grad = sign(det) * (dFdx(gH) * r1 + dFdy(gH) * r2);
            normal = normalize(abs(det) * normal - grad);
          }`);
    };
    return material;
  }
  // the ground: meadow, forest floor, trodden verges, scree, rock where it's steep and snow up high,
  // each photographed texture sampled at two scales so its tiling never shows; vertex colour carries
  // (forest, verge, light)
  function groundMaterial() {
    return worldShaded(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.25 }),
      { tRock: { value: TX.rock }, tMeadow: { value: TX.meadow }, tForest: { value: TX.forest } }, `
      vec3 gN = normalize(vWN);
      float slope = 1. - gN.y;
      vec3 tw = pow(abs(gN), vec3(6.)); tw /= tw.x + tw.y + tw.z;
      float dist = length(vWP - cameraPosition), alt = vWP.y;
      vec2 gp = vWP.xz;
      float n1 = gn(gp / 23.), n2 = gn(gp / 97.), n3 = gn(gp / 7.);
      vec3 rockNear = mix(tri(tRock, vWP / 9., tw), tri(tRock, vWP / 47., tw), .45);
      // seen from afar the same rock, very large, reads as gullies and cliff bands
      vec3 rockFar = tri(tRock, vWP / 190., tw);
      float farK = smoothstep(150., 900., dist);
      vec3 rock = mix(rockNear, mix(rockNear, rockFar, .65), farK);
      float rl = dot(rock, vec3(.3, .59, .11));
      rock = mix(vec3(rl), rock, .55) * mix(vec3(1.), vec3(1.1, 1.02, .92), n2);     // greyer, warmer in places
      float macro = dot(tri(tRock, vWP / 420., tw), vec3(.33));
      rock *= mix(.62, 1.18, smoothstep(.2, .7, macro));                             // darker and lighter rock
      vec3 meadow = mix(texture2D(tMeadow, gp / 4.).rgb, texture2D(tMeadow, gp / 26.).rgb, .5);
      meadow *= mix(vec3(1.06, 1., .86), vec3(.86, .98, .86), n1 * .7 + n3 * .3);
      vec3 floorC = mix(texture2D(tForest, gp / 3.5).rgb, texture2D(tForest, gp / 21.).rgb, .4);
      // far off, forest is seen as its canopy, not its floor
      vec3 forestC = mix(floorC * .75, meadow * vec3(.2, .28, .18), smoothstep(200., 650., dist));
      vec3 g = mix(meadow, forestC, vColor.r);
      g = mix(g, floorC * vec3(.95, .85, .75) * .85, vColor.g);
      // alpine grass thins out to scree with height
      g = mix(g, rock * 1.05, smoothstep(130., 290., alt + (n2 - .5) * 90.) * (1. - vColor.r));
      float rk = smoothstep(.3, .55, slope + (n1 - .5) * .25);
      g = mix(g, rock * mix(1., .7, smoothstep(.55, .85, slope)), rk);              // cliffs darker than scree
      float rockAmt = max(rk, smoothstep(130., 290., alt));
      gH = ((triH(tRock, vWP / 420., tw, 3.) * 22. + triH(tRock, vWP / 190., tw, 2.5) * 5.) * farK
        + triH(tRock, vWP / 9., tw, 1.) * .8 * (1. - farK)) * rockAmt;
      g = mix(g, rock * vec3(.5, .47, .42), smoothstep(${(LAKE + 3.5).toFixed(1)}, ${(LAKE + 1.2).toFixed(1)}, alt));
      // snow on the higher, gentler ground, thinning out on steep faces
      float line = 340. + (n2 - .5) * 150.;
      float sn = smoothstep(line, line + 70., alt) * (1. - smoothstep(.5, .82, slope + (n3 - .5) * .3 + (macro - .45) * .4));
      g = mix(g, vec3(.82, .86, .92) * (.92 + .08 * n3), sn);
      diffuseColor.rgb *= g * vColor.b;`);
  }
  // boulders and the courtyard stone: the photographed rock, mossy where it faces the sky
  function stoneMaterial() {
    return worldShaded(new T.MeshStandardMaterial({ roughness: 0.88, envMapIntensity: 0.3 }), { tRock: { value: TX.rock } }, `
      vec3 sN = normalize(vWN);
      vec3 sw = pow(abs(sN), vec3(4.)); sw /= sw.x + sw.y + sw.z;
      vec3 rc = mix(tri(tRock, vWP / 1.7, sw), tri(tRock, vWP / 6.5, sw), .35);
      float moss = smoothstep(.55, .9, sN.y + (gn(vWP.xz * 1.3) - .5) * .35);
      diffuseColor.rgb *= mix(rc, rc * vec3(.5, .72, .3), moss * .8) * 1.1;
      gH = dot(tri(tRock, vWP / 1.7, sw), vec3(.33)) * .06;`);
  }

  function barkMaterial() {
    return worldShaded(new T.MeshStandardMaterial({ roughness: 0.92, envMapIntensity: 0.25 }), { tRock: { value: TX.rock } }, `
      vec3 bN = normalize(vWN);
      vec3 bw = pow(abs(bN), vec3(4.)); bw /= bw.x + bw.y + bw.z;
      vec3 p = vWP * vec3(5., 1.6, 5.);
      float l = dot(tri(tRock, p, bw), vec3(.33));
      diffuseColor.rgb *= vec3(.3, .2, .13) * (.45 + l * 1.1);
      gH = l * .025;`);
  }

  // ---------- post-processing: bloom, filmic tone mapping, grade, vignette, grain ----------
  const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  const BRIGHT_FS = `uniform sampler2D tex; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tex, vUv).rgb; float l = max(c.r, max(c.g, c.b));
      gl_FragColor = vec4(c * smoothstep(1.2, 3.0, l), 1.); }`;
  const BLUR_FS = `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tex, vUv).rgb * .227027;
      c += (texture2D(tex, vUv + dir * 1.3846).rgb + texture2D(tex, vUv - dir * 1.3846).rgb) * .316216;
      c += (texture2D(tex, vUv + dir * 3.2308).rgb + texture2D(tex, vUv - dir * 3.2308).rgb) * .070270;
      gl_FragColor = vec4(c, 1.); }`;
  const FINAL_FS = `uniform sampler2D tScene, tBloom; uniform float uTime, uExposure, uBloom; uniform vec2 uRes; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
      c = aces(c * uExposure);
      float l = dot(c, vec3(.2126, .7152, .0722));
      c = mix(c, c * vec3(.95, 1., 1.05), (1. - l) * .4);      // cool shadows
      c = mix(c, c * vec3(1.06, 1., .91), l * .35);            // warm highlights
      c = mix(vec3(l), c, 1.04);
      c = mix(c, c * c * (3. - 2. * c), .22);                  // a gentle S-curve
      vec2 q = vUv - .5; c *= 1. - dot(q, q) * .6;              // vignette
      c = mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c));
      c += (rand(vUv * uRes + fract(uTime) * 91.) - .5) * .022; // film grain
      gl_FragColor = vec4(c, 1.); }`;

  function init(canvas, opts) {
    const high = opts.tier !== 'low';
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    const gl2 = renderer.capabilities.isWebGL2;
    renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 1.75 : 1.25));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    // counted per frame (shadows, scene and post together) rather than per render call
    renderer.info.autoReset = false;

    const scene = new T.Scene();
    scene.fog = new T.Fog(0xffffff, 1, 2);
    const cam = new T.PerspectiveCamera(38, 1, 0.1, 6000);
    const uTime = { value: 0 };

    // the render targets: HDR where the device supports it, multisampled on capable ones
    const hdr = gl2 ? T.HalfFloatType : T.UnsignedByteType;
    const rtScene = new T.WebGLRenderTarget(4, 4, { type: hdr, samples: gl2 ? (high ? 4 : 2) : 0 });
    const rtA = new T.WebGLRenderTarget(4, 4, { type: hdr }), rtB = new T.WebGLRenderTarget(4, 4, { type: hdr });
    const quad = new T.PlaneGeometry(2, 2), qcam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const pass = (fs, uniforms) => {
      const m = new T.ShaderMaterial({ uniforms, vertexShader: QUAD_VS, fragmentShader: fs, depthTest: false, depthWrite: false });
      const mesh = new T.Mesh(quad, m); mesh.frustumCulled = false;
      const s = new T.Scene(); s.add(mesh);
      return { m, s };
    };
    const bright = pass(BRIGHT_FS, { tex: { value: null } });
    const blur = pass(BLUR_FS, { tex: { value: null }, dir: { value: new T.Vector2() } });
    const comp = pass(FINAL_FS, {
      tScene: { value: rtScene.texture }, tBloom: { value: rtA.texture }, uTime, uExposure: { value: 1.15 },
      uBloom: { value: high ? 0.55 : 0 }, uRes: { value: new T.Vector2(1, 1) },
    });

    let ready = false, onReady = null, path = null, segs = null, skyU = null;
    const sunView = { value: new T.Vector3() };
    // the house's boxes, as [x0, y0, z0, x1, y1, z1], for checking the camera never passes through one
    const solids = [];
    const water = { tex: rippleTex };

    // the photographed textures, decoded before anything is built
    function loadTextures() {
      const src = window.TEXTURES || {}, loader = new T.TextureLoader();
      return Promise.all(['rock', 'meadow', 'forest', 'branch'].map(k => new Promise((resolve, reject) => {
        if (!src[k]) { reject(new Error('missing texture ' + k)); return; }
        loader.load(src[k], tex => {
          tex.colorSpace = T.SRGBColorSpace;
          tex.wrapS = tex.wrapT = k === 'branch' ? T.ClampToEdgeWrapping : T.RepeatWrapping;
          tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          TX[k] = tex;
          resolve();
        }, undefined, reject);
      })));
    }
    // heavy work waits a moment so the page paints (with its poster) first
    const fail = e => { console.error(e); if (opts.onFail) opts.onFail(); };
    setTimeout(() => loadTextures().then(() => {
      try { build(); } catch (e) { fail(e); return; }
      ready = true;
      if (onReady) onReady();
    }, fail), 30);

    // ---------- the world ----------
    let sun;
    function build() {
      const M = {
        concrete: new T.MeshStandardMaterial({ map: boardConcrete('#e3dfd7'), roughness: 0.86 }),
        plinth: new T.MeshStandardMaterial({ map: boardConcrete('#b9b4ab'), roughness: 0.92 }),
        dark: new T.MeshStandardMaterial({ color: lin(0.03, 0.027, 0.024), roughness: 0.85 }),
        wood: new T.MeshStandardMaterial({ map: woodTex, roughness: 0.72 }),
        floorWood: new T.MeshStandardMaterial({ map: woodTex, color: lin(0.75, 0.66, 0.58), roughness: 0.5 }),
        polished: new T.MeshStandardMaterial({ color: lin(0.09, 0.088, 0.085), roughness: 0.22 }),
        gravel: new T.MeshStandardMaterial({ map: gravelTex, roughness: 1 }),
        glass: new T.MeshStandardMaterial({ color: lin(0.16, 0.2, 0.22), roughness: 0.03, metalness: 0, transparent: true, depthWrite: false }),
        led: new T.MeshBasicMaterial({ color: lin(7, 4.2, 2.1) }),
        warmPanel: new T.MeshBasicMaterial({ color: lin(1.6, 0.95, 0.5) }),

        road: new T.MeshStandardMaterial({ map: asphaltTex, roughness: 0.82, color: lin(0.9, 0.9, 0.9) }),
        veg: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: T.DoubleSide }),
        // spruces built of photographed branches: cut out by the picture's alpha, smoothed at the edge
        // by multisampling, with outward normals on both faces and the low sun glowing through them
        needles: new T.MeshStandardMaterial({ map: TX.branch, alphaTest: 0.5, alphaToCoverage: true, side: T.DoubleSide, vertexColors: true, roughness: 0.9 }),
        lake: new T.MeshStandardMaterial({ color: lin(0.012, 0.025, 0.035), roughness: 0.14, metalness: 0, normalMap: water.tex, normalScale: new T.Vector2(0.08, 0.08) }),
      };
      // the sky is for the glass and the water to reflect; everything else takes only a hint of it
      for (const k in M) if (M[k].isMeshStandardMaterial) M[k].envMapIntensity = { glass: 1.8, lake: 0.55, polished: 0.8 }[k] ?? 0.3;
      // like real glass it is clear face on and turns to a mirror at a glance
      M.glass.onBeforeCompile = sh => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
          float fres = pow(1. - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0., 1.), 3.);
          diffuseColor.a = mix(.22, .92, fres);
          #include <opaque_fragment>`);
      };
      M.stone = stoneMaterial();
      M.bark = barkMaterial();
      M.needlesFar = M.needles.clone();
      M.needlesFar.alphaTest = 0.3;
      M.needles.onBeforeCompile = sh => {
        sh.uniforms.uTime = uTime;
        sh.uniforms.uSunView = sunView;
        sh.vertexShader = 'uniform float uTime;\nattribute float aBark;\nvarying float vBark;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          vBark = aBark;
          #ifdef USE_INSTANCING
            vec2 ip = instanceMatrix[3].xz;
          #else
            vec2 ip = vec2(0.);
          #endif
          float gust = sin(uTime * 1.1 + ip.x * 0.07 + ip.y * 0.05) * 0.6 + sin(uTime * 2.3 + ip.x * 0.17) * 0.25;
          transformed.xz += gust * position.y * position.y * vec2(0.012, 0.008) + gust * (1. - aBark) * 0.004 * vec2(sin(position.y * 40.), cos(position.y * 37.));`);
        sh.fragmentShader = 'uniform vec3 uSunView;\nvarying float vBark;\n' + sh.fragmentShader
          .replace('#include <map_fragment>', '#include <map_fragment>\nif (vBark > .5) diffuseColor = vec4(.085, .06, .042, 1.);')
          .replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;')
          .replace('#include <opaque_fragment>', `float through = pow(max(dot(normalize(-vViewPosition), uSunView), 0.), 6.) * (1. - vBark);
            outgoingLight += diffuseColor.rgb * vec3(1., .72, .42) * through * 1.3;
            #include <opaque_fragment>`);
      };
      M.needlesFar.onBeforeCompile = M.needles.onBeforeCompile;
      // trees and grass move a little in the air
      M.veg.onBeforeCompile = sh => {
        sh.uniforms.uTime = uTime;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec2 ip = instanceMatrix[3].xz;
          #else
            vec2 ip = vec2(0.);
          #endif
          float gust = sin(uTime * 1.1 + ip.x * 0.07 + ip.y * 0.05) * 0.6 + sin(uTime * 2.3 + ip.x * 0.17) * 0.25;
          transformed.xz += gust * position.y * position.y * vec2(0.014, 0.009);`);
      };

      // sky, and its reflection for the materials
      const sky = new T.Mesh(new T.SphereGeometry(3500, 48, 24), skyMaterial());
      sky.renderOrder = -1;
      sky.frustumCulled = false;
      scene.add(sky);
      skyU = sky.material.uniforms;
      const pmrem = new T.PMREMGenerator(renderer);
      const envScene = new T.Scene();
      envScene.add(new T.Mesh(new T.SphereGeometry(60, 32, 16), skyMaterial()));
      scene.environment = pmrem.fromScene(envScene, 0.03).texture;
      pmrem.dispose();

      scene.add(new T.HemisphereLight(lin(0.46, 0.5, 0.58), lin(0.24, 0.2, 0.14), 0.75));
      sun = new T.DirectionalLight(SKY.sun, 6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.07;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 3400;
      scene.add(sun, sun.target);

      // terrain: the valley floor as one even grid, and the mountains as a ring of their own in polar
      // steps that grow with distance, so far peaks keep their shape without spending vertices on them
      const SQ = [-60, -40], HALF = 500;
      const R0 = MOUNT_R + 25, R1 = 2600, NA = high ? 720 : 400, NR = high ? 220 : 130;
      const ringRadius = j => R0 * Math.pow(R1 / R0, j / NR);
      const ringH = new Float32Array((NA + 1) * (NR + 1));
      for (let j = 0; j <= NR; j++) {
        const r = ringRadius(j);
        for (let i = 0; i <= NA; i++) {
          const a = (i / NA) * Math.PI * 2;
          ringH[j * (NA + 1) + i] = heightAt(MC[0] + Math.cos(a) * r, MC[1] + Math.sin(a) * r);
        }
      }
      const LOG = Math.log(R1 / R0);
      const ringSample = (x, z) => {
        const dx = x - MC[0], dz = z - MC[1], r = Math.hypot(dx, dz);
        if (r < R0 || r >= R1) return -1e9;
        const fj = (Math.log(r / R0) / LOG) * NR;
        let fa = Math.atan2(dz, dx) / (Math.PI * 2);
        if (fa < 0) fa += 1;
        fa *= NA;
        const j = Math.min(NR - 1, fj | 0), i = Math.min(NA - 1, fa | 0), tj = fj - j, ti = fa - i, k = j * (NA + 1) + i;
        return mix(mix(ringH[k], ringH[k + 1], ti), mix(ringH[k + NA + 1], ringH[k + NA + 2], ti), tj);
      };
      // how much of the low sun gets past the peaks between a point and the sun
      const tanSun = SUN.y / Math.hypot(SUN.x, SUN.z);
      const sunVisible = (x, y, z) => {
        let vis = 1;
        for (let k = 0, d = 8; k < 30; k++, d *= 1.2) {
          const hs = ringSample(x + SUN_H[0] * d, z + SUN_H[1] * d);
          if (hs > -1e8) vis = Math.min(vis, clamp((y + d * tanSun - hs) / (d * 0.04 + 4) + 0.5));
          if (vis <= 0) break;
        }
        return vis;
      };
      // per vertex: how much forest, how much trodden verge, and the light (occlusion and the sun)
      const paintGround = (x, y, z, ny, cav, out, o) => {
        const r = Math.hypot(x - PLATEAU[0], z - PLATEAU[1]), mr = meadowAt(x, z);
        out[o] = forestMask(x, y, z, ny) * step(mr - 6, mr + 10, r);
        const rd = roadNear(x, z);
        out[o + 1] = rd ? 1 - step(ROAD_HALF + 0.5, ROAD_HALF + 2.5, rd.d) : 0;
        out[o + 2] = clamp(1 - Math.max(cav, 0) * 1.2, 0.55, 1) * (1 - out[o] * 0.25) * (0.3 + 0.7 * sunVisible(x, y, z));
      };
      const groundMat = groundMaterial();
      {
        const seg = high ? 400 : 240, row = seg + 1;
        const g = new T.PlaneGeometry(HALF * 2, HALF * 2, seg, seg);
        g.rotateX(-Math.PI / 2);
        const P = g.attributes.position, n = P.count;
        for (let i = 0; i < n; i++) {
          const x = SQ[0] + P.getX(i), z = SQ[1] + P.getZ(i);
          P.setXYZ(i, x, heightAt(x, z), z);
        }
        g.computeVertexNormals();
        const N = g.attributes.normal, col = new Float32Array(n * 3), sp = (HALF * 2) / seg;
        for (let i = 0; i < n; i++) {
          const c0 = i % row, r0 = (i / row) | 0, y = P.getY(i);
          let cav = 0;
          if (c0 > 0 && c0 < seg && r0 > 0 && r0 < seg) cav = ((P.getY(i - 1) + P.getY(i + 1) + P.getY(i - row) + P.getY(i + row)) / 4 - y) / sp;
          paintGround(P.getX(i), y, P.getZ(i), N.getY(i), cav, col, i * 3);
        }
        g.setAttribute('color', new T.BufferAttribute(col, 3));
        g.deleteAttribute('uv');
        const valley = new T.Mesh(g, groundMat);
        valley.receiveShadow = true;
        scene.add(valley);
      }
      {
        const cols = NA + 1, n = cols * (NR + 1), P = new Float32Array(n * 3), idx = [];
        for (let j = 0; j <= NR; j++) {
          const r = ringRadius(j);
          for (let i = 0; i <= NA; i++) {
            const a = (i / NA) * Math.PI * 2, x = MC[0] + Math.cos(a) * r, z = MC[1] + Math.sin(a) * r, k = j * cols + i;
            let y = ringH[k];
            // where the valley grid already covers the ground, tuck the ring under it
            const inside = Math.min(HALF - Math.abs(x - SQ[0]), HALF - Math.abs(z - SQ[1]));
            if (inside > 0) y -= step(0, 14, inside) * 6;
            P[k * 3] = x; P[k * 3 + 1] = y; P[k * 3 + 2] = z;
            // wound counter-clockwise seen from above, so the surface faces up
            if (j < NR && i < NA) idx.push(k, k + 1, k + cols, k + 1, k + cols + 1, k + cols);
          }
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(P, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        // the first and last meridians are the same line; give them one normal so no seam shows
        const N = g.attributes.normal;
        for (let j = 0; j <= NR; j++) {
          const a = j * cols, b = a + NA;
          const nx = N.getX(a) + N.getX(b), ny = N.getY(a) + N.getY(b), nz = N.getZ(a) + N.getZ(b), l = Math.hypot(nx, ny, nz);
          N.setXYZ(a, nx / l, ny / l, nz / l); N.setXYZ(b, nx / l, ny / l, nz / l);
        }
        const col = new Float32Array(n * 3);
        for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) {
          const k = j * cols + i, y = P[k * 3 + 1];
          let cav = 0;
          if (j > 0 && j < NR) {
            const l = i > 0 ? k - 1 : k + NA - 1, rr = i < NA ? k + 1 : k - NA + 1;
            const sp = ringRadius(j) * (LOG / NR);
            cav = ((P[l * 3 + 1] + P[rr * 3 + 1] + P[(k - cols) * 3 + 1] + P[(k + cols) * 3 + 1]) / 4 - y) / sp;
          }
          paintGround(P[k * 3], y, P[k * 3 + 2], N.getY(k), cav, col, k * 3);
        }
        g.setAttribute('color', new T.BufferAttribute(col, 3));
        const ring = new T.Mesh(g, groundMat);
        ring.receiveShadow = true;
        scene.add(ring);
      }

      // the lake, with moving ripples
      const lake = new T.Mesh(new T.PlaneGeometry(1500, 700), M.lake);
      lake.rotation.x = -Math.PI / 2;
      lake.position.set(0, LAKE, -235);
      scene.add(lake);

      // the road surface: a ribbon on its bed, with shoulders that slope into the verge
      {
        const n = road.n, pos = [], uv = [], idx = [];
        const across = [-ROAD_HALF - 1.2, -ROAD_HALF, ROAD_HALF, ROAD_HALF + 1.2];
        const drop = [-0.16, 0.02, 0.02, -0.16];
        const U = [-0.08, 0, 1, 1.08];
        let along = 0;
        for (let i = 0; i <= n; i++) {
          const x = road.xs[i], z = road.zs[i];
          const j = Math.min(n, i + 1), k = Math.max(0, i - 1);
          let tx = road.xs[j] - road.xs[k], tz = road.zs[j] - road.zs[k];
          const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
          if (i) along += Math.hypot(x - road.xs[i - 1], z - road.zs[i - 1]);
          for (let a = 0; a < 4; a++) {
            pos.push(x - tz * across[a], road.hs[i] + drop[a], z + tx * across[a]);
            uv.push(U[a], along / 6);
          }
          if (i < n) for (let a = 0; a < 3; a++) {
            // wound so the surface faces up
            const p0 = i * 4 + a, p1 = p0 + 1, p2 = p0 + 4, p3 = p0 + 5;
            idx.push(p0, p1, p2, p1, p3, p2);
          }
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        const m = new T.Mesh(g, M.road);
        m.receiveShadow = true;
        scene.add(m);
        // low bollard lights along the last stretch to the door
        const bol = new T.CylinderGeometry(0.09, 0.09, 0.7, 10);
        for (let s = 0.86; s < 0.995; s += 0.028) for (const side of [-1, 1]) {
          const p = road.curve.getPointAt(s), t = road.curve.getTangentAt(s);
          const x = p.x - t.z * side * (ROAD_HALF + 1.6), z = p.z + t.x * side * (ROAD_HALF + 1.6), y = heightAt(x, z);
          const post = new T.Mesh(bol, M.dark); post.position.set(x, y + 0.35, z); post.castShadow = true; scene.add(post);
          const cap = new T.Mesh(new T.CylinderGeometry(0.085, 0.085, 0.06, 10), M.led); cap.position.set(x, y + 0.6, z); scene.add(cap);
        }
      }

      buildHouse(M);
      path = journey();
      segs = arcLengths(path);
      buildNature(M);
    }

    // every eye position along the journey, for keeping trees and rocks out of the camera's way
    function pathSamples() {
      const out = [];
      for (let i = 0; i <= 900; i++) {
        const p = path.eye.getPoint(i / 900);
        out.push([p.x, p.z, p.y - heightAt(p.x, p.z)]);
      }
      return out;
    }

    function buildNature(M) {
      const R = rng(7), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), p3 = new T.Vector3(), tint = new T.Color();
      const samples = pathSamples();
      const stationEyes = path.stations.map(i => { const p = path.eye.points[i]; return [p.x, p.z]; });
      // nearest horizontal distance from the camera's path, counting only where it flies below `ceil`
      const fromPath = (x, z, ceil) => {
        let best = Infinity;
        for (const [px, pz, agl] of samples) {
          if (agl > ceil) continue;
          const d = (x - px) ** 2 + (z - pz) ** 2;
          if (d < best) best = d;
        }
        return Math.sqrt(best);
      };

      // spruce forest: detailed trees near the journey, light ones beyond
      const near = [[], [], []], far = [];
      const cell = high ? 8.5 : 12, maxNear = high ? 2200 : 800;
      for (let gx = -720; gx < 620; gx += cell) for (let gz = -720; gz < 620; gz += cell) {
        const x = gx + (R() - 0.5) * cell * 0.9, z = gz + (R() - 0.5) * cell * 0.9;
        const r = Math.hypot(x - PLATEAU[0], z - PLATEAU[1]);
        if (r < meadowAt(x, z) + R() * 14) continue;
        // the mountains' own forest is planted further down
        if (Math.hypot(x - MC[0], z - MC[1]) > MOUNT_R + 20) continue;
        if (forestAt(x, z) < 0.45 + R() * 0.06) continue;
        const y = heightAt(x, z);
        if (y < LAKE + 1.8 || y > 125) continue;
        if (Math.abs(heightAt(x + 2, z) - y) + Math.abs(heightAt(x, z + 2) - y) > 2.4) continue;
        const H = 9 + R() * 13 * (0.6 + forestAt(x, z) * 0.6), crown = 0.33 * H;
        const rd = roadNear(x, z);
        if (rd && rd.d < ROAD_HALF + 2.2 + crown) continue;
        if (fromPath(x, z, H + 4) < crown + 2.5) continue;
        if (stationEyes.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 18)) continue;
        const tree = { x, y, z, H, w: 0.85 + R() * 0.3, rot: R() * Math.PI * 2, c: 0.78 + R() * 0.45, hue: R() };
        if (fromPath(x, z, 400) < 120) near[(R() * 3) | 0].push(tree); else far.push(tree);
      }
      // keep the detailed count in budget: the farthest of them become light trees
      const nearAll = near.flat();
      if (nearAll.length > maxNear) {
        nearAll.forEach(t => { t.d = fromPath(t.x, t.z, 400); });
        nearAll.sort((a, b) => a.d - b.d);
        const keep = new Set(nearAll.slice(0, maxNear));
        for (let v = 0; v < 3; v++) { far.push(...near[v].filter(t => !keep.has(t))); near[v] = near[v].filter(t => keep.has(t)); }
      }
      // trees go in in patches of forest, so the patches behind the camera are never drawn
      const plant = (geo, list, shadows, patch, material) => {
        const groups = new Map();
        for (const t of list) {
          const key = Math.floor(t.x / patch) + ',' + Math.floor(t.z / patch);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(t);
        }
        for (const group of groups.values()) {
          const mesh = new T.InstancedMesh(geo, material, group.length);
          group.forEach((t, i) => {
            q.setFromEuler(e.set((R() - 0.5) * 0.05, t.rot, (R() - 0.5) * 0.05));
            m4.compose(p3.set(t.x, t.y - 0.25, t.z), q, sc.set(t.H * t.w, t.H, t.H * t.w));
            mesh.setMatrixAt(i, m4);
            mesh.setColorAt(i, tint.setRGB(t.c * (0.92 + t.hue * 0.16), t.c, t.c * (0.9 + t.hue * 0.12)));
          });
          mesh.computeBoundingSphere();
          mesh.castShadow = shadows; mesh.receiveShadow = shadows;
          scene.add(mesh);
        }
      };
      near.forEach((list, v) => plant(spruceCards(v + 1), list, true, 70, M.needles));
      // forest on the mountains' lower slopes, light trees seen only from afar
      for (let gx = -1500; gx < 1300; gx += high ? 20 : 34) for (let gz = -1500; gz < 1300; gz += high ? 20 : 34) {
        const x = gx + (R() - 0.5) * 16, z = gz + (R() - 0.5) * 16;
        const r = Math.hypot(x - MC[0], z - MC[1]);
        if (r < MOUNT_R + 20 || r > 1500) continue;
        const y = heightAt(x, z), ny = 1 / Math.hypot(1, (heightAt(x + 3, z) - y) / 3, (heightAt(x, z + 3) - y) / 3);
        if (forestMask(x, y, z, ny) < 0.5 + R() * 0.3) continue;
        far.push({ x, y, z, H: 16 + R() * 12, w: 0.9 + R() * 0.3, rot: R() * Math.PI * 2, c: 0.7 + R() * 0.4, hue: R() });
      }
      plant(spruceCards(9, true), far, false, 300, M.needlesFar);

      // boulders, mossy on top, along the road, the shore and the meadow's edge
      const rockGeo = [0, 1, 2].map(k => {
        const g = new T.IcosahedronGeometry(1, 4);
        const P = g.attributes.position, v = new T.Vector3();
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i);
          // broken faces: fracture planes cut through a lumpy core
          let s = 0.82 + fbm(v.x * 1.4 + k * 9, v.y * 1.4 + v.z * 1.1, 4) * 0.32;
          s -= Math.max(0, ridged(v.x * 0.9 + k * 3, v.z * 0.9 - v.y * 0.7) - 0.75) * 0.5;
          v.multiplyScalar(s);
          if (v.y < -0.15) v.y = -0.15 + (v.y + 0.15) * 0.25;
          v.y *= 0.65;
          P.setXYZ(i, v.x, v.y, v.z);
        }
        g.computeVertexNormals();
        return g;
      });
      const rocks = [[], [], []];
      for (let i = 0; i < 2600 && rocks[0].length + rocks[1].length < (high ? 260 : 120); i++) {
        const s = R(), side = R() < 0.5 ? -1 : 1;
        let x, z;
        if (i % 3 === 0) {
          const p = road.curve.getPointAt(s), t = road.curve.getTangentAt(s), off = ROAD_HALF + 2.5 + R() * 12;
          x = p.x - t.z * side * off; z = p.z + t.x * side * off;
        } else {
          const a = R() * Math.PI * 2, r = MEADOW - 8 + R() * 220;
          x = PLATEAU[0] + Math.cos(a) * r; z = PLATEAU[1] + Math.sin(a) * r;
        }
        const y = heightAt(x, z);
        if (y < LAKE - 0.5 || y > 90 || inHouse(x, z, 4)) continue;
        const rd = roadNear(x, z), size = 0.4 + R() ** 2 * 2.2;
        if (rd && rd.d < ROAD_HALF + 1.5 + size) continue;
        if (fromPath(x, z, 6) < size + 1.5) continue;
        rocks[i % 3].push({ x, y, z, size, rot: R() * 6.28 });
      }
      rocks.forEach((list, k) => {
        if (!list.length) return;
        const mesh = new T.InstancedMesh(rockGeo[k], M.stone, list.length);
        list.forEach((t, i) => {
          q.setFromEuler(e.set((R() - 0.5) * 0.4, t.rot, (R() - 0.5) * 0.4));
          m4.compose(p3.set(t.x, t.y + t.size * 0.12, t.z), q, sc.set(t.size * (0.9 + R() * 0.5), t.size, t.size * (0.9 + R() * 0.5)));
          mesh.setMatrixAt(i, m4);
        });
        mesh.castShadow = mesh.receiveShadow = true;
        scene.add(mesh);
      });

      // grass tufts where the camera comes close to the ground: the meadow and the road's verges
      const tufts = [];
      const want = high ? 9000 : 3000;
      for (let i = 0; i < want * 4 && tufts.length < want; i++) {
        let x, z;
        if (R() < 0.55) {
          const a = R() * Math.PI * 2, r = 14 + R() * (MEADOW + 6);
          x = PLATEAU[0] + Math.cos(a) * r; z = PLATEAU[1] + Math.sin(a) * r;
        } else {
          const p = road.curve.getPointAt(0.25 + R() * 0.75), t = road.curve.getTangentAt(0.5), side = R() < 0.5 ? -1 : 1;
          const off = ROAD_HALF + 1.4 + R() * 9;
          x = p.x - t.z * side * off; z = p.z + t.x * side * off;
        }
        if (inHouse(x, z, 1.5)) continue;
        const rd = roadNear(x, z);
        if (rd && rd.d < ROAD_HALF + 1.3) continue;
        const y = heightAt(x, z);
        if (y < LAKE + 2) continue;
        tufts.push({ x, y, z, s: 0.25 + R() * 0.45, rot: R() * 6.28, c: 0.7 + R() * 0.6 });
      }
      const grass = new T.InstancedMesh(tuft(), M.veg, tufts.length);
      tufts.forEach((t, i) => {
        q.setFromEuler(e.set(0, t.rot, 0));
        m4.compose(p3.set(t.x, t.y - 0.03, t.z), q, sc.set(t.s * 1.3, t.s, t.s * 1.3));
        grass.setMatrixAt(i, m4);
        grass.setColorAt(i, tint.setRGB(t.c * 1.1, t.c, t.c * 0.8));
      });
      grass.receiveShadow = true;
      scene.add(grass);
    }

    function buildHouse(M) {
      const house = new T.Group();
      scene.add(house);
      const box = (w, h, d, x, y, z, mat, shadow = true) => {
        const g = new T.BoxGeometry(w, h, d);
        if (mat.map && mat !== M.wood) worldUV(g, x, y, z, 2.4);
        const m = new T.Mesh(g, mat);
        m.position.set(x, y, z);
        m.castShadow = shadow; m.receiveShadow = true;
        house.add(m);
        solids.push([x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2]);
        return m;
      };
      const plane = (w, d, x, y, z, mat) => {
        const m = new T.Mesh(new T.PlaneGeometry(w, d), mat);
        m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
        house.add(m);
        return m;
      };
      const FLOOR = 0.3, CEIL = 3.85, WH = CEIL - FLOOR, WY = FLOOR + WH / 2;

      box(36, 0.6, 24, 0, 0, 0, M.plinth);
      // roof slab, open over the courtyard x[-4,4] z[-4,5]; a lit strip under the south overhang
      box(13, 0.55, 23, -10.5, 4.1, 0, M.concrete);
      box(13, 0.55, 23, 10.5, 4.1, 0, M.concrete);
      box(8, 0.55, 7.5, 0, 4.1, -7.75, M.concrete);
      box(8, 0.55, 6.5, 0, 4.1, 8.25, M.concrete);
      box(33, 0.03, 0.12, 0, 3.81, 11.2, M.led, false);

      // outer walls; the west one has the door, under a cantilevered canopy
      box(30.4, WH, 0.4, 0, WY, -9.5, M.concrete);
      box(0.4, WH, 8.2, -15, WY, -5.4, M.concrete);
      box(0.4, WH, 8.2, -15, WY, 5.4, M.concrete);
      box(0.4, CEIL - 3.05, 2.6, -15, (3.05 + CEIL) / 2, 0, M.concrete);
      box(4.2, 0.32, 5.6, -17.1, 3.96, 0, M.concrete);
      box(3.6, 0.025, 0.08, -17.1, 3.79, 0, M.led, false);
      box(3.2, 0.16, 5, -19.6, 0.08, 0, M.plinth);
      box(0.4, WH, 19, 15, WY, 0, M.concrete);
      // the south front: concrete fins and tall glass
      for (let x = -15; x <= 15; x += 5) box(0.35, WH, 0.6, x, WY, 9.5, M.concrete);
      box(30, WH, 0.06, 0, WY, 9.45, M.glass, false);

      // courtyard: white back wall, glass to the south, the corridor opening west, a wide opening east
      box(8, WH, 0.4, 0, WY, -4, M.concrete);
      box(8, WH, 0.06, 0, WY, 5, M.glass, false);
      box(0.4, WH, 2.7, -4, WY, -2.65, M.concrete);
      box(0.4, WH, 3.7, -4, WY, 3.15, M.concrete);
      box(0.4, WH, 5.6, 4, WY, -1.2, M.concrete);
      box(0.4, WH, 0.8, 4, WY, 4.6, M.concrete);
      plane(8, 9, 0, FLOOR + 0.01, 0.5, M.gravel);

      // the rooms either side of the corridor and behind the courtyard, dark behind the glass
      box(10.6, WH - 0.1, 7.6, -9.5, WY, -5.4, M.dark, false);
      box(10.6, WH - 0.1, 7.6, -9.5, WY, 5.4, M.dark, false);
      box(7.6, WH - 0.1, 4.8, 0, WY, -6.9, M.dark, false);
      box(7.6, WH - 0.1, 3.6, 0, WY, 7.0, M.dark, false);

      // corridor x[-14.6,-4]: cedar slats both sides, a light line down a polished floor
      const slatGeo = new T.BoxGeometry(0.07, WH, 0.22);
      const slats = new T.InstancedMesh(slatGeo, M.wood, 200);
      const m4 = new T.Matrix4(), tmp = new T.Color();
      let s = 0;
      for (const zSide of [-1.3, 1.3]) {
        for (let x = -14.6; x < -4.3; x += 0.2) {
          m4.makeTranslation(x, WY, zSide);
          slats.setMatrixAt(s, m4);
          slats.setColorAt(s, tmp.setRGB(0.75 + hash(x, zSide) * 0.3, 0.7 + hash(x, zSide) * 0.3, 0.65 + hash(x, zSide) * 0.3));
          s++;
        }
      }
      slats.count = s;
      slats.castShadow = slats.receiveShadow = true;
      house.add(slats);
      for (const zSide of [-1.3, 1.3]) solids.push([-14.65, FLOOR, zSide - 0.11, -4.25, CEIL, zSide + 0.11]);
      plane(10.8, 2.5, -9.6, FLOOR + 0.006, 0, M.polished);
      box(10.4, 0.02, 0.045, -9.5, FLOOR + 0.02, 0.15, M.led, false);
      box(10.8, 0.1, 2.6, -9.6, CEIL - 0.05, 0, M.dark, false);
      const hall = new T.PointLight(lin(1, 0.62, 0.35), 5, 9, 1.8);
      hall.position.set(-9.5, FLOOR + 0.4, 0.15);
      house.add(hall);

      // living room x[4,15]: wood floor, a bench against the glass with light under it, a low table
      plane(10.8, 18.6, 9.6, FLOOR + 0.01, 0, M.floorWood);
      plane(4.2, 3.2, 9.2, FLOOR + 0.02, 2.4, new T.MeshStandardMaterial({ color: lin(0.2, 0.17, 0.13), roughness: 1, envMapIntensity: 0.2 }));
      box(5.4, 0.42, 1, 9.5, FLOOR + 0.36, 6.9, M.wood);
      box(5.2, 0.03, 0.04, 9.5, FLOOR + 0.12, 6.38, M.led, false);
      box(0.12, 0.02, 6, 6.6, CEIL - 0.13, 1, M.warmPanel, false);
      box(0.12, 0.02, 6, 12.4, CEIL - 0.13, 1, M.warmPanel, false);
      box(10.8, 0.1, 18.6, 9.6, CEIL - 0.07, 0, M.dark, false);
      const lamp = new T.PointLight(lin(1, 0.66, 0.4), 22, 16, 1.6);
      lamp.position.set(9.5, 3.1, 1.6);
      house.add(lamp);

      // the second, lower volume to the east, lit inside
      box(16, 0.5, 13, 25, 3.55, 5, M.concrete);
      box(14, 3.1, 11, 25, 1.85, 5, M.concrete);
      box(14.1, 1.6, 11.1, 25, 1.9, 5, M.glass, false);
      box(13.8, 1.5, 10.8, 25, 1.9, 5, M.warmPanel, false);
      box(18, 0.5, 15, 25, 0.05, 5, M.plinth);

      // stepping stones across the south lawn
      for (let i = 0; i < 9; i++) {
        const sx = 6 + i * 1.6, sz = 13 + i * 2.2;
        box(1.4, 0.2, 0.8, sx, heightAt(sx, sz) + 0.05, sz, M.plinth).rotation.y = 0.5;
      }

      // the bonsai and its rock in the courtyard
      const tree = new T.Group();
      tree.position.set(1.3, FLOOR, -0.25);
      tree.scale.setScalar(0.85);
      house.add(tree);
      const limb = (points, r0, r1) => {
        const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
        const TS = 40, RS = 10, g = new T.TubeGeometry(curve, TS, 1, RS, false);
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
        const m = new T.Mesh(g, M.bark);
        m.castShadow = m.receiveShadow = true;
        tree.add(m);
      };
      // a pad is a cloud-pruned layer of short needle sprays: cards lying roughly flat across an
      // ellipsoid, lit as a mass from the pad's centre and darker underneath
      const pad = (x, y, z, sx, sy, sz, seed) => {
        const R = rng(seed * 131 + 5), pos = [], nor = [], uv = [], col = [], idx = [];
        const n = high ? 46 : 28, up = new T.Vector3(0, 1, 0);
        for (let i = 0; i < n; i++) {
          const a = R() * Math.PI * 2, rr = Math.sqrt(R());
          const c = new T.Vector3(Math.cos(a) * rr * sx, (R() - 0.35) * sy * 0.9, Math.sin(a) * rr * sz);
          const yaw = R() * Math.PI * 2, len = 0.38 + R() * 0.22;
          const d = new T.Vector3(Math.cos(yaw), (R() - 0.5) * 0.5, Math.sin(yaw)).normalize();
          const side = new T.Vector3().crossVectors(d, up).normalize();
          side.applyAxisAngle(d, (R() - 0.5) * 1.2);                 // tilted, never quite flat
          const nrm = new T.Vector3(c.x / sx, c.y / sy * 0.6 + 0.9, c.z / sz).normalize();
          const shade = 0.55 + 0.45 * clamp(c.y / sy + 0.5);
          const b = pos.length / 3, half = len * 0.61 * 0.5;
          for (const [k, s] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
            const p = c.clone().addScaledVector(d, (k - 0.5) * len).addScaledVector(side, s * half);
            pos.push(p.x, p.y, p.z); nor.push(nrm.x, nrm.y, nrm.z); uv.push(s < 0 ? 0 : 1, k); col.push(shade, shade, shade);
          }
          idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
        g.setAttribute('aBark', new T.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
        g.setIndex(idx);
        const m = new T.Mesh(g, M.needles);
        m.position.set(x, y, z);
        m.castShadow = m.receiveShadow = true;
        tree.add(m);
      };
      limb([[0, 0, 0], [0.25, 0.5, 0.1], [-0.2, 1.1, 0.15], [0.35, 1.7, -0.1], [0.05, 2.3, 0], [0.45, 2.8, 0.1]], 0.2, 0.07);
      limb([[0.3, 1.65, -0.1], [0.9, 1.85, 0.0], [1.6, 1.8, 0.2]], 0.08, 0.035);
      limb([[-0.15, 1.15, 0.15], [-0.8, 1.3, 0.3], [-1.5, 1.2, 0.35]], 0.08, 0.035);
      limb([[0.08, 2.2, 0], [-0.5, 2.45, -0.2], [-1.0, 2.5, -0.3]], 0.06, 0.03);
      pad(1.7, 1.95, 0.2, 0.95, 0.32, 0.75, 1);
      pad(-1.55, 1.35, 0.35, 0.85, 0.3, 0.7, 2);
      pad(-1.05, 2.62, -0.3, 0.8, 0.28, 0.65, 3);
      pad(0.5, 2.95, 0.1, 1.05, 0.36, 0.85, 4);
      pad(0.15, 3.3, 0.0, 0.6, 0.22, 0.5, 5);
      const rock = new T.Mesh(lump(64, 0.4, 9, 1.3), M.stone);
      rock.position.set(2.5, FLOOR + 0.4, -2.2);
      rock.scale.set(1.2, 0.8, 0.9);
      rock.rotation.y = 0.6;
      rock.castShadow = rock.receiveShadow = true;
      house.add(rock);
    }

    // ---------- travelling along the journey ----------
    // per stretch between two stations, a table of distance travelled against curve parameter,
    // so the camera moves at an even pace and eases only as it arrives. The pace is how fast the
    // ground seems to pass: distance near the ground counts for more than distance high above it,
    // so a stretch that flies and then drives gives the drive its share of the scroll
    function arcLengths(pth) {
      const st = pth.stations, N = 260;
      return st.slice(0, -1).map((a, i) => {
        const ta = a / pth.last, tb = st[i + 1] / pth.last;
        const ts = new Float32Array(N + 1), ls = new Float32Array(N + 1);
        let prev = pth.eye.getPoint(ta), L = 0;
        for (let k = 0; k <= N; k++) {
          const t = ta + ((tb - ta) * k) / N, p = pth.eye.getPoint(t);
          if (k) L += p.distanceTo(prev) * Math.min(3, 1 + 8 / Math.max(p.y - heightAt(p.x, p.z), 1));
          ts[k] = t; ls[k] = L; prev = p;
        }
        return { ts, ls, L, N };
      });
    }
    function paramAt(p) {
      const i = Math.min(segs.length - 1, Math.max(0, Math.floor(p)));
      const f = clamp(p - i), e = mix(f, smooth(f), 0.7);
      const S = segs[i], want = e * S.L;
      let lo = 0, hi = S.N;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S.ls[mid] < want) lo = mid; else hi = mid; }
      const span = S.ls[hi] - S.ls[lo] || 1;
      return mix(S.ts[lo], S.ts[hi], (want - S.ls[lo]) / span);
    }

    const eye = new T.Vector3(), aim = new T.Vector3(), fwd = new T.Vector3(), side = new T.Vector3(), up = new T.Vector3();
    const Y = new T.Vector3(0, 1, 0), focus = new T.Vector3();
    const lr = new T.Vector3(), lu = new T.Vector3(), e2 = new T.Vector3(), a2 = new T.Vector3(), look = new T.Vector3();
    // the gaze is averaged over a short stretch of the path, like an operator who leads a turn
    // instead of snapping to each bend of the road
    const HOUSE_AIM = new T.Vector3(0, 12, 0);
    let portrait = false;
    const GAZE = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(k => [k * 0.005, Math.exp(-(k * k) / 8)]);
    function place(p, mx, my, bob, sway) {
      const t = paramAt(opts.still ? Math.round(p) : p);
      path.eye.getPoint(t, eye);
      path.aim.getPoint(t, aim);
      const reach = aim.distanceTo(eye);
      look.set(0, 0, 0);
      for (const [dt, wgt] of GAZE) {
        const tt = clamp(t + dt);
        path.eye.getPoint(tt, e2);
        path.aim.getPoint(tt, a2);
        look.addScaledVector(a2.sub(e2).normalize(), wgt);
      }
      aim.copy(eye).addScaledVector(look.normalize(), reach);
      // the opening is framed with the house right of the headline; on a portrait screen the
      // headline sits below it instead, so the camera turns back to face the house
      if (portrait) aim.lerp(HOUSE_AIM, 0.6 * (1 - smooth(clamp((opts.still ? Math.round(p) : p) / 0.5))));
      // never closer than 1.4 m to the ground, eased so the floor is never felt as a bump
      const ground = heightAt(eye.x, eye.z);
      const lift = Math.max(0, 1.4 - (eye.y - ground));
      eye.y += lift; aim.y += lift;
      const agl = eye.y - ground;
      // walking only happens near the ground
      const walk = 1 - step(2.6, 6, agl);
      fwd.subVectors(aim, eye);
      const dist = fwd.length();
      fwd.divideScalar(dist);
      side.crossVectors(fwd, Y).normalize();
      up.crossVectors(side, fwd);
      // the head: turned toward the pointer, nodding and swaying with each step
      eye.addScaledVector(side, mx * 0.12 + sway * walk * 0.025).addScaledVector(up, -my * 0.06 + bob * walk * 0.04);
      aim.copy(eye).addScaledVector(fwd, dist).addScaledVector(side, mx * 0.075 * dist).addScaledVector(up, -my * 0.045 * dist);
      cam.up.copy(Y).addScaledVector(side, sway * walk * 0.006);
      cam.position.copy(eye);
      cam.lookAt(aim);
      cam.updateMatrixWorld();
      sunView.value.copy(SUN).transformDirection(cam.matrixWorldInverse);

      // the sun's shadows cover what the camera is looking at, snapped to whole texels so they hold still
      // From the air they reach as far as the view does, so their edge never shows, at coarser texels
      const size = clamp(Math.max(dist * 0.75, agl * 14) + 18, 28, 1100);
      const sh = sun.shadow.camera;
      if (sh.right !== size) {
        sh.left = -size; sh.right = size; sh.top = size; sh.bottom = -size; sh.updateProjectionMatrix();
        sun.shadow.normalBias = Math.max(0.07, ((2 * size) / sun.shadow.mapSize.x) * 1.2);
      }
      focus.copy(eye).addScaledVector(fwd, Math.min(dist * 0.6 + agl * 3, size * 0.75));
      focus.y = heightAt(focus.x, focus.z);
      lr.crossVectors(SUN, Y).normalize(); lu.crossVectors(lr, SUN);
      const texel = (2 * size) / sun.shadow.mapSize.x;
      const a = Math.round(focus.dot(lr) / texel) * texel, b = Math.round(focus.dot(lu) / texel) * texel, c = focus.dot(SUN);
      sun.target.position.copy(lr).multiplyScalar(a).addScaledVector(lu, b).addScaledVector(SUN, c);
      sun.position.copy(sun.target.position).addScaledVector(SUN, 1600);
    }

    let w = 1, h = 1;
    function resize() {
      w = canvas.clientWidth || 1; h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      const pr = renderer.getPixelRatio(), W = Math.round(w * pr), H = Math.round(h * pr);
      rtScene.setSize(W, H);
      rtA.setSize(Math.max(1, W >> 2), Math.max(1, H >> 2));
      rtB.setSize(Math.max(1, W >> 2), Math.max(1, H >> 2));
      comp.m.uniforms.uRes.value.set(W, H);
      cam.aspect = w / h;
      // portrait screens see more height, so the subject still fits
      portrait = cam.aspect < 0.8;
      cam.fov = portrait ? 62 : cam.aspect < 1.2 ? 50 : 38;
      cam.updateProjectionMatrix();
    }
    resize();

    // a viewpoint off the journey, for looking at any part of the world while tuning it
    let override = null;
    function draw(p, mx = 0, my = 0, bob = 0, sway = 0) {
      if (!ready) return false;
      renderer.info.reset();
      const now = performance.now() / 1000;
      // what moves with time: the trees and grass, the clouds, the ripples on the lake
      uTime.value = now;
      skyU.uTime.value = now;
      water.tex.offset.set(now * 0.004, now * 0.0025);
      place(p, mx, my, bob, sway);
      if (override) {
        cam.position.set(...override[0]); cam.lookAt(...override[1]); cam.updateMatrixWorld();
        sunView.value.copy(SUN).transformDirection(cam.matrixWorldInverse);
      }
      renderer.setRenderTarget(rtScene);
      renderer.render(scene, cam);
      if (high) {
        bright.m.uniforms.tex.value = rtScene.texture;
        renderer.setRenderTarget(rtA); renderer.render(bright.s, qcam);
        for (const spread of [1, 2.2]) {
          blur.m.uniforms.tex.value = rtA.texture; blur.m.uniforms.dir.value.set(spread / rtA.width, 0);
          renderer.setRenderTarget(rtB); renderer.render(blur.s, qcam);
          blur.m.uniforms.tex.value = rtB.texture; blur.m.uniforms.dir.value.set(0, spread / rtA.height);
          renderer.setRenderTarget(rtA); renderer.render(blur.s, qcam);
        }
      }
      renderer.setRenderTarget(null);
      renderer.render(comp.s, qcam);
      return true;
    }

    return {
      draw, resize,
      ready: () => ready,
      set onReady(fn) { onReady = fn; if (ready) fn(); },
      ground: heightAt, solids, info: () => renderer.info.render,
      look(eye, at) { override = eye ? [eye, at] : null; },
      scene,
      // for tests: the camera's height above whatever is under it, and its position
      probe(p) {
        if (!ready) return null;
        place(p, 0, 0, 0, 0);
        const d = cam.getWorldDirection(new T.Vector3());
        return { x: cam.position.x, y: cam.position.y, z: cam.position.z, agl: cam.position.y - heightAt(cam.position.x, cam.position.z), dx: d.x, dy: d.y, dz: d.z };
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
