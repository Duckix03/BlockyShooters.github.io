// Loop principal: lógica em passo fixo (60 Hz) separada do render, com fator de interpolação.
import { FIXED_DT, MAX_STEPS_PER_FRAME } from '../config/settings.js';

export class GameLoop {
  /**
   * @param {(dt:number)=>void} fixedUpdate  lógica determinística
   * @param {(alpha:number, frameDt:number)=>void} render  alpha ∈ [0,1) entre o passo anterior e o atual
   */
  constructor(fixedUpdate, render) {
    this.fixedUpdate = fixedUpdate;
    this.render = render;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.frameMs = 0;
    this.maxFps = 60;      // 0 = sem limite (segue o monitor)
    this.lastFrame = 0;
    this._tick = this._tick.bind(this);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }
  stop() { this.running = false; }
  _tick(now) {
    if (!this.running) return;
    requestAnimationFrame(this._tick);
    // Limitador de FPS: pula o frame se ainda não passou o intervalo mínimo
    // (tolerância de 1 ms porque o rAF não chega exatamente no mesmo instante).
    if (this.maxFps > 0) {
      const min = 1000 / this.maxFps;
      if (now - this.lastFrame < min - 1) return;
      this.lastFrame = now - Math.min(min, (now - this.lastFrame) % min);
    }
    const t0 = performance.now();
    let frameDt = (now - this.last) / 1000;
    this.last = now;
    if (frameDt > 0.25) frameDt = 0.25; // aba voltou do background
    this.acc += frameDt;
    let steps = 0;
    while (this.acc >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.fixedUpdate(FIXED_DT);
      this.acc -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0; // descarta atraso acumulado
    this.render(this.acc / FIXED_DT, frameDt);
    this.frameMs = performance.now() - t0;
  }
}
