// Ponto de entrada: menu, escolha de preset e início da partida.
import { DEFAULT_PRESET } from './config/settings.js';
import { Game } from './core/game.js';

const $ = (id) => document.getElementById(id);
const status = $('menu-status'), play = $('menu-play'), presetSel = $('menu-preset'), stats = $('menu-stats');
const fpsSel = $('menu-fps');
const canvas = $('game');
const game = new Game(canvas);

const showStats = (s) => {
  stats.textContent = `Partidas: ${s.matches} · Vitórias: ${s.wins} · Abates: ${s.kills} · Recorde: ${s.bestKills}`;
};

game.init((msg) => { status.textContent = msg; }).then(() => {
  presetSel.value = game.save.preset || DEFAULT_PRESET;
  fpsSel.value = String(game.save.fpsLimit ?? 60);
  showStats(game.save);
  play.disabled = false;
}).catch((err) => {
  console.error(err);
  status.textContent = `Erro ao iniciar: ${err.message}`;
});

play.addEventListener('click', () => {
  game.enableAudio();
  game.setPreset(presetSel.value);
  game.setFpsLimit(Number(fpsSel.value));
  $('menu').classList.add('hidden');
  game.startMatch();
});

// Clicar no canvas recaptura o mouse se o jogador apertou Esc
canvas.addEventListener('click', () => { if (game.playing && !game.input.locked) game.input.lock(); });

game.onMatchEnd = (won, kills, save) => {
  game.hud.show(false);
  status.textContent = won ? `🏆 VITÓRIA! ${kills} abates` : `Você foi eliminado · ${kills} abates`;
  play.textContent = 'JOGAR DE NOVO';
  showStats(save);
  $('menu').classList.remove('hidden');
};

// Acesso pelo console só em desenvolvimento (inspecionar estado, testar sistemas).
if (import.meta.env.DEV) window.__game = game;
