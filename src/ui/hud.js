// HUD em HTML/CSS por cima do canvas. Cada campo só toca no DOM quando o valor muda.
import { Pool } from '../core/pool.js';

const $ = (id) => document.getElementById(id);

/** Campo de texto com cache: evita reflow quando o valor não mudou. */
class Field {
  constructor(el, fmt) { this.el = el; this.fmt = fmt; this.last = undefined; }
  set(v) {
    if (v === this.last) return;
    this.last = v;
    this.el.textContent = this.fmt(v);
  }
}

export class Hud {
  constructor() {
    this.root = $('hud');
    this.alive = new Field($('hud-alive'), (v) => `Vivos: ${v}`);
    this.kills = new Field($('hud-kills'), (v) => `Abates: ${v}`);
    this.zone = new Field($('hud-zone'), (v) => v);
    this.ammo = new Field($('hud-ammo'), (v) => v);
    this.hpText = new Field($('hud-hp-text'), (v) => v);
    this.hint = new Field($('hud-hint'), (v) => v);
    this.hpBar = $('hud-hp');
    this.lastHp = -1;
    this.feed = $('feed');

    // Pool de números de dano (elementos DOM pré-criados)
    const layer = $('damage-layer');
    this.damage = new Pool(() => {
      const el = document.createElement('div');
      el.className = 'dmg';
      el.style.display = 'none';
      layer.appendChild(el);
      return { el, x: 0, y: 0, z: 0, life: 0 };
    }, 40);
  }

  show(v) { this.root.classList.toggle('hidden', !v); }

  setHealth(hp, max) {
    const v = Math.ceil(hp);
    if (v === this.lastHp) return;
    this.lastHp = v;
    this.hpBar.style.transform = `scaleX(${Math.max(0, v / max)})`;
    this.hpBar.classList.toggle('low', v < max * 0.3);
    this.hpText.set(v);
  }

  /** Número de dano flutuante no mundo (posicionado por projeção a cada frame enquanto ativo). */
  spawnDamage(x, y, z, amount, head) {
    const i = this.damage.acquire();
    if (i === null) return;
    const d = this.damage.items[i];
    d.x = x; d.y = y; d.z = z; d.life = 0.8;
    d.el.textContent = Math.round(amount);
    d.el.classList.toggle('head', head);
    d.el.style.display = 'block';
  }

  updateDamage(dt, camera, v3) {
    const p = this.damage;
    const w = innerWidth / 2, h = innerHeight / 2;
    for (let i = 0; i < p.items.length; i++) {
      if (!p.active[i]) continue;
      const d = p.items[i];
      d.life -= dt;
      if (d.life <= 0) { d.el.style.display = 'none'; p.release(i); continue; }
      d.y += dt * 1.2;
      v3.set(d.x, d.y, d.z).project(camera);
      if (v3.z > 1) { d.el.style.opacity = 0; continue; }
      d.el.style.opacity = Math.min(1, d.life * 2.5);
      d.el.style.transform = `translate(${(v3.x * w + w) | 0}px, ${(-v3.y * h + h) | 0}px)`;
    }
  }

  /** Feed de abates: no máximo 5 linhas, cada uma some sozinha. */
  pushFeed(text) {
    const el = document.createElement('div');
    el.textContent = text;
    this.feed.prepend(el);
    while (this.feed.childElementCount > 5) this.feed.lastElementChild.remove();
    setTimeout(() => el.remove(), 5000);
  }
}
