import { Rng, hash3 } from '../core/random';
import { AIR_TIERS } from '../traffic/lanes';
import { CHUNK_SIZE, type Chunk } from './generator';

export interface GiantHologram {
  /** Centre of the circle the koi swims around. */
  x: number;
  y: number;
  z: number;
  radius: number;
  /** Length of the koi (m). */
  size: number;
  hue: number;
  phase: number;
  /** Seconds per lap (negative: clockwise). */
  period: number;
}

/** Altitudes free of air traffic: corridors at each tier and tier + 10 m, with 10 m clearance. */
const BANDS: [number, number][] = AIR_TIERS.slice(0, -1).map((tier, i) => [tier + 21, AIR_TIERS[i + 1] - 11]);

/** Giant translucent koi circling between the towers of the busy districts (R6). */
export function placeGiantHolograms(chunk: Chunk, seed: number): GiantHologram[] {
  if (chunk.district !== 'downtown' && chunk.district !== 'neon') return [];
  const rng = new Rng(hash3(seed ^ 0x6c01, chunk.cx, chunk.cz));
  if (!rng.chance(chunk.district === 'downtown' ? 0.45 : 0.25)) return [];
  const size = rng.range(24, 46);
  const [lo, hi] = rng.pick(BANDS);
  // The koi spans ±0.4 × size vertically: keep it inside the band.
  const half = size * 0.4;
  const y = half * 2 < hi - lo ? rng.range(lo + half, hi - half) : (lo + hi) / 2;
  const radius = rng.range(30, 70);
  return [
    {
      x: chunk.origin.x + CHUNK_SIZE / 2,
      z: chunk.origin.z + CHUNK_SIZE / 2,
      y,
      radius,
      size,
      hue: rng.int(0, 3),
      phase: rng.range(0, Math.PI * 2),
      period: rng.range(40, 80) * rng.pick([1, -1]),
    },
  ];
}
