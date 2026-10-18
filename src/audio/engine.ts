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
  turbineFreq: number;
  turbineGain: number;
}

/** Electric motor whine on the ground, thruster roar in flight. */
export function engineParams({ speed, throttle, deploy, boost }: EngineInput): EngineParams {
  const t = Math.abs(throttle);
  return {
    motorFreq: (60 + speed * 5.5) * (boost ? 1.15 : 1),
    motorGain: (0.12 + 0.3 * t) * (1 - 0.7 * deploy),
    turbineFreq: 180 + speed * 3 + t * 120 + (boost ? 150 : 0),
    turbineGain: deploy * (0.18 + 0.3 * t + (boost ? 0.15 : 0)),
  };
}

/** Synthesized car sound: two detuned oscillators for the motor, filtered noise for the thrusters. */
export class EngineSound {
  private readonly motorA: OscillatorNode;
  private readonly motorB: OscillatorNode;
  private readonly motorGain: GainNode;
  private readonly turbineFilter: BiquadFilterNode;
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

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, 'white');
    noise.loop = true;
    this.turbineFilter = ctx.createBiquadFilter();
    this.turbineFilter.type = 'bandpass';
    this.turbineFilter.Q.value = 2.5;
    this.turbineGain = ctx.createGain();
    this.turbineGain.gain.value = 0;
    noise.connect(this.turbineFilter).connect(this.turbineGain).connect(output);

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
    this.turbineFilter.frequency.setTargetAtTime(p.turbineFreq, now, 0.08);
    this.turbineGain.gain.setTargetAtTime(p.turbineGain, now, 0.1);
  }
}
