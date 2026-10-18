export type QualityName = 'low' | 'medium' | 'high';
export const QUALITY_NAMES: QualityName[] = ['low', 'medium', 'high'];
export const QUALITY_LABELS: Record<QualityName, string> = { low: 'Basse', medium: 'Moyenne', high: 'Haute' };

export interface QualityPreset {
  /** Shadow map size, 0 = no shadows. */
  shadows: number;
  bloom: boolean;
  smaa: boolean;
  /** Share of the rain drops drawn. */
  rain: number;
  /** Streamed chunks around the player, and where the simplified LOD starts. */
  ringRadius: number;
  lodRadius: number;
  traffic: number;
  /** Upper bound on the device pixel ratio used for rendering. */
  maxPixelRatio: number;
  minPixelRatio: number;
}

export const QUALITY: Record<QualityName, QualityPreset> = {
  low: { shadows: 0, bloom: false, smaa: false, rain: 0.35, ringRadius: 3, lodRadius: 2, traffic: 110, maxPixelRatio: 0.85, minPixelRatio: 0.6 },
  medium: { shadows: 1024, bloom: true, smaa: true, rain: 0.65, ringRadius: 4, lodRadius: 3, traffic: 190, maxPixelRatio: 1, minPixelRatio: 0.75 },
  high: { shadows: 2048, bloom: true, smaa: true, rain: 1, ringRadius: 5, lodRadius: 3, traffic: 260, maxPixelRatio: 1.5, minPixelRatio: 1 },
};

/** Rendering pixel ratio: the device ratio bounded by the preset. */
export function pixelRatioFor(name: QualityName, devicePixelRatio: number): number {
  const q = QUALITY[name];
  return Math.min(q.maxPixelRatio, Math.max(q.minPixelRatio, devicePixelRatio));
}

/** Largest traffic of any preset: sizes the instance buffers once. */
export const MAX_TRAFFIC = Math.max(...QUALITY_NAMES.map((n) => QUALITY[n].traffic));
