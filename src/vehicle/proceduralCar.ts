import * as THREE from 'three';
import { ADDITIVE_FOG_DEFINES } from '../render/fog';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { extrudeProfile, type ProfilePoint } from './bodyKit';
import {
  buildBrakeDisc, buildCaliper, buildDiffuser, buildRim, buildSplitter, buildTyre, createCarMaterials, type CarMaterials,
} from './carParts';

/** Body length, half width and wheel layout of the procedural roadster (metres). */
export const CAR_LENGTH = 4.3;
export const WHEEL_RADIUS = 0.36;
export const WHEEL_POSITIONS: [number, number][] = [
  [0.86, 1.36],
  [-0.86, 1.36],
  [0.86, -1.3],
  [-0.86, -1.3],
];

type P = ProfilePoint;

// Side profile (z forward, y up) of an original angular coupe: low wedge nose with a light ridge,
// flat belt, and a greenhouse rising to a single ridge then falling in one long straight fastback
// to the tail. Wheel wells are polygonal notches in the lower body.
const FRONT_WELL: P[] = [[0.9, 0.22], [0.94, 0.52], [1.18, 0.78], [1.54, 0.78], [1.78, 0.52], [1.82, 0.22]];
const REAR_WELL: P[] = FRONT_WELL.map(([z, y]) => [z - 2.66, y]);
const BELT = 0.9;
const LOWER: P[] = [
  [-2.12, 0.38], [-1.95, 0.22], ...REAR_WELL, ...FRONT_WELL, [2.0, 0.22], [2.18, 0.34],
  [2.2, 0.52], [1.95, 0.7], [1.45, 0.86], [0.95, BELT], [-2.17, BELT], [-2.15, 0.6],
];
const GREENHOUSE: P[] = [[0.95, BELT], [-0.1, 1.22], [-0.9, 1.12], [-2.13, 0.95], [-2.17, BELT]];
/** Outer half width of the lower body. */
export const HALF_WIDTH = 1.0;
/** Height of the flat floor between the wheel wells. */
export const FLOOR_HEIGHT = 0.22;
/** Where a folded wheel tucks under the floor in flight (pivot |x| and y). */
export const WHEEL_TUCK = { x: 0.6, y: 0.08 };
const BEVEL = 0.02;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Plan-view taper of the nose and tail, and tumblehome of the sides above the sill. */
export function bodyWarp(x: number, y: number, z: number): number {
  const kz = 1 - 0.16 * clamp01((z - 1.6) / 0.6) - 0.05 * clamp01((-1.8 - z) / 0.37);
  const ky = 1 - 0.07 * clamp01((y - 0.5) / 0.4);
  return x * kz * ky;
}

/** The greenhouse narrows sharply towards the ridge. */
function greenhouseWarp(x: number, y: number, z: number): number {
  return bodyWarp(x, BELT, z) * (1 - 0.4 * clamp01((y - BELT) / 0.32));
}

/** Lower body (painted) and greenhouse (roof, fastback and glass), as separate geometries. */
export function buildBodyParts(): { lower: THREE.BufferGeometry; greenhouse: THREE.BufferGeometry } {
  return {
    lower: extrudeProfile(LOWER, HALF_WIDTH, bodyWarp, BEVEL),
    greenhouse: extrudeProfile(GREENHOUSE, HALF_WIDTH, greenhouseWarp, BEVEL),
  };
}

/** The whole body as one geometry: group 0 is the lower body, group 1 the greenhouse. */
export function buildBodyGeometry(): THREE.BufferGeometry {
  const { lower, greenhouse } = buildBodyParts();
  return mergeGeometries([lower, greenhouse], true)!;
}

/** Inner wall closing a wheel well (in the well's own z frame), so one cannot see across the car. */
function wellWallGeometry(): THREE.BufferGeometry {
  return new THREE.ShapeGeometry(new THREE.Shape(FRONT_WELL.map(([z, y]) => new THREE.Vector2(z - WHEEL_POSITIONS[0][1], y))));
}

/**
 * Satin silver body over a black sill, with panel gaps drawn from the body-space position and
 * dark wheel wells and underside. On the greenhouse, the windscreen and side windows are glass.
 */
