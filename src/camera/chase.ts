import * as THREE from 'three';
import type { CollisionWorld } from '../physics/collide';
import type { CarState } from '../vehicle/controller';
import { damping, dampVector } from './damp';

/** Damped third-person camera behind the car, orbitable with the mouse or right stick. */
export class ChaseCamera {
  /**
   * Camera and aim point: horizontally relative to the car (smoothed in its frame), vertically in
   * the world, so a sudden step of the car (hover clamp over a roof edge) stays smoothed.
   */
  private readonly offset = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private height = 0;
  private aimHeight = 0;
  private orbitYaw = 0;
  private orbitPitch = 0.12;
  private idle = 0;
  /** Share of the boom length in use: drops at once in front of a building, recovers slowly. */
  private boom = 1;
  private initialised = false;

  constructor(private readonly world: CollisionWorld) {}

  reset(): void {
    this.initialised = false;
  }

  update(camera: THREE.PerspectiveCamera, s: CarState, dt: number, look: { x: number; y: number }): void {
    const speed = Math.hypot(s.velocity.x, s.velocity.z);
    if (look.x || look.y) {
      this.orbitYaw -= look.x * 0.004;
      this.orbitPitch = Math.max(-0.2, Math.min(1.1, this.orbitPitch + look.y * 0.003));
      this.idle = 0;
    } else {
      this.idle += dt;
      if (this.idle > 1.5) {
        this.orbitYaw *= 1 - damping(2, dt);
        this.orbitPitch += (0.12 - this.orbitPitch) * damping(2, dt);
      }
    }

    const airborne = s.mode !== 'ground';
    const distance = 7.5 + speed * 0.035 + (airborne ? 2 : 0);
    const yaw = s.yaw + this.orbitYaw;
    const pivot = new THREE.Vector3(s.position.x, s.position.y + 1.3, s.position.z);
    const full = new THREE.Vector3(
      pivot.x - Math.sin(yaw) * Math.cos(this.orbitPitch) * distance,
      pivot.y + Math.sin(this.orbitPitch) * distance + 1.2,
      pivot.z - Math.cos(yaw) * Math.cos(this.orbitPitch) * distance,
    );
    full.y = Math.max(full.y, s.floor + 0.6);

    // Never let a building hide the car: shorten the boom at once in front of it, and lengthen it
    // back slowly once clear, so skimming over roof edges does not make the camera jump.
    const hit = this.world.segmentHit(pivot, full);
    const allowed = hit === null ? 1 : Math.max(0, hit - 0.08);
    this.boom = !this.initialised || allowed < this.boom ? allowed : this.boom + (allowed - this.boom) * damping(2.5, dt);
    const desired = new THREE.Vector3().lerpVectors(pivot, full, this.boom);

    const fx = Math.sin(s.yaw);
    const fz = Math.cos(s.yaw);
    const target = new THREE.Vector3(s.position.x + fx * 4, s.position.y + 1, s.position.z + fz * 4);
    // Smoothing world positions behind a moving car leaves a lag of about speed / rate, which changes
    // with every uneven frame: at flight speed the car visibly shakes on screen. Horizontally, the
    // offsets from the car are smoothed instead, so the lag stays out of the motion and only turns
    // and the boom are softened. Vertically the world position is kept, carried along with the
    // climb: a step of the car (hover clamp over a roof edge) must not jolt the view.
    const car = new THREE.Vector3(s.position.x, 0, s.position.z);
    const wantedOffset = new THREE.Vector3(desired.x - car.x, 0, desired.z - car.z);
    const wantedAim = new THREE.Vector3(target.x - car.x, 0, target.z - car.z);
    if (!this.initialised) {
      this.offset.copy(wantedOffset);
      this.aim.copy(wantedAim);
      this.height = desired.y;
      this.aimHeight = target.y;
      this.initialised = true;
    } else {
      // Pulled in by a building: follow it closely so the car never disappears.
      const rate = allowed < 1 ? 30 : 9;
      dampVector(this.offset, wantedOffset, rate, dt);
      // Carried along with the car's climb first, then smoothed: a steady climb leaves no lag (whose
      // size would change with every uneven frame), only sudden steps are softened.
      const rise = s.velocity.y * dt;
      this.height += rise + (desired.y - this.height - rise) * damping(rate, dt);
      dampVector(this.aim, wantedAim, 14, dt);
      this.aimHeight += rise + (target.y - this.aimHeight - rise) * damping(14, dt);
    }
    camera.position.set(car.x + this.offset.x, Math.max(this.height, s.floor + 0.6), car.z + this.offset.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(car.x + this.aim.x, this.aimHeight, car.z + this.aim.z);
    const fov = 64 + Math.min(18, speed * 0.12);
    camera.fov += (fov - camera.fov) * damping(3, dt);
  }
}
