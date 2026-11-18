// Personagens "blocky" articulados e animados, desenhados com InstancedMesh:
// 1 InstancedMesh por parte do corpo (cabeça, tronco, braços, coxas, canelas...) para TODOS
// os personagens => ~11 draw calls no total, não importa quantos bots.
// Animação procedural na CPU (andar, mirar, agachar, morrer). LOD: longe da câmera a animação
// roda a cada 4 frames e peças pequenas (visor, arma, mochila) somem.
import * as THREE from 'three/webgpu';
import {
  CHARACTER_COUNT, F, FLAG_ALIVE, FLAG_CROUCH, FLAG_GROUNDED, FLAG_IN_VEHICLE, PLAYER_SLOT, slotOffset,
} from '../core/layout.js';

// Medidas (metros). Pés na origem, personagem olhando para -Z.
const THIGH = 0.36, SHIN = 0.36, HIP_H = THIGH + SHIN; // 0.72
const TORSO_H = 0.62, HEAD = 0.42, ARM = 0.6;
const LOD_DIST = 55;

const SHIRTS = [0xd9473b, 0xe08a2e, 0x8e44ad, 0x16a085, 0xc0392b, 0x7f8c8d, 0xd4ac0d, 0x6d4c41];
const PANTS = [0x2d3436, 0x34495e, 0x4e342e, 0x283747];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

// Temporários (zero alocação no update)
const _root = new THREE.Matrix4(), _m = new THREE.Matrix4(), _t = new THREE.Matrix4(), _r = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _c = new THREE.Color();

/** Caixa com o pivô (articulação) no topo: o membro "pendura" do ponto de rotação. */
const hanging = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0);

export class CharactersView {
  constructor(scene) {
    // Lambert: bem mais barato por pixel que o PBR (Standard) e combina com o visual blocky
    const mat = (opts = {}) => new THREE.MeshLambertNodeMaterial(opts);
    const part = (geo, material, shadow, colored = true) => {
      const m = new THREE.InstancedMesh(geo, material, CHARACTER_COUNT);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = shadow;
      m.frustumCulled = false;
      if (colored) m.setColorAt(0, _c.set(0xffffff));
      scene.add(m);
      return m;
    };
    const base = mat();
    this.parts = {
      torso: part(new THREE.BoxGeometry(0.62, TORSO_H, 0.34).translate(0, TORSO_H / 2, 0), base, true),
      belt: part(new THREE.BoxGeometry(0.64, 0.08, 0.36).translate(0, 0.04, 0), mat({ color: 0x222222 }), false, false),
      head: part(new THREE.BoxGeometry(HEAD, HEAD, HEAD).translate(0, HEAD / 2, 0), base, true),
      visor: part(new THREE.BoxGeometry(HEAD * 0.82, 0.11, 0.04).translate(0, HEAD * 0.58, -HEAD / 2 - 0.01),
        mat({ color: 0x111820 }), false, false),
      helmet: part(new THREE.BoxGeometry(HEAD + 0.06, 0.14, HEAD + 0.06).translate(0, HEAD - 0.02, 0), base, false),
      pack: part(new THREE.BoxGeometry(0.44, 0.42, 0.18).translate(0, TORSO_H * 0.55, 0.25), mat({ color: 0x4b5320 }), false, false),
      armL: part(hanging(0.2, ARM, 0.2), base, true),
      armR: part(hanging(0.2, ARM, 0.2), base, true),
      thighL: part(hanging(0.25, THIGH, 0.25), base, true),
      thighR: part(hanging(0.25, THIGH, 0.25), base, true),
      shinL: part(hanging(0.24, SHIN, 0.24), base, true),
      shinR: part(hanging(0.24, SHIN, 0.24), base, true),
      gun: part(new THREE.BoxGeometry(0.1, 0.16, 0.75).translate(0, 0, -0.2), mat({ color: 0x1e1e1e }), false, false),
    };

    // Estado de animação por personagem
    this.anim = Array.from({ length: CHARACTER_COUNT }, () => ({
      phase: 0, speed: 0, crouch: 0, lastX: 0, lastZ: 0, init: false, deathT: -1, frame: 0, air: 0,
    }));
    this._applyColors();
    // Começa tudo invisível (o padrão do InstancedMesh é identidade = todos empilhados na origem)
    for (let i = 0; i < CHARACTER_COUNT; i++) this._hide(i);
  }

