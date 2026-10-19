import { describe, expect, it } from 'vitest';
import { Lightning } from './lightning';

const run = (l: Lightning, storm: number, seconds: number, dt = 0.05) => {
  const thunder: number[] = [];
  let maxFlash = 0;
  for (let t = 0; t < seconds; t += dt) {
    for (const e of l.step(dt, storm)) thunder.push(e.delay);
    maxFlash = Math.max(maxFlash, l.flash);
  }
  return { thunder, maxFlash };
};

describe('Lightning', () => {
  it('never strikes outside a storm', () => {
    const { thunder, maxFlash } = run(new Lightning(3), 0, 600);
    expect(thunder).toHaveLength(0);
    expect(maxFlash).toBe(0);
  });

  it('strikes every few seconds in a storm, each flash followed by thunder after the light', () => {
    const l = new Lightning(3);
    const { thunder, maxFlash } = run(l, 1, 120);
    expect(thunder.length).toBeGreaterThan(5);
    expect(thunder.length).toBeLessThan(30);
    expect(maxFlash).toBeGreaterThan(0.8);
    for (const d of thunder) expect(d).toBeGreaterThan(0.5);
    expect(new Set(thunder.map((d) => d.toFixed(2))).size).toBeGreaterThan(3);
  });

  it('delays the thunder by the distance of its bolt at the speed of sound', () => {
    const l = new Lightning(5);
    let checked = 0;
    for (let t = 0; t < 120; t += 0.05)
      for (const strike of l.step(0.05, 1)) {
        expect(strike.delay).toBeCloseTo(l.bolt!.distance / 343, 6);
        checked++;
      }
    expect(checked).toBeGreaterThan(3);
  });

  it('fades the flash out quickly and leaves a bolt only while it flashes', () => {
    const l = new Lightning(7);
    let struck = false;
    for (let t = 0; t < 60 && !struck; t += 0.05) struck = l.step(0.05, 1).length > 0;
    expect(struck).toBe(true);
    expect(l.bolt).not.toBeNull();
    run(l, 0, 2);
    expect(l.flash).toBeLessThan(0.01);
    expect(l.bolt).toBeNull();
  });

  it('is deterministic for a seed', () => {
    expect(run(new Lightning(11), 1, 90).thunder).toEqual(run(new Lightning(11), 1, 90).thunder);
  });
});
