export const DEFAULT_SEED = 2077;

/** Reads `?seed=` strictly as an unsigned 32-bit decimal integer; anything else gives the default. */
export function parseSeed(search: string): number {
  const raw = new URLSearchParams(search).get('seed');
  if (!raw || !/^\d{1,10}$/.test(raw)) return DEFAULT_SEED;
  const value = Number(raw);
  return value <= 0xffffffff ? value : DEFAULT_SEED;
}
