import * as THREE from 'three';
import { Environment } from './atmosphere/environment';
import { Rain } from './atmosphere/rain';
import { AudioSystem } from './audio/audioSystem';
import { SkyRig } from './atmosphere/sky';
import { canvasToPngBlob, downloadBlob, PhotoMode } from './camera/photoMode';
import { CameraRig } from './camera/rig';
import { Benchmark } from './core/bench';
import { createLoop } from './core/loop';
import { parseSeed } from './core/seed';
import { createGame, safeLocalStorage, type Game } from './game';
import { installHeightFog } from './render/fog';
import { cityUniforms } from './render/materials/cityUniforms';
import { RenderPipeline } from './render/pipeline';
import { saveBindings } from './input/bindings';
import { QUALITY, QUALITY_NAMES, type QualityName } from './settings/quality';
import { loadSettings, saveSettings, type Settings } from './settings/store';
import { Hud } from './ui/hud';
import { SettingsMenu } from './ui/settingsMenu';

installHeightFog();

const params = new URLSearchParams(location.search);
const container = document.getElementById('app')!;
const scene = new THREE.Scene();
const fog = new THREE.FogExp2(0x0b0716, 0.0016);
scene.fog = fog;
const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.3, 3000);

const seed = parseSeed(location.search);
const environment = new Environment(seed);
const hourParam = Number(params.get('hour'));
const weatherParam = params.get('weather');

const sky = new SkyRig(scene);
const rain = new Rain();
scene.add(rain.mesh);
const pipeline = new RenderPipeline(container, scene, camera, sky.sun);

window.addEventListener('resize', () => pipeline.resize(container.clientWidth, container.clientHeight));

const game = await createGame(scene, pipeline.renderer.domElement, seed);

const rig = new CameraRig(camera, game.world);
const audio = new AudioSystem(camera);

let quality: QualityName = 'high';
function applyQuality(name: QualityName, target: Game = game): void {
  quality = name;
  const q = QUALITY[name];
  pipeline.setQuality(name);
  target.streamer.setRadius(q.ringRadius, q.lodRadius);
  target.traffic.setMaxVehicles(q.traffic);
}

const storage = safeLocalStorage();
let settings: Settings = loadSettings(storage);
let qualityApplied = false;
function applySettings(next: Settings): void {
  settings = next;
  if (next.quality !== quality || !qualityApplied) applyQuality(next.quality);
  qualityApplied = true;
  environment.autoTime = next.hour === null;
  if (next.hour !== null) environment.hour = next.hour;
  environment.weather.force(next.weather);
  audio.setVolume(next.masterVolume, next.musicVolume);
}
applySettings(settings);
// URL parameters override the saved settings (handy for tests and sharing a view).
const qualityParam = params.get('quality') as QualityName | null;
if (qualityParam && QUALITY_NAMES.includes(qualityParam)) applyQuality(qualityParam);
if (params.has('hour') && Number.isFinite(hourParam)) {
  environment.hour = ((hourParam % 24) + 24) % 24;
  environment.autoTime = false;
}
if (weatherParam === 'clear' || weatherParam === 'haze' || weatherParam === 'rain') environment.weather.force(weatherParam);

const hud = new Hud(document.body, game.input.bindings);
let paused = false;
const menu = new SettingsMenu(document.body, settings, game.input.bindings, game.keyboard, {
  onSettings(next) {
    applySettings(next);
    saveSettings(next, storage);
  },
  onBindings(bindings) {
    game.input.bindings = bindings;
    saveBindings(bindings, storage);
    hud.setBindings(bindings);
  },
  onClose() {
    paused = false;
  },
});
const photo = new PhotoMode(camera, {
  setPaused: (p) => (paused = p),
  setHudHidden: (hidden) => {
    hud.setHidden(hidden);
    hud.setPhotoHint(hidden);
  },
  renderFrame: () => pipeline.render(0),
  toBlob: (cb) => cb(canvasToPngBlob(pipeline.renderer.domElement)),
  download: (blob, name) => {
    downloadBlob(blob, name);
    hud.flash('PHOTO ENREGISTRÉE');
  },
});
let wheel = 0;
window.addEventListener('wheel', (e) => (wheel += Math.sign(e.deltaY)), { passive: true });

