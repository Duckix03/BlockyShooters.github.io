// Camada de "sessão" que separa a lógica da origem dos dados.
// Hoje: LocalSession (bots, tudo no cliente). Amanhã: NetSession falando com
// Node.js + Socket.io/Colyseus, mantendo a mesma interface para o Game.
//
// Contrato:
//   sendInput(input)      -> envia o input do jogador local para o "servidor"
//   onSnapshot(cb)        -> recebe snapshots autoritativos (estado das entidades)
//   onEvent(cb)           -> eventos de jogo (dano, abate, fim de partida)
// No modo local, o próprio Game é o servidor autoritativo e chama emit*().

export class LocalSession {
  constructor() {
    this.snapshotCbs = [];
    this.eventCbs = [];
    this.lastInput = null;
  }
  get isAuthority() { return true; }
  sendInput(input) { this.lastInput = input; }
  onSnapshot(cb) { this.snapshotCbs.push(cb); }
  onEvent(cb) { this.eventCbs.push(cb); }
  emitEvent(ev) { for (const cb of this.eventCbs) cb(ev); }
  emitSnapshot(s) { for (const cb of this.snapshotCbs) cb(s); }
}

/**
 * Esqueleto da versão online. Exemplo com Socket.io:
 *   import { io } from 'socket.io-client';
 *   const socket = io(url);
 *   sendInput: socket.volatile.emit('input', input)
 *   onSnapshot: socket.on('snapshot', cb)  // aplicar interpolação/reconciliação
 * No servidor, reaproveitar src/core/worldgen.js e src/workers/physics.worker.js
 * (Rapier roda em Node) para física autoritativa.
 */
export class NetSession extends LocalSession {
  get isAuthority() { return false; }
}
