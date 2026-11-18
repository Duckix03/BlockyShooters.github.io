// Áudio com Howler.js e som posicional 3D.
// Os sons são sintetizados em WAV na inicialização (nenhum arquivo para baixar).
// Para trocar por arquivos reais: new Howl({ src: ['sons/tiro.webm', 'sons/tiro.mp3'] }).
import { Howl, Howler } from 'howler';

/** Gera um WAV PCM 16-bit mono como blob URL a partir de uma função de amostra. */
function synth(duration, fn, rate = 22050) {
  const n = Math.floor(duration * rate);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, fn(i / rate, i / n)));
    v.setInt16(44 + i * 2, s * 32767, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export class Audio {
  constructor() {
    const noise = () => Math.random() * 2 - 1;
    const make = (url, opts = {}) => new Howl({ src: [url], format: ['wav'], pool: 16, ...opts });
    this.sounds = {
      shot: make(synth(0.18, (t, k) => noise() * Math.exp(-k * 9) * 0.9 + Math.sin(t * 900) * Math.exp(-k * 20) * 0.4)),
      hit: make(synth(0.08, (t, k) => Math.sin(t * 2400) * (1 - k) * 0.5)),
      kill: make(synth(0.35, (t, k) => Math.sin(t * (700 + 500 * k) * 6.28) * (1 - k) * 0.35)),
      empty: make(synth(0.05, (t, k) => noise() * (1 - k) * 0.3)),
      reload: make(synth(0.25, (t, k) => (k < 0.2 || (k > 0.6 && k < 0.75) ? noise() * 0.4 : 0))),
    };
    Howler.volume(0.6);
  }

  /** Atualiza a posição/orientação do ouvinte (câmera). */
  listener(x, y, z, fx, fy, fz) {
    Howler.pos(x, y, z);
    Howler.orientation(fx, fy, fz, 0, 1, 0);
  }

  /** Toca um som; com posição, vira som 3D (atenuação por distância). */
  play(name, x, y, z, volume = 1) {
    const s = this.sounds[name];
    const id = s.play();
    s.volume(volume, id);
    if (x !== undefined) {
      s.pos(x, y, z, id);
      s.pannerAttr({ panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 4, rolloffFactor: 1.2, maxDistance: 150 }, id);
    }
    return id;
  }
}
