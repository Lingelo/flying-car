import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './store';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('settings store', () => {
  it('saves and reloads valid settings', () => {
    const storage = new MemoryStorage();
    const s = { ...DEFAULT_SETTINGS, quality: 'medium' as const, hour: 18.5, weather: 'rain' as const, musicVolume: 0.3 };
    saveSettings(s, storage);
    expect(loadSettings(storage)).toEqual(s);
  });

  it('clamps out-of-range values', () => {
    const storage = new MemoryStorage();
    storage.setItem('flying-car.settings', JSON.stringify({ hour: 99, masterVolume: 7, musicVolume: -2, quality: 'ultra' }));
    const s = loadSettings(storage);
    expect(s.hour).toBeLessThan(24);
    expect(s.hour).toBeGreaterThanOrEqual(0);
    expect(s.masterVolume).toBe(1);
    expect(s.musicVolume).toBe(0);
    expect(s.quality).toBe(DEFAULT_SETTINGS.quality);
  });

  it('falls back to defaults on corrupted or unavailable storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('flying-car.settings', '{oops');
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    const throwing = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, throwing)).not.toThrow();
  });

  it('accepts automatic time and weather', () => {
    const storage = new MemoryStorage();
    storage.setItem('flying-car.settings', JSON.stringify({ hour: null, weather: null }));
    const s = loadSettings(storage);
    expect(s.hour).toBeNull();
    expect(s.weather).toBeNull();
  });
});
