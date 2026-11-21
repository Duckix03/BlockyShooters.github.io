// Celular: controles de toque no estilo Free Fire.
//  - lado esquerdo: joystick (aparece onde o dedo encosta). Empurrou até a borda pra frente = corre
//  - resto da tela: arrastar o dedo gira a câmera
//  - ATIRAR (direita, grande): segurar atira; arrastar enquanto segura também mira (que nem no Free Fire). Tem um 2º botão de tiro na esquerda
//  - MIRAR, PULAR, AGACHAR, RECARREGAR, cura, PEGAR (quando tem item), mochila, mapa e pausa
// Tudo escreve no LS.Input (as mesmas teclas/mouse do computador), então o resto do jogo não muda.
'use strict';
LS.Touch = {
  active: false,
  detect() {
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    return !!(coarse && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
  },
  init() {
    if (!this.detect()) return;
    this.active = true;
    document.body.classList.add('mobile');
    const I = LS.Input;
    I.axis = { x: 0, y: 0 };
    this.roles = new Map(); // dedo -> o que ele está fazendo
    this.build();
    this.fit(); window.addEventListener('resize', () => this.fit());
  },
  // Tamanho da interface no celular. Antes tudo encolhia junto com a altura da tela (no celular deitado
  // ficava ~58% e pequeno demais). Agora os menus e a HUD ficam bem maiores, no estilo Free Fire,
  // e o layout do celular (css/ui.css) se arruma pra caber. O jogador ainda ajusta em Configurações.
  //  --uiz: menus · --hz: HUD (vida, mapa, armas) · --tbs / --tbo: tamanho e opacidade dos botões
  //  --cut-l / --cut-r: área do entalhe/furo da câmera (o app Android manda; no navegador o CSS usa env())
  fit() {
    const S = LS.settings, H = window.innerHeight, k = Math.max(0.8, Math.min(1.25, S.uiSize || 1));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const st = document.documentElement.style;
    st.setProperty('--uiz', clamp(clamp(H / 560, 0.66, 1) * k, 0.55, 1.2).toFixed(3));
    st.setProperty('--hz', clamp(clamp(H / 520, 0.7, 1) * k, 0.6, 1.2).toFixed(3));
    st.setProperty('--tbs', clamp(S.btnSize || 1, 0.7, 1.4).toFixed(2));
    st.setProperty('--tbo', clamp(S.btnAlpha === undefined ? 0.85 : S.btnAlpha, 0.3, 1).toFixed(2));
    document.body.classList.toggle('short', H < 520); // celular deitado: layout compacto dos menus
    const ins = window.__lsInsets; // vem do app Android (MainActivity)
    if (ins) { st.setProperty('--cut-l', (ins.l || 0) + 'px'); st.setProperty('--cut-r', (ins.r || 0) + 'px'); }
  },
  btn(id, label, icon, cls) { return '<button class="tb ' + (cls || '') + '" data-tb="' + id + '">' + (icon ? '<svg viewBox="0 0 24 24">' + icon + '</svg>' : '') + (label ? '<span>' + label + '</span>' : '') + '</button>'; },
  build() {
    const ICON = {
      fire: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" stroke-width="2"/>',
      aim: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v4M12 14v4M6 12h4M14 12h4" stroke="currentColor" stroke-width="2"/>',
      jump: '<path d="M12 4l7 8h-4v7H9v-7H5z" fill="currentColor"/>',
      crouch: '<path d="M5 18h14M8 14l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
      reload: '<path d="M19 12a7 7 0 1 1-2-5M19 4v4h-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
      bag: '<path d="M5 8h14l-1 12H6z M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="2"/>',
      map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14M15 6v14" fill="none" stroke="currentColor" stroke-width="2"/>',
      pause: '<path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
      med: '<rect x="4" y="6" width="16" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v7M8.5 12.5h7" stroke="#ff4d6d" stroke-width="2.6"/>',
      band: '<rect x="3" y="9" width="18" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="2" transform="rotate(-30 12 12)"/>',
      hand: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2 6-5 6s-5-2-6-5l-1-3a1.5 1.5 0 0 1 3-1z" fill="none" stroke="currentColor" stroke-width="2"/>'
    };
    const area = document.createElement('div'); area.id = 'touch-area'; // pega o joystick e o arrastar da câmera
    const ui = document.createElement('div'); ui.id = 'touch-ui';
    ui.innerHTML = '<div id="joy"><i></i></div>' +
      this.btn('fire', '', ICON.fire, 'fire') + this.btn('fire2', '', ICON.fire, 'fire2') + this.btn('aim', '', ICON.aim, 'aim') +
      this.btn('jump', '', ICON.jump, 'jump') + this.btn('crouch', '', ICON.crouch, 'crouch') + this.btn('reload', '', ICON.reload, 'reload') +
      this.btn('med', '', ICON.med, 'med') + this.btn('band', '', ICON.band, 'band') + this.btn('use', 'PEGAR', ICON.hand, 'use hidden') + this.btn('zoom', '8x', '', 'zoom hidden') +
      this.btn('bag', '', ICON.bag, 'bag') + this.btn('map', '', ICON.map, 'map') + this.btn('pause', '', ICON.pause, 'pause');
    const hud = document.getElementById('hud');
    hud.insertBefore(area, hud.firstChild); hud.appendChild(ui); // dentro da HUD: some junto quando a HUD some (menus)
    const rot = document.createElement('div'); rot.id = 'rotate-msg';
    rot.innerHTML = '<div><svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 9a8 8 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="2"/></svg><b>GIRE O CELULAR</b><span>O Last Survivor é jogado com o celular deitado</span></div>';
    document.body.appendChild(rot);
    const opt = { passive: false };
    area.addEventListener('touchstart', e => this.areaStart(e), opt);
    ui.addEventListener('touchstart', e => this.btnStart(e), opt);
    window.addEventListener('touchmove', e => this.move(e), opt);
    window.addEventListener('touchend', e => this.end(e), opt);
    window.addEventListener('touchcancel', e => this.end(e), opt);
    // armas da HUD viram botões (tocar troca de arma)
    ['slot-0', 'slot-1'].forEach((id, i) => document.getElementById(id).addEventListener('touchstart', e => { e.preventDefault(); LS.Input.pressed['Digit' + (i + 1)] = true; }, opt));
    this.joyEl = ui.querySelector('#joy'); this.knob = this.joyEl.querySelector('i');
    setInterval(() => this.sync(), 150);
  },
  playing() { return LS.Game.state === 'playing' && !LS.Game.inventoryOpen; },
  areaStart(e) {
    e.preventDefault();
    if (!this.playing()) return;
    for (const t of e.changedTouches) {
      const W = window.innerWidth, H = window.innerHeight;
      const joyBusy = [...this.roles.values()].some(r => r.role === 'joy');
      if (!joyBusy && t.clientX < W * 0.42 && t.clientY > H * 0.3) {
        this.roles.set(t.identifier, { role: 'joy', x0: t.clientX, y0: t.clientY });
        const o = this.joyEl.parentNode.getBoundingClientRect();
        this.joyEl.style.left = (t.clientX - o.left) + 'px'; this.joyEl.style.top = (t.clientY - o.top) + 'px'; this.joyEl.classList.add('on');
      } else this.roles.set(t.identifier, { role: 'look', x: t.clientX, y: t.clientY });
    }
  },
  btnStart(e) {
    const b = e.target.closest('[data-tb]'); if (!b) return;
    e.preventDefault();
    const I = LS.Input, G = LS.Game, a = b.dataset.tb, t = e.changedTouches[0];
    b.classList.add('down');
    const hold = { role: 'btn', el: b, x: t.clientX, y: t.clientY };
    if (a === 'pause') { if (G.state === 'playing') G.pause(); return this.release(b); }
    if (!this.playing() && a !== 'bag') return this.release(b);
    switch (a) {
      case 'fire': case 'fire2': I.mouse.left = true; I.mouse.leftPressed = true; hold.role = 'fire'; break; // segurando atira; arrastar mira
      case 'aim': I.mouse.right = !I.mouse.right; b.classList.toggle('lit', I.mouse.right); break;
      case 'jump': I.pressed.Space = true; I.keys.Space = true; hold.key = 'Space'; break;
      case 'crouch': I.pressed.KeyC = true; break;
      case 'reload': I.pressed.KeyR = true; break;
      case 'med': I.pressed.KeyH = true; break;
      case 'band': I.pressed.KeyG = true; break;
      case 'use': I.pressed.KeyE = true; I.keys.KeyE = true; hold.key = 'KeyE'; break;
      case 'bag': if (G.state === 'playing' && G.player.alive) G.setInventory(!G.inventoryOpen); break;
      case 'map': LS.HUD.toggleBigMap(); break;
      case 'zoom': { // luneta no celular (sem roda do mouse): 8x → 6x → 4x → 2x → volta pro máximo
        const P = G.player, wd = P.wdef(); if (!wd || !wd.scope) break;
        const steps = [wd.zoom, 6, 4, 2].filter((z, i, l) => z <= wd.zoom && l.indexOf(z) === i), i = steps.indexOf(P.scopeZoom);
        P.scopeZoom = steps[(i + 1) % steps.length]; break;
      }
    }
    this.roles.set(t.identifier, hold);
  },
  release(b) { setTimeout(() => b.classList.remove('down'), 120); },
  move(e) {
    if (!this.roles.size) return;
    let used = false;
    const I = LS.Input, k = 2.6;
    for (const t of e.changedTouches) {
      const r = this.roles.get(t.identifier); if (!r) continue;
      used = true;
      if (r.role === 'joy') {
        const R = Math.min(window.innerWidth, window.innerHeight) * 0.13 * (LS.settings.btnSize || 1);
        let dx = (t.clientX - r.x0) / R, dy = (t.clientY - r.y0) / R;
        const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
        I.axis.x = dx; I.axis.y = dy;
        this.knob.style.transform = 'translate(' + (dx * R * 0.9).toFixed(0) + 'px,' + (dy * R * 0.9).toFixed(0) + 'px)';
        I.keys.KeyW = dy < -0.35; I.keys.KeyS = dy > 0.35; I.keys.KeyA = dx < -0.35; I.keys.KeyD = dx > 0.35;
        I.keys.ShiftLeft = Math.min(1, m) > 0.92 && dy < -0.45; // empurrou até a borda pra frente: corre
      } else if (r.role === 'look' || r.role === 'fire') {
        I.mouse.dx += (t.clientX - r.x) * k; I.mouse.dy += (t.clientY - r.y) * k;
        r.x = t.clientX; r.y = t.clientY;
      }
    }
    if (used) e.preventDefault();
  },
  end(e) {
    const I = LS.Input;
    for (const t of e.changedTouches) {
      const r = this.roles.get(t.identifier); if (!r) continue;
      this.roles.delete(t.identifier);
      if (r.role === 'joy') {
        I.axis.x = I.axis.y = 0; I.keys.KeyW = I.keys.KeyS = I.keys.KeyA = I.keys.KeyD = I.keys.ShiftLeft = false;
        this.knob.style.transform = ''; this.joyEl.classList.remove('on'); this.joyEl.style.left = ''; this.joyEl.style.top = '';
      } else if (r.role === 'fire') { if (![...this.roles.values()].some(x => x.role === 'fire')) I.mouse.left = false; this.release(r.el); }
      else if (r.role === 'btn') { if (r.key) I.keys[r.key] = false; this.release(r.el); }
    }
  },
  // botões que dependem da situação: PEGAR só quando tem item pra pegar; mirar volta ao normal quando troca de estado
  sync() {
    if (!this.active) return;
    const G = LS.Game, P = G.player, ui = document.getElementById('touch-ui');
    ui.classList.toggle('air', !!P && P.state !== 'ground');
    if (P && P.meds) for (const [b, n] of [['med', P.meds.medkit], ['band', P.meds.bandage]]) {
      const el = ui.querySelector('[data-tb=' + b + ']'); el.dataset.n = n | 0; el.classList.toggle('empty', !n);
    }
    const zb = ui.querySelector('[data-tb=zoom]'), zOn = !!(P && P.scopeUp);
    zb.classList.toggle('hidden', !zOn); if (zOn) zb.querySelector('span').textContent = (+P.scopeZoom).toFixed(P.scopeZoom % 1 ? 1 : 0) + 'x';
    const use = ui.querySelector('[data-tb=use]');
    use.classList.toggle('hidden', !(P && P.prompt && /\bE\b|<b>E<\/b>/.test(P.prompt)));
    if (P && (!P.alive || P.state !== 'ground' || !P.weapon()) && LS.Input.mouse.right) { LS.Input.mouse.right = false; ui.querySelector('[data-tb=aim]').classList.remove('lit'); }
    if (G.state !== 'playing' && this.roles.size) { this.roles.clear(); const I = LS.Input; I.mouse.left = false; I.axis.x = I.axis.y = 0; I.keys = {}; this.joyEl.classList.remove('on'); this.knob.style.transform = ''; }
  },
  // celular: ao apertar JOGAR, tenta tela cheia deitada
  goFull() {
    if (!this.active) return;
    try {
      const d = document.documentElement, p = d.requestFullscreen ? d.requestFullscreen() : null;
      if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
    } catch (e) { /* navegador não deixa */ }
  }
};
