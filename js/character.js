// Modelo humanoide procedural com animações (andar, correr, pular, agachar, atirar, morrer)
'use strict';
LS.geoCache = {};
LS.boxGeo = function (w, h, d, oy) {
  const k = w + '_' + h + '_' + d + '_' + (oy || 0);
  if (!LS.geoCache[k]) { const g = new THREE.BoxGeometry(w, h, d); if (oy) g.translate(0, oy, 0); LS.geoCache[k] = g; }
  return LS.geoCache[k];
};
LS.lambert = function (color) { return LS.World.mat(color); };

// Cria o modelo de uma arma
LS.buildGunMesh = function (id) {
  const w = LS.WEAPONS[id], g = new THREE.Group(), L = w.len;
  const body = new THREE.Mesh(LS.boxGeo(0.09, 0.13, L * 0.6), LS.lambert(w.color)); body.position.z = L * 0.15; g.add(body);
  const barrel = new THREE.Mesh(LS.boxGeo(0.045, 0.045, L * 0.45), LS.lambert(0x151515)); barrel.position.set(0, 0.03, L * 0.6); g.add(barrel);
  const grip = new THREE.Mesh(LS.boxGeo(0.07, 0.16, 0.07), LS.lambert(0x222222)); grip.position.set(0, -0.12, 0); grip.rotation.x = 0.25; g.add(grip);
  if (w.cat !== 'Pistola') {
    const stock = new THREE.Mesh(LS.boxGeo(0.07, 0.12, L * 0.3), LS.lambert(w.cat === 'Rifle' && id === 'ak47' ? 0x6b4423 : 0x2a2a2a)); stock.position.set(0, -0.02, -L * 0.2); g.add(stock);
    if (w.cat === 'Rifle' || w.cat === 'SMG') { const mag = new THREE.Mesh(LS.boxGeo(0.06, 0.18, 0.08), LS.lambert(0x1a1a1a)); mag.position.set(0, -0.14, L * 0.25); mag.rotation.x = -0.2; g.add(mag); }
  }
  if (w.scope) { const sc = new THREE.Mesh(LS.boxGeo(0.07, 0.07, 0.3), LS.lambert(0x111111)); sc.position.set(0, 0.12, L * 0.15); g.add(sc); }
  g.userData.muzzle = new THREE.Object3D(); g.userData.muzzle.position.set(0, 0.03, L * 0.83); g.add(g.userData.muzzle);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
};

