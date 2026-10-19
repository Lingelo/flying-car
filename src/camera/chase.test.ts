import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ChaseCamera } from './chase';
import { CollisionWorld } from '../physics/collide';
import type { CarState } from '../vehicle/controller';

const state = (z: number, vz: number): CarState => ({
  mode: 'flight',
  position: { x: 0, y: 120, z },
  velocity: { x: 0, y: 0, z: vz },
  yaw: 0,
  roll: 0,
  pitch: 0,
  deploy: 1,
  floor: 0,
});

describe('ChaseCamera', () => {
  it('stays at a steady distance behind a fast car whatever the frame times', () => {
    // Uneven frames (60 and 30 fps alternating) at top flight speed: the car must not shake on screen.
    const camera = new THREE.PerspectiveCamera();
    const chase = new ChaseCamera(new CollisionWorld());
    const speed = 120;
    let z = 0;
    const gaps: number[] = [];
    for (let i = 0; i < 600; i++) {
      const dt = i % 2 ? 1 / 30 : 1 / 60;
      z += speed * dt;
      chase.update(camera, state(z, speed), dt, { x: 0, y: 0 });
      if (i > 300) gaps.push(z - camera.position.z);
    }
    const spread = Math.max(...gaps) - Math.min(...gaps);
    expect(spread).toBeLessThan(0.05);
  });
});