  /** Cores por instância: jogador azul, bots com camisetas/calças/pele variadas. */
  _applyColors() {
    const P = this.parts;
    for (let i = 0; i < CHARACTER_COUNT; i++) {
      const shirt = i === PLAYER_SLOT ? 0x2c7be5 : SHIRTS[i % SHIRTS.length];
      const pants = i === PLAYER_SLOT ? 0x1f2a44 : PANTS[(i * 3) % PANTS.length];
      const skin = SKINS[(i * 7) % SKINS.length];
      P.torso.setColorAt(i, _c.set(shirt));
      P.helmet.setColorAt(i, _c.set(shirt).multiplyScalar(0.7));
      P.head.setColorAt(i, _c.set(skin));
      P.armL.setColorAt(i, _c.set(shirt)); P.armR.setColorAt(i, _c.set(shirt));
      for (const k of ['thighL', 'thighR']) P[k].setColorAt(i, _c.set(pants));
      for (const k of ['shinL', 'shinR']) P[k].setColorAt(i, _c.set(pants).multiplyScalar(0.75));
    }
    for (const m of Object.values(P)) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }

  /** Chamado pelo Game quando alguém morre: dispara a animação de queda. */
  onDeath(slot) { this.anim[slot].deathT = 0; }
  onRespawn(slot) { const a = this.anim[slot]; a.deathT = -1; a.init = false; }

  setQuality(preset) { this.lodDist = LOD_DIST * preset.lodBias; }

