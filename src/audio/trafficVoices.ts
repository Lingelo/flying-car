import { noiseBuffer } from './noise';

export interface Emitter {
  id: number;
  x: number;
  y: number;
  z: number;
}

type Point = { x: number; y: number; z: number };
const SPEED_OF_SOUND = 343;

/**
 * Gives the voices to the closest emitters. A voice stays on its vehicle while that vehicle is
 * still among the closest, so sounds do not jump from car to car.
 */
export function assignVoices(previous: (number | null)[], emitters: Emitter[], listener: Point): (number | null)[] {
  const n = previous.length;
  const d2 = (e: Emitter) => (e.x - listener.x) ** 2 + (e.y - listener.y) ** 2 + (e.z - listener.z) ** 2;
  const nearest = [...emitters].sort((a, b) => d2(a) - d2(b)).slice(0, n);
  const wanted = new Set(nearest.map((e) => e.id));
  const next = previous.map((id) => (id !== null && wanted.has(id) ? id : null));
  const taken = new Set(next.filter((id) => id !== null));
  for (const e of nearest) {
    if (taken.has(e.id)) continue;
    const free = next.indexOf(null);
    if (free < 0) break;
    next[free] = e.id;
    taken.add(e.id);
  }
  return next;
}

/** Pitch factor for a source closing in at `radialSpeed` m/s (negative when moving away). */
export function dopplerFactor(radialSpeed: number): number {
  return Math.min(2, Math.max(0.5, SPEED_OF_SOUND / (SPEED_OF_SOUND - radialSpeed)));
}

interface Voice {
  panner: PannerNode;
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  last: Point | null;
}

/** A small pool of positional hums/whooshes following the nearest vehicles. */
export class TrafficVoices {
  private readonly voices: Voice[] = [];
  private assigned: (number | null)[];

  constructor(private readonly ctx: AudioContext, output: AudioNode, count = 8) {
    this.assigned = new Array(count).fill(null);
    for (let i = 0; i < count; i++) {
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 8;
      panner.rolloffFactor = 1.4;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(ctx, 'pink'); // softer than white: a whoosh, not a hiss
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.2;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.05;
      osc.connect(oscGain).connect(filter);
      noise.connect(filter);
      filter.connect(gain).connect(panner).connect(output);
      osc.start();
      noise.start(0, Math.random() * 1.5);
      this.voices.push({ panner, osc, filter, gain, last: null });
    }
  }

  update(emitters: (Emitter & { air: boolean })[], listener: Point, dt: number): void {
    this.assigned = assignVoices(this.assigned, emitters, listener);
    const byId = new Map(emitters.map((e) => [e.id, e]));
    const now = this.ctx.currentTime;
    this.assigned.forEach((id, i) => {
      const voice = this.voices[i];
      const e = id === null ? undefined : byId.get(id);
      if (!e) {
        voice.gain.gain.setTargetAtTime(0, now, 0.2);
        voice.last = null;
        return;
      }
      voice.panner.positionX.setTargetAtTime(e.x, now, 0.02);
      voice.panner.positionY.setTargetAtTime(e.y, now, 0.02);
      voice.panner.positionZ.setTargetAtTime(e.z, now, 0.02);
      // Doppler from the change of distance since the last frame.
      const dist = Math.hypot(e.x - listener.x, e.y - listener.y, e.z - listener.z);
      const lastDist = voice.last ? Math.hypot(voice.last.x - listener.x, voice.last.y - listener.y, voice.last.z - listener.z) : dist;
      const radial = dt > 0 ? (lastDist - dist) / dt : 0;
      voice.last = { x: e.x, y: e.y, z: e.z };
      const doppler = dopplerFactor(Math.max(-80, Math.min(80, radial)));
      const base = e.air ? 260 : 120;
      voice.osc.frequency.setTargetAtTime(base * doppler, now, 0.05);
      voice.filter.frequency.setTargetAtTime((e.air ? 900 : 500) * doppler, now, 0.05);
      voice.gain.gain.setTargetAtTime(e.air ? 0.5 : 0.35, now, 0.2);
    });
  }
}
