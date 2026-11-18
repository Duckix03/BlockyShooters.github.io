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
  FLAG_IN_VEHICLE, INTENT_STRIDE, PLAYER_SLOT, slotOffset,
} from '../core/layout.js';

const CAPSULE_HALF = 0.5, CAPSULE_R = 0.4; // altura total ≈ 1.8 m
const EYE = CAPSULE_HALF + CAPSULE_R;

let world, controller, state, shared = false, balance;
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
  }
};

async function init(m) {
  await RAPIER.init();
  state = m.state; shared = m.shared; balance = m.balance;
  world = new RAPIER.World({ x: 0, y: balance.gravity, z: 0 });
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
  // Árvores, pedras e caixas (colisores estáticos simples)
  for (const c of gen.chunks) {
    for (const t of c.trees) world.createCollider(RAPIER.ColliderDesc.cylinder(4 * t.s, 0.35 * t.s).setTranslation(t.x, 4 * t.s, t.z));
    for (const r of c.rocks) world.createCollider(RAPIER.ColliderDesc.ball(0.7 * r.s).setTranslation(r.x, 0.2 * r.s, r.z));
    for (const k of c.crates) world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, 0.6, 0.6).setTranslation(k.x, 0.6, k.z));
  }

  // Personagens: corpos kinematic + um único character controller compartilhado
  controller = world.createCharacterController(0.05);
  controller.enableAutostep(0.5, 0.2, true);
  controller.enableSnapToGround(0.4);
  controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
  controller.setApplyImpulsesToDynamicBodies(true);

  for (let i = 0; i < CHARACTER_COUNT; i++) {
    const sp = i === PLAYER_SLOT ? { x: 0, z: 0 } : gen.spawns[i % gen.spawns.length];
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(sp.x, EYE + 0.1, sp.z));
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_R), body);
    chars.push({ body, collider, vy: 0, alive: true, yaw: 0 });
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

function moveCharacter(c, mx, mz, speed, jump, dt) {
  if (!c.alive) return;
  const grounded = c.grounded;
  if (grounded && c.vy < 0) c.vy = -1;
  if (jump && grounded) c.vy = balance.jumpSpeed;
  c.vy += balance.gravity * dt;
  desired.x = mx * speed * dt; desired.y = c.vy * dt; desired.z = mz * speed * dt;
  controller.computeColliderMovement(c.collider, desired);
  const mv = controller.computedMovement();
  c.grounded = controller.computedGrounded();
  const p = c.body.translation();
  target.x = p.x + mv.x; target.y = p.y + mv.y; target.z = p.z + mv.z;
  c.body.setNextKinematicTranslation(target);
}

function step(m) {
  const t0 = performance.now();
  if (!shared && m.state) state = m.state; // recebe o buffer de volta (ping-pong de Transferable)
  const dt = m.dt;
  const inp = m.input;

  // Jogador
  const player = chars[PLAYER_SLOT];
  player.yaw = inp.yaw;
  if (playerVehicle < 0) {
    moveCharacter(player, inp.mx, inp.mz, inp.sprint ? balance.sprintSpeed : balance.walkSpeed, inp.jump, dt);
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

  // Bots: intenções vindas da IA (via main)
  const it = m.intents;
  for (let i = FIRST_BOT; i < CHARACTER_COUNT; i++) {
    const o = (i - FIRST_BOT) * INTENT_STRIDE;
    const c = chars[i];
    c.yaw = it[o + 2];
    moveCharacter(c, it[o], it[o + 1], balance.walkSpeed * 0.9, it[o + 4] > 0.5, dt);
  }

  for (const v of vehicles) v.ctrl.updateVehicle(dt);
  world.timestep = dt;
  world.step();
  stepCount++;
  writeState();

  const ms = performance.now() - t0;
  state[1] = ms;
  if (shared) self.postMessage({ type: 'stepped', ms });
  else self.postMessage({ type: 'stepped', ms, state }, [state.buffer]);
}

function writeState() {
  state[0] = stepCount;
  for (let i = 0; i < ENTITY_COUNT; i++) {
    const o = slotOffset(i);
    if (i < CHARACTER_COUNT) {
      const c = chars[i];
      const p = c.body.translation();
      state[o + F.X] = p.x; state[o + F.Y] = p.y - EYE; state[o + F.Z] = p.z; // y = pés
      // Personagens só giram no eixo Y (sem alocar quaternion)
      state[o + F.QX] = 0; state[o + F.QY] = Math.sin(c.yaw / 2); state[o + F.QZ] = 0; state[o + F.QW] = Math.cos(c.yaw / 2);
      let flags = c.alive ? FLAG_ALIVE : 0;
      if (c.grounded) flags |= FLAG_GROUNDED;
      if (i === PLAYER_SLOT && playerVehicle >= 0) flags |= FLAG_IN_VEHICLE;
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
  c.alive = m.alive;
  c.collider.setEnabled(m.alive);
  if (m.alive && m.x !== undefined) {
    c.body.setTranslation({ x: m.x, y: EYE + 0.5, z: m.z }, true);
    c.vy = 0;
  }
  if (!m.alive && m.slot === PLAYER_SLOT && playerVehicle >= 0) vehicleAction({ action: 'exit' });
}

function yawQuat(yaw) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}
