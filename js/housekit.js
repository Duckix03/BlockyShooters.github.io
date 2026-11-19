// Kit de casas: gera o modelo de uma construção em coordenadas locais (origem = centro do piso, y = 0 no piso).
// Não depende do mundo: o mesmo modelo é usado no mapa e na página de pré-visualização (house-preview.html).
//
// Regra anti-pisca (z-fighting): duas faces visíveis viradas para o mesmo lado NUNCA ficam no mesmo plano.
// Toda peça decorativa sobressai pelo menos 3 cm da parede ou fica escondida dentro de outra peça;
// o vidro fica no meio da espessura da parede, dentro do caixilho. Confira com tools/zcheck.js.
'use strict';
window.LS = window.LS || {};
LS.GLASS = 0x9fd8fe;
LS.HouseKit = {
  T: 0.3,         // espessura das paredes
  KINDS: ['casa', 'loja', 'galpao', 'fazenda'],
  STYLE: {
    casa: {
      walls: [0xe8dcc4, 0xd9a07a, 0xb7c9a8, 0xc9c3d6, 0xe6c26e, 0xa7c4d9, 0xf0f0f0, 0xd8b8a0],
      roofs: [0x8a3b2a, 0x5a4a42, 0x3d5a6b, 0x6b4a2a, 0x4a6a3a], trims: [0x5a4632, 0xf2efe6, 0x3a4a5a, 0x6a3a2a],
      doors: [0x7a4a2a, 0x2f5a3a, 0x8a2a2a, 0x2a3a5a], pitch: 0.5, H: 3.0
    },
    loja: {
      walls: [0xd8d2c4, 0xc96a4a, 0x6a8aa8, 0xe8c070, 0x9ab89a, 0xb08a6a],
      roofs: [0x4a4a4a, 0x5a4a42, 0x3d5a6b], trims: [0xf2efe6, 0x2a2a2a, 0x5a4632],
      doors: [0x2a2a2a, 0x5a3a20, 0x1f3f5f], awnings: [0xc0392b, 0x2e7d32, 0x1f5fa8, 0xe0a020, 0x7a2a6a], pitch: 0.45, H: 3.0
    },
    galpao: {
      walls: [0x9a3a2a, 0x7a5a3a, 0x8a8a7a, 0x6a7a5a, 0xa8452e],
      roofs: [0x5a5a5a, 0x7a7a78, 0x4a3a2a], trims: [0xf0ece0, 0x3a2a1a],
      doors: [0x6a4a2a, 0xf0ece0, 0x8a3020], pitch: 0.62, H: 4.0
    },
    fazenda: {
      walls: [0xf0ece0, 0xe8dcc4, 0xd8c8a0, 0xa7c4d9, 0xc9b38a, 0xb7c9a8],
      roofs: [0x8a3b2a, 0x4a6a3a, 0x5a4a42, 0x3d5a6b], trims: [0xffffff, 0x5a4632, 0x3a5a3a],
      doors: [0x8a2a2a, 0x2f5a3a, 0x7a4a2a], pitch: 0.55, H: 3.0
    }
  },
  CEILING: 0xb89a74, FLOOR: 0x9a7a55, STONE: 0x8a8580, WOOD: 0x8a6a4a, BASES: [0x7a7470, 0x6a5a4a, 0x9a9088, 0x5a5a5e],

  rand(a, b) { return a + Math.random() * (b - a); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  // spec: { w, d, kind, twoStory, doorSide (0 norte -z, 1 sul +z, 2 oeste -x, 3 leste +x) }
  build(spec) {
    const K = this, t = K.T, h2 = t / 2, w = spec.w, d = spec.d;
    const kind = K.STYLE[spec.kind] ? spec.kind : 'casa', ST = K.STYLE[kind];
    const wallCol = spec.wallCol || K.pick(ST.walls), roofCol = spec.roofCol || K.pick(ST.roofs);
    const trimCol = K.pick(ST.trims.filter(c => c !== wallCol)), baseCol = K.pick(K.BASES);
    const twoStory = (kind === 'casa' || kind === 'fazenda') && !!spec.twoStory && w >= 9.5 && d >= 8;
    let doorSide = spec.doorSide !== undefined ? spec.doorSide : Math.floor(Math.random() * 4);
    if (twoStory && doorSide === 0) doorSide = 1; // a escada fica na parede norte
    const out = { boxes: [], tris: { pos: [], col: [] }, colliders: [], loot: [], w, d, kind, twoStory, doorSide, wallCol, trimCol,
      ext: { minX: -w / 2 - 0.5, maxX: w / 2 + 0.5, minZ: -d / 2 - 0.5, maxZ: d / 2 + 0.5 } };
    const box = (x, y, z, bw, bh, bd, color, collide = true, shadow = true) => { if (bw > 0.01 && bh > 0.01 && bd > 0.01) out.boxes.push({ x, y, z, w: bw, h: bh, d: bd, color, collide, shadow }); };
    const c3 = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    const tri = (a, b, c, hex) => { const k = c3(hex); out.tris.pos.push(...a, ...b, ...c); out.tris.col.push(...k, ...k, ...k); };
    const quad = (a, b, c, e, hex) => { tri(a, b, c, hex); tri(a, c, e, hex); };
    const wallTex = kind === 'galpao' ? 'planks' : kind === 'loja' ? 'brick' : 'plaster';
    out.wallTex = wallTex; out.gables = { pos: [], col: [] }; // oitões ficam numa malha à parte (com a textura da parede)
    const gtri = (a, b, c, hex) => { const k = c3(hex); out.gables.pos.push(...a, ...b, ...c); out.gables.col.push(...k, ...k, ...k); };

    // caixa em coordenadas da parede: u = ao longo da parede, n = normal (+z na parede 'x', +x na parede 'z')
    const wb = (axis, xc, y0, zc, u0, u1, yb, yt, n0, n1, col, collide = false, shadow = true) => {
      if (u0 > u1) [u0, u1] = [u1, u0]; if (n0 > n1) [n0, n1] = [n1, n0];
      const um = (u0 + u1) / 2, nm = (n0 + n1) / 2;
      if (axis === 'x') box(xc + um, y0 + yb, zc + nm, u1 - u0, yt - yb, n1 - n0, col, collide, shadow);
      else box(xc + nm, y0 + yb, zc + um, n1 - n0, yt - yb, u1 - u0, col, collide, shadow);
    };
    // lados: 0 norte, 1 sul, 2 oeste, 3 leste -> eixo, centro e sinal para fora
    const SIDE = s => ({ axis: s < 2 ? 'x' : 'z', xc: s === 2 ? -w / 2 : s === 3 ? w / 2 : 0, zc: s === 0 ? -d / 2 : s === 1 ? d / 2 : 0, out: s % 2 ? 1 : -1, half: (s < 2 ? w : d) / 2 + h2 });

    // ---- janela: peitoril, moldura externa e interna, caixilho, travessas e vidro recuado ----
    const windowDecor = (axis, xc, y0, zc, a, b, bot, top, vitrine) => {
      wb(axis, xc, y0, zc, a - 0.08, b + 0.08, bot - 0.06, bot + 0.03, -h2 - 0.06, h2 + 0.06, trimCol);  // peitoril (cobre o topo da parede)
      for (const s of [1, -1]) {
        wb(axis, xc, y0, zc, a - 0.09, a + 0.02, bot + 0.03, top, s * (h2 - 0.02), s * (h2 + 0.035), trimCol);
        wb(axis, xc, y0, zc, b - 0.02, b + 0.09, bot + 0.03, top, s * (h2 - 0.02), s * (h2 + 0.035), trimCol);
        wb(axis, xc, y0, zc, a - 0.09, b + 0.09, top - 0.02, top + 0.09, s * (h2 - 0.02), s * (h2 + 0.04), trimCol);
      }
      wb(axis, xc, y0, zc, a, a + 0.06, bot + 0.03, top - 0.06, -0.06, 0.06, trimCol);  // caixilho
      wb(axis, xc, y0, zc, b - 0.06, b, bot + 0.03, top - 0.06, -0.06, 0.06, trimCol);
      wb(axis, xc, y0, zc, a, b, top - 0.06, top, -0.06, 0.06, trimCol);
      const mu = (a + b) / 2, my = (bot + top) / 2;
      wb(axis, xc, y0, zc, mu - 0.025, mu + 0.025, bot + 0.03, top - 0.06, -0.035, 0.035, trimCol);
      if (!vitrine) wb(axis, xc, y0, zc, a + 0.06, b - 0.06, my - 0.025, my + 0.025, -0.03, 0.03, trimCol);
      wb(axis, xc, y0, zc, a + 0.03, b - 0.03, bot + 0.01, top - 0.03, -0.012, 0.012, LS.GLASS, false, false);
    };
    // ---- porta: só o vão com batente e soleira (sem folha: não atrapalha a passagem nem a mira) ----
    const doorDecor = (axis, xc, y0, zc, a, b, top, inn) => {
      wb(axis, xc, y0, zc, a - 0.06, a + 0.08, 0, top, -h2 - 0.03, h2 + 0.03, trimCol);
      wb(axis, xc, y0, zc, b - 0.08, b + 0.06, 0, top, -h2 - 0.03, h2 + 0.03, trimCol);
      wb(axis, xc, y0, zc, a - 0.07, b + 0.07, top - 0.08, top + 0.08, -h2 - 0.04, h2 + 0.04, trimCol);
      wb(axis, xc, y0, zc, a + 0.08, b - 0.08, -0.04, 0.03, -h2, h2, K.STONE, false, false);       // soleira
    };

    // ---- paredes com aberturas ----
    // axis 'x': parede ao longo de X centrada em z = zc; axis 'z': ao longo de Z centrada em x = xc
    const wall = (axis, xc, y0, zc, len, h, openings) => {
      const inn = axis === 'x' ? -Math.sign(zc) : -Math.sign(xc);
      const seg = (a, b, yb, yt) => { if (b - a > 0.02 && yt - yb > 0.02) wb(axis, xc, y0, zc, a, b, yb, yt, -h2, h2, wallCol, true); };
      let cur = -len / 2;
      openings.sort((p, q) => p.pos - q.pos).forEach(o => {
        const a = o.pos - o.w / 2, b = o.pos + o.w / 2;
        seg(cur, a, 0, h); seg(a, b, 0, o.bottom); seg(a, b, o.top, h);
        if (o.glass) windowDecor(axis, xc, y0, zc, a, b, o.bottom, o.top, o.vitrine);
        if (o.door) doorDecor(axis, xc, y0, zc, a, b, o.top, inn);
        cur = b;
      });
      seg(cur, len / 2, 0, h);
    };
    const WIN = kind === 'galpao' ? { ww: 1.0, bot: 2.7, top: 3.4, step: 4.0 } : { ww: 1.2, bot: 1.0, top: 2.1, step: 3.2 };
    const DOOR = kind === 'galpao' ? { w: 3.0, top: 3.2 } : kind === 'loja' ? { w: 1.6, top: 2.4 } : { w: 1.3, top: 2.4 };
    const windows = (len, doorPos, front, skip) => {
      const o = [];
      if (front && kind === 'loja') { // vitrines dos dois lados da porta
        for (const sg of [-1, 1]) {
          let vw = 2.2; const edge = doorPos + sg * (DOOR.w / 2 + 0.5);
          if (Math.abs(edge) + vw + 0.09 > len / 2 - 0.45) vw = len / 2 - 0.45 - 0.09 - Math.abs(edge);
          if (vw > 0.9) o.push({ pos: edge + sg * vw / 2, w: vw, bottom: 0.5, top: 2.3, glass: true, vitrine: true });
        }
      } else {
        const n = Math.max(1, Math.floor((len - 1.2) / WIN.step)), clear = kind === 'galpao' ? DOOR.w + WIN.ww / 2 + 0.3 : DOOR.w / 2 + WIN.ww / 2 + 0.45;
        for (let i = 0; i < n; i++) {
          const p = -len / 2 + (i + 0.5) * len / n;
          if (doorPos !== null && Math.abs(p - doorPos) < clear) continue;
          if (Math.abs(p) > len / 2 - 1.1) continue; // longe dos cantos (cantoneiras)
          if (skip && p + WIN.ww / 2 + 0.1 > skip[0] && p - WIN.ww / 2 - 0.1 < skip[1]) continue; // atrás da escada
          o.push({ pos: p, w: WIN.ww, bottom: WIN.bot, top: WIN.top, glass: true });
        }
      }
      if (doorPos !== null) o.push({ pos: doorPos, w: DOOR.w, bottom: 0, top: DOOR.top, door: true });
      return o;
    };
    // paredes norte/sul cobrem os cantos (w + t); oeste/leste ficam entre elas (d - t)
    const floorWalls = (y0, h, withDoor) => {
      const lenX = w + t, lenZ = d - t;
      const dp = s => !withDoor || s !== doorSide ? null : (kind === 'galpao' || kind === 'loja') ? 0 : K.rand(-1, 1) * Math.min(1.2, (s < 2 ? lenX : lenZ) / 4);
      const p = [dp(0), dp(1), dp(2), dp(3)];
      for (let s = 0; s < 4; s++) { const S = SIDE(s), len = s < 2 ? lenX : lenZ; wall(S.axis, S.xc, y0, S.zc, len, h, windows(len, p[s], withDoor && s === doorSide, twoStory && y0 === 0 && s === 0 ? [-w / 2, -w / 2 + 5.6] : null)); }
      return p[doorSide];
    };
    // anel externo colado nas paredes (rodapé, faixa entre andares); gap = abertura no lado da porta
    const ring = (yb, yt, p, col, gapPos) => {
      const n0 = h2 - 0.02, n1 = h2 + p;
      for (let s = 0; s < 4; s++) {
        const S = SIDE(s), half = s < 2 ? w / 2 + h2 + p : d / 2 + h2 - 0.02;
        const parts = gapPos !== undefined && gapPos !== null && s === doorSide ? [[-half, gapPos - DOOR.w / 2 - 0.07], [gapPos + DOOR.w / 2 + 0.07, half]] : [[-half, half]];
        for (const [u0, u1] of parts) if (u1 - u0 > 0.05) wb(S.axis, S.xc, 0, S.zc, u0, u1, yb, yt, S.out * n0, S.out * n1, col, false);
      }
    };

    const H1 = ST.H, slabT = 0.25;
    box(0, -0.02, 0, w - t, 0.06, d - t, K.FLOOR, false, false); // piso
    // no sobrado o térreo sobe até o topo da laje: não sobra fresta entre os andares
    const doorPos = floorWalls(0, twoStory ? H1 + slabT : H1, true);
    ring(-0.04, 0.42, 0.04, baseCol, doorPos); // rodapé de pedra
    const D = SIDE(doorSide), nx = doorSide === 2 ? -1 : doorSide === 3 ? 1 : 0, nz = doorSide === 0 ? -1 : doorSide === 1 ? 1 : 0;
    const dx = nx ? nx * w / 2 : doorPos, dz = nz ? nz * d / 2 : doorPos;
    const onDoor = (u0, u1, yb, yt, n0, n1, col, collide = false, shadow = true) => wb(D.axis, D.xc, 0, D.zc, u0, u1, yb, yt, D.out * n0, D.out * n1, col, collide, shadow);

    if (kind === 'casa') { // degrau (entra na soleira: nada encosta no mesmo plano)
      onDoor(doorPos - 0.9, doorPos + 0.9, -0.15, 0.0, h2 - 0.05, h2 + 0.88, 0x8a8a8a, false, false);
    } else if (kind === 'loja') { // toldo largo listrado + degrau
      const awn = K.pick(ST.awnings);
      onDoor(-D.half - 0.1, D.half + 0.1, 2.55, 2.67, h2 - 0.02, h2 + 1.5, awn);
      onDoor(-D.half - 0.1, D.half + 0.1, 2.67, 2.71, h2 + 1.3, h2 + 1.5, 0xf2efe6, false, false); // barrado
      onDoor(doorPos - 1.1, doorPos + 1.1, -0.15, 0.0, h2 - 0.05, h2 + 0.88, 0x8a8a8a, false, false);
    } else if (kind === 'fazenda') { // varanda com piso, pilares, guarda-corpo e cobertura
      const P = 2.2, half = D.half, rail = (u0, u1) => { if (u1 - u0 > 0.1) { onDoor(u0, u1, 0.82, 0.92, h2 + P - 0.16, h2 + P - 0.08, trimCol, true); onDoor(u0, u1, 0.32, 0.38, h2 + P - 0.15, h2 + P - 0.09, trimCol); } };
      onDoor(-half, half, -0.06, 0.04, h2, h2 + P, K.WOOD, true, false);           // assoalho
      onDoor(-half + 0.05, half - 0.05, -0.6, -0.06, h2 + 0.02, h2 + P - 0.05, 0x5a4a3a, false, false); // saia por baixo
      onDoor(-half - 0.15, half + 0.15, 2.55, 2.67, h2 - 0.02, h2 + P + 0.15, roofCol); // cobertura
      const posts = Math.max(2, Math.round(half * 2 / 2.4) + 1);
      for (let i = 0; i < posts; i++) { const u = -half + 0.1 + i * (half * 2 - 0.2) / (posts - 1); if (Math.abs(u - doorPos) < 0.98) continue; onDoor(u - 0.08, u + 0.08, 0.04, 2.55, h2 + P - 0.2, h2 + P - 0.04, trimCol, true); }
      rail(-half + 0.18, doorPos - 0.9); rail(doorPos + 0.9, half - 0.18);
      for (const e of [-1, 1]) { // guarda-corpo das laterais
        const u = e * (half - 0.1);
        onDoor(u - 0.04, u + 0.04, 0.82, 0.92, h2 + 0.02, h2 + P - 0.2, trimCol, true); onDoor(u - 0.03, u + 0.03, 0.32, 0.38, h2 + 0.02, h2 + P - 0.2, trimCol);
      }
      onDoor(doorPos - 0.8, doorPos + 0.8, -0.4, -0.05, h2 + P, h2 + P + 0.4, K.WOOD, true, false); // degrau
      const e = out.ext;
      if (doorSide === 0) e.minZ -= P + 0.4; else if (doorSide === 1) e.maxZ += P + 0.4; else if (doorSide === 2) e.minX -= P + 0.4; else e.maxX += P + 0.4;
    }

    let top = H1;
    if (twoStory) {
      // escada encostada na parede norte, subindo no sentido +x
      const steps = 12, rise = (H1 + slabT) / steps, run = 0.42, sw = 1.25;
      const sx0 = -w / 2 + h2 + 0.15, sz0 = -d / 2 + h2;
      for (let i = 0; i < steps; i++) box(sx0 + i * run + run / 2, 0, sz0 + sw / 2, run, rise * (i + 1), sw, 0x8a6a4a);
      const holeX1 = sx0 + steps * run, slabY = H1, inX = w / 2 - h2, inZ = d / 2 - h2;
      box(0, slabY, (sz0 + sw + inZ) / 2, w - t, slabT, inZ - (sz0 + sw), K.FLOOR);           // laje principal
      box((holeX1 + inX) / 2, slabY, sz0 + sw / 2, inX - holeX1, slabT, sw, K.FLOOR);         // laje ao lado da abertura
      // forro 1 cm abaixo da laje (faces opostas, nunca no mesmo plano)
      box(0, slabY - 0.05, (sz0 + sw + inZ) / 2, w - t, 0.04, inZ - (sz0 + sw), K.CEILING, false, false);
      box((holeX1 + inX) / 2, slabY - 0.05, sz0 + sw / 2, inX - holeX1, 0.04, sw, K.CEILING, false, false);
      box((sx0 + holeX1) / 2 - 0.5, slabY + slabT, sz0 + sw + 0.05, holeX1 - sx0 - 1.0, 0.9, 0.08, trimCol); // guarda-corpo
      const y1 = slabY + slabT, H2 = 2.9;
      floorWalls(y1, H2, false);
      ring(slabY - 0.06, y1 + 0.06, 0.05, trimCol); // faixa entre andares: anel externo, não um bloco maciço
      out.loot.push({ x: K.rand(-w / 2 + 1.5, w / 2 - 1.5), y: y1 + 0.05, z: K.rand(0.5, d / 2 - 1.2) });
      out.loot.push({ x: K.rand(-w / 2 + 1.5, w / 2 - 1.5), y: y1 + 0.05, z: K.rand(0.5, d / 2 - 1.2) });
      this.furniture(box, w / 2 - 1.4, y1, d / 2 - 1.1, K.pick(['cama', 'estante', 'caixas']), 1);
      top = y1 + H2;
    }
    // cantoneiras: só do lado de fora (6 cm), por dentro ficam escondidas na parede (sem "poste" no canto do cômodo)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (w / 2 + 0.05), 0, sz * (d / 2 + 0.05), t + 0.02, top - 0.03, t + 0.02, trimCol, false);

    // ---- móveis (cantos longe da porta e da escada) ----
    const kinds = { casa: ['cama', 'mesa', 'sofá', 'estante', 'geladeira', 'caixas'], fazenda: ['cama', 'mesa', 'sofá', 'estante', 'fogão', 'caixas'],
      loja: ['prateleira', 'prateleira', 'geladeira', 'caixas'], galpao: ['feno', 'feno', 'caixas', 'barril'] }[kind];
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].filter(([sx, sz]) => !(twoStory && sz === -1) && !(nx && sx === nx) && !(nz && sz === nz));
    corners.sort(() => Math.random() - 0.5).slice(0, 2 + (Math.random() < 0.4 ? 1 : 0))
      .forEach(([sx, sz]) => this.furniture(box, sx * (w / 2 - 1.3), 0, sz * (d / 2 - 1.0), K.pick(kinds), sz));
    if (kind === 'loja') this.furniture(box, -nx * (w / 2 - 2.2), 0, -nz * (d / 2 - 2.0), 'balcão');
    for (let i = 0; i < 2 + (Math.random() < 0.5 ? 1 : 0); i++) out.loot.push({ x: K.rand(-w / 2 + 1.3, w / 2 - 1.3), y: 0.1, z: K.rand(0, d / 2 - 1.3) });

    // ---- telhado de duas águas (malha fechada: telha por cima, forro por baixo, oitões nas pontas) ----
    // a loja vira o oitão para a frente e esconde o telhado atrás de uma fachada falsa
    const alongX = kind === 'loja' ? doorSide >= 2 : w >= d;
    const L = alongX ? w : d, S = alongX ? d : w; // L = comprimento da cumeeira, S = vão
    const P = (a, y, b) => alongX ? [a, y, b] : [b, y, a];        // converte do quadro "cumeeira em X" para o local
    const tanA = Math.tan(ST.pitch), o = 0.5, oL = kind === 'loja' ? 0.1 : o, th = 0.18;
    const hl = L / 2 + oL, hs = S / 2 + o, r = (S / 2) * tanA, ridge = top + r, eave = top - o * tanA;
    for (const sg of [1, -1]) {
      quad(P(-hl, eave + th, sg * hs), P(hl, eave + th, sg * hs), P(hl, ridge + th, 0), P(-hl, ridge + th, 0), roofCol); // telha
      quad(P(-hl, eave, sg * hs), P(hl, eave, sg * hs), P(hl, ridge, 0), P(-hl, ridge, 0), K.CEILING);                   // forro
      quad(P(-hl, eave, sg * hs), P(hl, eave, sg * hs), P(hl, eave + th, sg * hs), P(-hl, eave + th, sg * hs), trimCol);  // beiral
      for (const e of [1, -1]) quad(P(e * hl, eave, sg * hs), P(e * hl, eave + th, sg * hs), P(e * hl, ridge + th, 0), P(e * hl, ridge, 0), trimCol);
    }
    // oitões (triângulos com espessura da parede)
    const frontE = kind === 'loja' ? (doorSide === 1 || doorSide === 3 ? 1 : -1) : 0; // na loja a fachada falsa já cobre o oitão da frente
    for (const e of [1, -1]) for (const f of [h2, -h2]) {
      if (e === frontE) continue;
      const x = e * (L / 2) + f;
      gtri(P(x, top, -S / 2 - h2), P(x, top, S / 2 + h2), P(x, ridge, 0), wallCol);
    }
    if (kind === 'loja') { // fachada falsa (2 cm mais grossa que a parede) + placa
      const fTop = ridge + th + 0.35;
      onDoor(-D.half - 0.03, D.half + 0.03, H1 - 0.3, fTop, -h2 - 0.04, h2 + 0.04, wallCol);
      onDoor(-D.half - 0.05, D.half + 0.05, fTop, fTop + 0.1, -h2 - 0.08, h2 + 0.08, trimCol); // arremate
      const sw = Math.min(3.2, D.half * 2 - 1.2);
      onDoor(-sw / 2, sw / 2, H1 + 0.35, H1 + 1.15, h2 + 0.02, h2 + 0.1, trimCol);
      onDoor(-sw / 2 + 0.12, sw / 2 - 0.12, H1 + 0.47, H1 + 1.03, h2 + 0.1, h2 + 0.13, K.pick([0xf2efe6, 0xffd24a, 0x9fe0ff]), false, false);
    }
    // vigas aparentes segurando o beiral das empenas (cumeeira + duas terças), encaixadas logo abaixo do forro
    if (kind !== 'loja') for (const e of [1, -1]) for (const n of [0, -(S / 2 - 0.45), S / 2 - 0.45]) {
      const yTop = ridge - (Math.abs(n) + 0.06) * tanA - 0.01, a0 = L / 2 - 0.05, a1 = hl - 0.06;
      const [x0, , z0] = P(e * (a0 + a1) / 2, 0, n), lw = a1 - a0;
      box(x0, yTop - 0.16, z0, alongX ? lw : 0.12, 0.16, alongX ? 0.12 : lw, trimCol, false);
    }
    // chaminé apoiada no telhado (não atravessa o forro)
    if ((kind === 'casa' || kind === 'fazenda') && Math.random() < 0.6) {
      // em cima da cumeeira: o forro é mais alto ali, então a chaminé não aparece por dentro
      const ca = L / 4 * (Math.random() < 0.5 ? 1 : -1), base = ridge - 0.02, ch = 1.2;
      const [px, , pz] = P(ca, 0, 0);
      box(px, base, pz, 0.7, ch, 0.7, 0x8a4a3a, false);
      box(px, base + ch, pz, 0.84, 0.12, 0.84, 0x5a3a2a, false); // topo da chaminé
    }
    out.colliders.push({ minX: -w / 2 - 0.2, minY: top, minZ: -d / 2 - 0.2, maxX: w / 2 + 0.2, maxY: top + r * 0.6, maxZ: d / 2 + 0.2 });
    for (const b of out.boxes) if (b.color === wallCol) b.tex = wallTex;
    out.top = top; out.ridge = ridge; out.doorPos = doorPos;
    return out;
  },

  // cerca em volta do quintal (fazenda). hAt(x, z) = altura do chão em coordenadas locais.
  // Devolve caixas no mesmo formato de build(); o portão fica na frente da porta.
  fence(m, hAt, pad = 4.5) {
    const out = [], col = 0xd8ccb0, post = 0x8a6a4a;
    const x0 = m.ext.minX - pad + 0.5, x1 = m.ext.maxX + pad - 0.5, z0 = m.ext.minZ - pad + 0.5, z1 = m.ext.maxZ + pad - 0.5;
    const gate = { side: m.doorSide, pos: m.doorPos || 0, half: 1.3 };
    const seen = new Set(), postAt = (x, z) => { // um poste por ponto (cantos e portão não duplicam)
      const k = x.toFixed(2) + ',' + z.toFixed(2); if (seen.has(k)) return; seen.add(k);
      out.push({ x, y: hAt(x, z) - 0.3, z, w: 0.14, h: 1.3, d: 0.14, color: post, collide: false, shadow: true });
    };
    const line = (s, ax0, az0, ax1, az1) => { // segmento reto ao longo de X ou Z
      const alongX = az0 === az1, len = alongX ? ax1 - ax0 : az1 - az0, n = Math.max(1, Math.round(len / 2.4));
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n;
        const pa = [ax0 + (ax1 - ax0) * a, az0 + (az1 - az0) * a], pb = [ax0 + (ax1 - ax0) * b, az0 + (az1 - az0) * b];
        const mid = alongX ? (pa[0] + pb[0]) / 2 : (pa[1] + pb[1]) / 2;
        if (s === gate.side && Math.abs(mid - gate.pos) < gate.half) continue;
        postAt(pa[0], pa[1]); postAt(pb[0], pb[1]);
        const lo = Math.min(hAt(pa[0], pa[1]), hAt(pb[0], pb[1]));
        const L = (alongX ? pb[0] - pa[0] : pb[1] - pa[1]) - 0.04, cx = (pa[0] + pb[0]) / 2, cz = (pa[1] + pb[1]) / 2;
        for (const [y, hh, c] of [[0.75, 0.1, true], [0.35, 0.08, false]])
          out.push({ x: cx, y: lo + y, z: cz, w: alongX ? L : 0.06, h: hh, d: alongX ? 0.06 : L, color: col, collide: c, shadow: true });
      }
    };
    line(0, x0, z0, x1, z0); line(1, x0, z1, x1, z1); line(2, x0, z0, x0, z1); line(3, x1, z0, x1, z1);
    return out;
  },

  furniture(box, x, y0, z, kind, face = -1) {
    const wood = 0x7a5232, dark = 0x4a3222, f = face >= 0 ? 1 : -1;
    if (kind === 'cama') { box(x, y0, z, 2.0, 0.45, 1.1, wood); box(x, y0 + 0.45, z, 1.9, 0.15, 1.0, 0xe8e8f0, false); box(x - 0.7, y0 + 0.6, z, 0.4, 0.12, 0.8, 0xffffff, false); box(x - 0.98, y0, z, 0.1, 0.95, 1.18, dark); } // cabeceira
    else if (kind === 'mesa') { box(x, y0 + 0.7, z, 1.4, 0.08, 0.9, wood); box(x, y0, z, 0.15, 0.7, 0.15, dark); box(x + 0.85, y0, z, 0.45, 0.5, 0.45, dark); }
    else if (kind === 'sofá') { box(x, y0, z, 1.9, 0.45, 0.85, 0x7a3a3a); box(x, y0 + 0.45, z + f * 0.33, 1.9, 0.5, 0.2, 0x6a2a2a, false); }
    else if (kind === 'estante') box(x, y0, z, 1.1, 2.0, 0.45, dark);
    else if (kind === 'geladeira') box(x, y0, z, 0.8, 1.8, 0.7, 0xeeeeee);
    else if (kind === 'fogão') { box(x, y0, z, 0.8, 0.9, 0.7, 0x3a3a3a); box(x, y0 + 0.9, z, 0.7, 0.04, 0.6, 0x1a1a1a, false); }
    else if (kind === 'caixas') { box(x, y0, z, 0.8, 0.8, 0.8, 0xa07a4a); box(x + 0.1, y0 + 0.8, z, 0.6, 0.6, 0.6, 0x8a6a3a); }
    else if (kind === 'feno') { box(x, y0, z, 1.2, 0.6, 0.8, 0xd8b85a); box(x + 0.05, y0 + 0.6, z + 0.05, 1.1, 0.55, 0.7, 0xc8a84a); }
    else if (kind === 'barril') { box(x - 0.35, y0, z, 0.6, 0.9, 0.6, 0x6a4a2a); box(x + 0.4, y0, z + 0.1, 0.6, 0.9, 0.6, 0x5a3a20); }
    else if (kind === 'prateleira') { box(x, y0, z, 1.6, 1.9, 0.35, dark); for (const y of [0.5, 1.1, 1.6]) box(x, y0 + y, z, 1.5, 0.22, 0.5, Math.random() < 0.5 ? 0xc0392b : 0x2e7d32, false); }
    else if (kind === 'balcão') { box(x, y0, z, 2.2, 1.0, 0.7, wood); box(x, y0 + 1.0, z, 2.3, 0.06, 0.8, dark); }
  }
};
