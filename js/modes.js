// Modos de jogo: lista, escolha (fica salva) e o painel de cards no estilo dos jogos de celular
'use strict';
LS.MODES = {
  br: {
    name: 'BATTLE ROYALE', sub: 'Ilha · Solo · 31 jogadores', tag: 'CLÁSSICO', players: 31, place: 'Ilha',
    desc: 'Salte do avião, junte loot e seja o último em pé.'
  },
  duel: {
    name: 'DUELO', sub: '1v1 · Galpão · Primeiro a 5', tag: 'NOVO', players: 2, place: 'Galpão · 5 mapas',
    desc: '1 contra 1 entre contêineres. O mapa muda a cada round e o gás fecha: quem fizer 5 rounds vence.'
  }
};

LS.Modes = {
  KEY: 'lastsurvivor_mode',
  id: 'br',
  init() {
    try { const m = localStorage.getItem(this.KEY); if (LS.MODES[m]) this.id = m; } catch (e) { /* sem localStorage */ }
    document.getElementById('modes-grid').addEventListener('click', e => {
      const c = e.target.closest('[data-mode]'); if (!c) return;
      LS.Audio.init(); LS.Audio.click();
      this.set(c.dataset.mode); LS.UI.back();
    });
    this.render();
  },
  cur() { return LS.MODES[this.id]; },
  set(id) {
    if (!LS.MODES[id]) return;
    this.id = id;
    try { localStorage.setItem(this.KEY, id); } catch (e) { /* ignora */ }
    this.render();
  },
  maxPlayers() { return this.cur().players; },
  // textos do lobby que mostram o modo atual
  render() {
    const m = this.cur(), $ = id => document.getElementById(id);
    if ($('lb-mode-name')) $('lb-mode-name').textContent = m.name;
    if ($('lb-mode-sub')) $('lb-mode-sub').textContent = m.sub;
    if ($('lobby-mode-txt')) $('lobby-mode-txt').innerHTML = 'MODO: <b>' + m.name + '</b> · ' + m.sub.toUpperCase();
  },
  open() { this.renderGrid(); LS.UI.openPanel('panel-modes'); },

  // ---- cards ----
  renderGrid() {
    const cards = Object.keys(LS.MODES).map(id => {
      const m = LS.MODES[id], sel = id === this.id;
      return '<button class="mode-card' + (sel ? ' sel' : '') + '" data-mode="' + id + '">' +
        '<div class="mode-art art-' + id + '">' + this.art(id) + '</div>' +
        '<span class="mode-tag">' + m.tag + '</span>' + (sel ? '<span class="mode-check">✓ SELECIONADO</span>' : '') +
        '<div class="mode-info"><b>' + m.name + '</b><span>' + m.place + ' · ' + m.players + ' jogadores</span><p>' + m.desc + '</p></div></button>';
    });
    cards.push('<div class="mode-card locked"><div class="mode-art art-soon">' + this.art('soon') + '</div>' +
      '<div class="mode-info"><b>EM BREVE</b><span>Novo modo chegando</span><p>Fique de olho nas novidades!</p></div></div>');
    document.getElementById('modes-grid').innerHTML = cards.join('');
  },
  // ilustrações dos cards (SVG feito à mão, sem imagem externa)
  art(id) {
    if (id === 'br') return '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">' +
      '<defs><linearGradient id="brsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b7dd8"/><stop offset="0.7" stop-color="#ffb46b"/></linearGradient></defs>' +
      '<rect width="320" height="180" fill="url(#brsky)"/><circle cx="250" cy="70" r="26" fill="#ffe9a8" opacity=".9"/>' +
      '<path d="M0 150 Q60 118 120 132 T230 120 T320 138 V180 H0z" fill="#3f8a34"/><path d="M150 130 L190 82 L222 124z" fill="#8a8378"/><path d="M180 94 L190 82 L200 95 L192 92z" fill="#f4f6fa"/>' +
      '<path d="M0 162 Q80 150 160 160 T320 158 V180 H0z" fill="#2a7fb8"/>' +
      '<g transform="translate(70 40) rotate(-8)"><rect x="0" y="8" width="70" height="10" rx="5" fill="#d9dde3"/><path d="M28 10 L48 -12 L54 -12 L42 10z M30 16 L50 36 L56 36 L44 16z" fill="#b8bec7"/><path d="M0 12 L-8 0 L-2 0 L8 10z" fill="#b8bec7"/></g>' +
      '<g fill="#ff8a1f"><path d="M118 92 q10 -12 20 0z"/><line x1="119" y1="92" x2="128" y2="104" stroke="#222" stroke-width="1"/><line x1="137" y1="92" x2="128" y2="104" stroke="#222" stroke-width="1"/><rect x="126" y="103" width="4" height="7" fill="#333"/></g></svg>';
    if (id === 'duel') return '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">' +
      '<defs><linearGradient id="dwall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2230"/><stop offset="1" stop-color="#3a4252"/></linearGradient>' +
      '<pattern id="drib" width="8" height="10" patternUnits="userSpaceOnUse"><rect width="8" height="10" fill="none"/><rect width="3" height="10" fill="#000" opacity=".18"/></pattern></defs>' +
      '<rect width="320" height="180" fill="url(#dwall)"/><g fill="#fff8d0" opacity=".85"><rect x="40" y="14" width="60" height="5" rx="2"/><rect x="130" y="14" width="60" height="5" rx="2"/><rect x="220" y="14" width="60" height="5" rx="2"/></g>' +
      '<path d="M0 140 H320 V180 H0z" fill="#5b5f66"/><path d="M0 141 H320" stroke="#e8c400" stroke-width="3" stroke-dasharray="14 10"/>' +
      '<rect x="18" y="86" width="120" height="56" fill="#b03a2e"/><rect x="18" y="86" width="120" height="56" fill="url(#drib)"/><rect x="18" y="30" width="120" height="56" fill="#2e6bb0"/><rect x="18" y="30" width="120" height="56" fill="url(#drib)"/>' +
      '<rect x="200" y="86" width="104" height="56" fill="#3a8a3a"/><rect x="200" y="86" width="104" height="56" fill="url(#drib)"/><rect x="146" y="112" width="30" height="30" fill="#a8783e"/><path d="M146 112 l30 30 M176 112 l-30 30" stroke="#6b4a2a" stroke-width="3"/>' +
      '<rect x="0" y="0" width="320" height="180" fill="#8a5cff" opacity=".12"/><path d="M0 0 V180" stroke="#9a7bff" stroke-width="16" opacity=".35"/><path d="M320 0 V180" stroke="#9a7bff" stroke-width="16" opacity=".35"/>' +
      '<text x="160" y="104" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="46" fill="#fff" stroke="#1a0f00" stroke-width="3" paint-order="stroke">1 V 1</text></svg>';
    return '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"><rect width="320" height="180" fill="#1a1e28"/>' +
      '<g fill="none" stroke="#5a6478" stroke-width="10" stroke-linecap="round"><rect x="132" y="84" width="56" height="44" rx="8" fill="#5a6478"/><path d="M144 84 V68 a16 16 0 0 1 32 0 V84"/></g>' +
      '<circle cx="160" cy="104" r="6" fill="#1a1e28"/></svg>';
  }
};
