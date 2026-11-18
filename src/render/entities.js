// Visual das entidades dinâmicas (jogador, bots, veículos) com interpolação entre snapshots da física.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  CHARACTER_COUNT, ENTITY_COUNT, F, FLAG_ALIVE, FLAG_IN_VEHICLE, PLAYER_SLOT, slotOffset,
} from '../core/layout.js';

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();

function tinted(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

/** Personagem detalhado (corpo, cabeça, arma) e versão distante (caixa). */
function characterGeos(bodyHex) {
  const hi = mergeGeometries([
    tinted(new THREE.CapsuleGeometry(0.38, 0.8, 4, 10).translate(0, 0.85, 0), bodyHex),
    tinted(new THREE.SphereGeometry(0.24, 12, 8).translate(0, 1.6, 0), 0xe0b48a),
    tinted(new THREE.BoxGeometry(0.1, 0.12, 0.7).translate(0.28, 1.15, -0.35), 0x222222),
  ]);
  const lo = tinted(new THREE.BoxGeometry(0.7, 1.8, 0.5).translate(0, 0.9, 0), bodyHex);
  return { hi, lo };
}

export class EntitiesView {
  constructor(scene) {
    this.scene = scene;
    this.mat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.7 });
    this.objects = [];
    const playerGeo = characterGeos(0x2c7be5);
    const botGeo = characterGeos(0xd9473b);
    for (let i = 0; i < CHARACTER_COUNT; i++) {
      const g = i === PLAYER_SLOT ? playerGeo : botGeo;
      const lod = new THREE.LOD();
      const hi = new THREE.Mesh(g.hi, this.mat), lo = new THREE.Mesh(g.lo, this.mat);
      hi.castShadow = lo.castShadow = true;
      lod.addLevel(hi, 0); lod.addLevel(lo, 45);
      lod.userData.baseDist = 45;
      scene.add(lod);
      this.objects.push(lod);
    }
    // Veículos: carroceria + cabine + rodas numa única geometria
    const wheels = [];
    for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      wheels.push(tinted(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12).rotateZ(Math.PI / 2).translate(x, -0.45, z), 0x1b1b1b));
    }
    const carGeo = mergeGeometries([
      tinted(new THREE.BoxGeometry(2, 0.7, 4.2).translate(0, 0.1, 0), 0xf2b134),
      tinted(new THREE.BoxGeometry(1.7, 0.6, 2).translate(0, 0.75, -0.3), 0x2e3a46),
      ...wheels,
    ]);
    for (let i = CHARACTER_COUNT; i < ENTITY_COUNT; i++) {
      const m = new THREE.Mesh(carGeo, this.mat);
      m.castShadow = true;
      scene.add(m);
      this.objects.push(m);
    }
  }

  setQuality(preset) {
    for (let i = 0; i < CHARACTER_COUNT; i++) {
      const lod = this.objects[i];
      lod.levels[1].distance = lod.userData.baseDist * preset.lodBias;
    }
  }

  /** Interpola posição/rotação entre o snapshot anterior e o atual (alpha do passo fixo). */
  update(prev, curr, alpha, camera, firstPerson) {
    for (let i = 0; i < ENTITY_COUNT; i++) {
      const o = slotOffset(i), obj = this.objects[i];
      const flags = curr[o + F.FLAGS] | 0;
      obj.visible = (flags & FLAG_ALIVE) !== 0 && !(i === PLAYER_SLOT && ((flags & FLAG_IN_VEHICLE) || firstPerson));
      if (!obj.visible) continue;
      obj.position.set(
        prev[o] + (curr[o] - prev[o]) * alpha,
        prev[o + 1] + (curr[o + 1] - prev[o + 1]) * alpha,
        prev[o + 2] + (curr[o + 2] - prev[o + 2]) * alpha,
      );
      _qa.set(prev[o + 3], prev[o + 4], prev[o + 5], prev[o + 6]);
      _qb.set(curr[o + 3], curr[o + 4], curr[o + 5], curr[o + 6]);
      if (_qa.lengthSq() < 0.5) _qa.copy(_qb); // primeiro frame (snapshot zerado)
      obj.quaternion.slerpQuaternions(_qa, _qb, alpha);
      if (obj.isLOD) obj.update(camera);
    }
  }
}
