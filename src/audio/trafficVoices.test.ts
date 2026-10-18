import { describe, expect, it } from 'vitest';
import { assignVoices, dopplerFactor } from './trafficVoices';
import { ambienceLevels } from './ambience';
import { engineParams } from './engine';

const at = (x: number, z = 0) => ({ id: x, x, y: 0, z });

describe('assignVoices', () => {
  it('gives the 8 voices to the 8 closest vehicles', () => {
    const vehicles = Array.from({ length: 20 }, (_, i) => at((i + 1) * 10));
    const voices = assignVoices(new Array(8).fill(null), vehicles, { x: 0, y: 0, z: 0 });
    expect(voices.filter((v) => v !== null).sort((a, b) => a! - b!)).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('keeps a voice on its vehicle while it stays among the closest', () => {
    const first = assignVoices(new Array(3).fill(null), [at(10), at(20), at(30)], { x: 0, y: 0, z: 0 });
    const second = assignVoices(first, [at(30), at(10), at(20), at(500)], { x: 0, y: 0, z: 0 });
    expect(second).toEqual(first);
  });

  it('hands the voice of a vehicle driving away to a closer one', () => {
    const first = assignVoices(new Array(2).fill(null), [at(10), at(20), at(300)], { x: 0, y: 0, z: 0 });
    const far = { ...at(20), x: 900 };
    const second = assignVoices(first, [at(10), far, at(300)], { x: 0, y: 0, z: 0 });
    expect(second).toContain(300);
    expect(second).toContain(10);
    // the voice that stayed on vehicle 10 did not move
    expect(second.indexOf(10)).toBe(first.indexOf(10));
  });

  it('raises the pitch of an approaching vehicle and lowers it when it leaves', () => {
    expect(dopplerFactor(30)).toBeGreaterThan(1);
    expect(dopplerFactor(-30)).toBeLessThan(1);
    expect(dopplerFactor(0)).toBe(1);
  });
});

describe('engineParams', () => {
  it('rises in pitch with speed', () => {
    const slow = engineParams({ speed: 5, throttle: 1, deploy: 0, boost: false });
    const fast = engineParams({ speed: 60, throttle: 1, deploy: 0, boost: false });
    expect(fast.motorFreq).toBeGreaterThan(slow.motorFreq);
  });

  it('switches to the thruster timbre in flight', () => {
    const ground = engineParams({ speed: 30, throttle: 0.5, deploy: 0, boost: false });
    const flight = engineParams({ speed: 30, throttle: 0.5, deploy: 1, boost: false });
    expect(ground.turbineGain).toBe(0);
    expect(flight.turbineGain).toBeGreaterThan(0);
    expect(flight.motorGain).toBeLessThan(ground.motorGain);
  });
});

describe('ambienceLevels', () => {
  it('trades street hum for wind with altitude', () => {
    const street = ambienceLevels({ altitude: 0, speed: 10, rain: 0 });
    const high = ambienceLevels({ altitude: 400, speed: 10, rain: 0 });
    expect(high.city).toBeLessThan(street.city);
    expect(high.wind).toBeGreaterThan(street.wind);
  });

  it('follows the rain intensity', () => {
    expect(ambienceLevels({ altitude: 0, speed: 0, rain: 0 }).rain).toBe(0);
    expect(ambienceLevels({ altitude: 0, speed: 0, rain: 1 }).rain).toBeGreaterThan(0.2);
  });
});
