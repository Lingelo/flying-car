import { describe, expect, it } from 'vitest';
import { generateChunk } from '../city/generator';
import { AIR_TIERS, beaconsForChunk, lanePoint, lanesForChunk, signalState } from './lanes';

describe('lanes', () => {
  it('stacks air corridors on four tiers', () => {
    const air = lanesForChunk(0, 0).filter((l) => l.kind === 'air');
    const tiers = new Set(air.map((l) => l.tier));
    expect([...tiers].sort()).toEqual([0, 1, 2, 3]);
    expect(AIR_TIERS).toEqual([80, 150, 250, 400]);
  });

  it('keeps corridors continuous across chunk borders', () => {
    const ids = (cx: number, cz: number, axis: 'x' | 'z') =>
      lanesForChunk(cx, cz).filter((l) => l.axis === axis).map((l) => l.id).sort();
    expect(ids(3, 0, 'z')).toEqual(ids(3, 1, 'z'));
    expect(ids(0, -2, 'x')).toEqual(ids(1, -2, 'x'));
  });

  it('alternates the flow direction from one tier to the next', () => {
    const air = lanesForChunk(2, 2).filter((l) => l.kind === 'air' && l.axis === 'z').sort((a, b) => a.tier - b.tier);
    for (let i = 1; i < air.length; i++) expect(air[i].dir).toBe(-air[i - 1].dir);
  });

  it('never runs an air corridor through a building', () => {
    for (const [cx, cz] of [[0, 0], [5, -3], [-4, 7], [10, 10]]) {
      for (const lane of lanesForChunk(cx, cz).filter((l) => l.kind === 'air')) {
        for (const [dx, dz] of [[0, 0], [-1, 0], [0, -1]]) {
          for (const b of generateChunk(2077, cx + dx, cz + dz).buildings) {
            for (const t of b.tiers) {
              if (lane.y < t.y0 - 4 || lane.y > t.y1 + 4) continue;
              const across = lane.axis === 'z' ? t.x : t.z;
              const half = (lane.axis === 'z' ? t.w : t.d) / 2;
              expect(Math.abs(across - lane.c)).toBeGreaterThan(half + 5);
            }
          }
        }
      }
    }
  });

  it('drives on the right on the ground', () => {
    for (const lane of lanesForChunk(0, 0).filter((l) => l.kind === 'ground')) {
      const p = lanePoint(lane, 10);
      // facing +z, the right side is -x; facing +x, the right side is +z
      if (lane.axis === 'z') expect(Math.sign(p.x - lane.road) * lane.dir).toBe(-1);
      else expect(Math.sign(p.z - lane.road) * lane.dir).toBe(1);
    }
  });

  it('spaces beacons regularly along the corridors', () => {
    const beacons = beaconsForChunk(0, 0).filter((b) => b.axis === 'z' && b.tier === 0 && b.side === 1);
    const along = beacons.map((b) => b.z).sort((a, b) => a - b);
    expect(along.length).toBeGreaterThan(3);
    for (let i = 1; i < along.length; i++) expect(along[i] - along[i - 1]).toBeCloseTo(along[1] - along[0]);
  });

  it('never gives green to both axes, with an all-red clearance', () => {
    let allRed = false;
    for (let t = 0; t < 80; t += 0.25) {
      const s = signalState(t);
      expect(s.x && s.z).toBe(false);
      if (!s.x && !s.z) allRed = true;
    }
    expect(allRed).toBe(true);
  });
});
