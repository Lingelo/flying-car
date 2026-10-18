import { Rng } from '../core/random';

/** A bolt seen from the player: direction (radians), distance (m) and a seed for its shape. */
export interface Bolt {
  azimuth: number;
  distance: number;
  seed: number;
}

export interface Thunder {
  /** Seconds before the thunder is heard (sound at 343 m/s). */
  delay: number;
  /** 0 to 1, louder when close. */
  loudness: number;
}

const SPEED_OF_SOUND = 343;
/** A strike flickers: three pulses within a third of a second. */
const PULSES = [0, 0.09, 0.22];
const PULSE_DECAY = 0.07;

/** Storm lightning (R12): deterministic strikes every few seconds, a flickering flash and its bolt. */
export class Lightning {
  /** Current flash intensity, 0 to 1. */
  flash = 0;
  bolt: Bolt | null = null;
  private readonly rng: Rng;
  private wait: number;
  private since = Infinity;

  constructor(seed: number) {
    this.rng = new Rng(seed ^ 0x5f0d);
    this.wait = this.rng.range(2, 8);
  }

  /** Advances by dt for a storm level in [0, 1]; returns the thunder of the strikes it fires. */
  step(dt: number, storm: number): Thunder[] {
    const thunder: Thunder[] = [];
    this.since += dt;
    if (storm > 0.5) {
      this.wait -= dt * storm;
      if (this.wait <= 0) {
        this.since = 0;
        const distance = this.rng.range(350, 2400);
        this.bolt = { azimuth: this.rng.range(0, Math.PI * 2), distance, seed: this.rng.int(0, 1 << 30) };
        thunder.push({ delay: distance / SPEED_OF_SOUND, loudness: Math.min(1, 600 / distance) });
        this.wait = this.rng.range(4, 14);
      }
    }
    let flash = 0;
    for (const p of PULSES) if (this.since >= p) flash = Math.max(flash, Math.exp(-(this.since - p) / PULSE_DECAY));
    this.flash = flash < 0.005 ? 0 : flash;
    if (this.flash === 0) this.bolt = null;
    return thunder;
  }
}
