// Perfil no estilo Free Fire: personagem 3D do lado, foto de perfil de verdade (foto 3D do seu boneco ou
// uma imagem sua), nome, ID, curtidas, recado (bio), selos (verificado, criador de conteúdo, dev, owner),
// patente, nível e estatísticas. Também mostra o perfil de outros jogadores (bots) no fim da partida.
'use strict';
LS.Profile = {
  // selos: quem tem algum fica com o "verificado" azul do lado do nome
  BADGES: {
    owner: { label: 'OWNER', cls: 'b-owner', icon: '<path d="M3 18h18l-2-10-5 4-2-7-2 7-5-4z" fill="currentColor"/>' },
    dev: { label: 'DEV', cls: 'b-dev', icon: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' },
    cc: { label: 'CRIADOR DE CONTEÚDO', cls: 'b-cc', icon: '<rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor"/><path d="M10 9l5 3-5 3z" fill="#fff"/>' },
    verificado: { label: 'VERIFICADO', cls: 'b-ver', icon: '<path d="M12 2l2.6 2 3.3-.3.9 3.2 2.9 1.6-1.2 3.1 1.2 3.1-2.9 1.6-.9 3.2-3.3-.3L12 22l-2.6-2-3.3.3-.9-3.2-2.9-1.6 1.2-3.1-1.2-3.1 2.9-1.6.9-3.2 3.3.3z" fill="currentColor"/><path d="M8 12l3 3 5-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' }
  },
  // IDs oficiais: coloque aqui o seu ID (aparece no perfil) pra ganhar os selos em qualquer navegador com esse ID
  OFFICIAL: { /* '1234567890': ['owner', 'dev'], */ },
  BG: [['#ff8a1f', '#ffc531'], ['#2fd6ff', '#3a5bff'], ['#ff4d6d', '#7a1fff'], ['#8cf060', '#1f8a5a'], ['#ffe3a0', '#ff7a59'], ['#2a3246', '#5a6478'], ['#ff5ad1', '#ffb36b'], ['#1a1a1a', '#ff3b3b']],
  RANKS: [[0, 'BRONZE', '#c98a5a'], [5, 'PRATA', '#c9d2e3'], [10, 'OURO', '#ffc531'], [15, 'PLATINA', '#5ad1c9'], [20, 'DIAMANTE', '#7ab8ff'], [30, 'MESTRE', '#c08cff'], [40, 'DESAFIANTE', '#ff4d6d']],
  BIOS: ['Só jogo de capa 🎯', 'Rush ou nada!', 'Sniper desde 2019', 'Mira na cabeça e fé', 'Procurando squad', 'Não confia no gás', 'Bora x1 no galpão?', 'Main escopeta 💥', 'Último em pé, sempre', 'GG no final'],
  cache: {},

  // ---------- dados do jogador ----------
  init() {
    const P = LS.playerProfile;
    if (!P.id) P.id = String(1000000000 + Math.floor(Math.random() * 8999999999)); // ID de 10 dígitos, fixo pra sempre
    if (typeof P.likes !== 'number') P.likes = 0;
    if (typeof P.bio !== 'string') P.bio = 'Bora sobreviver! 🪂';
    if (!Array.isArray(P.badges)) P.badges = [];
    if (!P.avatar) P.avatar = { type: '3d', bg: 0 };
    if (!P.cover) P.cover = 'br';
    LS.saveProfile();
    this.bind(); this.bound = true;
    this.renderTop();
    document.getElementById('end-foe').addEventListener('click', () => {
      if (!this.endFoe) return; LS.Audio.init(); LS.Audio.click();
      this.open(this.fakeProfile(this.endFoe)); LS.UI.openPanel('panel-stats');
    });
  },
  badgesOf(p) { return [...new Set([...(p.badges || []), ...(this.OFFICIAL[p.id] || [])])].filter(b => this.BADGES[b]); },
  rankOf(level) { let r = this.RANKS[0]; for (const k of this.RANKS) if (level >= k[0]) r = k; return { name: r[1], color: r[2] }; },
  hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
  esc(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); },

  // curtidas ganhas no fim da partida (outros jogadores curtem quem joga bem)
  earnLikes(P, win) {
    let n = Math.floor(P.kills / 2) + (Math.random() < 0.35 ? 1 : 0);
    if (LS.Game.mode === 'duel') n += win ? 2 : 0; else n += win ? 4 : P.placement && P.placement <= 10 ? 1 : 0;
    LS.playerProfile.likes += n; LS.saveProfile();
    return n;
  },

  // ---------- fotos 3D (com os modelos do jogo) ----------
  lights(sc) {
    sc.add(new THREE.HemisphereLight(0xffffff, 0x445066, 0.75));
    const key = new THREE.DirectionalLight(0xfff1dc, 0.8); key.position.set(2, 3, 4); sc.add(key);
    const rim = new THREE.DirectionalLight(0x9fdcff, 0.7); rim.position.set(-3, 2, -3); sc.add(rim);
  },
  model(look, gun, pose) {
    const m = new LS.CharacterModel({ look });
    m.setGun(gun || null);
    const s = Object.assign({ dt: 0.05, speed: 0, aimPitch: 0, armed: !!gun, running: !!gun, armedAim: false, idle: true }, pose || {});
    for (let i = 0; i < 40; i++) m.animate(s);
    return m;
  },
  // foto de rosto (fundo transparente) pintada sobre um degradê
  headshot(look, bg) {
    const k = 'h|' + JSON.stringify(look) + '|' + bg;
    if (this.cache[k]) return this.cache[k];
    const sc = new THREE.Scene(); this.lights(sc);
    const m = this.model(look, null); m.root.rotation.y = 0.35; sc.add(m.root);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20); cam.position.set(0.18, 1.62, 1.35); cam.lookAt(0, 1.5, 0);
    const shot = LS.Banners.snap(sc, cam, 160, 160, { alpha: true, ss: 2 });
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const g = c.getContext('2d'), cols = this.BG[bg % this.BG.length], gr = g.createLinearGradient(0, 0, 160, 160);
    gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]); g.fillStyle = gr; g.fillRect(0, 0, 160, 160);
    g.globalAlpha = 0.18; g.fillStyle = '#fff'; for (let i = -160; i < 160; i += 22) { g.beginPath(); g.moveTo(i, 160); g.lineTo(i + 10, 160); g.lineTo(i + 170, 0); g.lineTo(i + 160, 0); g.fill(); }
    g.globalAlpha = 1; g.drawImage(shot, 0, 0);
    return (this.cache[k] = c.toDataURL('image/png'));
  },
  // personagem de corpo inteiro (fundo transparente) pro lado do perfil
  fullbody(look, gun) {
    const k = 'f|' + JSON.stringify(look) + '|' + gun;
    if (this.cache[k]) return this.cache[k];
    const sc = new THREE.Scene(); this.lights(sc);
    const m = this.model(look, gun); m.root.rotation.y = 0.5; sc.add(m.root);
    const cam = new THREE.PerspectiveCamera(28, 0.62, 0.1, 30); cam.position.set(0.3, 1.05, 4.3); cam.lookAt(0, 0.95, 0);
    return (this.cache[k] = LS.Banners.snap(sc, cam, 310, 500, { alpha: true, ss: 2 }).toDataURL('image/png'));
  },
  // foto do perfil de alguém (a enviada pela pessoa, ou a foto 3D do boneco)
  avatarOf(p) {
    if (p.avatar && p.avatar.type === 'img' && p.avatar.data) return p.avatar.data;
    try { return this.headshot(p.look, (p.avatar && p.avatar.bg) || 0); } catch (e) { return ''; }
  },
  coverOf(p) {
    const id = p.cover || 'br';
    if (id.startsWith('g')) return null; // capa de cor lisa (degradê)
    return LS.Banners.cached(id);
  },

  // ---------- topo do lobby ----------
  renderTop() {
    const el = document.getElementById('lb-avatar'); if (!el || !LS.Game.renderer) return;
    const P = LS.playerProfile, url = this.avatarOf(P);
    el.innerHTML = url ? '<img src="' + url + '" alt="">' : this.esc((P.name || 'J').charAt(0).toUpperCase());
    const v = document.getElementById('lb-verified'); if (v) v.innerHTML = this.badgesOf(P).length ? this.verifiedIcon() : '';
  },
  verifiedIcon() { return '<svg class="pf-vtick" viewBox="0 0 24 24">' + this.BADGES.verificado.icon + '</svg>'; },

  // ---------- perfil de outro jogador (bots): dados fixos tirados do nome ----------
  fakeProfile(f) {
    const R = LS.util.seeded(this.hash(f.name + '|' + JSON.stringify(f.model.look)));
    const level = 3 + Math.floor(R() * 55), games = 20 + Math.floor(R() * 900), wins = Math.floor(games * (0.03 + R() * 0.2));
    const kills = Math.floor(games * (0.8 + R() * 3));
    return { other: true, name: f.name, look: f.model.look, weapon: f.weapons && f.weapons[0] ? f.weapons[0].id : (f.model.gunId || 'ak47'),
      id: String(1000000000 + (this.hash(f.name) % 8999999999)), likes: Math.floor(R() * R() * 4000), bio: this.BIOS[Math.floor(R() * this.BIOS.length)],
      badges: [], avatar: { type: '3d', bg: Math.floor(R() * this.BG.length) }, cover: ['br', 'duel1', 'duel2', 'g1'][Math.floor(R() * 4)],
      stats: { games, wins, kills, xp: 150 * (level - 1) * (level - 1) + Math.floor(R() * 150 * level), dmg: kills * (60 + R() * 40), best: wins ? 1 : 2 + Math.floor(R() * 10), coins: Math.floor(R() * 20000) } };
  },

  // ---------- painel ----------
  open(p) { // sem p = o seu perfil
    this.view = p || null; this.closeModal();
    this.render();
    LS.Banners.generate(['br', 'duel1', 'duel2'], () => { if (LS.UI.current === 'panel-stats') this.render(); }); // capas
  },
  render() {
    const own = !this.view, p = own ? LS.playerProfile : this.view, s = own ? LS.stats : p.stats;
    const M = LS.Menu, lvl = M.levelOf(s.xp), a = M.xpFor(lvl), b = M.xpFor(lvl + 1), rank = this.rankOf(lvl), badges = this.badgesOf(p);
    const games = s.games || 0, wins = s.wins || 0, deaths = Math.max(1, games - wins);
    const cover = this.coverOf(p), gcol = this.BG[(+String(p.cover || 'g0').slice(1) || 0) % this.BG.length];
    const coverStyle = cover ? 'background-image:url(' + cover + ')' : 'background:linear-gradient(160deg,' + gcol[0] + ',' + gcol[1] + ')';
    let body = '', full = '';
    try { full = this.fullbody(p.look, p.weapon || null); } catch (e) { /* sem WebGL */ }
    const liked = !own && this.liked && this.liked[p.id];
    body += '<div class="pf"><div class="pf-left"><div class="pf-cover" style="' + coverStyle + '"></div><div class="pf-left-shade"></div>' + (full ? '<img class="pf-char" src="' + full + '" alt="">' : '') +
      '<div class="pf-rank" style="--rk:' + rank.color + '"><svg viewBox="0 0 24 24"><path d="M12 2l8 4.6v10.8L12 22l-8-4.6V6.6z" fill="currentColor"/><path d="M12 6.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#fff" opacity=".9"/></svg><div><small>PATENTE</small><b>' + rank.name + '</b></div></div></div>';
    body += '<div class="pf-right"><div class="pf-head">' +
      '<div class="pf-avatar">' + (this.avatarOf(p) ? '<img src="' + this.avatarOf(p) + '" alt="">' : '') + (own ? '<button class="pf-cam" data-pf="photo" title="Trocar foto">' + this.camIcon() + '</button>' : '') + '<span class="pf-lvl">' + lvl + '</span></div>' +
      '<div class="pf-idbox"><div class="pf-name">' + this.esc(p.name || 'Jogador') + (badges.length ? this.verifiedIcon() : '') + '</div>' +
      '<div class="pf-sub">ID: <b>' + p.id + '</b> <button class="pf-copy" data-pf="copy" title="Copiar ID">COPIAR</button> · BR</div>' +
      '<div class="pf-badges">' + (badges.length ? badges.map(k => { const B = this.BADGES[k]; return '<span class="pf-badge ' + B.cls + '"><svg viewBox="0 0 24 24">' + B.icon + '</svg>' + B.label + '</span>'; }).join('') : '<span class="pf-nobadge">Sem selos</span>') + '</div></div>' +
      '<div class="pf-likes' + (liked ? ' on' : '') + '"' + (own ? '' : ' data-pf="like"') + ' title="' + (own ? 'Curtidas que você recebeu' : 'Curtir') + '"><svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.6 3 5 6.6 5c2.1 0 3.6 1.2 5.4 3 1.8-1.8 3.3-3 5.4-3C21 5 23.1 8.6 21.6 11.8 19.5 16.4 12 21 12 21z" fill="currentColor"/></svg><b>' + (p.likes + (liked ? 1 : 0)).toLocaleString('pt-BR') + '</b><span>CURTIDAS</span></div></div>';
    body += '<div class="pf-xp"><span>NÍVEL ' + lvl + '</span><div><i style="width:' + Math.round(((s.xp || 0) - a) / (b - a) * 100) + '%"></i></div><span>' + ((s.xp || 0) - a) + ' / ' + (b - a) + ' XP</span></div>';
    body += '<div class="pf-bio"><small>RECADO</small><p>' + (p.bio ? this.esc(p.bio) : '<i>Sem recado</i>') + '</p>' + (own ? '<button data-pf="edit" title="Editar">' + this.penIcon() + '</button>' : '') + '</div>';
    body += '<div class="stats-grid pf-stats">' +
      '<div><b>' + games + '</b><span>PARTIDAS</span></div><div><b>' + wins + '</b><span>VITÓRIAS</span></div><div><b>' + (games ? Math.round(wins / games * 100) : 0) + '%</b><span>TAXA DE VITÓRIA</span></div>' +
      '<div><b>' + (s.kills || 0) + '</b><span>ABATES</span></div><div><b>' + ((s.kills || 0) / deaths).toFixed(2) + '</b><span>ABATES / MORTE</span></div><div><b>' + (s.best ? '#' + s.best : '-') + '</b><span>MELHOR COLOCAÇÃO</span></div>' +
      '</div></div></div>';
    document.getElementById('stats-body').innerHTML = body;
    document.getElementById('pf-buttons').innerHTML = own
      ? '<button class="btn" data-pf="edit">EDITAR PERFIL</button><button class="btn" data-pf="photo">FOTO</button><button class="btn" data-pf="cover">CAPA</button><button class="btn" data-pf="reset">ZERAR</button><button class="btn btn-primary" data-pf="back">VOLTAR</button>'
      : '<button class="btn' + (liked ? '' : ' btn-like') + '" data-pf="like">' + (liked ? 'CURTIDO ♥' : 'CURTIR ♥') + '</button><button class="btn btn-primary" data-pf="back">VOLTAR</button>';
    document.querySelector('#panel-stats h2').textContent = own ? 'MEU PERFIL' : 'PERFIL DO JOGADOR';
  },
  camIcon() { return '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>'; },
  penIcon() { return '<svg viewBox="0 0 24 24"><path d="M4 20l4-1 11-11-3-3L5 16z M14 6l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'; },

  // ---------- janelinhas: editar, foto, capa ----------
  modal(html) {
    const m = document.getElementById('pf-modal');
    m.innerHTML = '<div class="pf-modal-box">' + html + '</div>'; m.classList.remove('hidden');
  },
  closeModal() { document.getElementById('pf-modal').classList.add('hidden'); },
  openEdit() {
    const P = LS.playerProfile;
    this.modal('<h3>EDITAR PERFIL</h3><label>Nome</label><input id="pf-in-name" maxlength="16" spellcheck="false" autocomplete="off" value="' + this.esc(P.name) + '">' +
      '<label>Recado <small id="pf-bio-n"></small></label><textarea id="pf-in-bio" maxlength="80" rows="3">' + this.esc(P.bio || '') + '</textarea>' +
      '<div class="pf-modal-btns"><button class="btn" data-pf="close">CANCELAR</button><button class="btn btn-primary" data-pf="save">SALVAR</button></div>');
    const bio = document.getElementById('pf-in-bio'), n = document.getElementById('pf-bio-n'), upd = () => { n.textContent = bio.value.length + '/80'; };
    bio.addEventListener('input', upd); upd(); document.getElementById('pf-in-name').focus();
  },
  saveEdit() {
    const P = LS.playerProfile;
    P.name = document.getElementById('pf-in-name').value.trim().slice(0, 16) || 'Jogador';
    P.bio = document.getElementById('pf-in-bio').value.replace(/\s+/g, ' ').trim().slice(0, 80);
    LS.saveProfile(); this.closeModal(); this.render(); LS.Menu.render(); this.renderTop();
    if (LS.Lobby.built) LS.Lobby.syncUI();
  },
  openPhoto() {
    const P = LS.playerProfile, cur = P.avatar || {};
    const opts = this.BG.map((_, i) => '<button class="pf-ph' + (cur.type !== 'img' && (cur.bg || 0) === i ? ' sel' : '') + '" data-pf="ph" data-v="' + i + '"><img src="' + this.headshot(P.look, i) + '" alt=""></button>').join('');
    this.modal('<h3>FOTO DE PERFIL</h3><p class="pf-hint">Uma foto 3D do seu personagem (muda junto quando você troca o visual) ou uma imagem sua.</p>' +
      '<div class="pf-ph-grid">' + opts + (cur.type === 'img' ? '<button class="pf-ph sel"><img src="' + cur.data + '" alt=""></button>' : '') + '</div>' +
      '<div class="pf-modal-btns"><button class="btn" data-pf="upload">ENVIAR IMAGEM</button><button class="btn btn-primary" data-pf="close">PRONTO</button></div>');
  },
  setPhoto(bg) { LS.playerProfile.avatar = { type: '3d', bg }; LS.saveProfile(); this.openPhoto(); this.render(); this.renderTop(); },
  // imagem enviada: corta no meio, reduz pra 160x160 e guarda no navegador
  upload() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const file = inp.files && inp.files[0]; if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = c.height = 160;
          const s = Math.min(img.width, img.height), g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
          g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
          LS.playerProfile.avatar = { type: 'img', data: c.toDataURL('image/jpeg', 0.85) };
          LS.saveProfile(); this.openPhoto(); this.render(); this.renderTop();
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    };
    inp.click();
  },
  openCover() {
    const P = LS.playerProfile, cur = P.cover || 'br';
    const banners = [['br', 'Battle Royale'], ['duel1', 'Duelo 1v1'], ['duel2', 'Duelo 2v2']].map(([id, name]) => { const u = LS.Banners.cached(id);
      return '<button class="pf-cv' + (cur === id ? ' sel' : '') + '" data-pf="cv" data-v="' + id + '" style="' + (u ? 'background-image:url(' + u + ')' : 'background:#1a1e28') + '"><span>' + name + '</span></button>'; });
    const grads = [0, 1, 2, 3, 6, 7].map(i => '<button class="pf-cv' + (cur === 'g' + i ? ' sel' : '') + '" data-pf="cv" data-v="g' + i + '" style="background:linear-gradient(160deg,' + this.BG[i][0] + ',' + this.BG[i][1] + ')"></button>');
    this.modal('<h3>CAPA DO PERFIL</h3><div class="pf-cv-grid">' + banners.join('') + grads.join('') + '</div><div class="pf-modal-btns"><button class="btn btn-primary" data-pf="close">PRONTO</button></div>');
  },
  setCover(id) { LS.playerProfile.cover = id; LS.saveProfile(); this.openCover(); this.render(); },
  like() {
    const p = this.view; if (!p) return;
    this.liked = this.liked || {};
    this.liked[p.id] = !this.liked[p.id];
    LS.Audio.click(); this.render();
  },

  bind() {
    const root = document.getElementById('panel-stats');
    root.addEventListener('click', e => {
      const el = e.target.closest('[data-pf]'); if (!el) return;
      const a = el.dataset.pf; LS.Audio.init();
      if (a !== 'like') LS.Audio.click();
      switch (a) {
        case 'back': this.closeModal(); LS.UI.back(); break;
        case 'edit': this.openEdit(); break;
        case 'save': this.saveEdit(); break;
        case 'close': this.closeModal(); break;
        case 'photo': this.openPhoto(); break;
        case 'ph': this.setPhoto(+el.dataset.v); break;
        case 'upload': this.upload(); break;
        case 'cover': LS.Banners.generate(['br', 'duel1', 'duel2'], () => { if (!document.getElementById('pf-modal').classList.contains('hidden')) this.openCover(); }); this.openCover(); break;
        case 'cv': this.setCover(el.dataset.v); break;
        case 'like': this.like(); break;
        case 'reset': LS.Menu.resetStats(); this.render(); break;
        case 'copy': {
          const id = (this.view || LS.playerProfile).id;
          try { navigator.clipboard.writeText(id); } catch (err) { /* sem permissão */ }
          el.textContent = 'COPIADO!'; setTimeout(() => { el.textContent = 'COPIAR'; }, 1200);
          break;
        }
      }
    });
    root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'pf-in-name') this.saveEdit(); });
  }
};
