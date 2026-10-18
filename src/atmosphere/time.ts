/** Real seconds for a full 24 h cycle (24 minutes by default, KTD9). */
export const DEFAULT_DAY_LENGTH = 24 * 60;
/** Tilt of the sun's path: at noon the sun stands about 60° high. */
const ORBIT_TILT = Math.PI / 6;

export type Rgb = [number, number, number];

export function advanceHour(hour: number, dtSeconds: number, dayLength = DEFAULT_DAY_LENGTH): number {
  return (((hour + (dtSeconds * 24) / dayLength) % 24) + 24) % 24;
}

/** The city lives at night only: the clock runs from NIGHT_START, past midnight, to NIGHT_END. */
export const NIGHT_START = 20.5;
export const NIGHT_END = 4.5;

const isNight = (h: number) => h >= NIGHT_START || h <= NIGHT_END;

/** Any hour brought into the night: daytime hours go to the nearer end of the night. */
export function toNightHour(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (isNight(h)) return h;
  return h - NIGHT_END < NIGHT_START - h ? NIGHT_END : NIGHT_START;
}

/** Advances the clock through the night; at its end the night starts over (no daylight). */
export function advanceNightHour(hour: number, dtSeconds: number, dayLength = DEFAULT_DAY_LENGTH): number {
  const h = advanceHour(hour, dtSeconds, dayLength);
  if (isNight(h)) return h;
  return NIGHT_START + (h - NIGHT_END);
}

/** Unit vector towards the sun: rises in the east (+x) at 06:00, sets in the west at 18:00. */
export function sunDirection(hour: number): { x: number; y: number; z: number } {
  const theta = ((hour - 6) / 24) * Math.PI * 2;
  return { x: Math.cos(theta), y: Math.sin(theta) * Math.cos(ORBIT_TILT), z: Math.sin(theta) * Math.sin(ORBIT_TILT) };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 0 in daylight, 1 at night: drives windows, neons and street lights. */
export function nightFactor(hour: number): number {
  return smoothstep(0.08, -0.18, sunDirection(hour).y);
}

/** Share of lit windows; the facade shader uses the same formula. */
export function litRatio(night: number): number {
  return 0.03 + 0.27 * night;
}

export interface SkyState {
  zenith: Rgb;
  horizon: Rgb;
  sunColor: Rgb;
  sunIntensity: number;
  ambientSky: Rgb;
  ambientGround: Rgb;
  ambientIntensity: number;
}

/** Sky keyframes by sun elevation (sine): night, deep dusk, sunset, hazy day, noon. */
const KEYS: [number, SkyState][] = [
  [-0.25, { zenith: [0.008, 0.01, 0.03], horizon: [0.07, 0.035, 0.12], sunColor: [0.5, 0.6, 1], sunIntensity: 0, ambientSky: [0.32, 0.26, 0.62], ambientGround: [0.05, 0.03, 0.08], ambientIntensity: 0.9 }],
  [-0.05, { zenith: [0.03, 0.03, 0.09], horizon: [0.36, 0.12, 0.22], sunColor: [1, 0.4, 0.3], sunIntensity: 0.1, ambientSky: [0.4, 0.28, 0.5], ambientGround: [0.08, 0.04, 0.06], ambientIntensity: 0.9 }],
  [0.05, { zenith: [0.12, 0.14, 0.3], horizon: [0.95, 0.42, 0.22], sunColor: [1, 0.55, 0.3], sunIntensity: 1.2, ambientSky: [0.55, 0.45, 0.55], ambientGround: [0.15, 0.08, 0.06], ambientIntensity: 1 }],
  [0.3, { zenith: [0.25, 0.38, 0.62], horizon: [0.62, 0.6, 0.62], sunColor: [1, 0.9, 0.8], sunIntensity: 2.6, ambientSky: [0.6, 0.66, 0.8], ambientGround: [0.2, 0.17, 0.15], ambientIntensity: 1.2 }],
  [1, { zenith: [0.22, 0.4, 0.72], horizon: [0.66, 0.69, 0.73], sunColor: [1, 0.96, 0.9], sunIntensity: 3.2, ambientSky: [0.62, 0.7, 0.85], ambientGround: [0.22, 0.2, 0.18], ambientIntensity: 1.3 }],
];

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Sky and light colours for an hour, interpolated on sun elevation (so midnight is seamless). */
export function skyAt(hour: number): SkyState {
  const e = sunDirection(hour).y;
  if (e <= KEYS[0][0]) return KEYS[0][1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [e0, a] = KEYS[i];
    const [e1, b] = KEYS[i + 1];
    if (e <= e1) {
      const t = smoothstep(e0, e1, e);
      return {
        zenith: mixRgb(a.zenith, b.zenith, t),
        horizon: mixRgb(a.horizon, b.horizon, t),
        sunColor: mixRgb(a.sunColor, b.sunColor, t),
        sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t,
        ambientSky: mixRgb(a.ambientSky, b.ambientSky, t),
        ambientGround: mixRgb(a.ambientGround, b.ambientGround, t),
        ambientIntensity: a.ambientIntensity + (b.ambientIntensity - a.ambientIntensity) * t,
      };
    }
  }
  return KEYS[KEYS.length - 1][1];
}
