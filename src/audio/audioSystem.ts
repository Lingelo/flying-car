import * as THREE from 'three';
import type { CarState } from '../vehicle/controller';
import { Ambience } from './ambience';
import { EngineSound } from './engine';
import { AudioTrackPlayer, GENERATED_TRACKS, loadManifest, Radio } from './radio';
import { TrafficVoices, type Emitter } from './trafficVoices';

/**
 * All the sound of the game. Browsers only allow audio after a user gesture: the context is
 * resumed on the first key press or click (KTD11).
 */
export class AudioSystem {
  readonly listener = new THREE.AudioListener();
  readonly radio: Radio;
  private readonly engine: EngineSound;
  private readonly ambience: Ambience;
  private readonly voices: TrafficVoices;
  private readonly radioGain: GainNode;

  constructor(camera: THREE.Camera) {
    camera.add(this.listener);
    const ctx = this.listener.context;
    const master = this.listener.getInput();
    this.engine = new EngineSound(ctx, master);
    this.ambience = new Ambience(ctx, master);
    this.voices = new TrafficVoices(ctx, master);
    this.radioGain = ctx.createGain();
    this.radioGain.gain.value = 0.55;
    this.radioGain.connect(master);
    this.radio = new Radio(GENERATED_TRACKS, new AudioTrackPlayer(ctx, this.radioGain));
    void loadManifest(import.meta.env.BASE_URL).then((extra) => {
      if (extra.length) this.radio.appendTracks(extra);
    });

    const resume = () => {
      if (ctx.state !== 'running') void ctx.resume();
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
  }

  setVolume(master: number, music: number): void {
    this.listener.setMasterVolume(master);
    this.radioGain.gain.value = music;
  }

  /** Thunder of a lightning strike (see Lightning). */
  thunder(delay: number, loudness: number): void {
    this.ambience.thunder(delay, loudness);
  }

  update(car: CarState, throttle: number, boost: boolean, rain: number, traffic: (Emitter & { air: boolean })[], dt: number): void {
    if (this.listener.context.state !== 'running') return;
    const speed = Math.hypot(car.velocity.x, car.velocity.z);
    this.engine.update({ speed, throttle, deploy: car.deploy, boost });
    this.ambience.update({ altitude: car.position.y, speed, rain });
    this.voices.update(traffic, car.position, dt);
  }
}
