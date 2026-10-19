import { describe, expect, it } from 'vitest';
import { frameStats } from './bench';

describe('frameStats', () => {
  it('averages the frame rate and isolates the slowest 1 %', () => {
    const frames = [...new Array(99).fill(1 / 60), 1 / 10];
    const { avgFps, low1Fps } = frameStats(frames);
    expect(avgFps).toBeGreaterThan(55);
    expect(avgFps).toBeLessThan(60);
    expect(low1Fps).toBeCloseTo(10);
  });

  it('handles an empty run', () => {
    expect(frameStats([])).toEqual({ avgFps: 0, low1Fps: 0 });
  });
});
