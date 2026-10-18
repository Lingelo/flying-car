import { describe, expect, it } from 'vitest';
import { BLOCK_SIZE, CHUNK_SIZE, generateChunk } from './generator';
import { isLandmarkChunk, landmarkBoxes, landmarksNear, templeBlock } from './reserved';

/** Chunks searched for the tower: it stands 1.2 to 2.2 km from the start. */
const SEARCH = 8;
import { buildTemple } from './temples';

const blockOf = (x: number, z: number, cx: number, cz: number) => ({
  i: Math.floor((x - cx * CHUNK_SIZE) / BLOCK_SIZE),
  j: Math.floor((z - cz * CHUNK_SIZE) / BLOCK_SIZE),
});

describe('Tokyo landmarks', () => {
  it('raises a single tower in the whole city, a short flight from the start', () => {
    for (const seed of [5, 42, 2077]) {
      let n = 0;
      for (let x = -40; x < 40; x++) for (let z = -40; z < 40; z++) if (isLandmarkChunk(seed, x, z)) n++;
      expect(n).toBe(1);
      const [tower] = landmarksNear(seed, 0, 0, 3000);
      expect(Math.hypot(tower.x, tower.z)).toBeGreaterThan(1200);
      expect(Math.hypot(tower.x, tower.z)).toBeLessThan(2200);
      expect(landmarksNear(seed, 20000, 0, 4500)).toHaveLength(0);
    }
  });

  it('keeps the tower block free of buildings and gives the tower collision boxes', () => {
    for (let cx = 0; cx < SEARCH; cx++)
      for (let cz = 0; cz < SEARCH; cz++) {
        if (!isLandmarkChunk(5, cx, cz)) continue;
        const chunk = generateChunk(5, cx, cz);
        for (const b of chunk.buildings) {
          const { i, j } = blockOf(b.tiers[0].x, b.tiers[0].z, cx, cz);
          expect(`${i},${j}`).not.toBe('1,1');
        }
        const boxes = landmarkBoxes(5, cx, cz);
        expect(boxes.length).toBeGreaterThan(2);
        expect(Math.max(...boxes.map((b) => b.y1))).toBeGreaterThan(300);
      }
  });

  it('collides with the legs and decks but leaves the arches open', () => {
    for (let cx = 0; cx < SEARCH; cx++)
      for (let cz = 0; cz < SEARCH; cz++) {
        if (!isLandmarkChunk(5, cx, cz)) continue;
        const boxes = landmarkBoxes(5, cx, cz);
        const tower = landmarksNear(5, cx * 256 + 96, cz * 256 + 96, 1)[0];
        const inside = (x: number, y: number, z: number) =>
          boxes.some((b) => Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2 && y > b.y0 && y < b.y1);
        // Under the arch, centre of the base: open.
        expect(inside(tower.x, 10, tower.z)).toBe(false);
        // A corner leg: solid.
        expect(inside(tower.x + 18, 10, tower.z + 18)).toBe(true);
        // The main deck edge: solid.
        expect(inside(tower.x + 9, 145, tower.z)).toBe(true);
      }
  });

  it('keeps towers 2 km away in view, beyond the streamed chunks (AE5)', () => {
    const near = landmarksNear(5, 0, 0, 4000);
    expect(near.some((l) => Math.hypot(l.x, l.z) > 1500)).toBe(true);
    expect(landmarksNear(5, 0, 0, 4000)).toEqual(near);
  });

  it('places temples in some neon and canal blocks, never downtown, deterministically (AE6)', () => {
    let temples = 0;
    for (let cx = -15; cx < 15; cx++)
      for (let cz = -15; cz < 15; cz++) {
        const chunk = generateChunk(2077, cx, cz);
        const block = templeBlock(2077, cx, cz, chunk.district);
        if (!block) continue;
        temples++;
        expect(['neon', 'canals']).toContain(chunk.district);
        for (const b of chunk.buildings) expect(blockOf(b.tiers[0].x, b.tiers[0].z, cx, cz)).not.toEqual(block);
        const temple = buildTemple(2077, chunk);
        expect(temple.boxes.length).toBeGreaterThan(2);
        expect(buildTemple(2077, chunk)).toEqual(temple);
      }
    expect(temples).toBeGreaterThan(3);
  });
});
