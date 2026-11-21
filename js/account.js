// Contas: nome único com senha, guardado no servidor (server/src/accounts.js). Sem conta = convidado
// (joga normal, mas o nome não é protegido e não tem curtidas nem selos).
// O login fica salvo neste navegador (token). O perfil (visual, recado, foto, capa) e as estatísticas
// são salvos na conta sozinhos, então aparecem em qualquer computador que você entrar.
'use strict';
LS.Account = {
  KEY: 'lastsurvivor_auth', CACHE: 'lastsurvivor_acc',
  token: null, me: null,

  init() {
    try { this.token = localStorage.getItem(this.KEY) || null; this.me = JSON.parse(localStorage.getItem(this.CACHE) || 'null'); } catch (e) { /* ignora */ }
    // salvar o perfil/estatísticas no navegador também salva na conta (com um pequeno atraso)
    const sp = LS.saveProfile, ss = LS.saveStats;
    LS.saveProfile = () => { sp(); this.save(); };
    LS.saveStats = () => { ss(); this.saveStats(); };
    if (this.token && this.me) this.apply(this.me, true); // mostra já o que estava guardado
    if (this.token) this.refresh();
  },
  available() { return !!LS.NET_URL; },
  logged() { return !!(this.token && this.me); },

  async api(path, body, method) {
    if (!this.available()) throw new Error('O jogo está sem servidor configurado (LS.NET_URL).');
    let r;
    try {
      r = await fetch(LS.NET_URL.replace(/\/$/, '') + path, {
        method: method || (body ? 'POST' : 'GET'),
        headers: Object.assign({ 'Content-Type': 'application/json' }, this.token ? { Authorization: 'Bearer ' + this.token } : {}),
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) { throw new Error('Não deu pra falar com o servidor. Confira a internet.'); }
    const d = await r.json().catch(() => ({ error: 'O servidor respondeu algo estranho (ele já foi atualizado?).' }));
    if (!r.ok) {
      if (r.status === 401 && this.token && path !== '/api/login') this.drop(); // sessão vencida
      throw new Error(d.error || 'Erro ' + r.status);
    }
    return d;
  },
  async refresh() { try { const d = await this.api('/api/me'); this.apply(d.account); } catch (e) { /* sem internet: segue com o guardado */ } },

  // coloca os dados da conta no jogo (a conta manda: nome, ID, selos, curtidas, visual...)
  apply(acc, fromCache) {
    const P = LS.playerProfile;
    if (!P.guestId && P.id && P.id !== acc.id) P.guestId = P.id; // ID de convidado deste navegador (volta se sair da conta)
    this.me = acc;
    try { localStorage.setItem(this.CACHE, JSON.stringify(acc)); } catch (e) { /* ignora */ }
    P.name = acc.name; P.id = acc.id; P.badges = acc.badges || []; P.likes = acc.likes || 0;
    const pr = acc.profile || {};
    if (pr.look && Object.keys(pr.look).length) Object.assign(P.look, pr.look);
    if (pr.bio != null) P.bio = pr.bio;
    P.avatar = { type: '3d', bg: pr.avatarBg || 0 }; P.cover = pr.cover || 'br';
    if (pr.weapon !== undefined) P.weapon = pr.weapon;
    if (!fromCache && acc.stats) {
      if ((acc.stats.games || 0) > 0 || (acc.stats.xp || 0) > 0) Object.assign(LS.stats, acc.stats);
      else this.saveStats(true); // conta nova: leva as estatísticas deste navegador pra ela
    }
    this._quiet = true; LS.saveProfile(); localStorage.setItem('lastsurvivor_stats', JSON.stringify(LS.stats)); this._quiet = false;
    this.refreshUI();
  },
  refreshUI() {
    if (LS.Menu && LS.Profile && LS.Profile.bound) LS.Menu.render();
    if (LS.Lobby && LS.Lobby.built) { LS.Lobby.model.applyLook(LS.playerProfile.look); LS.Lobby.model.setGun(LS.playerProfile.weapon || null); LS.Lobby.syncUI(); }
    const n = document.getElementById('lobby-name');
    if (n) { n.disabled = this.logged(); n.title = this.logged() ? 'Seu nome é o da conta (troque no perfil)' : ''; }
    if (LS.UI && LS.UI.current === 'panel-stats' && LS.Profile.bound) LS.Profile.render();
  },
  setToken(t) { this.token = t; try { localStorage.setItem(this.KEY, t); } catch (e) { /* ignora */ } },
  drop() {
    const P = LS.playerProfile;
    this.token = null; this.me = null;
    try { localStorage.removeItem(this.KEY); localStorage.removeItem(this.CACHE); } catch (e) { /* ignora */ }
    P.badges = []; P.likes = 0; P.id = P.guestId || String(1000000000 + Math.floor(Math.random() * 8999999999));
    this._quiet = true; LS.saveProfile(); this._quiet = false;
    this.refreshUI(); if (LS.Profile && LS.Profile.bound) LS.Profile.renderTop();
  },

  // ---------- ações ----------
  payload() { const P = LS.playerProfile; return { look: P.look, bio: P.bio, avatarBg: (P.avatar && P.avatar.bg) || 0, cover: P.cover, weapon: P.weapon || null }; },
  async register(name, pass) { const d = await this.api('/api/register', { name, pass, profile: this.payload(), stats: LS.stats }); this.setToken(d.token); this.apply(d.account); },
  async login(name, pass) { const d = await this.api('/api/login', { name, pass }); this.setToken(d.token); this.apply(d.account); },
  async logout() { try { await this.api('/api/logout', {}); } catch (e) { /* tanto faz */ } this.drop(); },
  async rename(name) { const d = await this.api('/api/rename', { name }); this.apply(d.account); },
  async claim(key) { const d = await this.api('/api/admin/claim', { key }); this.apply(d.account); },
  async setBadges(id, badges) { return (await this.api('/api/admin/badges', { id, badges })).profile; },
  async profile(id) { return await this.api('/api/profile/' + id); },
  async like(id) { return await this.api('/api/like/' + id, {}); },
  save() {
    if (!this.logged() || this._quiet) return;
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => this.api('/api/profile', this.payload()).then(d => { this.me = d.account; try { localStorage.setItem(this.CACHE, JSON.stringify(d.account)); } catch (e) { } }).catch(() => {}), 800);
  },
  saveStats(now) {
    if (!this.logged() || (this._quiet && !now)) return;
    clearTimeout(this._statT);
    this._statT = setTimeout(() => this.api('/api/stats', { stats: LS.stats }).catch(() => {}), now ? 0 : 1500);
  }
};
