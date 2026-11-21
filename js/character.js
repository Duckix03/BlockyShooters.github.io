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
  // ---------- ajudantes de pose (R15) ----------
  // braço: [inclinação, giro, abertura (+ = pra fora do corpo, nos dois lados), cotovelo (+ = dobra pra frente), punho]
  setArm(side, p) {
    const a = side > 0 ? this.armL : this.armR, f = side > 0 ? this.foreL : this.foreR, h = side > 0 ? this.handL : this.handR;
    a.rotation.set(p[0], side > 0 ? -p[1] : p[1], side > 0 ? p[2] : -p[2]);
    f.rotation.set(-LS.util.clamp(p[3] || 0, 0, 2.5), 0, 0); // cotovelo não dobra pra trás
    h.rotation.set(-(p[4] || 0), 0, 0);
  }
  // mistura a pose atual do braço com outra (k = 0..1), girando de verdade (sem distorcer)
  blendArm(side, p, k) {
    if (k <= 0) return;
    const bs = side > 0 ? [this.armL, this.foreL, this.handL] : [this.armR, this.foreR, this.handR];
    const q0 = bs.map(b => b.quaternion.clone());
    this.setArm(side, p);
    bs.forEach((b, i) => { const t = b.quaternion.clone(); b.quaternion.copy(q0[i]).slerp(t, k); });
  }
  // perna direta: coxa (+ = pra trás), joelho (+ = dobra), abertura (+ = pra fora); o pé fica meio nivelado
  legPose(side, thigh, knee, spread, footK) {
    const u = side > 0 ? this.legL : this.legR, l = side > 0 ? this.shinL : this.shinR, f = side > 0 ? this.footL : this.footR;
    u.rotation.set(thigh, 0, side > 0 ? spread : -spread); l.rotation.set(Math.max(0, knee), 0, 0);
    f.rotation.set(-(thigh + Math.max(0, knee)) * (footK === undefined ? 0.5 : footK), 0, 0);
  }
  // perna com IK de 2 ossos (coxa e canela do mesmo tamanho): o pé vai pra (fwd à frente, lift acima do chão)
  // e fica reto no chão; o joelho sempre dobra pra frente
  solveLeg(side, fwd, lift, hipY, spread) {
    const u = side > 0 ? this.legL : this.legR, l = side > 0 ? this.shinL : this.shinR, f = side > 0 ? this.footL : this.footR;
    const LEN = 12 * LS.Skin.PX - 1e-4;
    let dy = Math.max(0.04, hipY - lift), d = Math.hypot(fwd, dy);
    if (d > LEN) { fwd *= LEN / d; dy *= LEN / d; d = LEN; }
    const c = Math.acos(Math.min(1, d / LEN)), a = Math.atan2(fwd, dy) + c, knee = 2 * c;
    u.rotation.set(-a, 0, side > 0 ? spread : -spread); l.rotation.set(knee, 0, 0); f.rotation.set(a - knee, 0, 0);
  }
  // pontos da arma (no espaço da arma) onde a mão esquerda segura: guarda-mão, pente e janela de munição
  gunPoints(id) {
    const C = LS.CharacterModel.GUNPTS || (LS.CharacterModel.GUNPTS = {});
    if (C[id]) return C[id];
    const g = LS.buildGunMesh(id), box = new THREE.Box3().setFromObject(g), cat = LS.WEAPONS[id].cat, P = g.userData.parts || {};
    const zk = { Rifle: 0.48, SMG: 0.5, Sniper: 0.42, Escopeta: 0.45 }[cat] || 0.45;
    const out = {
      grip: cat === 'Pistola' ? new THREE.Vector3(0.03, box.min.y * 0.75, -0.01) : new THREE.Vector3(0, Math.max(box.min.y * 0.4, -0.08), box.max.z * zk),
      port: new THREE.Vector3(0, -0.04, box.max.z * 0.2), mag: null, pumpOff: null,
    };
    if (P.mag) { out.mag = new THREE.Box3().setFromObject(P.mag).getCenter(new THREE.Vector3()); out.mag.y -= 0.03; }
    if (P.pump) out.pumpOff = new THREE.Box3().setFromObject(P.pump).getCenter(new THREE.Vector3()).sub(P.pump.position).add(new THREE.Vector3(0, -0.03, 0));
    return (C[id] = out);
  }
  gripPoint(target) {
    const G = this.gunId && this.gunPoints(this.gunId), P = this.gun && this.gun.userData.parts;
    if (!G) return target.set(0, 0, 0);
    if (P && P.pump && G.pumpOff) return target.copy(P.pump.position).add(G.pumpOff); // segura a bomba (acompanha o "pump")
    return target.copy(G.grip);
  }
  // IK do braço esquerdo: leva a mão até um ponto da arma (pt no espaço da arma), cotovelo pra baixo e pra fora
  gripLeft(k, pt) {
    if (k <= 0.001 || !this.gun || !pt) return;
    const V = THREE.Vector3, t = this._ik || (this._ik = { T: new V(), d: new V(), p: new V(), u: new V(), e: new V(), f: new V(), x: new V(), y: new V(), z: new V(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion() });
    this.gun.updateWorldMatrix(true, false);
    t.T.copy(pt); this.gun.localToWorld(t.T); this.torso.worldToLocal(t.T); // alvo no espaço do tronco
    const S = LS.Skin.PX, L1 = 5 * S, L2 = 6 * S, sh = this.armL.position;
    t.d.subVectors(t.T, sh); let dist = t.d.length(); if (dist < 1e-5) return;
    t.d.divideScalar(dist); dist = LS.util.clamp(dist, 0.35 * (L1 + L2), L1 + L2 - 1e-4);
    const ca = LS.util.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1), sa = Math.sqrt(1 - ca * ca);
    t.p.set(0.55, -1, -0.35); t.p.addScaledVector(t.d, -t.p.dot(t.d)).normalize();       // cotovelo: pra fora, pra baixo e pra trás
    t.u.copy(t.d).multiplyScalar(ca).addScaledVector(t.p, sa);                           // direção do braço
    t.e.copy(sh).addScaledVector(t.u, L1);                                               // cotovelo
    t.f.copy(sh).addScaledVector(t.d, dist).sub(t.e).normalize();                        // direção do antebraço
    t.y.copy(t.u).negate();
    t.z.copy(t.f).addScaledVector(t.u, -t.f.dot(t.u)); if (t.z.lengthSq() < 1e-8) t.z.copy(t.p).negate(); t.z.normalize();
    t.x.crossVectors(t.y, t.z);
    t.q.setFromRotationMatrix(t.m.makeBasis(t.x, t.y, t.z));
    this.armL.quaternion.slerp(t.q, k);
    t.q2.setFromAxisAngle(t.x.set(1, 0, 0), -Math.acos(LS.util.clamp(t.f.dot(t.u), -1, 1)));
    this.foreL.quaternion.slerp(t.q2, k);
    this.handL.quaternion.slerp(t.q2.set(0, 0, 0, 1), k);
  }
  // corrida armada (usado pela dash_run_f): arma atravessada no peito, mão esquerda segura pela IK
  carryPose(k, sw) {
    const C = LS.CharacterModel.CARRY;
    this.blendArm(-1, [C.R[0] + sw, 0, C.R[2], C.R[3] - sw * 0.5], k);
    this.gripLeft(k, this.gripPoint(this._carryPt || (this._carryPt = new THREE.Vector3())));
  }

  // morte: os joelhos cedem, cai com aceleração, quica de leve e fica mole (braços pra fora, sem atravessar o corpo)
  animDeath(dt) {
    const L = LS.util.lerp, cl = LS.util.clamp, ss = x => x * x * (3 - 2 * x);
    if (!this.deadT) { this.deadDir = Math.random() < 0.65 ? -1 : 1; this.deadRoll = (Math.random() - 0.5) * 0.5; this.deadT = 1e-4; this.chute.visible = false; this.setMedInHand(null); }
    this.deadT = Math.min(1.4, this.deadT + dt * 1.5);
    const k = this.deadT, buck = ss(cl(k / 0.25, 0, 1)), f = cl((k - 0.18) / 0.62, 0, 1), fall = f * f;
    const bounce = k > 0.8 ? Math.sin(cl((k - 0.8) / 0.4, 0, 1) * Math.PI) * 0.07 : 0;
    this.root.rotation.x = this.deadDir * (Math.PI / 2 * fall - bounce);
    this.root.rotation.z = this.deadRoll * fall;
    this.root.position.y += 0.11 * fall; // metade da grossura do corpo: deitado sem afundar no chão
    this.hips.position.y = this.hipsY - 0.24 * buck * (1 - fall);
    this.hips.rotation.set(0, 0, 0);
    this.legPose(-1, L(-0.55 * buck, -0.12, fall), L(1.25 * buck, 0.3, fall), L(0.02, 0.1, fall), 0.4);
    this.legPose(1, L(-0.25 * buck, 0.06, fall), L(0.85 * buck, 0.18, fall), L(0.02, 0.12, fall), 0.4);
    this.torso.rotation.set(0.35 * buck * (1 - fall), 0, 0);
    const up = this.deadDir < 0 ? -2.5 : -0.4; // de costas: braços pra cima; de bruços: pra frente
    this.setArm(-1, [L(-0.3 * buck, up, fall), 0, L(0.1, 0.5, fall), L(0.35, 0.45, fall)]);
    this.setArm(1, [L(-0.2 * buck, up + 0.25, fall), 0, L(0.1, 0.6, fall), L(0.3, 0.7, fall)]);
    this.headG.rotation.set(-0.25 * this.deadDir * fall, 0.3 * this.deadRoll, 0);
  }
  // animação do código + (se estiver tocando) a animação externa por cima
  animate(s) {
    // zera o que o código não controla, para uma animação externa que acabou não deixar o osso torto
    this.hips.position.x = 0; this.hips.position.z = 0; this.hips.rotation.y = 0;
    for (const n of LS.CharacterModel.JOINTS) this.bones[n].quaternion.set(0, 0, 0, 1);
    this.animateBase(s);
    if (LS.Anim) LS.Anim.loco(this, s); // corrida oficial (dash_run_f)
    if (this.anim) this.anim.apply(s.dt || 0, s);
  }
  // s: {speed, running, crouch, air, chute, fall, dive, steer, vy, aimPitch, armed, armedAim, dead, dt, idle,
  //     reload (0..1 ou -1), heal ('medkit'|'bandage'|null)}
  animateBase(s) {
    const dt = s.dt, L = LS.util.lerp, cl = LS.util.clamp, ss = x => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };
    const E = (cur, tgt, r) => cur + (tgt - cur) * (1 - Math.exp(-r * dt)); // suavização independente do FPS
    const ease = 1 - Math.exp(-8 * dt);
    if (s.dead) { this.showHandMag(false); this.animDeath(dt); return; }
    if (this.deadT) { this.deadT = 0; this.root.rotation.x = 0; this.root.rotation.z = 0; }
    const now = performance.now() * 0.001;
    if (s.fall) {
      // queda livre: de barriga pra baixo, arqueado, braços abertos com cotovelos a 90° e joelhos dobrados (paraquedista)
      this.chuteT = 0; this.chute.visible = false;
      const wob = Math.sin(now * 5 + this.seed) * 0.06, st = s.steer || 0;
      this.hips.position.y = this.hipsY;
      this.hips.rotation.x = L(this.hips.rotation.x, s.dive ? 1.45 : 1.2, ease);
      this.hips.rotation.z = L(this.hips.rotation.z, st * 0.45 + wob, ease);
      this.torso.rotation.set(s.dive ? 0.05 : -0.18, 0, 0);
      if (s.dive) {
        this.setArm(-1, [0.3, 0, 0.16, 0.12]); this.setArm(1, [0.3, 0, 0.16, 0.12]);
        this.legPose(-1, 0.04, 0.12, 0.04, 0.3); this.legPose(1, 0.04, 0.12, 0.04, 0.3);
      } else {
        this.setArm(-1, [-Math.PI / 2, 0, 1.45 + wob - st * 0.25, 1.35]); this.setArm(1, [-Math.PI / 2, 0, 1.45 - wob + st * 0.25, 1.35]);
        this.legPose(-1, 0.32, 1.2 + wob, 0.24, 0.2); this.legPose(1, 0.32, 1.2 - wob, 0.24, 0.2);
      }
      this.headG.rotation.set(-0.85, 0, 0);
      return;
    }
    if (s.chute) {
      // paraquedas abrindo com "estouro", balanço e inclinação na direção da manobra; mãos nas cordas, pernas soltas
      this.chuteT = Math.min(1, (this.chuteT || 0) + dt * 2.2);
      const k = this.chuteT, c1 = 1.70158, c3 = c1 + 1, back = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
      this.chute.visible = true; this.chute.scale.set(back, Math.max(0.05, back), back);
      const sway = Math.sin(now * 1.6 + this.seed) * 0.07, st = s.steer || 0;
      this.chute.rotation.z = sway + st * 0.25;
      this.hips.rotation.x = L(this.hips.rotation.x, 0, ease * 1.5);
      this.hips.rotation.z = L(this.hips.rotation.z, sway * 0.8 + st * 0.3, ease);
      this.hips.position.y = this.hipsY;
      this.torso.rotation.set(0, 0, 0);
      // puxa a corda do lado da curva
      this.setArm(-1, [-(Math.PI - 0.4) + Math.max(0, -st) * 0.35, 0, 0.32, 0.6 - Math.max(0, -st) * 0.3]);
      this.setArm(1, [-(Math.PI - 0.4) + Math.max(0, st) * 0.35, 0, 0.32, 0.6 - Math.max(0, st) * 0.3]);
      const sw = Math.sin(now * 2.2 + this.seed);
      this.legPose(-1, -0.12 + sw * 0.1, 0.3 + Math.max(0, sw) * 0.25, 0.05, 0.5); this.legPose(1, 0.06 - sw * 0.1, 0.3 + Math.max(0, -sw) * 0.25, 0.05, 0.5);
      this.headG.rotation.set(0.15, 0, 0);
      return;
    }
    this.chute.visible = false; this.chuteT = 0;
    // ---- base: passada (pés com IK) entre parado / andando / correndo ----
    this.hips.rotation.x = E(this.hips.rotation.x, 0, 10);
    this.landT = Math.max(0, (this.landT || 0) - dt);
    this.crouchK = E(this.crouchK, s.crouch ? 1 : 0, 10);
    const ck = Math.max(this.crouchK, ss(this.landT / 0.35)); // agachado / impacto da aterrissagem
    const spd = s.speed || 0;
    this.runK = E(this.runK || 0, s.running ? 1 : 0, 6);
    this.moveK = E(this.moveK || 0, cl(spd / 4.5, 0, 1), 8);
    const stride = L(0.27, 0.34, this.runK) * this.moveK * (1 - ck * 0.35);   // meio passo (m): passada longa
    this.phase += dt * spd * L(1.65, 1.3, this.runK);                         // ritmo calmo: ~2,4 passos/s andando
    const amp = this.moveK * L(0.7, 1.0, this.runK) * (1 - ck * 0.4), sw = Math.sin(this.phase) * amp, cph = Math.cos(this.phase);
    const liftH = this.moveK * L(0.07, 0.13, this.runK) * (1 - ck * 0.5);
    // direita vai pra trás quando sw > 0 (o braço direito vai pra frente: passada cruzada)
    let fR = -stride * Math.sin(this.phase), fL = stride * Math.sin(this.phase);
    let lR = liftH * Math.max(0, -cph), lL = liftH * Math.max(0, cph), spread = 0.03 + ck * 0.07;
    fR += ck * 0.03; fL += ck * 0.03;
    this.hips.position.y = this.hipsY - 0.006 - ck * 0.22 + (Math.abs(cph) - 0.6) * amp * 0.045;
    // inclinação nas curvas (pela velocidade de giro)
    const yaw = this.root.rotation.y, turn = this.prevYaw === undefined ? 0 : LS.util.angleDiff(this.prevYaw, yaw) / Math.max(dt, 1e-3);
    this.prevYaw = yaw;
    this.leanK = E(this.leanK || 0, cl(-turn * 0.05 * (0.3 + this.moveK + this.runK), -0.28, 0.28), 6);
    // ---- alvos dos braços: [inclinação, giro, abertura, cotovelo, punho] ----
    const pitch = s.aimPitch || 0, def = this.gunId ? LS.WEAPONS[this.gunId] : null, pistol = def && def.cat === 'Pistola';
    let tX = ck * 0.32 + this.runK * (s.armedAim ? 0.02 : 0.1) + this.moveK * 0.04, tY = 0, headX = 0;
    const aimBase = -Math.PI / 2 - pitch - tX, aiming = s.armed && (!s.running || s.armedAim);
    // braço direito segura a arma: inclinação - cotovelo = direção do cano (coronha no ombro, cotovelo dobrado)
    let aR, aL, roll = 0, ikW = 0, ikMode = 'grip', toMag = 0;
    if (s.armed) {
      if (aiming) { aR = pistol ? [aimBase + 0.24, 0, -0.08, 0.24] : [aimBase + 0.45, 0, -0.1, 0.45]; aL = [aimBase + 0.5, 0, -0.3, 0.9]; }
      else { aR = [-0.72 - tX, 0, -0.16, 0.62]; aL = [-0.55 - tX, 0, -0.25, 0.95]; } // guarda (cano um pouco abaixo)
      ikW = 1;
    } else {
      const fwR = Math.max(0, sw), fwL = Math.max(0, -sw), out = 0.1 + this.moveK * 0.04 + this.runK * 0.04;
      aR = [-sw * 0.8 - tX * 0.5, 0, out, 0.22 + fwR * L(0.5, 1.1, this.runK)];
      aL = [sw * 0.8 - tX * 0.5, 0, out, 0.22 + fwL * L(0.5, 1.1, this.runK)];
    }
    const mix = (a, b, k) => [0, 1, 2, 3, 4].map(i => L(a[i] || 0, b[i] || 0, k));
    const parts = this.gun ? this.gun.userData.parts : {};
    for (const k in parts) { const p = parts[k]; p.position.copy(p.userData.base); p.rotation.set(0, 0, 0); p.visible = true; }
    const bell = e => Math.sin(cl(e, 0, 1) * Math.PI);
    const boltAnim = (e, P) => { if (!P) return; const rot = e < 0.25 ? e / 0.25 : e < 0.75 ? 1 : 1 - (e - 0.75) / 0.25, back = e < 0.25 ? 0 : e < 0.5 ? (e - 0.25) / 0.25 : e < 0.75 ? 1 - (e - 0.5) / 0.25 : 0;
      P.rotation.z = -1.1 * ss(rot); P.position.z = P.userData.base.z - 0.075 * ss(back); };
    const pouch = [-0.2, 0, 0.3, 1.05]; // mão esquerda no bolso da cintura (pra fora do corpo)
    // ---- recarga: a mão esquerda vai ao pente / à janela de munição de verdade (IK) e ao bolso ----
    if (s.armed && s.reload >= 0 && def) {
      const r = s.reload, env = ss(Math.min(r / 0.1, (1 - r) / 0.1, 1));
      aR = mix(aR, [aimBase + 0.9, 0, -0.15, 0.62], env); // arma mais baixa e perto do corpo
      if (parts.mag) {
        const P = parts.mag, b = P.userData.base;
        let dy = 0;
        if (r >= 0.12 && r < 0.2) dy = -0.06 * ss((r - 0.12) / 0.08);
        else if (r >= 0.2 && r < 0.74) P.visible = false;
        else if (r >= 0.74 && r < 0.82) dy = -0.06 * (1 - ss((r - 0.74) / 0.08));
        P.position.y = b.y + dy;
        this.showHandMag((r >= 0.2 && r < 0.36) || (r >= 0.54 && r < 0.74));
        toMag = r < 0.12 ? ss(r / 0.12) : r < 0.85 ? 1 : 1 - ss((r - 0.85) / 0.15); ikMode = 'mag';
        aL = pouch; ikW = 1 - (r >= 0.12 && r < 0.8 ? bell((r - 0.12) / 0.68) : 0);
        roll = 0.35 * env;
        if (def.scope) boltAnim(cl((r - 0.82) / 0.18, 0, 1), parts.bolt); // AWM: puxa o ferrolho no fim
      } else if (def.cat === 'Escopeta') {                         // um cartucho por vez
        const n = 4, c = ((r - 0.1) / 0.8) * n, inside = r > 0.1 && r < 0.9;
        ikMode = 'port'; toMag = env; aL = pouch; ikW = 1 - (inside ? bell(c % 1) : 0);
        roll = 0.5 * env;
        if (parts.pump && r > 0.88) parts.pump.position.z = parts.pump.userData.base.z - 0.1 * bell((r - 0.88) / 0.12);
        if (parts.lever && r > 0.88) parts.lever.rotation.x = -0.9 * bell((r - 0.88) / 0.12);
      } else if (parts.bolt) {                                     // Kar98: abre, empurra a munição, fecha
        boltAnim(r < 0.15 ? ss(r / 0.15) * 0.5 : r < 0.85 ? 0.5 : 0.5 + ss((r - 0.85) / 0.15) * 0.5, parts.bolt);
        const c = cl((r - 0.2) / 0.6, 0, 1) * 2;
        ikMode = 'port'; toMag = env; aL = pouch; ikW = 1 - (r > 0.2 && r < 0.8 ? bell(c % 1) : 0);
        roll = 0.3 * env;
      }
    }
    if (!(s.armed && s.reload >= 0)) this.showHandMag(false);
    // ---- ciclo depois do tiro: ferrolho, bomba ou alavanca ----
    if (this.cycleK !== undefined && this.cycleK < 1) {
      this.cycleK = Math.min(1, this.cycleK + dt / (this.cycleDur || 0.6));
      const e = cl((this.cycleK - 0.18) / 0.82, 0, 1);
      if (parts.bolt) { boltAnim(e, parts.bolt); aR[3] += 0.25 * bell(e); }
      if (parts.pump) parts.pump.position.z = parts.pump.userData.base.z - 0.1 * bell(e); // a mão esquerda vai junto (IK na bomba)
      if (parts.lever) { const b = bell(e); parts.lever.rotation.x = -0.9 * b; aR[3] += 0.3 * b; }
    }
    // ---- troca de arma: desce a atual até o quadril, troca no meio, sobe a nova ----
    if (this.swapK !== undefined && this.swapK < 1) {
      this.swapK = Math.min(1, this.swapK + dt / 0.45);
      if (this.swapK >= 0.5 && this.pendingGun !== undefined) { this.setGun(this.pendingGun); this.pendingGun = undefined; }
      const down = this.swapK < 0.5 ? ss(this.swapK * 2) : 1 - ss((this.swapK - 0.5) * 2);
      aR = mix(aR, [-0.15, 0, -0.18, 0.35], down); aL = mix(aL, [0, 0, 0.12, 0.25], down); roll -= 0.6 * down; ikW *= 1 - down;
    }
    // ---- cura: kit/bandagem na mão esquerda, na frente do peito; arma abaixada ----
    this.healK = E(this.healK || 0, s.heal ? 1 : 0, 8);
    this.setMedInHand(s.heal || (this.healK > 0.2 ? this.medType : null));
    if (this.healK > 0.01) {
      const band = s.heal === 'bandage' || this.medType === 'bandage', wob = band ? Math.sin(now * 9) * 0.15 : Math.sin(now * 5) * 0.06;
      aL = mix(aL, [-0.55 + wob, 0, -0.12 + (band ? Math.cos(now * 9) * 0.08 : 0), 1.55], this.healK);
      if (s.armed) aR = mix(aR, [-0.3, 0, -0.16, 0.55], this.healK);
      ikW *= 1 - this.healK;
      headX += 0.25 * this.healK; // olha pro curativo
    }
    // ---- soco (sem arma): guarda de boxe, estica rápido girando o tronco e volta pra guarda ----
    if (this.punchT > 0) {
      this.punchT = Math.max(0, this.punchT - dt / 0.38);
      const t = 1 - this.punchT, ext = t < 0.3 ? ss(t / 0.3) : 1 - ss((t - 0.3) / 0.7), side = this.punchSide, guard = 1 - ss((t - 0.7) / 0.3);
      const hitArm = [-Math.PI / 2 - pitch * 0.5 + 0.05, 0, -0.18, 0.06], guardArm = [-0.6, 0, -0.12, 2.0];
      const g0 = mix(aR, guardArm, Math.min(1, guard * 1.5)), g1 = mix(aL, guardArm, Math.min(1, guard * 1.5));
      if (side > 0) { aR = mix(g0, hitArm, ext); aL = g1; } else { aL = mix(g1, hitArm, ext); aR = g0; }
      tY += side * 0.38 * ext;
    }
    // ---- parado: respiração, peso trocando de perna, olhar em volta e, de vez em quando, uma "mexida" ----
    const still = !s.air && this.moveK < 0.08 && ck < 0.3 && !(s.reload >= 0) && !s.heal && !(this.punchT > 0) && !(this.swapK < 1);
    this.idleK = E(this.idleK || 0, still ? 1 : 0, still ? 2.5 : 10);
    this.idleT = still ? (this.idleT || 0) + dt : 0;
    if (this.idleK > 0.01) {
      const ik = this.idleK, t = now + this.seed * 3.7;
      const breath = Math.sin(t * 2.1) * 0.5 + 0.5;                       // inspira/expira (~3 s)
      const shift = Math.sin(t * 0.55);                                   // troca o peso de perna devagar
      this.hips.position.y += (breath * 0.01 - 0.008 - Math.abs(shift) * 0.016) * ik; // joelhos sempre um pouco soltos
      this.idleSway = shift * 0.035 * ik;                                 // quadril cai pro lado do apoio
      // a perna sem peso dobra o joelho e o pé encosta de leve um pouco à frente
      lR += Math.max(0, shift) * 0.035 * ik; fR += Math.max(0, shift) * 0.04 * ik;
      lL += Math.max(0, -shift) * 0.035 * ik; fL += Math.max(0, -shift) * 0.04 * ik;
      spread += 0.03 * ik;
      tX += (breath * 0.035 - 0.01) * ik;                                 // peito sobe e desce
      const look = Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1.3);
      this.idleLook = look * 0.55 * ik;
      // armado e sem atirar/mirar há ~1 s: abaixa a arma (guarda baixa) em vez de ficar apontando pro nada
      this.lowK = E(this.lowK || 0, s.armed && !s.armedAim && this.idleT > 1 ? 1 : 0, s.armedAim ? 14 : 3);
      if (this.lowK > 0.01) { const lk = this.lowK * ik;
        aR = mix(aR, [-0.32 + breath * 0.03, 0, -0.2, 0.8], lk); aL = mix(aL, [-0.45 + breath * 0.03, 0, -0.3, 1.05], lk);
        roll -= 0.15 * lk; headX += 0.08 * lk; }
      if (!aiming || this.lowK > 0.5) {
        if (s.armed) { aR = mix(aR, [aR[0] + breath * 0.04, aR[1], aR[2], aR[3]], ik); }
        else { aR = mix(aR, [-0.05 - breath * 0.04, 0, 0.12 + breath * 0.03, 0.2 + breath * 0.05], ik); aL = mix(aL, [-0.05 - breath * 0.04, 0, 0.12 + breath * 0.03, 0.2 + breath * 0.05], ik); }
      }
      // depois de uns segundos parado: alonga (sem arma) ou confere a arma (armado), a cada ~9 s
      const cyc = 9 + (this.seed % 1) * 3, f = this.idleT > 4 ? (this.idleT - 4) % cyc : -1, fk = f >= 0 && f < 2.2 ? bell(f / 2.2) * ik : 0;
      if (fk > 0.001 && (!aiming || this.lowK > 0.5)) {
        if (s.armed) { aR = mix(aR, [-0.55, 0, -0.3, 1.15], fk); roll += 0.9 * fk; headX += 0.3 * fk; this.idleLook *= 1 - fk; }
        else { const up = ss(fk * 1.6), p = [-2.9 * up, 0, 0.15 + 0.4 * (1 - up), 0.15 + 0.3 * (1 - up)]; aR = mix(aR, p, fk); aL = mix(aL, p, fk); tX -= 0.12 * fk; headX -= 0.2 * fk; }
      }
    } else { this.idleLook = 0; this.idleSway = 0; }
    // ---- pulo em 4 fases: impulso, subida (joelho pra cima), topo (encolhe) e descida (pernas se preparam) ----
    this.airK = E(this.airK || 0, s.air ? 1 : 0, s.air ? 16 : 20);
    if (s.air && !this.wasAir) this.jumpT = 0;                           // acabou de sair do chão
    this.wasAir = !!s.air;
    this.jumpT = (this.jumpT === undefined ? 9 : this.jumpT) + dt;
    let air = null;
    if (this.airK > 0.01) {
      const vy = s.vy || 0, a = this.airK;
      const rise = cl(vy / 8, 0, 1), fallK = cl(-vy / 9, 0, 1), apex = 1 - Math.max(rise, fallK);
      const kick = this.jumpT < 0.18 ? bell(this.jumpT / 0.18) : 0;     // estica o corpo logo no impulso
      air = {
        a, fallK,
        tR: -0.15 * kick + L(L(-0.95, -1.1, rise), -0.4, fallK), kR: L(L(1.4, 1.2, rise), 0.45, fallK) * (1 - kick * 0.6),
        tL: 0.3 * kick + L(L(-0.5, 0.1, rise), -0.12, fallK), kL: L(L(1.3, 0.75, rise), 0.3, fallK) * (1 - kick * 0.6),
      };
      this.hips.position.y += (0.05 * apex - 0.03 * kick) * a;           // encolhe no topo
      tX = L(tX, -0.12 * kick + 0.16 * apex + L(0.05, -0.06, fallK), a);  // tronco: arqueia no impulso, curva no topo
      headX += (-0.12 * kick + 0.12 * fallK) * a;                         // olha pro chão chegando
      if (!aiming && !(this.punchT > 0)) {
        const up = [-2.55 + 0.5 * apex, 0, 0.35, 0.5], side = [-0.3, 0, 1.15, 0.35], tuck = [-1.25, 0, 0.3, 1.1];
        const pose = mix(mix(up, tuck, apex), side, fallK);
        if (s.armed) { aL = mix(aL, [pose[0] * 0.4, 0, pose[2] * 0.6, pose[3]], a * 0.6); ikW *= 1 - a * 0.6; }
        else { aR = mix(aR, pose, a); aL = mix(aL, [pose[0] - 0.1, 0, pose[2], pose[3]], a); }
      }
    }
    // ---- aplica suavizando (sem saltos entre poses) ----
    this._aR = this._aR || [0, 0, 0.1, 0.2, 0]; this._aL = this._aL || [0, 0, 0.1, 0.2, 0]; this._t = this._t || [0, 0];
    for (let i = 0; i < 5; i++) { this._aR[i] = E(this._aR[i], aR[i] || 0, 16); this._aL[i] = E(this._aL[i], aL[i] || 0, 16); }
    this._t[0] = E(this._t[0], tX, 12); this._t[1] = E(this._t[1], tY, 14);
    this._ikW = E(this._ikW || 0, this.gun ? ikW : 0, 18);
    this._toMag = E(this._toMag || 0, toMag, 20);
    this.hips.rotation.z = E(this.hips.rotation.z, this.leanK + (this.idleSway || 0), 10);
    // aditivos rápidos (não suavizados): recuo e reação a dano
    this.recoilT = Math.max(0, this.recoilT - dt * 8);
    this.hitT = Math.max(0, (this.hitT || 0) - dt * 4);
    const rk = aiming ? this.recoilT : 0, hk = this.hitT * this.hitT;
    // recuo: o antebraço sobe e o ombro vai pra trás (o cano sobe sem o braço inteiro "pular")
    this.setArm(-1, [this._aR[0] + rk * 0.05 + hk * 0.25, this._aR[1], this._aR[2], this._aR[3] + rk * 0.18, this._aR[4]]);
    this.setArm(1, [this._aL[0] + hk * 0.2, this._aL[1], this._aL[2], this._aL[3] + rk * 0.1, this._aL[4]]);
    this.torso.rotation.set(this._t[0] - hk * 0.28, this._t[1], (this.hitSide || 0) * 0.14 * hk);
    this._look = E(this._look || 0, this.idleLook || 0, 4);
    this.headG.rotation.set(-pitch * 0.6 - this.torso.rotation.x * 0.6 + headX + hk * 0.35, -this._t[1] * 0.6 + this._look, 0);
    // arma: recuo visual (chute pra trás e cano sobe) e giro durante recarga/troca
    if (this.gun) { this.gun.position.set(0, rk * 0.045, 0); this.gun.rotation.set(Math.PI / 2 - rk * 0.12, 0, 0); }
    this.gunHolder.rotation.y = E(this.gunHolder.rotation.y, roll, 12);
    // ---- pernas: IK no chão; no ar, pose do pulo ----
    const hipY = this.hips.position.y;
    this.solveLeg(-1, fR, lR, hipY, spread); this.solveLeg(1, fL, lL, hipY, spread);
    if (air) {
      const a = air.a, sp = L(0.04, 0.14, air.fallK);
      for (const [side, th, kn] of [[-1, air.tR, air.kR], [1, air.tL, air.kL]]) {
        const u = side > 0 ? this.legL : this.legR, l = side > 0 ? this.shinL : this.shinR, f = side > 0 ? this.footL : this.footR;
        u.rotation.x = L(u.rotation.x, th, a); u.rotation.z = L(u.rotation.z, side > 0 ? sp : -sp, a);
        l.rotation.x = L(l.rotation.x, kn, a); f.rotation.x = L(f.rotation.x, -(th + kn) * 0.5, a);
      }
    }
    // ---- mão esquerda: IK até a arma (guarda-mão, bomba, pente ou janela de munição) ----
    if (this._ikW > 0.01 && this.gun) {
      const G = this.gunPoints(this.gunId), pt = this._ikPt || (this._ikPt = new THREE.Vector3());
      this.gripPoint(pt);
      if (ikMode === 'mag' && G.mag) pt.lerp(G.mag, this._toMag);
      else if (ikMode === 'port') pt.lerp(G.port, this._toMag);
      this.gripLeft(this._ikW, pt);
    }
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
// pedaços de cada osso: [osso, parte do atlas, linha inicial, linha final, pivô, recuo] (linhas em pixels, de cima pra baixo)
// recuo: cada peça de baixo é um tiquinho mais fina que a de cima (em pixels, por lado). Assim, quando o cotovelo,
// o joelho ou a cintura dobram, os lados das duas peças nunca ficam no mesmo plano (sem z-fighting)
LS.CharacterModel.PIECES = [
  ['Hips', 'body', 7, 12, 'bottom', 0.25], ['Spine', 'body', 0, 7, 'bottom', 0.1], ['Head', 'head', 0, 8, 'bottom', 0],
  ['RightArm', 'arm', 0, 5, 'top', 0], ['RightForeArm', 'arm', 5, 10, 'top', 0.15], ['RightHand', 'arm', 10, 12, 'top', 0.3],
  ['LeftArm', 'arm', 0, 5, 'top', 0], ['LeftForeArm', 'arm', 5, 10, 'top', 0.15], ['LeftHand', 'arm', 10, 12, 'top', 0.3],
  ['RightUpLeg', 'leg', 0, 6, 'top', 0], ['RightLeg', 'leg', 6, 11, 'top', 0.15], ['RightFoot', 'leg', 11, 12, 'top', 0.3],
  ['LeftUpLeg', 'leg', 0, 6, 'top', 0], ['LeftLeg', 'leg', 6, 11, 'top', 0.15], ['LeftFoot', 'leg', 11, 12, 'top', 0.3]];
// corrida armada: braço direito [inclinação, giro, abertura, cotovelo] (a mão esquerda segura a arma pela IK)
LS.CharacterModel.CARRY = { R: [-0.5, 0, -0.32, 1.05], gun: -0.65, swing: 0.06 };
// junta os 15 pedaços numa geometria só, com peso 1 no osso de cada pedaço (igual para todos os personagens)
LS.CharacterModel.skinGeometry = function (model) {
  if (this._skinGeo) return this._skinGeo;
  const pos = [], nor = [], uv = [], idx = [], si = [], sw = [], wp = new THREE.Vector3();
  for (const [bone, part, y0, y1, pivot, inset] of this.PIECES) {
    const g = LS.Skin.slice(part, y0, y1, pivot), bi = this.BONES.indexOf(bone), base = pos.length / 3;
    const [, , w, , d] = LS.Skin.PARTS[part], kx = (w - 2 * inset) / w, kz = (d - 2 * inset) / d;
    model.bones[bone].getWorldPosition(wp).sub(model.root.position);
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i) * kx + wp.x, P.getY(i) + wp.y, P.getZ(i) * kz + wp.z); nor.push(N.getX(i), N.getY(i), N.getZ(i)); uv.push(U.getX(i), U.getY(i));
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
