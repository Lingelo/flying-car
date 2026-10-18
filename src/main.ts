import * as THREE from 'three';
import { createLoop } from './core/loop';
import { parseSeed } from './core/seed';
import { CityView } from './city/cityView';
import { WorkerChunkSource } from './city/payload';
import { ChunkStreamer } from './city/streamer';
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
const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 1, 3000);

scene.add(new THREE.HemisphereLight(0x4a3a8a, 0x0a0610, 0.9));
const moon = new THREE.DirectionalLight(0x8fa8ff, 0.6);
moon.position.set(-300, 500, 200);
scene.add(moon);

const seed = parseSeed(location.search);
const city = new CityView();
scene.add(city.root);
const streamer = new ChunkStreamer(new WorkerChunkSource(seed), city, { radius: 5, lodRadius: 3, maxMountsPerFrame: 2, maxInFlight: 6 });

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

// Temporary scripted fly-through until the car lands (U8–U11).
let t = 0;
createLoop(
  (dt) => {
    t += dt;
    cityUniforms.uTime.value = t;
    camera.position.set(t * 40 + 40, 70 + 30 * Math.sin(t * 0.2), 52 + 20 * Math.sin(t * 0.1));
    camera.lookAt(camera.position.x + 100, 55, camera.position.z);
    streamer.update(camera.position.x, camera.position.z, 1, 0);
  },
  () => renderer.render(scene, camera),
).start();
