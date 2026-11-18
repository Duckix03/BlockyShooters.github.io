// Combate autoritativo (no modo local roda no cliente; online iria para o servidor):
// vida, munição, hitscan contra obstáculos e cápsulas, abates.
import { generateWorld, rayObstacles } from '../core/worldgen.js';
import {
  CHARACTER_COUNT, F, FIRST_BOT, FLAG_ALIVE, FLAG_CROUCH, INTENT_STRIDE, PLAYER_SLOT, slotOffset,
} from '../core/layout.js';

const RANGE = 200;
// Esferas de acerto por personagem (aproximação barata de cápsula): corpo e cabeça
const BODY_Y = 1.0, BODY_R = 0.5, HEAD_Y = 1.6, HEAD_R = 0.26;
// Agachado: hitbox mais baixa e menor
const CBODY_Y = 0.62, CBODY_R = 0.45, CHEAD_Y = 1.15;

export class Combat {
  constructor(balance, session) {
    this.balance = balance;
    this.session = session;
    this.world = generateWorld();
    this.health = new Float32Array(CHARACTER_COUNT);
    this.alive = new Uint8Array(CHARACTER_COUNT);
    this.kills = new Uint16Array(CHARACTER_COUNT);
    this.cooldown = new Float32Array(CHARACTER_COUNT);
    this.weapon = { mag: 0, reserve: 0, reload: 0 };
    // Resultado do último tiro (reaproveitado, sem alocar)
    this.hit = { slot: -1, head: false, dist: 0, ex: 0, ey: 0, ez: 0 };
    // Eventos reaproveitados: os ouvintes são síncronos e não guardam a referência (zero alocação por tiro)
    this.evShot = { type: 'shot', shooter: 0, ox: 0, oy: 0, oz: 0, ex: 0, ey: 0, ez: 0, hitSlot: -1 };
    this.evHit = { type: 'hit', slot: 0, amount: 0, attacker: 0, head: false };
    this.evKill = { type: 'kill', slot: 0, attacker: 0 };
    this.evEmpty = { type: 'empty' };
  }

  reset() {
    this.health.fill(this.balance.maxHealth);
    this.alive.fill(1);
    this.kills.fill(0);
    this.cooldown.fill(0);
    this.weapon.mag = this.balance.magSize;
    this.weapon.reserve = this.balance.reserveAmmo;
    this.weapon.reload = 0;
  }

  get aliveCount() { let n = 0; for (let i = 0; i < CHARACTER_COUNT; i++) n += this.alive[i]; return n; }

  startReload() {
    const w = this.weapon;
    if (w.reload > 0 || w.mag >= this.balance.magSize || w.reserve <= 0) return false;
    w.reload = this.balance.reloadTime;
    return true;
  }

