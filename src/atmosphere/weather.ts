import { Rng } from '../core/random';

export type WeatherKind = 'clear' | 'haze' | 'rain';
export const WEATHER_KINDS: WeatherKind[] = ['clear', 'haze', 'rain'];
export const WEATHER_LABELS: Record<WeatherKind, string> = { clear: 'Dégagé', haze: 'Brume / smog', rain: 'Pluie' };

export interface WeatherState {
  cloudiness: number;
  /** Exponential fog density. */
  fog: number;
  rain: number;
  /** Lags behind the rain: streets stay wet a while after it stops. */
  wetness: number;
}

export const WEATHER_TARGETS: Record<WeatherKind, Omit<WeatherState, 'wetness'>> = {
  clear: { cloudiness: 0.12, fog: 0.0011, rain: 0 },
  haze: { cloudiness: 0.45, fog: 0.0036, rain: 0 },
  rain: { cloudiness: 0.92, fog: 0.0026, rain: 1 },
};

/** Markov chain: where the weather goes next. */
const NEXT: Record<WeatherKind, [WeatherKind, number][]> = {
  clear: [['haze', 0.6], ['rain', 0.4]],
  haze: [['clear', 0.5], ['rain', 0.5]],
  rain: [['clear', 0.4], ['haze', 0.6]],
};

/** Seconds for a full transition between two weathers. */
const TRANSITION = 60;
const WET_RATE = 1 / 40;
const DRY_RATE = 1 / 180;

/** Dynamic weather (KTD9): each kind lasts 4 to 10 minutes, every change is interpolated. */
export class Weather {
  kind: WeatherKind;
  forced: WeatherKind | null = null;
  readonly state: WeatherState;
  private remaining: number;
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
  force(kind: WeatherKind | null): void {
    this.forced = kind;
    if (kind) this.kind = kind;
    this.remaining = this.duration();
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
      }
    }
    const target = WEATHER_TARGETS[this.kind];
    const s = this.state;
    const move = (value: number, to: number, range: number) => value + Math.max(-range, Math.min(range, to - value));
    s.cloudiness = move(s.cloudiness, target.cloudiness, dt / TRANSITION);
    s.rain = move(s.rain, target.rain, dt / TRANSITION);
    s.fog = move(s.fog, target.fog, (dt / TRANSITION) * 0.003);
    s.wetness = s.rain > 0.1 ? move(s.wetness, Math.max(s.wetness, s.rain), dt * WET_RATE) : move(s.wetness, 0, dt * DRY_RATE);
  }
}
