import type * as THREE from 'three';
import type { CollisionWorld } from '../physics/collide';
import type { CarState } from '../vehicle/controller';
import { ChaseCamera } from './chase';
import { CinematicCamera } from './cinematic';
import { CockpitCamera } from './cockpit';

export type CameraMode = 'chase' | 'cockpit' | 'cinematic';
const ORDER: CameraMode[] = ['chase', 'cockpit', 'cinematic'];

export const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: 'Poursuite',
  cockpit: 'Cockpit',
  cinematic: 'Cinématique',
};

/** Switches between the three driving cameras (R20). */
export class CameraRig {
  mode: CameraMode = 'chase';
  private readonly chase: ChaseCamera;
  private readonly cockpit = new CockpitCamera();
  private readonly cinematic: CinematicCamera;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    world: CollisionWorld,
  ) {
    this.chase = new ChaseCamera(world);
    this.cinematic = new CinematicCamera(world);
  }

  next(): void {
    this.mode = ORDER[(ORDER.indexOf(this.mode) + 1) % ORDER.length];
    this.chase.reset();
    this.cinematic.reset();
  }

  update(dt: number, state: CarState, look: { x: number; y: number }): void {
    if (this.mode === 'chase') this.chase.update(this.camera, state, dt, look);
    else if (this.mode === 'cockpit') this.cockpit.update(this.camera, state);
    else this.cinematic.update(this.camera, state, dt);
    this.camera.updateProjectionMatrix();
  }
}
