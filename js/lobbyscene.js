// Cenário do lobby: cidade à noite, chuva fina e asfalto molhado.
// - rua com cruzamento ao fundo (carros passando com farol), carros estacionados detalhados
// - prédios com lojas iluminadas, toldos, sacadas, escada de incêndio, caixas d'água e ar-condicionado
// - letreiros neon com texto (piscam), outdoor animado, ponto de ônibus, máquina de bebidas, food truck com varal de luzes
// - postes com cone de luz, semáforo funcionando, vapor saindo do bueiro, reflexos no chão, lua e skyline ao longe
// Quase tudo é fundido em poucas malhas (cor por vértice): bonito e leve.
'use strict';
LS.LobbyScene = {
  build(sc, L) {
    const U = LS.util, R = LS.Tex.rng(2024);
    const rand = (a, b) => a + R() * (b - a), pick = a => a[Math.floor(R() * a.length)];
    sc.background = new THREE.Color(0x070b18);
    sc.fog = new THREE.Fog(0x0a0f22, 16, 60);
    sc.add(new THREE.HemisphereLight(0x6a84c8, 0x141020, 0.5));
    sc.add(new THREE.AmbientLight(0x404a70, 0.32));
    const moon = new THREE.DirectionalLight(0xa8c0ff, 0.5); moon.position.set(-4, 9, 6); moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
    sc.add(moon);
    const key = new THREE.PointLight(0xffd2a0, 1.1, 14); key.position.set(2.5, 3.5, 4); sc.add(key); // luz no rosto
    L.neonL = new THREE.PointLight(0xff3aa0, 1.5, 12); L.neonL.position.set(-3.5, 2.5, -1.5); sc.add(L.neonL);
    L.neonR = new THREE.PointLight(0x28d8ff, 1.5, 12); L.neonR.position.set(3.5, 2.5, -1.5); sc.add(L.neonR);

    // ---------- acumuladores de peças: sólido (com luz) e brilho (sem luz) ----------
    const solid = [], glow = [];
    const S = (x, y, z, w, h, d, c, rx, ry, rz) => solid.push([x, y + h / 2, z, w, h, d, c, rx || 0, ry || 0, rz || 0]); // y = base
    const G = (x, y, z, w, h, d, c) => glow.push([x, y + h / 2, z, w, h, d, c]);
    const tex = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); return t; };
    const add = (m, shadow) => { m.receiveShadow = true; if (shadow) m.castShadow = true; sc.add(m); return m; };
    L.neons = []; L.anims = [];

    // ---------- chão: asfalto molhado, faixas, cruzamento, calçadas ----------
    const road = new THREE.Mesh(new THREE.PlaneGeometry(12.2, 90), new THREE.MeshPhongMaterial({ color: 0x14171e, specular: 0x6a7aa0, shininess: 110 }));
    road.rotation.x = -Math.PI / 2; road.position.z = -25; add(road);
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(90, 6), road.material); cross.rotation.x = -Math.PI / 2; cross.position.set(0, 0.002, -16.5); add(cross);
    for (let z = 6; z > -70; z -= 4) if (z > -13 || z < -20) G(0, 0, z, 0.16, 0.012, 1.8, 0xd8b030);       // faixa central
    for (let x = -5; x <= 5; x += 1.1) G(x, 0, -3.6, 0.6, 0.012, 1.6, 0xd8d8d8);                                 // faixa de pedestres
    for (let x = -5; x <= 5; x += 1.1) G(x, 0, -12.3, 0.6, 0.012, 1.5, 0xd8d8d8);
    for (const sx of [-1, 1]) {
      for (const [z0, z1] of [[8, -13.4], [-19.6, -72]]) {
        const zc = (z0 + z1) / 2, len = z0 - z1;
        S(sx * 8.1, 0, zc, 4, 0.18, len, 0x3a3d46); S(sx * 6.08, 0, zc, 0.16, 0.22, len, 0x6a6d76);           // calçada + meio-fio
        for (let z = z0 - 1; z > z1; z -= 2) S(sx * 8.1, 0.18, z, 3.96, 0.006, 0.05, 0x2c2f37);             // juntas da calçada
      }
    }
    // bueiro com vapor + tampa
    S(1.6, 0, -1.6, 0.9, 0.012, 0.9, 0x2a2d33); S(1.6, 0.006, -1.6, 0.7, 0.012, 0.7, 0x1a1c20);
    // reflexos coloridos no asfalto (placas aditivas alongadas na direção da câmera)
    const reflTex = tex(32, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h); const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, w, h); });
    const reflect = (x, z, w, len, color, op = 0.35) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({ map: reflTex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.01, z + len * 0.35); sc.add(m); return m;
    };

    // ---------- letreiros neon com texto ----------
    const neonTex = (text, col, vertical) => tex(vertical ? 128 : 512, vertical ? 512 : 128, (g, w, h) => {
      g.font = 'bold ' + (vertical ? 92 : 92) + 'px Segoe UI, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const css = '#' + new THREE.Color(col).getHexString();
      g.shadowColor = css; g.shadowBlur = 28; g.strokeStyle = css; g.lineWidth = 7; g.fillStyle = '#ffffff';
      if (vertical) [...text].forEach((ch, i, a) => { const y = h / (a.length + 1) * (i + 1); g.strokeText(ch, w / 2, y); g.fillText(ch, w / 2, y); });
      else { g.strokeText(text, w / 2, h / 2 + 4); g.fillText(text, w / 2, h / 2 + 4); }
    });
    const sign = (text, col, x, y, z, w, h, facing, vertical) => { // facing: +1 olha pra +x, -1 pra -x, 0 pra +z
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: neonTex(text, col, vertical), color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.position.set(x, y, z); if (facing) m.rotation.y = facing * Math.PI / 2; sc.add(m);
      L.neons.push({ m, base: new THREE.Color(0xffffff), ph: R() * 10, flick: R() < 0.3 });
      return m;
    };

    // ---------- prédios (dos dois lados, com vão no cruzamento) ----------
    const wallC = [0x1d2230, 0x262033, 0x1a2a33, 0x2a2626, 0x222838, 0x30262a, 0x1f2b2a];
    const winC = [0xffd27a, 0x9fe8ff, 0xffb070, 0xfff0c0, 0xffe0a8], neonC = [0xff3aa0, 0x28d8ff, 0xff8a1f, 0xa040ff, 0x40ff90, 0xffe040];
    const names = ['HOTEL', 'RAMEN', 'BAR', '24H', 'ARCADE', 'PIZZA', 'CAFÉ', 'GYM', 'LOJA', 'SUSHI'];
    const awnC = [0xc0392b, 0x2e7d32, 0x1f5fa8, 0xe0a020, 0x7a2a6a, 0x2a8a8a];
    for (const sx of [-1, 1]) {
      let z = 7;
      while (z > -66) {
        if (z < -12.8 && z > -20.2) { z = -20.2; continue; }                                                     // cruzamento
        const w = rand(5, 8), h = rand(9, 24), fx = sx * 10.1, zc = z - w / 2, col = pick(wallC), dark = new THREE.Color(col).multiplyScalar(0.7).getHex();
        if (z - w < -12.8 && z > -12.8) { z = -12.8; continue; }
        S(sx * 12.1, 0, zc, 4, h, w - 0.3, col);                                                                    // corpo
        S(sx * 12.1, h, zc, 4.2, 0.35, w - 0.1, dark);                                                             // platibanda
        for (let y = 3.2; y < h - 1; y += 3.2) S(fx - sx * 0.06, y - 0.12, zc, 0.12, 0.12, w - 0.3, dark);       // frisos entre andares
        // térreo: vitrine iluminada + toldo listrado
        const shopCol = pick(winC);
        G(fx - sx * 0.03, 0.5, zc, 0.06, 1.9, w - 1.6, new THREE.Color(shopCol).multiplyScalar(0.85).getHex());
        S(fx - sx * 0.08, 0.4, zc, 0.1, 0.1, w - 1.4, 0x111111); S(fx - sx * 0.08, 2.4, zc, 0.1, 0.12, w - 1.4, 0x111111);
        for (let k = 0; k < 3; k++) S(fx - sx * 0.12, 0.6, zc - (w - 2) / 2 + k * (w - 2) / 2, 0.08, 1.8, 0.08, 0x111111); // caixilhos
        const ac = pick(awnC);
        for (let i = 0; i < 6; i++) S(fx - sx * 0.7, 2.75, zc - (w - 1.4) / 2 + (i + 0.5) * (w - 1.4) / 6, 1.3, 0.12, (w - 1.4) / 6 - 0.02, i % 2 ? ac : 0xf0ece0, 0, 0, sx * 0.35);
        reflect(fx - sx * 1.8, zc, 2.2, 3.5, shopCol, 0.22);
        // janelas: acesas, escuras, com cortina
        for (let y = 4; y < h - 1.2; y += 1.6) for (let wz = z - 0.9; wz > z - w + 0.8; wz -= 1.3) {
          const lit = R() < 0.45;
          if (lit) { G(fx - sx * 0.02, y, wz, 0.05, 0.85, 0.65, pick(winC)); if (R() < 0.3) S(fx - sx * 0.06, y + 0.45, wz - 0.17, 0.04, 0.4, 0.3, 0x3a2a3a); }
          else S(fx - sx * 0.02, y, wz, 0.05, 0.85, 0.65, 0x0c0f18);
          S(fx - sx * 0.09, y - 0.08, wz, 0.18, 0.08, 0.75, 0x50545e);                                             // peitoril
        }
        // sacadas / escada de incêndio
        if (R() < 0.45) for (let y = 4.9; y < h - 2; y += 3.2) {
          S(fx - sx * 0.6, y, zc, 1.2, 0.08, 2.4, 0x2a2d34);
          for (const dz of [-1.15, 1.15]) S(fx - sx * 1.17, y, zc + dz, 0.06, 0.9, 0.06, 0x2a2d34);
          S(fx - sx * 1.17, y + 0.85, zc, 0.05, 0.05, 2.4, 0x2a2d34); S(fx - sx * 1.17, y + 0.45, zc, 0.04, 0.04, 2.4, 0x2a2d34);
          S(fx - sx * 0.6, y + 0.08, zc + 0.6, 1.0, 0.04, 0.4, 0x22252c, 0.6);
        }
        // topo: caixa d'água, ar-condicionado e antena com luz piscando
        if (R() < 0.6) { const tx = sx * 12.4, tz = zc + rand(-1, 1);
          for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) S(tx + a, h + 0.35, tz + b, 0.1, 1.2, 0.1, 0x3a2a20);
          S(tx, h + 1.55, tz, 1.5, 1.6, 1.5, 0x6a4a30); S(tx, h + 3.15, tz, 1.2, 0.25, 1.2, 0x4a3420); }
        if (R() < 0.7) S(sx * 11.2, h + 0.35, zc + rand(-2, 2), 0.9, 0.6, 1.1, 0x8a8e96);
        if (R() < 0.35) { S(sx * 12.8, h + 0.35, zc, 0.08, 3, 0.08, 0x555555); const a = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
          a.position.set(sx * 12.8, h + 3.5, zc); sc.add(a); L.anims.push({ type: 'blink', m: a, ph: R() * 6 }); }
        // letreiro neon (vertical ou horizontal) com reflexo no chão
        if (R() < 0.8) {
          const c = pick(neonC), txt = pick(names), vert = R() < 0.45 && h > 12;
          if (vert) { const nh = Math.min(6, txt.length * 1.1); S(fx - sx * 0.55, 4.6, zc + w / 2 - 1.2, 0.18, nh + 0.4, 1.3, 0x14161c);
            sign(txt, c, fx - sx * 0.66, 4.8 + nh / 2, zc + w / 2 - 1.2, 1.2, nh, -sx, true); }
          else { S(fx - sx * 0.08, 3.25, zc, 0.12, 1.1, Math.min(w - 1, 4.4), 0x14161c); sign(txt, c, fx - sx * 0.16, 3.8, zc, Math.min(w - 1.2, 4.2), 1.0, -sx, false); }
          reflect(fx - sx * 2.4, zc, 1.6, 6, c, 0.3);
        }
        z -= w;
      }
    }
    // outdoor animado no fim da rua (texto rolando)
    const bbCanvas = document.createElement('canvas'); bbCanvas.width = 1024; bbCanvas.height = 256;
    const bbTex = new THREE.CanvasTexture(bbCanvas); bbTex.wrapS = THREE.RepeatWrapping;
    { const g = bbCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, '#ff3aa0'); gr.addColorStop(0.5, '#ff8a1f'); gr.addColorStop(1, '#28d8ff');
      g.fillStyle = '#10121c'; g.fillRect(0, 0, 1024, 256); g.fillStyle = gr; g.fillRect(0, 0, 1024, 12); g.fillRect(0, 244, 1024, 12);
      g.font = 'italic 900 120px Segoe UI, Arial Black, sans-serif'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.shadowColor = '#ff8a1f'; g.shadowBlur = 30;
      g.fillText('LAST SURVIVOR', 40, 130); g.font = 'bold 60px Segoe UI'; g.fillStyle = '#ffc531'; g.fillText('★ TEMPORADA 1', 880 - 300, 210); }
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: bbTex, fog: false }));
    bb.position.set(0, 9.2, -45); sc.add(bb); L.anims.push({ type: 'scroll', t: bbTex });
    S(-5, 0, -45.3, 0.3, 7.5, 0.3, 0x2a2d34); S(5, 0, -45.3, 0.3, 7.5, 0.3, 0x2a2d34); S(0, 7.35, -45.3, 14.6, 0.2, 0.4, 0x2a2d34); S(0, 10.95, -45.3, 14.6, 0.2, 0.4, 0x2a2d34);
    S(0, 0, -48, 30, 9, 3, 0x1b1f2c); // prédio do fundo
    for (let y = 1.5; y < 8.5; y += 1.4) for (let x = -14; x < 14; x += 1.3) if (R() < 0.4) G(x, y, -46.45, 0.7, 0.7, 0.05, pick(winC));

    // ---------- postes com cone de luz ----------
    const coneTex = tex(8, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const coneMat = new THREE.MeshBasicMaterial({ map: coneTex, color: 0xffc880, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const coneGeo = new THREE.CylinderGeometry(0.15, 1.9, 4.6, 16, 1, true); coneGeo.translate(0, -2.3, 0);
    for (const [x, z] of [[-5.7, -4], [5.7, -9], [-5.7, -22], [5.7, -27]]) {
      const o = x < 0 ? 1 : -1;
      S(x, 0, z, 0.3, 0.3, 0.3, 0x2a2d34); S(x, 0.3, z, 0.15, 4.9, 0.15, 0x2a2d34); S(x + o * 0.6, 5.1, z, 1.3, 0.12, 0.12, 0x2a2d34);
      S(x + o * 1.1, 4.92, z, 0.5, 0.18, 0.36, 0x2a2d34); G(x + o * 1.1, 4.86, z, 0.38, 0.06, 0.26, 0xffe8b0);
      const cone = new THREE.Mesh(coneGeo, coneMat); cone.position.set(x + o * 1.1, 4.86, z); sc.add(cone);
      const pl = new THREE.PointLight(0xffc880, 0.85, 11); pl.position.set(x + o * 1.1, 4.6, z); sc.add(pl);
      reflect(x + o * 1.1, z, 1.4, 4, 0xffc880, 0.25);
    }
    // ---------- semáforos no cruzamento ----------
    L.lights = [];
    for (const [x, z, f] of [[5.9, -13.2, 1], [-5.9, -19.8, -1]]) {
      S(x, 0, z, 0.14, 3.2, 0.14, 0x2a2d34); S(x - 0.0, 3.2, z, 0.4, 1.1, 0.35, 0x1a1c22);
      const lamps = [0xff2a2a, 0xffc020, 0x30ff70].map((c, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.06), new THREE.MeshBasicMaterial({ color: c }));
        m.position.set(x, 4.05 - i * 0.33, z + f * 0.2); sc.add(m); return { m, c: new THREE.Color(c) }; });
      L.lights.push(lamps);
    }
    // ---------- mobiliário urbano ----------
    // ponto de ônibus com painel iluminado
    { const x = -8.2, z = -8; S(x, 0.18, z - 1.6, 0.08, 2.4, 0.08, 0x8a8e96); S(x, 0.18, z + 1.6, 0.08, 2.4, 0.08, 0x8a8e96); S(x + 0.2, 2.58, z, 1.3, 0.1, 3.6, 0x3a3d46);
      S(x - 0.5, 0.18, z, 0.06, 2.2, 3.2, 0x203040); G(x - 0.45, 0.6, z - 0.6, 0.04, 1.6, 1.1, 0x9fe8ff); S(x + 0.1, 0.62, z + 0.6, 0.5, 0.08, 1.6, 0x6a4a2a);
      reflect(x + 1.5, z - 0.6, 1.2, 2.5, 0x9fe8ff, 0.2); }
    // máquina de bebidas
    { const x = 8.9, z = -2.6; S(x, 0.18, z, 0.9, 2, 1.1, 0xc0302a); G(x - 0.46, 0.9, z, 0.02, 1.1, 0.8, 0xffffff); for (let i = 0; i < 4; i++) G(x - 0.47, 1.0 + i * 0.25, z - 0.25 + (i % 2) * 0.1, 0.02, 0.12, 0.3, pick(neonC)); S(x - 0.47, 0.4, z, 0.04, 0.2, 0.5, 0x111111); }
    // bancos, lixeiras, hidrante, caixa de correio, vasos com plantas
    for (const [x, z] of [[-8.6, -1], [8.6, -15.5]]) { S(x, 0.6, z, 0.5, 0.08, 1.8, 0x7a5232); S(x + (x < 0 ? -0.22 : 0.22), 0.68, z, 0.06, 0.45, 1.8, 0x7a5232); for (const d of [-0.75, 0.75]) S(x, 0.18, z + d, 0.4, 0.42, 0.06, 0x2a2d34); }
    for (const [x, z] of [[-6.8, -6.2], [6.8, 1.6], [-6.8, -24]]) { S(x, 0.18, z, 0.5, 0.75, 0.5, 0x2e5a3a); S(x, 0.93, z, 0.56, 0.08, 0.56, 0x234a2e); }
    { const x = 6.7, z = -4.6; S(x, 0.18, z, 0.32, 0.55, 0.32, 0xc02a2a); S(x, 0.73, z, 0.22, 0.12, 0.22, 0xc02a2a); S(x, 0.45, z, 0.5, 0.1, 0.12, 0xc02a2a); }
    { const x = -6.9, z = 2.4; S(x, 0.18, z, 0.1, 0.8, 0.1, 0x2a2d34); S(x, 0.98, z, 0.55, 0.5, 0.45, 0x1f5fa8); }
    for (const [x, z] of [[-6.9, -14], [6.9, -21], [-6.9, -29], [6.9, -34]]) { S(x, 0.18, z, 0.9, 0.6, 0.9, 0x5a4a3a); for (let i = 0; i < 4; i++) S(x + rand(-0.2, 0.2), 0.78 + i * 0.35, z + rand(-0.2, 0.2), 1.0 - i * 0.2, 0.4, 1.0 - i * 0.2, i % 2 ? 0x2e7a3e : 0x3a8c45, 0, R() * 3, 0); }
    // caixas e barreira de obra (atrás do personagem)
    S(-4.3, 0, 0.8, 0.9, 0.9, 0.9, 0x6a4a2a); S(-4.1, 0.9, 0.9, 0.7, 0.7, 0.7, 0x7a5a3a, 0, 0.3, 0);
    for (let i = 0; i < 3; i++) { S(4.5, 0, 1.2 - i * 0.65, 0.35, 0.8, 0.35, i % 2 ? 0xffffff : 0xff6a1a); }
    S(4.5, 0.85, 0.55, 0.06, 0.08, 1.7, 0xffffff);

    // ---------- carros detalhados ----------
    const car = (x, z, rot, type, col) => {
      const P = [], Gl = [];
      const s = (a, b, c, w, h, d, cc) => P.push([a, b + h / 2, c, w, h, d, cc]), g = (a, b, c, w, h, d, cc) => Gl.push([a, b + h / 2, c, w, h, d, cc]);
      const glass = 0x0e1a2c, rubber = 0x111111, rim = 0xb0b0b8;
      if (type === 'van') {
        s(0, 0.35, 0, 1.95, 1.75, 4.5, col); s(0, 0.9, 2.26, 1.7, 0.75, 0.04, glass); s(0, 1.4, 0.4, 1.97, 0.5, 2.6, glass);
        s(0, 2.1, 0, 1.6, 0.12, 3.6, 0x2a2d34); for (let i = 0; i < 3; i++) s(0, 2.22, -1.2 + i * 1.2, 1.5, 0.05, 0.08, 0x2a2d34); // bagageiro
      } else if (type === 'pickup') {
        s(0, 0.35, 0, 1.9, 0.6, 4.6, col); s(0, 0.95, 0.75, 1.75, 0.65, 1.8, col); s(0, 1.0, 0.8, 1.77, 0.38, 1.6, glass);
        s(0.9, 0.95, -1.25, 0.1, 0.3, 2.1, col); s(-0.9, 0.95, -1.25, 0.1, 0.3, 2.1, col); s(0, 0.95, -2.25, 1.9, 0.3, 0.1, col);
        s(0, 0.96, -1.2, 1.6, 0.06, 1.9, 0x2a2016); s(0, 1.0, -0.6, 0.8, 0.4, 0.6, 0x6a4a2a);                    // caçamba com caixa
      } else {
        s(0, 0.35, 0, 1.9, 0.55, 4.2, col); s(0, 0.9, -0.25, 1.66, 0.5, 2.1, glass); s(0, 1.4, -0.3, 1.74, 0.08, 1.75, col);
        for (const sx of [-1, 1]) for (const zz of [0.78, -0.3, -1.28]) s(sx * 0.84, 0.9, zz, 0.08, 0.5, 0.1, col);
        s(0, 0.89, 1.35, 1.7, 0.03, 1.2, new THREE.Color(col).multiplyScalar(0.85).getHex());                        // capô
        if (type === 'taxi') { s(0, 1.48, -0.3, 0.55, 0.18, 0.3, 0x111111); g(0, 1.5, -0.3, 0.5, 0.14, 0.32, 0xffe060); for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) s(sx * 0.955, 0.62, -1.75 + i * 0.5, 0.01, 0.1, 0.25, i % 2 ? 0x111111 : 0xf0f0f0); }
        if (type === 'police') { s(0, 1.48, -0.3, 1.1, 0.12, 0.3, 0x111111); g(-0.3, 1.52, -0.3, 0.45, 0.12, 0.26, 0xff2030); g(0.3, 1.52, -0.3, 0.45, 0.12, 0.26, 0x2060ff);
          for (const sx of [-1, 1]) s(sx * 0.955, 0.55, 0, 0.01, 0.3, 2.0, 0xf0f0f0); }
      }
      const L2 = type === 'van' ? 2.25 : type === 'pickup' ? 2.3 : 2.1;
      s(0, 0.3, L2 + 0.04, 1.94, 0.22, 0.12, 0x222222); s(0, 0.3, -L2 - 0.04, 1.94, 0.22, 0.12, 0x222222);       // para-choques
      s(0, 0.5, L2 + 0.02, 0.9, 0.18, 0.05, 0x111111); s(0, 0.33, L2 + 0.11, 0.42, 0.11, 0.02, 0xe8e8e8); s(0, 0.33, -L2 - 0.11, 0.42, 0.11, 0.02, 0xe8e8e8); // grade + placas
      g(0.65, 0.58, L2 + 0.01, 0.34, 0.13, 0.04, 0xfff3c8); g(-0.65, 0.58, L2 + 0.01, 0.34, 0.13, 0.04, 0xfff3c8);
      g(0.7, 0.58, -L2 - 0.01, 0.36, 0.13, 0.04, 0xff2030); g(-0.7, 0.58, -L2 - 0.01, 0.36, 0.13, 0.04, 0xff2030);
      for (const sx of [-1, 1]) { s(sx * 1.0, 0.9, 0.7, 0.14, 0.09, 0.14, col);
        for (const zz of [1.35, -1.35]) { s(sx * 0.86, 0, zz * (L2 / 2.1), 0.3, 0.68, 0.68, rubber); s(sx * 1.02, 0.17, zz * (L2 / 2.1), 0.04, 0.34, 0.34, rim); } }
      const grp = new THREE.Group(), body = LS.Items.mesh(LS.Items.merge(P)); body.receiveShadow = true; grp.add(body);
      grp.add(new THREE.Mesh(LS.Items.merge(Gl), new THREE.MeshBasicMaterial({ vertexColors: true })));
      grp.position.set(x, 0, z); grp.rotation.y = rot; sc.add(grp); return grp;
    };
    car(4.5, -6.2, 0, 'taxi', 0xf0c020);
    car(4.55, -11.2, 0, 'van', 0x3a6a8a);
    car(-4.5, -9.5, Math.PI, 'sedan', 0xb03a3a);
    car(-4.55, -25, Math.PI, 'police', 0x1a1c22);
    car(4.5, -24, 0, 'pickup', 0x4a6a3a);
    reflect(4.5, -6.2 + 2.2, 1.2, 3, 0xfff3c8, 0.18);
    // food truck com varal de luzes na calçada da direita, depois do cruzamento
    { const t = car(8.3, -28, 0, 'van', 0xe07a2a); t.rotation.y = Math.PI / 2; G(8.3, 1.1, -27.0, 3.2, 0.9, 0.04, 0xffe0a8);
      S(8.3, 2.0, -26.4, 3.6, 0.1, 1.2, 0xc0392b, 0.35, 0, 0);
      for (let i = 0; i < 9; i++) G(6.5 + i * 0.45, 2.55 - Math.sin(i / 8 * Math.PI) * 0.35, -26.0, 0.1, 0.1, 0.1, pick(neonC)); }
    // carros que passam no cruzamento (farol + lanterna)
    L.traffic = [];
    for (let i = 0; i < 3; i++) {
      const c = car(0, 0, 0, pick(['sedan', 'sedan', 'taxi', 'van']), pick([0xb03a3a, 0x2a5ab0, 0xe0e0e0, 0x2a2a2a, 0x3a8a5a, 0xf0c020]));
      const dir = i % 2 ? -1 : 1; c.rotation.y = dir * Math.PI / 2;
      L.traffic.push({ g: c, dir, x: -40 + i * 27, z: dir > 0 ? -15.2 : -17.8, spd: rand(9, 13) });
    }

    // ---------- céu: estrelas, lua e skyline ao longe ----------
    const sp = []; for (let i = 0; i < 500; i++) sp.push(rand(-80, 80), rand(18, 70), rand(-90, -60));
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sc.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, fog: false })));
    const moonTex = tex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.3, 'rgba(255,245,220,1)'); gr.addColorStop(0.36, 'rgba(200,215,255,0.35)'); gr.addColorStop(1, 'rgba(120,150,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
      g.fillStyle = 'rgba(200,190,170,0.5)'; for (const [x, y, r] of [[54, 52, 6], [72, 70, 4], [60, 76, 3]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } });
    const moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, transparent: true })); moonS.scale.set(14, 14, 1); moonS.position.set(-22, 34, -80); sc.add(moonS);
    for (let i = 0; i < 26; i++) {
      const x = -60 + i * 4.8 + rand(-1, 1), h = rand(10, 34), w = rand(3, 5), z = rand(-75, -62);
      S(x, 0, z, w, h, 3, 0x0e1222);
      for (let y = 2; y < h - 1; y += 1.5) for (let k = -1; k <= 1; k++) if (R() < 0.3) G(x + k * w / 3.3, y, z + 1.52, 0.5, 0.5, 0.02, pick(winC));
      if (R() < 0.4) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2020, fog: false })); a.position.set(x, h + 0.4, z); sc.add(a); L.anims.push({ type: 'blink', m: a, ph: R() * 6 }); }
    }

    // ---------- palco do personagem: plataforma, anel e feixe de holofote ----------
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.85, 0.09, 8), new THREE.MeshPhongMaterial({ color: 0x1c1f28, specular: 0x404a70, shininess: 60 }));
    stage.position.y = 0.045; stage.rotation.y = Math.PI / 8; add(stage);
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(1.87, 1.87, 0.03, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8a1f, side: THREE.DoubleSide }));
    edge.position.y = 0.06; edge.rotation.y = Math.PI / 8; sc.add(edge); L.edge = edge;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.22, 48), new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.095; sc.add(ring); L.ring = ring;
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.38, 48, 1, 0, Math.PI * 1.4), new THREE.MeshBasicMaterial({ color: 0xffc531, transparent: true, opacity: 0.6 }));
    ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.1; sc.add(ring2); L.anims.push({ type: 'spin', m: ring2 });
    const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 9, 24, 1, true), new THREE.MeshBasicMaterial({ map: coneTex, color: 0xffd8a0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    spot.position.set(0, 4.5, 0); sc.add(spot);

    // ---------- fundir tudo ----------
    add(new THREE.Mesh(LS.Items.merge(solid), LS.Items.material()), true);
    sc.add(new THREE.Mesh(LS.Items.merge(glow), new THREE.MeshBasicMaterial({ vertexColors: true })));

    // ---------- partículas: chuva fina e vapor do bueiro ----------
    const rp = [];
    for (let i = 0; i < 700; i++) rp.push(rand(-12, 12), rand(0, 14), rand(-25, 8));
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    L.rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0x9fb8e0, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false }));
    sc.add(L.rain);
    const steamTex = tex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    L.steam = [];
    for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, color: 0xb8c4e0, transparent: true, depthWrite: false, opacity: 0 })); sc.add(s); L.steam.push({ s, t: i / 10 }); }
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
    L.neonL.intensity = 1.35 + Math.sin(t * 1.7) * 0.3;
    L.neonR.intensity = 1.35 + Math.cos(t * 1.3) * 0.3;
    for (const a of L.anims) {
      if (a.type === 'blink') a.m.visible = Math.sin(t * 3 + a.ph) > 0.2;
      else if (a.type === 'scroll') a.t.offset.x = (t * 0.05) % 1;
      else if (a.type === 'spin') a.m.rotation.z = t * 0.8;
    }
    if (L.edge) L.edge.material.color.setHSL(0.07 + Math.sin(t * 0.8) * 0.03, 1, 0.5 + Math.sin(t * 3) * 0.08);
    // semáforo: verde 4s, amarelo 1s, vermelho 4s (os dois lados alternados)
    L.lights.forEach((lamps, i) => {
      const c = (t + i * 4.5) % 9, on = c < 4 ? 2 : c < 5 ? 1 : 0;
      lamps.forEach((l, k) => l.m.material.color.copy(l.c).multiplyScalar(k === on ? 1 : 0.15));
    });
    // trânsito no cruzamento
    for (const c of L.traffic) {
      c.x += c.dir * c.spd * dt;
      if (c.x > 45) c.x = -45; if (c.x < -45) c.x = 45;
      c.g.position.set(c.x, 0, c.z);
    }
    // vapor subindo do bueiro
    for (const p of L.steam) {
      p.t = (p.t + dt * 0.22) % 1;
      p.s.position.set(1.6 + Math.sin(p.t * 6 + t) * 0.25, 0.1 + p.t * 3.2, -1.6 + Math.cos(p.t * 5) * 0.2);
      p.s.scale.setScalar(0.6 + p.t * 1.8); p.s.material.opacity = Math.sin(p.t * Math.PI) * 0.35;
    }
  }
};