  /**
   * @param aimPitch  pitch da mira do jogador (os bots miram reto)
   */
  update(prev, curr, alpha, dt, camera, aimPitch) {
    const P = this.parts, lod2 = (this.lodDist ?? LOD_DIST) ** 2;
    const cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < CHARACTER_COUNT; i++) {
      const o = slotOffset(i), a = this.anim[i];
      const flags = curr[o + F.FLAGS] | 0;
      const alive = (flags & FLAG_ALIVE) !== 0;
      if (!alive && a.deathT < 0) a.deathT = 1.5; // morreu sem evento (ex.: começo) -> já some
      if (alive && a.deathT >= 0) a.deathT = -1;
      if (!alive) a.deathT += dt;
      const hidden = (i === PLAYER_SLOT && (flags & FLAG_IN_VEHICLE)) || (!alive && a.deathT > 2.5);
      if (hidden) { this._hide(i); continue; }

      // Posição/rotação interpoladas entre os snapshots da física
      // Teleporte (respawn): mais de 4 m entre snapshots não é movimento, não interpola
      const k = Math.abs(curr[o] - prev[o]) + Math.abs(curr[o + 2] - prev[o + 2]) > 4 ? 1 : alpha;
      const x = prev[o] + (curr[o] - prev[o]) * k;
      const y = prev[o + 1] + (curr[o + 1] - prev[o + 1]) * k;
      const z = prev[o + 2] + (curr[o + 2] - prev[o + 2]) * k;
      if (k === 1) a.init = false; // não conta o salto como velocidade
      _qa.set(0, prev[o + 4], 0, prev[o + 6]);
      _qb.set(0, curr[o + 4], 0, curr[o + 6]);
      if (_qa.lengthSq() < 0.5) _qa.copy(_qb);
      _q.slerpQuaternions(_qa, _qb, alpha);

      // Velocidade horizontal medida pelo deslocamento renderizado (suavizada)
      if (!a.init) { a.lastX = x; a.lastZ = z; a.init = true; }
      const v = dt > 0 ? Math.hypot(x - a.lastX, z - a.lastZ) / dt : 0;
      a.lastX = x; a.lastZ = z;
      a.speed += (Math.min(v, 10) - a.speed) * Math.min(1, dt * 10);
      const crouchTarget = flags & FLAG_CROUCH ? 1 : 0;
      a.crouch += (crouchTarget - a.crouch) * Math.min(1, dt * 12);
      a.air += (((flags & FLAG_GROUNDED) ? 0 : 1) - a.air) * Math.min(1, dt * 8);

      // LOD: longe, anima só a cada 4 frames e esconde peças pequenas
      const far = (x - cx) ** 2 + (z - cz) ** 2 > lod2;
      if (far && (a.frame++ & 3) !== 0 && alive) continue;

      a.phase += a.speed * dt * (far ? 4 : 1) * 2.1;
      _root.compose(_p.set(x, y, z), _q, _one);
      if (!alive) this._dying(a);
      this._pose(i, a, i === PLAYER_SLOT ? aimPitch : 0, far);
    }
    for (const m of Object.values(P)) m.instanceMatrix.needsUpdate = true;
  }

  /** Queda para trás ao morrer (gira o personagem inteiro em torno dos pés). */
  _dying(a) {
    const k = Math.min(1, a.deathT / 0.45);
    _r.makeRotationX(k * k * Math.PI / 2);
    _root.multiply(_r);
  }

  _hide(i) { for (const m of Object.values(this.parts)) m.setMatrixAt(i, ZERO); }

  /** Monta a pose: cada parte = raiz * deslocamento até a articulação * rotação da articulação. */
  _pose(i, a, pitch, far) {
    const P = this.parts, c = a.crouch;
    const walk = Math.min(1, a.speed / 5);
    const s = Math.sin(a.phase);
    const swing = s * 0.7 * walk * (1 - c * 0.5);

    // Pernas: agachar dobra coxa para frente e canela para trás (pés ficam sob o quadril)
    const bend = 1.1 * c;
    const hipY = THIGH * Math.cos(bend) + SHIN * Math.cos(bend) - a.air * 0.05;
    const legL = swing + a.air * 0.4, legR = -swing - a.air * 0.2;
    // Convenção: rotação X positiva leva a ponta do membro para frente (-Z); joelho dobra para trás (negativo)
    this._limb(P.thighL, P.shinL, i, -0.15, hipY, legL + bend, -(Math.max(0, -s) * 0.9 * walk + 2 * bend));
    this._limb(P.thighR, P.shinR, i, 0.15, hipY, legR + bend, -(Math.max(0, s) * 0.9 * walk + 2 * bend));

    // Tronco (inclina para frente ao agachar) e cabeça
    const lean = 0.25 * c + 0.06 * walk;
    _t.makeTranslation(0, hipY, 0); _r.makeRotationX(-lean);
    const torso = _m.multiplyMatrices(_root, _t).multiply(_r); // matriz do quadril
    P.torso.setMatrixAt(i, torso);
    P.belt.setMatrixAt(i, torso);
    P.pack.setMatrixAt(i, far ? ZERO : torso);
    const hipMat = this._tmpHip.copy(torso);

    // Pescoço: a cabeça acompanha a mira
    _t.makeTranslation(0, TORSO_H + 0.02, 0); _r.makeRotationX(pitch * 0.6 + lean);
    _m.copy(hipMat).multiply(_t).multiply(_r);
    P.head.setMatrixAt(i, _m);
    P.helmet.setMatrixAt(i, _m);
    P.visor.setMatrixAt(i, far ? ZERO : _m);

    // Braços em posição de tiro: direito segura a arma, esquerdo apoia na frente
    const aim = Math.PI / 2 + pitch + lean; // braço apontando para frente, compensando a inclinação
    const bob = Math.sin(a.phase * 2) * 0.04 * walk;
    _t.makeTranslation(0.4, TORSO_H - 0.06, 0); _r.makeRotationX(aim + bob);
    _m.copy(hipMat).multiply(_t).multiply(_r);
    _r.makeRotationZ(-0.12); _m.multiply(_r);
    P.armR.setMatrixAt(i, _m);
    // Arma na mão direita (ponta do braço), apontando para frente
    _t.makeTranslation(-0.05, -ARM + 0.05, 0.08); _r.makeRotationX(-Math.PI / 2);
    _m.multiply(_t).multiply(_r);
    P.gun.setMatrixAt(i, far ? ZERO : _m);
    _t.makeTranslation(-0.4, TORSO_H - 0.06, 0); _r.makeRotationX(aim + 0.15 - bob);
    _m.copy(hipMat).multiply(_t).multiply(_r);
    _r.makeRotationZ(0.45); _m.multiply(_r); // fecha o braço em direção à arma
    P.armL.setMatrixAt(i, _m);
  }

  /** Perna em 2 segmentos: coxa gira no quadril, canela gira no joelho. */
  _limb(thighMesh, shinMesh, i, side, hipY, thighRot, kneeBend) {
    _t.makeTranslation(side, hipY, 0); _r.makeRotationX(thighRot);
    _m.multiplyMatrices(_root, _t).multiply(_r);
    thighMesh.setMatrixAt(i, _m);
    _t.makeTranslation(0, -THIGH, 0); _r.makeRotationX(kneeBend);
    _m.multiply(_t).multiply(_r);
    shinMesh.setMatrixAt(i, _m);
  }

  get _tmpHip() { return this.__hip ??= new THREE.Matrix4(); }
}
