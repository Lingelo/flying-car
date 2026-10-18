import { WEATHER_LABELS, type WeatherKind } from '../atmosphere/weather';
import { CAMERA_LABELS, type CameraMode } from '../camera/rig';
import type { Chunk } from '../city/generator';
import type { Bindings } from '../input/bindings';
import type { CarState } from '../vehicle/controller';
import { keyLabel } from './keys';
import { Minimap } from './minimap';
import './hud.css';

const MODE_LABELS: Record<CarState['mode'], string> = { ground: 'SOL', takeoff: 'DÉCOLLAGE', flight: 'VOL', landing: 'ATTERRISSAGE' };

export interface HudData {
  car: CarState;
  hour: number;
  weather: WeatherKind;
  camera: CameraMode;
  radio: string | null;
  chunks: Iterable<Chunk>;
  traffic: { x: number; y: number; z: number; air: boolean }[];
}

const pad = (n: number) => String(n).padStart(2, '0');
export const formatHour = (hour: number) => `${pad(Math.floor(hour))}:${pad(Math.floor((hour % 1) * 60))}`;

/** Speed, altitude, mode, clock, weather, camera, radio and minimap overlay (R22). */
export class Hud {
  readonly root = document.createElement('div');
  private readonly speed: HTMLElement;
  private readonly altitude: HTMLElement;
  private readonly mode: HTMLElement;
  private readonly time: HTMLElement;
  private readonly weather: HTMLElement;
  private readonly camera: HTMLElement;
  private readonly radio: HTMLElement;
  private readonly help: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly minimap = new Minimap();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly photoHint = document.createElement('div');
  visible = true;

  constructor(parent: HTMLElement, bindings: Bindings) {
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-panel hud-speed">
        <span class="value" data-speed>0</span><span class="unit">KM/H</span>
        <div class="hud-row"><span>ALTITUDE</span><b data-alt>0 m</b></div>
        <div class="hud-mode" data-mode>SOL</div>
      </div>
      <div class="hud-panel hud-env">
        <span class="time" data-time>00:00</span>
        <span class="line" data-weather></span>
        <span class="line" data-camera></span>
      </div>
      <div class="hud-radio" data-radio></div>
      <div class="hud-map" data-map></div>
      <div class="hud-help" data-help></div>
      <div class="hud-toast" data-toast></div>`;
    const q = (k: string) => this.root.querySelector<HTMLElement>(`[data-${k}]`)!;
    this.speed = q('speed');
    this.altitude = q('alt');
    this.mode = q('mode');
    this.time = q('time');
    this.weather = q('weather');
    this.camera = q('camera');
    this.radio = q('radio');
    this.help = q('help');
    this.toast = q('toast');
    q('map').appendChild(this.minimap.canvas);
    this.setBindings(bindings);
    parent.appendChild(this.root);
    this.photoHint.className = 'hud-photo';
    this.photoHint.textContent = 'MODE PHOTO · souris : tourner autour · molette / W S : zoom · Entrée : capturer · P : quitter';
    parent.appendChild(this.photoHint);
    setTimeout(() => this.help.classList.add('faded'), 14000);
  }

  setBindings(b: Bindings): void {
    const k = (codes: string[]) => `<kbd>${keyLabel(codes[0])}</kbd>`;
    this.help.innerHTML =
      `${k(b.forward)}${k(b.left)}${k(b.back)}${k(b.right)} conduire · ${k(b.toggleFlight)} décoller / atterrir · ` +
      `${k(b.up)}${k(b.down)} monter / descendre · ${k(b.boost)} boost<br>` +
      `${k(b.camera)} caméra · ${k(b.radio)} radio · ${k(b.radioNext)} piste suivante · ${k(b.photo)} photo · ` +
      `${k(b.hud)} HUD · ${k(b.menu)} menu · clic : regarder à la souris`;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.classList.toggle('hidden', !this.visible);
  }

  setHidden(hidden: boolean): void {
    this.root.classList.toggle('hidden', hidden || !this.visible);
  }

  setPhotoHint(visible: boolean): void {
    this.photoHint.classList.toggle('show', visible);
  }

  flash(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove('show'), 1600);
  }

  update(d: HudData, now: number): void {
    if (!this.visible) return;
    const s = d.car;
    this.speed.textContent = String(Math.round(Math.hypot(s.velocity.x, s.velocity.z) * 3.6));
    this.altitude.textContent = `${Math.round(s.position.y)} m`;
    this.mode.textContent = MODE_LABELS[s.mode];
    this.mode.classList.toggle('air', s.mode !== 'ground');
    this.time.textContent = formatHour(d.hour);
    this.weather.textContent = WEATHER_LABELS[d.weather];
    this.camera.textContent = `Caméra ${CAMERA_LABELS[d.camera].toLowerCase()}`;
    this.radio.textContent = d.radio ? `♪ ${d.radio}` : '';
    this.radio.classList.toggle('on', !!d.radio);
    this.minimap.draw(now, { x: s.position.x, z: s.position.z, yaw: s.yaw, y: s.position.y }, d.chunks, d.traffic);
  }
}
