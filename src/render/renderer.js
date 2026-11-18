// Renderer: WebGPURenderer (cai sozinho para WebGL2 quando não há WebGPU),
// cena, luzes, sombra de curta distância que segue a câmera e escala de resolução dinâmica.
import * as THREE from 'three/webgpu';
import { PRESETS } from '../config/settings.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 600);
    this.preset = PRESETS.high;
    this.pixelRatio = 1;
    this.frameWindow = new Uint8Array(90); // 1 = frame perdido (janela móvel)
    this.longFrames = 0;
    this.cleanTime = 0;
    this.ftIdx = 0;
    this.adjustCooldown = 0;
    this.backend = '';
  }

  async init() {
    await this.renderer.init();
    this.backend = this.renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;

    const s = this.scene;
    s.background = new THREE.Color(0x9cc8ef);
    s.fog = new THREE.Fog(0x9cc8ef, 40, 260);

    // "Luz baked": hemisférica barata ilumina tudo; só o sol perto da câmera projeta sombra.
    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x5a6b3a, 1.4);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.castShadow = true;
    this.sunOffset = new THREE.Vector3(30, 60, 20);
    s.add(this.sun, this.sun.target);

    addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** Aplica um preset gráfico (Baixo/Médio/Alto/Ultra). */
  applyPreset(preset) {
    this.preset = preset;
    this.pixelRatio = Math.min(devicePixelRatio, preset.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.scene.fog.far = preset.fog;
    this.scene.fog.near = preset.fog * 0.3;
    this.camera.far = preset.fog + 20;
    this.camera.updateProjectionMatrix();

    this.sun.castShadow = preset.shadows;
    const sh = this.sun.shadow;
    const d = preset.shadowDistance || 1;
    sh.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    sh.camera.left = -d; sh.camera.right = d; sh.camera.top = d; sh.camera.bottom = -d;
    sh.camera.near = 1; sh.camera.far = 160;
    sh.bias = -0.0005;
    sh.normalBias = 0.03;
    sh.camera.updateProjectionMatrix();
    sh.map?.dispose(); sh.map = null; // força recriar com o novo tamanho
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight, false);
  }

  /** Sombra só perto da câmera: a câmera de sombra acompanha o jogador, em passos de texel (sem "tremido"). */
  followShadow(focus) {
    if (!this.preset.shadows) return;
    const step = (this.preset.shadowDistance * 2) / this.preset.shadowMapSize;
    const x = Math.round(focus.x / step) * step, z = Math.round(focus.z / step) * step;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunOffset.x, this.sunOffset.y, z + this.sunOffset.z);
  }

  /**
   * Escala de resolução dinâmica, baseada em frames PERDIDOS (não na média):
   * com vsync o tempo de frame fica preso em 16,7 ms, então a média engana.
   * - Desce se mais de 15% dos últimos 90 frames estouraram 1,5x o orçamento.
   * - Sobe só depois de 6 s seguidos sem nenhum frame perdido.
   * Cada mudança recria os framebuffers (custa um soluço), por isso mudanças são raras.
   */
  updateDynamicResolution(frameDt) {
    const budget = 1 / this.preset.targetFps;
    const slow = frameDt > budget * 1.5 ? 1 : 0;
    this.longFrames += slow - this.frameWindow[this.ftIdx];
    this.frameWindow[this.ftIdx] = slow;
    this.ftIdx = (this.ftIdx + 1) % this.frameWindow.length;
    this.cleanTime = slow ? 0 : this.cleanTime + frameDt;
    if ((this.adjustCooldown -= frameDt) > 0) return;

    const max = Math.min(devicePixelRatio, this.preset.maxPixelRatio);
    let pr = this.pixelRatio;
    if (this.longFrames > this.frameWindow.length * 0.15) pr = Math.max(this.preset.minPixelRatio, pr - 0.15);
    else if (this.cleanTime > 6) pr = Math.min(max, pr + 0.1);
    if (Math.abs(pr - this.pixelRatio) < 0.001) return;
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.adjustCooldown = 2;
    this.cleanTime = 0;
    this.frameWindow.fill(0); this.longFrames = 0;
  }

  render() { this.renderer.render(this.scene, this.camera); }

  /** Números para o overlay de debug. */
  info() {
    const i = this.renderer.info;
    return { calls: i.render.drawCalls ?? i.render.calls, triangles: i.render.triangles };
  }
}
