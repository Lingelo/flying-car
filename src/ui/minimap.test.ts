import { describe, expect, it } from 'vitest';
import { worldToMinimap } from './minimap';

const view = { x: 100, z: 200, yaw: 0, scale: 0.5, size: 200 };

describe('worldToMinimap', () => {
  it('puts the player at the centre', () => {
    expect(worldToMinimap(100, 200, view)).toEqual({ x: 100, y: 100 });
  });

  it('shows what is ahead of the car above the centre, heading up', () => {
    // yaw 0: the car faces +z
    const p = worldToMinimap(100, 260, view);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(100 - 30);
  });

  it('shows what is on the right of the car on the right', () => {
    // facing +z, the right is -x
    const p = worldToMinimap(40, 200, view);
    expect(p.x).toBeCloseTo(130);
    expect(p.y).toBeCloseTo(100);
  });

  it('rotates with the heading', () => {
    // facing +x (yaw = 90°): a point further along +x is ahead
    const p = worldToMinimap(160, 200, { ...view, yaw: Math.PI / 2 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(70);
  });
});
