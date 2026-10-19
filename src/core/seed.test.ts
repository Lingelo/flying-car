import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED, parseSeed } from './seed';

describe('parseSeed', () => {
  it('reads a valid unsigned 32-bit integer', () => {
    expect(parseSeed('?seed=42')).toBe(42);
    expect(parseSeed('?x=1&seed=4294967295')).toBe(4294967295);
  });

  it('falls back to the default seed for missing or invalid values', () => {
    for (const search of ['', '?seed=', '?seed=abc', '?seed=1e99', '?seed=-3', '?seed=4294967296', '?seed=12.5', '?seed=0x10']) {
      expect(parseSeed(search)).toBe(DEFAULT_SEED);
    }
  });
});
