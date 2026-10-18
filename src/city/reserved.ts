import { hash3 } from '../core/random';
import type { Box } from './generator';
import type { DistrictId } from './districts';

// Kept free of generator imports: the generator itself asks which blocks are reserved.
const CHUNK = 256;
const BLOCK = 64;
/** Landmark towers: one per SUPER_CELL × SUPER_CELL chunks (KTD5). */
export const SUPER_CELL = 8;
export const TOWER_HEIGHT = 333;

const superChunk = (seed: number, sx: number, sz: number) => {
  const h = hash3(seed ^ 0x70e3, sx, sz);
  // Keep away from the super-cell edges so towers never cluster.
  return { cx: sx * SUPER_CELL + 2 + (h % 4), cz: sz * SUPER_CELL + 2 + ((h >>> 8) % 4) };
};

export function isLandmarkChunk(seed: number, cx: number, cz: number): boolean {
  const s = superChunk(seed, Math.floor(cx / SUPER_CELL), Math.floor(cz / SUPER_CELL));
  return s.cx === cx && s.cz === cz;
}

export interface Landmark {
  x: number;
  z: number;
  height: number;
  cx: number;
  cz: number;
}

/** Tower centred on block (1, 1) of its chunk, whose buildings the generator leaves out. */
const landmarkAt = (cx: number, cz: number): Landmark => ({ x: cx * CHUNK + 96, z: cz * CHUNK + 96, height: TOWER_HEIGHT, cx, cz });

/** Towers within `radius` of (x, z), streamed independently of the chunks so they show from afar. */
export function landmarksNear(seed: number, x: number, z: number, radius: number): Landmark[] {
  const span = SUPER_CELL * CHUNK;
  const out: Landmark[] = [];
  const s0x = Math.floor((x - radius) / span);
  const s1x = Math.floor((x + radius) / span);
  const s0z = Math.floor((z - radius) / span);
  const s1z = Math.floor((z + radius) / span);
  for (let sx = s0x; sx <= s1x; sx++)
    for (let sz = s0z; sz <= s1z; sz++) {
      const c = superChunk(seed, sx, sz);
      const l = landmarkAt(c.cx, c.cz);
      if (Math.hypot(l.x - x, l.z - z) <= radius) out.push(l);
    }
  return out;
}

/** Stepped core boxes approximating the lattice tower for collisions. */
export const TOWER_SECTIONS: { y0: number; y1: number; width: number }[] = [
  { y0: 0, y1: 60, width: 34 },
  { y0: 60, y1: 140, width: 22 },
  { y0: 140, y1: 230, width: 13 },
  { y0: 230, y1: 290, width: 7 },
  { y0: 290, y1: TOWER_HEIGHT, width: 1.6 },
];

/** Leg boxes at the corners of the 44 m base, observation decks as rendered (landmarkView). */
const LEG = { size: 7, height: 42, base: 44 };
export const TOWER_DECKS: [number, number, number][] = [[145, 20, 10], [245, 9, 6]];

export function landmarkBoxes(seed: number, cx: number, cz: number): Box[] {
  if (!isLandmarkChunk(seed, cx, cz)) return [];
  const l = landmarkAt(cx, cz);
  // Four legs: the arches between them stay open, as the lattice shader draws them.
  const off = LEG.base / 2 - LEG.size / 2 - 1;
  const legs: Box[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => ({ x: l.x + sx * off, z: l.z + sz * off, w: LEG.size, d: LEG.size, y0: 0, y1: LEG.height }));
  const core = TOWER_SECTIONS.map((s) => ({ x: l.x, z: l.z, w: s.width, d: s.width, y0: Math.max(s.y0, LEG.height), y1: s.y1 }));
  const decks = TOWER_DECKS.map(([y, w, h]) => ({ x: l.x, z: l.z, w, d: w, y0: y - h / 2, y1: y + h / 2 }));
  return [...legs, ...core, ...decks];
}

/** Block (i, j) of a chunk given to a temple, if any: some neon and canal chunks (KTD6). */
export function templeBlock(seed: number, cx: number, cz: number, district: DistrictId): { i: number; j: number } | null {
  if (district !== 'neon' && district !== 'canals') return null;
  if (isLandmarkChunk(seed, cx, cz)) return null;
  return hash3(seed ^ 0x7e3b, cx, cz) % 100 < 10 ? { i: 2, j: 1 } : null;
}

/** Blocks the generator must leave empty. */
export function reservedBlocks(seed: number, cx: number, cz: number, district: DistrictId): Set<string> {
  const reserved = new Set<string>();
  if (isLandmarkChunk(seed, cx, cz)) reserved.add('1,1');
  const t = templeBlock(seed, cx, cz, district);
  if (t) reserved.add(`${t.i},${t.j}`);
  return reserved;
}

export const BLOCK_SPAN = BLOCK;
