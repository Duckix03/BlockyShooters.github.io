// Worker de física: Rapier com KinematicCharacterController (jogador + bots)
// e DynamicRayCastVehicleController (veículos). Escreve o estado no buffer de estado.
//
// Protocolo (main -> worker):
//   init    { state, shared, balance }
//   step    { dt, input, intents, state? }   (state só vem no modo Transferable)
//   balance { balance }
//   vehicle { action: 'enter'|'exit', vehicle }
//   alive   { slot, alive, x?, z? }          (morte/respawn)
// Protocolo (worker -> main):
//   ready
//   stepped { ms, state? }
import RAPIER from '@dimforge/rapier3d-compat';
import { generateWorld } from '../core/worldgen.js';
import {
  CHARACTER_COUNT, ENTITY_COUNT, FIRST_BOT, FIRST_VEHICLE, F, FLAG_ALIVE, FLAG_GROUNDED,
  FLAG_CROUCH, FLAG_IN_VEHICLE, INTENT_STRIDE, PLAYER_SLOT, slotOffset,
} from '../core/layout.js';

const CAPSULE_HALF = 0.5, CAPSULE_R = 0.4; // altura total ≈ 1.8 m
const EYE = CAPSULE_HALF + CAPSULE_R;

let world, controller, botController, state, shared = false, balance;
let stepCostEma = 0, lodScale = 1, lastSeq = 0;
const chars = [];    // { body, collider, vy, alive }
const vehicles = []; // { body, ctrl }
let playerVehicle = -1;
let stepCount = 0;

self.onmessage = async (e) => {
  const m = e.data;
  switch (m.type) {
    case 'init': await init(m); break;
    case 'step': step(m); break;
    case 'balance': balance = m.balance; world && (world.gravity = { x: 0, y: balance.gravity, z: 0 }); break;
    case 'vehicle': vehicleAction(m); break;
    case 'alive': setAlive(m); break;
    case 'bench': bench(m); break;
  }
};

async function init(m) {
  await RAPIER.init();
  state = m.state; shared = m.shared; balance = m.balance;
  world = new RAPIER.World({ x: 0, y: balance.gravity, z: 0 });
  world.integrationParameters.numSolverIterations = 2; // só os carros usam o solver
  const gen = generateWorld();

  // Chão
  world.createCollider(RAPIER.ColliderDesc.cuboid(gen.half, 0.5, gen.half).setTranslation(0, -0.5, 0));
  // Paredes invisíveis na borda do mapa
  for (const [x, z, hx, hz] of [[gen.half, 0, 1, gen.half], [-gen.half, 0, 1, gen.half], [0, gen.half, gen.half, 1], [0, -gen.half, gen.half, 1]]) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, 20, hz).setTranslation(x, 20, z));
  }
  // Prédios
  for (const b of gen.buildings) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2).setTranslation(b.x, b.h / 2, b.z));
  }
  // Árvores, pedras e caixas: UMA malha de colisão (trimesh) por chunk.
  // Antes eram ~3.500 colisores individuais e o Rapier pagava por cada um a cada passo
  // (2-5 ms/passo aqui, ~50 ms no Brave). Agora são 64 colisores no mapa inteiro.
  for (const c of gen.chunks) {
    const mesh = buildChunkMesh(c);
    if (mesh.indices.length) world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.vertices, mesh.indices));
  }

  // Personagens: corpos kinematic. Jogador tem controller completo (sobe degraus, empurra carros);
  // bots usam um controller mais barato (sem autostep nem impulsos).
  // Personagens: corpos kinematic + um único character controller compartilhado
  controller = world.createCharacterController(0.05);
  controller.enableAutostep(0.5, 0.2, true);
  controller.enableSnapToGround(0.4);
  controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
  controller.setApplyImpulsesToDynamicBodies(true);
  botController = world.createCharacterController(0.05);
  botController.enableSnapToGround(0.4);
  botController.setMaxSlopeClimbAngle((50 * Math.PI) / 180);

  for (let i = 0; i < CHARACTER_COUNT; i++) {
    const sp = i === PLAYER_SLOT ? { x: 0, z: 0 } : gen.spawns[i % gen.spawns.length];
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(sp.x, EYE + 0.1, sp.z));
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_R), body);
    chars.push({ body, collider, vy: 0, alive: true, yaw: 0, crouch: false, center: STAND_CENTER, grounded: false });
  }

  // Veículos
  for (const v of gen.vehicles) {
    const q = yawQuat(v.yaw);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(v.x, 1.2, v.z)
      .setRotation(q).setLinearDamping(0.1).setAngularDamping(0.8));
    world.createCollider(RAPIER.ColliderDesc.cuboid(1, 0.45, 2.1).setMass(1200).setTranslation(0, 0.1, 0), body);
    const ctrl = world.createVehicleController(body);
    ctrl.indexUpAxis = 1;
    ctrl.setIndexForwardAxis = 2; // frente = +Z local
    const pts = [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]];
    for (const [x, z] of pts) {
      ctrl.addWheel({ x, y: -0.1, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, 0.35, 0.4);
    }
    for (let w = 0; w < 4; w++) {
      ctrl.setWheelSuspensionStiffness(w, 28);
      ctrl.setWheelFrictionSlip(w, 2.2);
    }
    vehicles.push({ body, ctrl });
  }

  writeState();
  self.postMessage({ type: 'ready' });
}