  /** Tick do combate no passo fixo. */
  update(dt, state, intents, playerShot) {
    for (let i = 0; i < CHARACTER_COUNT; i++) if (this.cooldown[i] > 0) this.cooldown[i] -= dt;
    const w = this.weapon;
    if (w.reload > 0) {
      w.reload -= dt;
      if (w.reload <= 0) {
        const take = Math.min(this.balance.magSize - w.mag, w.reserve);
        w.mag += take; w.reserve -= take; w.reload = 0;
      }
    }

    // Jogador
    if (playerShot && this.alive[PLAYER_SLOT] && this.cooldown[PLAYER_SLOT] <= 0 && w.reload <= 0) {
      if (w.mag > 0) {
        w.mag--;
        this.cooldown[PLAYER_SLOT] = 1 / this.balance.fireRate;
        // Agachado = mais precisão
        const crouched = ((state[slotOffset(PLAYER_SLOT) + F.FLAGS] | 0) & FLAG_CROUCH) !== 0;
        const s = this.balance.spread * (crouched ? this.balance.crouchSpreadMult : 1);
        this.fire(PLAYER_SLOT, state, playerShot.ox, playerShot.oy, playerShot.oz,
          playerShot.dx + (Math.random() - 0.5) * s, playerShot.dy + (Math.random() - 0.5) * s,
          playerShot.dz + (Math.random() - 0.5) * s, this.balance.weaponDamage);
        if (w.mag === 0) this.startReload();
      } else {
        this.cooldown[PLAYER_SLOT] = 0.3;
        this.session.emitEvent(this.evEmpty);
      }
    }

    // Bots: intenção de tiro vinda da IA; a mira erra conforme a precisão configurada
    for (let i = FIRST_BOT; i < CHARACTER_COUNT; i++) {
      const io = (i - FIRST_BOT) * INTENT_STRIDE;
      const target = intents[io + 5] | 0;
      if (!this.alive[i] || intents[io + 3] < 0.5 || target < 0 || !this.alive[target] || this.cooldown[i] > 0) continue;
      this.cooldown[i] = (1 / this.balance.botFireRate) * (0.8 + Math.random() * 0.4);
      const o = slotOffset(i), t = slotOffset(target);
      const ox = state[o + F.X], oy = state[o + F.Y] + (((state[o + F.FLAGS] | 0) & FLAG_CROUCH) ? 1.0 : 1.5), oz = state[o + F.Z];
      const tCrouch = ((state[t + F.FLAGS] | 0) & FLAG_CROUCH) !== 0;
      let dx = state[t + F.X] - ox, dy = state[t + F.Y] + (tCrouch ? CBODY_Y : BODY_Y) - oy, dz = state[t + F.Z] - oz;
      const d = Math.hypot(dx, dy, dz) || 1;
      dx /= d; dy /= d; dz /= d;
      const meCrouch = ((state[o + F.FLAGS] | 0) & FLAG_CROUCH) !== 0;
      const err = (1 - this.balance.botAccuracy) * 0.12 * (meCrouch ? 0.7 : 1);
      this.fire(i, state, ox, oy, oz,
        dx + (Math.random() - 0.5) * err, dy + (Math.random() - 0.5) * err, dz + (Math.random() - 0.5) * err,
        this.balance.botDamage);
    }
  }

  /** Hitscan: obstáculos (mundo) + esferas dos personagens. Emite eventos para áudio/efeitos/HUD. */
  fire(shooter, state, ox, oy, oz, dx, dy, dz, damage) {
    const len = Math.hypot(dx, dy, dz); dx /= len; dy /= len; dz /= len;
    let best = rayObstacles(this.world, ox, oy, oz, dx, dy, dz, RANGE);
    let hitSlot = -1, head = false;
    for (let i = 0; i < CHARACTER_COUNT; i++) {
      if (i === shooter || !this.alive[i]) continue;
      const o = slotOffset(i);
      if (!((state[o + F.FLAGS] | 0) & FLAG_ALIVE)) continue;
      const x = state[o + F.X], y = state[o + F.Y], z = state[o + F.Z];
      const cr = ((state[o + F.FLAGS] | 0) & FLAG_CROUCH) !== 0;
      const th = raySphere(ox, oy, oz, dx, dy, dz, x, y + (cr ? CHEAD_Y : HEAD_Y), z, HEAD_R);
      if (th < best) { best = th; hitSlot = i; head = true; }
      const tb = raySphere(ox, oy, oz, dx, dy, dz, x, y + (cr ? CBODY_Y : BODY_Y), z, cr ? CBODY_R : BODY_R);
      if (tb < best) { best = tb; hitSlot = i; head = false; }
    }
    const h = this.hit;
    h.slot = hitSlot; h.head = head; h.dist = best;
    h.ex = ox + dx * best; h.ey = oy + dy * best; h.ez = oz + dz * best;
    const ev = this.evShot;
    ev.shooter = shooter; ev.ox = ox; ev.oy = oy; ev.oz = oz; ev.ex = h.ex; ev.ey = h.ey; ev.ez = h.ez; ev.hitSlot = hitSlot;
    this.session.emitEvent(ev);
    if (hitSlot >= 0) this.damage(hitSlot, head ? damage * this.balance.headshotMult : damage, shooter, head);
  }

  damage(slot, amount, attacker, head = false) {
    if (!this.alive[slot]) return;
    this.health[slot] = Math.max(0, this.health[slot] - amount);
    const eh = this.evHit;
    eh.slot = slot; eh.amount = amount; eh.attacker = attacker; eh.head = head;
    this.session.emitEvent(eh);
    if (this.health[slot] <= 0) {
      this.alive[slot] = 0;
      if (attacker >= 0) this.kills[attacker]++;
      const ek = this.evKill;
      ek.slot = slot; ek.attacker = attacker;
      this.session.emitEvent(ek);
    }
  }
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return Infinity;
  return tca - Math.sqrt(r * r - d2);
}
