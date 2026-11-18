// Geração procedural do mapa. Só dados puros (sem Three.js), para rodar em qualquer thread.
// Main usa para montar o visual, o Worker de física para os colisores e o de IA para a navmesh.
import { WORLD } from '../config/settings.js';
import { createRng } from './rng.js';

let cache = null;

/** Retorna o mundo gerado (memoizado por thread). */
export function generateWorld() {
  if (cache) return cache;
  const rng = createRng(WORLD.seed);
  const half = WORLD.size / 2;
  const buildings = [];

  // Prédios: caixas alinhadas aos eixos (colisão e navmesh simples).
  for (let tries = 0; buildings.length < WORLD.buildings && tries < 500; tries++) {
    const w = rng.range(10, 22), d = rng.range(10, 22), h = rng.range(6, 24);
    const x = rng.range(-half + 30, half - 30), z = rng.range(-half + 30, half - 30);
    if (Math.hypot(x, z) < 25) continue; // área livre no centro (spawn do jogador)
    const ok = buildings.every((b) => Math.abs(b.x - x) > (b.w + w) / 2 + 8 || Math.abs(b.z - z) > (b.d + d) / 2 + 8);
    if (ok) buildings.push({ x, z, w, d, h });
  }

  const blocked = (x, z, margin) => buildings.some(
    (b) => Math.abs(b.x - x) < b.w / 2 + margin && Math.abs(b.z - z) < b.d / 2 + margin,
  );

  // Props por chunk: facilita carregar/descarregar o visual por chunk.
  const chunksPerSide = WORLD.size / WORLD.chunkSize;
  const chunks = [];
  for (let cz = 0; cz < chunksPerSide; cz++) {
    for (let cx = 0; cx < chunksPerSide; cx++) {
      const x0 = -half + cx * WORLD.chunkSize, z0 = -half + cz * WORLD.chunkSize;
      const pick = (margin) => {
        for (let i = 0; i < 10; i++) {
          const x = x0 + rng.next() * WORLD.chunkSize, z = z0 + rng.next() * WORLD.chunkSize;
          if (!blocked(x, z, margin) && Math.hypot(x, z) > 12) return { x, z };
        }
        return null;
      };
      const trees = [], rocks = [], crates = [];
      for (let i = 0; i < WORLD.treesPerChunk; i++) {
        const p = pick(3); if (p) trees.push({ ...p, s: rng.range(0.8, 1.5), rot: rng.next() * Math.PI * 2 });
      }
      for (let i = 0; i < WORLD.rocksPerChunk; i++) {
        const p = pick(2); if (p) rocks.push({ ...p, s: rng.range(0.6, 2.2), rot: rng.next() * Math.PI * 2 });
      }
      for (let i = 0; i < WORLD.cratesPerChunk; i++) {
        const p = pick(2); if (p) crates.push({ ...p, rot: rng.next() * Math.PI * 2 });
      }
      chunks.push({ cx, cz, x0, z0, trees, rocks, crates });
    }
  }

  // Veículos perto do centro, em pontos livres.
  const vehicles = [];
  for (let i = 0; i < WORLD.vehicles; i++) {
    const a = (i / WORLD.vehicles) * Math.PI * 2;
    vehicles.push({ x: Math.cos(a) * 14, z: Math.sin(a) * 14, yaw: a + Math.PI / 2 });
  }

  // Pontos de spawn espalhados pelo mapa (bots).
  const spawns = [];
  while (spawns.length < 64) {
    const x = rng.range(-half + 20, half - 20), z = rng.range(-half + 20, half - 20);
    if (!blocked(x, z, 4)) spawns.push({ x, z });
  }

  cache = { half, buildings, chunks, chunksPerSide, vehicles, spawns, blocked };
  return cache;
}

/**
 * Raio contra obstáculos sólidos (prédios = AABB, árvores = cilindro aproximado em 2D+altura).
 * Usado no hitscan para paredes bloquearem tiros sem ida e volta ao Worker.
 * Retorna a distância do primeiro impacto ou Infinity.
 */
export function rayObstacles(world, ox, oy, oz, dx, dy, dz, maxDist) {
  let best = maxDist;
  for (const b of world.buildings) {
    const t = rayAabb(ox, oy, oz, dx, dy, dz,
      b.x - b.w / 2, 0, b.z - b.d / 2, b.x + b.w / 2, b.h, b.z + b.d / 2);
    if (t < best) best = t;
  }
  // Árvores: só testa chunks atravessados pelo raio (grade grosseira).
  const cs = WORLD.chunkSize;
  const steps = Math.ceil(best / (cs * 0.5));
  const seen = new Set();
  for (let i = 0; i <= steps; i++) {
    const d = Math.min(best, i * cs * 0.5);
    const cx = Math.floor((ox + dx * d + world.half) / cs), cz = Math.floor((oz + dz * d + world.half) / cs);
    for (let jz = -1; jz <= 1; jz++) for (let jx = -1; jx <= 1; jx++) {
      const x = cx + jx, z = cz + jz;
      if (x < 0 || z < 0 || x >= world.chunksPerSide || z >= world.chunksPerSide) continue;
      const k = z * world.chunksPerSide + x;
      if (seen.has(k)) continue;
      seen.add(k);
      for (const t of world.chunks[k].trees) {
        const hit = rayCircle(ox, oz, dx, dz, t.x, t.z, 0.35 * t.s);
        if (hit < best && oy + dy * hit < 8 * t.s) best = hit;
      }
    }
  }
  if (dy < 0) { const tg = -oy / dy; if (tg < best) best = tg; } // chão
  return best;
}

function rayAabb(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = Infinity;
  const axes = [[ox, dx, x0, x1], [oy, dy, y0, y1], [oz, dz, z0, z1]];
  for (const [o, d, a, b] of axes) {
    if (Math.abs(d) < 1e-8) { if (o < a || o > b) return Infinity; continue; }
    let t1 = (a - o) / d, t2 = (b - o) / d;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

function rayCircle(ox, oz, dx, dz, cx, cz, r) {
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return Infinity;
  const ux = dx / len, uz = dz / len;
  const px = cx - ox, pz = cz - oz;
  const proj = px * ux + pz * uz;
  if (proj < 0) return Infinity;
  const d2 = px * px + pz * pz - proj * proj;
  if (d2 > r * r) return Infinity;
  return (proj - Math.sqrt(r * r - d2)) / len; // converte de volta para o parâmetro do raio 3D
}
