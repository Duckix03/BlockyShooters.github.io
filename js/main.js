// Menus, painéis de configuração e inicialização
'use strict';
LS.UI = {
  screens: ['menu-main', 'panel-settings', 'panel-controls', 'panel-credits', 'loading', 'pause', 'endscreen'],
  current: 'menu-main', backTo: 'menu-main',

  showScreen(id) {
    this.screens.forEach(s => document.getElementById(s).classList.toggle('active', s === id));
    this.current = id;
  },
  subPanelOpen() { return ['panel-settings', 'panel-controls', 'panel-credits'].includes(this.current); },
  openPanel(id) { this.backTo = this.current; this.showScreen(id); },
  back() { this.showScreen(this.backTo || 'menu-main'); },
  updateMenuStats() {
    const s = LS.stats;
    document.getElementById('menu-stats').textContent = 'Partidas: ' + s.games + '  ·  Vitórias: ' + s.wins + '  ·  Abates totais: ' + s.kills;
  },

  // ---------- Configurações ----------
  bindSettings() {
    const S = LS.settings, $ = id => document.getElementById(id);
    const sync = () => {
      $('set-sens').value = S.sensitivity; $('val-sens').textContent = (+S.sensitivity).toFixed(2);
      $('set-quality').value = S.quality;
      $('set-vol').value = S.volume; $('val-vol').textContent = Math.round(S.volume * 100) + '%';
      $('set-dist').value = S.renderDistance; $('val-dist').textContent = S.renderDistance + ' m';
      $('set-fullscreen').checked = !!document.fullscreenElement;
      $('set-fps').checked = S.showFps;
    };
    this.syncSettings = sync;
    const changed = () => { LS.saveSettings(); sync(); LS.Game.applySettings(); };
    $('set-sens').addEventListener('input', e => { S.sensitivity = +e.target.value; changed(); });
    $('set-quality').addEventListener('change', e => { S.quality = e.target.value; changed(); });
    $('set-vol').addEventListener('input', e => { S.volume = +e.target.value; changed(); });
    $('set-dist').addEventListener('input', e => { S.renderDistance = +e.target.value; changed(); });
    $('set-fps').addEventListener('change', e => { S.showFps = e.target.checked; changed(); });
    $('set-fullscreen').addEventListener('change', e => {
      S.fullscreen = e.target.checked; LS.saveSettings();
      if (e.target.checked) { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => { e.target.checked = false; }); }
      else if (document.fullscreenElement) document.exitFullscreen();
    });
    document.addEventListener('fullscreenchange', sync);
    sync();
  },

  onAction(a) {
    LS.Audio.init(); LS.Audio.click();
    switch (a) {
      case 'play': LS.Game.startMatch(); break;
      case 'settings': this.syncSettings(); this.openPanel('panel-settings'); break;
      case 'controls': this.openPanel('panel-controls'); break;
      case 'credits': this.openPanel('panel-credits'); break;
      case 'back': this.back(); break;
      case 'settings-reset':
        Object.assign(LS.settings, LS.defaultSettings); LS.saveSettings(); this.syncSettings(); LS.Game.applySettings();
        if (document.fullscreenElement) document.exitFullscreen();
        break;
      case 'resume': LS.Game.resume(); break;
      case 'quit': LS.Game.quitToMenu(); break;
    }
  }
};

window.addEventListener('load', () => {
  if (typeof THREE === 'undefined') {
    document.body.innerHTML = '<div style="color:#fff;font-family:sans-serif;padding:40px;font-size:20px">Não foi possível carregar o Three.js. Verifique sua conexão com a internet e recarregue a página.</div>';
    return;
  }
  LS.Game.init();
  LS.UI.bindSettings();
  LS.UI.updateMenuStats();
  document.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () => LS.UI.onAction(b.dataset.action)));
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && LS.UI.subPanelOpen()) LS.UI.back();
  });
});
