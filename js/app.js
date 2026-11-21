// App Android (APK feito com Capacitor). No navegador este arquivo não faz nada.
//  - botão "voltar" do Android: pausa a partida / fecha o painel aberto / minimiza no menu (em vez de fechar o jogo)
//  - esconde o botão de tela cheia (o app já abre em tela cheia, deitado)
//  - minimizou o app no meio da partida: pausa
//  - recebe do Android onde fica o furo da câmera (window.__lsInsets) pra nada ficar escondido atrás dele
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
    // volta do navegador depois do login com Google (com.duckix03.lastsurvivor://login?code=...)
    this.plugin.addListener('appUrlOpen', e => { if (e && e.url && LS.Conta) LS.Conta.onAppUrl(e.url); });
    this.plugin.getLaunchUrl && this.plugin.getLaunchUrl().then(r => { if (r && r.url && LS.Conta) LS.Conta.onAppUrl(r.url); }).catch(() => {});
  },
  // área do entalhe/furo da câmera, mandada pelo Android (MainActivity) em px de CSS
  applyInsets() { if (LS.Touch && LS.Touch.active) LS.Touch.fit(); },
  back() {
    const G = LS.Game;
    if (G.state === 'playing') { G.pause(); return; }
    if (LS.UI.current === 'menu-main') { this.plugin.minimizeApp(); return; }
    // o resto (painéis, pausa, lobby) já sabe o que fazer com o Esc
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
  },
};
