import * as THREE from 'three';
import { Environment } from './atmosphere/environment';
import { Rain } from './atmosphere/rain';
import { AudioSystem } from './audio/audioSystem';
import { SkyRig } from './atmosphere/sky';
import { CameraRig } from './camera/rig';
import { createLoop } from './core/loop';
import { parseSeed } from './core/seed';
import { createGame, type Game } from './game';
import { installHeightFog } from './render/fog';
import { cityUniforms } from './render/materials/cityUniforms';
import { RenderPipeline } from './render/pipeline';
import { QUALITY, QUALITY_NAMES, type QualityName } from './settings/quality';

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
if (params.has('hour') && Number.isFinite(hourParam)) environment.hour = ((hourParam % 24) + 24) % 24;
const weatherParam = params.get('weather');
if (weatherParam === 'clear' || weatherParam === 'haze' || weatherParam === 'rain') environment.weather.force(weatherParam);

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
const qualityParam = params.get('quality') as QualityName | null;
applyQuality(qualityParam && QUALITY_NAMES.includes(qualityParam) ? qualityParam : 'high');

let t = 0;
let last = performance.now();
const focus = new THREE.Vector3();
createLoop(
  (dt) => {
    t += dt;
    cityUniforms.uTime.value = t;
    environment.update(dt);
    game.step(dt);
  },
  () => {
    const now = performance.now();
    const frameDt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.frame();
    if (game.input.pressed('camera')) rig.next();
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

    if (game.input.pressed('radio')) audio.radio.toggle();
    if (game.input.pressed('radioNext')) audio.radio.next();
    const emitters = game.traffic.vehicles.map((v) => ({ id: v.id, ...game.traffic.position(v), air: v.lane.kind === 'air' }));
    audio.update(game.car.state, game.input.axes.throttle, game.input.isHeld('boost'), w.rain, emitters, frameDt);
    pipeline.update(sky.dome, environment.hour, w.cloudiness, cityUniforms.uNight.value, focus);
    pipeline.render(frameDt);
  },
).start();

// Diagnostics for automated browser tests only (?debug=1).
if (params.has('debug')) {
  Object.assign(window, { __game: game, __rig: rig, __env: environment, __pipeline: pipeline, __applyQuality: applyQuality, __audio: audio });
}
