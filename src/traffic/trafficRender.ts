import * as THREE from 'three';
import { NEON_PALETTE } from '../render/materials/facade';
import type { Beacon, Lane } from './lanes';
import type { TrafficSim } from './sim';
import { TrafficStreaks } from './streaks';
import { vehicleShapes } from './vehicleShapes';

const PAINTS = [0x15171c, 0xd9dde3, 0x7a0f1d, 0x1d3f7a, 0x2b2b30, 0xb3a17a, 0x0f4d4a, 0x5a2a7a].map((c) => new THREE.Color(c));
const TIER_COLORS = [NEON_PALETTE[1], NEON_PALETTE[0], NEON_PALETTE[3], NEON_PALETTE[2]].map(([r, g, b]) => new THREE.Color(r * 3, g * 3, b * 3));

/** Corridor lights: small navigation lamps that blink in a slow wave along each lane. */
function beaconMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ toneMapped: false });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = beaconTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vBlink;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 beaconAt = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
vBlink = 0.25 + 0.75 * step(0.82, fract(uTime * 0.8 - (beaconAt.x + beaconAt.z) * 0.004));`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBlink;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vBlink * 1.6;');
  };
  return material;
}

/** Shared clock of the corridor lights. */
export const beaconTime = { value: 0 };

/** Instanced vehicles, corridor beacons and far light streaks. */
export class TrafficRender {
  readonly group = new THREE.Group();
  readonly bodies: THREE.InstancedMesh[] = [];
  readonly lights: THREE.InstancedMesh[] = [];
  readonly streaks = new TrafficStreaks();
  private readonly beacons: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3(1, 1, 1);

  constructor(private readonly capacity = 400, beaconCapacity = 12000) {
    const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.65, roughness: 0.32 });
    const lightMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    for (const shape of vehicleShapes()) {
      const body = new THREE.InstancedMesh(shape.body, bodyMaterial, capacity);
      const lights = new THREE.InstancedMesh(shape.lights, lightMaterial, capacity);
      for (const m of [body, lights]) {
        m.count = 0;
        m.frustumCulled = false;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      }
      body.castShadow = true;
      for (let i = 0; i < capacity; i++) body.setColorAt(i, PAINTS[i % PAINTS.length]);
      this.bodies.push(body);
      this.lights.push(lights);
      this.group.add(body, lights);
    }
    this.beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), beaconMaterial(), beaconCapacity);
    this.beacons.count = 0;
    this.beacons.frustumCulled = false;
    this.group.add(this.beacons, this.streaks.points);
  }

  setLanes(lanes: Lane[]): void {
    this.streaks.setLanes(lanes);
  }

  setBeacons(beacons: Beacon[]): void {
    const n = Math.min(beacons.length, this.beacons.instanceMatrix.count);
    for (let i = 0; i < n; i++) {
      const b = beacons[i];
      this.matrix.makeTranslation(b.x, b.y, b.z);
      this.beacons.setMatrixAt(i, this.matrix);
      this.beacons.setColorAt(i, TIER_COLORS[b.tier]);
    }
    this.beacons.count = n;
    this.beacons.instanceMatrix.needsUpdate = true;
    if (this.beacons.instanceColor) this.beacons.instanceColor.needsUpdate = true;
  }

  update(sim: TrafficSim, time: number, centre?: { x: number; z: number }): void {
    beaconTime.value = time;
    const counts = this.bodies.map(() => 0);
    for (const v of sim.vehicles) {
      const index = counts[v.type];
      if (index >= this.capacity) continue;
      counts[v.type]++;
      const p = sim.position(v);
      const lane = v.lane;
      const yaw = lane.axis === 'z' ? (lane.dir > 0 ? 0 : Math.PI) : lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const air = lane.kind === 'air';
      const bob = air ? Math.sin(time * 1.3 + v.id) * 0.35 : 0;
      // Bank while sliding sideways around the player, nose down when braking hard in the air.
      const bank = air ? (v.lateralTarget - v.lateral) * -0.06 * lane.dir : 0;
      this.euler.set(0, yaw, bank);
      this.quaternion.setFromEuler(this.euler);
      this.position.set(p.x, p.y + bob, p.z);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.bodies[v.type].setMatrixAt(index, this.matrix);
      // Paint follows the vehicle, not its instance slot (slots are repacked every frame).
      this.bodies[v.type].setColorAt(index, PAINTS[v.id % PAINTS.length]);
      this.lights[v.type].setMatrixAt(index, this.matrix);
    }
    this.bodies.forEach((m, type) => {
      m.count = counts[type];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      this.lights[type].count = counts[type];
      this.lights[type].instanceMatrix.needsUpdate = true;
    });
    if (centre) this.streaks.update(centre.x, centre.z);
  }
}
