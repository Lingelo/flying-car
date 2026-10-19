import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Materials shared by the detailed car parts. */
export function createCarMaterials() {
  return {
    carbon: new THREE.MeshStandardMaterial({ color: 0x0a0b0d, metalness: 0.4, roughness: 0.45 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x050506, metalness: 0.2, roughness: 0.7 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.9, roughness: 0.3 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.92, side: THREE.DoubleSide }),
    disc: new THREE.MeshStandardMaterial({ color: 0x6d6f73, metalness: 1, roughness: 0.38 }),
    caliper: new THREE.MeshStandardMaterial({ color: 0xd8b21a, metalness: 0.3, roughness: 0.35 }),
    arch: new THREE.MeshStandardMaterial({ color: 0x040405, roughness: 0.95, side: THREE.DoubleSide }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 1, roughness: 0.08 }),
    marker: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffa21a, emissiveIntensity: 3 }),
    nozzle: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff7a1a, emissiveIntensity: 2.5 }),
    headlight: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xe4f6ff, emissiveIntensity: 6 }),
  };
}
export type CarMaterials = ReturnType<typeof createCarMaterials>;

function named<T extends THREE.Object3D>(o: T, name: string, shadow = true): T {
  o.name = name;
  if ((o as unknown as THREE.Mesh).isMesh) (o as unknown as THREE.Mesh).castShadow = shadow;
  return o;
}

/** Turns a geometry built around the y axis into one around the x axis (wheel axle). */
function onAxle(g: THREE.BufferGeometry): THREE.BufferGeometry {
  return g.rotateZ(Math.PI / 2);
}

/** Tyre with rounded shoulders: a lathe of its cross-section around the axle. */
export function buildTyre(radius: number, width: number, m: CarMaterials): THREE.Mesh {
  const inner = radius * 0.7;
  const h = width / 2;
  const shoulder = 0.045;
  // Cross-section (radius, offset along the axle): sidewall, rounded shoulders, tread, sidewall.
  const profile: THREE.Vector2[] = [new THREE.Vector2(inner, -h * 0.92)];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    profile.push(new THREE.Vector2(radius - shoulder + Math.sin(a) * shoulder, -h + shoulder - Math.cos(a) * shoulder));
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    profile.push(new THREE.Vector2(radius - shoulder + Math.cos(a) * shoulder, h - shoulder + Math.sin(a) * shoulder));
  }
  profile.push(new THREE.Vector2(inner, h * 0.92));
  return named(new THREE.Mesh(onAxle(new THREE.LatheGeometry(profile, 56)), m.tyre), 'tyre');
}

/** Aero rim: barrel, hub and five broad turbine blades on the outer face (side = +1 right, -1 left). */
export function buildRim(radius: number, width: number, side: number, m: CarMaterials): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(onAxle(new THREE.CylinderGeometry(radius, radius, width * 0.9, 40, 1, true)));
  // Lip on the outer edge.
  parts.push(new THREE.TorusGeometry(radius - 0.01, 0.014, 6, 40).rotateY(Math.PI / 2).translate(side * width * 0.42, 0, 0));
  parts.push(onAxle(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 20)).translate(side * width * 0.38, 0, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const len = radius - 0.07;
    // A blade widening towards the rim, swept a little like a turbine.
    const blade = new THREE.CylinderGeometry(0.06, 0.03, len, 4, 1).scale(1, 1, 0.35);
    blade.translate(0, 0.07 + len / 2, 0);
    blade.rotateX(side * 0.18);
    blade.rotateX(a);
    blade.translate(side * width * 0.4, 0, 0);
    parts.push(blade);
  }
  return named(new THREE.Mesh(mergeGeometries(parts.map((p) => p.toNonIndexed())), m.rim), 'rim');
}

/** Brake disc (spins with the wheel). */
export function buildBrakeDisc(radius: number, m: CarMaterials): THREE.Mesh {
  return named(new THREE.Mesh(onAxle(new THREE.CylinderGeometry(radius, radius, 0.028, 36)), m.disc), 'brake-disc');
}

/** Caliper clamping the disc at the rear of the wheel (fixed to the hub, does not spin). */
export function buildCaliper(radius: number, m: CarMaterials): THREE.Mesh {
  const g = new THREE.TorusGeometry(radius, 0.035, 8, 12, 0.9);
  g.scale(1, 1, 1.6);
  g.rotateY(Math.PI / 2);
  g.rotateX(Math.PI * 0.62);
  return named(new THREE.Mesh(g, m.caliper), 'caliper');
}

/** Front splitter: flat carbon blade with turned-up end plates. */
export function buildSplitter(width: number, m: CarMaterials): THREE.Mesh {
  const blade = new THREE.BoxGeometry(width, 0.025, 0.24);
  const plateL = new THREE.BoxGeometry(0.02, 0.09, 0.22).translate(-width / 2, 0.045, 0);
  const plateR = plateL.clone().translate(width, 0, 0);
  return named(new THREE.Mesh(mergeGeometries([blade, plateL, plateR]), m.carbon), 'splitter');
}

/** Rear diffuser: an upswept tray with vertical strakes. */
export function buildDiffuser(width: number, m: CarMaterials): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(width, 0.02, 0.5).rotateX(-0.22)];
  for (let i = 0; i < 6; i++) {
    const x = (i / 5 - 0.5) * width * 0.9;
    parts.push(new THREE.BoxGeometry(0.015, 0.07, 0.42).rotateX(-0.22).translate(x, 0.035, 0));
  }
  return named(new THREE.Mesh(mergeGeometries(parts), m.carbon), 'diffuser');
}
