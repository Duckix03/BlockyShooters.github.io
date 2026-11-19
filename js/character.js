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

// Personagem em blocos (estilo voxel) com animações: andar, correr, pular, agachar, atirar, morrer
LS.CharacterModel = class {
  constructor(opts) {
    const K = LS.Skin, S = K.PX;
    this.look = opts.look || K.randomLook();
    this.seed = Math.floor(Math.random() * 1e6) + 1;
    this.tex = K.makeTexture(this.look, this.seed);
    this.mat = new THREE.MeshLambertMaterial({ map: this.tex });
    const M = c => LS.lambert(c);
    this.root = new THREE.Group();
    this.hips = new THREE.Group(); this.hipsY = 12 * S; this.hips.position.y = this.hipsY; this.root.add(this.hips);
    this.torso = new THREE.Group(); this.hips.add(this.torso);
    this.torso.add(new THREE.Mesh(K.geometry('body', 'bottom'), this.mat));
    this.vestMesh = new THREE.Mesh(LS.boxGeo(8.8 * S, 8 * S, 4.8 * S, 4 * S), M(0x4a5a3a)); this.vestMesh.position.y = 3.6 * S; this.vestMesh.visible = false; this.torso.add(this.vestMesh);
    this.bagMesh = new THREE.Mesh(LS.boxGeo(6 * S, 8 * S, 3 * S, 4 * S), M(0x5a4a2a)); this.bagMesh.position.set(0, 3 * S, -3.5 * S); this.bagMesh.visible = false; this.torso.add(this.bagMesh);
    this.headG = new THREE.Group(); this.headG.position.y = 12 * S; this.torso.add(this.headG);
    this.headG.add(new THREE.Mesh(K.geometry('head', 'bottom'), this.mat));
    this.helmetMesh = new THREE.Mesh(LS.boxGeo(9 * S, 4 * S, 9 * S, 2 * S), M(0x3a4a2a)); this.helmetMesh.position.y = 5.5 * S; this.helmetMesh.visible = false; this.headG.add(this.helmetMesh);
    this.brim = new THREE.Mesh(LS.boxGeo(8 * S, 0.8 * S, 3 * S), M(0x333333)); this.brim.position.set(0, 6.4 * S, 5.4 * S); this.headG.add(this.brim);
    this.accG = new THREE.Group(); this.headG.add(this.accG);
    const mkArm = side => { const g = new THREE.Group(); g.position.set(side * 6 * S, 12 * S, 0); g.add(new THREE.Mesh(K.geometry('arm', 'top'), this.mat)); this.torso.add(g); return g; };
    this.armR = mkArm(-1); this.armL = mkArm(1);
    const mkLeg = side => { const g = new THREE.Group(); g.position.set(side * 2 * S, 0, 0); g.add(new THREE.Mesh(K.geometry('leg', 'top'), this.mat)); this.hips.add(g); return g; };
    this.legR = mkLeg(-1); this.legL = mkLeg(1);
    this.gunHolder = new THREE.Group(); this.gunHolder.position.set(0, -11 * S, 0.5 * S); this.armR.add(this.gunHolder);
    this.gun = null; this.gunId = null;
    // paraquedas
    this.chute = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.5), new THREE.MeshLambertMaterial({ color: opts.chute || LS.util.pick([0xff5a2a, 0x2a8aff, 0xffd02a, 0x2aff8a, 0xff2a8a]), side: THREE.DoubleSide }));
    canopy.scale.y = 0.5; canopy.position.y = 4; this.chute.add(canopy);
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; pts.push(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(Math.cos(a) * 1.9, 4.6, Math.sin(a) * 1.9)); }
    this.chute.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x222222 })));
    this.chute.visible = false; this.root.add(this.chute);
    this.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.applyLook(this.look);
    this.phase = 0; this.recoilT = 0; this.crouchK = 0; this.deadT = 0;
  }
  applyLook(look) {
    this.look = Object.assign({}, look);
    LS.Skin.paint(this.tex.userData.canvas, this.look, this.seed);
    this.tex.needsUpdate = true;
    this.buildAccessories(look);
    this.brim.visible = look.hairStyle === 'boné' && (!look.hat || look.hat === 'nenhum');
    if (this.brim.visible) this.brim.material = LS.lambert(new THREE.Color(look.shirt).multiplyScalar(0.55).getHex());
  }
  // acessórios 3D da cabeça: chapéus, óculos e barba cheia
  buildAccessories(look) {
    const S = LS.Skin.PX, g = this.accG;
    while (g.children.length) g.remove(g.children[0]);
    const acc = new THREE.Color(look.accent || '#2a2a2a').getHex(), M = c => LS.lambert(c);
    const add = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(LS.boxGeo(w * S, h * S, d * S), mat); m.position.set(x * S, y * S, z * S); m.castShadow = true; g.add(m); return m; };
    if (look.hat === 'gorro') { add(8.8, 3, 8.8, 0, 7.6, 0, M(acc)); add(9, 1, 9, 0, 6.2, 0, M(new THREE.Color(acc).multiplyScalar(0.75).getHex())); }
    else if (look.hat === 'chapéu') { add(12, 0.6, 12, 0, 6.8, 0, M(0x6a4a2a)); add(7.6, 2.6, 7.6, 0, 8.4, 0, M(0x6a4a2a)); add(7.8, 0.7, 7.8, 0, 7.4, 0, M(acc)); }
    else if (look.hat === 'faixa') add(8.5, 1, 8.5, 0, 6.6, 0, M(acc));
    if (look.glasses === 'escuros') add(8.4, 1.2, 0.6, 0, 3.6, 4.3, M(0x111111));
    else if (look.glasses === 'viseira') add(8.6, 1.2, 0.8, 0, 3.6, 4.3, new THREE.MeshBasicMaterial({ color: acc }));
    if (look.beard === 'cheia') add(7, 2.5, 1.2, 0, 0.6, 4.4, M(new THREE.Color(look.hair).getHex()));
    this.hatVisible = look.hat && look.hat !== 'nenhum';
  }
  setGun(id) {
    if (this.gunId === id) return;
    if (this.gun) this.gunHolder.remove(this.gun);
    this.gun = null; this.gunId = id;
    if (id) { this.gun = LS.buildGunMesh(id); this.gun.rotation.x = Math.PI / 2; this.gunHolder.add(this.gun); }
  }
  setGear(vest, helmet, bag) {
    const cols = [0, 0x6a7a5a, 0x4a5a7a, 0x2a2a2a];
    this.vestMesh.visible = vest > 0; if (vest) this.vestMesh.material = LS.lambert(cols[vest]);
    this.helmetMesh.visible = helmet > 0; if (helmet) this.helmetMesh.material = LS.lambert(cols[helmet]);
    this.brim.visible = !helmet && this.look.hairStyle === 'boné' && !this.hatVisible;
    this.accG.children.forEach(m => { if (m.position.y > 6 * LS.Skin.PX) m.visible = !helmet; });
    this.bagMesh.visible = bag > 0;
  }
  shoot() { this.recoilT = 1; }
  muzzleWorld(target) {
    if (this.gun) return this.gun.userData.muzzle.getWorldPosition(target);
    return this.headG.getWorldPosition(target);
  }
  // s: {speed, running, crouch, air, chute, aimPitch, armed, armedAim, dead, dt, idle}
  animate(s) {
    const dt = s.dt;
    if (s.dead) {
      this.deadT = Math.min(1, this.deadT + dt * 3);
      this.root.rotation.x = -Math.PI / 2 * this.deadT;
      this.hips.position.y = LS.util.lerp(this.hipsY, 0.2, this.deadT);
      return;
    }
    this.deadT = 0; this.root.rotation.x = 0;
    this.chute.visible = !!s.chute;
    this.crouchK = LS.util.lerp(this.crouchK, s.crouch ? 1 : 0, Math.min(1, dt * 12));
    const ck = this.crouchK;
    this.phase += dt * s.speed * (s.running ? 1.5 : 2.0);
    const amp = LS.util.clamp(s.speed / 6, 0, 1) * (s.running ? 1.0 : 0.7) * (1 - ck * 0.4);
    const sw = Math.sin(this.phase) * amp;
    let lr = sw, ll = -sw;
    if (s.air || s.chute) { lr = -0.5; ll = 0.3; }
    // agachado: tronco inclinado, pernas abertas para trás/frente
    lr += ck * 0.5; ll -= ck * 0.5;
    this.legR.rotation.x = lr; this.legL.rotation.x = ll;
    this.hips.position.y = this.hipsY - ck * 0.2 + Math.abs(Math.cos(this.phase)) * amp * 0.04;
    this.torso.rotation.x = ck * 0.45 + (s.running && !s.armedAim ? 0.12 : 0);
    this.recoilT = Math.max(0, this.recoilT - dt * 8);
    const pitch = s.aimPitch || 0, t = this.torso.rotation.x;
    if (s.chute) { this.armR.rotation.set(Math.PI, 0, 0.3); this.armL.rotation.set(Math.PI, 0, -0.3); }
    else if (s.armed && (!s.running || s.armedAim)) {
      const base = -Math.PI / 2 - pitch - t;
      this.armR.rotation.set(base - this.recoilT * 0.25, 0, 0.1);
      this.armL.rotation.set(base + 0.1 - this.recoilT * 0.2, 0, -0.55);
    } else if (s.armed) { this.armR.rotation.set(-0.9 - t, 0, 0.1); this.armL.rotation.set(-0.8 - t, 0, -0.5); }
    else {
      const idle = s.idle ? Math.sin(performance.now() * 0.002) * 0.05 : 0;
      this.armR.rotation.set(-sw * 0.9 - t * 0.5, 0, 0.05 + idle); this.armL.rotation.set(sw * 0.9 - t * 0.5, 0, -0.05 - idle);
    }
    this.headG.rotation.x = -pitch * 0.6 - t * 0.6;
  }
};
