// Visual de personagem em blocos: texturas pixeladas geradas por código (atlas 64x64)
'use strict';
LS.Skin = {
  PX: 1.8 / 32, // tamanho de 1 "pixel" em metros
  SKINS: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#5c3a21'],
  HAIRS: ['#1a1a1a', '#4a2a10', '#8a5a2a', '#d8b860', '#a0301a', '#e8e8e8', '#3a60c0', '#d040a0'],
  SHIRTS: ['#ff8a1f', '#3a6ea5', '#b03030', '#2d7a3a', '#6a3a9a', '#2a2a2a', '#e0e0e0', '#d0b020', '#2d8a8a'],
  PANTS: ['#2a2a3a', '#3a4a2a', '#4a3a2a', '#1f2f6f', '#555555', '#7a5a3a', '#111111'],
  EYES: ['#2a5aa0', '#3a2a1a', '#2a8a3a', '#555555'],
  HAIR_STYLES: ['curto', 'longo', 'careca', 'moicano', 'boné'],
  PATTERNS: ['liso', 'listras', 'zíper', 'camuflado', 'faixa'],
  // posição de cada parte no atlas: [x, y, largura, altura, profundidade] em pixels
  PARTS: { head: [0, 0, 8, 8, 8], body: [0, 16, 8, 12, 4], arm: [24, 16, 4, 12, 4], leg: [40, 16, 4, 12, 4] },

  randomLook() {
    const p = LS.util.pick;
    return { skin: p(this.SKINS), hair: p(this.HAIRS), hairStyle: p(this.HAIR_STYLES), eyes: p(this.EYES),
      shirt: p(this.SHIRTS), pattern: p(this.PATTERNS), pants: p(this.PANTS) };
  },

  // retângulos das 6 faces de uma parte, na ordem das faces do BoxGeometry (+x, -x, +y, -y, +z, -z)
  faceRects(part) {
    const [ox, oy, w, h, d] = this.PARTS[part];
    return [
      [ox + d + w, oy + d, d, h], // +x (lado esquerdo do personagem)
      [ox, oy + d, d, h],         // -x (lado direito)
      [ox + d, oy, w, d],         // topo
      [ox + d + w, oy, w, d],     // base
      [ox + d, oy + d, w, h],     // frente (+z)
      [ox + 2 * d + w, oy + d, w, h] // costas
    ];
  },
  // geometria em caixa com UVs apontando para o atlas (compartilhada por todos)
  geoCache: {},
  geometry(part, pivot) {
    const k = part + pivot;
    if (this.geoCache[k]) return this.geoCache[k];
    const [, , w, h, d] = this.PARTS[part], S = this.PX;
    const g = new THREE.BoxGeometry(w * S, h * S, d * S);
    const uv = g.attributes.uv, rects = this.faceRects(part);
    for (let f = 0; f < 6; f++) {
      const [x0, y0, rw, rh] = rects[f];
      for (let i = 0; i < 4; i++) {
        const idx = f * 4 + i, ix = uv.getX(idx), iy = 1 - uv.getY(idx);
        uv.setXY(idx, (x0 + ix * rw) / 64, 1 - (y0 + iy * rh) / 64);
      }
    }
    if (pivot === 'bottom') g.translate(0, h * S / 2, 0);
    if (pivot === 'top') g.translate(0, -h * S / 2, 0);
    this.geoCache[k] = g;
    return g;
  },

  // ---------- pintura ----------
  paint(canvas, look, seed) {
    const ctx = canvas.getContext('2d');
    let s = seed || 1;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const col = (hex, k) => { const c = new THREE.Color(hex).multiplyScalar(k); c.r = Math.min(1, c.r); c.g = Math.min(1, c.g); c.b = Math.min(1, c.b); return '#' + c.getHexString(); };
    const px = (x, y, hex, noise = 0.1) => { ctx.fillStyle = col(hex, 1 + (rnd() - 0.5) * noise * 2); ctx.fillRect(x, y, 1, 1); };
    const rect = (r, hex, noise, rows) => { // pinta um retângulo de face (rows = [início, fim] opcional)
      const [x0, y0, w, h] = r, a = rows ? rows[0] : 0, b = rows ? rows[1] : h;
      for (let y = a; y < b; y++) for (let x = 0; x < w; x++) px(x0 + x, y0 + y, hex, noise);
    };
    ctx.clearRect(0, 0, 64, 64);
    // ---- cabeça ----
    const H = this.faceRects('head'), F = H[4];
    H.forEach(r => rect(r, look.skin, 0.05));
    const hair = look.hairStyle === 'boné' ? col(look.shirt, 0.7) : look.hair;
    const st = look.hairStyle;
    if (st === 'curto' || st === 'boné') {
      rect(H[2], hair, 0.15); rect(F, hair, 0.15, [0, st === 'boné' ? 2 : 1]);
      rect(H[0], hair, 0.15, [0, st === 'boné' ? 2 : 3]); rect(H[1], hair, 0.15, [0, st === 'boné' ? 2 : 3]); rect(H[5], hair, 0.15, [0, st === 'boné' ? 3 : 5]);
      if (st === 'curto') { px(F[0], F[1] + 1, hair); px(F[0] + 7, F[1] + 1, hair); }
    } else if (st === 'longo') {
      rect(H[2], hair, 0.15); rect(F, hair, 0.15, [0, 2]); rect(H[0], hair, 0.15); rect(H[1], hair, 0.15); rect(H[5], hair, 0.15);
      for (let y = 2; y < 8; y++) { px(F[0], F[1] + y, hair); px(F[0] + 7, F[1] + y, hair); }
    } else if (st === 'moicano') {
      for (let y = 0; y < 8; y++) { px(H[2][0] + 3, H[2][1] + y, hair); px(H[2][0] + 4, H[2][1] + y, hair); }
      for (let y = 0; y < 6; y++) { px(H[5][0] + 3, H[5][1] + y, hair); px(H[5][0] + 4, H[5][1] + y, hair); }
      px(F[0] + 3, F[1], hair); px(F[0] + 4, F[1], hair);
    }
    // rosto
    const fy = F[1], fx = F[0];
    if (st !== 'careca') { [1, 2, 5, 6].forEach(x => px(fx + x, fy + 3, col(look.hair, 0.8), 0)); }
    px(fx + 1, fy + 4, '#ffffff', 0); px(fx + 2, fy + 4, look.eyes, 0); px(fx + 5, fy + 4, look.eyes, 0); px(fx + 6, fy + 4, '#ffffff', 0);
    px(fx + 3, fy + 5, col(look.skin, 0.85), 0); px(fx + 4, fy + 5, col(look.skin, 0.85), 0);
    [2, 3, 4, 5].forEach(x => px(fx + x, fy + 6, col(look.skin, 0.6), 0));
    // ---- corpo ----
    const B = this.faceRects('body');
    B.forEach(r => rect(r, look.shirt, 0.06));
    const front = B[4];
    if (look.pattern === 'listras') [B[0], B[1], B[4], B[5]].forEach(r => { for (let y = 1; y < r[3] - 1; y += 3) rect(r, col(look.shirt, 1.35), 0.04, [y, y + 1]); });
    else if (look.pattern === 'zíper') { for (let y = 0; y < 11; y++) { px(front[0] + 3, front[1] + y, col(look.shirt, 0.6), 0); px(front[0] + 4, front[1] + y, col(look.shirt, 0.6), 0); } px(front[0] + 4, front[1] + 1, '#c0c0c0', 0); }
    else if (look.pattern === 'camuflado') B.forEach(r => { for (let i = 0; i < r[2] * r[3] / 4; i++) { const x = Math.floor(rnd() * r[2]), y = Math.floor(rnd() * r[3]); const c = rnd() < 0.5 ? 0.7 : 1.25; px(r[0] + x, r[1] + y, col(look.shirt, c)); if (x + 1 < r[2]) px(r[0] + x + 1, r[1] + y, col(look.shirt, c)); } });
    else if (look.pattern === 'faixa') { for (let y = 0; y < 11; y++) { const x = Math.floor(y * 8 / 11); px(front[0] + x, front[1] + y, '#f0f0f0'); if (x + 1 < 8) px(front[0] + x + 1, front[1] + y, '#f0f0f0'); } }
    [B[0], B[1], B[4], B[5]].forEach(r => rect(r, '#3a2412', 0.1, [11, 12])); // cinto
    // ---- braços ----
    const A = this.faceRects('arm');
    A.forEach((r, i) => { if (i === 2) rect(r, look.shirt, 0.06); else if (i === 3) rect(r, look.skin, 0.05); else { rect(r, look.shirt, 0.06, [0, 4]); rect(r, look.skin, 0.05, [4, 12]); } });
    // ---- pernas ----
    const L = this.faceRects('leg');
    L.forEach((r, i) => { if (i === 2) rect(r, look.pants, 0.06); else if (i === 3) rect(r, '#1c1c1c', 0.1); else { rect(r, look.pants, 0.06, [0, 10]); rect(r, '#1c1c1c', 0.12, [10, 12]); } });
  },
  makeTexture(look, seed) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    this.paint(cv, look, seed);
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.userData = { canvas: cv };
    return t;
  }
};

// perfil do jogador (nome + visual), salvo no navegador
LS.defaultProfile = { name: 'Jogador', look: { skin: '#e0ac69', hair: '#1a1a1a', hairStyle: 'curto', eyes: '#3a2a1a', shirt: '#ff8a1f', pattern: 'zíper', pants: '#2a2a3a' } };
LS.playerProfile = JSON.parse(JSON.stringify(LS.defaultProfile));
try {
  const p = JSON.parse(localStorage.getItem('lastsurvivor_profile') || 'null');
  if (p && p.look) { LS.playerProfile.name = String(p.name || 'Jogador').slice(0, 16); Object.assign(LS.playerProfile.look, p.look); }
} catch (e) { /* perfil corrompido: usa o padrão */ }
LS.saveProfile = () => localStorage.setItem('lastsurvivor_profile', JSON.stringify(LS.playerProfile));
