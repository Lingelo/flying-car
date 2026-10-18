import * as THREE from 'three';
import type { CollisionWorld } from '../physics/collide';
import type { CarState } from '../vehicle/controller';

/** Film-like shots: a still camera placed ahead of the car, panning as it passes, then moving on. */
export class CinematicCamera {
  private readonly anchor = new THREE.Vector3();
  private hasAnchor = false;
  private occluded = 0;
  private shot = 0;

  constructor(private readonly world: CollisionWorld) {}

  reset(): void {
    this.hasAnchor = false;
  }

  private placeAnchor(s: CarState): void {
    const fx = Math.sin(s.yaw);
    const fz = Math.cos(s.yaw);
    const speed = Math.hypot(s.velocity.x, s.velocity.z);
    const ahead = 30 + Math.min(90, speed * 1.4);
    // Alternate sides and heights from shot to shot.
    const side = this.shot % 2 === 0 ? 1 : -1;
    const lateral = side * (10 + (this.shot % 3) * 6);
    const height = s.mode === 'ground' ? 1.5 + (this.shot % 3) * 4 : (this.shot % 2 ? 12 : -8);
    this.anchor.set(
      s.position.x + fx * ahead - fz * lateral,
      Math.max(s.floor + 1, s.position.y + height),
      s.position.z + fz * ahead + fx * lateral,
    );
    this.shot++;
    this.hasAnchor = true;
    this.occluded = 0;
  }

  update(camera: THREE.PerspectiveCamera, s: CarState, dt: number): void {
    if (!this.hasAnchor) this.placeAnchor(s);
    const target = new THREE.Vector3(s.position.x, s.position.y + 1, s.position.z);
    const blocked = this.world.segmentHit(this.anchor, target) !== null;
    this.occluded = blocked ? this.occluded + dt : 0;
    if (this.anchor.distanceTo(target) > 150 || this.occluded > 0.4) this.placeAnchor(s);
    camera.position.copy(this.anchor);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.fov = 38;
  }
}
