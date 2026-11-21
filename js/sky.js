// Céu refeito: cúpula com degradê (zênite/horizonte), disco do sol com brilho, nuvens macias que se movem e estrelas no anoitecer
'use strict';
Object.assign(LS.World, {
  buildSky(scene) {
    this.hemi = new THREE.HemisphereLight(0xcfe4ff, 0x6a6050, 0.6); // luz do céu (de cima) e reflexo do chão (de baixo)
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xe4ecff, 0.16); scene.add(this.ambient); // preenchimento: sombra azulada e clara, nunca preta
    this.sun = new THREE.DirectionalLight(0xffffff, 0.9);
    Object.assign(this.sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
    this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.03; // sem "acne" de sombra tremendo nas paredes
    scene.add(this.sun); scene.add(this.sun.target);
    scene.background = new THREE.Color(0x9fd0f0);
    scene.fog = new THREE.Fog(0x9fd0f0, LS.effDist() * 0.3, LS.effDist());

    // ---- cúpula ----
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x2f7fd6) }, horizonColor: { value: new THREE.Color(0xbfe3ff) }, groundColor: { value: new THREE.Color(0x6a8a9a) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color(0xfff2d0) }, sunSize: { value: 0.9993 },
      time: { value: 0 }, cirrus: { value: new THREE.Color(0xffffff) }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 groundColor; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunSize; uniform float time; uniform vec3 cirrus;',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',
        'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }',
        'varying vec3 vDir;',
        'void main(){',
        '  vec3 d = normalize(vDir); float h = d.y;',
        '  vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(h, 0.55)) : mix(horizonColor, groundColor, min(1.0, -h * 4.0));',
        '  if (h > 0.0) {',                                       // nuvens finas (cirros) passando lá no alto
        '    vec2 uv = d.xz / (h + 0.18) * 1.4 + vec2(time * 0.010, time * 0.004);',
        '    float n = fbm(uv) + (vnoise(uv * 6.0 - time * 0.02) - 0.5) * 0.12;',            // 1 fbm só (mais leve)
        '    float c = smoothstep(0.52, 0.8, n) * smoothstep(0.02, 0.3, h);',
        '    col = mix(col, cirrus, c * 0.6);',
        '  }',
        '  float s = max(dot(d, normalize(sunDir)), 0.0);',
        '  col += sunColor * pow(s, 8.0) * 0.35;',            // halo largo
        '  col += sunColor * pow(s, 64.0) * 0.6;',            // brilho
        '  col = mix(col, vec3(1.0, 0.98, 0.9) * sunColor * 1.4, smoothstep(sunSize, sunSize + 0.0004, s));', // disco
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
    this.skyDome.renderOrder = -10; this.skyDome.frustumCulled = false;
    scene.add(this.skyDome);

    // ---- estrelas (aparecem no anoitecer) ----
    const sp = [];
    for (let i = 0; i < 700; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      if (u < 0.08) continue;
      sp.push(Math.cos(a) * r, u, Math.sin(a) * r);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.renderOrder = -9; this.stars.frustumCulled = false;
    scene.add(this.stars);

    // ---- nuvens macias (sprites com textura gerada) ----
    const tex = [];
    for (let v = 0; v < 4; v++) { // nuvens cartoon: bolotas chapadas, sombra azulada embaixo e borda macia
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
      const g = cv.getContext('2d'), R = LS.Tex.rng(101 + v * 17), puffs = [];
      const n = 6 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) { const x = 110 + (i / (n - 1)) * 290 + (R() - 0.5) * 30, r = 38 + R() * 42 - Math.abs(i / (n - 1) - 0.5) * 30; puffs.push([x, 170 - r * 0.55 - R() * 25, r]); }
      puffs.push([256, 175, 70]);
      const draw = (dy, grow, color) => { g.fillStyle = color; for (const [x, y, r] of puffs) { g.beginPath(); g.arc(x, y + dy, r + grow, 0, 7); g.fill(); } g.fillRect(100, 150 + dy, 312, 40 + grow); };
      g.filter = 'blur(3px)'; draw(4, 4, 'rgba(255,255,255,0.35)'); g.filter = 'none';           // halo macio
      draw(10, 0, 'rgb(196,214,236)');                                                           // sombra de baixo
      draw(0, -2, 'rgb(255,255,255)');                                                           // corpo
      g.globalCompositeOperation = 'source-atop';
      const sh = g.createLinearGradient(0, 120, 0, 200); sh.addColorStop(0, 'rgba(160,185,215,0)'); sh.addColorStop(1, 'rgba(160,185,215,0.55)');
      g.fillStyle = sh; g.fillRect(0, 0, 512, 256);
      g.fillStyle = 'rgba(255,255,255,0.85)'; for (const [x, y, r] of puffs) { g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.35, r * 0.4, r * 0.2, -0.4, 0, 7); g.fill(); } // brilho
      g.globalCompositeOperation = 'source-over';
      tex.push(new THREE.CanvasTexture(cv));
    }
    this.clouds = [];
    this.cloudSpan = 700;
    for (let i = 0; i < 46; i++) {
      const m = new THREE.SpriteMaterial({ map: tex[i % 4], transparent: true, depthWrite: false, fog: false, opacity: 0.95 });
      const s = new THREE.Sprite(m);
      const sc = LS.util.rand(70, 140);
      s.scale.set(sc, sc * 0.5, 1);
      s.userData = { x: LS.util.rand(-350, 350), z: LS.util.rand(-350, 350), y: LS.util.rand(245, 295), sc, ph: Math.random() * 6.28 }; // acima da rota do avião (190 m)
      s.renderOrder = -8;
      scene.add(s); this.clouds.push(s);
    }
    this.wind = new THREE.Vector2(3.5, 1.2);
    this.skyTime = 0;
    // ---- raios de sol girando devagar ----
    const rc = document.createElement('canvas'); rc.width = rc.height = 256;
    const rg = rc.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2, w = 0.07 + (i % 3) * 0.03, gr = rg.createRadialGradient(128, 128, 10, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      rg.fillStyle = gr; rg.beginPath(); rg.moveTo(128, 128); rg.arc(128, 128, 128, a - w, a + w); rg.closePath(); rg.fill();
    }
    this.sunRays = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(rc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.5 }));
    this.sunRays.renderOrder = -9; scene.add(this.sunRays);
    // ---- bandos de pássaros (2 quadros de animação: asas pra cima / pra baixo) ----
    const bird = up => { const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d');
      g.strokeStyle = '#1e2430'; g.lineWidth = 5; g.lineCap = g.lineJoin = 'round'; g.beginPath();
      if (up) { g.moveTo(6, 8); g.quadraticCurveTo(20, 6, 32, 20); g.quadraticCurveTo(44, 6, 58, 8); } else { g.moveTo(6, 22); g.quadraticCurveTo(20, 14, 32, 18); g.quadraticCurveTo(44, 14, 58, 22); }
      g.stroke(); return new THREE.CanvasTexture(c); };
    this.birdTex = [bird(true), bird(false)];
    this.flocks = [];
    for (let f = 0; f < 4; f++) {
      const fl = { ang: Math.random() * 6.28, rad: LS.util.rand(70, 160), y: LS.util.rand(55, 95), spd: LS.util.rand(0.05, 0.09) * (Math.random() < 0.5 ? 1 : -1), birds: [] };
      const n = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.birdTex[0], transparent: true, depthWrite: false, fog: false }));
        sp.scale.set(2.6, 1.3, 1); sp.renderOrder = -7; scene.add(sp);
        const side = i % 2 ? 1 : -1, row = Math.ceil(i / 2);
        fl.birds.push({ sp, off: [side * row * 3.2, (Math.random() - 0.5) * 1.5, -row * 3.0], ph: Math.random() * 6.28 });
      }
      this.flocks.push(fl);
    }

    // paleta ao longo da partida: manhã → dia → tarde → pôr do sol → anoitecer
    this.skyKeys = [
      { t: 0, top: 0x2f86f0, hor: 0xb4defc, sun: 0xfff6e6, i: 0.95, night: 0 },    // começa de dia: céu azul limpo
      { t: 0.3, top: 0x1f7cf2, hor: 0xbfe6ff, sun: 0xffffff, i: 1.05, night: 0 },  // meio-dia: azul forte
      { t: 0.7, top: 0x2a82ea, hor: 0xc6e8fb, sun: 0xfff3dc, i: 1.0, night: 0 },
      { t: 0.88, top: 0x3b5a9a, hor: 0xffa060, sun: 0xffa050, i: 0.8, night: 0.05 }, // pôr do sol
      { t: 1, top: 0x18224a, hor: 0x7a5a8a, sun: 0xd08060, i: 0.5, night: 0.85 }     // anoitecer
    ].map(k => Object.assign(k, { top: new THREE.Color(k.top), hor: new THREE.Color(k.hor), sun: new THREE.Color(k.sun) }));
  },

  updateSky(t, scene, focus, dt) {
    t = LS.util.clamp(t, 0, 1);
    const K = this.skyKeys;
    let a = K[0], b = K[K.length - 1];
    for (let i = 0; i < K.length - 1; i++) if (t >= K[i].t && t <= K[i + 1].t) { a = K[i]; b = K[i + 1]; break; }
    const k = (t - a.t) / Math.max(0.0001, b.t - a.t), U = this.skyUniforms;
    this.skyTime = (this.skyTime || 0) + dt; U.time.value = this.skyTime;
    U.topColor.value.copy(a.top).lerp(b.top, k);
    U.horizonColor.value.copy(a.hor).lerp(b.hor, k);
    U.groundColor.value.copy(U.horizonColor.value).multiplyScalar(0.7);
    U.sunColor.value.copy(a.sun).lerp(b.sun, k);
    scene.background.copy(U.horizonColor.value);
    scene.fog.color.copy(U.horizonColor.value).lerp(U.topColor.value, 0.15);
    this.sun.color.copy(U.sunColor.value);
    this.sun.intensity = LS.util.lerp(a.i, b.i, k);                 // sol (contraste luz/sombra sem estourar o branco)
    this.hemi.intensity = 0.3 + this.sun.intensity * 0.22;          // céu ilumina as sombras (de dia não fica escuro)
    this.hemi.color.copy(U.topColor.value).lerp(new THREE.Color(0xffffff), 0.6);
    // trajetória do sol (nasce, passa alto e se põe no fim da partida)
    const ang = 0.8 + t * 2.05; // sol já alto no começo (sombras curtas), se põe no fim
    const dir = new THREE.Vector3(Math.cos(ang) * 0.75, Math.sin(ang), -0.45).normalize();
    U.sunDir.value.copy(dir);
    this.sun.position.copy(focus).addScaledVector(dir, 200);
    this.sun.target.position.copy(focus);
    // cúpula, estrelas e nuvens seguem a câmera
    const cam = LS.Game && LS.Game.camera ? LS.Game.camera.position : focus;
    const R = Math.max(200, LS.effDist() * 0.92);
    this.skyDome.position.copy(cam); this.skyDome.scale.setScalar(R);
    this.stars.position.copy(cam); this.stars.scale.setScalar(R * 0.98);
    this.stars.material.opacity = LS.util.lerp(a.night, b.night, k);
    const far = LS.Game && LS.Game.camera ? LS.Game.camera.far : 500, span = this.cloudSpan;
    const tint = new THREE.Color(0xffffff).lerp(U.sunColor.value, 0.35).lerp(U.horizonColor.value, 0.2);
    for (const c of this.clouds) {
      const u = c.userData;
      u.x += this.wind.x * dt; u.z += this.wind.y * dt;
      // repete as nuvens em volta da câmera
      let rx = ((u.x - cam.x) % span + span * 1.5) % span - span / 2, rz = ((u.z - cam.z) % span + span * 1.5) % span - span / 2;
      c.position.set(cam.x + rx, u.y, cam.z + rz);
      const dist = Math.hypot(rx, rz, u.y - cam.y);
      // some de longe (fog) e também de PERTO: nuvem colada na câmera cobria a tela e travava a placa de vídeo
      c.material.opacity = 0.9 * LS.util.clamp((far * 0.95 - dist) / (far * 0.3), 0, 1) * LS.util.clamp((dist - 50) / 90, 0, 1);
      c.visible = c.material.opacity > 0.01;
      c.material.color.copy(tint);
      const br = 1 + Math.sin(this.skyTime * 0.25 + u.ph) * 0.04; c.scale.set(u.sc * br, u.sc * 0.5 * (2 - br), 1); // nuvem "respirando"
    }
    U.cirrus.value.copy(tint);
    // raios de sol
    this.sunRays.position.copy(cam).addScaledVector(dir, R * 0.85);
    this.sunRays.scale.setScalar(R * 0.2);
    this.sunRays.material.rotation += dt * 0.04;
    this.sunRays.material.color.copy(U.sunColor.value);
    this.sunRays.material.opacity = 0.3 * LS.util.clamp(dir.y * 3, 0, 1) * (1 - this.stars.material.opacity);
    // pássaros: voam em círculos em volta da câmera, batendo as asas
    for (const fl of this.flocks) {
      fl.ang += fl.spd * dt;
      const cx = cam.x + Math.cos(fl.ang) * fl.rad, cz = cam.z + Math.sin(fl.ang) * fl.rad;
      const hx = -Math.sin(fl.ang) * Math.sign(fl.spd), hz = Math.cos(fl.ang) * Math.sign(fl.spd); // direção do voo
      for (const b of fl.birds) {
        const [ox, oy, oz] = b.off;
        b.sp.position.set(cx + hz * ox + hx * oz, fl.y + oy + Math.sin(this.skyTime * 1.3 + b.ph) * 0.6, cz - hx * ox + hz * oz);
        b.sp.material.map = this.birdTex[Math.sin(this.skyTime * 9 + b.ph) > 0 ? 0 : 1];
        b.sp.material.opacity = 1 - this.stars.material.opacity;
      }
    }
  }
});
