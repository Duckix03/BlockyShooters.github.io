// Casas refeitas: janelas com vidro, porta com toldo, telhado de duas águas, sobrados com escada e móveis
'use strict';
LS.GLASS = 0x9fd8fe;
Object.assign(LS.World, {
  // parede com aberturas: openings = [{pos, w, bottom, top, glass}] (pos = deslocamento a partir do centro)
  wallOpen(scene, axis, cx, y0, cz, len, h, t, color, openings, trim) {
    const seg = (a, b, yb, yt, col, collide) => {
      if (b - a < 0.02 || yt - yb < 0.02) return;
      const mid = (a + b) / 2;
      if (axis === 'x') this.box(scene, cx + mid, y0 + yb, cz, b - a, yt - yb, t, col, collide);
      else this.box(scene, cx, y0 + yb, cz + mid, t, yt - yb, b - a, col, collide);
    };
    let cur = -len / 2;
    openings.sort((a, b) => a.pos - b.pos).forEach(o => {
      const a = o.pos - o.w / 2, b = o.pos + o.w / 2;
      seg(cur, a, 0, h, color, true);
      seg(a, b, 0, o.bottom, color, true);
      seg(a, b, o.top, h, color, true);
      if (o.glass) {
        const mid = o.pos;
        if (axis === 'x') this.box(scene, cx + mid, y0 + o.bottom, cz, o.w, o.top - o.bottom, 0.04, LS.GLASS, false, false);
        else this.box(scene, cx, y0 + o.bottom, cz + mid, 0.04, o.top - o.bottom, o.w, LS.GLASS, false, false);
        // parapeito
        if (axis === 'x') this.box(scene, cx + mid, y0 + o.bottom - 0.08, cz, o.w + 0.2, 0.08, t + 0.16, trim, false);
        else this.box(scene, cx, y0 + o.bottom - 0.08, cz + mid, t + 0.16, 0.08, o.w + 0.2, trim, false);
      }
      cur = b;
    });
    seg(cur, len / 2, 0, h, color, true);
  },
  windowsFor(len, doorPos) {
    const out = [], n = Math.max(1, Math.floor((len - 1.2) / 3.2));
    for (let i = 0; i < n; i++) {
      const p = -len / 2 + (i + 0.5) * len / n;
      if (doorPos !== null && Math.abs(p - doorPos) < 1.6) continue;
      out.push({ pos: p, w: 1.2, bottom: 1.0, top: 2.1, glass: true });
    }
    if (doorPos !== null) out.push({ pos: doorPos, w: 1.3, bottom: 0, top: 2.4 });
    return out;
  },
  // telhado de duas águas (visual) + colisor plano
  gableRoof(scene, cx, ytop, cz, w, d, wallCol, roofCol) {
    const a = 0.5, alongX = w >= d, span = alongX ? d : w, len = alongX ? w : d;
    const half = span / 2 + 0.5, L = half / Math.cos(a), rise = (span / 2) * Math.tan(a);
    const q = new THREE.Quaternion();
    for (const sgn of [1, -1]) {
      if (alongX) q.setFromEuler(new THREE.Euler(sgn * a, 0, 0));
      else q.setFromEuler(new THREE.Euler(0, 0, -sgn * a));
      const off = sgn * half / 2, yy = ytop + (span / 2 - half / 2) * Math.tan(a) - 0.05;
      if (alongX) this.boxR(cx, yy, cz + off, len + 0.8, 0.18, L, roofCol, q);
      else this.boxR(cx + off, yy, cz, L, 0.18, len + 0.8, roofCol, q);
    }
    // oitões (triângulos em degraus)
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const wy = span * (1 - (i + 1) / steps) + 0.05, y = ytop + i * rise / steps;
      for (const e of [-1, 1]) {
        if (alongX) this.box(scene, cx + e * (w / 2), y, cz, 0.35, rise / steps, wy, wallCol, false);
        else this.box(scene, cx, y, cz + e * (d / 2), wy, rise / steps, 0.35, wallCol, false);
      }
    }
    this.addCollider(cx - w / 2, ytop, cz - d / 2, cx + w / 2, ytop + rise * 0.6, cz + d / 2);
    // chaminé
    if (Math.random() < 0.6) this.box(scene, cx + (alongX ? w * 0.25 : span * 0.15), ytop, cz + (alongX ? span * 0.15 : d * 0.25), 0.7, rise + 1.0, 0.7, 0x8a4a3a, false);
  },
  furniture(scene, x, y0, z, kind) {
    const wood = 0x7a5232, dark = 0x4a3222;
    if (kind === 'cama') { this.box(scene, x, y0, z, 2.0, 0.45, 1.1, wood); this.box(scene, x, y0 + 0.45, z, 1.9, 0.15, 1.0, 0xe8e8f0, false); this.box(scene, x - 0.7, y0 + 0.6, z, 0.4, 0.12, 0.8, 0xffffff, false); }
    else if (kind === 'mesa') { this.box(scene, x, y0 + 0.7, z, 1.4, 0.08, 0.9, wood); this.box(scene, x, y0, z, 0.15, 0.7, 0.15, dark); this.box(scene, x + 0.8, y0, z, 0.45, 0.5, 0.45, dark); }
    else if (kind === 'sofá') { this.box(scene, x, y0, z, 1.9, 0.45, 0.85, 0x7a3a3a); this.box(scene, x, y0 + 0.45, z - 0.33, 1.9, 0.5, 0.2, 0x6a2a2a, false); }
    else if (kind === 'estante') this.box(scene, x, y0, z, 1.1, 2.0, 0.45, dark);
    else if (kind === 'geladeira') this.box(scene, x, y0, z, 0.8, 1.8, 0.7, 0xeeeeee);
    else if (kind === 'caixas') { this.box(scene, x, y0, z, 0.8, 0.8, 0.8, 0xa07a4a); this.box(scene, x + 0.1, y0 + 0.8, z, 0.6, 0.6, 0.6, 0x8a6a3a); }
  },

  house(scene, cx, cz, w, d) {
    const y0 = this.heightAt(cx, cz) - 0.05, t = 0.3, H = 3.3;
    const col = LS.util.pick([0xe8dcc4, 0xd9a07a, 0xb7c9a8, 0xc9c3d6, 0xe6c26e, 0xa7c4d9, 0xf0f0f0, 0xd8b8a0]);
    const roofCol = LS.util.pick([0x8a3b2a, 0x5a4a42, 0x3d5a6b, 0x6b4a2a, 0x4a6a3a]), trim = 0x5a4632;
    const twoStory = w >= 9.5 && d >= 8 && Math.random() < 0.45;
    const doorSide = twoStory ? LS.util.pick([1, 2, 3]) : LS.util.randInt(0, 3); // escada fica na parede norte
    const doorPos = (s, len) => s === doorSide ? LS.util.rand(-len / 4, len / 4) : null;
    const dp = [doorPos(0, w), doorPos(1, w), doorPos(2, d - t), doorPos(3, d - t)];
    // térreo
    this.wallOpen(scene, 'x', cx, y0, cz - d / 2, w, H, t, col, this.windowsFor(w, dp[0]), trim);
    this.wallOpen(scene, 'x', cx, y0, cz + d / 2, w, H, t, col, this.windowsFor(w, dp[1]), trim);
    this.wallOpen(scene, 'z', cx - w / 2, y0, cz, d - t, H, t, col, this.windowsFor(d - t, dp[2]), trim);
    this.wallOpen(scene, 'z', cx + w / 2, y0, cz, d - t, H, t, col, this.windowsFor(d - t, dp[3]), trim);
    this.box(scene, cx, y0, cz, w - t, 0.08, d - t, 0x9a7a55, false, false); // piso
    // toldo e degrau na porta
    const dpos = dp[doorSide];
    const ox = doorSide === 2 ? -w / 2 : doorSide === 3 ? w / 2 : dpos, oz = doorSide === 0 ? -d / 2 : doorSide === 1 ? d / 2 : dpos;
    const nx = doorSide === 2 ? -1 : doorSide === 3 ? 1 : 0, nz = doorSide === 0 ? -1 : doorSide === 1 ? 1 : 0;
    const awW = nx ? 1.2 : 2.0, awD = nx ? 2.0 : 1.2;
    this.box(scene, cx + ox + nx * 0.7, y0 + 2.55, cz + oz + nz * 0.7, awW, 0.12, awD, roofCol, false);
    this.box(scene, cx + ox + nx * 0.6, y0 - 0.1, cz + oz + nz * 0.6, nx ? 1.0 : 1.8, 0.18, nx ? 1.8 : 1.0, 0x8a8a8a, false, false);
    // móveis nos cantos (longe da porta e da escada)
    const kinds = ['cama', 'mesa', 'sofá', 'estante', 'geladeira', 'caixas'];
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].filter(([sx, sz]) => !(twoStory && sz === -1) && !(sx === nx && nx) && !(sz === nz && nz));
    corners.slice(0, LS.util.randInt(1, 3)).forEach(([sx, sz]) => this.furniture(scene, cx + sx * (w / 2 - 1.3), y0, cz + sz * (d / 2 - 1.0), LS.util.pick(kinds)));
    for (let i = 0; i < LS.util.randInt(2, 3); i++) this.lootSpots.push({ x: cx + LS.util.rand(-w / 2 + 1.2, w / 2 - 1.2), z: cz + LS.util.rand(0, d / 2 - 1.2), y: y0 + 0.1, indoor: true });

    let top = y0 + H;
    if (twoStory) {
      // escada encostada na parede norte
      const steps = 11, rise = H / steps, run = 0.45, sx0 = cx - w / 2 + t / 2 + 0.2, sz0 = cz - d / 2 + t / 2, sw = 1.3;
      for (let i = 0; i < steps; i++) this.box(scene, sx0 + i * run + run / 2, y0, sz0 + sw / 2, run, rise * (i + 1), sw, 0x8a6a4a);
      const holeX1 = sx0 + steps * run, slabY = y0 + H, st = 0.25;
      // laje com abertura sobre a escada
      this.box(scene, cx, slabY, (sz0 + sw + cz + d / 2 - t / 2) / 2, w - t, st, (cz + d / 2 - t / 2) - (sz0 + sw), 0x9a7a55);
      this.box(scene, (holeX1 + cx + w / 2 - t / 2) / 2, slabY, sz0 + sw / 2, (cx + w / 2 - t / 2) - holeX1, st, sw, 0x9a7a55);
      // guarda-corpo
      this.box(scene, (sx0 + holeX1) / 2 - 0.6, slabY + st, sz0 + sw + 0.05, holeX1 - sx0 - 1.2, 0.9, 0.08, trim);
      // andar de cima
      const y1 = slabY + st, H2 = 3.0;
      this.wallOpen(scene, 'x', cx, y1, cz - d / 2, w, H2, t, col, this.windowsFor(w, null), trim);
      this.wallOpen(scene, 'x', cx, y1, cz + d / 2, w, H2, t, col, this.windowsFor(w, null), trim);
      this.wallOpen(scene, 'z', cx - w / 2, y1, cz, d - t, H2, t, col, this.windowsFor(d - t, null), trim);
      this.wallOpen(scene, 'z', cx + w / 2, y1, cz, d - t, H2, t, col, this.windowsFor(d - t, null), trim);
      this.box(scene, cx, y1 - 0.3, cz, w + 0.3, 0.3, d + 0.3, trim, false); // faixa entre andares
      this.furniture(scene, cx + w / 2 - 1.4, y1, cz + d / 2 - 1.1, LS.util.pick(['cama', 'estante', 'caixas']));
      for (let i = 0; i < 2; i++) this.lootSpots.push({ x: cx + LS.util.rand(-w / 2 + 1.2, w / 2 - 1.2), z: cz + LS.util.rand(0, d / 2 - 1.2), y: y1 + 0.05, indoor: true });
      top = y1 + H2;
    }
    this.gableRoof(scene, cx, top, cz, w, d, col, roofCol);
    this.buildings.push({ x: cx, z: cz, w, d, color: col });
  }
});
