// Ícones dos itens gerados por código: renderiza o modelo 3D num canvas pequeno (fora da tela)
// e desenha por cima um fundo na cor da raridade. Usados no HUD e no inventário (cache em dataURL).
'use strict';
LS.Icons = {
  SIZE: 96, cache: {}, failed: false,
  setup() {
    if (this.r || this.failed) return !!this.r;
    try {
      const S = this.SIZE;
      this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.r.setPixelRatio(1); this.r.setSize(S, S); this.r.setClearColor(0x000000, 0);
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(1.5, 2.5, 2); this.scene.add(sun);
      const rim = new THREE.DirectionalLight(0xbfd9ff, 0.35); rim.position.set(-2, 1, -1.5); this.scene.add(rim);
      this.cam = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
      this.out = document.createElement('canvas'); this.out.width = this.out.height = S;
    } catch (e) { this.failed = true; this.r = null; }
    return !!this.r;
  },
  key: (type, id, level) => type + ':' + (id || '') + ':' + (level || 0),
  // dataURL do ícone (string vazia se o navegador não tiver WebGL)
  get(type, id, level) {
    const k = this.key(type, id, level);
    if (this.cache[k] !== undefined) return this.cache[k];
    if (!this.setup()) return (this.cache[k] = '');
    const it = { type, id, level: level || 0 }, I = LS.Items, S = this.SIZE;
    const mesh = I.mesh(I.itemGeometry(it)); mesh.castShadow = false;
    this.scene.add(mesh);
    const bs = mesh.geometry.boundingSphere, c = bs.center, dist = bs.radius / Math.sin(THREE.MathUtils.degToRad(14)) * 1.02;
    const dir = type === 'weapon' ? new THREE.Vector3(-1, 0.32, 0.18) : type === 'bag' ? new THREE.Vector3(0.75, 0.55, -1.15) : new THREE.Vector3(0.75, 0.62, 1.15);
    dir.normalize();
    this.cam.position.copy(c).addScaledVector(dir, dist); this.cam.lookAt(c);
    this.r.render(this.scene, this.cam);
    this.scene.remove(mesh);
    // fundo com a cor da raridade + borda
    const g = this.out.getContext('2d'), col = '#' + new THREE.Color(I.color(it)).getHexString(), rar = I.rarity(it);
    g.clearRect(0, 0, S, S);
    const grd = g.createRadialGradient(S / 2, S * 0.45, 4, S / 2, S / 2, S * 0.7);
    grd.addColorStop(0, col + (rar >= 2 ? '88' : '55')); grd.addColorStop(1, 'rgba(14,18,28,0.92)');
    g.fillStyle = grd; this.round(g, 2, 2, S - 4, S - 4, 12); g.fill();
    g.lineWidth = rar >= 3 ? 4 : 3; g.strokeStyle = col; this.round(g, 2, 2, S - 4, S - 4, 12); g.stroke();
    g.drawImage(this.r.domElement, 0, 0);
    if (level) { g.fillStyle = col; g.font = 'bold 20px Segoe UI, Arial'; g.textAlign = 'right'; g.fillText(['', 'I', 'II', 'III'][level], S - 10, S - 10); }
    return (this.cache[k] = this.out.toDataURL());
  },
  round(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },
  // gera todos de uma vez (na carga do mapa) para não travar no meio da partida
  preload() {
    for (const id of LS.WEAPON_IDS) this.get('weapon', id, 0);
    for (const a in LS.AMMO_TYPES) this.get('ammo', a, 0);
    for (const m in LS.MEDS) this.get('med', m, 0);
    for (const k of ['vest', 'helmet', 'bag']) for (let l = 1; l <= 3; l++) this.get(k, null, l);
  },
  img(type, id, level, cls) { const s = this.get(type, id, level); return s ? '<img class="' + (cls || 'ico') + '" src="' + s + '" alt="">' : ''; }
};
