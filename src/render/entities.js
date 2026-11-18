// Visual dos veículos (personagens ficam em characters.js) com interpolação entre snapshots da física.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  CHARACTER_COUNT, ENTITY_COUNT, F, FLAG_ALIVE, slotOffset,
} from '../core/layout.js';

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();

function tinted(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

export class EntitiesView {
  constructor(scene) {
    this.scene = scene;
    this.mat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.7 });
    this.objects = [];
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

  /** Interpola posição/rotação entre o snapshot anterior e o atual (alpha do passo fixo). */
  update(prev, curr, alpha) {
    for (let i = CHARACTER_COUNT; i < ENTITY_COUNT; i++) {
      const o = slotOffset(i), obj = this.objects[i - CHARACTER_COUNT];
      const flags = curr[o + F.FLAGS] | 0;
      obj.visible = (flags & FLAG_ALIVE) !== 0;
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
    }
  }
}
