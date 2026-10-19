import { describe, expect, it } from 'vitest';
import { generateChunk, type Chunk } from './generator';
import { buildDetailGeometry, placeDetails } from './details';

const chunks: Chunk[] = [];
for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) chunks.push(generateChunk(2077, x, z));

describe('roof and wall details', () => {
  it('puts equipment on every roof, inside its footprint and standing on it (R4)', () => {
    let items = 0;
    for (const c of chunks)
      for (const r of placeDetails(c, 2077).roof) {
        items++;
        const t = r.roof;
        expect(Math.abs(r.x - t.x) + r.w / 2).toBeLessThanOrEqual(t.w / 2 + 1e-6);
        expect(Math.abs(r.z - t.z) + r.d / 2).toBeLessThanOrEqual(t.d / 2 + 1e-6);
        expect(r.y).toBeCloseTo(t.y1, 5);
      }
    expect(items).toBeGreaterThan(500);
    const kinds = new Set(chunks.flatMap((c) => placeDetails(c, 2077).roof.map((r) => r.kind)));
    for (const k of ['parapet', 'hut', 'ac', 'tank', 'mast', 'dish', 'helipad']) expect(kinds.has(k as never), k).toBe(true);
  });

  it('lays helipads only on towers taller than 120 m', () => {
    for (const c of chunks)
      for (const r of placeDetails(c, 2077).roof) if (r.kind === 'helipad') expect(r.roof.y1).toBeGreaterThan(120);
  });

  it('hangs air conditioners and pipes on the outside of walls, above the shops (R4)', () => {
    let units = 0;
    for (const c of chunks)
      for (const w of placeDetails(c, 2077).wall) {
        units++;
        const t = w.tier;
        // On the face: one coordinate on the wall plane, just outside it.
        const out = w.nx !== 0 ? (w.x - t.x) * w.nx - t.w / 2 : (w.z - t.z) * w.nz - t.d / 2;
        expect(out).toBeGreaterThan(0);
        expect(out).toBeLessThan(0.6);
        expect(w.y).toBeGreaterThan(4.4);
        expect(w.y + w.h).toBeLessThanOrEqual(t.y1 + 1e-6);
      }
    expect(units).toBeGreaterThan(200);
  });

  it('is deterministic for a seed (AE4)', () => {
    const c = chunks[13];
    expect(placeDetails(c, 2077)).toEqual(placeDetails(c, 2077));
    expect(placeDetails(c, 2078)).not.toEqual(placeDetails(c, 2077));
  });

  it('builds solid props and glowing beacons', () => {
    const g = buildDetailGeometry(placeDetails(chunks[5], 2077), chunks[5].origin.x, chunks[5].origin.z);
    expect(g.props.position.length).toBeGreaterThan(1000);
    expect(g.glow.position.length).toBeGreaterThan(0);
    // Chunk-local and finite: within the chunk (cranes may overhang a little), above the ground,
    // below the tallest roof plus its tallest equipment.
    const top = Math.max(...chunks[5].buildings.map((b) => b.height)) + 40;
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const p of [g.props.position, g.glow.position])
      for (let i = 0; i < p.length; i++) {
        if (!Number.isFinite(p[i])) throw new Error(`vertex component ${i} is ${p[i]}`);
        lo[i % 3] = Math.min(lo[i % 3], p[i]);
        hi[i % 3] = Math.max(hi[i % 3], p[i]);
      }
    expect(lo[0]).toBeGreaterThan(-30);
    expect(hi[0]).toBeLessThan(256 + 30);
    expect(lo[2]).toBeGreaterThan(-30);
    expect(hi[2]).toBeLessThan(256 + 30);
    expect(lo[1]).toBeGreaterThanOrEqual(0);
    expect(hi[1]).toBeLessThan(top);
  });
});
