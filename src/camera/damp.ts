import type * as THREE from 'three';

/** Frame-rate independent exponential smoothing factor. */
export const damping = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export function dampVector(current: THREE.Vector3, target: THREE.Vector3, rate: number, dt: number): THREE.Vector3 {
  return current.lerp(target, damping(rate, dt));
}
