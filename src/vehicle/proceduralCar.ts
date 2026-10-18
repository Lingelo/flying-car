import * as THREE from 'three';

/** Body length, half width and wheel layout of the procedural roadster (metres). */
export const CAR_LENGTH = 4.3;
export const WHEEL_RADIUS = 0.36;
export const WHEEL_POSITIONS: [number, number][] = [
  [0.86, 1.36],
  [-0.86, 1.36],
  [0.86, -1.3],
  [-0.86, -1.3],
];

type Curve = [number, number][];
/** Smooth interpolation through control points (u in [0, 1]). */
function sample(curve: Curve, u: number): number {
  let i = 0;
  while (i < curve.length - 2 && u > curve[i + 1][0]) i++;
  const [u0, v0] = curve[i];
  const [u1, v1] = curve[i + 1];
  const t = Math.min(1, Math.max(0, (u - u0) / (u1 - u0)));
  const s = t * t * (3 - 2 * t);
  return v0 + (v1 - v0) * s;
}

// Side silhouette of an original low two-seat roadster: short rear deck, cab-backward canopy,
// long sloping nose without a grille. u = 0 at the rear, 1 at the nose.
const TOP: Curve = [[0, 0.74], [0.07, 0.9], [0.28, 0.96], [0.44, 1.15], [0.56, 1.13], [0.7, 0.86], [0.86, 0.74], [0.97, 0.6], [1, 0.44]];
const BOTTOM: Curve = [[0, 0.36], [0.06, 0.22], [0.94, 0.2], [1, 0.32]];
const HALF_WIDTH: Curve = [[0, 0.8], [0.06, 0.93], [0.3, 0.99], [0.6, 0.97], [0.85, 0.93], [0.96, 0.8], [1, 0.55]];
const BELT = 0.86;
const CABIN: [number, number] = [0.37, 0.71];

/** Car body as a loft of superellipse sections; faces above the belt line in the cabin are glass. */
export function buildBodyGeometry(stations = 56, ring = 44): THREE.BufferGeometry {
  const positions: number[] = [];
  const glassFaces: number[] = [];
  const paintFaces: number[] = [];
  const n = 3.2;
  const pow = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / n);
  const us: number[] = [];

  for (let i = 0; i <= stations; i++) {
    const u = i / stations;
    us.push(u);
    const z = (u - 0.5) * CAR_LENGTH;
    const top = sample(TOP, u);
    const bottom = sample(BOTTOM, u);
    const hw = sample(HALF_WIDTH, u);
    const mid = (top + bottom) / 2;
    const hh = (top - bottom) / 2;
    const cabin = u > CABIN[0] && u < CABIN[1];
    for (let j = 0; j < ring; j++) {
      const a = (j / ring) * Math.PI * 2;
      const y = mid + pow(Math.sin(a)) * hh;
      // The canopy tapers inwards above the belt line.
      const above = Math.max(0, (y - BELT) / Math.max(0.05, top - BELT));
      const taper = 1 - (cabin ? 0.32 : 0.12) * above ** 1.4;
      positions.push(pow(Math.cos(a)) * hw * taper, y, z);
    }
  }

  const idx = (i: number, j: number) => i * ring + (j % ring);
  for (let i = 0; i < stations; i++) {
    const u = (us[i] + us[i + 1]) / 2;
    for (let j = 0; j < ring; j++) {
      const a = idx(i, j);
      const b = idx(i + 1, j);
      const c = idx(i + 1, j + 1);
      const d = idx(i, j + 1);
      const y = (positions[a * 3 + 1] + positions[c * 3 + 1]) / 2;
      const glass = u > CABIN[0] + 0.01 && u < CABIN[1] - 0.01 && y > BELT + 0.04;
      (glass ? glassFaces : paintFaces).push(a, d, b, b, d, c);
    }
  }
  // End caps.
  for (const [i, sign] of [[0, -1], [stations, 1]] as const) {
    const center = positions.length / 3;
    const u = us[i];
    positions.push(0, (sample(TOP, u) + sample(BOTTOM, u)) / 2, (u - 0.5) * CAR_LENGTH + sign * 0.03);
    for (let j = 0; j < ring; j++) {
      if (sign > 0) paintFaces.push(idx(i, j), idx(i, j + 1), center);
      else paintFaces.push(idx(i, j + 1), idx(i, j), center);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex([...paintFaces, ...glassFaces]);
  g.addGroup(0, paintFaces.length, 0);
  g.addGroup(paintFaces.length, glassFaces.length, 1);
  g.computeVertexNormals();
  return g;
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

export function buildProceduralCar(): ProceduralCar {
  const root = new THREE.Group();
  root.name = 'player-car';
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x8f0a1c, metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x030507, metalness: 0.9, roughness: 0.04, clearcoat: 1 });
  const body = new THREE.Mesh(buildBodyGeometry(), [paint, glass]);
  body.castShadow = true;
  root.add(body);

  // Underbody shadow plate.
  const under = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 3.9), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }));
  under.position.y = 0.22;
  root.add(under);

  // Light bars: full-width LED strip at the front, red bar across the rear.
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xdff4ff, emissiveIntensity: 6 }));
  head.position.set(0, 0.6, CAR_LENGTH / 2 - 0.12);
  const taillight = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff1030, emissiveIntensity: 3 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.04), taillight);
  tail.position.set(0, 0.8, -CAR_LENGTH / 2 + 0.08);
  root.add(head, tail);

  const tire = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.85 });
  const rimGlow = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x19e0ff, emissiveIntensity: 3 });
  const thrusterMaterial = new THREE.MeshBasicMaterial({ color: 0x46f0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const wheels: Wheel[] = [];
  const thrusters: THREE.Mesh[] = [];
  for (const [x, z] of WHEEL_POSITIONS) {
    const side = x > 0 ? 1 : -1;
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_RADIUS, z);
    const spinner = new THREE.Group();
    const tireMesh = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.26, 28), tire);
    tireMesh.rotation.z = Math.PI / 2;
    tireMesh.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_RADIUS * 0.72, 0.025, 8, 32), rimGlow);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = side * 0.135;
    spinner.add(tireMesh, ring);
    // Thruster glow on the outer face, pointing down once the wheel is folded.
    const thruster = new THREE.Mesh(new THREE.CircleGeometry(WHEEL_RADIUS * 0.85, 24), thrusterMaterial);
    // Faces inwards while driving, which becomes downwards once the wheel is folded.
    thruster.rotation.y = -side * (Math.PI / 2);
    thruster.position.x = -side * 0.14;
    pivot.add(spinner, thruster);
    root.add(pivot);
    wheels.push({ pivot, spinner, side: side as 1 | -1 });
    thrusters.push(thruster);
  }
  return { root, wheels, thrusters, taillight, thrusterMaterial };
}
