# LAST SURVIVOR

Battle Royale 3D em HTML5 + CSS3 + JavaScript com Three.js (r128 via CDN).
Você e 30 bots saltam de um avião sobre uma ilha. Vence quem for o último sobrevivente.

## Como jogar
- Abra `index.html` no Google Chrome (funciona direto do arquivo ou no GitHub Pages).
  Precisa de internet para baixar o Three.js do CDN.
- Ou rode um servidor local: `python -m http.server 8123` e acesse http://localhost:8123

## Controles
| Tecla | Ação |
|---|---|
| W A S D | Mover |
| Mouse | Câmera |
| Botão esquerdo / direito | Atirar / Mirar |
| Espaço | Pular · saltar do avião · abrir paraquedas |
| Shift | Correr |
| C | Agachar |
| R | Recarregar |
| E | Trocar arma do chão |
| 1 / 2 / roda do mouse | Trocar arma |
| H / G | Kit médico / Bandagem |
| Tab | Inventário |
| M | Mapa grande |
| Esc | Pausar |

## Estrutura
- `index.html`: menus, HUD e telas
- `css/style.css`: visual da interface
- `js/config.js`: configurações, armas, itens e utilitários
- `js/audio.js`, `js/gunsound.js`: sons sintetizados (Web Audio), tiros com reverb e mecânica das armas
- `js/input.js`: teclado, mouse e pointer lock
- `js/houses.js`: casas com janelas, telhados, sobrados e móveis
- `js/world.js`, `js/worldbuild.js`: terreno, céu/ciclo de luz, construções, colisões e raycast
- `js/skin.js`: texturas pixeladas dos personagens e perfil do jogador
- `js/character.js`: personagem em blocos e animações
- `js/lobby.js`: lobby com personalização e busca de partida
- `js/effects.js`: traçantes, clarões e impactos
- `js/loot.js`: itens no chão
- `js/combat.js`: inventário, dano, colete/capacete e disparos
- `js/player.js`: física de movimento e jogador em terceira pessoa
- `js/bot.js`: IA dos bots
- `js/zone.js`: zona segura e avião
- `js/hud.js`: HUD, minimapa e inventário
- `js/game.js`: loop principal e regras da partida
- `js/main.js`: menus e configurações

Todos os modelos, texturas e sons são gerados por código. O jogo não usa nenhum arquivo externo além do Three.js.
