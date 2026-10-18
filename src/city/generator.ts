import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { Rng, hash3 } from '../core/random';
import { DISTRICTS, districtFor, type District, type DistrictId } from './districts';

export const CHUNK_SIZE = 256;
export const BLOCK_SIZE = 64;
export const AVENUE_WIDTH = 24;
export const STREET_WIDTH = 14;
const SIDEWALK = 3;
const PARCEL_GAP = 3;
/** Altitude bands where skywalks may be built: between the air-traffic tiers (80, 150, 250, 400 m). */
const WALKWAY_BANDS: [number, number][] = [[24, 60], [98, 132], [170, 232]];
const WALKWAY_HEIGHT = 4;

/** Axis-aligned rectangle on the ground, centred on (x, z). */
export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface Box extends Rect {
  y0: number;
  y1: number;
}

export interface Road extends Rect {
  /** Direction the road runs along. */
  axis: 'x' | 'z';
  avenue: boolean;
}

export interface Building {
  tiers: Box[];
  height: number;
  /** Per-building variation seed for window patterns and lit windows. */
  seed: number;
  style: number;
}

export interface Chunk {
  cx: number;
  cz: number;
  origin: { x: number; z: number };
  district: DistrictId;
  buildings: Building[];
  roads: Road[];
  water: Rect[];
  walkways: Box[];
}

const noiseBySeed = new Map<number, NoiseFunction2D>();
function districtNoise(seed: number): NoiseFunction2D {
  let noise = noiseBySeed.get(seed);
  if (!noise) {
    const rng = new Rng(seed ^ 0x5eed);
    noise = createNoise2D(() => rng.next());
    noiseBySeed.set(seed, noise);
  }
  return noise;
}

export function districtAt(seed: number, cx: number, cz: number): DistrictId {
  const noise = districtNoise(seed);
  const n = 0.75 * noise(cx * 0.09, cz * 0.09) + 0.25 * noise(cx * 0.31 + 17.3, cz * 0.31 - 4.1);
  return districtFor(n);
}

/** Street line positions inside a chunk (local coordinates) with their width; line 0 is an avenue. */
const LINES = Array.from({ length: CHUNK_SIZE / BLOCK_SIZE }, (_, i) => ({
  at: i * BLOCK_SIZE,
  width: i === 0 ? AVENUE_WIDTH : STREET_WIDTH,
}));
const lineWidth = (local: number) => (local % CHUNK_SIZE === 0 ? AVENUE_WIDTH : STREET_WIDTH);

