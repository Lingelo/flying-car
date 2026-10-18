import { noiseBuffer } from './noise';

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

/** Procedural ambience (no recordings to license): brown-noise city rumble, wind and rain. */
export class Ambience {
  private readonly city: GainNode;
  private readonly wind: GainNode;
  private readonly windFilter: BiquadFilterNode;
  private readonly rain: GainNode;

  constructor(
    private readonly ctx: AudioContext,
    private readonly output: AudioNode,
  ) {
    const loop = (colour: 'white' | 'brown', filterType: BiquadFilterType, freq: number) => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, colour);
      src.loop = true;
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(output);
      src.start();
      return { gain, filter };
    };
    this.city = loop('brown', 'lowpass', 380).gain;
    const wind = loop('white', 'bandpass', 700);
    this.wind = wind.gain;
    this.windFilter = wind.filter;
    this.rain = loop('white', 'highpass', 2500).gain;
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
    this.city.gain.setTargetAtTime(l.city, now, 0.5);
    this.wind.gain.setTargetAtTime(l.wind * 0.5, now, 0.3);
    this.windFilter.frequency.setTargetAtTime(500 + input.speed * 8, now, 0.3);
    this.rain.gain.setTargetAtTime(l.rain * 0.6, now, 0.5);
  }
}
