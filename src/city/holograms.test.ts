import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, generateChunk } from './generator';
import { placeGiantHolograms } from './holograms';
import { AIR_TIERS } from '../traffic/lanes';

describe('giant holograms', () => {
  const all = () => {
    const out = [];
    for (let x = -10; x < 10; x++) for (let z = -10; z < 10; z++) out.push(...placeGiantHolograms(generateChunk(2077, x, z), 2077));
    return out;
  };

  it('swims koi between the towers of the downtown and neon districts', () => {
    const holos = all();
    expect(holos.length).toBeGreaterThan(10);
    for (const h of holos) expect(h.size).toBeGreaterThan(20);
  });

  it('keeps every hologram clear of the air corridors', () => {
    for (const h of all()) {
      const bottom = h.y - h.size * 0.4;
      const top = h.y + h.size * 0.4;
      for (const tier of AIR_TIERS) {
        for (const lane of [tier, tier + 10]) expect(top < lane - 10 || bottom > lane + 10).toBe(true);
      }
    }
  });

  it('circles inside its own chunk', () => {
    for (let x = -4; x < 4; x++)
      for (let z = -4; z < 4; z++) {
        const chunk = generateChunk(2077, x, z);
        for (const h of placeGiantHolograms(chunk, 2077)) {
          expect(h.x - h.radius).toBeGreaterThanOrEqual(chunk.origin.x);
          expect(h.x + h.radius).toBeLessThanOrEqual(chunk.origin.x + CHUNK_SIZE);
        }
      }
  });

  it('is deterministic', () => {
    const c = generateChunk(2077, 1, 2);
    expect(placeGiantHolograms(c, 2077)).toEqual(placeGiantHolograms(c, 2077));
  });
});
