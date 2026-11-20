// Lobby: cena 3D com o personagem, personalização e busca de partida
'use strict';
LS.Lobby = {
  built: false, rotY: 0.4, dragging: false, mmT: 0, mmCount: 1, searching: false,

  build() {
    if (this.built) return;
    this.built = true;
    const sc = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 420); // enxerga o céu e a cidade ao longe
    LS.LobbyScene.build(sc, this);
    // personagem do jogador (segura a arma escolhida no Arsenal)
    this.model = new LS.CharacterModel({ look: LS.playerProfile.look });
    this.model.setGun(LS.playerProfile.weapon || null);
    sc.add(this.model.root);
    // dois sobreviventes conversando no fundo
    this.extras = [];
    [[-2.2, -1.9, 0.35], [2.2, -1.9, -0.35]].forEach(([x, z, ry]) => {
      const m = new LS.CharacterModel({}); m.root.position.set(x, 0, z); m.root.rotation.y = ry; m.setGun(ry > 0 ? 'm4a1' : 'ak47'); m.setGear(2, 1, 1);
      sc.add(m.root); this.extras.push(m);
    });
    // rotação com o mouse
    document.getElementById('lobby').addEventListener('mousedown', e => {
      if (LS.Game.state === 'lobby' && (e.target.id === 'lobby' || e.target.classList.contains('lobby-hint'))) { this.dragging = true; this.lastX = e.clientX; }
    });
    document.getElementById('menu-main').addEventListener('mousedown', e => {
      if (LS.Game.state === 'menu' && !e.target.closest('button')) { this.dragging = true; this.lastX = e.clientX; }
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', e => { if (this.dragging) { this.rotY += (e.clientX - this.lastX) * 0.01; this.lastX = e.clientX; } });
    window.addEventListener('resize', () => { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); });
    document.body.appendChild(document.getElementById('lobby-mm'));
    this.buildUI();
    this.syncUI();
  },

  buildUI() {
    const K = LS.Skin, box = document.getElementById('lobby-options');
    const rows = [
      ['skin', 'Pele', K.SKINS, true], ['hairStyle', 'Cabelo', K.HAIR_STYLES, false], ['hair', 'Cor do cabelo e barba', K.HAIRS, true],
      ['beard', 'Barba', K.BEARDS, false], ['eyes', 'Olhos', K.EYES, true], ['glasses', 'Óculos', K.GLASSES, false], ['mask', 'Máscara', K.MASKS, false],
      ['hat', 'Chapéu', K.HATS, false], ['top', 'Roupa', K.TOPS, false], ['shirt', 'Camisa', K.SHIRTS, true], ['pattern', 'Estampa', K.PATTERNS, false],
      ['accent', 'Cor da roupa / acessórios', K.ACCENTS, true], ['pants', 'Calça', K.PANTS, true]
    ];
    box.innerHTML = '<label class="lobby-label">Trajes</label><div class="presets">' + Object.keys(K.PRESETS).map(n => '<button class="chip" data-preset="' + n + '">' + n + '</button>').join('') + '</div>' + rows.map(([key, label, opts, color]) => '<label class="lobby-label">' + label + '</label><div class="swatches" data-key="' + key + '">' +
      opts.map(o => color ? '<div class="swatch" data-v="' + o + '" style="background:' + o + '"></div>' : '<button class="chip" data-v="' + o + '">' + o + '</button>').join('') + '</div>').join('');
    box.addEventListener('click', e => {
      const pr = e.target.closest('[data-preset]');
      if (pr) { Object.assign(LS.playerProfile.look, K.PRESETS[pr.dataset.preset]); this.changed(); LS.Audio.click(); return; }
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
    document.getElementById('menu-player-name').textContent = LS.playerProfile.name;
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
    const menuNow = LS.Game.state === 'menu';
    if (!this.dragging) { if (menuNow) this.rotY = LS.util.lerp(this.rotY, Math.sin(t * 0.4) * 0.25, Math.min(1, dt * 2)); else this.rotY += dt * 0.25; }
    this.model.root.rotation.y = this.rotY; this.model.root.position.y = 0;
    const armed = !!this.model.gunId;
    this.model.animate({ dt, speed: 0, aimPitch: 0, armed, running: armed, armedAim: false, idle: true });
    this.extras.forEach((m, i) => { // colegas de squad nas laterais, parados e olhando em volta
      m.animate({ dt, speed: 0, aimPitch: 0, armed: !!m.gunId, running: !!m.gunId, armedAim: false, idle: true });
      m.headG.rotation.y = Math.sin(t * 0.5 + i * 2.3) * 0.3;
    });
    this.ring.material.opacity = 0.45 + Math.sin(t * 2) * 0.15;
    LS.LobbyScene.update(this, dt, t);
    // câmera: personagem à direita do painel
    const aspect = window.innerWidth / window.innerHeight;
    const inMenu = LS.Game.state === 'menu';
    // menu: câmera perto e baixa, personagem grande no centro em cima do pedestal (estilo lobby de BR mobile)
    const tx = inMenu ? 0 : -1.1, dist = (inMenu ? 4.4 : 6.4) / Math.min(1, aspect / 1.5), cy = inMenu ? 1.45 : 1.6, ly = inMenu ? 1.2 : 0.95;
    const k = Math.min(1, dt * 4);
    this.camX = LS.util.lerp(this.camX === undefined ? tx : this.camX, tx, k);
    this.camD = LS.util.lerp(this.camD === undefined ? dist : this.camD, dist, k);
    this.camY = LS.util.lerp(this.camY === undefined ? cy : this.camY, cy, k); this.camLY = LS.util.lerp(this.camLY === undefined ? ly : this.camLY, ly, k);
    this.camera.position.set(this.camX + Math.sin(t * 0.3) * 0.08, this.camY, this.camD);
    this.camera.lookAt(this.camX, this.camLY, 0);
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
