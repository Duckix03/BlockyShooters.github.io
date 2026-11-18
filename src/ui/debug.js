// Overlay de debug (F1): stats.js (FPS/ms/memória) + painel com draw calls, triângulos,
// tempo da física, tempo da IA, heap e entidades. Atualiza o texto 4x por segundo.
import Stats from 'stats.js';

export class DebugOverlay {
  constructor() {
    this.el = document.getElementById('debug');
    this.stats = [0, 1, 2].map((panel, i) => {
      const s = new Stats();
      s.showPanel(panel); // 0 FPS, 1 ms, 2 MB (Chrome)
      Object.assign(s.dom.style, { position: 'fixed', left: `${i * 82}px`, top: '0px', display: 'none', zIndex: 50 });
      document.body.appendChild(s.dom);
      return s;
    });
    this.visible = false;
    this.acc = 0;
    this.frames = 0;
  }
  toggle() {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
    for (const s of this.stats) s.dom.style.display = this.visible ? 'block' : 'none';
  }
  begin() { if (this.visible) for (const s of this.stats) s.begin(); }
  end() { if (this.visible) for (const s of this.stats) s.end(); }

  /** @param {() => object} collect  só é chamado quando o painel vai redesenhar */
  update(dt, collect) {
    if (!this.visible) return;
    this.acc += dt; this.frames++;
    if (this.acc < 0.25) return;
    const fps = this.frames / this.acc;
    this.acc = 0; this.frames = 0;
    const d = collect();
    const mem = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB` : 'n/d';
    this.el.textContent =
      `FPS        ${fps.toFixed(0)}\n` +
      `Frame      ${d.frameMs.toFixed(2)} ms (CPU main)\n` +
      `GPU        ${d.gpuMs ? d.gpuMs.toFixed(2) + ' ms' : 'n/d'}\n` +
      `Draw calls ${d.calls}\n` +
      `Triângulos ${d.triangles.toLocaleString('pt-BR')}\n` +
      `Física     ${d.physicsMs.toFixed(2)} ms\n` +
      `IA         ${d.aiMs.toFixed(2)} ms\n` +
      `Heap       ${mem}\n` +
      `Entidades  ${d.entities}  (efeitos ${d.effects})\n` +
      `Backend    ${d.backend}  ${d.shared ? 'SharedArrayBuffer' : 'Transferable'}\n` +
      `PixelRatio ${d.pixelRatio.toFixed(2)}  Preset ${d.preset}\n` +
      `Chunks     ${d.chunks}`;
  }
}
