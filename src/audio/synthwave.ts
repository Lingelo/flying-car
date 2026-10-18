import { Rng } from '../core/random';

/** Natural minor scale (semitones from the root). */
export const SCALE = [0, 2, 3, 5, 7, 8, 10];
const PROGRESSIONS = [
  [0, 5, 2, 6],
  [0, 5, 3, 4],
  [0, 3, 5, 4],
  [0, 6, 5, 6],
  [0, 2, 5, 4],
];
export const STEPS_PER_BAR = 16;

export interface Pattern {
  bpm: number;
  /** MIDI note of the key root (bass register). */
  root: number;
  /** Chord root scale degree per bar. */
  chords: number[];
  /** One entry per 16th note over the 4 bars: MIDI note or null (rest). */
  bass: (number | null)[];
  arp: (number | null)[];
  kick: boolean[];
  snare: boolean[];
  hat: boolean[];
}

const degreeToSemitone = (d: number) => SCALE[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);

/** A 4-bar synthwave loop: minor-key progression, driving bass, arpeggio and a straight beat. */
export function generatePattern(seed: number): Pattern {
  const rng = new Rng(seed * 7919 + 13);
  const bpm = rng.int(84, 112);
  const root = 40 + rng.int(0, 9);
  const chords = rng.pick(PROGRESSIONS);
  const bass: (number | null)[] = [];
  const arp: (number | null)[] = [];
  const kick: boolean[] = [];
  const snare: boolean[] = [];
  const hat: boolean[] = [];
  const arpShape = rng.pick([[0, 2, 4, 7], [0, 4, 2, 4], [0, 2, 4, 2], [4, 2, 0, 2]]);
  const octaveJumps = rng.chance(0.5);
  for (const chord of chords) {
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      const rootNote = root + degreeToSemitone(chord);
      bass.push(step % 2 === 0 ? rootNote + (octaveJumps && step % 4 === 2 ? 12 : 0) : null);
      arp.push(root + 24 + degreeToSemitone(chord + arpShape[step % 4]));
      kick.push(step % 4 === 0);
      snare.push(step === 4 || step === 12);
      hat.push(step % 2 === 1);
    }
  }
  return { bpm, root, chords, bass, arp, kick, snare, hat };
}

const midiToHz = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** Plays a pattern in a loop with a look-ahead scheduler. */
export class SynthwavePlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private readonly bus: GainNode;
  private readonly echo: DelayNode;

  constructor(
    private readonly ctx: AudioContext,
    output: AudioNode,
    private readonly pattern: Pattern,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.5;
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = (60 / pattern.bpm) * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    this.echo.connect(feedback).connect(this.echo);
    this.echo.connect(this.bus);
    this.bus.connect(output);
  }

  /** Current step, so a paused track resumes where it stopped. */
  get position(): number {
    return this.step;
  }

  start(fromStep = 0): void {
    this.stop();
    this.step = fromStep;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  dispose(): void {
    this.stop();
    this.bus.disconnect();
  }

  private schedule(): void {
    const secondsPerStep = 60 / this.pattern.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const i = this.step % this.pattern.bass.length;
      const t = this.nextTime;
      const p = this.pattern;
      if (i % STEPS_PER_BAR === 0) this.pad(t, p.root + 12 + degreeToSemitone(p.chords[Math.floor(i / STEPS_PER_BAR)]), secondsPerStep * 16);
      const b = p.bass[i];
      if (b !== null) this.tone(t, b, 'sawtooth', secondsPerStep * 1.8, 0.22, 500);
      const a = p.arp[i];
      if (a !== null) this.tone(t, a, 'square', secondsPerStep * 0.9, 0.06, 2600, true);
      if (p.kick[i]) this.kick(t);
      if (p.snare[i]) this.noiseHit(t, 0.18, 1800, 'bandpass', 0.35);
      if (p.hat[i]) this.noiseHit(t, 0.04, 8000, 'highpass', 0.08);
      this.nextTime += secondsPerStep;
      this.step++;
    }
  }

  private tone(t: number, note: number, type: OscillatorType, length: number, level: number, cutoff: number, echo = false): void {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = midiToHz(note);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(filter).connect(gain).connect(this.bus);
    if (echo) gain.connect(this.echo);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  private pad(t: number, note: number, length: number): void {
    for (const interval of [0, 3, 7]) {
      for (const detune of [-8, 8]) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiToHz(note + interval);
        osc.detune.value = detune;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1100;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.025, t + length * 0.3);
        gain.gain.linearRampToValueAtTime(0, t + length);
        osc.connect(filter).connect(gain).connect(this.bus);
        osc.start(t);
        osc.stop(t + length + 0.05);
      }
    }
  }

  private kick(t: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain).connect(this.bus);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  private noiseHit(t: number, length: number, freq: number, type: BiquadFilterType, level: number): void {
    const buffer = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * length), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(filter).connect(gain).connect(this.bus);
    src.start(t);
  }
}
