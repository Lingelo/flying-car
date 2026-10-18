import { describe, expect, it } from 'vitest';
import { BLOCK_SIZE, CHUNK_SIZE, generateChunk } from './generator';
import { isLandmarkChunk, landmarkBoxes, landmarksNear, SUPER_CELL, templeBlock } from './reserved';
import { buildTemple } from './temples';

const blockOf = (x: number, z: number, cx: number, cz: number) => ({
  i: Math.floor((x - cx * CHUNK_SIZE) / BLOCK_SIZE),
  j: Math.floor((z - cz * CHUNK_SIZE) / BLOCK_SIZE),
});

describe('Tokyo landmarks', () => {
  it('raises exactly one tower per 8 × 8 super-cell, always in the same place', () => {
    for (const [sx, sz] of [[0, 0], [1, -2], [-3, 4]]) {
      let n = 0;
      for (let x = 0; x < SUPER_CELL; x++)
        for (let z = 0; z < SUPER_CELL; z++) if (isLandmarkChunk(5, sx * SUPER_CELL + x, sz * SUPER_CELL + z)) n++;
      expect(n).toBe(1);
    }
  });

  it('keeps the tower block free of buildings and gives the tower collision boxes', () => {
    for (let cx = 0; cx < SUPER_CELL; cx++)
      for (let cz = 0; cz < SUPER_CELL; cz++) {
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
    for (let cx = 0; cx < SUPER_CELL; cx++)
      for (let cz = 0; cz < SUPER_CELL; cz++) {
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