const desired = { x: 0, y: 0, z: 0 };
const target = { x: 0, y: 0, z: 0 };
const IDENT_ROT = { x: 0, y: 0, z: 0, w: 1 };
// Altura do centro da cápsula acima dos pés: em pé 0.9 (1.8 m), agachado 0.6 (1.2 m)
const STAND_HALF = CAPSULE_HALF, CROUCH_HALF = 0.2;
const STAND_CENTER = STAND_HALF + CAPSULE_R, CROUCH_CENTER = CROUCH_HALF + CAPSULE_R;
let standShape = null;

/**
 * Agachar/levantar: troca a altura da cápsula mantendo os pés no lugar.
 * Para levantar, testa se cabe (não levanta embaixo de obstáculo).
 */
function setCrouch(c, want) {
  if (want === c.crouch || !c.alive) return false;
  const p = c.body.translation();
  if (want) {
    c.collider.setHalfHeight(CROUCH_HALF);
    target.x = p.x; target.y = p.y - (STAND_CENTER - CROUCH_CENTER); target.z = p.z;
  } else {
    target.x = p.x; target.y = p.y + (STAND_CENTER - CROUCH_CENTER); target.z = p.z;
    standShape ??= new RAPIER.Capsule(STAND_HALF, CAPSULE_R - 0.02);
    if (world.intersectionWithShape(target, IDENT_ROT, standShape, undefined, undefined, c.collider)) return false;
    c.collider.setHalfHeight(STAND_HALF);
  }
  // Usa o alvo kinematic (não setTranslation): o colisor só é sincronizado no world.step,
  // então mover o corpo "na mão" e calcular movimento no mesmo passo fazia afundar no chão.
  c.body.setNextKinematicTranslation(target);
  c.crouch = want;
  c.center = want ? CROUCH_CENTER : STAND_CENTER;
  return true;
}

/** Levanta sem testar espaço (respawn / entrar no veículo). */
function forceStand(c) {
  if (!c.crouch) return;
  c.collider.setHalfHeight(STAND_HALF);
  c.crouch = false;
  c.center = STAND_CENTER;
}

function moveCharacter(c, mx, mz, speed, jump, dt) {
  if (!c.alive) return;
  const grounded = c.grounded;
  if (grounded && c.vy < 0) c.vy = -1;
  if (jump && grounded && !c.crouch) c.vy = balance.jumpSpeed;
  c.vy += balance.gravity * dt;
  desired.x = mx * speed * dt; desired.y = c.vy * dt; desired.z = mz * speed * dt;
  const kcc = c === chars[PLAYER_SLOT] ? controller : botController;
  kcc.computeColliderMovement(c.collider, desired);
  const mv = kcc.computedMovement();
  c.grounded = kcc.computedGrounded();
  const p = c.body.translation();
  target.x = p.x + mv.x; target.y = p.y + mv.y; target.z = p.z + mv.z;
  c.body.setNextKinematicTranslation(target);
}

/**
 * Recebe 1 ou mais passos de uma vez (m.steps). Se a main acumulou passos enquanto
 * o Worker estava ocupado, eles chegam em lote e NENHUM é descartado (antes isso causava travadinhas).
 */
function step(m) {
  const t0 = performance.now();
  if (!shared && m.state) state = m.state; // recebe o buffer de volta (ping-pong de Transferable)
  const n = m.steps || 1;
  for (let k = 0; k < n; k++) simulate(m.dt, m.input, m.intents);
  lastSeq = m.seq || 0;
  writeState();

  const ms = performance.now() - t0;
  state[1] = ms;
  // Média móvel do custo por passo -> ajusta o LOD dos bots (1x normal, 2x se passar de 8 ms)
  stepCostEma += (ms / n - stepCostEma) * 0.05;
  lodScale = stepCostEma > 8 ? 2 : stepCostEma < 4 ? 1 : lodScale;
  if (shared) self.postMessage({ type: 'stepped', ms, steps: n });
  else self.postMessage({ type: 'stepped', ms, steps: n, state }, [state.buffer]);
}

