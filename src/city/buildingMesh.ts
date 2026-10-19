import { QuadBuilder, type GeometryData } from '../render/geometryData';
import { DISTRICTS } from './districts';
import type { Box, Chunk } from './generator';

/** Order of the districts as seen by the facade shader. */
export const DISTRICT_INDEX: Record<Chunk['district'], number> = { downtown: 0, neon: 1, canals: 2, industrial: 3 };

/** Storey height used by the facade shader to lay out windows. */
export const FLOOR_HEIGHT = 3.6;

/**
 * Building shells of a chunk, relative to the chunk origin. Windows are not modelled: the facade
 * shader draws them from the UVs (metres along the wall, height in metres) and `info`
 * (district index + seed in [0, 1), style, tier top, roof flag).
 */
export function buildBuildingGeometry(chunk: Chunk, lod: boolean): GeometryData {
  const q = new QuadBuilder();
  const district = DISTRICTS[chunk.district];
  const { x: ox, z: oz } = chunk.origin;

  for (const b of chunk.buildings) {
    const seed = (b.seed % 100000) / 100000;
    // Slight per-building variation of the district tint.
    const k = 0.8 + 0.4 * seed;
    const tint: [number, number, number] = [district.facade[0] * k, district.facade[1] * k, district.facade[2] * k];
    const tiers: Box[] = lod ? [{ ...b.tiers[0], y1: b.height }] : b.tiers;
    // The shader picks facade materials per district: its index rides in the integer part.
    const districtSeed = DISTRICT_INDEX[chunk.district] + seed;
    for (const t of tiers) box(q, t, ox, oz, tint, districtSeed, b.style);
  }
  for (const w of lod ? [] : chunk.walkways) box(q, w, ox, oz, [0.08, 0.08, 0.1], 0.5, 4);
  return q.finish();
}

function box(q: QuadBuilder, t: Box, ox: number, oz: number, tint: [number, number, number], seed: number, style: number) {
  const x0 = t.x - t.w / 2 - ox;
  const x1 = t.x + t.w / 2 - ox;
  const z0 = t.z - t.d / 2 - oz;
  const z1 = t.z + t.d / 2 - oz;
  const { y0, y1 } = t;
  const wall = [seed, style, y1, 0] as [number, number, number, number];
  const uvs = (len: number): [number, number][] => [[0, y0], [len, y0], [len, y1], [0, y1]];
  // +z, +x, -z, -x walls, counter-clockwise seen from outside
  q.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], uvs(t.w), tint, wall);
  q.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], uvs(t.d), tint, wall);
  q.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], uvs(t.w), tint, wall);
  q.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], uvs(t.d), tint, wall);
  q.quad(
    [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
    [0, 1, 0],
    [[0, 0], [t.w, 0], [t.w, t.d], [0, t.d]],
    tint,
    [seed, style, y1, 1],
  );
}
