// Entrada: teclado + mouse (pointer lock) e toque. Mantém um estado plano, sem alocar por frame.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = -0.1;
    this.sensitivity = 0.0022;
    this.fire = false;
    this.pressed = new Set(); // teclas apertadas neste passo (consumidas pelo Game)
    this.touchMove = { x: 0, y: 0 };
    this.locked = false;
    this.crouch = false; // alternado com C (Ctrl+W fecharia a aba, por isso não usamos Ctrl)

    addEventListener('keydown', (e) => {
      if (e.code === 'F1' || e.code === 'F2') e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      if (e.code === 'KeyC' && !e.repeat) this.crouch = !this.crouch;
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.fire = false; });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.fire = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.fire = false; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.fire = false;
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.look(e.movementX, e.movementY);
    });
  }

  look(dx, dy) {
    this.yaw -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity;
    this.pitch = Math.max(-1.2, Math.min(0.9, this.pitch));
  }

  lock() {
    // Pode falhar (iframe sem permissão, Esc recente): o jogo segue sem lock, clique tenta de novo.
    try { this.canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* ignora */ }
  }

  /** Consome uma tecla "apertada agora" (true uma única vez por toque). */
  consume(code) { return this.pressed.delete(code); }

  /** Eixos de movimento no espaço local (-1..1). */
  axes(out) {
    let x = this.touchMove.x, z = -this.touchMove.y;
    if (this.keys.has('KeyW')) z += 1;
    if (this.keys.has('KeyS')) z -= 1;
    if (this.keys.has('KeyD')) x += 1;
    if (this.keys.has('KeyA')) x -= 1;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    out.x = x; out.z = z;
    return out;
  }
}
