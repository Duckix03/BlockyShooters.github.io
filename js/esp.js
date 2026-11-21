// ESP (comando "esp" no console): caixa em volta de cada jogador, linha (tracer) até ele, nome, arma,
// vida e distância em cima; bots ganham a etiqueta "BOT". Desenhado num canvas por cima do jogo (não pega cliques).
'use strict';
LS.ESP = {
  on: false, cv: null, g: null, drawn: false,
  init() {
    const cv = document.createElement('canvas');
    cv.id = 'esp-layer';
    Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '5' });
    document.body.appendChild(cv);
    this.cv = cv; this.g = cv.getContext('2d');
    this.v = new THREE.Vector3();
  },
  toggle(on) { this.on = on === undefined ? !this.on : on; if (!this.on) this.clear(); return this.on; },
  clear() { if (this.g && this.drawn) { this.g.clearRect(0, 0, this.cv.width, this.cv.height); this.drawn = false; } },
  // projeta um ponto do mundo na tela (em pixels); null se estiver atrás da câmera
  project(cam, x, y, z, W, H) {
    const v = this.v.set(x, y, z).project(cam);
    if (v.z > 1 || v.z < -1) return null;
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
  },
  draw() {
    const G = LS.Game;
    if (!this.on || !G || G.state !== 'playing' || !G.player) { this.clear(); return; }
    if (!this.cv) this.init();
    const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    const g = this.g, cam = G.camera, me = G.player;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); this.drawn = true;
    g.font = '600 12px Rubik, Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.lineJoin = 'round';
    for (const f of G.fighters) {
      if (f === me || !f.alive || f.state === 'plane') continue;
      const h = f.state === 'ground' ? (f.crouch ? 1.35 : 1.85) : 1.85, r = 0.45, p = f.pos;
      // caixa 2D a partir dos 8 cantos da caixa 3D do personagem
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, ok = true;
      for (const dx of [-r, r]) for (const dy of [0, h]) for (const dz of [-r, r]) {
        const s = this.project(cam, p.x + dx, p.y + dy, p.z + dz, W, H);
        if (!s) { ok = false; break; }
        x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x); y1 = Math.max(y1, s.y);
      }
      if (!ok || x1 < 0 || x0 > W || y1 < 0 || y0 > H) continue;
      const bot = !f.isPlayer, col = bot ? '#ff4d4d' : '#4dd2ff', dist = Math.round(me.pos.distanceTo(p));
      // tracer: do meio de baixo da tela até os pés
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2, H); g.lineTo((x0 + x1) / 2, y1); g.stroke();
      g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); g.moveTo(W / 2, H); g.lineTo((x0 + x1) / 2, y1); g.stroke();
      // caixa (com contorno escuro pra ler em qualquer fundo)
      g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 3; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
      g.strokeStyle = col; g.lineWidth = 1.5; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
      // barra de vida do lado esquerdo
      const hp = LS.util.clamp(f.hp / 100, 0, 1), bh = y1 - y0;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x0 - 6, y0 - 1, 4, bh + 2);
      g.fillStyle = hp > 0.5 ? '#4cff6a' : hp > 0.25 ? '#ffd23a' : '#ff4040'; g.fillRect(x0 - 5, y0 + bh * (1 - hp), 2, bh * hp);
      // nome + arma (+ distância) em cima da caixa e, nos bots, a etiqueta BOT acima de tudo
      const w = f.weapon && f.weapon(), wname = w ? LS.WEAPONS[w.id].name : 'Desarmado';
      const cx = (x0 + x1) / 2;
      const line = (txt, y, c) => { g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(txt, cx, y); g.fillStyle = c; g.fillText(txt, cx, y); };
      line(wname + ' · ' + dist + ' m', y0 - 3, '#e8eef8');
      line(f.name, y0 - 17, col);
      if (bot) {
        const ty = y0 - 33, tw = 30;
        g.fillStyle = '#ff4d4d'; g.fillRect(cx - tw / 2, ty - 13, tw, 14);
        g.fillStyle = '#fff'; g.font = '800 10px Rubik, Segoe UI, Arial'; g.fillText('BOT', cx, ty);
        g.font = '600 12px Rubik, Segoe UI, Arial';
      }
    }
  },
};
