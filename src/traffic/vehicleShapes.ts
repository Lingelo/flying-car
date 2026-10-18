import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const colored = (g: THREE.BufferGeometry, color: THREE.Color) => {
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) color.toArray(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g.index ? g.toNonIndexed() : g;
};

const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.Color) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return colored(g, color);
};

const WHITE = new THREE.Color(1.8, 1.9, 2.2);
const RED = new THREE.Color(2.4, 0.08, 0.15);

/** Body and light geometries for each vehicle type (front towards +z, base at y = 0). */
export function vehicleShapes(): { body: THREE.BufferGeometry; lights: THREE.BufferGeometry }[] {
  const shapes = [
    // Hover sedan.
    { length: 4.6, width: 1.9, height: 1.25, cabin: [0.75, 1.15, 0.45] },
    // Cargo van.
    { length: 7.2, width: 2.3, height: 2.6, cabin: [0.9, 0.35, 1.0] },
    // Racer: low and wide.
    { length: 4.2, width: 2.0, height: 0.95, cabin: [0.55, 0.9, 0.35] },
  ];
  return shapes.map(({ length, width, height, cabin }) => {
    const lower = new RoundedBoxGeometry(width, height * 0.55, length, 3, 0.25);
    lower.translate(0, height * 0.3 + 0.25, 0);
    const top = new RoundedBoxGeometry(width * cabin[0], height * 0.5, length * cabin[1] * 0.55, 3, 0.2);
    top.translate(0, height * 0.55 + 0.25 + height * 0.2, -length * 0.05);
    const white = new THREE.Color(1, 1, 1);
    const body = mergeGeometries([colored(lower, white), colored(top, new THREE.Color(0.15, 0.17, 0.2))]);
    const lights = mergeGeometries([
      box(width * 0.8, 0.06, 0.05, 0, height * 0.42 + 0.25, length / 2 + 0.01, WHITE),
      box(width * 0.85, 0.08, 0.05, 0, height * 0.5 + 0.25, -length / 2 - 0.01, RED),
    ]);
    return { body, lights };
  });
}