LS.CharacterModel = class {
  constructor(opts) {
    const skin = opts.skin || LS.util.pick([0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac]);
    const shirt = opts.shirt || LS.util.pick([0x3a6ea5, 0x8a2d2d, 0x2d6b3a, 0x5a3a7a, 0x333333, 0xb0882d, 0x2d7a7a, 0x7a4a2d]);
    const pants = opts.pants || LS.util.pick([0x2a2a3a, 0x3a4a2a, 0x4a3a2a, 0x1f2f4f, 0x555555]);
    const hair = opts.hair || LS.util.pick([0x1a1a1a, 0x4a2a10, 0x8a6a2a, 0xd0b060, 0x6a1a1a]);
    const M = c => LS.lambert(c);
    this.root = new THREE.Group();
    this.hips = new THREE.Group(); this.hips.position.y = 0.92; this.root.add(this.hips);
    this.torso = new THREE.Group(); this.hips.add(this.torso);
    const chest = new THREE.Mesh(LS.boxGeo(0.56, 0.66, 0.32, 0.33), M(shirt)); this.torso.add(chest);
    this.vestMesh = new THREE.Mesh(LS.boxGeo(0.6, 0.45, 0.36, 0.3), M(0x4a5a3a)); this.vestMesh.visible = false; this.torso.add(this.vestMesh);
    const belt = new THREE.Mesh(LS.boxGeo(0.58, 0.1, 0.34), M(0x2a1a0a)); belt.position.y = 0.02; this.torso.add(belt);
    this.headG = new THREE.Group(); this.headG.position.y = 0.68; this.torso.add(this.headG);
    const head = new THREE.Mesh(LS.boxGeo(0.34, 0.36, 0.34, 0.2), M(skin)); this.headG.add(head);
    const hairM = new THREE.Mesh(LS.boxGeo(0.36, 0.12, 0.36, 0.38), M(hair)); this.headG.add(hairM);
    const eyes = new THREE.Mesh(LS.boxGeo(0.24, 0.05, 0.02), M(0x111111)); eyes.position.set(0, 0.24, 0.175); this.headG.add(eyes);
    this.helmetMesh = new THREE.Mesh(LS.boxGeo(0.4, 0.2, 0.4, 0.38), M(0x3a4a2a)); this.helmetMesh.visible = false; this.headG.add(this.helmetMesh);
    this.bagMesh = new THREE.Mesh(LS.boxGeo(0.42, 0.45, 0.2, 0.35), M(0x5a4a2a)); this.bagMesh.position.z = -0.25; this.bagMesh.visible = false; this.torso.add(this.bagMesh);
    // braços
    const mkArm = side => {
      const sh = new THREE.Group(); sh.position.set(side * 0.37, 0.6, 0); this.torso.add(sh);
      const up = new THREE.Mesh(LS.boxGeo(0.17, 0.62, 0.17, -0.28), M(shirt)); sh.add(up);
      const hand = new THREE.Mesh(LS.boxGeo(0.15, 0.13, 0.15, -0.64), M(skin)); sh.add(hand);
      return sh;
    };
    this.armR = mkArm(-1); this.armL = mkArm(1);
    // pernas (coxa + canela)
    const mkLeg = side => {
      const th = new THREE.Group(); th.position.set(side * 0.15, 0, 0); this.hips.add(th);
      th.add(new THREE.Mesh(LS.boxGeo(0.22, 0.46, 0.22, -0.23), M(pants)));
      const knee = new THREE.Group(); knee.position.y = -0.46; th.add(knee);
      knee.add(new THREE.Mesh(LS.boxGeo(0.2, 0.42, 0.2, -0.21), M(pants)));
      const boot = new THREE.Mesh(LS.boxGeo(0.22, 0.1, 0.3), M(0x1a1a1a)); boot.position.set(0, -0.42, 0.04); knee.add(boot);
      th.userData.knee = knee; return th;
    };
    this.legR = mkLeg(-1); this.legL = mkLeg(1);
    // arma
    this.gunHolder = new THREE.Group(); this.gunHolder.position.set(0, -0.62, 0.05); this.armR.add(this.gunHolder);
    this.gun = null; this.gunId = null;
    // paraquedas
    this.chute = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.5), new THREE.MeshLambertMaterial({ color: opts.chute || LS.util.pick([0xff5a2a, 0x2a8aff, 0xffd02a, 0x2aff8a, 0xff2a8a]), side: THREE.DoubleSide }));
    canopy.scale.y = 0.5; canopy.position.y = 4; this.chute.add(canopy);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x222222 });
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; pts.push(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(Math.cos(a) * 1.9, 4.6, Math.sin(a) * 1.9)); }
    this.chute.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    this.chute.visible = false; this.root.add(this.chute);
    this.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.phase = 0; this.recoilT = 0; this.crouchK = 0; this.deadT = 0;
  }

  setGun(id) {
    if (this.gunId === id) return;
    if (this.gun) this.gunHolder.remove(this.gun);
    this.gun = null; this.gunId = id;
    if (id) { this.gun = LS.buildGunMesh(id); this.gun.rotation.x = Math.PI / 2; this.gunHolder.add(this.gun); }
  }
  setGear(vest, helmet, bag) {
    this.vestMesh.visible = vest > 0; if (vest) this.vestMesh.material = LS.lambert([0, 0x6a7a5a, 0x4a5a7a, 0x2a2a2a][vest]);
    this.helmetMesh.visible = helmet > 0; if (helmet) this.helmetMesh.material = LS.lambert([0, 0x6a7a5a, 0x4a5a7a, 0x2a2a2a][helmet]);
    this.bagMesh.visible = bag > 0;
  }
  shoot() { this.recoilT = 1; }
  muzzleWorld(target) {
    if (this.gun) return this.gun.userData.muzzle.getWorldPosition(target);
    return this.headG.getWorldPosition(target);
  }

  // s: {speed, running, crouch, air, chute, aimPitch, armed, dead, dt}
  animate(s) {
    const dt = s.dt;
    if (s.dead) {
      this.deadT = Math.min(1, this.deadT + dt * 3);
      this.root.rotation.x = -Math.PI / 2 * this.deadT;
      this.hips.position.y = LS.util.lerp(0.92, 0.2, this.deadT);
      return;
    }
    this.deadT = 0; this.root.rotation.x = 0;
    this.chute.visible = !!s.chute;
    this.crouchK = LS.util.lerp(this.crouchK, s.crouch ? 1 : 0, Math.min(1, dt * 12));
    const ck = this.crouchK;
    this.phase += dt * s.speed * (s.running ? 1.6 : 2.1);
    const sw = Math.sin(this.phase), amp = LS.util.clamp(s.speed / 6, 0, 1) * (s.running ? 0.95 : 0.6) * (1 - ck * 0.5);
    let lr = sw * amp, ll = -sw * amp, kr = Math.max(0, -Math.cos(this.phase)) * amp * 1.4, kl = Math.max(0, Math.cos(this.phase)) * amp * 1.4;
    // agachado: coxas para frente, joelhos para trás
    lr -= ck * 1.1; ll -= ck * 1.1; kr += ck * 1.6; kl += ck * 1.6;
    if (s.air || s.chute) { lr = -0.7; ll = -0.3; kr = 1.2; kl = 0.6; }
    this.legR.rotation.x = lr; this.legL.rotation.x = ll;
    this.legR.userData.knee.rotation.x = kr; this.legL.userData.knee.rotation.x = kl;
    const bob = Math.abs(Math.cos(this.phase)) * amp * 0.06;
    this.hips.position.y = 0.92 - ck * 0.38 + bob;
    this.torso.rotation.x = ck * 0.25 + (s.running && !s.armedAim ? 0.15 : 0);
    // braços
    this.recoilT = Math.max(0, this.recoilT - dt * 8);
    const pitch = s.aimPitch || 0;
    if (s.chute) {
      this.armR.rotation.set(Math.PI, 0, 0.3); this.armL.rotation.set(Math.PI, 0, -0.3);
    } else if (s.armed && (!s.running || s.armedAim)) {
      const base = -Math.PI / 2 - pitch - this.torso.rotation.x;
      this.armR.rotation.set(base - this.recoilT * 0.25, 0, 0.12);
      this.armL.rotation.set(base + 0.15 - this.recoilT * 0.2, 0, -0.62);
    } else if (s.armed) { // correndo com arma baixa
      this.armR.rotation.set(-0.9, 0, 0.1); this.armL.rotation.set(-0.8, 0, -0.55);
    } else {
      this.armR.rotation.set(-lr * 0.8, 0, 0.08); this.armL.rotation.set(-ll * 0.8, 0, -0.08);
    }
    this.headG.rotation.x = -pitch * 0.5;
  }
};
