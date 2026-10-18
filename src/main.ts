import * as THREE from 'three';
import { createLoop } from './core/loop';
import { parseSeed } from './core/seed';
import { Environment } from './atmosphere/environment';
import { SkyRig } from './atmosphere/sky';
import { CameraRig } from './camera/rig';
import { createGame } from './game';
import { cityUniforms } from './render/materials/cityUniforms';

const container = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const fog = new THREE.FogExp2(0x0b0716, 0.0016);
scene.fog = fog;
const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.3, 3000);

const environment = new Environment();
const hourParam = Number(new URLSearchParams(location.search).get('hour'));
if (Number.isFinite(hourParam) && new URLSearchParams(location.search).has('hour')) environment.hour = ((hourParam % 24) + 24) % 24;
const sky = new SkyRig(scene);

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

const game = await createGame(scene, renderer.domElement, parseSeed(location.search));

const rig = new CameraRig(camera, game.world);
let t = 0;
let last = performance.now();
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
    sky.update(environment, new THREE.Vector3(p.x, p.y, p.z), camera, fog);
    renderer.render(scene, camera);
  },
).start();

// Diagnostics for automated browser tests only (?debug=1).
if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { __game: game, __rig: rig, __env: environment });
}
