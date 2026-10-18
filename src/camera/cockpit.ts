import * as THREE from 'three';
import type { CarState } from '../vehicle/controller';

/** Driver's eye: follows the car attitude (yaw, pitch, roll). */
export class CockpitCamera {
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly offset = new THREE.Vector3();

  update(camera: THREE.PerspectiveCamera, s: CarState): void {
    this.euler.set(-s.pitch, s.yaw, -s.roll);
    // Driver sits left of centre, a little behind the middle of the car, eyes at 1 m.
    this.offset.set(0.35, 1.0, -0.15).applyEuler(this.euler);
    camera.position.set(s.position.x + this.offset.x, s.position.y + this.offset.y, s.position.z + this.offset.z);
    // three.js cameras look down -z: turn half a turn so the view faces the car's +z front.
    camera.quaternion.setFromEuler(new THREE.Euler(s.pitch, s.yaw + Math.PI, s.roll, 'YXZ'));
    camera.fov = 74;
  }
}
