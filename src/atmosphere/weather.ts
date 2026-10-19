import { Rng } from '../core/random';

export type WeatherKind = 'clear' | 'rain' | 'fog' | 'storm';
export const WEATHER_KINDS: WeatherKind[] = ['clear', 'rain', 'fog', 'storm'];
export const WEATHER_LABELS: Record<WeatherKind, string> = { clear: 'Temps sec', rain: 'Pluie', fog: 'Brouillard', storm: 'Orage' };

/** A weather name from settings or the URL; the former 'haze' is now fog. */
export function weatherKind(name: unknown): WeatherKind | null {
  if (name === 'haze') return 'fog';
  return WEATHER_KINDS.includes(name as WeatherKind) ? (name as WeatherKind) : null;
}

export interface WeatherState {
  cloudiness: number;
  /** Exponential fog density. */
  fog: number;
  rain: number;
  /** 0 to 1: lightning and thunder. */
  storm: number;
  /** Lags behind the rain: streets stay wet a while after it stops. */
  wetness: number;
}

export const WEATHER_TARGETS: Record<WeatherKind, Omit<WeatherState, 'wetness'>> = {
  clear: { cloudiness: 0.35, fog: 0.0019, rain: 0, storm: 0 },
  rain: { cloudiness: 0.92, fog: 0.0034, rain: 1, storm: 0 },
  fog: { cloudiness: 0.7, fog: 0.0048, rain: 0, storm: 0 },
  storm: { cloudiness: 1, fog: 0.0042, rain: 1, storm: 1 },
};

/** Markov chain: where the weather goes next. */
const NEXT: Record<WeatherKind, [WeatherKind, number][]> = {
  clear: [['rain', 0.4], ['fog', 0.35], ['storm', 0.25]],
  rain: [['clear', 0.35], ['fog', 0.25], ['storm', 0.4]],
  fog: [['clear', 0.5], ['rain', 0.5]],
  storm: [['rain', 0.7], ['clear', 0.3]],
};

/** Seconds for a full transition between two weathers. */
const TRANSITION = 60;
/** Seconds for a change asked from the settings menu: the player expects to see it at once. */
export const MENU_TRANSITION = 4;
const WET_RATE = 1 / 40;
const DRY_RATE = 1 / 180;

/** Dynamic weather (KTD9): each kind lasts 4 to 10 minutes, every change is interpolated. */
export class Weather {
  kind: WeatherKind;
  forced: WeatherKind | null = null;
  readonly state: WeatherState;
  private remaining: number;
  private transition = TRANSITION;
  private readonly rng: Rng;

  constructor(seed: number, initial: WeatherKind = 'clear') {
    this.rng = new Rng(seed ^ 0x3a7e);
    this.kind = initial;
    this.state = { ...WEATHER_TARGETS[initial], wetness: WEATHER_TARGETS[initial].rain };
    this.remaining = this.duration();
  }

  private duration(): number {
    return this.rng.range(240, 600);
  }

  /** Forces a weather from the settings; `null` gives control back to the cycle. */
  force(kind: WeatherKind | null, transition = TRANSITION): void {
    this.forced = kind;
    this.transition = kind ? transition : TRANSITION;
    if (kind) this.kind = kind;
    this.remaining = this.duration();
  }

  /** Jumps to the current kind's state at once (start-up), streets as wet as the rain. */
  snap(): void {
    Object.assign(this.state, WEATHER_TARGETS[this.kind], { wetness: WEATHER_TARGETS[this.kind].rain });
  }

  step(dt: number): void {
    if (!this.forced) {
      this.remaining -= dt;
      if (this.remaining <= 0) {
        let r = this.rng.next();
        for (const [kind, p] of NEXT[this.kind]) {
          r -= p;
          if (r <= 0) {
            this.kind = kind;
            break;
          }
        }
        this.remaining = this.duration();
        this.transition = TRANSITION;
      }
    }
    const target = WEATHER_TARGETS[this.kind];
    const s = this.state;
    const move = (value: number, to: number, range: number) => value + Math.max(-range, Math.min(range, to - value));
    const step = dt / this.transition;
    s.cloudiness = move(s.cloudiness, target.cloudiness, step);
    s.rain = move(s.rain, target.rain, step);
    s.storm = move(s.storm, target.storm, step);
    s.fog = move(s.fog, target.fog, step * 0.003);
    s.wetness = s.rain > 0.1 ? move(s.wetness, Math.max(s.wetness, s.rain), dt * WET_RATE) : move(s.wetness, 0, dt * DRY_RATE);
  }
}
