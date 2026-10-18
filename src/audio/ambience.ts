import { noiseBuffer, type NoiseColour } from './noise';

export interface AmbienceInput {
  altitude: number;
  speed: number;
  rain: number;
}

/** City hum fades with altitude, wind grows with altitude and speed, rain follows the weather. */
export function ambienceLevels({ altitude, speed, rain }: AmbienceInput): { city: number; wind: number; rain: number } {
  const h = Math.max(0, altitude);
  return {
    city: 0.5 * Math.exp(-h / 150),
    wind: Math.min(0.6, 0.04 + h / 800 + speed / 250),
    rain: rain * 0.45 * (1 - 0.3 * Math.min(1, h / 300)),
  };
}

/** Wind lowpass cutoff (Hz): darker when calm, opening up with speed, altitude and gusts (gust ~0.5–1.5). */
export function windCutoff(speed: number, altitude: number, gust = 1): number {
  const base = 300 + Math.max(0, speed) * 4 + Math.max(0, altitude) * 0.4;
  return Math.min(900, Math.min(900, base) * (0.75 + 0.25 * gust));
}

/** Rain drop transients per second for a rain level (0..1): many small drops, a few heavier drips. */
export function rainDropRates(rain: number): { drops: number; drips: number } {
  const r = Math.max(0, Math.min(1, rain));
  return { drops: 70 * r * (0.4 + 0.6 * r), drips: 2.5 * r };
}

/**
 * Procedural ambience (no recordings to license): brown-noise city rumble, gusty pink-noise wind,
 * and rain built from a soft lowpassed wash plus individual drop and drip transients.
 */
export class Ambience {
  private readonly city: GainNode;
  private readonly wind: GainNode;
  private readonly windFilter: BiquadFilterNode;
  private readonly rain: GainNode;
  private readonly rainFilter: BiquadFilterNode;
  private readonly drops: GainNode;
  private gust = 1;
  private nextGustAt = 0;
  private lastUpdate = -1;

  constructor(
    private readonly ctx: AudioContext,
    private readonly output: AudioNode,
  ) {
    const loop = (colour: NoiseColour, freq: number, q = 0.7) => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, colour);
      src.loop = true;
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(output);
      src.start(0, Math.random() * 1.5);
      return { gain, filter };
    };
    this.city = loop('brown', 380).gain;
    const wind = loop('pink', 500, 1.6);
    this.wind = wind.gain;
    this.windFilter = wind.filter;
    const rain = loop('pink', 2000, 0.5);
    this.rain = rain.gain;
    this.rainFilter = rain.filter;
    // Drop transients share a gentle lowpass so they patter instead of ticking.
    const dropFilter = ctx.createBiquadFilter();
    dropFilter.type = 'lowpass';
    dropFilter.frequency.value = 5000;
    this.drops = ctx.createGain();
    this.drops.gain.value = 1;
    this.drops.connect(dropFilter).connect(output);
  }

  /**
   * Thunder, heard `delay` seconds from now: a sharp crack when close, then a long low rumble that
   * rolls (lowpassed brown noise, wobbling gain).
   */
  thunder(delay: number, loudness: number): void {
    const ctx = this.ctx;
    const start = ctx.currentTime + delay;
    const duration = 3 + 3 * (1 - loudness);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 'brown');
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400 + 1600 * loudness, start);
    filter.frequency.exponentialRampToValueAtTime(90, start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.9 * loudness + 0.15, start + 0.04 + 0.4 * (1 - loudness));
    for (let i = 1; i < 6; i++) gain.gain.linearRampToValueAtTime((0.25 + 0.45 * Math.random()) * (1 - i / 6) * (0.6 + loudness), start + (duration * i) / 6);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    src.connect(filter).connect(gain).connect(this.output);
    src.start(start);
    src.stop(start + duration + 0.1);
  }

  update(input: AmbienceInput): void {
    const l = ambienceLevels(input);
    const now = this.ctx.currentTime;
    const dt = this.lastUpdate < 0 ? 0 : Math.min(0.1, Math.max(0, now - this.lastUpdate));
    this.lastUpdate = now;

    // Slow random gusts: a new target every few seconds, glided into.
    if (now >= this.nextGustAt) {
      this.gust = 0.5 + Math.random() * 1.0;
      this.nextGustAt = now + 1.5 + Math.random() * 4;
    }
    this.city.gain.setTargetAtTime(l.city, now, 0.5);
    this.wind.gain.setTargetAtTime(l.wind * 0.6 * this.gust, now, 1.2);
    this.windFilter.frequency.setTargetAtTime(windCutoff(input.speed, input.altitude, this.gust), now, 1.2);
    this.rain.gain.setTargetAtTime(l.rain * 0.45, now, 0.5);
    this.rainFilter.frequency.setTargetAtTime(1500 + 1500 * Math.min(1, input.rain), now, 0.5);

    if (l.rain > 0.005 && dt > 0) this.scheduleDrops(l.rain / 0.45, dt, now);
  }

  /** Scatters drop and drip transients over the next frame, at a density following the rain. */
  private scheduleDrops(level: number, dt: number, now: number): void {
    const rates = rainDropRates(level);
    const count = (rate: number) => {
      const expected = rate * dt;
      return Math.min(8, Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0));
    };
    for (let i = count(rates.drops); i > 0; i--) {
      const t = now + 0.03 + Math.random() * dt;
      this.plip(t, 1400 + Math.random() * 2600, 0.015 + Math.random() * 0.03, (0.012 + Math.random() * 0.03) * (0.5 + level));
    }
    for (let i = count(rates.drips); i > 0; i--) {
      const t = now + 0.03 + Math.random() * dt;
      this.plip(t, 450 + Math.random() * 700, 0.07 + Math.random() * 0.08, 0.04 + Math.random() * 0.05);
    }
  }

  /** One drop: a tiny rising sine chirp (the bubble) on a soft noise click, panned at random. */
  private plip(t: number, pitch: number, length: number, level: number): void {
    const ctx = this.ctx;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.8 - 0.9;
    pan.connect(this.drops);

    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.exponentialRampToValueAtTime(pitch * (1.3 + Math.random() * 0.5), t + length);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(level, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(env).connect(pan);
    osc.start(t);
    osc.stop(t + length + 0.02);

    const click = ctx.createBufferSource();
    click.buffer = noiseBuffer(ctx, 'pink');
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.value = pitch * 0.7;
    clickFilter.Q.value = 0.8;
    const clickEnv = ctx.createGain();
    clickEnv.gain.setValueAtTime(level * 0.8, t);
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);
    click.connect(clickFilter).connect(clickEnv).connect(pan);
    click.start(t, Math.random() * 1.9, 0.012);
  }
}
