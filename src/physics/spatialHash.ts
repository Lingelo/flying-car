import type { Rect } from '../city/generator';

/** Uniform grid over the ground plane: owners (chunks) add and remove their boxes as a group. */
export class SpatialHash<T extends Rect> {
  private readonly cells = new Map<string, Set<T>>();
  private readonly owned = new Map<string, { item: T; keys: string[] }[]>();

  constructor(private readonly cellSize = 32) {}

  private cellKeys(r: Rect, pad = 0): string[] {
    const s = this.cellSize;
    const x0 = Math.floor((r.x - r.w / 2 - pad) / s);
    const x1 = Math.floor((r.x + r.w / 2 + pad) / s);
    const z0 = Math.floor((r.z - r.d / 2 - pad) / s);
    const z1 = Math.floor((r.z + r.d / 2 + pad) / s);
    const keys: string[] = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) keys.push(`${x},${z}`);
    return keys;
  }

  insert(owner: string, items: T[]): void {
    const entries = this.owned.get(owner) ?? [];
    for (const item of items) {
      const keys = this.cellKeys(item);
      for (const k of keys) {
        let cell = this.cells.get(k);
        if (!cell) this.cells.set(k, (cell = new Set()));
        cell.add(item);
      }
      entries.push({ item, keys });
    }
    this.owned.set(owner, entries);
  }

  remove(owner: string): void {
    for (const { item, keys } of this.owned.get(owner) ?? []) {
      for (const k of keys) {
        const cell = this.cells.get(k);
        cell?.delete(item);
        if (cell && !cell.size) this.cells.delete(k);
      }
    }
    this.owned.delete(owner);
  }

  /** Items whose cells intersect the square of half-size `radius` around (x, z). */
  query(x: number, z: number, radius: number): T[] {
    const found = new Set<T>();
    for (const k of this.cellKeys({ x, z, w: 0, d: 0 }, radius)) for (const item of this.cells.get(k) ?? []) found.add(item);
    return [...found];
  }
}
