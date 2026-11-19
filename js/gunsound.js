// Sons de armas refeitos: estalo + corpo + cauda com reverb, mecânica por categoria e atraso pela distância
'use strict';
LS.GUN_PROFILES = {
  'Pistola':  { crack: 2600, crackDur: 0.06, body: 170, bodyDur: 0.12, tail: 0.35, tailFreq: 1600, punch: 0.9, mech: 'slide' },
  'SMG':      { crack: 3200, crackDur: 0.045, body: 210, bodyDur: 0.08, tail: 0.25, tailFreq: 2000, punch: 0.7, mech: null },
  'Rifle':    { crack: 2200, crackDur: 0.07, body: 115, bodyDur: 0.16, tail: 0.6, tailFreq: 1300, punch: 1.0, mech: null },
  'Sniper':   { crack: 1700, crackDur: 0.1, body: 70, bodyDur: 0.3, tail: 1.6, tailFreq: 900, punch: 1.3, mech: 'bolt' },
  'Escopeta': { crack: 1100, crackDur: 0.12, body: 60, bodyDur: 0.3, tail: 0.9, tailFreq: 1000, punch: 1.3, mech: 'pump' }
};

Object.assign(LS.Audio, {
  _fx() {
    if (this.reverb) return;
    const c = this.ctx;
    // reverb com resposta ao impulso gerada (ambiente aberto com eco)
    const len = Math.floor(c.sampleRate * 2.2), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / c.sampleRate;
        let v = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
        if (Math.abs(t - 0.32) < 0.02 || Math.abs(t - 0.71) < 0.02) v *= 2.2; // ecos das montanhas
        d[i] = v;
      }
    }
    this.reverb = c.createConvolver(); this.reverb.buffer = ir;
    this.reverbGain = c.createGain(); this.reverbGain.gain.value = 0.35;
    this.reverb.connect(this.reverbGain); this.reverbGain.connect(this.master);
    // saturação suave para dar "soco"
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.4) / Math.tanh(2.4); }
    this.shaperCurve = curve;
  },
  _env(g, t, peak, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  },
  _noiseTo(dest, t, dur, type, freq, q, peak, attack) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); this._env(g, t, peak, attack || 0.002, dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.8); src.stop(t + dur + 0.05);
    return g;
  },
  _toneTo(dest, t, type, f0, f1, dur, peak) {
    const c = this.ctx, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = c.createGain(); this._env(g, t, peak, 0.002, dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  },
  // cliques metálicos da ação da arma
  _mech(kind, t, dest, vol) {
    const click = (dt, f, v) => { this._noiseTo(dest, t + dt, 0.035, 'bandpass', f, 6, v * vol); this._toneTo(dest, t + dt, 'square', f * 0.5, f * 0.4, 0.02, v * vol * 0.3); };
    if (kind === 'bolt') { click(0.55, 2400, 0.35); click(0.72, 1800, 0.4); click(0.95, 2600, 0.35); click(1.08, 2000, 0.45); }
    else if (kind === 'pump') { this._noiseTo(dest, t + 0.42, 0.12, 'bandpass', 900, 2, 0.45 * vol); click(0.52, 1500, 0.5); this._noiseTo(dest, t + 0.6, 0.1, 'bandpass', 1200, 2, 0.4 * vol); click(0.68, 2200, 0.5); }
    else if (kind === 'slide') click(0.04, 3200, 0.15);
  },

  gunshot(wdef, distance, pan) {
    if (!this.ctx) return;
    this._fx();
    const c = this.ctx, P = LS.GUN_PROFILES[wdef.cat] || LS.GUN_PROFILES.Rifle, vol = wdef.snd.vol;
    const d = distance || 0, far = LS.util.clamp(d / 260, 0, 1);
    const atten = distance === undefined ? 1 : Math.pow(1 - far, 1.6);
    if (atten < 0.01) return;
    // o som viaja a ~343 m/s
    const t = c.currentTime + (distance ? d / 343 : 0) + 0.002;
    const out = c.createGain(); out.gain.value = atten;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000 - far * 16500; // distância abafa os agudos
    out.connect(lp);
    if (c.createStereoPanner && pan !== undefined) { const p = c.createStereoPanner(); p.pan.value = LS.util.clamp(pan, -1, 1); lp.connect(p); p.connect(this.master); p.connect(this.reverb); }
    else { lp.connect(this.master); lp.connect(this.reverb); }
    const sat = c.createGain(); sat.gain.value = 0.9;
    const sh = c.createWaveShaper(); sh.curve = this.shaperCurve;
    const satOut = c.createGain(); satOut.gain.value = 0.8;
    sat.connect(sh); sh.connect(satOut); satOut.connect(out);
    const v = 0.0001 + vol;
    // 1) transiente seco
    this._noiseTo(sat, t, 0.015, 'highpass', 4000, 0.7, v * 1.2 * (1 - far));
    // 2) estalo característico
    this._noiseTo(sat, t, P.crackDur, 'bandpass', P.crack * (0.95 + Math.random() * 0.1), 1.2, v * 0.9);
    // 3) corpo grave (pressão)
    this._toneTo(sat, t, 'sine', P.body * 2.4, P.body * 0.45, P.bodyDur, v * P.punch);
    this._noiseTo(sat, t, P.bodyDur * 1.3, 'lowpass', 380, 0.8, v * 0.7 * P.punch);
    // 4) cauda (estrondo que se espalha)
    this._noiseTo(out, t + 0.01, P.tail * (1 + far * 0.8), 'lowpass', P.tailFreq * (1 - far * 0.5), 0.6, v * (0.35 + far * 0.3), 0.02);
    // 5) mecânica da arma (só perto)
    if (d < 40) this._mech(P.mech, t, out, (1 - d / 40) * 0.9);
    // envio extra para o reverb em tiros distantes (eco)
    if (far > 0.2) { const r = c.createGain(); r.gain.value = far * 0.6; out.connect(r); r.connect(this.reverb); }
  },

  reload(wdef) {
    if (!this.ctx) return;
    this._fx();
    const c = this.ctx, t = c.currentTime, T = wdef.reload, out = this.master;
    const clk = (dt, f, v, dur) => { this._noiseTo(out, t + dt, dur || 0.04, 'bandpass', f, 5, v); this._toneTo(out, t + dt, 'triangle', f * 0.6, f * 0.5, 0.03, v * 0.3); };
    if (wdef.cat === 'Escopeta') {
      const n = Math.max(1, Math.min(wdef.mag, 6)), step = (T - 0.4) / n;
      for (let i = 0; i < n; i++) { this._noiseTo(out, t + 0.15 + i * step, 0.08, 'bandpass', 700, 2, 0.3); clk(0.2 + i * step, 1800, 0.3); }
      this._mech('pump', t + T - 0.75, out, 0.9);
    } else if (wdef.cat === 'Sniper') {
      clk(0.1, 2200, 0.3); clk(0.25, 1700, 0.35);
      this._noiseTo(out, t + T * 0.45, 0.12, 'bandpass', 1100, 3, 0.3); clk(T * 0.5, 2000, 0.4);
      clk(T - 0.4, 2400, 0.35); clk(T - 0.25, 1800, 0.45);
    } else {
      // tira o pente, coloca o novo, puxa o ferrolho
      clk(0.08, 2000, 0.3); this._noiseTo(out, t + 0.12, 0.15, 'bandpass', 600, 2, 0.15);
      this._noiseTo(out, t + T * 0.55, 0.06, 'bandpass', 900, 3, 0.25); clk(T * 0.62, 1600, 0.45, 0.05);
      clk(T - 0.22, 2600, 0.35); clk(T - 0.12, 2100, 0.45);
    }
  },
  // impacto no colete/capacete (metálico) e bala passando perto
  armorHit() { if (!this.ctx) return; const t = this.ctx.currentTime; this._toneTo(this.master, t, 'triangle', 2800, 2200, 0.12, 0.25); this._noiseTo(this.master, t, 0.05, 'highpass', 5000, 1, 0.2); },
  whiz(pan) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, g = c.createGain(); g.gain.value = 1;
    let dest = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = LS.util.clamp(pan || 0, -1, 1); g.connect(p); p.connect(this.master); } else g.connect(this.master);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
    const e = c.createGain(); this._env(e, t, 0.25, 0.03, 0.14);
    src.connect(f); f.connect(e); e.connect(dest); src.start(t); src.stop(t + 0.2);
  },
  shellDrop(distance) {
    if (!this.ctx || (distance || 0) > 15) return;
    const t = this.ctx.currentTime + 0.35 + Math.random() * 0.1, v = 0.08 * (1 - (distance || 0) / 15);
    this._toneTo(this.master, t, 'sine', 4200, 3900, 0.06, v); this._toneTo(this.master, t + 0.09, 'sine', 4600, 4300, 0.04, v * 0.6);
  }
});