function simulate(dt, inp, it) {
  // Jogador
  const player = chars[PLAYER_SLOT];
  player.yaw = inp.yaw;
  if (playerVehicle < 0) {
    const changed = setCrouch(player, inp.crouch);
    const speed = player.crouch ? balance.crouchSpeed : inp.sprint ? balance.sprintSpeed : balance.walkSpeed;
    if (!changed) moveCharacter(player, inp.mx, inp.mz, speed, inp.jump, dt); // passo da troca: só ajusta altura
  } else {
    const v = vehicles[playerVehicle];
    const engine = inp.throttle * balance.vehicleEngine * 25;
    for (let w = 0; w < 4; w++) {
      v.ctrl.setWheelEngineForce(w, w >= 2 ? engine : 0);
      v.ctrl.setWheelBrake(w, inp.brake ? 30 : 0);
    }
    v.ctrl.setWheelSteering(0, inp.steer * balance.vehicleSteer);
    v.ctrl.setWheelSteering(1, inp.steer * balance.vehicleSteer);
    const p = v.body.translation();
    target.x = p.x; target.y = p.y + 1.5; target.z = p.z;
    player.body.setNextKinematicTranslation(target);
  }

  // Bots: intenções vindas da IA (via main).
  // LOD de física: perto do jogador (<25 m) todo passo; 25-60 m a cada 2 passos; mais longe a cada 4
  // (com dt proporcional, então a velocidade é a mesma). Corta o custo dos bots em ~3x.
  const pp = player.body.translation();
  for (let i = FIRST_BOT; i < CHARACTER_COUNT; i++) {
    const o = (i - FIRST_BOT) * INTENT_STRIDE;
    const c = chars[i];
    c.yaw = it[o + 2];
    if (!c.alive) continue;
    const bp = c.body.translation();
    const d2 = (bp.x - pp.x) ** 2 + (bp.z - pp.z) ** 2;
    // Se a física está pesada (navegador/PC lento), espaça ainda mais os bots distantes
    const period = (d2 > 3600 ? 4 : d2 > 625 ? 2 : 1) * (d2 > 625 ? lodScale : 1);
    if ((stepCount + i) % period !== 0) continue;
    if (setCrouch(c, it[o + 6] > 0.5)) continue;
    moveCharacter(c, it[o], it[o + 1], c.crouch ? balance.crouchSpeed : balance.walkSpeed * 0.9, it[o + 4] > 0.5, dt * period);
  }

  for (const v of vehicles) v.ctrl.updateVehicle(dt);
  world.timestep = dt;
  world.step();
  stepCount++;
}

function writeState() {
  state[0] = stepCount;
  state[3] = lastSeq; // último input do jogador já aplicado (usado na predição da main)
  for (let i = 0; i < ENTITY_COUNT; i++) {
    const o = slotOffset(i);
    if (i < CHARACTER_COUNT) {
      const c = chars[i];
      const p = c.body.translation();
      state[o + F.X] = p.x; state[o + F.Y] = p.y - c.center; state[o + F.Z] = p.z; // y = pés
      // Personagens só giram no eixo Y (sem alocar quaternion)
      state[o + F.QX] = 0; state[o + F.QY] = Math.sin(c.yaw / 2); state[o + F.QZ] = 0; state[o + F.QW] = Math.cos(c.yaw / 2);
      let flags = c.alive ? FLAG_ALIVE : 0;
      if (c.grounded) flags |= FLAG_GROUNDED;
      if (i === PLAYER_SLOT && playerVehicle >= 0) flags |= FLAG_IN_VEHICLE;
      if (c.crouch) flags |= FLAG_CROUCH;
      state[o + F.FLAGS] = flags;
      state[o + F.A] = playerVehicle;
    } else {
      const v = vehicles[i - FIRST_VEHICLE];
      const p = v.body.translation(), q = v.body.rotation();
      state[o + F.X] = p.x; state[o + F.Y] = p.y; state[o + F.Z] = p.z;
      state[o + F.QX] = q.x; state[o + F.QY] = q.y; state[o + F.QZ] = q.z; state[o + F.QW] = q.w;
      state[o + F.FLAGS] = FLAG_ALIVE;
      state[o + F.A] = v.ctrl.currentVehicleSpeed();
      state[o + F.B] = v.ctrl.wheelSteering(0) ?? 0;
      state[o + F.C] = v.ctrl.wheelRotation(0) ?? 0;
    }
  }
}

function vehicleAction(m) {
  const player = chars[PLAYER_SLOT];
  if (m.action === 'enter' && playerVehicle < 0) {
    forceStand(player);
    playerVehicle = m.vehicle;
    player.collider.setEnabled(false);
  } else if (m.action === 'exit' && playerVehicle >= 0) {
    const v = vehicles[playerVehicle];
    const p = v.body.translation();
    const q = v.body.rotation();
    // Sai pela esquerda do carro
    const yaw = 2 * Math.atan2(q.y, q.w);
    player.body.setTranslation({ x: p.x - Math.cos(yaw) * 2.2, y: p.y + 1.2, z: p.z + Math.sin(yaw) * 2.2 }, true);
    for (let w = 0; w < 4; w++) { v.ctrl.setWheelEngineForce(w, 0); v.ctrl.setWheelBrake(w, 10); }
    player.collider.setEnabled(true);
    player.vy = 0;
    playerVehicle = -1;
  }
}

