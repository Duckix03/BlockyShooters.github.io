// Kit de casas: gera o modelo de uma casa em coordenadas locais (origem = centro do piso, y = 0 no piso).
// Não depende do mundo: o mesmo modelo é usado no mapa e na página de pré-visualização (house-preview.html).
'use strict';
window.LS = window.LS || {};
LS.GLASS = 0x9fd8fe;
LS.HouseKit = {
  T: 0.3,         // espessura das paredes
  PITCH: 0.5,     // inclinação do telhado (rad)
  WALLS: [0xe8dcc4, 0xd9a07a, 0xb7c9a8, 0xc9c3d6, 0xe6c26e, 0xa7c4d9, 0xf0f0f0, 0xd8b8a0],
  ROOFS: [0x8a3b2a, 0x5a4a42, 0x3d5a6b, 0x6b4a2a, 0x4a6a3a],
  TRIM: 0x5a4632, CEILING: 0xb89a74, FLOOR: 0x9a7a55,

  rand(a, b) { return a + Math.random() * (b - a); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  // spec: { w, d, twoStory, doorSide (0 norte -z, 1 sul +z, 2 oeste -x, 3 leste +x) }
  build(spec) {
    const K = this, t = K.T, w = spec.w, d = spec.d;
    const wallCol = spec.wallCol || K.pick(K.WALLS), roofCol = spec.roofCol || K.pick(K.ROOFS);
    const twoStory = !!spec.twoStory && w >= 9.5 && d >= 8;
    let doorSide = spec.doorSide !== undefined ? spec.doorSide : Math.floor(Math.random() * 4);
    if (twoStory && doorSide === 0) doorSide = 1; // a escada fica na parede norte
    const out = { boxes: [], tris: { pos: [], col: [] }, colliders: [], loot: [], w, d, twoStory, doorSide, wallCol };
    const box = (x, y, z, bw, bh, bd, color, collide = true, shadow = true) => { if (bw > 0.01 && bh > 0.01 && bd > 0.01) out.boxes.push({ x, y, z, w: bw, h: bh, d: bd, color, collide, shadow }); };
    const c3 = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    const tri = (a, b, c, hex) => { const k = c3(hex); out.tris.pos.push(...a, ...b, ...c); out.tris.col.push(...k, ...k, ...k); };
    const quad = (a, b, c, e, hex) => { tri(a, b, c, hex); tri(a, c, e, hex); };

    // ---- paredes com aberturas ----
    // axis 'x': parede ao longo de X centrada em z = zc; axis 'z': ao longo de Z centrada em x = xc
    const wall = (axis, xc, y0, zc, len, h, openings) => {
      const seg = (a, b, yb, yt, col, collide) => {
        if (b - a < 0.02 || yt - yb < 0.02) return;
        const m = (a + b) / 2;
        if (axis === 'x') box(xc + m, y0 + yb, zc, b - a, yt - yb, t, col, collide); else box(xc, y0 + yb, zc + m, t, yt - yb, b - a, col, collide);
      };
      let cur = -len / 2;
      openings.sort((p, q) => p.pos - q.pos).forEach(o => {
        const a = o.pos - o.w / 2, b = o.pos + o.w / 2;
        seg(cur, a, 0, h, wallCol, true); seg(a, b, 0, o.bottom, wallCol, true); seg(a, b, o.top, h, wallCol, true);
        if (o.glass) {
          if (axis === 'x') { box(xc + o.pos, y0 + o.bottom, zc, o.w, o.top - o.bottom, 0.04, LS.GLASS, false, false); box(xc + o.pos, y0 + o.bottom - 0.08, zc, o.w + 0.2, 0.08, t + 0.16, K.TRIM, false); }
          else { box(xc, y0 + o.bottom, zc + o.pos, 0.04, o.top - o.bottom, o.w, LS.GLASS, false, false); box(xc, y0 + o.bottom - 0.08, zc + o.pos, t + 0.16, 0.08, o.w + 0.2, K.TRIM, false); }
        }
        cur = b;
      });
      seg(cur, len / 2, 0, h, wallCol, true);
    };
    const windows = (len, doorPos) => {
      const o = [], n = Math.max(1, Math.floor((len - 1.2) / 3.2));
      for (let i = 0; i < n; i++) {
        const p = -len / 2 + (i + 0.5) * len / n;
        if (doorPos !== null && Math.abs(p - doorPos) < 1.7) continue;
        if (Math.abs(p) > len / 2 - 0.9) continue;
        o.push({ pos: p, w: 1.2, bottom: 1.0, top: 2.1, glass: true });
      }
      if (doorPos !== null) o.push({ pos: doorPos, w: 1.3, bottom: 0, top: 2.4 });
      return o;
    };
    // paredes norte/sul cobrem os cantos (w + t); oeste/leste ficam entre elas (d - t)
    const floorWalls = (y0, h, withDoor) => {
      const lenX = w + t, lenZ = d - t;
      const dp = s => withDoor && s === doorSide ? K.rand(-1, 1) * Math.min(1.2, (s < 2 ? lenX : lenZ) / 4) : null;
      const p = [dp(0), dp(1), dp(2), dp(3)];
      wall('x', 0, y0, -d / 2, lenX, h, windows(lenX, p[0]));
      wall('x', 0, y0, d / 2, lenX, h, windows(lenX, p[1]));
      wall('z', -w / 2, y0, 0, lenZ, h, windows(lenZ, p[2]));
      wall('z', w / 2, y0, 0, lenZ, h, windows(lenZ, p[3]));
      return p[doorSide];
    };

    const H1 = 3.0;
    box(0, -0.02, 0, w - t, 0.06, d - t, K.FLOOR, false, false); // piso
    const doorPos = floorWalls(0, H1, true);
    // toldo + degrau na porta
    const nx = doorSide === 2 ? -1 : doorSide === 3 ? 1 : 0, nz = doorSide === 0 ? -1 : doorSide === 1 ? 1 : 0;
    const dx = nx ? nx * w / 2 : doorPos, dz = nz ? nz * d / 2 : doorPos;
    box(dx + nx * 0.75, 2.6, dz + nz * 0.75, nx ? 1.2 : 2.0, 0.12, nx ? 2.0 : 1.2, roofCol, false);
    box(dx + nx * 0.6, -0.15, dz + nz * 0.6, nx ? 0.9 : 1.8, 0.15, nx ? 1.8 : 0.9, 0x8a8a8a, false, false);

    let top = H1;
    if (twoStory) {
      // escada encostada na parede norte, subindo no sentido +x
      const steps = 12, rise = (H1 + 0.25) / steps, run = 0.42, sw = 1.25;
      const sx0 = -w / 2 + t / 2 + 0.15, sz0 = -d / 2 + t / 2;
      for (let i = 0; i < steps; i++) box(sx0 + i * run + run / 2, 0, sz0 + sw / 2, run, rise * (i + 1), sw, 0x8a6a4a);
      const holeX1 = sx0 + steps * run, slabY = H1, st = 0.25, inX = w / 2 - t / 2, inZ = d / 2 - t / 2;
      box(0, slabY, (sz0 + sw + inZ) / 2, w - t, st, inZ - (sz0 + sw), K.FLOOR);           // laje principal
      box((holeX1 + inX) / 2, slabY, sz0 + sw / 2, inX - holeX1, st, sw, K.FLOOR);           // laje ao lado da abertura
      box(0, slabY - 0.02, (sz0 + sw + inZ) / 2, w - t, 0.02, inZ - (sz0 + sw), K.CEILING, false, false); // forro do térreo
      box((sx0 + holeX1) / 2 - 0.5, slabY + st, sz0 + sw + 0.05, holeX1 - sx0 - 1.0, 0.9, 0.08, K.TRIM); // guarda-corpo
      const y1 = slabY + st, H2 = 2.9;
      floorWalls(y1, H2, false);
      box(0, slabY - 0.1, 0, w + t + 0.2, 0.35, d + 0.2, K.TRIM, false); // faixa externa entre andares
      out.loot.push({ x: K.rand(-w / 2 + 1.5, w / 2 - 1.5), y: y1 + 0.05, z: K.rand(0.5, d / 2 - 1.2) });
      out.loot.push({ x: K.rand(-w / 2 + 1.5, w / 2 - 1.5), y: y1 + 0.05, z: K.rand(0.5, d / 2 - 1.2) });
      this.furniture(box, w / 2 - 1.4, y1, d / 2 - 1.1, K.pick(['cama', 'estante', 'caixas']));
      top = y1 + H2;
    }

    // ---- móveis do térreo (cantos longe da porta e da escada) ----
    const kinds = ['cama', 'mesa', 'sofá', 'estante', 'geladeira', 'caixas'];
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].filter(([sx, sz]) => !(twoStory && sz === -1) && !(nx && sx === nx) && !(nz && sz === nz));
    corners.sort(() => Math.random() - 0.5).slice(0, 2 + (Math.random() < 0.4 ? 1 : 0))
      .forEach(([sx, sz]) => this.furniture(box, sx * (w / 2 - 1.3), 0, sz * (d / 2 - 1.0), K.pick(kinds)));
    for (let i = 0; i < 2 + (Math.random() < 0.5 ? 1 : 0); i++) out.loot.push({ x: K.rand(-w / 2 + 1.3, w / 2 - 1.3), y: 0.1, z: K.rand(0, d / 2 - 1.3) });

    // ---- telhado de duas águas (malha fechada: telha por cima, forro por baixo, oitões nas pontas) ----
    const alongX = w >= d, L = alongX ? w : d, S = alongX ? d : w; // L = comprimento da cumeeira, S = vão
    const P = (a, y, b) => alongX ? [a, y, b] : [b, y, a];        // converte do quadro "cumeeira em X" para o local
    const tanA = Math.tan(K.PITCH), o = 0.5, th = 0.18;
    const hl = L / 2 + o, hs = S / 2 + o, r = (S / 2) * tanA, ridge = top + r, eave = top - o * tanA;
    for (const sg of [1, -1]) {
      quad(P(-hl, eave + th, sg * hs), P(hl, eave + th, sg * hs), P(hl, ridge + th, 0), P(-hl, ridge + th, 0), roofCol); // telha
      quad(P(-hl, eave, sg * hs), P(hl, eave, sg * hs), P(hl, ridge, 0), P(-hl, ridge, 0), K.CEILING);                   // forro
      quad(P(-hl, eave, sg * hs), P(hl, eave, sg * hs), P(hl, eave + th, sg * hs), P(-hl, eave + th, sg * hs), K.TRIM);   // beiral
      for (const e of [1, -1]) quad(P(e * hl, eave, sg * hs), P(e * hl, eave + th, sg * hs), P(e * hl, ridge + th, 0), P(e * hl, ridge, 0), K.TRIM);
    }
    // oitões (triângulos com espessura da parede)
    for (const e of [1, -1]) for (const f of [t / 2, -t / 2]) {
      const x = e * (L / 2) + f;
      tri(P(x, top, -S / 2 - t / 2), P(x, top, S / 2 + t / 2), P(x, ridge, 0), wallCol);
    }
    // chaminé apoiada no telhado (não atravessa o forro)
    if (Math.random() < 0.6) {
      // em cima da cumeeira: o forro é mais alto ali, então a chaminé não aparece por dentro
      const ca = L / 4 * (Math.random() < 0.5 ? 1 : -1), base = ridge - 0.02, ch = 1.2;
      const [px, , pz] = P(ca, 0, 0);
      box(px, base, pz, 0.7, ch, 0.7, 0x8a4a3a, false);
    }
    out.colliders.push({ minX: -w / 2 - 0.2, minY: top, minZ: -d / 2 - 0.2, maxX: w / 2 + 0.2, maxY: top + r * 0.6, maxZ: d / 2 + 0.2 });
    out.top = top; out.ridge = ridge;
    return out;
  },

  furniture(box, x, y0, z, kind) {
    const wood = 0x7a5232, dark = 0x4a3222;
    if (kind === 'cama') { box(x, y0, z, 2.0, 0.45, 1.1, wood); box(x, y0 + 0.45, z, 1.9, 0.15, 1.0, 0xe8e8f0, false); box(x - 0.7, y0 + 0.6, z, 0.4, 0.12, 0.8, 0xffffff, false); }
    else if (kind === 'mesa') { box(x, y0 + 0.7, z, 1.4, 0.08, 0.9, wood); box(x, y0, z, 0.15, 0.7, 0.15, dark); box(x + 0.85, y0, z, 0.45, 0.5, 0.45, dark); }
    else if (kind === 'sofá') { box(x, y0, z, 1.9, 0.45, 0.85, 0x7a3a3a); box(x, y0 + 0.45, z - 0.33, 1.9, 0.5, 0.2, 0x6a2a2a, false); }
    else if (kind === 'estante') box(x, y0, z, 1.1, 2.0, 0.45, dark);
    else if (kind === 'geladeira') box(x, y0, z, 0.8, 1.8, 0.7, 0xeeeeee);
    else if (kind === 'caixas') { box(x, y0, z, 0.8, 0.8, 0.8, 0xa07a4a); box(x + 0.1, y0 + 0.8, z, 0.6, 0.6, 0.6, 0x8a6a3a); }
  }
};
