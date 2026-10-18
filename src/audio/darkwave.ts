import { Rng } from '../core/random';
import { noiseBuffer } from './noise';

/** Minor modes (semitones from the root): aeolian (natural minor) and the darker phrygian. */
export const SCALES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
} as const;
export type Mode = keyof typeof SCALES;
/** Natural minor, kept for older imports. */
export const SCALE = SCALES.aeolian;

/** Chord root scale degree per bar. Phrygian avoids its diminished v. */
const PROGRESSIONS: Record<Mode, number[][]> = {
  aeolian: [
    [0, 5, 2, 6],
    [0, 3, 5, 4],
    [0, 5, 3, 4],
    [0, 0, 5, 6],
    [0, 6, 5, 3],
  ],
  phrygian: [
    [0, 1, 0, 6],
    [0, 1, 6, 0],
    [0, 5, 1, 0],
    [0, 3, 1, 0],
  ],
};
/** Bass rhythms over one bar of 8th notes. */
const BASS_RHYTHMS = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 1, 1, 1, 0, 1, 1],
  [1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 1, 1, 1, 0],
];
const ARP_SHAPES = [[0, 2, 4, 7], [0, 4, 2, 7], [7, 4, 2, 0], [0, 2, 4, 2]];
export const STEPS_PER_BAR = 16;
export const BPM_RANGE = [90, 110] as const;

export interface Pattern {
  bpm: number;
  mode: Mode;
  /** Scale of the key, semitones from the root. */
  scale: readonly number[];
  /** MIDI note of the key root (bass register). */
  root: number;
  /** Chord root scale degree per bar. */
  chords: number[];
  /** Pad chord per bar: diatonic triad, MIDI notes. */
  pads: number[][];
  /** One entry per 16th note over the 4 bars: MIDI note or null (rest). */
  bass: (number | null)[];
  arp: (number | null)[];
  kick: boolean[];
  snare: boolean[];
  hat: boolean[];
}

const degreeToSemitone = (scale: readonly number[], d: number) => scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);

/**
 * A 4-bar darkwave loop: minor/phrygian progression, driving 8th-note bass, slow triad pads,
 * a sparse arpeggio motif and a half-time-feel beat with the snare on 2 and 4.
 */
export function generatePattern(seed: number): Pattern {
  const rng = new Rng(seed * 7919 + 13);
  const mode: Mode = rng.chance(0.35) ? 'phrygian' : 'aeolian';
  const scale = SCALES[mode];
  const bpm = rng.int(BPM_RANGE[0], BPM_RANGE[1]);
  const root = 36 + rng.int(2, 9); // D2..A2
  const note = (d: number) => root + degreeToSemitone(scale, d);
  const chords = rng.pick(PROGRESSIONS[mode]);
  const bassRhythm = rng.pick(BASS_RHYTHMS);
  const arpShape = rng.pick(ARP_SHAPES);
  // One arpeggio motif repeated every bar, sparse (about a quarter of the 16ths).
  const arpMask = Array.from({ length: STEPS_PER_BAR }, (_, i) => (i === 0 ? true : rng.chance(0.22)));
  const arpFromBar = rng.chance(0.5) ? 1 : 0;
  const extraKick = rng.chance(0.4);
  const hatMask = Array.from({ length: STEPS_PER_BAR }, (_, i) => i % 4 === 2 && rng.chance(0.7));

  const pads: number[][] = [];
  const bass: (number | null)[] = [];
  const arp: (number | null)[] = [];
  const kick: boolean[] = [];
  const snare: boolean[] = [];
  const hat: boolean[] = [];
  chords.forEach((chord, bar) => {
    pads.push([0, 2, 4].map((i) => note(chord + i) + 12));
    let arpIndex = 0;
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      const eighth = step / 2;
      const onBass = step % 2 === 0 && bassRhythm[eighth] === 1;
      // Root, an octave up on the off-beat of beat 3, the fifth below to lead into the next bar.
      const bassNote = eighth === 7 ? note(chord + 4) - 12 : note(chord) + (eighth === 5 ? 12 : 0);
      bass.push(onBass ? bassNote : null);
      arp.push(bar >= arpFromBar && arpMask[step] ? note(chord + arpShape[arpIndex++ % arpShape.length]) + 24 : null);
      kick.push(step === 0 || step === 8 || (extraKick && step === 10));
      snare.push(step === 4 || step === 12);
      hat.push(hatMask[step]);
    }
  });
  return { bpm, mode, scale, root, chords, pads, bass, arp, kick, snare, hat };
}

/**
 * Reverb impulse response: decaying noise (-60 dB at `seconds`) that darkens over time, like a
 * large room absorbing highs first. `random` makes it deterministic in tests.
 */
export function fillImpulse(data: Float32Array, sampleRate: number, seconds: number, random: () => number = Math.random): void {
  let low = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const white = random() * 2 - 1;
    // One-pole lowpass whose cutoff falls along the tail.
    const k = Math.max(0.04, 1 - t / seconds);
    low += k * (white - low);
    data[i] = low * Math.exp((-6.9 * t) / seconds) * (i < sampleRate * 0.01 ? i / (sampleRate * 0.01) : 1);
  }
}

function impulseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) fillImpulse(buffer.getChannelData(c), ctx.sampleRate, seconds);
  return buffer;
}

