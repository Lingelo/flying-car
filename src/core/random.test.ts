import { describe, expect, it } from 'vitest';
import { Rng, hash3 } from './random';

const take = (rng: Rng, n: number) => Array.from({ length: n }, () => rng.next());

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    expect(take(new Rng(42), 20)).toEqual(take(new Rng(42), 20));
  });

  it('produces different sequences for different seeds', () => {
    expect(take(new Rng(42), 5)).not.toEqual(take(new Rng(43), 5));
  });

  it('stays within [0, 1) and is roughly uniform', () => {
    const values = take(new Rng(7), 10000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('range and int stay within their bounds', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 1000; i++) {
      const r = rng.range(-2, 5);
      expect(r).toBeGreaterThanOrEqual(-2);
      expect(r).toBeLessThan(5);
      const n = rng.int(3, 6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
  });
});

describe('hash3', () => {
  it('is deterministic and decorrelates neighbouring coordinates', () => {
    expect(hash3(42, 1, 2)).toBe(hash3(42, 1, 2));
    const neighbours = new Set([hash3(42, 0, 0), hash3(42, 1, 0), hash3(42, 0, 1), hash3(42, -1, 0), hash3(43, 0, 0)]);
    expect(neighbours.size).toBe(5);
    // first draws of neighbouring chunks must not be close to each other
    const a = new Rng(hash3(42, 0, 0)).next();
    const b = new Rng(hash3(42, 1, 0)).next();
    expect(Math.abs(a - b)).toBeGreaterThan(1e-3);
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const [x, z] of [[0, 0], [-5, 9], [100000, -100000]]) {
      const h = hash3(1, x, z);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
});
