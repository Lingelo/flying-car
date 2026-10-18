import * as THREE from 'three';
import { createLoop } from './core/loop';

const container = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.5, 4000);
camera.position.set(0, 3, 10);

const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0xff2bd6 }));
scene.add(cube, new THREE.HemisphereLight(0x8899ff, 0x110022, 2));

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

createLoop(
  (dt) => {
    cube.rotation.y += dt;
  },
  () => renderer.render(scene, camera),
).start();
