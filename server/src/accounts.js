// Contas do Last Survivor — um Durable Object só ("global") guarda todas as contas.
//
// Por que existe: sem conta, qualquer um coloca o nome que quiser (até o seu). Com conta:
//   - o NOME é único e fica reservado pra quem criou a conta (com senha)
//   - os SELOS (owner, dev, criador de conteúdo, verificado) só são dados aqui no servidor, pelo dono do jogo
//   - CURTIDAS são de verdade: cada conta curte um perfil uma vez só
//
// Rotas (todas JSON, em /api/...):
//   POST /api/register {name, pass, profile}   cria a conta e já entra
//   POST /api/login    {name, pass}            entra (devolve o token da sessão)
//   POST /api/logout                           sai (apaga o token)
//   GET  /api/me                               sua conta
//   POST /api/profile  {look, bio, avatarBg, cover, weapon}   salva o visual e o perfil
//   POST /api/rename   {name}                  troca o nome (único; 1 vez a cada 7 dias)
//   POST /api/stats    {stats}                 salva as estatísticas
//   GET  /api/profile/<id>                     perfil público de alguém (pelo ID)
//   POST /api/like/<id>                        curte / descurte
//   POST /api/admin/claim {key}                vira OWNER usando a chave secreta (ADMIN_KEY)
//   POST /api/admin/badges {id, badges}        (só owner) dá/tira selos de uma conta
// Uso interno (só o Matchmaker chama, não fica exposto): /internal/resolve {token, name}
'use strict';

const TOKEN_DAYS = 90, RENAME_DAYS = 7, PBKDF2_ITER = 10000; // poucas iterações: o plano grátis tem só ~10 ms de CPU por pedido
const BADGES = ['owner', 'dev', 'cc', 'verificado'];
const RESERVED = ['admin', 'adm', 'moderador', 'owner', 'dono', 'dev', 'suporte', 'support', 'convidado', 'guest', 'lastsurvivor', 'last_survivor', 'sistema', 'system', 'claude', 'anthropic'];
const NAME_RE = /^[A-Za-z0-9_.\-À-ÿ]{3,16}$/;
const LOOK_KEYS = ['skin', 'hair', 'hairStyle', 'eyes', 'shirt', 'pattern', 'pants', 'accent', 'beard', 'glasses', 'mask', 'hat', 'top'];
const STAT_KEYS = ['games', 'wins', 'kills', 'xp', 'coins', 'dmg', 'best'];

