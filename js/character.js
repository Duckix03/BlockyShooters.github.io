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
    this.mat = new THREE.MeshLambertMaterial({ map: this.tex, skinning: true });
    const M = c => LS.lambert(c);
    // ---- esqueleto em 15 peças (como o R15): tronco de cima/baixo, cabeça, braço/antebraço/mão e coxa/canela/pé ----
    this.root = new THREE.Group();
    const B = (name, parent, x, y) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, 0); parent.add(b); return b; };
    this.hipsY = 12 * S;
    this.hips = B('Hips', this.root, 0, this.hipsY);           // tronco de baixo (quadril)
    this.torso = B('Spine', this.hips, 0, 5 * S);              // tronco de cima, gira na cintura
    this.torsoC = new THREE.Group(); this.torsoC.position.y = -5 * S; this.torso.add(this.torsoC); // origem no quadril (colete, mochila)
    this.headG = B('Head', this.torso, 0, 7 * S);
    const arm = (side, P) => { const a = B(P + 'Arm', this.torso, side * 6 * S, 7 * S), f = B(P + 'ForeArm', a, 0, -5 * S), h = B(P + 'Hand', f, 0, -5 * S); return [a, f, h]; };
    const leg = (side, P) => { const u = B(P + 'UpLeg', this.hips, side * 2 * S, 0), l = B(P + 'Leg', u, 0, -6 * S), f = B(P + 'Foot', l, 0, -5 * S); return [u, l, f]; };
    [this.armR, this.foreR, this.handR] = arm(-1, 'Right'); [this.armL, this.foreL, this.handL] = arm(1, 'Left');
    [this.legR, this.shinR, this.footR] = leg(-1, 'Right'); [this.legL, this.shinL, this.footL] = leg(1, 'Left');
    this.bones = {};
    for (const n of LS.CharacterModel.BONES) this.root.traverse(o => { if (o.isBone && o.name === n) this.bones[n] = o; });
    // uma malha só, com cada pedaço preso no seu osso (1 desenho por personagem)
    this.root.updateMatrixWorld(true);
    this.body = new THREE.SkinnedMesh(LS.CharacterModel.skinGeometry(this), this.mat);
    this.body.frustumCulled = false; this.root.add(this.body); this.body.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(LS.CharacterModel.BONES.map(n => this.bones[n]));
    this.body.bind(this.skeleton);
    this.vestMesh = new THREE.Mesh(LS.boxGeo(8.8 * S, 8 * S, 4.8 * S, 4 * S), M(0x4a5a3a)); this.vestMesh.position.y = 3.6 * S; this.vestMesh.visible = false; this.torsoC.add(this.vestMesh);
    this.bagMesh = new THREE.Mesh(LS.boxGeo(6 * S, 8 * S, 3 * S, 4 * S), M(0x5a4a2a)); this.bagMesh.position.set(0, 3 * S, -3.5 * S); this.bagMesh.visible = false; this.torsoC.add(this.bagMesh);
    this.helmetMesh = new THREE.Mesh(LS.boxGeo(9 * S, 4 * S, 9 * S, 2 * S), M(0x3a4a2a)); this.helmetMesh.position.y = 5.5 * S; this.helmetMesh.visible = false; this.headG.add(this.helmetMesh);
    this.brim = new THREE.Mesh(LS.boxGeo(8 * S, 0.8 * S, 3 * S), M(0x333333)); this.brim.position.set(0, 6.4 * S, 5.4 * S); this.headG.add(this.brim);
    this.accG = new THREE.Group(); this.headG.add(this.accG);
    this.anim = null; // LS.AnimPlayer, criado quando tocar a primeira animação externa
    this.gunHolder = new THREE.Group(); this.gunHolder.position.set(0, -1 * S, 0.5 * S); this.handR.add(this.gunHolder);
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
  // colete, capacete e mochila com o modelo de cada nível (mesmos modelos do chão)
  setGear(vest, helmet, bag) {
    const put = (key, parent, kind, lv) => {
      if (this['_' + key + 'Lv'] === lv) return;
      this['_' + key + 'Lv'] = lv;
      if (this[key]) parent.remove(this[key]);
      this[key] = lv ? LS.Items.mesh(LS.Items.gearGeometry(kind, lv)) : null;
      if (this[key]) parent.add(this[key]);
    };
    put('vestModel', this.torsoC, 'vest', vest); put('helmetModel', this.headG, 'helmet', helmet); put('bagModel', this.torsoC, 'bag', bag);
    this.vestMesh.visible = this.helmetMesh.visible = this.bagMesh.visible = false;
    this.brim.visible = !helmet && this.look.hairStyle === 'boné' && !this.hatVisible;
    this.accG.children.forEach(m => { if (m.position.y > 6 * LS.Skin.PX) m.visible = !helmet; });
  }
  // ---------- eventos de animação ----------
  // tiro: recuo; sniper (ferrolho) e escopetas (bomba/alavanca) ainda ciclam a arma depois do disparo
  shoot(def) {
    this.recoilT = 1;
    if (def && this.gun && (def.scope || def.cat === 'Escopeta')) { this.cycleK = 0; this.cycleDur = Math.min(0.9, 0.85 / def.rate); }
  }
  // troca de arma animada: guarda a atual (desce) e saca a nova (sobe)
  switchGun(id) {
    if (this.gunId === id && this.pendingGun === undefined) return;
    this.pendingGun = id;
    this.swapK = this.gunId ? 0 : 0.5; // desarmado: só sobe com a nova
  }
  // pente na mão esquerda (mesmo modelo do pente da arma)
  showHandMag(on) {
    const id = on ? this.gunId : null;
    if (this.handMagId === id) return;
    this.handMagId = id;
    if (this.handMag) { this.handL.remove(this.handMag); this.handMag = null; }
    if (!id || !LS.Items.gunTags(id).includes('mag')) return;
    const geo = LS.Items.gunPart(id, 'mag'); geo.computeBoundingBox();
    const c = geo.boundingBox.getCenter(new THREE.Vector3()), S = LS.Skin.PX, g = new THREE.Group(), m = LS.Items.mesh(geo);
    m.position.copy(c).negate(); g.add(m); g.position.set(0, -2.6 * S, 0.6 * S); g.rotation.set(0.3, 0, 0);
    this.handL.add(g); this.handMag = g;
  }
  punch() { this.punchT = 1; this.punchSide = -(this.punchSide || -1); }
  hit() { this.hitT = 1; this.hitSide = Math.random() < 0.5 ? -1 : 1; }
  muzzleWorld(target) {
    if (this.gun) return this.gun.userData.muzzle.getWorldPosition(target);
    return this.headG.getWorldPosition(target);
  }
  // item de cura na mão esquerda durante o uso
  setMedInHand(type) {
    if (this.medType === type) return;
    this.medType = type;
    if (this.medMesh) { this.handL.remove(this.medMesh); this.medMesh = null; }
    if (type) {
      const S = LS.Skin.PX, m = LS.Items.mesh(LS.Items.itemGeometry({ type: 'med', id: type }));
      m.scale.setScalar(type === 'medkit' ? 0.55 : 0.8); m.position.set(0, -2.5 * S, 1.2 * S); m.rotation.set(Math.PI / 2, 0, 0);
      this.handL.add(m); this.medMesh = m;
    }
  }
  // morte: perde as pernas (joelhos), cai com aceleração e quica de leve no chão
  animDeath(dt) {
    const L = LS.util.lerp, cl = LS.util.clamp, ss = x => x * x * (3 - 2 * x);
    if (!this.deadT) { this.deadDir = Math.random() < 0.65 ? -1 : 1; this.deadRoll = (Math.random() - 0.5) * 0.5; this.deadT = 1e-4; this.chute.visible = false; this.setMedInHand(null); }
    this.deadT = Math.min(1.4, this.deadT + dt * 1.5);
    const k = this.deadT, buck = ss(cl(k / 0.25, 0, 1)), f = cl((k - 0.18) / 0.62, 0, 1), fall = f * f;
    const bounce = k > 0.8 ? Math.sin(cl((k - 0.8) / 0.4, 0, 1) * Math.PI) * 0.07 : 0;
    this.root.rotation.x = this.deadDir * (Math.PI / 2 * fall - bounce);
    this.root.rotation.z = this.deadRoll * fall;
    this.root.position.y += 0.11 * fall; // metade da grossura do corpo: deitado sem afundar no chão
    this.hips.position.y = this.hipsY - 0.22 * buck * (1 - fall);
    this.hips.rotation.set(0, 0, 0);
    this.legR.rotation.set(L(0.75 * buck, 0.12, fall), 0, 0.08 * fall); this.legL.rotation.set(L(0.45 * buck, -0.05, fall), 0, -0.1 * fall);
    this.torso.rotation.set(0.35 * buck * (1 - fall), 0, 0);
    const up = this.deadDir < 0 ? -2.5 : -0.4; // de costas: braços pra cima; de bruços: pra frente
    this.armR.rotation.set(L(-0.3 * buck, up, fall), 0, L(0.1, 0.55, fall)); this.armL.rotation.set(L(-0.2 * buck, up + 0.25, fall), 0, L(-0.1, -0.6, fall));
    this.headG.rotation.set(-0.25 * this.deadDir * fall, 0.3 * this.deadRoll, 0);
  }
  // animação do código + (se estiver tocando) a animação externa por cima
  animate(s) {
    // zera o que o código não controla, para uma animação externa que acabou não deixar o osso torto
    this.hips.position.x = 0; this.hips.position.z = 0; this.hips.rotation.y = 0;
    this.legR.rotation.y = 0; this.legL.rotation.y = 0;
    for (const n of LS.CharacterModel.JOINTS) this.bones[n].quaternion.set(0, 0, 0, 1); // cotovelo, mão, joelho e pé: retos (o código não dobra)
    this.animateBase(s);
    if (LS.Anim) LS.Anim.loco(this, s); // corrida oficial (run_f)
    if (this.anim) this.anim.apply(s.dt || 0, s);
  }
  // s: {speed, running, crouch, air, chute, fall, dive, steer, vy, aimPitch, armed, armedAim, dead, dt, idle,
  //     reload (0..1 ou -1), heal ('medkit'|'bandage'|null)}
  animateBase(s) {
    const dt = s.dt, L = LS.util.lerp, cl = LS.util.clamp, ss = x => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };
    const E = (cur, tgt, r) => cur + (tgt - cur) * (1 - Math.exp(-r * dt)); // suavização independente do FPS
    const ease = 1 - Math.exp(-8 * dt); // fator de suavização da queda/paraquedas (faltava: travava o jogo ao saltar)
    if (s.dead) { this.showHandMag(false); this.animDeath(dt); return; }
    if (this.deadT) { this.deadT = 0; this.root.rotation.x = 0; this.root.rotation.z = 0; }
    const now = performance.now() * 0.001;
    if (s.fall) {
      // queda livre: corpo deitado de barriga para baixo, braços e pernas abertos; mergulho = corpo esticado
      this.chuteT = 0; this.chute.visible = false;
      const wob = Math.sin(now * 5 + this.seed) * 0.06;
      this.hips.position.y = this.hipsY;
      this.hips.rotation.x = LS.util.lerp(this.hips.rotation.x, s.dive ? 1.45 : 1.2, ease);
      this.hips.rotation.z = LS.util.lerp(this.hips.rotation.z, (s.steer || 0) * 0.45 + wob, ease);
      this.torso.rotation.x = 0;
      if (s.dive) { this.armR.rotation.set(0.25, 0, 0.3); this.armL.rotation.set(0.25, 0, -0.3); this.legR.rotation.set(0, 0, 0.06); this.legL.rotation.set(0, 0, -0.06); }
      else { this.armR.rotation.set(-0.4, 0, 1.35 + wob); this.armL.rotation.set(-0.4, 0, -1.35 - wob); this.legR.rotation.set(0.4, 0, 0.28); this.legL.rotation.set(0.4, 0, -0.28); }
      this.headG.rotation.x = -0.85;
      return;
    }
    if (s.chute) {
      // paraquedas abrindo com "estouro", balanço e inclinação na direção da manobra
      this.chuteT = Math.min(1, (this.chuteT || 0) + dt * 2.2);
      const k = this.chuteT, c1 = 1.70158, c3 = c1 + 1, back = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
      this.chute.visible = true; this.chute.scale.set(back, Math.max(0.05, back), back);
      const sway = Math.sin(now * 1.6 + this.seed) * 0.07;
      this.chute.rotation.z = sway + (s.steer || 0) * 0.25;
      this.hips.rotation.x = LS.util.lerp(this.hips.rotation.x, 0, ease * 1.5);
      this.hips.rotation.z = LS.util.lerp(this.hips.rotation.z, sway * 0.8 + (s.steer || 0) * 0.3, ease);
      this.hips.position.y = this.hipsY;
      this.torso.rotation.x = 0;
      this.armR.rotation.set(Math.PI - 0.15, 0, 0.35); this.armL.rotation.set(Math.PI - 0.15, 0, -0.35);
      this.legR.rotation.set(-0.15 + Math.sin(now * 2.2) * 0.12, 0, 0.05); this.legL.rotation.set(0.1 - Math.sin(now * 2.2) * 0.12, 0, -0.05);
      this.headG.rotation.x = 0.15;
      return;
    }
    this.chute.visible = false; this.chuteT = 0;
    // ---- base: passos suaves entre parado / andando / correndo ----
    this.hips.rotation.x = E(this.hips.rotation.x, 0, 10);
    this.landT = Math.max(0, (this.landT || 0) - dt);
    this.crouchK = E(this.crouchK, s.crouch ? 1 : 0, 12);
    const ck = Math.max(this.crouchK, this.landT / 0.35); // impacto da aterrissagem
    const spd = s.speed || 0;
    this.runK = E(this.runK || 0, s.running ? 1 : 0, 6);
    this.moveK = E(this.moveK || 0, cl(spd / 5, 0, 1), 8);
    this.phase += dt * spd * L(2.0, 1.55, this.runK);
    const amp = this.moveK * L(0.7, 1.0, this.runK) * (1 - ck * 0.4), sw = Math.sin(this.phase) * amp;
    this.legR.rotation.x = sw + ck * 0.5; this.legL.rotation.x = -sw - ck * 0.5;
    this.hips.position.y = this.hipsY - ck * 0.2 + Math.abs(Math.cos(this.phase)) * amp * 0.05;
    // inclinação nas curvas (pela velocidade de giro)
    const yaw = this.root.rotation.y, turn = this.prevYaw === undefined ? 0 : LS.util.angleDiff(this.prevYaw, yaw) / Math.max(dt, 1e-3);
    this.prevYaw = yaw;
    this.leanK = E(this.leanK || 0, cl(-turn * 0.05 * (0.3 + this.moveK + this.runK), -0.28, 0.28), 6);
    // ---- alvos dos ossos (depois suavizados) ----
    const pitch = s.aimPitch || 0, def = this.gunId ? LS.WEAPONS[this.gunId] : null, pistol = def && def.cat === 'Pistola';
    let tX = ck * 0.45 + this.runK * (s.armedAim ? 0.02 : 0.12) + this.moveK * 0.04, tY = 0, headX = 0;
    const aimBase = -Math.PI / 2 - pitch - tX, aiming = s.armed && (!s.running || s.armedAim);
    let aR, aL, roll = 0;
    if (s.armed) {
      if (aiming) { aR = [aimBase, 0, 0.1]; aL = pistol ? [aimBase + 0.04, 0, -0.42] : [aimBase + 0.1, 0, -0.55]; }
      else { aR = [-0.9 - tX, 0, 0.1]; aL = [-0.8 - tX, 0, -0.5]; } // arma em guarda correndo
    } else {
      aR = [-sw * 0.9 - tX * 0.5, 0, 0.07]; aL = [sw * 0.9 - tX * 0.5, 0, -0.07];
    }
    const mix = (a, b, k) => [L(a[0], b[0], k), L(a[1], b[1], k), L(a[2], b[2], k)];
    const parts = this.gun ? this.gun.userData.parts : {};
    for (const k in parts) { const p = parts[k]; p.position.copy(p.userData.base); p.rotation.set(0, 0, 0); p.visible = true; }
    const bell = e => Math.sin(cl(e, 0, 1) * Math.PI);
    const boltAnim = (e, P) => { if (!P) return; const rot = e < 0.25 ? e / 0.25 : e < 0.75 ? 1 : 1 - (e - 0.75) / 0.25, back = e < 0.25 ? 0 : e < 0.5 ? (e - 0.25) / 0.25 : e < 0.75 ? 1 - (e - 0.5) / 0.25 : 0;
      P.rotation.z = -1.1 * ss(rot); P.position.z = P.userData.base.z - 0.075 * ss(back); };
    // ---- recarga: tira e coloca o pente / põe cartuchos / abre o ferrolho ----
    if (s.armed && s.reload >= 0 && def) {
      const r = s.reload, env = ss(Math.min(r / 0.1, (1 - r) / 0.1, 1));
      const magPose = [aimBase + (pistol ? 0.25 : 0.38), 0, pistol ? -0.3 : -0.32], pouch = [-0.35, 0, -0.25], port = [aimBase + 0.45, 0, -0.25];
      aR = mix(aR, [aimBase + 0.45, 0, 0.12], env); // arma baixa e mais perto do corpo
      if (parts.mag) {
        // o pente sai um pouco, passa pra mão esquerda, vai pro bolso; o novo vem na mão e entra de baixo pra cima
        const P = parts.mag, b = P.userData.base;
        let dy = 0;
        if (r >= 0.12 && r < 0.2) dy = -0.06 * ss((r - 0.12) / 0.08);
        else if (r >= 0.2 && r < 0.74) P.visible = false;
        else if (r >= 0.74 && r < 0.82) dy = -0.06 * (1 - ss((r - 0.74) / 0.08));
        P.position.y = b.y + dy;
        this.showHandMag((r >= 0.2 && r < 0.36) || (r >= 0.54 && r < 0.74));
        const toMag = r < 0.12 ? ss(r / 0.12) : r < 0.85 ? 1 : 1 - ss((r - 0.85) / 0.15);
        aL = mix(mix(aL, magPose, toMag), pouch, r >= 0.12 && r < 0.8 ? bell((r - 0.12) / 0.68) : 0);
        roll = 0.35 * env;
        if (def.scope) boltAnim(cl((r - 0.82) / 0.18, 0, 1), parts.bolt); // AWM: puxa o ferrolho no fim
      } else if (def.cat === 'Escopeta') {                         // um cartucho por vez
        const n = 4, c = ((r - 0.1) / 0.8) * n, inside = r > 0.1 && r < 0.9;
        aL = mix(mix(aL, port, env), pouch, inside ? bell(c % 1) : 0);
        roll = 0.5 * env;
        if (parts.pump && r > 0.88) parts.pump.position.z = parts.pump.userData.base.z - 0.1 * bell((r - 0.88) / 0.12);
        if (parts.lever && r > 0.88) parts.lever.rotation.x = -0.9 * bell((r - 0.88) / 0.12);
      } else if (parts.bolt) {                                     // Kar98: abre, empurra a munição, fecha
        boltAnim(r < 0.15 ? ss(r / 0.15) * 0.5 : r < 0.85 ? 0.5 : 0.5 + ss((r - 0.85) / 0.15) * 0.5, parts.bolt);
        const c = cl((r - 0.2) / 0.6, 0, 1) * 2;
        aL = mix(mix(aL, port, env), pouch, r > 0.2 && r < 0.8 ? bell(c % 1) : 0);
        roll = 0.3 * env;
      }
    }
    if (!(s.armed && s.reload >= 0)) this.showHandMag(false);
    // ---- ciclo depois do tiro: ferrolho, bomba ou alavanca ----
    if (this.cycleK !== undefined && this.cycleK < 1) {
      this.cycleK = Math.min(1, this.cycleK + dt / (this.cycleDur || 0.6));
      const e = cl((this.cycleK - 0.18) / 0.82, 0, 1);
      if (parts.bolt) { boltAnim(e, parts.bolt); aR[0] += 0.12 * bell(e); }
      if (parts.pump) { const b = bell(e); parts.pump.position.z = parts.pump.userData.base.z - 0.1 * b; aL[0] += 0.18 * b; }
      if (parts.lever) { const b = bell(e); parts.lever.rotation.x = -0.9 * b; aR[0] += 0.1 * b; }
    }
    // ---- troca de arma: desce a atual até o quadril, troca no meio, sobe a nova ----
    if (this.swapK !== undefined && this.swapK < 1) {
      this.swapK = Math.min(1, this.swapK + dt / 0.45);
      if (this.swapK >= 0.5 && this.pendingGun !== undefined) { this.setGun(this.pendingGun); this.pendingGun = undefined; }
      const down = this.swapK < 0.5 ? ss(this.swapK * 2) : 1 - ss((this.swapK - 0.5) * 2);
      aR = mix(aR, [-0.12, 0, 0.28], down); aL = mix(aL, [0.05, 0, -0.12], down); roll -= 0.6 * down;
    }
    // ---- cura: kit/bandagem na mão esquerda, arma abaixada ----
    this.healK = E(this.healK || 0, s.heal ? 1 : 0, 8);
    this.setMedInHand(s.heal || (this.healK > 0.2 ? this.medType : null));
    if (this.healK > 0.01) {
      const band = s.heal === 'bandage' || this.medType === 'bandage', wob = band ? Math.sin(now * 9) * 0.18 : Math.sin(now * 5) * 0.08;
      aL = mix(aL, [-1.35 + wob, 0, -0.75 + (band ? Math.cos(now * 9) * 0.12 : 0)], this.healK);
      if (s.armed) aR = mix(aR, [-0.45, 0, 0.18], this.healK);
      headX += 0.25 * this.healK; // olha pro curativo
    }
    // ---- soco (sem arma): estica rápido, volta devagar, gira o tronco; o outro braço fica na guarda ----
    if (this.punchT > 0) {
      this.punchT = Math.max(0, this.punchT - dt / 0.38);
      const t = 1 - this.punchT, ext = t < 0.3 ? ss(t / 0.3) : 1 - ss((t - 0.3) / 0.7), side = this.punchSide, guard = 1 - ss((t - 0.7) / 0.3);
      const hitArm = [-Math.PI / 2 - pitch * 0.5, 0, side > 0 ? 0.22 : -0.22], guardArm = [-1.25, 0, side > 0 ? -0.55 : 0.55];
      if (side > 0) { aR = mix(aR, hitArm, ext); aL = mix(aL, guardArm, guard); } else { aL = mix(aL, hitArm, ext); aR = mix(aR, guardArm, guard); }
      tY += side * 0.38 * ext;
    }
    // ---- parado: respiração, peso trocando de perna, olhar em volta e, de vez em quando, uma "mexida" ----
    const still = !s.air && this.moveK < 0.08 && ck < 0.3 && !(s.reload >= 0) && !s.heal && !(this.punchT > 0) && !(this.swapK < 1);
    this.idleK = E(this.idleK || 0, still ? 1 : 0, still ? 2.5 : 10);
    this.idleT = still ? (this.idleT || 0) + dt : 0;
    if (this.idleK > 0.01) {
      const ik = this.idleK, t = now + this.seed * 3.7;
      const breath = Math.sin(t * 2.1) * 0.5 + 0.5;                       // inspira/expira (~3 s)
      const shift = Math.sin(t * 0.55) ;                                  // troca o peso de perna devagar
      this.hips.position.y += (breath * 0.012 - Math.abs(shift) * 0.018) * ik;
      this.idleSway = shift * 0.035 * ik;                                 // quadril cai pro lado do apoio
      const relaxR = Math.max(0, shift) * 0.14, relaxL = Math.max(0, -shift) * 0.14; // a perna sem peso dobra um pouco
      this.legR.rotation.x += relaxR * ik; this.legL.rotation.x += relaxL * ik;
      this.legR.rotation.z = 0.04 * ik; this.legL.rotation.z = -0.04 * ik;
      tX += (breath * 0.035 - 0.01) * ik;                                 // peito sobe e desce
      // olha em volta: vira a cabeça para um lado, segura, volta (por personagem, cada um no seu ritmo)
      const look = Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1.3);
      this.idleLook = look * 0.55 * ik;
      // armado e sem atirar/mirar há ~1 s: abaixa a arma (posição de guarda baixa) em vez de ficar apontando pro nada
      this.lowK = E(this.lowK || 0, s.armed && !s.armedAim && this.idleT > 1 ? 1 : 0, s.armedAim ? 14 : 3);
      if (this.lowK > 0.01) { const lk = this.lowK * ik;
        aR = mix(aR, [-0.75 + breath * 0.04, 0, 0.32], lk); aL = mix(aL, pistol ? [-0.7, 0, -0.45] : [-0.95 + breath * 0.04, 0, -0.62], lk);
        roll -= 0.15 * lk; headX += 0.08 * lk; }
      if (!aiming || this.lowK > 0.5) {
        if (s.armed) { aR = mix(aR, [aR[0] + breath * 0.05, 0, aR[2]], ik); aL = mix(aL, [aL[0] + breath * 0.06, 0, aL[2]], ik); }
        else { aR = mix(aR, [-0.06 - breath * 0.05, 0, 0.1 + breath * 0.04], ik); aL = mix(aL, [-0.06 - breath * 0.05, 0, -0.1 - breath * 0.04], ik); }
      }
      // depois de uns segundos parado: alonga (sem arma) ou confere a arma (armado), a cada ~9 s
      const cyc = 9 + (this.seed % 1) * 3, f = this.idleT > 4 ? (this.idleT - 4) % cyc : -1, fk = f >= 0 && f < 2.2 ? bell(f / 2.2) * ik : 0;
      if (fk > 0.001 && (!aiming || this.lowK > 0.5)) {
        if (s.armed) { aR = mix(aR, [-1.15, 0, 0.35], fk); aL = mix(aL, [-1.0, 0, -0.2], fk); roll += 0.9 * fk; headX += 0.3 * fk; this.idleLook *= 1 - fk; }
        else { const up = ss(fk * 1.6); aR = mix(aR, [-2.9 * up, 0, 1.5 - 1.1 * up], fk); aL = mix(aL, [-2.9 * up, 0, -1.5 + 1.1 * up], fk); tX -= 0.12 * fk; headX -= 0.2 * fk; }
      }
    } else { this.idleLook = 0; this.idleSway = 0; }
    // ---- pulo em 4 fases: impulso (encolhe e estica), subida (joelhos pra cima, braços jogados), topo e descida (pernas se preparam, braços abrem) ----
    this.airK = E(this.airK || 0, s.air ? 1 : 0, s.air ? 16 : 20);
    if (s.air && !this.wasAir) this.jumpT = 0;                           // acabou de sair do chão
    this.wasAir = !!s.air;
    this.jumpT = (this.jumpT === undefined ? 9 : this.jumpT) + dt;
    if (this.airK > 0.01) {
      const vy = s.vy || 0, a = this.airK;
      const rise = cl(vy / 8, 0, 1), fallK = cl(-vy / 9, 0, 1), apex = 1 - Math.max(rise, fallK);
      const kick = this.jumpT < 0.18 ? bell(this.jumpT / 0.18) : 0;     // estica o corpo logo no impulso
      // pernas: subindo = joelho direito alto e esquerdo puxado; topo = as duas encolhidas; caindo = esticam pra baixo, uma à frente
      const lR = -0.25 * kick + L(L(-0.95, -1.15, rise), -0.35, fallK), lL = 0.35 * kick + L(L(-0.55, 0.15, rise), -0.1, fallK);
      this.legR.rotation.x = L(this.legR.rotation.x, lR, a); this.legL.rotation.x = L(this.legL.rotation.x, lL, a);
      this.legR.rotation.z = L(0.04, 0.16, fallK) * a; this.legL.rotation.z = -L(0.04, 0.16, fallK) * a;
      this.hips.position.y += (0.05 * apex - 0.03 * kick) * a;           // encolhe no topo
      tX = L(tX, -0.12 * kick + 0.18 * apex + L(0.05, -0.08, fallK), a);  // tronco: arqueia no impulso, curva no topo
      headX += (-0.12 * kick + 0.12 * fallK) * a;                         // olha pro chão chegando
      if (!aiming && !(this.punchT > 0)) {
        const up = [-2.75 + 0.5 * apex, 0, 0.55], side = [-0.25, 0, 1.45], tuck = [-1.5, 0, 0.75];
        const pose = mix(mix(up, tuck, apex), side, fallK);
        if (s.armed) { aL = mix(aL, [pose[0] * 0.4, 0, -pose[2] * 0.6], a * 0.6); }
        else { aR = mix(aR, pose, a); aL = mix(aL, [pose[0] - 0.1, 0, -pose[2]], a); }
      }
    } else if (!(this.idleK > 0.01)) { this.legR.rotation.z = 0; this.legL.rotation.z = 0; }
    // ---- aplica suavizando (sem saltos entre poses) ----
    this._aR = this._aR || [0, 0, 0]; this._aL = this._aL || [0, 0, 0]; this._t = this._t || [0, 0];
    for (let i = 0; i < 3; i++) { this._aR[i] = E(this._aR[i], aR[i], 16); this._aL[i] = E(this._aL[i], aL[i], 16); }
    this._t[0] = E(this._t[0], tX, 12); this._t[1] = E(this._t[1], tY, 14);
    this.hips.rotation.z = E(this.hips.rotation.z, this.leanK + (this.idleSway || 0), 10);
    // aditivos rápidos (não suavizados): recuo e reação a dano
    this.recoilT = Math.max(0, this.recoilT - dt * 8);
    this.hitT = Math.max(0, (this.hitT || 0) - dt * 4);
    const rk = this.recoilT, hk = this.hitT * this.hitT;
    this.armR.rotation.set(this._aR[0] - (aiming ? rk * 0.22 : 0) + hk * 0.25, this._aR[1], this._aR[2]);
    this.armL.rotation.set(this._aL[0] - (aiming ? rk * 0.18 : 0) + hk * 0.2, this._aL[1], this._aL[2]);
    this.torso.rotation.set(this._t[0] - hk * 0.28, this._t[1], (this.hitSide || 0) * 0.14 * hk);
    this._look = E(this._look || 0, this.idleLook || 0, 4);
    this.headG.rotation.set(-pitch * 0.6 - this.torso.rotation.x * 0.6 + headX + hk * 0.35, -this._t[1] * 0.6 + this._look, 0);
    // arma: recuo visual (chute pra trás e cano sobe) e giro durante recarga/troca
    if (this.gun) { this.gun.position.set(0, rk * 0.045, 0); this.gun.rotation.set(Math.PI / 2 - rk * 0.12, 0, 0); }
    this.gunHolder.rotation.y = E(this.gunHolder.rotation.y, roll, 12);
  }
};
// ordem dos ossos no esqueleto (nomes padrão do Mixamo; equivalentes do R15 do lado)
LS.CharacterModel.BONES = [
  'Hips', 'Spine', 'Head',                        // LowerTorso, UpperTorso, Head
  'RightArm', 'RightForeArm', 'RightHand',        // RightUpperArm, RightLowerArm, RightHand
  'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightUpLeg', 'RightLeg', 'RightFoot',          // RightUpperLeg, RightLowerLeg, RightFoot
  'LeftUpLeg', 'LeftLeg', 'LeftFoot'];
