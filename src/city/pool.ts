/** Reuses released objects instead of allocating new ones (chunk meshes, buffers). */
export class Pool<T> {
  private free: T[] = [];
  /** Number of objects ever created: stays flat once the pool is warm. */
  created = 0;

  constructor(private readonly create: () => T) {}

  acquire(): T {
    const item = this.free.pop();
    if (item !== undefined) return item;
    this.created++;
    return this.create();
  }

  release(item: T): void {
    this.free.push(item);
  }

  get available(): number {
    return this.free.length;
  }
}
