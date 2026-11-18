// Worker de IA: navmesh (three-pathfinding) + máquina de estados simples dos bots.
// Lê posições do buffer de estado e escreve intenções (mover/mirar/atirar) no buffer de intenções.
//
// main -> worker: init { state, intents, shared, balance } | think { dt, zone, state?, intents? } | balance
// worker -> main: ready | thought { ms, intents? }
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { Pathfinding } from 'three-pathfinding';
import { WORLD } from '../config/settings.js';
import { generateWorld, rayObstacles } from '../core/worldgen.js';
import {
  CHARACTER_COUNT, F, FIRST_BOT, FLAG_ALIVE, INTENT_STRIDE, PLAYER_SLOT, slotOffset,
} from '../core/layout.js';

const ZONE = 'map';
const pf = new Pathfinding();
let state, intents, shared, balance, gen;
let freeCells; // Uint8Array grade de células livres
let cellsPerSide;

// Estado de cada bot (pré-alocado; zero alocação no think além do findPath)
const bots = [];
const tmpA = new Vector3(), tmpB = new Vector3();

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') init(m);
  else if (m.type === 'think') think(m);
  else if (m.type === 'balance') balance = m.balance;
};

function init(m) {
  ({ state, intents, shared, balance } = m);
  gen = generateWorld();
  buildNavmesh();
  for (let i = FIRST_BOT; i < CHARACTER_COUNT; i++) {
    bots.push({
      slot: i, path: null, pathIdx: 0, repath: Math.random() * 2, mode: 'wander',
      target: -1, seenTime: 0, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0,
      lastX: 0, lastZ: 0, stuck: 0, jump: 0,
    });
  }
  self.postMessage({ type: 'ready' });
}

/** Navmesh em grade: um quad por célula livre (prédios viram buracos). */
function buildNavmesh() {
  const cell = WORLD.navCell;
  cellsPerSide = WORLD.size / cell;
  const n = cellsPerSide + 1;
  freeCells = new Uint8Array(cellsPerSide * cellsPerSide);
  const pos = new Float32Array(n * n * 3);
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const i = (z * n + x) * 3;
    pos[i] = -gen.half + x * cell; pos[i + 1] = 0; pos[i + 2] = -gen.half + z * cell;
  }
  const idx = [];
  for (let z = 0; z < cellsPerSide; z++) for (let x = 0; x < cellsPerSide; x++) {
    const cx = -gen.half + (x + 0.5) * cell, cz = -gen.half + (z + 0.5) * cell;
    if (gen.blocked(cx, cz, cell * 0.5 + 0.6)) continue;
    freeCells[z * cellsPerSide + x] = 1;
    const a = z * n + x, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d); // sentido anti-horário visto de cima
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setIndex(idx);
  pf.setZoneData(ZONE, Pathfinding.createZone(geo));
}

/** Centro da célula livre mais próxima (garante que o ponto está dentro da navmesh). */
function snapToNav(x, z, out) {
  const cell = WORLD.navCell;
  const gx = Math.floor((x + gen.half) / cell), gz = Math.floor((z + gen.half) / cell);
  for (let r = 0; r < 6; r++) {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const cx = gx + dx, cz = gz + dz;
      if (cx < 0 || cz < 0 || cx >= cellsPerSide || cz >= cellsPerSide) continue;
      if (freeCells[cz * cellsPerSide + cx]) {
        return out.set(-gen.half + (cx + 0.5) * cell, 0, -gen.half + (cz + 0.5) * cell);
      }
    }
  }
  return out.set(x, 0, z);
}

// Cache do grupo (ilha) da navmesh por célula: getGroup varre todos os polígonos, então só roda 1x por célula.
const groupCache = new Map();
function groupAt(p) {
  const k = Math.floor((p.z + gen.half) / WORLD.navCell) * cellsPerSide + Math.floor((p.x + gen.half) / WORLD.navCell);
  let g = groupCache.get(k);
  if (g === undefined) { g = pf.getGroup(ZONE, p); groupCache.set(k, g); }
  return g;
}

// Orçamento: no máximo N replanejamentos de caminho por ciclo de IA (espalha o custo entre ciclos).
const MAX_PATHS_PER_THINK = 3;
let pathsThisThink = 0;

function planPath(b, x, z, tx, tz) {
  pathsThisThink++;
  snapToNav(x, z, tmpA);
  snapToNav(tx, tz, tmpB);
  const group = groupAt(tmpA);
  if (group === null) { b.path = null; return; }
  b.path = pf.findPath(tmpA, tmpB, ZONE, group);
  b.pathIdx = 0;
}

