import { describe, expect, it } from 'vitest';
import { FixedStep } from './loop';

describe('FixedStep', () => {
  it('runs one step for one frame at 60 fps', () => {
    const clock = new FixedStep(1 / 60);
    expect(clock.advance(1 / 60).steps).toBe(1);
  });

  it('caps catch-up steps after a long frame', () => {
    const clock = new FixedStep(1 / 60, 5);
    expect(clock.advance(0.1).steps).toBe(5);
    // the backlog is dropped rather than replayed on the next frame
    expect(clock.advance(1 / 60).steps).toBe(1);
  });

  it('accumulates short frames until a step is due', () => {
    const clock = new FixedStep(1 / 60);
    expect(clock.advance(0.005).steps).toBe(0);
    expect(clock.advance(0.005).steps).toBe(0);
    expect(clock.advance(0.008).steps).toBe(1);
  });

  it('exposes an interpolation alpha in [0, 1)', () => {
    const clock = new FixedStep(1 / 60);
    for (const dt of [0.003, 0.011, 0.02, 0.033, 0.0167]) {
      const { alpha } = clock.advance(dt);
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
    }
  });
});
