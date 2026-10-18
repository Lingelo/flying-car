import * as THREE from 'three';
import type { CollisionWorld } from '../physics/collide';
import type { CarState } from '../vehicle/controller';
import { damping, dampVector } from './damp';

/** Damped third-person camera behind the car, orbitable with the mouse or right stick. */
export class ChaseCamera {
  private readonly position = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private orbitYaw = 0;
  private orbitPitch = 0.12;
  private idle = 0;
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
    const desired = new THREE.Vector3(
      pivot.x - Math.sin(yaw) * Math.cos(this.orbitPitch) * distance,
      pivot.y + Math.sin(this.orbitPitch) * distance + 1.2,
      pivot.z - Math.cos(yaw) * Math.cos(this.orbitPitch) * distance,
    );
    desired.y = Math.max(desired.y, s.floor + 0.6);

    // Never let a building hide the car: stop the camera in front of it.
    const hit = this.world.segmentHit(pivot, desired);
    if (hit !== null) desired.lerpVectors(pivot, desired, Math.max(0, hit - 0.08));

    if (!this.initialised) {
      this.position.copy(desired);
      this.initialised = true;
    } else {
      dampVector(this.position, desired, hit !== null ? 30 : 9, dt);
    }
    const fx = Math.sin(s.yaw);
    const fz = Math.cos(s.yaw);
    this.lookAt.set(s.position.x + fx * 4, s.position.y + 1, s.position.z + fz * 4);
    camera.position.copy(this.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(this.lookAt);
    const fov = 64 + Math.min(18, speed * 0.12);
    camera.fov += (fov - camera.fov) * damping(3, dt);
  }
}
