import * as THREE from 'three';
import { createLoop } from './core/loop';
import { parseSeed } from './core/seed';
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
const fogColor = new THREE.Color(0x0b0716);
scene.background = fogColor;
scene.fog = new THREE.FogExp2(fogColor, 0.0016);
const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.3, 3000);

scene.add(new THREE.HemisphereLight(0x4a3a8a, 0x0a0610, 0.9));
const moon = new THREE.DirectionalLight(0x8fa8ff, 0.6);
moon.position.set(-300, 500, 200);
scene.add(moon);

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

const game = await createGame(scene, renderer.domElement, parseSeed(location.search));

// Provisional chase camera, replaced by the camera rig (U11).
const camTarget = new THREE.Vector3();
let t = 0;
createLoop(
  (dt) => {
    t += dt;
    cityUniforms.uTime.value = t;
    game.step(dt);
  },
  () => {
    game.frame();
    const s = game.car.state;
    const f = game.car.forward();
    camera.position.lerp(new THREE.Vector3(s.position.x - f.x * 9, s.position.y + 3.2, s.position.z - f.z * 9), 0.15);
    camTarget.set(s.position.x + f.x * 6, s.position.y + 1, s.position.z + f.z * 6);
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
  },
).start();
