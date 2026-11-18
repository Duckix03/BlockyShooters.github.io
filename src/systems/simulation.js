// Ponte entre a thread principal e os Workers de física e IA.
// Modo rápido: SharedArrayBuffer (página isolada via COOP/COEP) — nenhum dado é copiado.
// Modo compatível: ping-pong de ArrayBuffers Transferable.
// Mantém dois snapshots (anterior/atual) para a interpolação do render.
import { INTENT_FLOATS, STATE_FLOATS, makeBuffer } from '../core/layout.js';

export class Simulation {
  constructor(balance) {
    this.balance = balance;
    const st = makeBuffer(STATE_FLOATS);
    this.shared = st.shared;
    this.state = st.array;                         // escrito pela física
    this.intents = makeBuffer(INTENT_FLOATS).array; // escrito pela IA
    // Vista sempre válida das intenções na main (no modo compatível o buffer vai e volta da IA).
    this.intentsView = this.shared ? this.intents : new Float32Array(INTENT_FLOATS);
    this.prev = new Float32Array(STATE_FLOATS);    // snapshot anterior (interpolação)
    this.curr = new Float32Array(STATE_FLOATS);    // snapshot atual
    this.physicsBusy = false;
    this.aiBusy = false;
    this.physicsMs = 0;
    this.aiMs = 0;
    this.stepsDone = 0;
    this.pendingSteps = 0;
    this.lastDt = 0;
    this.lastInput = null;
    this._msg = { type: 'step', dt: 0, steps: 0, input: null, intents: null, state: undefined };

    this.physics = new Worker(new URL('../workers/physics.worker.js', import.meta.url), { type: 'module' });
    this.ai = new Worker(new URL('../workers/ai.worker.js', import.meta.url), { type: 'module' });
    this.physics.onmessage = (e) => this._onPhysics(e.data);
    this.ai.onmessage = (e) => this._onAi(e.data);
    this.physics.onerror = (e) => console.error('Worker de física:', e.message ?? e);
    this.ai.onerror = (e) => console.error('Worker de IA:', e.message ?? e);
  }

  /** Inicializa os dois workers em paralelo. */
  init() {
    const wait = (w) => new Promise((res) => {
      const h = (e) => { if (e.data.type === 'ready') { w.removeEventListener('message', h); res(); } };
      w.addEventListener('message', h);
    });
    const p = Promise.all([wait(this.physics), wait(this.ai)]);
    // No modo compatível cada worker recebe sua própria cópia inicial.
    this.physics.postMessage({ type: 'init', state: this.state, shared: this.shared, balance: this.balance });
    this.ai.postMessage({
      type: 'init', state: this.shared ? this.state : this.state.slice(), intents: this.intents,
      shared: this.shared, balance: this.balance,
    });
    return p;
  }

  /**
   * Chamado a cada passo fixo do Game. Se a física ainda está ocupada, o passo fica pendente
   * e vai junto no próximo envio (lote). Nenhum passo é perdido -> movimento sem travadinhas.
   */
  step(dt, input) {
    this.pendingSteps++;
    this.lastDt = dt;
    this.lastInput = input;
    if (!this.physicsBusy) this._flush();
  }

  _flush() {
    const steps = Math.min(this.pendingSteps, 4); // limite: aba voltou do background
    this.pendingSteps = 0;
    if (steps === 0) return;
    this.physicsBusy = true;
    const msg = this._msg;
    msg.dt = this.lastDt; msg.steps = steps; msg.input = this.lastInput;
    if (this.shared) {
      msg.intents = this.intents;
      this.physics.postMessage(msg);
    } else {
      // Transfere o buffer (zero cópia); ele volta na resposta 'stepped'.
      msg.intents = this.intentsView; msg.state = this.state;
      this.physics.postMessage(msg, [this.state.buffer]);
    }
  }

  /** IA roda em frequência menor (ex.: 20 Hz). */
  think(dt, zone) {
    if (this.aiBusy) return;
    this.aiBusy = true;
    if (this.shared) this.ai.postMessage({ type: 'think', dt, zone });
    else this.ai.postMessage({ type: 'think', dt, zone, state: this.curr.slice(), intents: this.intents }, [this.intents.buffer]);
  }

  send(msg) { this.physics.postMessage(msg); }

  setBalance(balance) {
    this.balance = balance;
    this.physics.postMessage({ type: 'balance', balance });
    this.ai.postMessage({ type: 'balance', balance });
  }

  _onPhysics(m) {
    if (m.type !== 'stepped') return;
    if (!this.shared) this.state = m.state;
    this.physicsMs = m.ms;
    // Gira os snapshots: atual vira anterior, estado novo vira atual.
    const t = this.prev; this.prev = this.curr; this.curr = t;
    this.curr.set(this.state);
    this.stepsDone += m.steps;
    this.physicsBusy = false;
    if (this.pendingSteps > 0) this._flush(); // envia já o que acumulou
  }

  _onAi(m) {
    if (m.type !== 'thought') return;
    if (!this.shared) { this.intents = m.intents; this.intentsView.set(m.intents); }
    this.aiMs = m.ms;
    this.aiBusy = false;
  }
}