function createBodyMaterial(greenhouse: boolean): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xc9ccd1, metalness: 0.85, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.08 });
  const wells = [WHEEL_POSITIONS[0][1], WHEEL_POSITIONS[2][1]].map((z) => z.toFixed(2));
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCarPos;\nvarying vec3 vCarNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCarPos = position;\nvCarNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
${greenhouse ? '#define GREENHOUSE' : ''}
varying vec3 vCarPos;
varying vec3 vCarNormal;
float gap(float d) { return smoothstep(0.003, 0.007, abs(d)); }
float carDark() {
  vec3 q = vCarPos;
  vec3 n = normalize(vCarNormal);
  float dark = step(n.y, -0.5) + step(q.y, 0.42);
  for (int i = 0; i < 2; i++) {
    float wz = i == 0 ? ${wells[0]} : ${wells[1]};
    float near = step(length(vec2(q.z - wz, q.y - ${WHEEL_RADIUS.toFixed(2)})), 0.5) * step(q.y, 0.8);
    dark += near * step(abs(n.x), 0.6);
  }
  return min(dark, 1.0);
}
float carGlass() {
#ifdef GREENHOUSE
  vec3 q = vCarPos;
  vec3 n = normalize(vCarNormal);
  float roof = q.z > -0.1 ? mix(1.22, ${BELT.toFixed(2)}, (q.z + 0.1) / 1.05) : mix(1.22, 1.12, (-0.1 - q.z) / 0.8);
  float side = step(0.45, abs(n.x)) * step(-0.95, q.z) * step(q.z, 0.86) * step(0.95, q.y) * step(q.y, roof - 0.05);
  float screen = step(0.3, n.z) * step(abs(q.x), 0.62);
  return max(side, screen);
#else
  return 0.0;
#endif
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 q = vCarPos;
  float side = step(0.8, abs(q.x));
  float lines = 1.0;
#ifndef GREENHOUSE
  lines *= mix(1.0, gap(q.z + 0.95), side * step(0.42, q.y));
  lines *= mix(1.0, gap(q.z - 0.7), side * step(0.42, q.y));
  lines *= mix(1.0, gap(q.z - 1.62), step(0.75, q.y) * step(abs(q.x), 0.86));
#endif
  diffuseColor.rgb *= mix(0.1, 1.0, lines);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.018), carDark());
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.006, 0.008, 0.01), carGlass());
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.6, carDark());
roughnessFactor = mix(roughnessFactor, 0.03, carGlass());`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.3, max(carDark(), carGlass()));`,
      );
  };
  mat.customProgramCacheKey = () => `car-body-v2-${greenhouse}`;
  return mat;
}

export interface Wheel {
  /** Folds the wheel from driving (vertical) to thruster (horizontal). */
  pivot: THREE.Group;
  /** Spins around the axle when driving. */
  spinner: THREE.Group;
  side: 1 | -1;
}

export interface ProceduralCar {
  root: THREE.Group;
  wheels: Wheel[];
  thrusters: THREE.Mesh[];
  taillight: THREE.MeshStandardMaterial;
  thrusterMaterial: THREE.MeshBasicMaterial;
}

function place<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

/** Z of the tail face at height y (on the chamfer), from the lower-body profile. */
function tailZ(y: number): number {
  const t = clamp01((y - 0.38) / (0.9 - 0.38));
  return -2.12 - 0.05 * t - BEVEL;
}

/** Outside x of the body side (right side) at a height and station. */
function sideX(y: number, z: number): number {
  return bodyWarp(HALF_WIDTH, y, z) + 0.004;
}

function box(name: string, size: [number, number, number], material: THREE.Material, at: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...at);
  return mesh;
}

/** Front intake and corner lights, side handles, vents, markers and sill light, rear plate and lamps. */
function addDetails(root: THREE.Group, m: CarMaterials, taillight: THREE.Material): void {
  // Front: a dark intake across the chin with three bright slats, vertical corner lights, a radar.
  const chinZ = 2.19 + BEVEL;
  root.add(box('intake', [1.16, 0.1, 0.012], m.trim, [0, 0.42, chinZ]));
  for (const y of [0.395, 0.42, 0.445]) root.add(box('intake-slat', [1.1, 0.006, 0.01], m.chrome, [0, y, chinZ + 0.006]));
  for (const side of [-1, 1]) root.add(box('corner-light', [0.018, 0.1, 0.012], m.headlight, [side * 0.7, 0.43, chinZ - 0.01]));
  root.add(box('radar', [0.09, 0.05, 0.01], m.carbon, [0, 0.47, chinZ + 0.004]));

  for (const side of [-1, 1]) {
    const flip = (o: THREE.Mesh, x: number) => {
      o.position.x = side * x;
      return o;
    };
    // Flush door handle near the rear edge of the door, below the window.
    root.add(flip(box('door-handle', [0.012, 0.022, 0.2], m.trim, [0, 0.8, -0.7]), sideX(0.8, -0.7)));
    // Vent behind the front wheel: a dark recess with slanted slats.
    root.add(flip(box('vent', [0.01, 0.22, 0.14], m.trim, [0, 0.58, 0.8]), sideX(0.58, 0.8)));
    for (let i = 0; i < 4; i++) {
      const slat = flip(box('vent-slat', [0.012, 0.012, 0.15], m.carbon, [0, 0.5 + i * 0.055, 0.8]), sideX(0.5 + i * 0.055, 0.8) + 0.002);
      slat.rotation.x = -0.35;
      root.add(slat);
    }
    root.add(flip(box('side-marker', [0.01, 0.025, 0.07], m.marker, [0, 0.74, 0.8]), sideX(0.74, 0.8)));
    // Brightwork line along the sill between the wheels.
    root.add(flip(box('sill-trim', [0.01, 0.008, 1.66], m.chrome, [0, 0.44, 0.03]), sideX(0.44, 0.03)));
    // Window frame: a black B-pillar and a thin brightwork line under the side glass.
    const pillar = flip(box('pillar', [0.01, 0.2, 0.05], m.trim, [0, 1.02, -0.92]), greenhouseWarp(HALF_WIDTH, 1.02, -0.92) + 0.004);
    pillar.rotation.z = side * 0.42;
    root.add(pillar);
    root.add(flip(box('window-line', [0.008, 0.008, 1.8], m.chrome, [0, BELT + 0.04, -0.05]), greenhouseWarp(HALF_WIDTH, BELT + 0.04, -0.05) + 0.004));
  }

  // Rear: recessed plate housing, red reflectors low on the corners, a third brake light on the lip.
  root.add(box('plate', [0.52, 0.13, 0.01], m.trim, [0, 0.69, tailZ(0.69) - 0.004]));
  for (const side of [-1, 1]) root.add(box('reflector', [0.16, 0.025, 0.01], taillight, [side * 0.68, 0.41, tailZ(0.41) - 0.004]));
  root.add(box('brake-light', [0.5, 0.012, 0.012], taillight, [0, 0.975, -2.11]));
}

