// Comemoração de vitória (estilo "BOOYAH!" do Free Fire): faixa amarela no topo com "LAST SURVIVOR!",
// o seu personagem parado no mapa e o botão VOLTAR com contagem. Acabou a contagem (ou clicou) = menu de fim.
'use strict';
LS.Victory = {
  DUR: 10,
  show(sub, onDone) {
    const el = document.getElementById('victory');
    this.onDone = onDone; this.left = this.DUR;
    el.querySelector('.vic-sub').textContent = sub;
    this.tick();
    el.classList.remove('hidden'); void el.offsetWidth; el.classList.add('show');
    clearInterval(this.timer);
    this.timer = setInterval(() => { this.left--; if (this.left <= 0) this.done(); else this.tick(); }, 1000);
    if (!this._bound) {
      this._bound = true;
      el.querySelector('.vic-back').addEventListener('click', () => { LS.Audio.click(); this.done(); });
      window.addEventListener('keydown', e => { if (!el.classList.contains('hidden') && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) this.done(); });
    }
  },
  tick() { document.querySelector('#victory .vic-back b').textContent = '(' + this.left + 's)'; },
  done() {
    clearInterval(this.timer);
    const cb = this.onDone; this.onDone = null;
    if (cb) cb();
  },
  hide() {
    clearInterval(this.timer); this.onDone = null;
    const el = document.getElementById('victory'); if (!el) return;
    el.classList.remove('show'); el.classList.add('hidden');
  }
};
