import { CHUNK_SIZE } from './generator';

/** Anything addressed by chunk coordinates (chunk data, or chunk data plus prebuilt meshes). */
export interface ChunkKey {
  cx: number;
  cz: number;
  /** Set by a source that could not produce the chunk: it is skipped, never retried. */
  failed?: boolean;
}

/** Produces chunks asynchronously (a Web Worker in the app, a synchronous stub in tests). */
export interface ChunkSource<P extends ChunkKey> {
  request(cx: number, cz: number): void;
  /** Chunks that arrived since the last call. */
  drain(): P[];
}

/** Turns chunk data into something visible and back (meshes in the app). */
export interface ChunkSink<P extends ChunkKey, H> {
  mount(chunk: P, lod: boolean): H;
  unmount(handle: H): void;
  setLod(handle: H, lod: boolean): void;
}

export interface StreamerOptions {
  /** Chunks within this distance (in chunks) of the player are loaded. */
  radius: number;
  /** Chunks beyond this distance use the simplified level of detail. */
  lodRadius: number;
  /** Upper bound on GPU uploads per frame, to avoid hitches. */
  maxMountsPerFrame: number;
  maxInFlight?: number;
}

export interface ActiveChunk<P extends ChunkKey, H> {
  chunk: P;
  handle: H;
  lod: boolean;
}

const key = (cx: number, cz: number) => `${cx},${cz}`;

/** Keeps a ring of chunks loaded around the player, closest and straight-ahead chunks first. */
export class ChunkStreamer<P extends ChunkKey, H> {
  readonly active = new Map<string, ActiveChunk<P, H>>();
  private readonly pending = new Set<string>();
  /** Chunks the source failed to produce: not requested again (a hole rather than a stall). */
  readonly failed = new Set<string>();
  private ready: P[] = [];
  private readonly offsets: { dx: number; dz: number; d: number }[] = [];

  constructor(
    private readonly source: ChunkSource<P>,
    private readonly sink: ChunkSink<P, H>,
    private readonly options: StreamerOptions,
  ) {
    this.computeOffsets();
  }

  private computeOffsets(): void {
    const r = this.options.radius;
    this.offsets.length = 0;
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        const d = Math.hypot(dx, dz);
        if (d <= r) this.offsets.push({ dx, dz, d });
      }
  }

  /** Changes the ring size (quality setting); chunks beyond it unload on the next update. */
  setRadius(radius: number, lodRadius: number): void {
    this.options.radius = radius;
    this.options.lodRadius = lodRadius;
    this.computeOffsets();
  }

  /** Call once per frame with the player position and, optionally, its horizontal heading. */
  update(x: number, z: number, headingX = 0, headingZ = 0): void {
    const pcx = Math.floor(x / CHUNK_SIZE);
    const pcz = Math.floor(z / CHUNK_SIZE);
    const { radius, lodRadius, maxMountsPerFrame, maxInFlight = 4 } = this.options;
    const distance = (cx: number, cz: number) => Math.hypot(cx - pcx, cz - pcz);

    // Unload with one chunk of hysteresis so that hovering on a border does not thrash.
    for (const [k, entry] of this.active) {
      const d = distance(entry.chunk.cx, entry.chunk.cz);
      if (d > radius + 1) {
        this.sink.unmount(entry.handle);
        this.active.delete(k);
      } else if (d > lodRadius !== entry.lod) {
        entry.lod = d > lodRadius;
        this.sink.setLod(entry.handle, entry.lod);
      }
    }

    // Request missing chunks, ahead of the movement first.
    const hl = Math.hypot(headingX, headingZ) || 1;
    const missing = this.offsets
      .filter(({ dx, dz }) => {
        const k = key(pcx + dx, pcz + dz);
        return !this.active.has(k) && !this.pending.has(k) && !this.failed.has(k);
      })
      .map((o) => ({ ...o, score: o.d - (o.d ? (0.75 * (o.dx * headingX + o.dz * headingZ)) / (hl * o.d) : 0) }))
      .sort((a, b) => a.score - b.score);
    for (const o of missing) {
      if (this.pending.size >= maxInFlight) break;
      const k = key(pcx + o.dx, pcz + o.dz);
      this.pending.add(k);
      this.source.request(pcx + o.dx, pcz + o.dz);
    }

    // Mount what arrived, nearest first, within the per-frame budget.
    // A chunk stays "pending" until it is mounted or dropped, so it is never requested twice.
    for (const c of this.source.drain()) {
      if (c.failed) {
        this.pending.delete(key(c.cx, c.cz));
        this.failed.add(key(c.cx, c.cz));
      } else {
        this.ready.push(c);
      }
    }
    this.ready = this.ready.filter((c) => {
      const keep = distance(c.cx, c.cz) <= radius;
      if (!keep) this.pending.delete(key(c.cx, c.cz));
      return keep;
    });
    this.ready.sort((a, b) => distance(a.cx, a.cz) - distance(b.cx, b.cz));
    for (const chunk of this.ready.splice(0, maxMountsPerFrame)) {
      this.pending.delete(key(chunk.cx, chunk.cz));
      const lod = distance(chunk.cx, chunk.cz) > lodRadius;
      this.active.set(key(chunk.cx, chunk.cz), { chunk, handle: this.sink.mount(chunk, lod), lod });
    }
  }

  dispose(): void {
    for (const entry of this.active.values()) this.sink.unmount(entry.handle);
    this.active.clear();
  }
}

