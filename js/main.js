// Menus, painéis de configuração e inicialização
'use strict';
LS.UI = {
  screens: ['menu-main', 'lobby', 'panel-modes', 'panel-shop', 'panel-friends', 'panel-arsenal', 'panel-stats', 'panel-news', 'panel-settings', 'panel-controls', 'panel-credits', 'loading', 'pause', 'endscreen'],
  current: 'menu-main', backTo: 'menu-main',

  showScreen(id) {
    this.screens.forEach(s => document.getElementById(s).classList.toggle('active', s === id));
    this.current = id;
  },
  subPanelOpen() { return ['panel-modes', 'panel-shop', 'panel-friends', 'panel-settings', 'panel-controls', 'panel-credits', 'panel-arsenal', 'panel-stats', 'panel-news'].includes(this.current); },
  openPanel(id) { this.backTo = this.current; this.showScreen(id); },
  back() { this.showScreen(this.backTo || 'menu-main'); },
  updateMenuStats() {
    if (LS.Menu) LS.Menu.render();
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
      $('set-res').value = S.resScale; $('val-res').textContent = Math.round(S.resScale * 100) + '%';
      $('set-perf').checked = S.perfMode;
      $('set-postfx').checked = S.postfx !== false;
      $('set-aa').checked = S.aimAssist !== false;
      const v = S.vivid === undefined ? 0.6 : S.vivid; $('set-vivid').value = v; $('val-vivid').textContent = Math.round(v * 100) + '%';
    };
    this.syncSettings = sync;
    const changed = () => { LS.saveSettings(); sync(); LS.Game.applySettings(); };
    $('set-sens').addEventListener('input', e => { S.sensitivity = +e.target.value; changed(); });
    $('set-quality').addEventListener('change', e => { S.quality = e.target.value; changed(); });
    $('set-vol').addEventListener('input', e => { S.volume = +e.target.value; changed(); });
    $('set-dist').addEventListener('input', e => { S.renderDistance = +e.target.value; changed(); });
    $('set-fps').addEventListener('change', e => { S.showFps = e.target.checked; changed(); });
    $('set-res').addEventListener('input', e => { S.resScale = +e.target.value; changed(); });
    $('set-perf').addEventListener('change', e => { S.perfMode = e.target.checked; changed(); });
    $('set-postfx').addEventListener('change', e => { S.postfx = e.target.checked; changed(); });
    $('set-aa').addEventListener('change', e => { S.aimAssist = e.target.checked; changed(); });
    $('set-vivid').addEventListener('input', e => { S.vivid = +e.target.value; changed(); });
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
      case 'play': LS.Touch.goFull(); if (LS.Game.state !== 'menu' && LS.Game.state !== 'lobby') LS.Game.quitToMenu(); LS.Lobby.startSearch(); break;
      case 'customize': LS.Lobby.open(); break;
      case 'arsenal': LS.Menu.renderArsenal(); this.openPanel('panel-arsenal'); break;
      case 'stats': LS.Menu.renderStats(); this.openPanel('panel-stats'); break;
      case 'stats-reset': LS.Menu.resetStats(); break;
      case 'news': this.openPanel('panel-news'); break;
      case 'modes': LS.Modes.open(); break;
      case 'shop': LS.Shop.open('shop'); break;
      case 'royale': LS.Shop.open('royale'); break;
      case 'friends': LS.Friends.open(); break;
      case 'mute': LS.Menu.toggleMute(); break;
      case 'fullscreen': LS.Menu.toggleFullscreen(); break;
      case 'lobby-start': LS.Touch.goFull(); LS.Lobby.startSearch(); break;
      case 'lobby-cancel': LS.Lobby.cancelSearch(); break;
      case 'lobby-random': LS.Lobby.random(); break;
      case 'lobby-reset': LS.Lobby.reset(); break;
      case 'lobby-back': LS.Lobby.cancelSearch(); LS.Wardrobe.leave(); LS.Game.quitToMenu(); break;
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
  LS.Touch.init(); // celular: controles de toque (só liga em tela de toque)
  LS.Cosmetics.init(); // itens grátis / da loja (antes do guarda-roupa)
  LS.Lobby.build();
  LS.Anim.initLoco(); // carrega a run_f (anims/locomocao.json) para a corrida
  LS.Anim.initDrop(); // arrastar .glb/.fbx para a janela toca a animação no personagem
  LS.Modes.init();
  LS.Account.init(); // conta (se já entrou neste navegador)
  LS.Profile.init();
  LS.Shop.init(); LS.Friends.init(); LS.Menu.initBanners();
  LS.Menu.init();
  document.getElementById('arsenal-list').addEventListener('click', e => { const b = e.target.closest('[data-wpn]'); if (b) { LS.Audio.init(); LS.Audio.click(); LS.Menu.pickLobbyWeapon(b.dataset.wpn); } });
  LS.UI.bindSettings();
  LS.UI.updateMenuStats();
  document.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () => LS.UI.onAction(b.dataset.action)));
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && LS.UI.subPanelOpen()) LS.UI.back();
    else if (e.code === 'Escape' && LS.UI.current === 'lobby') { if (LS.Lobby.searching) LS.Lobby.cancelSearch(); else { LS.Wardrobe.leave(); LS.Game.quitToMenu(); } }
  });
});
