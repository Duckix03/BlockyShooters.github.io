// Lobby: cena 3D com o personagem, personalização e busca de partida
'use strict';
LS.Lobby = {
  built: false, rotY: 0.4, dragging: false, mmT: 0, mmCount: 1, searching: false,

  build() {
    if (this.built) return;
    this.built = true;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x141c2c);
    sc.fog = new THREE.Fog(0x141c2c, 12, 30);
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
    sc.add(new THREE.HemisphereLight(0xbfd9ff, 0x2a2030, 0.75));
    const key = new THREE.DirectionalLight(0xffe2c0, 0.9); key.position.set(3, 6, 4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    sc.add(key);
    const rim = new THREE.PointLight(0xff8a1f, 1.2, 12); rim.position.set(-2, 2.5, -2.5); sc.add(rim);
    // plataforma de blocos
    const M = c => new THREE.MeshLambertMaterial({ color: c });
    const block = new THREE.BoxGeometry(1, 1, 1);
    const grassTop = M(0x4f8a34), dirt = M(0x7a5a3a), stone = M(0x6c6c74), glow = new THREE.MeshBasicMaterial({ color: 0xff8a1f });
    for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) {
      const d = Math.hypot(x, z); if (d > 6.3) continue;
      const m = new THREE.Mesh(block, d < 2.2 ? stone : (Math.random() < 0.15 ? dirt : grassTop));
      m.position.set(x, -0.5 - (d > 4.5 ? Math.random() * 0.3 : 0), z); m.receiveShadow = true; sc.add(m);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.75, 32), glow); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; sc.add(ring);
    this.ring = ring;
    // árvores e caixas decorativas
    const trunk = M(0x5a3d22), leaf = M(0x3d7a2a);
    [[-4, -3], [4.5, -2.5], [-3, 3.8]].forEach(([x, z]) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 0.5), trunk); t.position.set(x, 1.2, z); t.castShadow = true; sc.add(t);
      const l = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 2), leaf); l.position.set(x, 2.8, z); l.castShadow = true; sc.add(l);
    });
    [[2.6, 1.8, 0xb03a2e], [3.2, 0.9, 0xc98a1e], [-2.8, -1.2, 0x2e6bb0]].forEach(([x, z, c]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), M(c)); b.position.set(x, 0.4, z); b.rotation.y = Math.random(); b.castShadow = true; sc.add(b);
    });
    // personagem do jogador
    this.model = new LS.CharacterModel({ look: LS.playerProfile.look });
    sc.add(this.model.root);
    // bots esperando ao fundo
    this.extras = [];
    [[-1.9, -1.6], [1.9, -1.8], [-0.4, -3.2], [3.4, -3.6]].forEach(([x, z], i) => {
      const m = new LS.CharacterModel({}); m.root.position.set(x, 0, z); m.root.rotation.y = LS.util.rand(-0.5, 0.5);
      if (i % 2 === 0) m.setGun(LS.util.pick(['ak47', 'm4a1', 'mp5', 'awm']));
      sc.add(m.root); this.extras.push(m);
    });
    // rotação com o mouse
    document.getElementById('lobby').addEventListener('mousedown', e => {
      if (LS.Game.state === 'lobby' && (e.target.id === 'lobby' || e.target.classList.contains('lobby-hint'))) { this.dragging = true; this.lastX = e.clientX; }
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', e => { if (this.dragging) { this.rotY += (e.clientX - this.lastX) * 0.01; this.lastX = e.clientX; } });
    window.addEventListener('resize', () => { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); });
    this.buildUI();
  },

  buildUI() {
    const K = LS.Skin, box = document.getElementById('lobby-options');
    const rows = [
      ['skin', 'Pele', K.SKINS, true], ['hairStyle', 'Cabelo', K.HAIR_STYLES, false], ['hair', 'Cor do cabelo', K.HAIRS, true],
      ['eyes', 'Olhos', K.EYES, true], ['shirt', 'Camisa', K.SHIRTS, true], ['pattern', 'Estampa', K.PATTERNS, false], ['pants', 'Calça', K.PANTS, true]
    ];
    box.innerHTML = rows.map(([key, label, opts, color]) => '<label class="lobby-label">' + label + '</label><div class="swatches" data-key="' + key + '">' +
      opts.map(o => color ? '<div class="swatch" data-v="' + o + '" style="background:' + o + '"></div>' : '<button class="chip" data-v="' + o + '">' + o + '</button>').join('') + '</div>').join('');
    box.addEventListener('click', e => {
      const el = e.target.closest('[data-v]'); if (!el) return;
      const key = el.parentElement.dataset.key;
      LS.playerProfile.look[key] = el.dataset.v;
      this.changed(); LS.Audio.click();
    });
    const name = document.getElementById('lobby-name');
    name.addEventListener('input', () => { LS.playerProfile.name = name.value.trim().slice(0, 16) || 'Jogador'; LS.saveProfile(); });
  },
  changed() {
    LS.saveProfile();
    this.model.applyLook(LS.playerProfile.look);
    this.syncUI();
  },
  syncUI() {
    const look = LS.playerProfile.look;
    document.querySelectorAll('#lobby-options .swatches').forEach(row => {
      row.querySelectorAll('[data-v]').forEach(el => el.classList.toggle('sel', el.dataset.v === look[row.dataset.key]));
    });
    document.getElementById('lobby-name').value = LS.playerProfile.name;
    const s = LS.stats;
    document.getElementById('lobby-stats').textContent = '🏆 ' + s.wins + ' vitórias  ·  💀 ' + s.kills + ' abates  ·  🎮 ' + s.games + ' partidas';
  },

  open() {
    this.build();
    this.cancelSearch();
    this.model.applyLook(LS.playerProfile.look);
    this.extras.forEach(m => m.applyLook(LS.Skin.randomLook()));
    this.syncUI();
    LS.HUD.show(false);
    LS.UI.showScreen('lobby');
    LS.Game.state = 'lobby';
  },
  random() { const n = LS.playerProfile.name; LS.playerProfile.look = LS.Skin.randomLook(); LS.playerProfile.name = n; this.changed(); },
  reset() { LS.playerProfile.look = Object.assign({}, LS.defaultProfile.look); this.changed(); },
  startSearch() {
    if (this.searching) return;
    this.searching = true; this.mmCount = 1; this.mmT = 0;
    document.getElementById('lobby-mm').classList.remove('hidden');
    this.updateCount();
  },
  cancelSearch() { this.searching = false; document.getElementById('lobby-mm').classList.add('hidden'); },
  updateCount() { document.getElementById('mm-count').textContent = this.mmCount + ' / ' + (LS.BOT_COUNT + 1) + ' jogadores'; },

  update(dt) {
    const t = performance.now() * 0.001;
    if (!this.dragging) this.rotY += dt * 0.25;
    this.model.root.rotation.y = this.rotY;
    this.model.animate({ dt, speed: 0, aimPitch: 0, armed: false, idle: true });
    this.extras.forEach((m, i) => {
      m.root.position.y = 0;
      m.animate({ dt, speed: 0, aimPitch: Math.sin(t + i) * 0.1, armed: !!m.gunId, armedAim: false, crouch: i === 3, idle: true });
      m.headG.rotation.y = Math.sin(t * 0.7 + i * 2) * 0.5;
    });
    this.ring.material.color.setHSL(0.07, 1, 0.5 + Math.sin(t * 3) * 0.1);
    // câmera: personagem à direita do painel
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.position.set(-1.1, 1.6, 6.4 / Math.min(1, aspect / 1.5));
    this.camera.lookAt(-1.1, 0.95, 0);
    if (this.searching) {
      this.mmT -= dt;
      if (this.mmT <= 0) {
        this.mmT = LS.util.rand(0.03, 0.12);
        this.mmCount = Math.min(LS.BOT_COUNT + 1, this.mmCount + LS.util.randInt(1, 2));
        this.updateCount();
        if (this.mmCount >= LS.BOT_COUNT + 1) { this.searching = false; setTimeout(() => { document.getElementById('lobby-mm').classList.add('hidden'); LS.Game.startMatch(); }, 500); }
      }
    }
  }
};
