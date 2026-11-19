// Mundo: terreno, colisões, raycast e céu
'use strict';
LS.World = {
  SEG: 200, boxes: [], grid: new Map(), CELL: 16, towns: [], lootSpots: [], heights: null,

  // ---------- Altura ----------
  baseHeight(x, z) {
    const n = LS.util.noise;
    let h = 3 + n(x * 0.008, z * 0.008) * 9 + n(x * 0.03, z * 0.03) * 2.5;
    const m = n(x * 0.005 + 37, z * 0.005 + 91);
    if (m > 0.52) { const k = (m - 0.52) / 0.48; h += k * k * 140 + n(x * 0.05, z * 0.05) * 6 * k; }
    const d = Math.hypot(x, z);
    const e = LS.util.clamp((d - 320) / 75, 0, 1);
    const s = e * e * (3 - 2 * e);
    return LS.util.lerp(h, -8, s);
  },
  exactHeight(x, z) {
    let h = this.baseHeight(x, z);
    for (const t of this.towns) {
      const dd = Math.hypot(x - t.x, z - t.z);
      const k = LS.util.clamp(1 - (dd - t.r) / 30, 0, 1);
      if (k > 0) { const s = k * k * (3 - 2 * k); h = LS.util.lerp(h, t.h, s); }
    }
    return h;
  },
  // altura interpolada igual aos triângulos da malha
  heightAt(x, z) {
    const S = this.SEG, cell = LS.MAP_SIZE / S, half = LS.MAP_SIZE / 2;
    let gx = (x + half) / cell, gz = (z + half) / cell;
    if (gx < 0 || gz < 0 || gx >= S || gz >= S) return -8;
    const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz, W = S + 1, H = this.heights;
    const h00 = H[ix + iz * W], h10 = H[ix + 1 + iz * W], h01 = H[ix + (iz + 1) * W], h11 = H[ix + 1 + (iz + 1) * W];
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  },

  // ---------- Colisores AABB ----------
  addCollider(minX, minY, minZ, maxX, maxY, maxZ) {
    const b = { minX, minY, minZ, maxX, maxY, maxZ };
    this.boxes.push(b);
    const C = this.CELL;
    for (let cx = Math.floor(minX / C); cx <= Math.floor(maxX / C); cx++)
      for (let cz = Math.floor(minZ / C); cz <= Math.floor(maxZ / C); cz++) {
        const k = cx + ',' + cz;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(b);
      }
    return b;
  },
  // verdadeiro se uma esfera (x,y,z,r) encosta em algum colisor
  sphereHits(x, y, z, r) {
    for (const b of this.nearBoxes(x, z, r + 0.5)) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX)), cy = Math.max(b.minY, Math.min(y, b.maxY)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      if ((cx - x) ** 2 + (cy - y) ** 2 + (cz - z) ** 2 < r * r) return true;
    }
    return y - r < this.heightAt(x, z);
  },
  nearBoxes(x, z, r) {
    const C = this.CELL, out = new Set();
    for (let cx = Math.floor((x - r) / C); cx <= Math.floor((x + r) / C); cx++)
      for (let cz = Math.floor((z - r) / C); cz <= Math.floor((z + r) / C); cz++) {
        const l = this.grid.get(cx + ',' + cz);
        if (l) for (const b of l) out.add(b);
      }
    return out;
  },
  // altura do chão considerando topos de caixas abaixo dos pés
  groundAt(x, z, y, r) {
    let g = this.heightAt(x, z);
    for (const b of this.nearBoxes(x, z, r + 1)) {
      if (x + r * 0.5 > b.minX && x - r * 0.5 < b.maxX && z + r * 0.5 > b.minZ && z - r * 0.5 < b.maxZ && b.maxY <= y + 0.55 && b.maxY > g) g = b.maxY;
    }
    return g;
  },
  // empurra um cilindro (personagem) para fora das caixas; retorna true se colidiu
  // prev = posição antes do movimento: se o centro entrar numa caixa, sai pelo lado de onde veio (nunca atravessa)
  collideCircle(pos, r, height, prev) {
    let hit = false;
    // até 3 passadas: empurrar para fora de uma caixa pode encostar em outra (cantos, paredes juntas)
    for (let it = 0; it < 3; it++) { const h = this._collideOnce(pos, r, height, prev); hit = hit || h; if (!h) break; }
    return hit;
  },
  _collideOnce(pos, r, height, prev) {
    let hit = false;
    for (const b of this.nearBoxes(pos.x, pos.z, r + 1)) {
      if (pos.y + height <= b.minY || pos.y >= b.maxY - 0.5) continue;
      const cx = LS.util.clamp(pos.x, b.minX, b.maxX), cz = LS.util.clamp(pos.z, b.minZ, b.maxZ);
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), push = r - d;
        pos.x += dx / d * push; pos.z += dz / d * push;
      } else { // centro dentro da caixa: sai pelo lado de onde veio (ou o mais próximo)
        let opts = [[pos.x - b.minX + r, -1, 0], [b.maxX - pos.x + r, 1, 0], [pos.z - b.minZ + r, 0, -1], [b.maxZ - pos.z + r, 0, 1]];
        if (prev) {
          const from = opts.filter(o => (o[1] < 0 && prev.x <= b.minX) || (o[1] > 0 && prev.x >= b.maxX) || (o[2] < 0 && prev.z <= b.minZ) || (o[2] > 0 && prev.z >= b.maxZ));
          if (from.length) opts = from;
        }
        opts.sort((a, c) => a[0] - c[0]);
        pos.x += opts[0][1] * opts[0][0]; pos.z += opts[0][2] * opts[0][0];
      }
    }
    return hit;
  },

  // ---------- Raycast contra caixas + terreno ----------
  rayBox(o, d, b, maxT) {
    let tmin = 0, tmax = maxT;
    const ax = ['x', 'y', 'z'], mn = [b.minX, b.minY, b.minZ], mx = [b.maxX, b.maxY, b.maxZ];
    for (let i = 0; i < 3; i++) {
      const oi = o[ax[i]], di = d[ax[i]];
      if (Math.abs(di) < 1e-9) { if (oi < mn[i] || oi > mx[i]) return -1; continue; }
      let t1 = (mn[i] - oi) / di, t2 = (mx[i] - oi) / di;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
    return tmin;
  },
  raycast(o, d, maxDist) {
    let best = maxDist;
    const ex = o.x + d.x * maxDist, ez = o.z + d.z * maxDist;
    const minX = Math.min(o.x, ex), maxX = Math.max(o.x, ex), minZ = Math.min(o.z, ez), maxZ = Math.max(o.z, ez);
    // percorre as células da grade ao longo do raio (rápido mesmo para raios longos)
    const seen = new Set(), C = this.CELL, step = C * 0.5;
    const hl = Math.hypot(d.x, d.z) || 1e-6;
    const horiz = maxDist * hl;
    for (let s = 0; s <= horiz + step; s += step) {
      const t = Math.min(s, horiz) / hl;
      if (t > best + step / hl) break;
      const x = o.x + d.x * t, z = o.z + d.z * t;
      for (let cx = Math.floor((x - step) / C); cx <= Math.floor((x + step) / C); cx++)
        for (let cz = Math.floor((z - step) / C); cz <= Math.floor((z + step) / C); cz++) {
          const l = this.grid.get(cx + ',' + cz); if (!l) continue;
          for (const b of l) {
            if (seen.has(b)) continue; seen.add(b);
            if (b.maxX < minX || b.minX > maxX || b.maxZ < minZ || b.minZ > maxZ) continue;
            const tb = this.rayBox(o, d, b, best); if (tb >= 0 && tb < best) best = tb;
          }
        }
      if (s >= horiz) break;
    }
    // terreno: avança em passos e refina
    const tstep = 1.5;
    let prevT = 0;
    for (let t = tstep; t < best + tstep; t += tstep) {
      const tt = Math.min(t, best);
      const y = o.y + d.y * tt, h = this.heightAt(o.x + d.x * tt, o.z + d.z * tt);
      if (y < h) {
        let a = prevT, c = tt;
        for (let i = 0; i < 6; i++) { const m = (a + c) / 2; if (o.y + d.y * m < this.heightAt(o.x + d.x * m, o.z + d.z * m)) c = m; else a = m; }
        best = a; break;
      }
      prevT = tt;
      if (tt >= best) break;
    }
    return best;
  },
  hasLOS(a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length(); d.divideScalar(len);
    return this.raycast(a, d, len) >= len - 0.3;
  },

  // ---------- Construção do terreno ----------
  buildTerrain(scene) {
    // cidades (posições fixas com variação)
    const names = ['Vila Porto', 'Centro', 'Fazenda', 'Base Militar', 'Mirante', 'Vila Sul', 'Usina'];
    const spots = [[-150, -130], [20, 10], [170, -160], [-170, 150], [140, 170], [10, 230], [-10, -230]];
    this.towns = [];
    spots.forEach((s, i) => {
      const x = s[0] + LS.util.rand(-20, 20), z = s[1] + LS.util.rand(-20, 20);
      this.towns.push({ name: names[i], x, z, r: i === 1 ? 62 : LS.util.rand(38, 50), h: Math.max(2.5, Math.min(this.baseHeight(x, z), 14)) });
    });
    const S = this.SEG, W = S + 1, half = LS.MAP_SIZE / 2, cell = LS.MAP_SIZE / S;
    this.heights = new Float32Array(W * W);
    for (let iz = 0; iz < W; iz++) for (let ix = 0; ix < W; ix++) this.heights[ix + iz * W] = this.exactHeight(-half + ix * cell, -half + iz * cell);

    const geo = new THREE.PlaneGeometry(LS.MAP_SIZE, LS.MAP_SIZE, S, S);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmix = new Float32Array(pos.count); // tmix: 0 grama .. 1 terra
    const c = new THREE.Color(), sand = new THREE.Color(0xd9c58b), grass = new THREE.Color(0x5d9c3a), grass2 = new THREE.Color(0x3f7d2c),
      rock = new THREE.Color(0x7a7268), snow = new THREE.Color(0xf2f4f7), dirt = new THREE.Color(0x9b8360);
    for (let i = 0; i < pos.count; i++) {
      const ix = i % W, iz = Math.floor(i / W);
      const h = this.heights[i]; pos.setY(i, h);
      const x = pos.getX(i), z = pos.getZ(i);
      const hn = (ix < S ? this.heights[i + 1] : h), hs = (iz < S ? this.heights[i + W] : h);
      const slope = Math.hypot(hn - h, hs - h) / cell;
      let mx = 0;
      if (h < 1.6) { c.copy(sand); mx = 1; }
      else { c.copy(grass).lerp(grass2, LS.util.noise(x * 0.05, z * 0.05)); }
      if (slope > 0.6 || h > 30) { const k = LS.util.clamp(Math.max((slope - 0.6) * 2, (h - 30) / 10), 0, 1); c.lerp(rock, k); mx = Math.max(mx, k); }
      if (h > 70) c.lerp(snow, LS.util.clamp((h - 70) / 15, 0, 1));
      for (const t of this.towns) {
        const dd = Math.hypot(x - t.x, z - t.z);
        if (dd < t.r + 4) { // ruas em grade
          const lx = ((x - t.x) % 18 + 18) % 18, lz = ((z - t.z) % 18 + 18) % 18;
          if (lx < 4 || lz < 4) { c.lerp(dirt, 0.85); mx = 1; } else { c.lerp(dirt, 0.25); mx = Math.max(mx, 0.3); }
        }
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; tmix[i] = mx;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('tmix', new THREE.BufferAttribute(tmix, 1));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, LS.Tex.terrainMaterial()); // grama e caminhos de terra texturizados
    mesh.receiveShadow = true;
    scene.add(mesh);
    this.terrainMesh = mesh;
    this.terrainColors = colors;

    const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshPhongMaterial({ color: 0x2a7fb8, transparent: true, opacity: 0.85, shininess: 80 }));
    water.rotation.x = -Math.PI / 2; water.position.y = LS.WATER_LEVEL;
    scene.add(water);
    this.water = water;
  },

  // ---------- Céu e iluminação ----------
  buildSky(scene) {
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a5a3a, 0.6);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xfff2e0, 0.3); scene.add(this.ambient); // ilumina interiores e sombras
    this.sun = new THREE.DirectionalLight(0xffffff, 0.9);
    this.sun.shadow.camera.left = -70; this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70; this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 400;
    this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.03; // sem "acne" de sombra tremendo nas paredes
    scene.add(this.sun); scene.add(this.sun.target);
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }));
    scene.add(this.sunMesh);
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, LS.settings.renderDistance * 0.3, LS.settings.renderDistance);
    // nuvens instanciadas
    const cg = new THREE.BoxGeometry(1, 1, 1);
    const clouds = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }), 160);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let k = 0;
    for (let i = 0; i < 32; i++) {
      const cx = LS.util.rand(-450, 450), cz = LS.util.rand(-450, 450), cy = LS.util.rand(230, 270);
      for (let j = 0; j < 5; j++) {
        p.set(cx + LS.util.rand(-20, 20), cy + LS.util.rand(-3, 3), cz + LS.util.rand(-12, 12));
        s.set(LS.util.rand(15, 35), LS.util.rand(5, 9), LS.util.rand(12, 22));
        m.compose(p, q, s); clouds.setMatrixAt(k++, m);
      }
    }
    clouds.frustumCulled = false; this.clouds = clouds; scene.add(clouds);
    this.skyColors = [
      { t: 0, sky: new THREE.Color(0xd9c7c0), sun: new THREE.Color(0xffd2a8), i: 0.75 },
      { t: 0.25, sky: new THREE.Color(0x87ceeb), sun: new THREE.Color(0xffffff), i: 1.0 },
      { t: 0.7, sky: new THREE.Color(0x8fc6e8), sun: new THREE.Color(0xfff4dd), i: 0.95 },
      { t: 0.9, sky: new THREE.Color(0xf08a5d), sun: new THREE.Color(0xff9a5a), i: 0.65 },
      { t: 1, sky: new THREE.Color(0x3a3f6b), sun: new THREE.Color(0xb08cff), i: 0.35 }
    ];
  },
  // t = 0..1 (manhã até o anoitecer ao longo da partida)
  updateSky(t, scene, focus, dt) {
    t = LS.util.clamp(t, 0, 1);
    let a = this.skyColors[0], b = this.skyColors[this.skyColors.length - 1];
    for (let i = 0; i < this.skyColors.length - 1; i++) if (t >= this.skyColors[i].t && t <= this.skyColors[i + 1].t) { a = this.skyColors[i]; b = this.skyColors[i + 1]; break; }
    const k = (t - a.t) / Math.max(0.0001, b.t - a.t);
    scene.background.copy(a.sky).lerp(b.sky, k);
    scene.fog.color.copy(scene.background);
    this.sun.color.copy(a.sun).lerp(b.sun, k);
    this.sun.intensity = LS.util.lerp(a.i, b.i, k);
    this.hemi.intensity = 0.35 + this.sun.intensity * 0.35;
    const ang = 0.25 + t * 2.6; // ângulo do sol no céu
    const dir = new THREE.Vector3(Math.cos(ang) * 0.6, Math.sin(ang), -0.5).normalize();
    this.sun.position.copy(focus).addScaledVector(dir, 200);
    this.sun.target.position.copy(focus);
    this.sunMesh.position.copy(focus).addScaledVector(dir, LS.effDist() * 0.85);
    this.sunMesh.material.color.copy(this.sun.color);
    this.clouds.rotation.y += dt * 0.004;
  }
};
