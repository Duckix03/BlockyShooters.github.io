// Visual do mapa: terreno com shader TSL, props instanciados com carga por chunk,
// prédios com LOD e a parede da zona.
import * as THREE from 'three/webgpu';
import {
  color, mix, mx_noise_float, positionWorld, smoothstep, time, sin, float,
} from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD } from '../config/settings.js';
import { generateWorld } from '../core/worldgen.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Pinta uma geometria com uma cor por vértice (para juntar várias peças em 1 draw call). */
function tint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

export class WorldView {
  constructor(scene) {
    this.scene = scene;
    this.gen = generateWorld();
    this.loaded = new Set();     // chunks visíveis no momento
    this.centerChunk = -1;
    this.viewChunks = 2;
    this.lodBias = 1;
    this.vertexMat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.9 });
    this._buildTerrain();
    this._buildProps();
    this._buildBuildings();
    this._buildZone();
  }

  _buildTerrain() {
    const size = WORLD.size;
    const geo = new THREE.PlaneGeometry(size, size, 1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardNodeMaterial({ roughness: 1 });
    // Shader TSL: mistura grama/terra por ruído em coordenadas de mundo (sem textura = zero download).
    const big = mx_noise_float(positionWorld.xz.mul(0.035)).mul(0.5).add(0.5);
    const detail = mx_noise_float(positionWorld.xz.mul(0.6)).mul(0.07).add(1);
    const grass = mix(color(0x3f6f24), color(0x5c8a2e), mx_noise_float(positionWorld.xz.mul(0.12)).mul(0.5).add(0.5));
    mat.colorNode = mix(grass, color(0x7d6b46), smoothstep(0.62, 0.8, big)).mul(detail);
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /**
   * Props instanciados: 1 InstancedMesh por tipo para o mapa todo (poucos draw calls).
   * As matrizes ficam pré-calculadas por chunk; ao mudar de chunk só copiamos os blocos
   * dos chunks próximos para o buffer de instâncias e ajustamos o `count`.
   */
  _buildProps() {
    const total = (k) => this.gen.chunks.reduce((n, c) => n + c[k].length, 0);
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 6).translate(0, 1.5, 0);
    const leafGeo = mergeGeometries([
      new THREE.ConeGeometry(2, 3.5, 7).translate(0, 4, 0),
      new THREE.ConeGeometry(1.5, 3, 7).translate(0, 5.8, 0),
    ]);
    const rockGeo = new THREE.DodecahedronGeometry(0.8, 0);
    const crateGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2).translate(0, 0.6, 0);

    const mk = (geo, hex, count, shadow) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardNodeMaterial({ color: hex, roughness: 0.9 }), count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = shadow; m.receiveShadow = true;
      m.frustumCulled = false; // o conjunto carregado cerca a câmera; culling por chunk é feito na carga
      m.count = 0;
      this.scene.add(m);
      return m;
    };
    this.props = {
      trunk: mk(trunkGeo, 0x6b4a2b, total('trees'), true),
      leaf: mk(leafGeo, 0x2f5d22, total('trees'), true),
      rock: mk(rockGeo, 0x8a8a84, total('rocks'), true),
      crate: mk(crateGeo, 0xb5832f, total('crates'), true),
    };

    // Matrizes por chunk (calculadas uma vez)
    this.chunkMats = this.gen.chunks.map((c) => {
      const trees = new Float32Array(c.trees.length * 16);
      c.trees.forEach((t, i) => {
        _q.setFromAxisAngle(UP, t.rot); _s.setScalar(t.s); _p.set(t.x, 0, t.z);
        _m.compose(_p, _q, _s).toArray(trees, i * 16);
      });
      const rocks = new Float32Array(c.rocks.length * 16);
      c.rocks.forEach((r, i) => {
        _q.setFromAxisAngle(UP, r.rot); _s.set(r.s, r.s * 0.6, r.s); _p.set(r.x, 0.2 * r.s, r.z);
        _m.compose(_p, _q, _s).toArray(rocks, i * 16);
      });
      const crates = new Float32Array(c.crates.length * 16);
      c.crates.forEach((k, i) => {
        _q.setFromAxisAngle(UP, k.rot); _s.setScalar(1); _p.set(k.x, 0, k.z);
        _m.compose(_p, _q, _s).toArray(crates, i * 16);
      });
      return { trees, rocks, crates };
    });
  }

  /** Prédios: LOD com versão detalhada (janelas, laje) e versão caixa simples. 1 draw call cada. */
  _buildBuildings() {
    this.buildingLods = [];
    const palette = [0xc9c2b4, 0xa9b4bd, 0xd8c7a0, 0x9e9a92, 0xb7a08a];
    this.gen.buildings.forEach((b, idx) => {
      const wall = palette[idx % palette.length];
      const parts = [tint(new THREE.BoxGeometry(b.w, b.h, b.d).translate(0, b.h / 2, 0), wall)];
      parts.push(tint(new THREE.BoxGeometry(b.w + 0.6, 0.5, b.d + 0.6).translate(0, b.h + 0.25, 0), 0x55504a));
      // Faixas de janelas em cada andar (frente/trás e laterais)
      for (let y = 2; y < b.h - 1; y += 3) {
        parts.push(tint(new THREE.BoxGeometry(b.w * 0.86, 1.1, b.d + 0.08).translate(0, y, 0), 0x34495e));
        parts.push(tint(new THREE.BoxGeometry(b.w + 0.08, 1.1, b.d * 0.86).translate(0, y, 0), 0x34495e));
      }
      const hi = new THREE.Mesh(mergeGeometries(parts), this.vertexMat);
      const lo = new THREE.Mesh(tint(new THREE.BoxGeometry(b.w, b.h, b.d).translate(0, b.h / 2, 0), wall), this.vertexMat);
      for (const m of [hi, lo]) { m.castShadow = true; m.receiveShadow = true; }
      const lod = new THREE.LOD();
      lod.addLevel(hi, 0);
      lod.addLevel(lo, 70);
      lod.position.set(b.x, 0, b.z);
      lod.userData.baseDist = 70;
      this.scene.add(lod);
      this.buildingLods.push(lod);
    });
  }

  /** Parede da zona segura: cilindro transparente animado por TSL. */
  _buildZone() {
    const geo = new THREE.CylinderGeometry(1, 1, 60, 96, 1, true).translate(0, 30, 0);
    const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false });
    mat.colorNode = color(0x3aa0ff);
    mat.opacityNode = sin(positionWorld.y.mul(1.5).sub(time.mul(3))).mul(0.12).add(0.25)
      .mul(float(1).sub(positionWorld.y.div(60)));
    this.zoneMesh = new THREE.Mesh(geo, mat);
    this.zoneMesh.frustumCulled = false;
    this.scene.add(this.zoneMesh);
  }

  setZone(x, z, r) {
    this.zoneMesh.position.set(x, 0, z);
    this.zoneMesh.scale.set(r, 1, r);
  }

  setQuality(preset) {
    this.viewChunks = preset.viewChunks;
    this.lodBias = preset.lodBias;
    for (const lod of this.buildingLods) lod.levels[1].distance = lod.userData.baseDist * this.lodBias;
    this.centerChunk = -1; // força recarregar
  }

  /** Carrega/descarrega chunks ao redor do foco. Só trabalha quando o chunk central muda. */
  update(focus) {
    const g = this.gen, cs = WORLD.chunkSize;
    const cx = Math.floor((focus.x + g.half) / cs), cz = Math.floor((focus.z + g.half) / cs);
    const key = cz * g.chunksPerSide + cx;
    if (key === this.centerChunk) return;
    this.centerChunk = key;
    this.loaded.clear();
    const r = this.viewChunks;
    for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
      if (x >= 0 && z >= 0 && x < g.chunksPerSide && z < g.chunksPerSide) this.loaded.add(z * g.chunksPerSide + x);
    }
    const { trunk, leaf, rock, crate } = this.props;
    let nt = 0, nr = 0, nc = 0;
    for (const k of this.loaded) {
      const m = this.chunkMats[k];
      trunk.instanceMatrix.array.set(m.trees, nt * 16);
      leaf.instanceMatrix.array.set(m.trees, nt * 16);
      rock.instanceMatrix.array.set(m.rocks, nr * 16);
      crate.instanceMatrix.array.set(m.crates, nc * 16);
      nt += m.trees.length / 16; nr += m.rocks.length / 16; nc += m.crates.length / 16;
    }
    trunk.count = leaf.count = nt; rock.count = nr; crate.count = nc;
    for (const p of [trunk, leaf, rock, crate]) p.instanceMatrix.needsUpdate = true;
  }
}
