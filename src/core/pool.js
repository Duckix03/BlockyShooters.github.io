// Object pool genérico: pré-aloca tudo no início, zero alocação durante o loop.
export class Pool {
  /**
   * @param {() => T} create  fábrica chamada só na pré-alocação
   * @param {number} size     quantidade fixa de objetos
   * @template T
   */
  constructor(create, size) {
    this.items = new Array(size);
    this.free = new Array(size);
    for (let i = 0; i < size; i++) { this.items[i] = create(i); this.free[i] = size - 1 - i; }
    this.freeCount = size;
    this.active = new Uint8Array(size);
  }
  /** Pega um objeto livre (ou null se o pool esgotou — preferível a alocar). */
  acquire() {
    if (this.freeCount === 0) return null;
    const i = this.free[--this.freeCount];
    this.active[i] = 1;
    return i;
  }
  release(i) {
    if (!this.active[i]) return;
    this.active[i] = 0;
    this.free[this.freeCount++] = i;
  }
  get activeCount() { return this.items.length - this.freeCount; }
}
