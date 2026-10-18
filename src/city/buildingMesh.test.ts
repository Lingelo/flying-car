import { describe, expect, it } from 'vitest';
import { generateChunk, type Chunk } from './generator';
import { buildBuildingGeometry, FLOOR_HEIGHT } from './buildingMesh';
import { buildGroundGeometry } from './roadMesh';

const oneTower: Chunk = {
  cx: 0, cz: 0, origin: { x: 0, z: 0 }, district: 'downtown', roads: [], water: [], walkways: [],
  buildings: [{
    seed: 123, style: 1, height: 90,
    tiers: [
      { x: 30, z: 30, w: 20, d: 10, y0: 0, y1: 60 },
      { x: 30, z: 30, w: 12, d: 6, y0: 60, y1: 90 },
    ],
  }],
};

describe('buildBuildingGeometry', () => {
  it('emits four walls and a roof per tier', () => {
    const g = buildBuildingGeometry(oneTower, false);
    expect(g.position.length / 3).toBe(2 * 5 * 4);
    expect(g.index.length).toBe(2 * 5 * 6);
  });

  it('emits a single box per building at low detail', () => {
    const g = buildBuildingGeometry(oneTower, true);
    expect(g.position.length / 3).toBe(5 * 4);
    const ys = Array.from(g.position.filter((_, i) => i % 3 === 1));
    expect(Math.max(...ys)).toBe(90);
  });

  it('maps facade UVs in metres so windows follow the floor height', () => {
    const g = buildBuildingGeometry(oneTower, false);
    for (let v = 0; v < g.position.length / 3; v++) {
      const isRoof = g.info[v * 4 + 3] === 1;
      if (isRoof) continue;
      // v coordinate is the height in metres
      expect(g.uv[v * 2 + 1]).toBeCloseTo(g.position[v * 3 + 1]);
      // u coordinate spans the wall width, starting at 0
      expect(g.uv[v * 2]).toBeGreaterThanOrEqual(0);
      expect(g.uv[v * 2]).toBeLessThanOrEqual(20);
    }
    expect(FLOOR_HEIGHT).toBeGreaterThan(3);
  });

  it('positions vertices relative to the chunk origin', () => {
    const chunk = generateChunk(4, 12, -9);
    const g = buildBuildingGeometry(chunk, false);
    const xs = Array.from(g.position.filter((_, i) => i % 3 === 0));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(256);
  });

  it('gives districts distinct facade tints', () => {
    const tint = (district: Chunk['district']) => Array.from(buildBuildingGeometry({ ...oneTower, district }, false).color.slice(0, 3));
    const tints = new Set((['downtown', 'neon', 'canals', 'industrial'] as const).map((d) => tint(d).join()));
    expect(tints.size).toBe(4);
  });

  it('stores the tier top so the shader can outline roofs', () => {
    const g = buildBuildingGeometry(oneTower, false);
    const tops = new Set<number>();
    for (let v = 0; v < g.position.length / 3; v++) tops.add(g.info[v * 4 + 2]);
    expect([...tops].sort((a, b) => a - b)).toEqual([60, 90]);
  });
});

describe('buildGroundGeometry', () => {
  it('splits streets at intersections and keeps them inside the chunk', () => {
    const chunk = generateChunk(1, 0, 0);
    const { roads } = buildGroundGeometry(chunk);
    // 4 lines x 4 segments x 2 axes + 16 intersections, one quad each
    expect(roads.position.length / 3).toBe((32 + 16) * 4);
    const xs = Array.from(roads.position.filter((_, i) => i % 3 === 0));
    expect(Math.max(...xs)).toBeLessThanOrEqual(256);
  });

  it('marks intersections so the shader draws no lane markings there', () => {
    const { roads } = buildGroundGeometry(generateChunk(1, 0, 0));
    let intersections = 0;
    for (let v = 0; v < roads.position.length / 3; v++) if (roads.info[v * 4 + 2] === 1) intersections++;
    expect(intersections).toBe(16 * 4);
  });
});
