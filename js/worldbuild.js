// Construções, árvores, rochas e arbustos
'use strict';
Object.assign(LS.World, {
  buildings: [], unitBox: null, matCache: {},

  mat(color) {
    if (!this.matCache[color]) this.matCache[color] = new THREE.MeshLambertMaterial({ color });
    return this.matCache[color];
  },
  // caixa visual (+ colisor opcional). cx,cz = centro; y0 = base
  // as caixas são agrupadas por cor e viram InstancedMesh (poucas draw calls)
  box(scene, cx, y0, cz, w, h, d, color, collide = true, shadow = true) {
    if (!this.boxBatches) this.boxBatches = {};
    const key = color + (shadow ? 's' : 'n');
    if (!this.boxBatches[key]) this.boxBatches[key] = { color, shadow, mats: [] };
    this.boxBatches[key].mats.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, y0, cz), new THREE.Quaternion(), new THREE.Vector3(w, h, d)));
    if (collide === true) this.addCollider(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2);
  },
  // caixa só visual com rotação (telhados inclinados)
  boxR(cx, y0, cz, w, h, d, color, quat) {
    if (!this.boxBatches) this.boxBatches = {};
    const key = color + 's';
    if (!this.boxBatches[key]) this.boxBatches[key] = { color, shadow: true, mats: [] };
    this.boxBatches[key].mats.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, y0, cz), quat, new THREE.Vector3(w, h, d)));
  },
  finalizeBoxes(scene) {
    if (!this.unitBox) { this.unitBox = new THREE.BoxGeometry(1, 1, 1); this.unitBox.translate(0, 0.5, 0); }
    for (const k in this.boxBatches) {
      const bt = this.boxBatches[k];
      const mat = bt.color === LS.GLASS ? new THREE.MeshPhongMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.32, shininess: 120, depthWrite: false }) : this.mat(bt.color);
      const im = new THREE.InstancedMesh(this.unitBox, mat, bt.mats.length);
      bt.mats.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.castShadow = bt.shadow; im.receiveShadow = true; im.frustumCulled = false;
      scene.add(im);
    }
    this.boxBatches = {};
  },
  // parede ao longo de X (axis='x') ou Z, com porta opcional no centro
  wall(scene, cx, y0, cz, len, h, t, axis, color, door) {
    if (!door) {
      if (axis === 'x') this.box(scene, cx, y0, cz, len, h, t, color); else this.box(scene, cx, y0, cz, t, h, len, color);
      return;
    }
    const dw = 1.8, dh = 2.5, seg = (len - dw) / 2, off = dw / 2 + seg / 2;
    if (axis === 'x') {
      this.box(scene, cx - off, y0, cz, seg, h, t, color); this.box(scene, cx + off, y0, cz, seg, h, t, color);
      this.box(scene, cx, y0 + dh, cz, dw, h - dh, t, color);
    } else {
      this.box(scene, cx, y0, cz - off, t, h, seg, color); this.box(scene, cx, y0, cz + off, t, h, seg, color);
      this.box(scene, cx, y0 + dh, cz, t, h - dh, dw, color);
    }
  },
  house(scene, cx, cz, w, d) {
    const y0 = this.heightAt(cx, cz) - 0.05, h = 3.6, t = 0.35;
    const colors = [0xe8dcc4, 0xd9a07a, 0xb7c9a8, 0xc9c3d6, 0xe6c26e, 0xa7c4d9, 0xf0f0f0];
    const col = LS.util.pick(colors), roofCol = LS.util.pick([0x8a3b2a, 0x5a4a42, 0x3d5a6b, 0x6b4a2a]);
    const doorSide = LS.util.randInt(0, 3);
    this.wall(scene, cx, y0, cz - d / 2, w, h, t, 'x', col, doorSide === 0);
    this.wall(scene, cx, y0, cz + d / 2, w, h, t, 'x', col, doorSide === 1);
    this.wall(scene, cx - w / 2, y0, cz, d - t, h, t, 'z', col, doorSide === 2);
    this.wall(scene, cx + w / 2, y0, cz, d - t, h, t, 'z', col, doorSide === 3 || (w > 11 && doorSide === 2));
    this.box(scene, cx, y0, cz, w - t, 0.08, d - t, 0x8a6a4a, false, false); // piso
    this.box(scene, cx, y0 + h, cz, w + 0.8, 0.45, d + 0.8, roofCol);      // telhado
    // móveis simples (cobertura)
    if (Math.random() < 0.7) this.box(scene, cx + LS.util.rand(-w / 4, w / 4), y0, cz + LS.util.rand(-d / 4, d / 4), 1.6, 0.9, 0.9, 0x6b4a2a);
    const n = LS.util.randInt(2, 3);
    for (let i = 0; i < n; i++) this.lootSpots.push({ x: cx + LS.util.rand(-w / 2 + 1.2, w / 2 - 1.2), z: cz + LS.util.rand(-d / 2 + 1.2, d / 2 - 1.2), y: y0 + 0.1, indoor: true });
    this.buildings.push({ x: cx, z: cz, w, d, color: col });
  },
  tower(scene, cx, cz, w, d) {
    const y0 = this.heightAt(cx, cz) - 0.1, h = LS.util.rand(9, 22);
    const col = LS.util.pick([0x9aa3ad, 0xc4b8a8, 0x7d8a96, 0xb0a090]);
    this.box(scene, cx, y0, cz, w, h, d, col);
    for (let y = 2; y < h - 1; y += 3) { // faixas de janelas
      this.box(scene, cx, y0 + y, cz, w + 0.06, 1.1, d + 0.06, 0x2b3a4a, false, false);
    }
    this.box(scene, cx, y0 + h, cz, w - 1, 1.2, d - 1, 0x666666);
    this.buildings.push({ x: cx, z: cz, w, d, color: col });
    // loot ao redor
    this.lootSpots.push({ x: cx + w / 2 + 1.5, z: cz, y: this.heightAt(cx + w / 2 + 1.5, cz) + 0.1 });
  },
  container(scene, cx, cz, alongX) {
    const y0 = this.heightAt(cx, cz) - 0.1, col = LS.util.pick([0xb03a2e, 0x2e6bb0, 0x3a8a3a, 0xc98a1e, 0x6a6a6a]);
    if (alongX) this.box(scene, cx, y0, cz, 6, 2.6, 2.4, col); else this.box(scene, cx, y0, cz, 2.4, 2.6, 6, col);
    this.buildings.push({ x: cx, z: cz, w: alongX ? 6 : 2.4, d: alongX ? 2.4 : 6, color: col });
    const ox = alongX ? 0 : 2.2, oz = alongX ? 2.2 : 0;
    this.lootSpots.push({ x: cx + ox, z: cz + oz, y: this.heightAt(cx + ox, cz + oz) + 0.1 });
  },
  insideTown(x, z, pad) {
    for (const t of this.towns) if (Math.hypot(x - t.x, z - t.z) < t.r + (pad || 0)) return t;
    return null;
  },

  buildProps(scene) {
    // ---- cidades ----
    this.towns.forEach((t, ti) => {
      for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) {
        const cx = t.x + gx * 18 + 11, cz = t.z + gz * 18 + 11;
        if (Math.hypot(cx - t.x, cz - t.z) > t.r - 6) continue;
        const r = Math.random();
        if (t.name === 'Base Militar') { if (r < 0.55) this.container(scene, cx + LS.util.rand(-3, 3), cz, Math.random() < 0.5); else if (r < 0.85) this.house(scene, cx, cz, 12, 9); continue; }
        if (t.name === 'Centro' && r < 0.3) { this.tower(scene, cx, cz, LS.util.rand(9, 12), LS.util.rand(9, 12)); continue; }
        if (r < 0.72) this.house(scene, cx, cz, LS.util.rand(8, 12), LS.util.rand(8, 11));
        else if (r < 0.88) this.container(scene, cx, cz, Math.random() < 0.5);
      }
    });
    // ---- casas isoladas ----
    let placed = 0, tries = 0;
    while (placed < 18 && tries++ < 500) {
      const a = Math.random() * Math.PI * 2, rr = LS.util.rand(40, 300);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr, h = this.exactHeight(x, z);
      if (h < 2 || h > 25 || this.insideTown(x, z, 25)) continue;
      // terreno precisa ser razoavelmente plano
      if (Math.abs(this.heightAt(x + 6, z) - this.heightAt(x - 6, z)) > 1.5 || Math.abs(this.heightAt(x, z + 6) - this.heightAt(x, z - 6)) > 1.5) continue;
      this.house(scene, x, z, 9, 8); placed++;
    }
    this.finalizeBoxes(scene);
    // ---- árvores (instanciadas) ----
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1, 6); trunkGeo.translate(0, 0.5, 0);
    const leafGeo = new THREE.ConeGeometry(1, 1, 7); leafGeo.translate(0, 0.5, 0);
    const roundGeo = new THREE.IcosahedronGeometry(1, 0);
    const MAXT = 700;
    const trunks = new THREE.InstancedMesh(trunkGeo, this.mat(0x5a3d22), MAXT);
    const pines = new THREE.InstancedMesh(leafGeo, this.mat(0x2f6b2a), MAXT);
    const rounds = new THREE.InstancedMesh(roundGeo, this.mat(0x4a8a30), MAXT);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let nt = 0, np = 0, nr = 0; tries = 0;
    while (nt < MAXT && tries++ < 6000) {
      const x = LS.util.rand(-330, 330), z = LS.util.rand(-330, 330), h = this.heightAt(x, z);
      if (h < 2 || h > 55 || this.insideTown(x, z, 4)) continue;
      if (LS.util.noise(x * 0.02 + 5, z * 0.02 + 5) < 0.38) continue; // aglomerados (florestas)
      let blocked = false;
      for (const b of this.nearBoxes(x, z, 2)) if (x > b.minX - 2 && x < b.maxX + 2 && z > b.minZ - 2 && z < b.maxZ + 2) { blocked = true; break; }
      if (blocked) continue;
      const th = LS.util.rand(2.5, 4.5), sc = LS.util.rand(0.8, 1.4);
      p.set(x, h - 0.2, z); s.set(sc, th, sc); m.compose(p, q, s); trunks.setMatrixAt(nt++, m);
      if (Math.random() < 0.55) {
        p.set(x, h + th * 0.6, z); s.set(2.6 * sc, 6 * sc, 2.6 * sc); m.compose(p, q, s); pines.setMatrixAt(np++, m);
      } else {
        p.set(x, h + th + 1.4 * sc, z); s.set(2.6 * sc, 2.3 * sc, 2.6 * sc); m.compose(p, q, s); rounds.setMatrixAt(nr++, m);
      }
      this.addCollider(x - 0.35, h - 1, z - 0.35, x + 0.35, h + th + 2, z + 0.35);
    }
    trunks.count = nt; pines.count = np; rounds.count = nr;
    [trunks, pines, rounds].forEach(im => { im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; scene.add(im); });
    // ---- rochas ----
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, this.mat(0x8a8580), 160);
    let nk = 0; tries = 0;
    const e = new THREE.Euler();
    while (nk < 160 && tries++ < 3000) {
      const x = LS.util.rand(-330, 330), z = LS.util.rand(-330, 330), h = this.heightAt(x, z);
      if (h < 1 || this.insideTown(x, z, 3)) continue;
      const sc = LS.util.rand(0.8, 2.6);
      e.set(Math.random() * 3, Math.random() * 3, 0); q.setFromEuler(e);
      p.set(x, h + sc * 0.3, z); s.set(sc * 1.3, sc, sc * 1.1); m.compose(p, q, s); rocks.setMatrixAt(nk++, m);
      const r = sc * 0.85;
      this.addCollider(x - r, h - 1, z - r, x + r, h + sc * 1.1, z + r);
      if (Math.random() < 0.25) this.lootSpots.push({ x: x + r + 1, z, y: this.heightAt(x + r + 1, z) + 0.1 });
    }
    q.identity();
    rocks.count = nk; rocks.frustumCulled = false; rocks.castShadow = true; rocks.receiveShadow = true; scene.add(rocks);
    // ---- arbustos (sem colisão, bons para se esconder) ----
    const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), this.mat(0x3d7a2a), 400);
    let nb = 0; tries = 0;
    while (nb < 400 && tries++ < 4000) {
      const x = LS.util.rand(-330, 330), z = LS.util.rand(-330, 330), h = this.heightAt(x, z);
      if (h < 1.5 || h > 40) continue;
      const sc = LS.util.rand(0.7, 1.3);
      p.set(x, h + 0.3, z); s.set(sc * 1.2, sc * 0.8, sc * 1.2); m.compose(p, q, s); bushes.setMatrixAt(nb++, m);
    }
    bushes.count = nb; bushes.frustumCulled = false; bushes.receiveShadow = true; scene.add(bushes);
    // ---- pontos de loot na natureza ----
    for (let i = 0; i < 60; i++) {
      const x = LS.util.rand(-300, 300), z = LS.util.rand(-300, 300), h = this.heightAt(x, z);
      if (h > 1.5 && h < 40) this.lootSpots.push({ x, z, y: h + 0.1 });
    }
  },

  // imagem 2D do mapa para o minimapa
  buildMapImage(size) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d'), img = g.createImageData(size, size);
    const half = LS.MAP_SIZE / 2;
    for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
      const x = -half + (px / size) * LS.MAP_SIZE, z = -half + (py / size) * LS.MAP_SIZE, h = this.heightAt(x, z);
      let r, gg, b;
      if (h < 0) { r = 40; gg = 110; b = 170; }
      else if (h < 1.6) { r = 215; gg = 195; b = 140; }
      else if (h > 70) { r = 235; gg = 238; b = 242; }
      else if (h > 30) { r = 125; gg = 118; b = 108; }
      else { const k = h / 30; r = 80 + k * 40; gg = 145 - k * 20; b = 60 + k * 30; }
      const i = (px + py * size) * 4; img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const sc = size / LS.MAP_SIZE;
    g.fillStyle = '#d8d0c0';
    for (const bd of this.buildings) g.fillRect((bd.x - bd.w / 2 + half) * sc, (bd.z - bd.d / 2 + half) * sc, Math.max(1, bd.w * sc), Math.max(1, bd.d * sc));
    g.font = 'bold ' + Math.round(size / 40) + 'px Segoe UI'; g.textAlign = 'center';
    for (const t of this.towns) {
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(t.name, (t.x + half) * sc + 1, (t.z + half) * sc - t.r * sc - 3 + 1);
      g.fillStyle = '#fff'; g.fillText(t.name, (t.x + half) * sc, (t.z + half) * sc - t.r * sc - 3);
    }
    return cv;
  }
});
