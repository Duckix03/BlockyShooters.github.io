// Sistema de loot: geração, visual e consulta de itens no chão
'use strict';
LS.Loot = {
  items: [], time: 0,
  init(scene) {
    this.scene = scene;
    this.ringGeo = new THREE.RingGeometry(0.45, 0.6, 20); this.ringGeo.rotateX(-Math.PI / 2);
    this.ringMats = {};
  },
  clear() { for (const it of this.items) this.scene.remove(it.mesh); this.items = []; },

  ringMat(color) {
    if (!this.ringMats[color]) this.ringMats[color] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
    return this.ringMats[color];
  },
  makeMesh(it) {
    const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
    const M = c => LS.lambert(c);
    let ring = 0xffffff;
    if (it.type === 'weapon') {
      const gun = LS.buildGunMesh(it.id); gun.rotation.y = Math.PI / 2; gun.scale.setScalar(1.3); inner.add(gun);
      ring = LS.LEVEL_COLORS[LS.WEAPONS[it.id].rarity];
    } else if (it.type === 'ammo') {
      const c = LS.AMMO_TYPES[it.id].color;
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(LS.boxGeo(0.12, 0.25, 0.12), M(c)); b.position.set(i * 0.15 - 0.15, 0.12, 0); inner.add(b); }
      const base = new THREE.Mesh(LS.boxGeo(0.5, 0.08, 0.25), M(0x3a3a2a)); inner.add(base);
      ring = c;
    } else if (it.type === 'med') {
      if (it.id === 'medkit') {
        inner.add(new THREE.Mesh(LS.boxGeo(0.5, 0.3, 0.35, 0.15), M(0xf2f2f2)));
        const c1 = new THREE.Mesh(LS.boxGeo(0.3, 0.08, 0.02), M(0xe02020)); c1.position.set(0, 0.17, 0.18); inner.add(c1);
        const c2 = new THREE.Mesh(LS.boxGeo(0.08, 0.26, 0.02), M(0xe02020)); c2.position.set(0, 0.17, 0.18); inner.add(c2);
      } else {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 10), M(0xf5ead0)); b.rotation.z = Math.PI / 2; b.position.y = 0.12; inner.add(b);
      }
      ring = 0x4be07a;
    } else if (it.type === 'vest') {
      inner.add(new THREE.Mesh(LS.boxGeo(0.55, 0.6, 0.25, 0.3), M([0, 0x6a7a5a, 0x4a5a7a, 0x2a2a2a][it.level])));
      ring = LS.LEVEL_COLORS[it.level];
    } else if (it.type === 'helmet') {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M([0, 0x6a7a5a, 0x4a5a7a, 0x2a2a2a][it.level])); h.position.y = 0.05; inner.add(h);
      ring = LS.LEVEL_COLORS[it.level];
    } else if (it.type === 'bag') {
      inner.add(new THREE.Mesh(LS.boxGeo(0.45, 0.55, 0.25, 0.28), M(0x6a5a3a)));
      const p = new THREE.Mesh(LS.boxGeo(0.3, 0.2, 0.08, 0.2), M(0x4a3a2a)); p.position.z = 0.15; inner.add(p);
      ring = LS.LEVEL_COLORS[it.level];
    }
    const r = new THREE.Mesh(this.ringGeo, this.ringMat(ring)); r.position.y = 0.03; g.add(r);
    g.userData.inner = inner;
    return g;
  },

  spawn(type, id, level, amount, x, y, z) {
    const it = { type, id, level: level || 0, amount: amount || 1, pos: new THREE.Vector3(x, y, z), alive: true };
    if (type === 'weapon' && it.ammoInMag === undefined) it.ammoInMag = LS.WEAPONS[id].mag;
    it.mesh = this.makeMesh(it);
    it.mesh.position.copy(it.pos);
    it.mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(it.mesh);
    this.items.push(it);
    return it;
  },
  spawnRandomAt(spot) {
    const r = Math.random(), U = LS.util;
    const x = spot.x, y = spot.y, z = spot.z;
    if (r < 0.32) {
      const id = U.weighted(LS.weaponSpawnTable);
      this.spawn('weapon', id, 0, 1, x, y, z);
      const a = LS.WEAPONS[id].ammo;
      this.spawn('ammo', a, 0, LS.AMMO_TYPES[a].pickup, x + U.rand(-0.8, 0.8), y, z + U.rand(0.6, 1));
    } else if (r < 0.6) {
      const a = U.pick(Object.keys(LS.AMMO_TYPES));
      this.spawn('ammo', a, 0, LS.AMMO_TYPES[a].pickup, x, y, z);
    } else if (r < 0.78) {
      this.spawn('med', Math.random() < 0.4 ? 'medkit' : 'bandage', 0, Math.random() < 0.4 ? 1 : 2, x, y, z);
    } else {
      const lv = Math.random() < 0.55 ? 1 : Math.random() < 0.75 ? 2 : 3;
      this.spawn(U.pick(['vest', 'helmet', 'bag']), null, lv, 1, x, y, z);
    }
  },
  spawnAll() {
    this.clear();
    for (const s of LS.World.lootSpots) if (Math.random() < 0.85) this.spawnRandomAt(s);
  },
  remove(it) {
    if (!it.alive) return;
    it.alive = false;
    this.scene.remove(it.mesh);
    const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1);
  },
  label(it) {
    const lv = ['', ' Nv.1', ' Nv.2', ' Nv.3'];
    if (it.type === 'weapon') return LS.WEAPONS[it.id].name + ' (' + LS.WEAPONS[it.id].cat + ')';
    if (it.type === 'ammo') return LS.AMMO_TYPES[it.id].name + ' x' + it.amount;
    if (it.type === 'med') return LS.MEDS[it.id].name + ' x' + it.amount;
    if (it.type === 'vest') return 'Colete' + lv[it.level];
    if (it.type === 'helmet') return 'Capacete' + lv[it.level];
    if (it.type === 'bag') return 'Mochila' + lv[it.level];
    return '';
  },
  nearest(pos, maxDist, filter) {
    let best = null, bd = maxDist * maxDist;
    for (const it of this.items) {
      const dx = it.pos.x - pos.x, dz = it.pos.z - pos.z, d2 = dx * dx + dz * dz;
      if (d2 < bd && Math.abs(it.pos.y - pos.y) < 3 && (!filter || filter(it))) { bd = d2; best = it; }
    }
    return best;
  },
  update(dt, focus) {
    this.time += dt;
    const vis2 = LS.settings.perfMode ? 80 * 80 : 140 * 140;
    for (const it of this.items) {
      const dx = it.pos.x - focus.x, dz = it.pos.z - focus.z, d2 = dx * dx + dz * dz;
      it.mesh.visible = d2 < vis2;
      if (d2 < 3600) {
        it.mesh.userData.inner.position.y = 0.15 + Math.sin(this.time * 3 + it.pos.x) * 0.08;
        it.mesh.userData.inner.rotation.y += dt * 1.2;
      }
    }
  }
};
