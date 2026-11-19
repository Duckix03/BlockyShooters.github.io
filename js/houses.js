// Coloca as casas do HouseKit no mapa: aplaina o terreno, cria a fundação e junta os telhados numa única malha
'use strict';
Object.assign(LS.World, {
  roofTris: null,

  // aplaina a grade do terreno sob um retângulo (com transição suave nas bordas)
  flattenRect(cx, cz, hw, hd, y, margin, blend) {
    const S = this.SEG, W = S + 1, half = LS.MAP_SIZE / 2, cell = LS.MAP_SIZE / S, H = this.heights;
    const ext = margin + blend;
    const ix0 = Math.max(0, Math.floor((cx - hw - ext + half) / cell)), ix1 = Math.min(S, Math.ceil((cx + hw + ext + half) / cell));
    const iz0 = Math.max(0, Math.floor((cz - hd - ext + half) / cell)), iz1 = Math.min(S, Math.ceil((cz + hd + ext + half) / cell));
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const x = -half + ix * cell, z = -half + iz * cell;
      const dx = Math.max(0, Math.abs(x - cx) - hw - margin), dz = Math.max(0, Math.abs(z - cz) - hd - margin);
      const dist = Math.hypot(dx, dz);
      if (dist >= blend) continue;
      const k = 1 - dist / blend, s = k * k * (3 - 2 * k);
      H[ix + iz * W] = LS.util.lerp(H[ix + iz * W], y, s);
    }
    this.terrainDirty = true;
  },
  // aplica a grade de alturas de volta na malha do terreno
  rebuildTerrainMesh() {
    if (!this.terrainDirty || !this.terrainMesh) return;
    const pos = this.terrainMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, this.heights[i]);
    pos.needsUpdate = true;
    this.terrainMesh.geometry.computeVertexNormals();
    this.terrainDirty = false;
  },

  house(scene, cx, cz, w, d) {
    // piso acima do ponto mais alto do terreno sob a casa (nada atravessa o chão)
    let hMax = -Infinity, hMin = Infinity;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const h = this.heightAt(cx + sx * (w / 2 + 0.5), cz + sz * (d / 2 + 0.5));
      hMax = Math.max(hMax, h); hMin = Math.min(hMin, h);
    }
    const y0 = hMax + 0.05;
    this.flattenRect(cx, cz, w / 2, d / 2, y0 - 0.12, 1.5, 4);
    // fundação de pedra (aparece só onde o terreno era inclinado)
    const fb = Math.min(hMin, y0 - 0.3) - 0.6;
    this.box(scene, cx, fb, cz, w + 0.5, y0 - 0.04 - fb, d + 0.5, 0x8a8580, true);
    const m = LS.HouseKit.build({ w, d, twoStory: w >= 9.5 && d >= 8 && Math.random() < 0.45 });
    for (const b of m.boxes) this.box(scene, cx + b.x, y0 + b.y, cz + b.z, b.w, b.h, b.d, b.color, b.collide, b.shadow);
    for (const c of m.colliders) this.addCollider(cx + c.minX, y0 + c.minY, cz + c.minZ, cx + c.maxX, y0 + c.maxY, cz + c.maxZ);
    if (!this.roofTris) this.roofTris = { pos: [], col: [] };
    const p = m.tris.pos;
    for (let i = 0; i < p.length; i += 3) this.roofTris.pos.push(p[i] + cx, p[i + 1] + y0, p[i + 2] + cz);
    for (const c of m.tris.col) this.roofTris.col.push(c);
    for (const l of m.loot) this.lootSpots.push({ x: cx + l.x, y: y0 + l.y, z: cz + l.z, indoor: true });
    this.buildings.push({ x: cx, z: cz, w, d, color: m.wallCol });
  },
  // malha única com todos os telhados e oitões
  finalizeRoofs(scene) {
    if (!this.roofTris || !this.roofTris.pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.roofTris.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.roofTris.col, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    this.roofTris = null;
  },
  // verdadeiro se (x,z) fica dentro (ou perto) de alguma construção
  nearBuilding(x, z, pad) {
    for (const b of this.nearBoxes(x, z, pad + 1)) if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return true;
    return false;
  }
});
