import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { extrudeProfile, wheelWell, type ProfilePoint, type Warp } from '../vehicle/bodyKit';

type Rgb = [number, number, number];

/** Vertex colours: paint is white so each instance's colour tints it; the rest stays dark. */
const PAINT: Rgb = [1, 1, 1];
const GLASS: Rgb = [0.025, 0.03, 0.035];
const TRIM: Rgb = [0.05, 0.05, 0.055];
const TYRE: Rgb = [0.03, 0.03, 0.03];
const RIM: Rgb = [0.18, 0.18, 0.19];
const RIB: Rgb = [0.78, 0.78, 0.78];
const WHITE: Rgb = [1.8, 1.9, 2.2];
const RED: Rgb = [2.4, 0.08, 0.15];
const BLUE: Rgb = [0.2, 0.55, 2.6];

/** Render sizes of the simulated vehicle types (sim.ts uses the same lengths), base at y = 0. */
export const VEHICLE_TYPES = [
  { name: 'sedan', length: 4.6, width: 1.95, height: 1.5 },
  { name: 'van', length: 7.2, width: 2.3, height: 2.6 },
  { name: 'sports', length: 4.2, width: 2.0, height: 1.1 },
] as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Colours every triangle of a non-indexed geometry from its centroid and face normal. */
function paintFaces(g: THREE.BufferGeometry, colourOf: (c: THREE.Vector3, n: THREE.Vector3) => Rgb): THREE.BufferGeometry {
  const geometry = g.index ? g.toNonIndexed() : g;
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colours = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const col = colourOf(a.clone().add(b).add(c).divideScalar(3), n);
    for (let k = 0; k < 3; k++) colours.set(col, (i + k) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  if (geometry.getAttribute('uv')) geometry.deleteAttribute('uv');
  return geometry;
}

const solid = (g: THREE.BufferGeometry, colour: Rgb) => paintFaces(g, () => colour);
const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);

const box = (size: [number, number, number], at: [number, number, number], colour: Rgb) =>
  solid(new THREE.BoxGeometry(...size).translate(...at), colour);

/** A wheel (tyre and dark rim face) on the axle x, at station z. */
function wheel(x: number, z: number, radius: number, width: number): THREE.BufferGeometry[] {
  const tyre = solid(new THREE.CylinderGeometry(radius, radius, width, 20).rotateZ(Math.PI / 2).translate(x, radius, z), TYRE);
  const rim = solid(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.02, 12).rotateZ(Math.PI / 2).translate(x, radius, z), RIM);
  return [tyre, rim];
}

interface Spec {
  halfWidth: number;
  lower: ProfilePoint[];
  greenhouse?: ProfilePoint[];
  /** Greenhouse half width at the belt, and how much it narrows to the roof. */
  cabin?: { halfWidth: number; belt: number; roof: number; taper: number };
  wheels: { z: number[]; radius: number; track: number };
  /** Plan taper of the nose (from z) and tumblehome above y. */
  nose: number;
  /** Paint, glass or trim for a face of the lower body. */
  lowerColour: (c: THREE.Vector3, n: THREE.Vector3) => Rgb;
  details: THREE.BufferGeometry[];
  lights: THREE.BufferGeometry[];
}

function build(spec: Spec, length: number): { body: THREE.BufferGeometry; lights: THREE.BufferGeometry } {
  const front = length / 2;
  const warp: Warp = (x, y, z) => x * (1 - 0.14 * clamp01((z - spec.nose) / (front - spec.nose))) * (1 - 0.06 * clamp01((y - 0.5) / 0.6));
  const parts = [paintFaces(extrudeProfile(spec.lower, spec.halfWidth, warp, 0.025), spec.lowerColour)];
  if (spec.greenhouse && spec.cabin) {
    const { halfWidth, belt, roof, taper } = spec.cabin;
    const cabinWarp: Warp = (x, y, z) => warp(x, belt, z) * (1 - taper * clamp01((y - belt) / (roof - belt)));
    // Glass all round, the roof panel painted.
    parts.push(paintFaces(extrudeProfile(spec.greenhouse, halfWidth, cabinWarp, 0.02), (_, n) => (n.y > 0.85 ? PAINT : GLASS)));
  }
  for (const z of spec.wheels.z) for (const s of [-1, 1]) parts.push(...wheel(s * spec.wheels.track, z, spec.wheels.radius, 0.24));
  parts.push(...spec.details);
  return { body: mergeGeometries(parts.map(flat))!, lights: mergeGeometries(spec.lights.map(flat))! };
}

