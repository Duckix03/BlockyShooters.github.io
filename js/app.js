// App Android (APK feito com Capacitor). No navegador este arquivo não faz nada.
//  - botão "voltar" do Android: pausa a partida / fecha o painel aberto / minimiza no menu (em vez de fechar o jogo)
//  - esconde o botão de tela cheia (o app já abre em tela cheia, deitado)
//  - minimizou o app no meio da partida: pausa
'use strict';
LS.App = {
  init() {
    if (!LS.IS_APP) return;
    document.body.classList.add('is-app');
    const P = (window.Capacitor && window.Capacitor.Plugins) || {};
    this.plugin = P.App || null;
    if (!this.plugin) return;
    this.plugin.addListener('backButton', () => this.back());
    this.plugin.addListener('pause', () => { if (LS.Game.state === 'playing') LS.Game.pause(); });
  },
  back() {
    const G = LS.Game;
    if (G.state === 'playing') { G.pause(); return; }
    if (LS.UI.current === 'menu-main') { this.plugin.minimizeApp(); return; }
    // o resto (painéis, pausa, lobby) já sabe o que fazer com o Esc
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
  },
};
