import * as THREE from 'three';
import type { CarState } from './controller';
import { buildProceduralCar, CAR_LENGTH, WHEEL_RADIUS, WHEEL_TUCK, type Wheel } from './proceduralCar';

/** Wheel fold angle for a thruster deployment in [0, 1], eased. */
export function wheelFold(deploy: number): number {
  const d = Math.min(1, Math.max(0, deploy));
  return (d * d * (3 - 2 * d) * Math.PI) / 2;
}

export interface CarVisual {
  root: THREE.Group;
  source: 'procedural' | 'gltf';
  wheels: Wheel[];
  /** Current thruster glow intensity, 0 to 1. */
  thrusterGlow: number;
  update(state: CarState, dt: number, braking: boolean): void;
}

export type ModelLoader = () => Promise<THREE.Object3D>;

/** Loads `public/models/roadster.glb` (front towards +z, any scale). */
export const loadRoadsterGlb: ModelLoader = async () => {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/roadster.glb`);
  return gltf.scene;
};

/** The glTF roadster when it exists, otherwise the procedural one; never fails. */
export async function createCarVisual(load: ModelLoader = loadRoadsterGlb): Promise<CarVisual> {
  const procedural = buildProceduralCar();
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  let source: CarVisual['source'] = 'procedural';
  let wheels = procedural.wheels;
  const rest = wheels.map((w) => w.pivot.position.x);

  try {
    const model = await load();
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const scale = CAR_LENGTH / Math.max(size.z, 1e-3);
    model.scale.setScalar(scale);
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    root.add(model);
    // Keep only the thruster glows of the procedural car under the model.
    for (const t of procedural.thrusters) {
      t.removeFromParent();
      t.rotation.set(-Math.PI / 2, 0, 0);
      t.position.y = 0.1;
      root.add(t);
    }
    wheels = [];
    source = 'gltf';
  } catch {
    root.add(procedural.root);
  }

  const underglow = new THREE.PointLight(0x46f0ff, 0, 12, 2);
  underglow.position.y = -0.2;
  root.add(underglow);

  const visual: CarVisual = {
    root,
    source,
    wheels,
    thrusterGlow: 0,
    update(state, dt, braking) {
      root.position.set(state.position.x, state.position.y, state.position.z);
      root.rotation.set(-state.pitch, state.yaw, -state.roll);
      const fold = wheelFold(state.deploy);
      const speed = Math.hypot(state.velocity.x, state.velocity.z);
      // Folded wheels slide in and up to sit flat under the floor as hover pads.
      const tuck = fold / (Math.PI / 2);
      wheels.forEach((w, i) => {
        w.pivot.rotation.z = w.side * fold;
        w.pivot.position.x = rest[i] + (w.side * WHEEL_TUCK.x - rest[i]) * tuck;
        w.pivot.position.y = WHEEL_RADIUS + (WHEEL_TUCK.y - WHEEL_RADIUS) * tuck;
        if (state.deploy < 0.5) w.spinner.rotation.x += (speed / WHEEL_RADIUS) * dt;
      });
      visual.thrusterGlow = state.deploy;
      procedural.thrusterMaterial.opacity = 0.85 * state.deploy;
      underglow.intensity = 10 * state.deploy;
      procedural.taillight.emissiveIntensity = braking ? 9 : 3;
    },
  };
  return visual;
}