LS.CharacterModel.JOINTS = ['RightForeArm', 'RightHand', 'LeftForeArm', 'LeftHand', 'RightLeg', 'RightFoot', 'LeftLeg', 'LeftFoot'];
// pedaços de cada osso: [osso, parte do atlas, linha inicial, linha final, pivô] (linhas em pixels, de cima pra baixo)
LS.CharacterModel.PIECES = [
  ['Hips', 'body', 7, 12, 'bottom'], ['Spine', 'body', 0, 7, 'bottom'], ['Head', 'head', 0, 8, 'bottom'],
  ['RightArm', 'arm', 0, 5, 'top'], ['RightForeArm', 'arm', 5, 10, 'top'], ['RightHand', 'arm', 10, 12, 'top'],
  ['LeftArm', 'arm', 0, 5, 'top'], ['LeftForeArm', 'arm', 5, 10, 'top'], ['LeftHand', 'arm', 10, 12, 'top'],
  ['RightUpLeg', 'leg', 0, 6, 'top'], ['RightLeg', 'leg', 6, 11, 'top'], ['RightFoot', 'leg', 11, 12, 'top'],
  ['LeftUpLeg', 'leg', 0, 6, 'top'], ['LeftLeg', 'leg', 6, 11, 'top'], ['LeftFoot', 'leg', 11, 12, 'top']];
// junta os 15 pedaços numa geometria só, com peso 1 no osso de cada pedaço (igual para todos os personagens)
LS.CharacterModel.skinGeometry = function (model) {
  if (this._skinGeo) return this._skinGeo;
  const pos = [], nor = [], uv = [], idx = [], si = [], sw = [], wp = new THREE.Vector3();
  for (const [bone, part, y0, y1, pivot] of this.PIECES) {
    const g = LS.Skin.slice(part, y0, y1, pivot), bi = this.BONES.indexOf(bone), base = pos.length / 3;
    model.bones[bone].getWorldPosition(wp).sub(model.root.position);
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i) + wp.x, P.getY(i) + wp.y, P.getZ(i) + wp.z); nor.push(N.getX(i), N.getY(i), N.getZ(i)); uv.push(U.getX(i), U.getY(i));
      si.push(bi, 0, 0, 0); sw.push(1, 0, 0, 0);
    }
    const I = g.index; for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + base);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx);
  return (this._skinGeo = geo);
};
