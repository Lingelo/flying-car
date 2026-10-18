import { describe, expect, it } from 'vitest';
import { generateChunk, type Box, type Chunk } from './generator';
import { placeStreetLife } from './streetLife';

const findChunks = (district: Chunk['district'], n = 4) => {
  const out: Chunk[] = [];
  for (let x = -15; x < 15 && out.length < n; x++)
    for (let z = -15; z < 15 && out.length < n; z++) {
      const c = generateChunk(2077, x, z);
      if (c.district === district) out.push(c);
    }
  return out;
};
const insideBox = (p: { x: number; y: number; z: number }, t: Box, margin = 0) =>
  Math.abs(p.x - t.x) < t.w / 2 + margin && Math.abs(p.z - t.z) < t.d / 2 + margin && p.y >= t.y0 && p.y <= t.y1;
const onRoad = (p: { x: number; z: number }, c: Chunk) => c.roads.some((r) => Math.abs(p.x - r.x) < r.w / 2 && Math.abs(p.z - r.z) < r.d / 2);

describe('street life', () => {
  it('cuts narrow alleys between the buildings of the neon district', () => {
    const gap = (c: Chunk) => {
      let min = Infinity;
      const bases = c.buildings.map((b) => b.tiers[0]);
      for (let i = 0; i < bases.length; i++)
        for (let j = i + 1; j < bases.length; j++) {
          const a = bases[i];
          const b = bases[j];
          const gx = Math.abs(a.x - b.x) - (a.w + b.w) / 2;
          const gz = Math.abs(a.z - b.z) - (a.d + b.d) / 2;
          min = Math.min(min, Math.max(gx, gz));
        }
      return min;
    };
    for (const c of findChunks('neon')) expect(gap(c)).toBeGreaterThanOrEqual(4.99);
    for (const c of findChunks('industrial')) expect(gap(c)).toBeLessThan(4.5);
  });

  it('hangs red lanterns along the facades of the neon district, never inside a building', () => {
    let count = 0;
    for (const c of findChunks('neon')) {
      const { lanterns } = placeStreetLife(c, 2077);
      count += lanterns.length;
      for (const l of lanterns) {
        expect(l.y).toBeGreaterThan(2.0);
        expect(l.y).toBeLessThan(5);
        for (const b of c.buildings) expect(insideBox(l, b.tiers[0], 0.2)).toBe(false);
      }
    }
    expect(count).toBeGreaterThan(40);
    for (const c of findChunks('industrial')) expect(placeStreetLife(c, 2077).lanterns).toHaveLength(0);
  });

  it('shelters shopfronts under canopies above head height, against the facade and off the road', () => {
    let count = 0;
    for (const c of findChunks('neon').concat(findChunks('downtown'))) {
      for (const k of placeStreetLife(c, 2077).canopies) {
        count++;
        expect(k.y).toBeGreaterThan(2.6);
        expect(k.y).toBeLessThan(3.2);
        const front = { x: k.x + k.nx * k.depth, z: k.z + k.nz * k.depth };
        expect(onRoad(front, c)).toBe(false);
        // The back edge touches its own wall: just outside the building, not inside any.
        for (const b of c.buildings) expect(insideBox({ x: k.x + k.nx * 0.05, y: k.y, z: k.z + k.nz * 0.05 }, b.tiers[0])).toBe(false);
      }
    }
    expect(count).toBeGreaterThan(10);
  });

  it('hangs lanterns from the front edge of a canopy', () => {
    for (const c of findChunks('neon')) {
      const life = placeStreetLife(c, 2077);
      for (const l of life.lanterns)
        expect(
          life.canopies.some(
            // Under the front edge (0.18 m lower than the back), on a 10 cm cord, 56 cm tall.
            (k) => Math.abs((l.x - k.x) * k.nx + (l.z - k.z) * k.nz - (k.depth - 0.15)) < 0.01 && Math.abs(l.y + 0.56 + 0.1 - (k.y - 0.18)) < 0.01,
          ),
        ).toBe(true);
    }
  });

  it('plants utility poles on sidewalks, with cables from pole to pole', () => {
    for (const c of findChunks('neon').concat(findChunks('canals'))) {
      const { poles, cables } = placeStreetLife(c, 2077);
      expect(poles.length).toBeGreaterThan(4);
      for (const p of poles) {
        expect(onRoad(p, c)).toBe(false);
        for (const b of c.buildings) expect(insideBox({ ...p, y: 1 }, b.tiers[0])).toBe(false);
      }
      const tops = new Set(poles.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`));
      for (const cable of cables) {
        expect(tops.has(`${cable.a.x.toFixed(2)},${cable.a.z.toFixed(2)}`)).toBe(true);
        expect(tops.has(`${cable.b.x.toFixed(2)},${cable.b.z.toFixed(2)}`)).toBe(true);
      }
    }
  });

  it('places glowing vending machines against facades, off the road', () => {
    let count = 0;
    for (const c of findChunks('neon')) {
      for (const v of placeStreetLife(c, 2077).vending) {
        count++;
        expect(onRoad(v, c)).toBe(false);
        for (const b of c.buildings) expect(insideBox({ ...v, y: 1 }, b.tiers[0], -0.05)).toBe(false);
      }
    }
    expect(count).toBeGreaterThan(5);
  });

  it('is deterministic', () => {
    const c = findChunks('neon')[0];
    expect(placeStreetLife(c, 9)).toEqual(placeStreetLife(c, 9));
  });
});