const midiToHz = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** Plays a pattern in a loop with a look-ahead scheduler, through a feedback delay and two reverbs. */
export class DarkwavePlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private readonly master: GainNode;
  /** Dry sum. */
  private readonly bus: GainNode;
  private readonly verbSend: GainNode;
  private readonly delaySend: GainNode;
  /** Snare reverb, chopped by this gate (the gated-reverb snare). */
  private readonly snareVerb: ConvolverNode;
  private readonly gate: GainNode;

  constructor(
    private readonly ctx: AudioContext,
    output: AudioNode,
    private readonly pattern: Pattern,
  ) {
    this.master = ctx.createGain();
    this.master.gain.value = 0.42;
    this.master.connect(output);
    this.bus = ctx.createGain();
    this.bus.connect(this.master);

    // Long hall.
    this.verbSend = ctx.createGain();
    const verb = ctx.createConvolver();
    verb.buffer = impulseBuffer(ctx, 3.2);
    const verbReturn = ctx.createGain();
    verbReturn.gain.value = 0.55;
    this.verbSend.connect(verb).connect(verbReturn).connect(this.master);

    // Dotted-8th feedback delay, darkening at each repeat, feeding the hall a little.
    this.delaySend = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = (60 / pattern.bpm) * 0.75;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.42;
    this.delaySend.connect(delay).connect(tone).connect(feedback).connect(delay);
    const delayReturn = ctx.createGain();
    delayReturn.gain.value = 0.5;
    tone.connect(delayReturn).connect(this.master);
    delayReturn.connect(this.verbSend);

    this.snareVerb = ctx.createConvolver();
    this.snareVerb.buffer = impulseBuffer(ctx, 1.4);
    this.gate = ctx.createGain();
    this.gate.gain.value = 0;
    this.snareVerb.connect(this.gate).connect(this.master);
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
    this.master.disconnect();
  }

  private schedule(): void {
    const secondsPerStep = 60 / this.pattern.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const p = this.pattern;
      const i = this.step % p.bass.length;
      const t = this.nextTime;
      if (i % STEPS_PER_BAR === 0) this.pad(t, p.pads[Math.floor(i / STEPS_PER_BAR)], secondsPerStep * STEPS_PER_BAR);
      const b = p.bass[i];
      if (b !== null) this.bass(t, b, secondsPerStep * 1.7);
      const a = p.arp[i];
      if (a !== null) this.arp(t, a, secondsPerStep * 1.5);
      if (p.kick[i]) this.kick(t);
      if (p.snare[i]) this.snare(t);
      if (p.hat[i]) this.hat(t);
      this.nextTime += secondsPerStep;
      this.step++;
    }
  }

  /** Connects a voice to the dry bus and the effect sends. */
  private route(node: AudioNode, dry: number, verb: number, echo = 0): void {
    const send = (target: AudioNode, level: number) => {
      if (level <= 0) return;
      const g = this.ctx.createGain();
      g.gain.value = level;
      node.connect(g).connect(target);
    };
    send(this.bus, dry);
    send(this.verbSend, verb);
    send(this.delaySend, echo);
  }

  /** Chorused saw bass: two detuned saws and a sine sub, with a plucky filter envelope. */
  private bass(t: number, note: number, length: number): void {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(950, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + length * 0.8);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    filter.connect(gain);
    this.route(gain, 1, 0.05);
    for (const [type, semis, detune, level] of [['sawtooth', 0, -11, 0.5], ['sawtooth', 0, 11, 0.5], ['sine', -12, 0, 0.7]] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = midiToHz(note + semis);
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(filter);
      osc.start(t);
      osc.stop(t + length + 0.05);
    }
  }

  /** Slow pad: detuned saws per chord note, long attack and a release that overlaps the next bar. */
  private pad(t: number, notes: number[], length: number): void {
    const ctx = this.ctx;
    const release = length * 0.9;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.5;
    filter.frequency.setValueAtTime(350, t);
    filter.frequency.linearRampToValueAtTime(1200, t + length * 0.6);
    filter.frequency.linearRampToValueAtTime(500, t + length + release);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + length * 0.4);
    gain.gain.setValueAtTime(0.05, t + length);
    gain.gain.linearRampToValueAtTime(0, t + length + release);
    filter.connect(gain);
    this.route(gain, 0.6, 0.9);
    for (const n of notes) {
      for (const detune of [-14, 9]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiToHz(n);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + length + release + 0.05);
      }
    }
  }

  /** Glassy arpeggio note, mostly heard through the delay and the hall. */
  private arp(t: number, note: number, length: number): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midiToHz(note);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(filter).connect(gain);
    this.route(gain, 0.7, 0.5, 0.6);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  private kick(t: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.15);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(gain);
    this.route(gain, 1, 0.04);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  /** Snare: noise burst plus body, into a big reverb that the gate chops off (80s gated snare). */
  private snare(t: number): void {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, 'white');
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    noise.connect(filter).connect(gain);
    const body = ctx.createOscillator();
    body.frequency.setValueAtTime(200, t);
    body.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.25, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    body.connect(bodyGain);
    for (const node of [gain, bodyGain]) {
      this.route(node, 0.8, 0.15);
      node.connect(this.snareVerb);
    }
    noise.start(t, Math.random() * 1.7, 0.25);
    body.start(t);
    body.stop(t + 0.14);
    // Gate open for ~a quarter second, then slammed shut.
    this.gate.gain.setValueAtTime(0.9, t);
    this.gate.gain.setValueAtTime(0.9, t + 0.24);
    this.gate.gain.linearRampToValueAtTime(0, t + 0.28);
  }

  private hat(t: number): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 'white');
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(filter).connect(gain);
    this.route(gain, 1, 0.2);
    src.start(t, Math.random() * 1.9, 0.05);
  }
}

/** The radio's player predates the darkwave station. */
export { DarkwavePlayer as SynthwavePlayer };
