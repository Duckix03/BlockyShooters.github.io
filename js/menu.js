// Lobby principal: barra do topo, nível/XP, moedas, modo de jogo, arsenal, perfil e dicas
'use strict';
LS.Menu = {
  tips: [
    'Segure W durante a queda livre para mergulhar mais rápido.',
    'Na sniper, segure SHIFT para prender a respiração e estabilizar a mira.',
    'Use a roda do mouse com a luneta para ajustar o zoom.',
    'Agachar (C) diminui o recuo e deixa você mais difícil de ver.',
    'Colete e capacete de nível 3 absorvem metade do dano.',
    'Fique de olho no mapa (M): a próxima zona aparece tracejada.',
    'Tiros chegam atrasados de longe: o som viaja a 343 m/s.',
    'Os sobrados têm loot no andar de cima. Suba pela escada!',
    'Bots ouvem tiros. Às vezes vale a pena esperar escondido.'
  ],
  tipI: 0,
  xpFor(level) { return 150 * (level - 1) * (level - 1); },
  levelOf(xp) { return Math.floor(Math.sqrt((xp || 0) / 150)) + 1; },

  init() {
    this.render();
    this.nextTip();
    setInterval(() => this.nextTip(), 7000);
  },
  nextTip() { document.getElementById('lb-tip').textContent = this.tips[this.tipI++ % this.tips.length]; },
  render() {
    const s = LS.stats, lvl = this.levelOf(s.xp), a = this.xpFor(lvl), b = this.xpFor(lvl + 1);
    const name = LS.playerProfile.name || 'Jogador';
    document.getElementById('lb-name').textContent = name;
    if (LS.Profile && LS.Profile.bound) LS.Profile.renderTop(); else document.getElementById('lb-avatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('lb-level').textContent = lvl;
    document.getElementById('lb-xp').style.width = Math.round(((s.xp || 0) - a) / (b - a) * 100) + '%';
    document.getElementById('lb-coins').textContent = (s.coins || 0).toLocaleString('pt-BR');
    document.getElementById('lb-wins').textContent = s.wins || 0;
    if (LS.Modes) LS.Modes.render();
    document.getElementById('lb-mute').innerHTML = LS.icon(LS.settings.muted ? 'mute' : 'sound');
    document.getElementById('menu-player-name').textContent = name;
  },
  toggleMute() { LS.settings.muted = !LS.settings.muted; LS.saveSettings(); LS.Game.applySettings(); this.render(); },
  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => { /* navegador recusou */ }); }
  },

  // ---- arsenal ----
  renderArsenal() {
    const W = LS.WEAPONS, ids = LS.WEAPON_IDS, cur = LS.playerProfile.weapon;
    const max = { dmg: Math.max(...ids.map(i => W[i].dmg * W[i].pellets)), rate: Math.max(...ids.map(i => W[i].rate)), range: Math.max(...ids.map(i => W[i].range)), mag: Math.max(...ids.map(i => W[i].mag)) };
    const bar = (label, v, m, txt) => '<div class="ars-stat"><span>' + label + '</span><div class="ars-bar"><div style="width:' + Math.round(Math.min(1, v / m) * 100) + '%"></div></div><span>' + txt + '</span></div>';
    document.getElementById('arsenal-list').innerHTML = ids.map(id => {
      const w = W[id], dmg = w.dmg * w.pellets;
      return '<div class="ars-card' + (cur === id ? ' sel' : '') + '"><div class="cat">' + w.cat.toUpperCase() + ' · ' + LS.AMMO_TYPES[w.ammo].name + '</div><h4>' + w.name + '</h4>' +
        bar('Dano', dmg, max.dmg, dmg) + bar('Cadência', w.rate, max.rate, w.rate + '/s') + bar('Alcance', w.range, max.range, w.range + 'm') +
        bar('Pente', w.mag, max.mag, w.mag) + bar('Recarga', 3.6 - w.reload, 3.6, w.reload + 's') + bar('Controle', 8 - w.recoil, 8, (8 - w.recoil).toFixed(1)) +
        '<button data-wpn="' + id + '">' + (cur === id ? 'NO LOBBY ✓' : 'MOSTRAR NO LOBBY') + '</button></div>';
    }).join('') + '<div class="ars-card' + (!cur ? ' sel' : '') + '"><div class="cat">SEM ARMA</div><h4>Mãos livres</h4><button data-wpn="">' + (!cur ? 'NO LOBBY ✓' : 'MOSTRAR NO LOBBY') + '</button></div>';
  },
  pickLobbyWeapon(id) {
    LS.playerProfile.weapon = id || null; LS.saveProfile();
    if (LS.Lobby.model) LS.Lobby.model.setGun(id || null);
    this.renderArsenal();
  },

  // ---- perfil ----
  renderStats() { LS.Profile.open(); }, // perfil completo em js/profile.js
  resetStats() {
    if (!confirm('Zerar todas as estatísticas, nível e moedas? Isso não pode ser desfeito.')) return;
    Object.keys(LS.stats).forEach(k => { LS.stats[k] = 0; }); LS.saveStats(); this.renderStats(); this.render();
  },

  // ---- recompensa no fim da partida ----
  award(P, win) {
    if (LS.Game.mode === 'duel') return this.awardDuel(P, win);
    const place = win ? 1 : P.placement || 31, s = LS.stats;
    const xp = P.kills * 120 + Math.round((31 - place) * 18) + (win ? 600 : 0) + Math.round(P.damageDealt * 0.5);
    const coins = P.kills * 50 + Math.round((31 - place) * 8) + (win ? 300 : 0);
    const before = this.levelOf(s.xp);
    s.xp = (s.xp || 0) + xp; s.coins = (s.coins || 0) + coins; s.dmg = (s.dmg || 0) + P.damageDealt;
    if (!s.best || place < s.best) s.best = place;
    LS.saveStats();
    return { xp, coins, levelUp: this.levelOf(s.xp) > before, level: this.levelOf(s.xp) };
  },
  // duelo: XP e moedas por round vencido (+ bônus de vitória)
  awardDuel(P, win) {
    const s = LS.stats, rounds = LS.Duel.score[0];
    const xp = rounds * 90 + (win ? 350 : 0) + Math.round(P.damageDealt * 0.3), coins = rounds * 30 + (win ? 150 : 0);
    const before = this.levelOf(s.xp);
    s.xp = (s.xp || 0) + xp; s.coins = (s.coins || 0) + coins; s.dmg = (s.dmg || 0) + P.damageDealt;
    LS.saveStats();
    return { xp, coins, levelUp: this.levelOf(s.xp) > before, level: this.levelOf(s.xp) };
  }
};
