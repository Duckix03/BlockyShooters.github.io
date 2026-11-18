// Efeitos com object pooling + InstancedMesh: traçantes de bala e partículas de impacto.
// Tudo pré-alocado; spawn/update não criam objetos.
import * as THREE from 'three';
import { Pool } from '../core/pool.js';

const MAX_TRACERS = 256;
const MAX_PARTICLES = 512;
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _dir = new THREE.Vector3(), FWD = new THREE.Vector3(0, 0, 1);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export class Effects {
  constructor(scene) {
    // Traçantes: caixa fina esticada ao longo da direção do tiro
    const tracerGeo = new THREE.BoxGeometry(0.04, 0.04, 1);
    this.tracerMesh = new THREE.InstancedMesh(tracerGeo,
      new THREE.MeshBasicMaterial({ color: 0xffe08a }), MAX_TRACERS);
    this.tracerMesh.frustumCulled = false;
    this.tracerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tracers = new Pool(() => ({ x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, len: 0, traveled: 0, max: 0 }), MAX_TRACERS);

    // Partículas: cubinhos com gravidade
    const pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    this.particleMesh = new THREE.InstancedMesh(pGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_PARTICLES);
    this.particleMesh.frustumCulled = false;
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.setColorAt(0, new THREE.Color());
    this.particles = new Pool(() => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }), MAX_PARTICLES);
    this._color = new THREE.Color();

    for (let i = 0; i < MAX_TRACERS; i++) this.tracerMesh.setMatrixAt(i, HIDDEN);
    for (let i = 0; i < MAX_PARTICLES; i++) this.particleMesh.setMatrixAt(i, HIDDEN);
    scene.add(this.tracerMesh, this.particleMesh);
  }

  /** Traçante visual (o acerto já foi resolvido por hitscan). */
  tracer(ox, oy, oz, ex, ey, ez) {
    const i = this.tracers.acquire();
    if (i === null) return;
    const t = this.tracers.items[i];
    const dx = ex - ox, dy = ey - oy, dz = ez - oz, d = Math.hypot(dx, dy, dz) || 1;
    t.x = ox; t.y = oy; t.z = oz; t.dx = dx / d; t.dy = dy / d; t.dz = dz / d;
    t.max = d; t.traveled = 0; t.len = Math.min(3, d);
  }

  /** Faísca/sangue no ponto de impacto. */
  burst(x, y, z, hex, count = 8) {
    this._color.setHex(hex);
    for (let n = 0; n < count; n++) {
      const i = this.particles.acquire();
      if (i === null) return;
      const p = this.particles.items[i];
      p.x = x; p.y = y; p.z = z;
      p.vx = (Math.random() - 0.5) * 6; p.vy = Math.random() * 5; p.vz = (Math.random() - 0.5) * 6;
      p.life = 0.35 + Math.random() * 0.3;
      this.particleMesh.setColorAt(i, this._color);
    }
    this.particleMesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const SPEED = 400;
    const tp = this.tracers;
    for (let i = 0; i < tp.items.length; i++) {
      if (!tp.active[i]) continue;
      const t = tp.items[i];
      t.traveled += SPEED * dt;
      if (t.traveled >= t.max) { tp.release(i); this.tracerMesh.setMatrixAt(i, HIDDEN); continue; }
      const head = Math.min(t.traveled, t.max), tail = Math.max(0, head - t.len), mid = (head + tail) / 2;
      _p.set(t.x + t.dx * mid, t.y + t.dy * mid, t.z + t.dz * mid);
      _q.setFromUnitVectors(FWD, _dir.set(t.dx, t.dy, t.dz));
      _s.set(1, 1, head - tail);
      this.tracerMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    this.tracerMesh.instanceMatrix.needsUpdate = true;

    const pp = this.particles;
    _q.identity();
    for (let i = 0; i < pp.items.length; i++) {
      if (!pp.active[i]) continue;
      const p = pp.items[i];
      p.life -= dt;
      if (p.life <= 0) { pp.release(i); this.particleMesh.setMatrixAt(i, HIDDEN); continue; }
      p.vy -= 15 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; }
      _p.set(p.x, p.y, p.z); _s.setScalar(Math.min(1, p.life * 3));
      this.particleMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
  }

  get activeCount() { return this.tracers.activeCount + this.particles.activeCount; }
}
