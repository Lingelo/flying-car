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
      // Real tracks first: the station opens on synthwave, the generated darkwave follows.
      this.radio.prependTracks(extra);
    });

    // Browsers only allow sound after a gesture: the first click or key also switches the radio
    // on (unless that key is the radio key itself, which then does it).
    let radioStarted = false;
    const resume = (e: Event) => {
      if (ctx.state !== 'running') void ctx.resume();
      if (!radioStarted) {
        radioStarted = true;
        if (this.radio.status === 'off' && !this.isRadioKey((e as KeyboardEvent).code ?? '')) this.radio.toggle();
      }
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
  }

  /** The current radio key(s), set by the game: that key turns the radio on itself. */
  isRadioKey: (code: string) => boolean = (code) => code === 'KeyM';

  setVolume(master: number, music: number): void {
    this.listener.setMasterVolume(master);
    this.radioGain.gain.value = music;
  }

  /** Share of the rain drop impacts to play (follows the rain quality). */
  setRainDensity(share: number): void {
    this.ambience.dropDensity = share;
  }

  /** Thunder of a lightning strike (see Lightning). */
  thunder(delay: number, loudness: number): void {
    // Before the first gesture the context is suspended and its clock stopped: strikes queued
    // then would all roar at once on resume. A strike nobody could hear stays silent.
    if (this.listener.context.state !== 'running') return;
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
