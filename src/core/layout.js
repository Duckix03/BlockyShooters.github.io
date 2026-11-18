// Layout do buffer de estado compartilhado entre a thread principal e os Workers.
// Cada entidade ocupa STRIDE floats: posição (3), rotação quaternion (4), flags (1), extra (4).
import { BOT_COUNT, WORLD } from '../config/settings.js';

export const STRIDE = 12;
export const F = { X: 0, Y: 1, Z: 2, QX: 3, QY: 4, QZ: 5, QW: 6, FLAGS: 7, A: 8, B: 9, C: 10, D: 11 };
// Flags (bitmask guardado como float)
export const FLAG_ALIVE = 1;
export const FLAG_GROUNDED = 2;
export const FLAG_IN_VEHICLE = 4;
export const FLAG_CROUCH = 8;

export const PLAYER_SLOT = 0;
export const FIRST_BOT = 1;
export const FIRST_VEHICLE = FIRST_BOT + BOT_COUNT;
export const CHARACTER_COUNT = 1 + BOT_COUNT;
export const ENTITY_COUNT = CHARACTER_COUNT + WORLD.vehicles;

/** Cabeçalho: [0] = número do passo da física, [1] = ms da física, [2] = ms da IA */
export const HEADER = 4;
export const STATE_FLOATS = HEADER + ENTITY_COUNT * STRIDE;

/** Intenções dos bots escritas pela IA: moveX, moveZ, yaw, wantShoot, wantJump, targetSlot, wantCrouch */
export const INTENT_STRIDE = 7;
export const INTENT_FLOATS = BOT_COUNT * INTENT_STRIDE;

export const slotOffset = (slot) => HEADER + slot * STRIDE;

/** Cria um buffer: SharedArrayBuffer se a página estiver isolada, senão ArrayBuffer comum. */
export function makeBuffer(floats) {
  const shared = typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated;
  const buf = shared ? new SharedArrayBuffer(floats * 4) : new ArrayBuffer(floats * 4);
  return { array: new Float32Array(buf), shared };
}
