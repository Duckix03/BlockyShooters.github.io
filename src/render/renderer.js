// Renderer: WebGLRenderer clássico do Three.js (o caminho mais rápido e compatível,
// inclusive no Brave), cena, luzes, sombra de curta distância que segue a câmera
// e escala de resolução dinâmica.
import * as THREE from 'three';
import { IS_MOBILE, PRESETS } from '../config/settings.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      // Antialias (MSAA) no PC: tira o serrilhado; a GPU tem folga de sobra com o WebGL clássico
      canvas, antialias: !IS_MOBILE, powerPreference: 'high-performance', stencil: false,
    });
    this.gpuMs = 0; // tempo de GPU via EXT_disjoint_timer_query (quando o navegador permite)
    this._timer = null;
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
    const r = this.renderer;
    this.backend = 'WebGL2';
    // Timer de GPU (opcional; Brave/Firefox costumam bloquear por privacidade)
    const gl = r.getContext();
    this._ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this._gl = gl;
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
    // Desligada por padrão: com FPS limitado pelo navegador (ex.: economia de energia do Brave)
    // ela confundia "frame lento" com GPU pesada e derrubava a resolução à toa.
    if (!this.autoResolution) return;
    const budget = 1 / (this.fpsTarget || 60);
    // Frame "lento" = estourou o tempo OU a GPU sozinha já usa mais de 75% do orçamento
    const gpuHeavy = this.gpuMs > budget * 1000 * 0.75;
    const slow = frameDt > budget * 1.5 || gpuHeavy ? 1 : 0;
    this.longFrames += slow - this.frameWindow[this.ftIdx];
    this.frameWindow[this.ftIdx] = slow;
    this.ftIdx = (this.ftIdx + 1) % this.frameWindow.length;
    this.cleanTime = slow ? 0 : this.cleanTime + frameDt;
    if ((this.adjustCooldown -= frameDt) > 0) return;

    const max = Math.min(devicePixelRatio, this.preset.maxPixelRatio);
    let pr = this.pixelRatio;
    if (this.longFrames > this.frameWindow.length * 0.15) pr = Math.max(this.preset.minPixelRatio, pr - 0.15);
    // Só sobe se a GPU tiver folga de verdade (menos de 45% do orçamento)
    else if (this.cleanTime > 6 && (this.gpuMs === 0 || this.gpuMs < budget * 1000 * 0.45)) pr = Math.min(max, pr + 0.1);
    if (Math.abs(pr - this.pixelRatio) < 0.001) return;
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.adjustCooldown = 2;
    this.cleanTime = 0;
    this.frameWindow.fill(0); this.longFrames = 0;
  }

  /**
   * Mede o tempo de GPU de um frame (chamado a cada 8 frames).
   * Abre uma query antes do render e lê o resultado em frames seguintes, sem travar.
   */
  sampleGpuTime() {
    const gl = this._gl, ext = this._ext;
    if (!ext) return;
    if (this._timer) {
      const ready = gl.getQueryParameter(this._timer, gl.QUERY_RESULT_AVAILABLE);
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      if (!ready && !disjoint) return;
      if (ready && !disjoint) this.gpuMs = gl.getQueryParameter(this._timer, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(this._timer);
      this._timer = null;
      return;
    }
    this._wantTimer = true; // a próxima chamada de render() é medida
  }

  render() {
    const gl = this._gl, ext = this._ext;
    const measure = this._wantTimer && ext;
    if (measure) { this._timer = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, this._timer); this._wantTimer = false; }
    this.renderer.render(this.scene, this.camera);
    if (measure) gl.endQuery(ext.TIME_ELAPSED_EXT);
  }

  /** Números para o overlay de debug. */
  info() {
    const i = this.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles };
  }
}
