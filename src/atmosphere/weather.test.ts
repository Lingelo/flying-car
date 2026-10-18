import { describe, expect, it } from 'vitest';
import { Weather, WEATHER_TARGETS, weatherKind } from './weather';

const run = (w: Weather, seconds: number, dt = 0.5) => {
  for (let t = 0; t < seconds; t += dt) w.step(dt);
};

describe('Weather', () => {
  it('brings rain in progressively over about a minute (AE10)', () => {
    const w = new Weather(1, 'clear');
    w.force('rain');
    run(w, 1);
    expect(w.state.rain).toBeLessThan(0.05);
    run(w, 29);
    expect(w.state.rain).toBeGreaterThan(0.3);
    expect(w.state.rain).toBeLessThan(0.7);
    run(w, 31);
    expect(w.state.rain).toBeCloseTo(1, 2);
    expect(w.state.fog).toBeGreaterThan(WEATHER_TARGETS.clear.fog);
    expect(w.state.wetness).toBeGreaterThan(0.5);
  });

  it('never switches instantly, whatever the jump', () => {
    const w = new Weather(1, 'clear');
    w.force('rain');
    let previous = w.state.rain;
    for (let t = 0; t < 90; t += 0.1) {
      w.step(0.1);
      expect(w.state.rain - previous).toBeLessThan(0.01);
      previous = w.state.rain;
    }
  });

  it('dries the streets about three minutes after the rain stops', () => {
    const w = new Weather(1, 'rain');
    run(w, 120);
    w.force('clear');
    run(w, 90);
    expect(w.state.wetness).toBeGreaterThan(0.2);
    run(w, 200);
    expect(w.state.wetness).toBeLessThan(0.05);
  });

  it('cycles through every kind of weather on its own', () => {
    const w = new Weather(42, 'clear');
    const seen = new Set<string>();
    for (let t = 0; t < 4 * 3600; t += 1) {
      w.step(1);
      seen.add(w.kind);
    }
    expect([...seen].sort()).toEqual(['clear', 'fog', 'rain', 'storm']);
  });

  it('holds a forced weather until released', () => {
    const w = new Weather(5, 'clear');
    w.force('fog');
    run(w, 3600, 5);
    expect(w.kind).toBe('fog');
    w.force(null);
    run(w, 3 * 3600, 5);
    expect(w.forced).toBeNull();
  });

  it('thickens the fog in fog and brings a storm level only in storms', () => {
    const fog = new Weather(1, 'fog');
    expect(fog.state.fog).toBeGreaterThan(WEATHER_TARGETS.rain.fog * 1.5);
    expect(fog.state.storm).toBe(0);
    const w = new Weather(1, 'rain');
    w.force('storm');
    run(w, 90);
    expect(w.state.storm).toBeCloseTo(1, 2);
    expect(w.state.rain).toBeCloseTo(1, 2);
    w.force('clear');
    run(w, 90);
    expect(w.state.storm).toBe(0);
  });

  it('reads the former haze setting as fog', () => {
    expect(weatherKind('haze')).toBe('fog');
    expect(weatherKind('storm')).toBe('storm');
    expect(weatherKind('snow')).toBeNull();
  });
});
