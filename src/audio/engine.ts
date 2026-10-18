import { noiseBuffer } from './noise';

export interface EngineInput {
  /** Horizontal speed (m/s). */
  speed: number;
  throttle: number;
  /** Thruster deployment: 0 wheels, 1 flight. */
  deploy: number;
  boost: boolean;
}

export interface EngineParams {
  motorFreq: number;
  motorGain: number;
  /** Fundamental of the thruster turbine hum (Hz): deep, rising with throttle, speed and boost. */
  turbineFreq: number;
  turbineGain: number;
}

/** Electric motor whine on the ground, deep turbine hum in flight. */
export function engineParams({ speed, throttle, deploy, boost }: EngineInput): EngineParams {
  const t = Math.abs(throttle);
  return {
    motorFreq: (60 + speed * 5.5) * (boost ? 1.15 : 1),
    motorGain: (0.12 + 0.3 * t) * (1 - 0.7 * deploy),
    turbineFreq: 38 + Math.min(80, Math.max(0, speed)) * 0.3 + t * 22 + (boost ? 16 : 0),
    turbineGain: deploy * (0.18 + 0.3 * t + (boost ? 0.15 : 0)),
  };
}

/**
 * Synthesized car sound: two detuned oscillators for the motor; in flight, a turbine made of
 * slightly detuned low oscillators with a soft rumble (lowpassed brown noise) and a faint shaft whine.
 */
export class EngineSound {
  private readonly motorA: OscillatorNode;
  private readonly motorB: OscillatorNode;
  private readonly motorGain: GainNode;
  /** Turbine oscillators and their frequency ratio to the fundamental. */
  private readonly turbine: { osc: OscillatorNode; ratio: number }[] = [];
  private readonly turbineFilter: BiquadFilterNode;
  private readonly rumbleFilter: BiquadFilterNode;
  private readonly turbineGain: GainNode;

  constructor(private readonly ctx: AudioContext, output: AudioNode) {
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = 'lowpass';
    motorFilter.frequency.value = 1800;
    this.motorA = ctx.createOscillator();
    this.motorA.type = 'sawtooth';
    this.motorB = ctx.createOscillator();
    this.motorB.type = 'triangle';
    this.motorA.connect(motorFilter);
    this.motorB.connect(motorFilter);
    motorFilter.connect(this.motorGain).connect(output);

    this.turbineGain = ctx.createGain();
    this.turbineGain.gain.value = 0;
    this.turbineGain.connect(output);
    this.turbineFilter = ctx.createBiquadFilter();
    this.turbineFilter.type = 'lowpass';
    this.turbineFilter.Q.value = 0.9;
    this.turbineFilter.connect(this.turbineGain);
    const voices: [OscillatorType, number, number][] = [
      // type, frequency ratio, level
      ['sawtooth', 1, 0.35],
      ['sawtooth', 1.006, 0.35], // slow beating against the first: the "thrum"
      ['triangle', 0.5, 0.5], // sub
      ['sine', 2.01, 0.15],
      ['sine', 11.3, 0.025], // faint shaft whine
    ];
    for (const [type, ratio, level] of voices) {
      const osc = ctx.createOscillator();
      osc.type = type;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(ratio > 4 ? this.turbineGain : this.turbineFilter);
      osc.start();
      this.turbine.push({ osc, ratio });
    }
    // Soft air rumble under the tones, kept low and dark (no hiss).
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, 'brown');
    noise.loop = true;
    this.rumbleFilter = ctx.createBiquadFilter();
    this.rumbleFilter.type = 'lowpass';
    this.rumbleFilter.frequency.value = 220;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.6;
    noise.connect(this.rumbleFilter).connect(rumbleGain).connect(this.turbineGain);

    this.motorA.start();
    this.motorB.start();
    noise.start();
  }

  update(input: EngineInput): void {
    const p = engineParams(input);
    const now = this.ctx.currentTime;
    this.motorA.frequency.setTargetAtTime(p.motorFreq, now, 0.05);
    this.motorB.frequency.setTargetAtTime(p.motorFreq * 2.01, now, 0.05);
    this.motorGain.gain.setTargetAtTime(p.motorGain * 0.35, now, 0.08);
    // Turbines spool: pitch follows with some inertia.
    for (const { osc, ratio } of this.turbine) osc.frequency.setTargetAtTime(p.turbineFreq * ratio, now, 0.25);
    this.turbineFilter.frequency.setTargetAtTime(p.turbineFreq * 5, now, 0.25);
    this.rumbleFilter.frequency.setTargetAtTime(160 + p.turbineFreq * 2, now, 0.25);
    this.turbineGain.gain.setTargetAtTime(p.turbineGain * 0.7, now, 0.15);
  }
}
