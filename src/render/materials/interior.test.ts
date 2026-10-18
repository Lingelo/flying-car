import { describe, expect, it } from 'vitest';
import { roomHit } from './interior';

const room = { width: 3.2, height: 3.6, depth: 4 };

describe('roomHit (interior mapping)', () => {
  it('reaches the back wall when looking straight in', () => {
    const hit = roomHit({ x: 1.6, y: 1.8 }, { x: 0, y: 0, z: 1 }, room);
    expect(hit.surface).toBe('back');
    expect(hit.point.z).toBeCloseTo(room.depth);
  });

  it('reaches a side wall when looking in at a grazing angle', () => {
    const hit = roomHit({ x: 2.8, y: 1.8 }, { x: 0.9, y: 0, z: 0.3 }, room);
    expect(hit.surface).toBe('right');
    expect(hit.point.x).toBeCloseTo(room.width);
  });

  it('shows the floor when looking down and the ceiling when looking up', () => {
    expect(roomHit({ x: 1.6, y: 0.6 }, { x: 0, y: -0.8, z: 0.4 }, room).surface).toBe('floor');
    expect(roomHit({ x: 1.6, y: 3.0 }, { x: 0, y: 0.8, z: 0.4 }, room).surface).toBe('ceiling');
  });

  it('shifts what is seen through the same window with the view direction (AE1)', () => {
    const a = roomHit({ x: 1.6, y: 1.8 }, { x: -0.2, y: 0, z: 1 }, room);
    const b = roomHit({ x: 1.6, y: 1.8 }, { x: 0.2, y: 0, z: 1 }, room);
    expect(a.surface).toBe('back');
    expect(b.surface).toBe('back');
    expect(Math.abs(a.point.x - b.point.x)).toBeGreaterThan(1);
  });
});