function setAlive(m) {
  const c = chars[m.slot];
  if (m.alive) forceStand(c);
  c.alive = m.alive;
  c.collider.setEnabled(m.alive);
  if (m.alive && m.x !== undefined) {
    c.body.setTranslation({ x: m.x, y: STAND_CENTER + 0.5, z: m.z }, true);
    c.vy = 0;
  }
  if (!m.alive && m.slot === PLAYER_SLOT && playerVehicle >= 0) vehicleAction({ action: 'exit' });
}

function yawQuat(yaw) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

/** Benchmark (só para diagnóstico): mede cada parte de N passos isoladamente. */
function bench(m) {
  const n = m.n || 120, dt = 1 / 60;
  const input = { mx: 0, mz: 0, yaw: 0, jump: false, sprint: false, crouch: false, throttle: 0, steer: 0, brake: false };
  const it = m.intents;
  let worstBot = { ms: 0 };
  let tChars = 0, tVeh = 0, tStep = 0, maxTotal = 0, maxChars = 0, maxStep = 0;
  for (let k = 0; k < n; k++) {
    const t0 = performance.now();
    let t = t0;
    moveCharacter(chars[PLAYER_SLOT], 0, 0, balance.walkSpeed, false, dt);
    for (let i = FIRST_BOT; i < CHARACTER_COUNT; i++) {
      const o = (i - FIRST_BOT) * INTENT_STRIDE;
      const tb = performance.now();
      moveCharacter(chars[i], it[o], it[o + 1], balance.walkSpeed * 0.9, false, dt);
      const e = performance.now() - tb;
      if (e > worstBot.ms) { const p = chars[i].body.translation(); worstBot = { ms: e, i, k, x: p.x, y: p.y, z: p.z, g: chars[i].grounded }; }
    }
    tChars += performance.now() - t; t = performance.now();
    for (const v of vehicles) v.ctrl.updateVehicle(dt);
    tVeh += performance.now() - t; t = performance.now();
    const tc = t - t0;
    world.timestep = dt; world.step();
    const ts = performance.now() - t;
    tStep += ts;
    maxTotal = Math.max(maxTotal, performance.now() - t0); maxStep = Math.max(maxStep, ts);
    maxChars = Math.max(maxChars, tc);
  }
  self.postMessage({ type: 'bench', worstBot, maxTotal, maxStep, maxChars, chars: tChars / n, vehicles: tVeh / n, step: tStep / n,
    colliders: world.colliders.len(), bodies: world.bodies.len() });
}

/**
 * Junta os props de um chunk numa malha de triângulos para colisão:
 * tronco = prisma hexagonal, pedra = octaedro achatado, caixa = cubo.
 */
function buildChunkMesh(chunk) {
  const v = [], idx = [];
  const prism = (x, z, r, h, sides) => {
    const base = v.length / 3;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2, cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r;
      v.push(cx, 0, cz, cx, h, cz);
    }
    v.push(x, h, z); // centro do topo
    const top = base + sides * 2;
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides, b0 = base + i * 2, b1 = base + j * 2;
      idx.push(b0, b1, b0 + 1, b1, b1 + 1, b0 + 1, b0 + 1, b1 + 1, top);
    }
  };
  const box = (x, z, hx, hy, hz) => {
    const b = v.length / 3;
    for (const [dx, dy, dz] of [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [-1, 2, -1], [1, 2, -1], [1, 2, 1], [-1, 2, 1]]) {
      v.push(x + dx * hx, dy * hy, z + dz * hz);
    }
    const f = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]];
    for (const t of f) idx.push(b + t[0], b + t[1], b + t[2]);
  };
  const rock = (x, z, r) => {
    const b = v.length / 3, y = 0.2 * r / 0.7;
    v.push(x, y + r * 0.75, z, x + r, y, z, x, y, z + r, x - r, y, z, x, y, z - r, x, 0, z);
    for (const [a, c] of [[1, 2], [2, 3], [3, 4], [4, 1]]) idx.push(b, b + c, b + a, b + 5, b + a, b + c);
  };
  for (const t of chunk.trees) prism(t.x, t.z, 0.35 * t.s, 8 * t.s, 6);
  for (const r of chunk.rocks) rock(r.x, r.z, 0.7 * r.s);
  for (const k of chunk.crates) box(k.x, k.z, 0.6, 0.6, 0.6);
  return { vertices: new Float32Array(v), indices: new Uint32Array(idx) };
}
