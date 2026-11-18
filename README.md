# Blocky Shooters

Battle royale contra bots em Three.js (WebGPU → WebGL2), física Rapier e IA em Web Workers.

**Jogar:** https://duckix03.github.io/BlockyShooters.github.io/

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173 (headers COOP/COEP já configurados)
npm run build    # gera dist/
```

## GitHub Pages

1. Suba o projeto num repositório no GitHub (branch `main`).
2. Em **Settings → Pages → Source**, escolha **GitHub Actions**.
3. Cada push na `main` roda `.github/workflows/deploy.yml` e publica `dist/`.

O Pages não deixa configurar headers HTTP, então `public/coi-sw.js` (service worker)
injeta COOP/COEP. Na primeira visita a página recarrega uma vez e o `SharedArrayBuffer`
passa a funcionar. Sem isso o jogo cai para Transferable sozinho (o F1 mostra o modo ativo).

## Controles

WASD mover · Mouse mirar · Clique atirar · Shift correr · Espaço pular/freio · R recarregar ·
E entrar/sair do veículo · **F1** overlay de debug · **F2** balanceamento ao vivo (lil-gui).

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/config` | constantes, balanceamento, presets Baixo/Médio/Alto/Ultra |
| `src/core` | loop de passo fixo (60 Hz), input, pool, layout do buffer compartilhado, worldgen, save (IndexedDB), sessão local/rede |
| `src/workers` | `physics.worker.js` (Rapier: character controller + vehicle controller), `ai.worker.js` (navmesh + estados dos bots) |
| `src/systems` | ponte com os workers, combate (hitscan), zona, áudio 3D (Howler) |
| `src/render` | renderer + escala de resolução dinâmica + sombra perto da câmera, mundo (TSL, instancing, chunks, LOD), entidades, efeitos, loaders KTX2/Draco/Meshopt |
| `src/ui` | HUD (atualiza só quando muda), debug, lil-gui, controles de toque |

## Online depois

`src/core/net.js` define a interface `LocalSession`/`NetSession`. O worldgen e o worker de
física não dependem do DOM, então dá para rodá-los num servidor Node.js (Socket.io/Colyseus)
como autoridade e trocar só a sessão no cliente.
