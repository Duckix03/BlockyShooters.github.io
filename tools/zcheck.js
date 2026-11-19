// Procura faces que disputam o depth buffer (z-fighting) nas construções do HouseKit:
// mesma direção, mesmo plano (ou < 8 mm), áreas sobrepostas e visíveis. Pares da mesma cor são ignorados (não aparecem).
// Uso: npm i three@0.128.0 && node tools/zcheck.js . [quantidade]   (SAME=1 inclui mesma cor, V=1 mostra as caixas)
const path = require('path');
global.window = global;
global.THREE = require('three');
const repo = process.argv[2], runs = +(process.argv[3] || 300);
require(path.resolve(repo || '.', 'js/housekit.js'));
const GAP = 0.008, MINA = 0.0004;
const faces = b => {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y, y1 = b.y + b.h, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
  return [
    { ax: 0, s: -1, p: x0, u: [y0, y1], v: [z0, z1] }, { ax: 0, s: 1, p: x1, u: [y0, y1], v: [z0, z1] },
    { ax: 1, s: -1, p: y0, u: [x0, x1], v: [z0, z1] }, { ax: 1, s: 1, p: y1, u: [x0, x1], v: [z0, z1] },
    { ax: 2, s: -1, p: z0, u: [x0, x1], v: [y0, y1] }, { ax: 2, s: 1, p: z1, u: [x0, x1], v: [y0, y1] }];
};
const ov = (a, b) => Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
// ponto está dentro (estritamente) de alguma caixa opaca? então a face está escondida
const inside = (boxes, pt, skip) => boxes.some((b, i) => !skip.includes(i) && b.color !== LS.GLASS &&
  pt[0] > b.x - b.w / 2 + 1e-4 && pt[0] < b.x + b.w / 2 - 1e-4 && pt[1] > b.y + 1e-4 && pt[1] < b.y + b.h - 1e-4 && pt[2] > b.z - b.d / 2 + 1e-4 && pt[2] < b.z + b.d / 2 - 1e-4);
const issues = {};
let worst = 0;
for (let r = 0; r < runs; r++) {
  const m = LS.HouseKit.build({ w: 8 + Math.random() * 4, d: 8 + Math.random() * 3, twoStory: r % 2 === 0, kind: LS.HouseKit.KINDS ? LS.HouseKit.KINDS[r % LS.HouseKit.KINDS.length] : undefined });
  const B = m.boxes, F = B.map(faces);
  // triângulos do telhado/oitões que ficam num plano alinhado (DoubleSide: vale qualquer lado) contra faces de caixas
  const P = m.tris.pos;
  for (let k = 0; k < P.length; k += 9) {
    const v = [0, 1, 2].map(i => [P[k + i * 3], P[k + i * 3 + 1], P[k + i * 3 + 2]]);
    for (let ax = 0; ax < 3; ax++) {
      if (Math.abs(v[0][ax] - v[1][ax]) > 1e-4 || Math.abs(v[0][ax] - v[2][ax]) > 1e-4) continue;
      const o = [[1, 2], [0, 2], [0, 1]][ax], U = v.map(q => q[o[0]]), V = v.map(q => q[o[1]]);
      const tu = [Math.min(...U), Math.max(...U)], tv = [Math.min(...V), Math.max(...V)];
      B.forEach((bx, i) => F[i].forEach(f => {
        if (f.ax !== ax || Math.abs(f.p - v[0][ax]) > 0.03) return;
        if (ov(f.u, tu) * ov(f.v, tv) < 0.01) return;
        const cu = (Math.max(f.u[0], tu[0]) + Math.min(f.u[1], tu[1])) / 2, cv = (Math.max(f.v[0], tv[0]) + Math.min(f.v[1], tv[1])) / 2;
        const pt = [0, 0, 0]; pt[ax] = f.p + f.s * 0.004; pt[o[0]] = cu; pt[o[1]] = cv;
        if (inside(B, pt, [])) return;
        const key = 'TELHADO x ' + bx.color.toString(16) + ' ax' + ax + ' ' + m.kind; issues[key] = (issues[key] || 0) + 1; worst++;
      }));
    }
  }
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) for (const a of F[i]) for (const b of F[j]) {
    if (B[i].color === B[j].color && !process.env.SAME) continue;
    if (a.ax !== b.ax || a.s !== b.s || Math.abs(a.p - b.p) > GAP) continue;
    const ou = ov(a.u, b.u), ovv = ov(a.v, b.v);
    if (ou * ovv < MINA) continue;
    if (a.ax === 1 && a.s < 0 && a.p <= 0.05) continue; // fundo apoiado no chão/fundação: ninguém vê
    // centro da área sobreposta, deslocado um pouco para fora: se estiver dentro de outra caixa, ninguém vê
    const cu = (Math.max(a.u[0], b.u[0]) + Math.min(a.u[1], b.u[1])) / 2, cv = (Math.max(a.v[0], b.v[0]) + Math.min(a.v[1], b.v[1])) / 2;
    const pt = [0, 0, 0], o = [[1, 2], [0, 2], [0, 1]][a.ax];
    pt[a.ax] = Math.max(a.p, b.p) * (a.s > 0 ? 1 : 0) + Math.min(a.p, b.p) * (a.s < 0 ? 1 : 0) + a.s * 0.004; pt[o[0]] = cu; pt[o[1]] = cv;
    if (inside(B, pt, [])) continue;
    const f = v => v.toFixed(2), key = B[i].color.toString(16) + ' x ' + B[j].color.toString(16) + ' ax' + a.ax + (process.env.V ? ' ' + [B[i].x, B[i].y, B[i].z, B[i].w, B[i].h, B[i].d].map(f) + ' | ' + [B[j].x, B[j].y, B[j].z, B[j].w, B[j].h, B[j].d].map(f) : '');
    issues[key] = (issues[key] || 0) + 1; worst++;
  }
}
console.log('casas:', runs, 'pares problemáticos:', worst);
Object.entries(issues).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, n]) => console.log(n, k));
