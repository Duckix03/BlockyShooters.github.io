// Texturas geradas por código (canvas, sem imagens externas): grama, terra, folhagem, reboco, tábuas e tijolos.
// São quase cinzas e multiplicam a cor do material, então a mesma textura serve para várias cores.
// Aplicação "triplanar" pela posição no mundo: não estica em paredes de tamanhos diferentes e funciona em InstancedMesh.
'use strict';
LS.Tex = {
  S: 256, cache: {}, mats: {},
  rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  // desenha repetindo nas bordas para a textura emendar sem costura
  wrap(g, fn) { const S = this.S; for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } },
  rgb: (r, g, b, a = 1) => 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')',
  blotches(g, R, n, rMin, rMax, light, dark, alpha) {
    for (let i = 0; i < n; i++) {
      const x = R() * this.S, y = R() * this.S, r = rMin + R() * (rMax - rMin), c = R() < 0.5 ? light : dark;
      this.wrap(g, () => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, this.rgb(...c, alpha)); gr.addColorStop(1, this.rgb(...c, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); });
    }
  },
  grain(g, R, amt) { // ruído fino por pixel
    const S = this.S, d = g.getImageData(0, 0, S, S), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const n = (R() - 0.5) * amt; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
    g.putImageData(d, 0, 0);
  },

  GEN: {
    // grama cartoon: cor chapada, manchas suaves grandes e tufinhos desenhados com contorno (sem ruído granulado)
    grass(g, R, T) {
      g.fillStyle = T.rgb(222, 228, 210); g.fillRect(0, 0, T.S, T.S);
      T.blotches(g, R, 14, 40, 90, [240, 245, 222], [196, 206, 182], 0.5);
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 0; i < 46; i++) { // tufos em "W" (3 folhinhas)
        const x = R() * T.S, y = R() * T.S, sz = 5 + R() * 5, dark = R() < 0.65;
        T.wrap(g, () => {
          g.strokeStyle = dark ? T.rgb(150, 168, 130, 0.9) : T.rgb(250, 255, 235, 0.95); g.lineWidth = 2.2;
          g.beginPath(); g.moveTo(x - sz * 0.6, y - sz * 0.8); g.lineTo(x - sz * 0.25, y); g.lineTo(x, y - sz); g.lineTo(x + sz * 0.25, y); g.lineTo(x + sz * 0.6, y - sz * 0.8); g.stroke();
        });
      }
      for (let i = 0; i < 14; i++) { // florzinhas de 4 pétalas
        const x = R() * T.S, y = R() * T.S, c = R() < 0.5 ? [255, 255, 255] : [255, 236, 140];
        T.wrap(g, () => { g.fillStyle = T.rgb(...c); for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { g.beginPath(); g.arc(x + dx, y + dy, 1.8, 0, 7); g.fill(); }
          g.fillStyle = T.rgb(250, 190, 60); g.beginPath(); g.arc(x, y, 1.2, 0, 7); g.fill(); });
      }
    },
    dirt(g, R, T) {
      g.fillStyle = T.rgb(210, 200, 185); g.fillRect(0, 0, T.S, T.S);
      T.blotches(g, R, 50, 15, 55, [235, 225, 205], [160, 145, 125], 0.4);
      for (let i = 0; i < 260; i++) { // pedrinhas com sombra
        const x = R() * T.S, y = R() * T.S, r = 1.5 + R() * 3.5, l = 200 + R() * 50;
        T.wrap(g, () => { g.fillStyle = T.rgb(120, 110, 95, 0.6); g.beginPath(); g.ellipse(x + 1, y + 1.2, r, r * 0.75, 0, 0, 7); g.fill();
          g.fillStyle = T.rgb(l, l * 0.97, l * 0.92); g.beginPath(); g.ellipse(x, y, r, r * 0.75, R() * 3, 0, 7); g.fill(); });
      }
      g.strokeStyle = T.rgb(140, 125, 105, 0.5); g.lineWidth = 1;
      for (let i = 0; i < 25; i++) { let x = R() * T.S, y = R() * T.S; const pts = [[x, y]]; for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 18; y += (R() - 0.5) * 18; pts.push([x, y]); }
        T.wrap(g, () => { g.beginPath(); g.moveTo(...pts[0]); pts.forEach(p => g.lineTo(...p)); g.stroke(); }); } // rachaduras
      T.grain(g, R, 26);
    },
    // folhagem cartoon: "escamas" de folhas arredondadas com sombra embaixo e brilho em cima
    leaves(g, R, T) {
      g.fillStyle = T.rgb(200, 212, 190); g.fillRect(0, 0, T.S, T.S);
      for (let i = 0; i < 170; i++) {
        const x = R() * T.S, y = R() * T.S, r = 9 + R() * 9;
        T.wrap(g, () => {
          g.fillStyle = T.rgb(150, 165, 140, 0.8); g.beginPath(); g.arc(x, y + r * 0.28, r, 0, 7); g.fill();     // sombra
          g.fillStyle = T.rgb(226, 236, 214); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();                    // folha
          g.fillStyle = T.rgb(250, 255, 240, 0.85); g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.38, r * 0.38, r * 0.2, -0.5, 0, 7); g.fill(); // brilho
        });
      }
    },
    bark(g, R, T) { // casca: listras verticais onduladas
      g.fillStyle = T.rgb(210, 200, 190); g.fillRect(0, 0, T.S, T.S);
      for (let i = 0; i < 28; i++) {
        let x = R() * T.S; const w = 3 + R() * 6, dark = R() < 0.6;
        g.strokeStyle = dark ? T.rgb(140, 125, 110, 0.8) : T.rgb(235, 228, 218, 0.8); g.lineWidth = w;
        g.beginPath(); g.moveTo(x, -10); for (let y = 0; y <= T.S + 10; y += 20) { x += (R() - 0.5) * 6; g.lineTo(x, y); } g.stroke();
      }
    },
    plaster(g, R, T) {
      g.fillStyle = T.rgb(228, 226, 220); g.fillRect(0, 0, T.S, T.S);
      T.blotches(g, R, 30, 25, 80, [245, 244, 240], [195, 190, 180], 0.3);
      for (let i = 0; i < 6; i++) { const x = R() * T.S, y = R() * T.S; T.wrap(g, () => { const gr = g.createLinearGradient(x, y, x, y + 70); gr.addColorStop(0, T.rgb(170, 165, 155, 0.25)); gr.addColorStop(1, T.rgb(170, 165, 155, 0)); g.fillStyle = gr; g.fillRect(x, y, 8 + R() * 14, 70); }); } // escorridos
      g.strokeStyle = T.rgb(150, 145, 135, 0.4); g.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) { let x = R() * T.S, y = R() * T.S; const pts = [[x, y]]; for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 14; y += R() * 12; pts.push([x, y]); }
        T.wrap(g, () => { g.beginPath(); g.moveTo(...pts[0]); pts.forEach(p => g.lineTo(...p)); g.stroke(); }); }
      T.grain(g, R, 22);
    },
    planks(g, R, T) { // tábuas verticais (galpão): 4 por ladrilho
      const S = T.S, bw = S / 4;
      for (let b = 0; b < 4; b++) {
        const l = 185 + R() * 40; g.fillStyle = T.rgb(l, l * 0.97, l * 0.93); g.fillRect(b * bw, 0, bw, S);
        for (let k = 0; k < 14; k++) { // veios
          let x = b * bw + 4 + R() * (bw - 8); g.strokeStyle = T.rgb(l * 0.72, l * 0.68, l * 0.62, 0.5); g.lineWidth = 0.7 + R();
          g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= S; y += 16) { x += (R() - 0.5) * 1.6; g.lineTo(x, y); } g.stroke();
        }
        if (R() < 0.7) { const y = R() * S; g.fillStyle = T.rgb(l * 0.6, l * 0.55, l * 0.5, 0.7); g.beginPath(); g.ellipse(b * bw + bw / 2, y, 5, 8, 0, 0, 7); g.fill(); } // nó
        g.fillStyle = T.rgb(70, 62, 55); g.fillRect(b * bw, 0, 2, S); g.fillRect(b * bw + bw - 1, 0, 1, S); // fresta
        g.fillStyle = T.rgb(90, 90, 95); for (const y of [S * 0.2, S * 0.7]) { g.fillRect(b * bw + 8, y, 3, 3); g.fillRect(b * bw + bw - 11, y, 3, 3); } // pregos
      }
      T.grain(g, R, 16);
    },
    brick(g, R, T) { // 8 fiadas, tijolos desencontrados
      const S = T.S, rows = 8, rh = S / rows, bw = S / 4;
      g.fillStyle = T.rgb(238, 234, 226); g.fillRect(0, 0, S, S); // argamassa
      for (let r = 0; r < rows; r++) for (let c = -1; c < 4; c++) {
        const x = c * bw + (r % 2 ? bw / 2 : 0), l = 150 + R() * 60;
        T.wrap(g, () => { g.fillStyle = T.rgb(l, l * 0.93, l * 0.88); g.fillRect(x + 2, r * rh + 2, bw - 4, rh - 4);
          g.fillStyle = T.rgb(255, 255, 255, 0.12); g.fillRect(x + 2, r * rh + 2, bw - 4, 2); });
      }
      T.blotches(g, R, 20, 15, 45, [250, 245, 235], [120, 110, 100], 0.2);
      T.grain(g, R, 24);
    }
  },
  // textura + ganho (1 / brilho médio): multiplicar pela textura não escurece a cor original
  get(name) {
    if (this.cache[name]) return this.cache[name];
    const S = this.S, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true }), R = this.rng(name.length * 7919 + name.charCodeAt(0) * 31);
    this.GEN[name](g, R, this);
    const p = g.getImageData(0, 0, S, S).data; let sum = 0;
    for (let i = 0; i < p.length; i += 4) sum += (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
    return (this.cache[name] = { tex, gain: (p.length / 4) / sum, canvas: c });
  },
  // tamanho de 1 ladrilho no mundo (metros)
  SCALE: { grass: 4, dirt: 2.5, leaves: 1.8, bark: 1.2, plaster: 2.2, planks: 2.4, brick: 1.4 },

  // ---------- injeção no shader (Lambert/Phong) ----------
  VERT: `#include <begin_vertex>
    vec4 tpW = vec4(transformed, 1.0); vec3 tpN = objectNormal;
    #ifdef USE_INSTANCING
      tpW = instanceMatrix * tpW; tpN = mat3(instanceMatrix) * tpN;
    #endif
    tpW = modelMatrix * tpW; vTpPos = tpW.xyz; vTpN = normalize(mat3(modelMatrix) * tpN);`,
  // aplica uma textura triplanar a um material
  triplanar(mat, name) {
    const T = this.get(name), sc = 1 / this.SCALE[name];
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { tpMap: { value: T.tex }, tpScale: { value: sc }, tpGain: { value: T.gain } });
      sh.vertexShader = 'varying vec3 vTpPos; varying vec3 vTpN;\n' + sh.vertexShader.replace('#include <begin_vertex>', this.VERT);
      sh.fragmentShader = 'uniform sampler2D tpMap; uniform float tpScale; uniform float tpGain; varying vec3 vTpPos; varying vec3 vTpN;\n' +
        sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          vec3 tpA = abs(vTpN);
          vec2 tpUV = (tpA.x > tpA.y && tpA.x > tpA.z) ? vTpPos.zy : (tpA.y > tpA.z ? vTpPos.xz : vTpPos.xy);
          diffuseColor.rgb *= texture2D(tpMap, tpUV * tpScale).rgb * tpGain;`);
    };
    mat.customProgramCacheKey = () => 'tp_' + name;
    return mat;
  },
  // material com textura (cache por cor + textura); vertexColors para malhas com cor por vértice
  material(color, name, vertexColors) {
    const k = color + name + (vertexColors ? 'v' : '');
    return this.mats[k] || (this.mats[k] = this.triplanar(new THREE.MeshLambertMaterial(vertexColors ? { vertexColors: true } : { color }), name));
  },
  // terreno: grama e terra misturadas pelo atributo "tmix" (0 grama, 1 terra/areia/pedra) + variação larga anti-repetição
  terrainMaterial() {
    const G = this.get('grass'), D = this.get('dirt'), mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { tGrass: { value: G.tex }, tDirt: { value: D.tex }, tGG: { value: G.gain }, tDG: { value: D.gain } });
      sh.vertexShader = 'attribute float tmix; varying float vTMix; varying vec2 vTXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n vTMix = tmix; vTXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = 'uniform sampler2D tGrass; uniform sampler2D tDirt; uniform float tGG; uniform float tDG; varying float vTMix; varying vec2 vTXZ;\n' +
        sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          vec3 tg = texture2D(tGrass, vTXZ / ${this.SCALE.grass.toFixed(1)}).rgb * tGG;
          vec3 td = texture2D(tDirt, vTXZ / ${this.SCALE.dirt.toFixed(1)}).rgb * tDG;
          float macro = texture2D(tGrass, vTXZ / 37.0 + 0.31).g * tGG;
          diffuseColor.rgb *= mix(tg, td, smoothstep(0.2, 0.8, vTMix)) * mix(0.9, 1.1, clamp(macro - 0.5, 0.0, 1.0));`);
    };
    mat.customProgramCacheKey = () => 'terrain_tex';
    return mat;
  }
};