export function buildProceduralCar(): ProceduralCar {
  const root = new THREE.Group();
  root.name = 'player-car';
  const m = createCarMaterials();
  const parts = buildBodyParts();
  const body = new THREE.Mesh(parts.lower, createBodyMaterial(false));
  body.name = 'body';
  const canopy = new THREE.Mesh(parts.greenhouse, createBodyMaterial(true));
  canopy.name = 'canopy';
  for (const mesh of [body, canopy]) mesh.castShadow = mesh.receiveShadow = true;
  root.add(body, canopy);

  // Wheel-well inner walls, a wheel width inside the body side.
  for (const [x, z] of WHEEL_POSITIONS) {
    const wall = new THREE.Mesh(wellWallGeometry(), m.arch);
    wall.name = 'arch';
    wall.rotation.y = Math.sign(x) * Math.PI / 2;
    wall.position.set(x - Math.sign(x) * 0.18, 0, z);
    root.add(wall);
  }

  // Aero kept inside the body outline: splitter under the chin, diffuser under the tail, and a
  // dark lip where the fastback meets the tail.
  root.add(place(buildSplitter(1.5, m), 0, 0.2, 1.98));
  root.add(place(buildDiffuser(1.2, m), 0, 0.26, -1.88));
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(bodyWarp(2 * HALF_WIDTH, BELT, -2.15) * 0.62, 0.02, 0.05), m.trim);
  spoiler.name = 'spoiler';
  spoiler.position.set(0, 0.955, -2.13);
  root.add(spoiler);

  // Lights: an LED bar along the nose ridge, a full-width red bar across the tail.
  const head = new THREE.Mesh(new THREE.BoxGeometry(bodyWarp(2 * HALF_WIDTH, 0.52, 2.2) - 0.1, 0.02, 0.03), m.headlight);
  head.name = 'headlight';
  head.position.set(0, 0.52, 2.205);
  root.add(head);
  const taillight = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff1030, emissiveIntensity: 3 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(bodyWarp(2 * HALF_WIDTH, 0.86, -2.17) - 0.06, 0.045, 0.02), taillight);
  tail.name = 'taillight';
  tail.position.set(0, 0.85, -2.198);
  root.add(tail);
  // Four round rocket nozzles under the light bar.
  for (const x of [-0.5, -0.17, 0.17, 0.5]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 20, 1, true), m.chrome);
    nozzle.name = 'nozzle';
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(x, 0.52, -2.17);
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), m.nozzle);
    core.rotation.y = Math.PI;
    core.position.set(x, 0.52, -2.185);
    root.add(nozzle, core);
  }

  addDetails(root, m, taillight);

  const thrusterMaterial = new THREE.MeshBasicMaterial({ color: 0x46f0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  thrusterMaterial.defines = { ...ADDITIVE_FOG_DEFINES };
  const wheels: Wheel[] = [];
  const thrusters: THREE.Mesh[] = [];
  const width = 0.27;
  for (const [x, z] of WHEEL_POSITIONS) {
    const side = x > 0 ? 1 : -1;
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_RADIUS, z);
    const spinner = new THREE.Group();
    spinner.add(buildTyre(WHEEL_RADIUS, width, m), buildRim(WHEEL_RADIUS * 0.7, width, side, m), buildBrakeDisc(0.2, m));
    const caliper = buildCaliper(0.19, m);
    caliper.position.x = side * 0.02;
    // Thruster glow on the inner face: faces inwards while driving, downwards once folded.
    const thruster = new THREE.Mesh(new THREE.CircleGeometry(WHEEL_RADIUS * 0.85, 24), thrusterMaterial);
    thruster.rotation.y = -side * (Math.PI / 2);
    thruster.position.x = -side * 0.14;
    pivot.add(spinner, caliper, thruster);
    root.add(pivot);
    wheels.push({ pivot, spinner, side: side as 1 | -1 });
    thrusters.push(thruster);
  }
  return { root, wheels, thrusters, taillight, thrusterMaterial };
}