/** Flying patrol sedan: long nose, cabin bubble set back, skirts hiding the wheels, roof light bar. */
function sedan(): { body: THREE.BufferGeometry; lights: THREE.BufferGeometry } {
  const { length, width } = VEHICLE_TYPES[0];
  const hw = width / 2;
  return build(
    {
      halfWidth: hw,
      lower: [[-2.3, 0.42], [-2.2, 0.24], [2.15, 0.24], [2.3, 0.44], [2.28, 0.6], [1.6, 0.76], [0.7, 0.86], [-2.0, 0.9], [-2.3, 0.84]],
      greenhouse: [[0.72, 0.86], [0.02, 1.42], [-1.25, 1.48], [-1.95, 0.9]],
      cabin: { halfWidth: hw - 0.12, belt: 0.88, roof: 1.48, taper: 0.28 },
      wheels: { z: [1.45, -1.45], radius: 0.33, track: hw - 0.3 },
      nose: 1.3,
      lowerColour: (c) => (c.y < 0.36 ? TRIM : PAINT),
      details: [
        // Door shut lines and a chrome-less dark belt strip.
        ...[-1, 1].flatMap((s) => [box([0.012, 0.42, 0.02], [s * (hw - 0.01), 0.6, 0.55], TRIM), box([0.012, 0.42, 0.02], [s * (hw - 0.02), 0.6, -0.9], TRIM)]),
        box([0.5, 0.05, 0.16], [0, 1.5, -0.6], TRIM),
      ],
      lights: [
        box([1.4, 0.035, 0.03], [0, 0.6, 2.31], WHITE),
        box([1.55, 0.045, 0.03], [0, 0.76, -2.32], RED),
        box([0.22, 0.04, 0.12], [-0.13, 1.54, -0.6], BLUE),
        box([0.22, 0.04, 0.12], [0.13, 1.54, -0.6], RED),
      ],
    },
    length,
  );
}

/** Delivery van: sloped cab, ribbed cargo box with a sliding door, tall rear lamps. */
function van(): { body: THREE.BufferGeometry; lights: THREE.BufferGeometry } {
  const { length, width } = VEHICLE_TYPES[1];
  const hw = width / 2;
  const r = 0.42;
  return build(
    {
      halfWidth: hw,
      lower: [
        [-3.6, 0.45], [-3.5, 0.3], ...wheelWell(-2.5, r, 0.3), ...wheelWell(2.55, r, 0.3), [3.45, 0.3], [3.6, 0.5],
        [3.6, 1.0], [3.2, 1.25], [2.3, 2.45], [2.0, 2.6], [-3.55, 2.6], [-3.6, 2.5],
      ],
      wheels: { z: [2.55, -2.5], radius: r, track: hw - 0.22 },
      nose: 2.6,
      // Cab glazing: windscreen and the cab side windows.
      lowerColour: (c, n) => (c.y < 0.42 || (c.z > 1.95 && c.y > 1.35 && c.y < 2.5 && (Math.abs(n.x) > 0.6 || n.z > 0.3)) ? (c.y < 0.42 ? TRIM : GLASS) : PAINT),
      details: [
        // Vertical ribs along the cargo box and the sliding door gap.
        ...[-1, 1].flatMap((s) => [
          ...Array.from({ length: 9 }, (_, i) => box([0.03, 1.5, 0.06], [s * (hw + 0.005), 1.6, -3.2 + i * 0.6], RIB)),
          box([0.014, 1.8, 0.025], [s * (hw + 0.012), 1.4, 1.75], TRIM),
        ]),
        box([0.02, 2.0, 0.012], [0, 1.45, -3.61], TRIM),
        box([2.1, 0.12, 0.12], [0, 0.42, 3.62], TRIM),
      ],
      lights: [
        ...[-1, 1].map((s) => box([0.36, 0.14, 0.03], [s * 0.78, 0.86, 3.61], WHITE)),
        ...[-1, 1].map((s) => box([0.1, 0.7, 0.03], [s * 1.02, 1.4, -3.61], RED)),
      ],
    },
    length,
  );
}

/** Low sports car: mid-engine wedge with side intakes and a full-width rear light. */
function sports(): { body: THREE.BufferGeometry; lights: THREE.BufferGeometry } {
  const { length, width } = VEHICLE_TYPES[2];
  const hw = width / 2;
  const r = 0.33;
  return build(
    {
      halfWidth: hw,
      lower: [
        [-2.1, 0.4], [-1.95, 0.2], ...wheelWell(-1.3, r, 0.2), ...wheelWell(1.35, r, 0.2), [1.9, 0.2], [2.1, 0.32],
        [2.1, 0.44], [1.4, 0.66], [0.7, 0.76], [-2.1, 0.8],
      ],
      greenhouse: [[0.72, 0.76], [0.0, 1.1], [-0.9, 1.06], [-1.9, 0.8]],
      cabin: { halfWidth: hw - 0.14, belt: 0.78, roof: 1.1, taper: 0.32 },
      wheels: { z: [1.35, -1.3], radius: r, track: hw - 0.2 },
      nose: 1.2,
      lowerColour: (c) => (c.y < 0.3 ? TRIM : PAINT),
      details: [...[-1, 1].map((s) => box([0.02, 0.16, 0.42], [s * (hw - 0.04), 0.58, -0.75], TRIM)), box([1.4, 0.06, 0.3], [0, 0.24, -1.95], TRIM)],
      lights: [box([1.3, 0.025, 0.03], [0, 0.44, 2.11], WHITE), box([1.75, 0.04, 0.03], [0, 0.7, -2.12], RED)],
    },
    length,
  );
}

/** Body and light geometries for each vehicle type (front towards +z, base at y = 0). */
export function vehicleShapes(): { body: THREE.BufferGeometry; lights: THREE.BufferGeometry }[] {
  return [sedan(), van(), sports()];
}
