import { describe, expect, it } from 'vitest';
import { QUALITY, pixelRatioFor, type QualityName } from './quality';

describe('quality presets', () => {
  it('turns shadows off and shrinks the streamed ring on low', () => {
    expect(QUALITY.low.shadows).toBe(0);
    expect(QUALITY.low.ringRadius).toBeLessThan(QUALITY.high.ringRadius);
    expect(QUALITY.low.traffic).toBeLessThan(QUALITY.high.traffic);
  });

  it('turns everything on with high', () => {
    const h = QUALITY.high;
    expect(h.shadows).toBeGreaterThan(0);
    expect(h.bloom).toBe(true);
    expect(h.smaa).toBe(true);
    expect(h.rain).toBe(1);
  });

  it('orders presets from cheapest to richest', () => {
    const names: QualityName[] = ['low', 'medium', 'high'];
    for (let i = 1; i < names.length; i++) {
      const a = QUALITY[names[i - 1]];
      const b = QUALITY[names[i]];
      expect(b.ringRadius).toBeGreaterThanOrEqual(a.ringRadius);
      expect(b.traffic).toBeGreaterThanOrEqual(a.traffic);
      expect(b.rain).toBeGreaterThanOrEqual(a.rain);
      expect(b.maxPixelRatio).toBeGreaterThanOrEqual(a.maxPixelRatio);
    }
  });

  it('bounds the internal resolution', () => {
    expect(pixelRatioFor('high', 3)).toBeLessThanOrEqual(1.5);
    expect(pixelRatioFor('high', 1)).toBe(1);
    expect(pixelRatioFor('low', 2)).toBeLessThanOrEqual(1);
    expect(pixelRatioFor('low', 1)).toBeGreaterThanOrEqual(0.5);
  });

  it('keeps the LOD ring inside the loaded ring', () => {
    for (const q of Object.values(QUALITY)) expect(q.lodRadius).toBeLessThan(q.ringRadius);
  });
});

describe('ambient occlusion and reflections per preset', () => {
  it('has no AO on low, half-resolution AO on medium, full on high', () => {
    expect(QUALITY.low.ao).toBe('off');
    expect(QUALITY.medium.ao).toBe('half');
    expect(QUALITY.high.ao).toBe('full');
  });

  it('renders real reflections on high only', () => {
    expect(QUALITY.low.reflections).toBe(false);
    expect(QUALITY.medium.reflections).toBe(false);
    expect(QUALITY.high.reflections).toBe(true);
  });
});