/** Builds one chunk; a pure function of (seed, cx, cz), so chunks can be generated in any order. */
export function generateChunk(seed: number, cx: number, cz: number): Chunk {
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;
  const districtId = districtAt(seed, cx, cz);
  const district = DISTRICTS[districtId];
  const rng = new Rng(hash3(seed, cx, cz));

  const roads: Road[] = [];
  for (const line of LINES) {
    const avenue = line.width === AVENUE_WIDTH;
    roads.push({ axis: 'z', avenue, x: ox + line.at, z: oz + CHUNK_SIZE / 2, w: line.width, d: CHUNK_SIZE });
    roads.push({ axis: 'x', avenue, x: ox + CHUNK_SIZE / 2, z: oz + line.at, w: CHUNK_SIZE, d: line.width });
  }

  const buildings: Building[] = [];
  const water: Rect[] = [];
  /** Buildings indexed by block (i along x, j along z) to connect skywalks across streets. */
  const byBlock: Building[][][] = LINES.map(() => LINES.map(() => []));

  LINES.forEach((lx, i) => {
    LINES.forEach((lz, j) => {
      const x0 = lx.at + lx.width / 2 + SIDEWALK;
      const x1 = lx.at + BLOCK_SIZE - lineWidth(lx.at + BLOCK_SIZE) / 2 - SIDEWALK;
      const z0 = lz.at + lz.width / 2 + SIDEWALK;
      const z1 = lz.at + BLOCK_SIZE - lineWidth(lz.at + BLOCK_SIZE) / 2 - SIDEWALK;
      const block: Rect = { x: ox + (x0 + x1) / 2, z: oz + (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
      if (rng.chance(district.waterChance)) {
        water.push(block);
        return;
      }
      for (const parcel of split(block, district.splitDepth, rng)) {
        const building = makeBuilding(parcel, district, rng);
        buildings.push(building);
        byBlock[i][j].push(building);
      }
    });
  });

  const walkways = district.walkwayChance > 0 ? connectWalkways(byBlock, district, rng) : [];

  return { cx, cz, origin: { x: ox, z: oz }, district: districtId, buildings, roads, water, walkways };
}

function split(rect: Rect, depth: number, rng: Rng): Rect[] {
  if (depth <= 0 || Math.max(rect.w, rect.d) < 20 || (depth === 1 && rng.chance(0.25))) return [rect];
  const t = rng.range(0.38, 0.62);
  if (rect.w >= rect.d) {
    const left = rect.w * t - PARCEL_GAP / 2;
    const right = rect.w - left - PARCEL_GAP;
    const xl = rect.x - rect.w / 2;
    return [
      ...split({ x: xl + left / 2, z: rect.z, w: left, d: rect.d }, depth - 1, rng),
      ...split({ x: xl + left + PARCEL_GAP + right / 2, z: rect.z, w: right, d: rect.d }, depth - 1, rng),
    ];
  }
  const front = rect.d * t - PARCEL_GAP / 2;
  const back = rect.d - front - PARCEL_GAP;
  const zf = rect.z - rect.d / 2;
  return [
    ...split({ x: rect.x, z: zf + front / 2, w: rect.w, d: front }, depth - 1, rng),
    ...split({ x: rect.x, z: zf + front + PARCEL_GAP + back / 2, w: rect.w, d: back }, depth - 1, rng),
  ];
}

function makeBuilding(parcel: Rect, district: District, rng: Rng): Building {
  const inset = rng.range(0, Math.min(2.5, parcel.w * 0.1, parcel.d * 0.1));
  const height = district.heightMin + (district.heightMax - district.heightMin) * rng.next() ** district.heightSkew;
  const tierCount = Math.min(district.maxTiers, 1 + Math.floor(rng.next() * district.maxTiers * (height / district.heightMax + 0.4)));

  const tiers: Box[] = [];
  let w = parcel.w - inset * 2;
  let d = parcel.d - inset * 2;
  let y0 = 0;
  // Each tier takes a decreasing share of the total height; the last one ends at `height`.
  for (let t = 0; t < tierCount; t++) {
    const last = t === tierCount - 1;
    const y1 = last ? height : y0 + (height - y0) * rng.range(0.45, 0.7);
    tiers.push({ x: parcel.x, z: parcel.z, w, d, y0, y1 });
    y0 = y1;
    const shrink = rng.range(0.62, 0.86);
    w = Math.max(6, w * shrink);
    d = Math.max(6, d * shrink);
  }
  return { tiers, height, seed: Math.floor(rng.next() * 0xffffffff), style: rng.int(0, 3) };
}

/** Skywalks across the internal north-south streets, between buildings of facing blocks. */
function connectWalkways(byBlock: Building[][][], district: District, rng: Rng): Box[] {
  const walkways: Box[] = [];
  for (let i = 1; i < byBlock.length; i++) {
    for (let j = 0; j < byBlock[i].length; j++) {
      if (!rng.chance(district.walkwayChance)) continue;
      const pairs: [Box, Box][] = [];
      for (const left of byBlock[i - 1][j])
        for (const right of byBlock[i][j]) {
          const a = left.tiers[0];
          const b = right.tiers[0];
          const overlap = Math.min(a.z + a.d / 2, b.z + b.d / 2) - Math.max(a.z - a.d / 2, b.z - b.d / 2);
          if (overlap >= 10) pairs.push([a, b]);
        }
      if (!pairs.length) continue;
      const [a, b] = rng.pick(pairs);
      const top = Math.min(a.y1, b.y1) - 6;
      const bands = WALKWAY_BANDS.filter(([lo]) => lo < top);
      if (!bands.length) continue;
      const [lo, hi] = rng.pick(bands);
      const y0 = rng.range(lo, Math.min(hi, top) - WALKWAY_HEIGHT);
      if (y0 < lo) continue;
      const zMin = Math.max(a.z - a.d / 2, b.z - b.d / 2);
      const zMax = Math.min(a.z + a.d / 2, b.z + b.d / 2);
      const xa = a.x + a.w / 2;
      const xb = b.x - b.w / 2;
      walkways.push({ x: (xa + xb) / 2, z: rng.range(zMin + 4, zMax - 4), w: xb - xa, d: 5, y0, y1: y0 + WALKWAY_HEIGHT });
    }
  }
  return walkways;
}
