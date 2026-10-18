import { describe, expect, it } from 'vitest';
import { advanceHour, advanceNightHour, DEFAULT_DAY_LENGTH, litRatio, nightFactor, NIGHT_END, NIGHT_START, skyAt, sunDirection, toNightHour } from './time';

describe('time of day', () => {
  it('lights the city up as night falls from 17:00 to 21:00 (AE9)', () => {
    const hours = [17, 18, 19, 20, 21];
    const nights = hours.map(nightFactor);
    for (let i = 1; i < nights.length; i++) expect(nights[i]).toBeGreaterThanOrEqual(nights[i - 1]);
    expect(nights[0]).toBeLessThan(0.2);
    expect(nights.at(-1)).toBeGreaterThan(0.95);
    const lit = nights.map(litRatio);
    expect(lit.at(-1)!).toBeGreaterThan(lit[0] * 3);
  });

  it('runs a full day in 24 real minutes by default', () => {
    expect(DEFAULT_DAY_LENGTH).toBe(24 * 60);
    expect(advanceHour(10, 60, DEFAULT_DAY_LENGTH)).toBeCloseTo(11);
  });

  it('wraps around midnight without a jump', () => {
    expect(advanceHour(23.9, 12, DEFAULT_DAY_LENGTH)).toBeCloseTo(0.1);
    expect(Math.abs(nightFactor(23.99) - nightFactor(0.01))).toBeLessThan(0.01);
    const a = skyAt(23.99).horizon;
    const b = skyAt(0.01).horizon;
    expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])).toBeLessThan(0.01);
  });

  it('puts the sun up at noon and down at midnight', () => {
    expect(sunDirection(12).y).toBeGreaterThan(0.8);
    expect(sunDirection(0).y).toBeLessThan(-0.5);
    expect(sunDirection(6).y).toBeCloseTo(0, 1);
    const d = sunDirection(15);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1);
  });

  it('gives a warm horizon at dusk and a dark sky at night', () => {
    const dusk = skyAt(18.2).horizon;
    expect(dusk[0]).toBeGreaterThan(dusk[2]);
    const night = skyAt(1).zenith;
    expect(Math.max(...night)).toBeLessThan(0.08);
  });

  it('keeps the city at night: the cycle loops from the end of the night back to its start', () => {
    for (let h = 0; h < 24; h += 0.25) expect(nightFactor(toNightHour(h))).toBeGreaterThan(0.95);
    expect(toNightHour(23)).toBe(23);
    expect(toNightHour(2)).toBe(2);
    expect(toNightHour(14)).toBe(NIGHT_START);
    expect(toNightHour(6)).toBe(NIGHT_END);
    let h = NIGHT_START;
    for (let t = 0; t < 3 * DEFAULT_DAY_LENGTH; t += 1) {
      h = advanceNightHour(h, 1);
      expect(nightFactor(h)).toBeGreaterThan(0.95);
    }
    expect(advanceNightHour(NIGHT_END - 0.01, 6)).toBeCloseTo(NIGHT_START + 0.09, 3);
  });
});
