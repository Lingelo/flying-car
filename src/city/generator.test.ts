import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, generateChunk, type Chunk, type Rect } from './generator';
import { DISTRICTS } from './districts';

const overlaps2d = (a: Rect, b: Rect, margin = 0) =>
  Math.abs(a.x - b.x) * 2 < a.w + b.w - margin * 2 && Math.abs(a.z - b.z) * 2 < a.d + b.d - margin * 2;

describe('generateChunk', () => {
  it('rebuilds the same city for the same seed (AE6)', () => {
    expect(generateChunk(42, 3, -7)).toEqual(generateChunk(42, 3, -7));
    expect(generateChunk(42, 3, -7)).not.toEqual(generateChunk(43, 3, -7));
  });

  it('does not depend on the order in which chunks are generated', () => {
    const direct = generateChunk(42, 5, 5);
    for (let x = -2; x <= 2; x++) generateChunk(42, x, 9);
    expect(generateChunk(42, 5, 5)).toEqual(direct);
  });

  it('places the chunk at its world position', () => {
    const chunk = generateChunk(1, 2, -1);
    expect(chunk.origin).toEqual({ x: 2 * CHUNK_SIZE, z: -1 * CHUNK_SIZE });
    for (const b of chunk.buildings) {
      for (const t of b.tiers) {
        expect(t.x - t.w / 2).toBeGreaterThanOrEqual(chunk.origin.x);
        expect(t.x + t.w / 2).toBeLessThanOrEqual(chunk.origin.x + CHUNK_SIZE);
        expect(t.z - t.d / 2).toBeGreaterThanOrEqual(chunk.origin.z);
        expect(t.z + t.d / 2).toBeLessThanOrEqual(chunk.origin.z + CHUNK_SIZE);
      }
    }
  });

  it('keeps streets continuous across chunk borders', () => {
    const roadLines = (c: Chunk, axis: 'x' | 'z') =>
      c.roads.filter((r) => r.axis === axis).map((r) => `${axis === 'x' ? r.z : r.x}:${axis === 'x' ? r.d : r.w}`).sort();
    // north-south streets (axis z) are the same in vertically adjacent chunks
    expect(roadLines(generateChunk(9, 0, 0), 'z')).toEqual(
      roadLines(generateChunk(9, 0, 1), 'z'),
    );
    // east-west streets (axis x) are the same in horizontally adjacent chunks
    expect(roadLines(generateChunk(9, 0, 0), 'x')).toEqual(
      roadLines(generateChunk(9, 1, 0), 'x'),
    );
  });

  it('never puts a building on a street or on another building', () => {
    for (const [cx, cz] of [[0, 0], [4, -3], [-8, 12], [20, 20]]) {
      const chunk = generateChunk(77, cx, cz);
      const bases = chunk.buildings.map((b) => b.tiers[0]);
      for (const base of bases) {
        for (const road of chunk.roads) expect(overlaps2d(base, road)).toBe(false);
        for (const water of chunk.water) expect(overlaps2d(base, water)).toBe(false);
      }
      for (let i = 0; i < bases.length; i++)
        for (let j = i + 1; j < bases.length; j++) expect(overlaps2d(bases[i], bases[j], 0.01)).toBe(false);
    }
  });

  it('stacks tiers as setbacks that shrink upwards', () => {
    const chunk = generateChunk(5, 0, 0);
    for (const b of chunk.buildings) {
      expect(b.tiers[0].y0).toBe(0);
      for (let i = 1; i < b.tiers.length; i++) {
        expect(b.tiers[i].y0).toBeCloseTo(b.tiers[i - 1].y1);
        expect(b.tiers[i].w).toBeLessThanOrEqual(b.tiers[i - 1].w);
        expect(b.tiers[i].d).toBeLessThanOrEqual(b.tiers[i - 1].d);
      }
      expect(b.height).toBeLessThan(600);
    }
  });

  it('covers every district over a 40 x 40 chunk area', () => {
    const seen = new Set<string>();
    for (let x = -20; x < 20; x++) for (let z = -20; z < 20; z++) seen.add(generateChunk(2077, x, z).district);
    expect([...seen].sort()).toEqual(Object.keys(DISTRICTS).sort());
  });

  it('builds taller skylines downtown than in the industrial zone', () => {
    const heights: Record<string, number[]> = {};
    for (let x = -20; x < 20; x++)
      for (let z = -20; z < 20; z++) {
        const c = generateChunk(2077, x, z);
        (heights[c.district] ??= []).push(...c.buildings.map((b) => b.height));
      }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(heights.downtown)).toBeGreaterThan(2 * avg(heights.industrial));
  });

  it('keeps skywalks clear of the air traffic altitudes', () => {
    for (let x = -6; x < 6; x++)
      for (let z = -6; z < 6; z++)
        for (const w of generateChunk(11, x, z).walkways)
          for (const lane of [80, 150, 250, 400]) expect(w.y1 < lane - 12 || w.y0 > lane + 12).toBe(true);
  });
});
