// Cenário do lobby: rua noturna com prédios, janelas acesas, letreiros neon, postes, carro e chuva fina
'use strict';
LS.LobbyScene = {
  build(sc, L) {
    sc.background = new THREE.Color(0x0a0f1e);
    sc.fog = new THREE.Fog(0x0a0f1e, 14, 48);
    sc.add(new THREE.HemisphereLight(0x6a84c8, 0x141020, 0.55));
    sc.add(new THREE.AmbientLight(0x404a70, 0.35));
    const moon = new THREE.DirectionalLight(0xa8c0ff, 0.55); moon.position.set(-4, 9, 6); moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    sc.add(moon);
    const key = new THREE.PointLight(0xffd2a0, 1.1, 14); key.position.set(2.5, 3.5, 4); sc.add(key); // luz no rosto
    L.neonL = new THREE.PointLight(0xff3aa0, 1.6, 12); L.neonL.position.set(-3.5, 2.5, -1.5); sc.add(L.neonL);
    L.neonR = new THREE.PointLight(0x28d8ff, 1.6, 12); L.neonR.position.set(3.5, 2.5, -1.5); sc.add(L.neonR);
    const M = c => new THREE.MeshLambertMaterial({ color: c }), B = c => new THREE.MeshBasicMaterial({ color: c });
    const block = new THREE.BoxGeometry(1, 1, 1);
    const put = (mat, x, y, z, w, h, d, shadow) => {
      const m = new THREE.Mesh(block, mat); m.position.set(x, y + h / 2, z); m.scale.set(w, h, d);
      m.receiveShadow = true; if (shadow) m.castShadow = true; sc.add(m); return m;
    };
    // asfalto molhado + faixas
    const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 80), new THREE.MeshPhongMaterial({ color: 0x15181f, specular: 0x5a6a90, shininess: 90 }));
    road.rotation.x = -Math.PI / 2; road.position.z = -20; road.receiveShadow = true; sc.add(road);
    const dash = B(0xd8b030);
    for (let z = 6; z > -60; z -= 4) put(dash, 0, 0.005, z, 0.18, 0.01, 1.8);
    // calçadas e meio-fio
    const walk = M(0x3a3d46), curb = M(0x6a6d76);
    for (const sx of [-1, 1]) { put(walk, sx * 8, 0, -20, 4, 0.18, 80); put(curb, sx * 6.05, 0, -20, 0.15, 0.2, 80); }
    // prédios com janelas acesas e letreiros neon
    const winMats = [B(0xffd27a), B(0x9fe8ff), B(0xffb070), B(0xfff0c0)], dark = B(0x0d1018);
    const neon = [0xff3aa0, 0x28d8ff, 0xff8a1f, 0xa040ff, 0x40ff90];
    const bCols = [0x1d2230, 0x262033, 0x1a2a33, 0x2a2626, 0x222838];
    L.neons = [];
    for (const sx of [-1, 1]) {
      let z = 8;
      while (z > -60) {
        const w = LS.util.rand(5, 8), h = LS.util.rand(8, 22), x = sx * (10 + LS.util.rand(0, 1.5));
        put(M(LS.util.pick(bCols)), x, 0, z - w / 2, 4, h, w - 0.4, true);
        const fx = x - sx * 2.02; // fachada voltada para a rua
        for (let wy = 2.5; wy < h - 1; wy += 1.6) for (let wz = z - 0.9; wz > z - w + 0.8; wz -= 1.3) {
          put(Math.random() < 0.42 ? LS.util.pick(winMats) : dark, fx, wy, wz, 0.05, 0.8, 0.6);
        }
        if (Math.random() < 0.7) {
          const col = LS.util.pick(neon), ny = LS.util.rand(3, 6), sh = LS.util.rand(0.5, 1.2), sw = LS.util.rand(2, 3.5);
          put(B(new THREE.Color(col).multiplyScalar(0.35).getHex()), fx - sx * 0.04, ny - 0.1, z - w / 2, 0.08, sh + 0.2, sw + 0.2);
          const sign = put(new THREE.MeshBasicMaterial({ color: col }), fx - sx * 0.08, ny, z - w / 2, 0.12, sh, sw);
          L.neons.push({ m: sign, base: new THREE.Color(col), ph: Math.random() * 10, flick: Math.random() < 0.3 });
        }
        z -= w;
      }
    }
    // postes de luz
    const pole = M(0x2a2d34), lampMat = B(0xffe0a0);
    for (const [x, z] of [[-5.6, -3], [5.6, -9], [-5.6, -18], [5.6, -26]]) {
      const o = x < 0 ? 1 : -1;
      put(pole, x, 0, z, 0.15, 5.2, 0.15, true); put(pole, x + o * 0.6, 5.1, z, 1.3, 0.12, 0.12);
      put(lampMat, x + o * 1.1, 4.95, z, 0.4, 0.12, 0.3);
      const pl = new THREE.PointLight(0xffc880, 0.9, 11); pl.position.set(x + o * 1.1, 4.6, z); sc.add(pl);
    }
    // caixas, barreira e um carro em blocos estacionado
    put(M(0x6a4a2a), -4.2, 0, 0.8, 0.9, 0.9, 0.9, true); put(M(0x7a5a3a), -4.0, 0.9, 0.9, 0.7, 0.7, 0.7, true);
    put(M(0xb03a2e), 4.4, 0, 0.2, 0.5, 0.9, 1.8, true);
    const car = M(0x2a5ab0), glass = new THREE.MeshPhongMaterial({ color: 0x0a1424, shininess: 100, specular: 0x6080c0 });
    put(car, 4.2, 0.35, -6, 2, 0.9, 4.2, true); put(glass, 4.2, 1.25, -6.2, 1.8, 0.7, 2.2, true);
    for (const [dx, dz] of [[-1, -1.4], [1, -1.4], [-1, 1.4], [1, 1.4]]) put(M(0x111111), 4.2 + dx, 0, -6 + dz, 0.3, 0.7, 0.7);
    // círculo de destaque sob o personagem
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.22, 40), new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; sc.add(ring);
    L.ring = ring;
    // chuva fina
    const rp = [];
    for (let i = 0; i < 600; i++) rp.push(LS.util.rand(-12, 12), LS.util.rand(0, 14), LS.util.rand(-25, 8));
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    L.rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0x9fb8e0, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false }));
    sc.add(L.rain);
  },

  update(L, dt, t) {
    const rp = L.rain.geometry.attributes.position;
    for (let i = 0; i < rp.count; i++) { let y = rp.getY(i) - dt * 9; if (y < 0) y += 14; rp.setY(i, y); }
    rp.needsUpdate = true;
    for (const n of L.neons) {
      let k = 0.85 + Math.sin(t * 2 + n.ph) * 0.15;
      if (n.flick && Math.sin(t * 13 + n.ph * 7) > 0.93) k = 0.25; // letreiro com mau contato
      n.m.material.color.copy(n.base).multiplyScalar(k);
    }
    L.neonL.intensity = 1.4 + Math.sin(t * 1.7) * 0.3;
    L.neonR.intensity = 1.4 + Math.cos(t * 1.3) * 0.3;
  }
};