const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: H });
const fail = (msg, status = 400) => json({ error: msg }, status);
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const randHex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); };
const txt = (s, max) => String(s == null ? '' : s).replace(/[<>&"`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const nint = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));

async function hashPass(pass, saltHex) {
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256));
}
// compara sem vazar o tempo
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export class Accounts {
  constructor(state, env) { this.state = state; this.env = env; this.st = state.storage; this.fails = new Map(); }

  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: H });
    const url = new URL(req.url), path = url.pathname;
    try {
      if (path === '/internal/resolve') return json(await this.resolve(await req.json()));
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      if (path === '/api/register') return await this.register(body);
      if (path === '/api/login') return await this.login(body);
      let m = path.match(/^\/api\/profile\/(\d{10})$/);
      if (m && req.method === 'GET') return await this.publicProfile(m[1], await this.auth(req, true));
      const me = await this.auth(req);
      if (!me) return fail('Você precisa entrar na sua conta.', 401);
      if (path === '/api/me') return json({ account: this.mine(me) });
      if (path === '/api/logout') { await this.st.delete('t:' + me._token); return json({ ok: true }); }
      if (path === '/api/profile') return await this.saveProfile(me, body);
      if (path === '/api/rename') return await this.rename(me, body);
      if (path === '/api/stats') return await this.saveStats(me, body);
      m = path.match(/^\/api\/like\/(\d{10})$/);
      if (m) return await this.like(me, m[1]);
      if (path === '/api/admin/claim') return await this.claim(me, body);
      if (path === '/api/admin/badges') return await this.setBadges(me, body);
      return fail('Rota não encontrada.', 404);
    } catch (e) {
      return fail('Erro no servidor.', 500);
    }
  }

  // ---------- sessão ----------
  async auth(req, optional) {
    const h = req.headers.get('Authorization') || '', tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!/^[0-9a-f]{64}$/.test(tok)) return null;
    const t = await this.st.get('t:' + tok);
    if (!t || t.exp < Date.now()) { if (t) await this.st.delete('t:' + tok); return null; }
    const a = await this.st.get('a:' + t.id);
    if (a) a._token = tok;
    return a || null;
  }
  async newToken(id) {
    const tok = randHex(32);
    await this.st.put('t:' + tok, { id, exp: Date.now() + TOKEN_DAYS * 864e5 });
    return tok;
  }
  // o que o dono da conta vê (sem a senha)
  mine(a) { return { id: a.id, name: a.name, badges: a.badges, likes: a.likes, profile: a.profile, stats: a.stats, renameAt: a.renameAt || 0 }; }
  pub(a) { return { id: a.id, name: a.name, badges: a.badges, likes: a.likes, profile: a.profile, stats: a.stats, created: a.created }; }

  cleanProfile(p, old) {
    p = p && typeof p === 'object' ? p : {};
    const o = old || { look: {}, bio: '', avatarBg: 0, cover: 'br', weapon: null };
    const look = Object.assign({}, o.look);
    if (p.look && typeof p.look === 'object') for (const k of LOOK_KEYS) if (p.look[k] != null) look[k] = txt(p.look[k], 24);
    return {
      look,
      bio: p.bio != null ? txt(p.bio, 80) : o.bio,
      avatarBg: p.avatarBg != null ? nint(p.avatarBg, 7) : o.avatarBg,
      cover: p.cover != null && /^(br|duel1|duel2|g\d)$/.test(p.cover) ? p.cover : o.cover,
      weapon: p.weapon !== undefined ? (p.weapon && /^[a-z0-9]{2,8}$/.test(p.weapon) ? p.weapon : null) : o.weapon,
    };
  }
  checkName(name) {
    if (!NAME_RE.test(name)) return 'O nome precisa ter de 3 a 16 letras, números, _ . ou -';
    if (RESERVED.includes(name.toLowerCase())) return 'Esse nome é reservado.';
    return null;
  }
  async newId() {
    for (let i = 0; i < 20; i++) {
      const id = String(1000000000 + Math.floor(Math.random() * 8999999999));
      if (!(await this.st.get('a:' + id))) return id;
    }
    throw new Error('sem id');
  }
  // trava tentativas de senha em sequência (8 erros = 1 minuto esperando)
  locked(name) { const f = this.fails.get(name); return f && f.n >= 8 && Date.now() - f.t < 60000; }
  failed(name) { const f = this.fails.get(name) || { n: 0, t: 0 }; if (Date.now() - f.t > 60000) f.n = 0; f.n++; f.t = Date.now(); this.fails.set(name, f); }

  // ---------- rotas ----------
  async register(b) {
    const name = String(b.name || '').trim().slice(0, 32), pass = String(b.pass || '');
    const bad = this.checkName(name); if (bad) return fail(bad);
    if (pass.length < 6 || pass.length > 64) return fail('A senha precisa ter de 6 a 64 caracteres.');
    const key = 'u:' + name.toLowerCase();
    if (await this.st.get(key)) return fail('Esse nome já tem dono. Escolha outro.');
    const id = await this.newId(), salt = randHex(16);
    const a = { id, name, salt, hash: await hashPass(pass, salt), created: Date.now(), badges: [], likes: 0,
      profile: this.cleanProfile(b.profile), stats: this.cleanStats(b.stats) };
    await this.st.put(key, id); await this.st.put('a:' + id, a);
    return json({ token: await this.newToken(id), account: this.mine(a) });
  }
  async login(b) {
    const name = txt(b.name, 16).toLowerCase(), pass = String(b.pass || '');
    if (this.locked(name)) return fail('Muitas tentativas. Espere 1 minuto.', 429);
    const id = await this.st.get('u:' + name), a = id && await this.st.get('a:' + id);
    if (!a || !same(await hashPass(pass, a.salt), a.hash)) { this.failed(name); return fail('Nome ou senha errados.', 401); }
    this.fails.delete(name);
    return json({ token: await this.newToken(a.id), account: this.mine(a) });
  }
  async saveProfile(a, b) {
    a.profile = this.cleanProfile(b, a.profile);
    delete a._token; await this.st.put('a:' + a.id, a);
    return json({ account: this.mine(a) });
  }
  async rename(a, b) {
    const name = String(b.name || '').trim().slice(0, 32);
    const bad = this.checkName(name); if (bad) return fail(bad);
    if (name === a.name) return json({ account: this.mine(a) });
    const left = (a.renameAt || 0) + RENAME_DAYS * 864e5 - Date.now();
    if (left > 0 && name.toLowerCase() !== a.name.toLowerCase()) return fail('Você só pode trocar de nome de novo em ' + Math.ceil(left / 864e5) + ' dia(s).');
    const key = 'u:' + name.toLowerCase(), owner = await this.st.get(key);
    if (owner && owner !== a.id) return fail('Esse nome já tem dono. Escolha outro.');
    if (name.toLowerCase() !== a.name.toLowerCase()) { await this.st.delete('u:' + a.name.toLowerCase()); a.renameAt = Date.now(); }
    await this.st.put(key, a.id);
    a.name = name; delete a._token; await this.st.put('a:' + a.id, a);
    return json({ account: this.mine(a) });
  }
  cleanStats(s) { s = s && typeof s === 'object' ? s : {}; const o = {}; for (const k of STAT_KEYS) o[k] = nint(s[k], 1e9); return o; }
  async saveStats(a, b) {
    a.stats = this.cleanStats(b.stats);
    delete a._token; await this.st.put('a:' + a.id, a);
    return json({ ok: true });
  }
  async publicProfile(id, viewer) {
    const a = await this.st.get('a:' + id);
    if (!a) return fail('Nenhum jogador com esse ID.', 404);
    const liked = viewer ? !!(await this.st.get('l:' + id + ':' + viewer.id)) : false;
    return json({ profile: this.pub(a), liked });
  }
  async like(me, id) {
    if (id === me.id) return fail('Não dá pra curtir o próprio perfil.');
    const a = await this.st.get('a:' + id);
    if (!a) return fail('Nenhum jogador com esse ID.', 404);
    const k = 'l:' + id + ':' + me.id, had = await this.st.get(k);
    if (had) { await this.st.delete(k); a.likes = Math.max(0, a.likes - 1); } else { await this.st.put(k, 1); a.likes++; }
    await this.st.put('a:' + id, a);
    return json({ liked: !had, likes: a.likes });
  }
  async claim(a, b) {
    if (this.locked('#claim')) return fail('Muitas tentativas. Espere 1 minuto.', 429);
    const key = String(this.env.ADMIN_KEY || '');
    if (key.length < 12) return fail('A chave de admin não foi configurada no servidor (npx wrangler secret put ADMIN_KEY).');
    if (!same(String(b.key || ''), key)) { this.failed('#claim'); return fail('Chave errada.', 403); }
    for (const x of ['owner', 'dev', 'verificado']) if (!a.badges.includes(x)) a.badges.push(x);
    delete a._token; await this.st.put('a:' + a.id, a);
    return json({ account: this.mine(a) });
  }
  async setBadges(me, b) {
    if (!me.badges.includes('owner')) return fail('Só o owner pode dar selos.', 403);
    const a = await this.st.get('a:' + String(b.id || ''));
    if (!a) return fail('Nenhum jogador com esse ID.', 404);
    a.badges = (Array.isArray(b.badges) ? b.badges : []).filter((x, i, l) => BADGES.includes(x) && l.indexOf(x) === i);
    await this.st.put('a:' + a.id, a);
    return json({ profile: this.pub(a) });
  }

  // ---------- pra partida online: nome de verdade de quem tem conta ----------
  // com conta: usa o nome da conta. Sem conta: pode usar um nome, menos o de uma conta (aí vira Convidado).
  async resolve(b) {
    const tok = String(b.token || '');
    if (/^[0-9a-f]{64}$/.test(tok)) {
      const t = await this.st.get('t:' + tok);
      const a = t && t.exp > Date.now() && await this.st.get('a:' + t.id);
      if (a) return { name: a.name, id: a.id, badges: a.badges };
    }
    const name = txt(b.name, 16) || 'Jogador';
    if (await this.st.get('u:' + name.toLowerCase()) || RESERVED.includes(name.toLowerCase())) return { name: 'Convidado' + Math.floor(1000 + Math.random() * 9000) };
    return { name };
  }
}
