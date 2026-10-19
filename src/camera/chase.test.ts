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

describe('ChaseCamera climbing', () => {
  it('keeps the same height above the car while climbing as when cruising', () => {
    // Starting or stopping a climb must not make the view sink and catch up.
    const camera = new THREE.PerspectiveCamera();
    const chase = new ChaseCamera(new CollisionWorld());
    let y = 120;
    const settle = (vy: number) => {
      for (let i = 0; i < 180; i++) {
        y += vy / 60;
        const s = state(0, 0);
        s.position.y = y;
        s.velocity.y = vy;
        chase.update(camera, s, 1 / 60, { x: 0, y: 0 });
      }
      return camera.position.y - y;
    };
    const cruising = settle(0);
    const climbing = settle(25);
    expect(Math.abs(climbing - cruising)).toBeLessThan(0.05);
  });

  it('stays at a steady height above a climbing car whatever the frame times', () => {
    const camera = new THREE.PerspectiveCamera();
    const chase = new ChaseCamera(new CollisionWorld());
    const climb = 40;
    let y = 120;
    const gaps: number[] = [];
    for (let i = 0; i < 600; i++) {
      const dt = i % 2 ? 1 / 30 : 1 / 60;
      y += climb * dt;
      const s = state(0, 0);
      s.position.y = y;
      s.velocity.y = climb;
      chase.update(camera, s, dt, { x: 0, y: 0 });
      if (i > 300) gaps.push(camera.position.y - y);
    }
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.05);
  });
});