function canSee(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > balance.botViewDist) return false;
  const hit = rayObstacles(gen, ax, ay, az, dx / dist, dy / dist, dz / dist, dist);
  return hit >= dist - 0.5;
}

function think(m) {
  const t0 = performance.now();
  if (!shared) { state = m.state; intents = m.intents; }
  const dt = m.dt, zone = m.zone;
  pathsThisThink = 0;

  for (const b of bots) {
    const o = slotOffset(b.slot);
    const io = (b.slot - FIRST_BOT) * INTENT_STRIDE;
    if (!((state[o + F.FLAGS] | 0) & FLAG_ALIVE)) {
      intents[io] = 0; intents[io + 1] = 0; intents[io + 3] = 0; intents[io + 4] = 0;
      continue;
    }
    const x = state[o + F.X], y = state[o + F.Y] + 1.6, z = state[o + F.Z];

    // 1) Procura o alvo visível mais próximo (jogador ou outros bots)
    let best = -1, bestD = Infinity;
    for (let s = PLAYER_SLOT; s < CHARACTER_COUNT; s++) {
      if (s === b.slot) continue;
      const so = slotOffset(s);
      if (!((state[so + F.FLAGS] | 0) & FLAG_ALIVE)) continue;
      const d = Math.hypot(state[so + F.X] - x, state[so + F.Z] - z);
      if (d < bestD && d < balance.botViewDist) { best = s; bestD = d; }
    }
    let visible = false;
    if (best >= 0) {
      const so = slotOffset(best);
      visible = canSee(x, y, z, state[so + F.X], state[so + F.Y] + 1.2, state[so + F.Z]);
    }
    if (visible) {
      if (b.target !== best) { b.target = best; b.seenTime = 0; }
      b.seenTime += dt;
      b.mode = 'fight';
    } else if (b.mode === 'fight') {
      b.seenTime = 0; b.mode = 'wander'; b.repath = 0;
    }

    // 2) Fora da zona: prioridade é voltar
    const outside = Math.hypot(x - zone.x, z - zone.z) > zone.r * 0.9;

    let mx = 0, mz = 0, yaw = intents[io + 2], shoot = 0;
    if (b.mode === 'fight' && !outside) {
      const so = slotOffset(b.target);
      const tx = state[so + F.X], tz = state[so + F.Z];
      const ddx = tx - x, ddz = tz - z, d = Math.hypot(ddx, ddz) || 1;
      yaw = Math.atan2(-ddx, -ddz);
      // Mantém distância média e faz strafe
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafe = -b.strafe; b.strafeT = 0.8 + Math.random() * 1.5; }
      const fwd = d > 25 ? 1 : d < 10 ? -0.6 : 0;
      mx = (ddx / d) * fwd + (-ddz / d) * b.strafe * 0.7;
      mz = (ddz / d) * fwd + (ddx / d) * b.strafe * 0.7;
      shoot = b.seenTime > balance.botReaction ? 1 : 0;
    } else {
      // Patrulha: segue caminho da navmesh até um ponto aleatório dentro da zona
      b.repath -= dt;
      if ((!b.path || b.pathIdx >= b.path.length || b.repath <= 0) && pathsThisThink < MAX_PATHS_PER_THINK) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * zone.r * 0.6;
        planPath(b, x, z, zone.x + Math.cos(a) * r, zone.z + Math.sin(a) * r);
        b.repath = 6 + Math.random() * 6;
      }
      if (b.path && b.pathIdx < b.path.length) {
        const wp = b.path[b.pathIdx];
        const ddx = wp.x - x, ddz = wp.z - z, d = Math.hypot(ddx, ddz);
        if (d < 1.5) b.pathIdx++;
        else { mx = ddx / d; mz = ddz / d; yaw = Math.atan2(-mx, -mz); }
      }
    }

    // 3) Destravar: se quase não andou, pula e recalcula
    const moved = Math.hypot(x - b.lastX, z - b.lastZ);
    b.lastX = x; b.lastZ = z;
    b.stuck = (mx || mz) && moved < 0.02 ? b.stuck + dt : 0;
    let jump = 0;
    if (b.stuck > 0.6) { jump = 1; b.repath = 0; b.stuck = 0; }

    intents[io] = mx; intents[io + 1] = mz; intents[io + 2] = yaw;
    intents[io + 3] = shoot; intents[io + 4] = jump; intents[io + 5] = shoot ? b.target : -1;
  }

  const ms = performance.now() - t0;
  if (shared) { state[2] = ms; self.postMessage({ type: 'thought', ms }); }
  else self.postMessage({ type: 'thought', ms, intents }, [intents.buffer]);
}
