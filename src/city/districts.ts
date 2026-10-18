export type DistrictId = 'downtown' | 'neon' | 'canals' | 'industrial';

export interface District {
  /** Building heights in metres, drawn as min + (max - min) * r^skew. */
  heightMin: number;
  heightMax: number;
  heightSkew: number;
  /** How many times a block is split into parcels (0 = one building per block). */
  splitDepth: number;
  maxTiers: number;
  waterChance: number;
  walkwayChance: number;
  /** Neon accent hues (0..1) used by facades, signs and holograms. */
  hues: number[];
  /** Base facade tint (linear RGB 0..1). */
  facade: [number, number, number];
  signDensity: number;
}

export const DISTRICTS: Record<DistrictId, District> = {
  downtown: {
    heightMin: 110, heightMax: 540, heightSkew: 1.6, splitDepth: 1, maxTiers: 4,
    waterChance: 0, walkwayChance: 0.45, hues: [0.55, 0.58, 0.83], facade: [0.16, 0.18, 0.22], signDensity: 0.5,
  },
  neon: {
    heightMin: 35, heightMax: 170, heightSkew: 1.3, splitDepth: 2, maxTiers: 2,
    waterChance: 0, walkwayChance: 0.35, hues: [0.92, 0.83, 0.5, 0.13], facade: [0.12, 0.11, 0.14], signDensity: 1,
  },
  canals: {
    heightMin: 22, heightMax: 95, heightSkew: 1.2, splitDepth: 2, maxTiers: 2,
    waterChance: 0.3, walkwayChance: 0.15, hues: [0.47, 0.6, 0.75], facade: [0.15, 0.15, 0.16], signDensity: 0.6,
  },
  industrial: {
    heightMin: 12, heightMax: 48, heightSkew: 1.5, splitDepth: 1, maxTiers: 1,
    waterChance: 0, walkwayChance: 0, hues: [0.08, 0.12, 0.0], facade: [0.2, 0.18, 0.16], signDensity: 0.25,
  },
};

/** Maps a district noise value in [-1, 1] to a district. */
export function districtFor(noise: number): DistrictId {
  if (noise > 0.3) return 'downtown';
  if (noise > -0.1) return 'neon';
  if (noise > -0.45) return 'canals';
  return 'industrial';
}
