// HUD: barras, munição, minimapa, killfeed, mensagens e inventário
'use strict';
LS.HUD = {
  $: id => document.getElementById(id),
  init() {
    this.el = {};
    ['hud', 'alive', 'kills', 'timer', 'fps', 'zone-info', 'zone-text', 'zone-dist', 'minimap', 'killfeed', 'crosshair', 'hitmarker', 'scope', 'damage-vignette',
      'zone-vignette', 'dmg-indicators', 'center-msg', 'prompt', 'heal-progress', 'heal-fill', 'heal-label', 'armor-fill', 'health-fill', 'hp-num', 'med-count', 'band-count',
      'slot-0', 'slot-1', 'weapon-name', 'ammo-mag', 'ammo-res', 'reload-text', 'gear-vest', 'gear-helmet', 'gear-bag', 'bigmap', 'bigmap-canvas', 'inventory',
      'inv-weapons', 'inv-ammo', 'inv-gear', 'inv-meds', 'inv-cap'].forEach(id => this.el[id] = this.$(id));
    this.mm = this.el.minimap.getContext('2d');
    this.bm = this.el['bigmap-canvas'].getContext('2d');
    this.toasts = []; this.centerT = 0; this.dmgFlash = 0;
    // clique nos botões do inventário
    this.el.inventory.addEventListener('click', e => {
      const b = e.target.closest('button[data-inv]'); if (!b) return;
      const P = LS.Game.player, a = b.dataset.inv, v = b.dataset.v;
      if (a === 'equip') P.switchWeapon(+v);
      else if (a === 'dropw') P.dropWeapon(+v);
      else if (a === 'reload') P.startReload();
      else if (a === 'heal') P.startHeal(v);
      else if (a === 'dropa') { const amt = Math.min(P.ammo[v], LS.AMMO_TYPES[v].pickup); if (amt > 0) { P.ammo[v] -= amt; LS.Loot.spawn('ammo', v, 0, amt, P.pos.x + Math.sin(P.yaw) * 1.5, P.pos.y + 0.1, P.pos.z + Math.cos(P.yaw) * 1.5); } }
      else if (a === 'dropm') { if (P.meds[v] > 0) { P.meds[v]--; LS.Loot.spawn('med', v, 0, 1, P.pos.x + Math.sin(P.yaw) * 1.5, P.pos.y + 0.1, P.pos.z + Math.cos(P.yaw) * 1.5); } }
      LS.Audio.click();
      this.renderInventory();
    });
  },
  setMapImage(cv) { this.mapImg = cv; },
  show(v) { this.el.hud.classList.toggle('hidden', !v); },

  toast(text) {
    const kf = this.el.killfeed, d = document.createElement('div');
    d.className = 'kf'; d.style.borderLeft = '3px solid #4be07a'; d.textContent = text;
    kf.appendChild(d); setTimeout(() => d.remove(), 2200);
    while (kf.children.length > 7) kf.firstChild.remove();
  },
  killFeed(killer, victim, weapon, head, mine) {
    const kf = this.el.killfeed, d = document.createElement('div');
    d.className = 'kf' + (mine ? ' me' : '');
    const k = killer ? '<span class="k">' + killer + '</span> ' : '';
    d.innerHTML = k + '<span style="color:#aaa">[' + weapon + (head ? ' 🎯' : '') + ']</span> <span class="v">' + victim + '</span>';
    kf.appendChild(d); setTimeout(() => d.remove(), 6000);
    while (kf.children.length > 7) kf.firstChild.remove();
  },
  centerMsg(title, sub, secs) {
    this.el['center-msg'].innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
    this.el['center-msg'].classList.add('show'); this.centerT = secs || 2.5;
  },
  hit(head) {
    const h = this.el.hitmarker; h.classList.remove('show', 'head'); void h.offsetWidth;
    h.classList.add('show'); if (head) h.classList.add('head');
  },
  damaged(fromAngle) {
    this.dmgFlash = 1;
    if (fromAngle === null || fromAngle === undefined) return;
    const d = document.createElement('div'); d.className = 'dmg-ind';
    d.style.transform = 'rotate(' + fromAngle + 'rad)';
    this.el['dmg-indicators'].appendChild(d);
    setTimeout(() => d.remove(), 900);
  },
  setScope(on) { this.el.scope.classList.toggle('on', on); this.el.crosshair.style.display = on ? 'none' : ''; },

  update(dt, G) {
    const P = G.player, E = this.el;
    E.alive.textContent = G.aliveCount();
    E.kills.textContent = P.kills;
    E.timer.textContent = LS.util.fmtTime(G.time);
    // vida/colete
    E['health-fill'].style.width = P.hp + '%';
    E['health-fill'].parentElement.classList.toggle('low', P.hp < 30);
    E['hp-num'].textContent = Math.ceil(P.hp);
    const vd = P.vest.level ? LS.GEAR.vest.levels[P.vest.level].dur : 1;
    E['armor-fill'].style.width = (P.vest.level ? P.vest.dur / vd * 100 : 0) + '%';
    const gear = (el, lv, dur, max) => { el.className = 'gear-item' + (lv ? ' l' + lv : ''); el.querySelector('span').textContent = lv ? 'Nv.' + lv + (max ? ' ' + Math.ceil(dur / max * 100) + '%' : '') : '-'; };
    gear(E['gear-vest'], P.vest.level, P.vest.dur, vd);
    gear(E['gear-helmet'], P.helmet.level, P.helmet.dur, P.helmet.level ? LS.GEAR.helmet.levels[P.helmet.level].dur : 1);
    gear(E['gear-bag'], P.bag, 0, 0);
    E['med-count'].textContent = P.meds.medkit; E['band-count'].textContent = P.meds.bandage;
    // armas
    for (let i = 0; i < 2; i++) {
      const w = P.weapons[i], s = E['slot-' + i];
      s.classList.toggle('active', i === P.slot && !!w);
      s.querySelector('.name').textContent = w ? LS.WEAPONS[w.id].name : 'VAZIO';
    }
    const w = P.weapon(), d = P.wdef();
    E['weapon-name'].textContent = d ? d.name + ' · ' + d.cat.toUpperCase() : 'DESARMADO';
    E['ammo-mag'].textContent = w ? w.mag : '-';
    E['ammo-mag'].classList.toggle('empty', !!w && w.mag === 0);
    E['ammo-res'].textContent = d ? P.ammo[d.ammo] : '-';
    E['reload-text'].classList.toggle('hidden', P.reloadT <= 0);
    // mira dinâmica
    const moving = Math.hypot(P.vel.x, P.vel.z) > 1;
    const gap = 6 + (d ? d.spread * 300 : 4) * (P.aiming ? 0.5 : 1) * (moving ? 1.6 : 1) * (P.crouch ? 0.75 : 1) + P.recoilKick * 1.5;
    E.crosshair.style.setProperty('--gap', gap.toFixed(1) + 'px');
    E.crosshair.style.visibility = P.state === 'ground' && P.alive ? 'visible' : 'hidden';
    // cura
    if (P.healType) {
      E['heal-progress'].classList.remove('hidden');
      const m = LS.MEDS[P.healType];
      E['heal-fill'].style.width = ((1 - P.healT / m.time) * 100) + '%';
      E['heal-label'].textContent = 'Usando ' + m.name + '...';
    } else E['heal-progress'].classList.add('hidden');
    // prompt
    let pr = P.prompt;
    if (P.state === 'plane') pr = G.plane.canJump() ? '<b>ESPAÇO</b> Saltar do avião' : 'Aguarde o avião chegar à ilha...';
    else if (P.state === 'fall') pr = '<b>ESPAÇO</b> Abrir paraquedas';
    E.prompt.innerHTML = pr || '';
    // zona
    const Z = G.zone, out = Z.isOutside(P.pos);
    E['zone-info'].classList.toggle('danger', out);
    if (Z.finished) E['zone-text'].textContent = 'Zona final';
    else E['zone-text'].textContent = (Z.shrinking ? 'Zona encolhendo: ' : 'Zona encolhe em: ') + LS.util.fmtTime(Z.timer);
    const dn = Math.hypot(P.pos.x - Z.next.x, P.pos.z - Z.next.y) - Z.nextR;
    E['zone-dist'].textContent = out ? '⚠ FORA DA ZONA! -' + Z.dps + ' HP/s' : (dn > 0 && !Z.finished ? 'Próxima zona a ' + Math.round(dn) + ' m' : 'Você está na área segura');
    E['zone-vignette'].style.opacity = out ? 1 : 0;
    // mensagens
    if (this.centerT > 0) { this.centerT -= dt; if (this.centerT <= 0) E['center-msg'].classList.remove('show'); }
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 2);
    E['damage-vignette'].style.opacity = Math.max(this.dmgFlash, P.hp < 30 ? 0.5 + Math.sin(G.time * 5) * 0.2 : 0);
    // fps
    E.fps.classList.toggle('hidden', !LS.settings.showFps);
    this.drawMinimap(G);
    if (!E.bigmap.classList.contains('hidden')) this.drawBigMap(G);
  },

  // desenha um mapa (mini ou grande); view = metros visíveis
  drawMap(ctx, size, G, cx, cz, view, rotate) {
    const P = G.player, half = LS.MAP_SIZE / 2, sc = size / view;
    ctx.save();
    ctx.fillStyle = '#1d4f78'; ctx.fillRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    if (rotate) ctx.rotate(Math.PI + P.camYaw);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cz);
    if (this.mapImg) ctx.drawImage(this.mapImg, -half, -half, LS.MAP_SIZE, LS.MAP_SIZE);
    const Z = G.zone;
    // fora da zona escurecido
    ctx.beginPath(); ctx.rect(-1000, -1000, 2000, 2000); ctx.arc(Z.center.x, Z.center.y, Math.max(Z.radius, 0.1), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(70, 40, 160, 0.4)'; ctx.fill();
    ctx.lineWidth = 2 / sc;
    ctx.strokeStyle = '#4f8cff'; ctx.beginPath(); ctx.arc(Z.center.x, Z.center.y, Math.max(Z.radius, 0.1), 0, Math.PI * 2); ctx.stroke();
    if (!Z.finished) { ctx.strokeStyle = '#fff'; ctx.setLineDash([6 / sc, 4 / sc]); ctx.beginPath(); ctx.arc(Z.next.x, Z.next.y, Math.max(Z.nextR, 0.1), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    // linha até a zona
    if (Z.isOutside(P.pos)) { ctx.strokeStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(P.pos.x, P.pos.z); ctx.lineTo(Z.next.x, Z.next.y); ctx.stroke(); }
    // avião
    if (G.plane.active) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(G.plane.start.x, G.plane.start.z); ctx.lineTo(G.plane.end.x, G.plane.end.z); ctx.stroke();
      ctx.fillStyle = '#ffd24a'; const pp = G.plane.mesh.position; ctx.beginPath(); ctx.arc(pp.x, pp.z, 5 / sc, 0, Math.PI * 2); ctx.fill();
    }
    // inimigos que atiraram recentemente aparecem como pontos vermelhos
    ctx.fillStyle = '#ff4040';
    for (const f of G.fighters) {
      if (f === P || !f.alive || f.state !== 'ground') continue;
      if (G.time - f.lastShotT < 2 && f.pos.distanceTo(P.pos) < 120) { ctx.beginPath(); ctx.arc(f.pos.x, f.pos.z, 3 / sc, 0, Math.PI * 2); ctx.fill(); }
    }
    // jogador
    ctx.translate(P.pos.x, P.pos.z); ctx.rotate(-P.camYaw);
    ctx.fillStyle = '#ff8a1f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1 / sc;
    ctx.beginPath(); ctx.moveTo(0, 7 / sc); ctx.lineTo(-5 / sc, -5 / sc); ctx.lineTo(0, -2 / sc); ctx.lineTo(5 / sc, -5 / sc); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  },
  drawMinimap(G) {
    const P = G.player;
    const c = P.state === 'plane' ? G.plane.mesh.position : P.pos;
    this.drawMap(this.mm, 200, G, c.x, c.z, P.state === 'ground' ? 180 : 420, false);
    this.mm.fillStyle = '#fff'; this.mm.font = 'bold 13px Segoe UI'; this.mm.textAlign = 'center';
    this.mm.fillText('N', 100, 14);
  },
  drawBigMap(G) { this.drawMap(this.bm, 600, G, 0, 0, LS.MAP_SIZE, false); },
  toggleBigMap() { this.el.bigmap.classList.toggle('hidden'); },

  renderInventory() {
    const P = LS.Game.player, E = this.el;
    let h = '';
    P.weapons.forEach((w, i) => {
      if (!w) { h += '<div class="inv-item"><span>Slot ' + (i + 1) + ': vazio</span></div>'; return; }
      const d = LS.WEAPONS[w.id];
      h += '<div class="inv-item"><span>' + (i === P.slot ? '▶ ' : '') + '<b>' + d.name + '</b><span class="sub">' + d.cat + ' · Dano ' + d.dmg + (d.pellets > 1 ? 'x' + d.pellets : '') +
        ' · ' + d.rate + ' tiros/s · ' + w.mag + '/' + d.mag + ' · ' + LS.AMMO_TYPES[d.ammo].name + '</span></span><span class="btns">' +
        (i !== P.slot ? '<button data-inv="equip" data-v="' + i + '">EQUIPAR</button>' : '<button data-inv="reload">RECARREGAR</button>') +
        '<button class="sec" data-inv="dropw" data-v="' + i + '">LARGAR</button></span></div>';
    });
    E['inv-weapons'].innerHTML = h;
    h = '';
    for (const t in P.ammo) h += '<div class="inv-item"><span>' + LS.AMMO_TYPES[t].name + '<span class="sub">' + P.ammo[t] + ' / ' + P.maxAmmo(t) + '</span></span>' +
      (P.ammo[t] > 0 ? '<button class="sec" data-inv="dropa" data-v="' + t + '">LARGAR</button>' : '') + '</div>';
    E['inv-ammo'].innerHTML = h;
    const lv = l => l ? 'Nível ' + l : 'Nenhum';
    E['inv-gear'].innerHTML =
      '<div class="inv-item"><span>🦺 Colete<span class="sub">' + lv(P.vest.level) + (P.vest.level ? ' · ' + Math.ceil(P.vest.dur) + ' durabilidade · -' + LS.GEAR.vest.levels[P.vest.level].red * 100 + '% dano' : '') + '</span></span></div>' +
      '<div class="inv-item"><span>⛑ Capacete<span class="sub">' + lv(P.helmet.level) + (P.helmet.level ? ' · ' + Math.ceil(P.helmet.dur) + ' durabilidade' : '') + '</span></span></div>' +
      '<div class="inv-item"><span>🎒 Mochila<span class="sub">' + lv(P.bag) + ' · capacidade x' + P.bagMult() + '</span></span></div>';
    h = '';
    for (const t in P.meds) {
      const m = LS.MEDS[t];
      h += '<div class="inv-item"><span>' + m.name + '<span class="sub">' + P.meds[t] + ' / ' + P.maxMed(t) + ' · +' + m.heal + ' HP · ' + m.time + 's</span></span><span class="btns">' +
        (P.meds[t] > 0 ? '<button data-inv="heal" data-v="' + t + '">USAR</button><button class="sec" data-inv="dropm" data-v="' + t + '">LARGAR</button>' : '') + '</span></div>';
    }
    E['inv-meds'].innerHTML = h;
    E['inv-cap'].innerHTML = '<div class="inv-item"><span>Vida<span class="sub">' + Math.ceil(P.hp) + ' / 100</span></span></div>' +
      '<div class="inv-item"><span>Abates<span class="sub">' + P.kills + '</span></span></div>';
  }
};
