// Zona segura estilo battle royale: encolhe em fases até o centro final.
import { WORLD } from '../config/settings.js';

export class Zone {
  constructor(balance) {
    this.balance = balance;
    this.reset();
  }
  reset() {
    const half = WORLD.size / 2;
    this.startR = half * 1.3;
    this.endR = 8;
    // Centro final aleatório, longe da borda
    this.endX = (Math.random() - 0.5) * half;
    this.endZ = (Math.random() - 0.5) * half;
    this.t = 0;
    this.x = 0; this.z = 0; this.r = this.startR;
    this.view = { x: 0, z: 0, r: this.startR }; // objeto reaproveitado enviado à IA
  }
  update(dt) {
    this.t += dt;
    const k = Math.min(1, this.t / this.balance.zoneShrinkTime);
    const e = k * k * (3 - 2 * k); // smoothstep: fecha devagar no começo e no fim
    this.r = this.startR + (this.endR - this.startR) * e;
    this.x = this.endX * e; this.z = this.endZ * e;
    this.view.x = this.x; this.view.z = this.z; this.view.r = this.r;
  }
  isOutside(x, z) { return Math.hypot(x - this.x, z - this.z) > this.r; }
  /** Segundos restantes até fechar. */
  get remaining() { return Math.max(0, this.balance.zoneShrinkTime - this.t); }
}