function openMenu(): void {
  menu.liveHour = environment.hour;
  paused = true;
  menu.open();
}
// Leaving mouse look with Escape opens the menu, like most games.
let menuReleasedLock = false;
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && !menu.isOpen && !menuReleasedLock) openMenu();
  menuReleasedLock = false;
});

let frames = 0;
let bench: Benchmark | null = null;
if (params.has('bench')) {
  const gl = pipeline.renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'GPU inconnu';
  bench = new Benchmark(game, environment, () => quality, gpu);
}

let t = 0;
let last = performance.now();
const focus = new THREE.Vector3();
createLoop(
  (dt) => {
    if (paused) return;
    t += dt;
    cityUniforms.uTime.value = t;
    environment.update(dt);
    game.step(dt);
  },
  () => {
    const now = performance.now();
    const frameDt = Math.min(0.1, (now - last) / 1000);
    last = now;
    frames++;
    bench?.frame(frameDt);
    game.frame();
    if (menu.isOpen) {
      if (game.input.pressed('menu')) menu.close();
      pipeline.render(frameDt);
      return;
    }
    if (game.input.pressed('menu')) {
      menuReleasedLock = !!document.pointerLockElement;
      openMenu();
    }
    if (game.input.pressed('photo')) {
      if (photo.active) photo.exit();
      else photo.enter(game.car.state);
    }
    if (photo.active) {
      photo.update(game.input.look, wheel - game.input.axes.throttle * frameDt * 12);
      wheel = 0;
      if (game.input.pressed('capture')) photo.capture();
      pipeline.render(frameDt);
      return;
    }
    if (game.input.pressed('hud')) hud.toggle();
    if (game.input.pressed('camera')) {
      rig.next();
      hud.flash(`CAMÉRA ${rig.mode === 'chase' ? 'POURSUITE' : rig.mode === 'cockpit' ? 'COCKPIT' : 'CINÉMATIQUE'}`);
    }
    rig.update(frameDt, game.car.state, game.input.look);

    const p = game.car.state.position;
    focus.set(p.x, p.y, p.z);
    sky.update(environment, focus, camera, fog);
    const w = environment.weather.state;
    fog.density = w.fog;
    sky.setCloudiness(w.cloudiness);
    sky.sun.intensity *= 1 - 0.75 * w.cloudiness;
    cityUniforms.uWetness.value = w.wetness;
    cityUniforms.uRain.value = w.rain;
    rain.update(camera, w.rain, QUALITY[quality].rain);

    if (game.input.pressed('radio')) {
      audio.radio.toggle();
      hud.flash(audio.radio.status === 'on' ? 'RADIO ON' : audio.radio.status === 'off' ? 'RADIO OFF' : 'AUCUNE PISTE');
    }
    if (game.input.pressed('radioNext')) audio.radio.next();
    const emitters = game.traffic.vehicles.map((v) => ({ id: v.id, ...game.traffic.position(v), air: v.lane.kind === 'air' }));
    audio.update(game.car.state, game.input.axes.throttle, game.input.isHeld('boost'), w.rain, emitters, frameDt);
    const track = audio.radio.status === 'on' ? audio.radio.current : null;
    hud.update(
      {
        car: game.car.state,
        hour: environment.hour,
        weather: environment.weather.kind,
        camera: rig.mode,
        radio: track ? `${track.title} — ${track.artist}` : null,
        chunks: [...game.streamer.active.values()].map((e) => e.chunk.chunk),
        traffic: emitters,
      },
      now,
    );
    pipeline.update(sky.dome, environment.hour, w.cloudiness, cityUniforms.uNight.value, focus);
    pipeline.render(frameDt);
  },
).start();

// Diagnostics for automated browser tests only (?debug=1).
if (params.has('debug')) {
  Object.defineProperty(window, '__debug', {
    get: () => ({ frames, activeChunks: game.streamer.active.size, pooled: game.city.pooled, mode: game.car.state.mode, paused }),
  });
  Object.assign(window, { __game: game, __rig: rig, __env: environment, __pipeline: pipeline, __applyQuality: applyQuality, __audio: audio, __hud: hud, __menu: menu, __photo: photo });
}
