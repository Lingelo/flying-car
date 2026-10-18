import { WEATHER_KINDS, type WeatherKind } from '../atmosphere/weather';
import { QUALITY_NAMES, type QualityName } from './quality';

export interface Settings {
  quality: QualityName;
  /** Fixed hour, or null to let the day/night cycle run. */
  hour: number | null;
  /** Forced weather, or null for the dynamic weather. */
  weather: WeatherKind | null;
  masterVolume: number;
  musicVolume: number;
}

export const DEFAULT_SETTINGS: Settings = { quality: 'high', hour: null, weather: null, masterVolume: 0.8, musicVolume: 0.55 };
const STORAGE_KEY = 'flying-car.settings';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** Reads saved settings; each field is validated and bounded, anything invalid gets its default. */
export function loadSettings(storage: StorageLike | null): Settings {
  const result = { ...DEFAULT_SETTINGS };
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return result;
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (!p || typeof p !== 'object') return result;
    if (QUALITY_NAMES.includes(p.quality as QualityName)) result.quality = p.quality as QualityName;
    if (p.hour === null) result.hour = null;
    else if (p.hour !== undefined) result.hour = clamp(p.hour, 0, 23.99, 21.5);
    if (p.weather === null || WEATHER_KINDS.includes(p.weather as WeatherKind)) result.weather = (p.weather as WeatherKind | null) ?? null;
    result.masterVolume = clamp(p.masterVolume, 0, 1, DEFAULT_SETTINGS.masterVolume);
    result.musicVolume = clamp(p.musicVolume, 0, 1, DEFAULT_SETTINGS.musicVolume);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  return result;
}

export function saveSettings(settings: Settings, storage: StorageLike | null): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not remembered in private mode: harmless.
  }
}
