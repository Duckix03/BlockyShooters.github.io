// Comemoração de vitória (estilo Fortnite / Free Fire): "LAST SURVIVOR!" dourado, raios girando e confete.
// Some sozinho depois de alguns segundos (ou com clique / tecla) e aí aparece o menu de fim de partida.
'use strict';
LS.Victory = {
  DUR: 5.6,
  show(sub, onDone) {
    const el = document.getElementById('victory');
    this.onDone = onDone; this.t0 = performance.now();
    el.querySelector('.vic-sub').textContent = sub;
    const conf = el.querySelector('.vic-confetti'), cols = ['#ffd34d', '#ff8a1f', '#ffffff', '#ff4d6d', '#2fd6ff', '#8cf060', '#c08cff'];
    let h = '';
    for (let i = 0; i < 90; i++) {
      const w = 6 + Math.random() * 8, round = Math.random() < 0.25;
      h += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;width:' + w.toFixed(0) + 'px;height:' + (round ? w : w * 0.45).toFixed(0) + 'px;background:' + cols[i % cols.length] +
        ';border-radius:' + (round ? '50%' : '2px') + ';animation-delay:' + (Math.random() * 2.2).toFixed(2) + 's;animation-duration:' + (2.6 + Math.random() * 2).toFixed(2) + 's;--dx:' + ((Math.random() - 0.5) * 240).toFixed(0) + 'px;--rot:' + ((Math.random() - 0.5) * 1440).toFixed(0) + 'deg"></i>';
    }
    conf.innerHTML = h;
    el.classList.remove('hidden'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.done(), this.DUR * 1000);
    if (!this._bound) {
      this._bound = true;
      const skip = () => { if (this.onDone && performance.now() - this.t0 > 1500) this.done(); }; // pular (depois de um tiquinho)
      el.addEventListener('click', skip);
      window.addEventListener('keydown', e => { if (!el.classList.contains('hidden') && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) skip(); });
    }
  },
  done() {
    clearTimeout(this.timer);
    const cb = this.onDone; this.onDone = null;
    if (cb) cb();
  },
  hide() {
    clearTimeout(this.timer); this.onDone = null;
    const el = document.getElementById('victory'); if (!el) return;
    el.classList.remove('show'); el.classList.add('hidden');
    el.querySelector('.vic-confetti').innerHTML = '';
  }
};
