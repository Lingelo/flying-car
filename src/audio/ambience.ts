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
 * and rain built from a lowpassed wash with a soft rustle, broadband impact ticks and rare drips.
 */
export class Ambience {
  private readonly city: GainNode;
  private readonly wind: GainNode;
  private readonly windFilter: BiquadFilterNode;
  private readonly rain: GainNode;
  private readonly rainFilter: BiquadFilterNode;
  private readonly sizzle: GainNode;
  private readonly drops: GainNode;
  /** Share of the drop impacts played (rain quality): fewer audio nodes on low settings. */
  dropDensity = 1;
  /** Pre-wired impact chains (filter, envelope, pan) reused in turn: only the source is new. */
  private readonly ticks: { filter: BiquadFilterNode; env: GainNode; pan: StereoPannerNode }[] = [];
  private nextTick = 0;
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
    // The soft rustle on top of the body of the rain, kept well below it.
    this.sizzle = loop('pink', 7000, 0.5).gain;
    // Drop transients share a gentle lowpass so they patter instead of ticking.
    const dropFilter = ctx.createBiquadFilter();
    dropFilter.type = 'lowpass';
    dropFilter.frequency.value = 5000;
    this.drops = ctx.createGain();
    this.drops.gain.value = 1;
    this.drops.connect(dropFilter).connect(output);
    for (let i = 0; i < 16; i++) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.2;
      const env = ctx.createGain();
      env.gain.value = 0;
      const pan = ctx.createStereoPanner();
      filter.connect(env).connect(pan).connect(this.drops);
      this.ticks.push({ filter, env, pan });
    }
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
    this.sizzle.gain.setTargetAtTime(l.rain * 0.08, now, 0.5);

    if (l.rain > 0.005 && dt > 0) this.scheduleDrops(l.rain / 0.45, dt, now);
  }

  /**
   * Scatters impacts over the next frame, at a density following the rain: drops are tiny noise
   * ticks (rain hitting hard surfaces is broadband, not tonal); a rare drip into a puddle gives a
   * soft low "plop".
   */
  private scheduleDrops(level: number, dt: number, now: number): void {
    const rates = rainDropRates(level);
    rates.drops *= this.dropDensity;
    const count = (rate: number) => {
      const expected = rate * dt;
      return Math.min(8, Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0));
    };
    for (let i = count(rates.drops); i > 0; i--) {
      const t = now + 0.03 + Math.random() * dt;
      this.tick(t, 1800 + Math.random() * 4000, (0.01 + Math.random() * 0.025) * (0.5 + level));
    }
    for (let i = count(rates.drips * 0.4); i > 0; i--) {
      const t = now + 0.03 + Math.random() * dt;
      this.plop(t, 260 + Math.random() * 280, 0.012 + Math.random() * 0.015);
    }
  }

  /** One impact: a few milliseconds of band-passed noise, panned at random, on a pooled chain. */
  private tick(t: number, centre: number, level: number): void {
    const ctx = this.ctx;
    const chain = this.ticks[this.nextTick];
    this.nextTick = (this.nextTick + 1) % this.ticks.length;
    chain.pan.pan.setValueAtTime(Math.random() * 1.6 - 0.8, t);
    chain.filter.frequency.setValueAtTime(centre, t);
    chain.env.gain.setValueAtTime(level, t);
    chain.env.gain.exponentialRampToValueAtTime(0.0001, t + 0.004 + Math.random() * 0.01);
    const click = ctx.createBufferSource();
    click.buffer = noiseBuffer(ctx, 'pink');
    click.connect(chain.filter);
    click.start(t, Math.random() * 1.9, 0.02);
  }

  /** A drip into a puddle: a short, low, falling sine with a soft attack. */
  private plop(t: number, pitch: number, level: number): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(pitch * 1.4, t);
    osc.frequency.exponentialRampToValueAtTime(pitch, t + 0.05);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(level, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(env).connect(this.drops);
    osc.start(t);
    osc.stop(t + 0.15);
  }
}
