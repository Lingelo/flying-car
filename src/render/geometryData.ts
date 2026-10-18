/** Plain typed-array geometry, built off the main thread and turned into a BufferGeometry on mount. */
export interface GeometryData {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  color: Float32Array;
  /** Free per-vertex vec4 interpreted by the material (seed, style, tier top, flags…). */
  info: Float32Array;
  index: Uint32Array;
}

/** Accumulates quads; `finish` packs them into typed arrays. */
export class QuadBuilder {
  private position: number[] = [];
  private normal: number[] = [];
  private uv: number[] = [];
  private color: number[] = [];
  private info: number[] = [];
  private index: number[] = [];

  /**
   * Adds a quad from four corners given counter-clockwise when seen from the front.
   * `uvs` holds the four (u, v) pairs, `color` and `info` apply to the whole quad.
   */
  quad(
    corners: [number, number, number][],
    n: [number, number, number],
    uvs: [number, number][],
    color: [number, number, number],
    info: [number, number, number, number],
  ): void {
    const base = this.position.length / 3;
    for (let i = 0; i < 4; i++) {
      this.position.push(...corners[i]);
      this.normal.push(...n);
      this.uv.push(...uvs[i]);
      this.color.push(...color);
      this.info.push(...info);
    }
    this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  finish(): GeometryData {
    return {
      position: new Float32Array(this.position),
      normal: new Float32Array(this.normal),
      uv: new Float32Array(this.uv),
      color: new Float32Array(this.color),
      info: new Float32Array(this.info),
      index: new Uint32Array(this.index),
    };
  }
}

/** Buffers to transfer from a worker without copying. */
export function transferables(g: GeometryData): ArrayBuffer[] {
  return [g.position, g.normal, g.uv, g.color, g.info, g.index].map((a) => a.buffer as ArrayBuffer);
}
