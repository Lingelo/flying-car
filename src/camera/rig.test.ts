import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from './rig';
import { CarController } from '../vehicle/controller';
import { CollisionWorld } from '../physics/collide';

const settle = (rig: CameraRig, car: CarController, seconds = 3) => {
  for (let t = 0; t < seconds; t += 1 / 60) rig.update(1 / 60, car.state, { x: 0, y: 0 });
};

describe('CameraRig', () => {
  it('cycles chase → cockpit → cinematic → chase', () => {
    const rig = new CameraRig(new THREE.PerspectiveCamera(), new CollisionWorld());
    expect(rig.mode).toBe('chase');
    rig.next();
    expect(rig.mode).toBe('cockpit');
    rig.next();
    expect(rig.mode).toBe('cinematic');
    rig.next();
    expect(rig.mode).toBe('chase');
  });

  it('follows behind the car in chase mode', () => {
    const camera = new THREE.PerspectiveCamera();
    const rig = new CameraRig(camera, new CollisionWorld());
    const car = new CarController({ x: 0, y: 0, z: 0 }, 0); // facing +z
    settle(rig, car);
    expect(camera.position.z).toBeLessThan(-4);
    expect(camera.position.y).toBeGreaterThan(1);
  });

  it('pulls the chase camera in front of a wall between it and the car', () => {
    const world = new CollisionWorld();
    world.addStatic('c', [{ x: 0, z: -5, w: 40, d: 2, y0: 0, y1: 50 }]);
    const camera = new THREE.PerspectiveCamera();
    const rig = new CameraRig(camera, world);
    const car = new CarController({ x: 0, y: 0, z: 0 }, 0);
    settle(rig, car);
    expect(camera.position.z).toBeGreaterThan(-4);
  });

  it('sits inside the car in cockpit mode', () => {
    const camera = new THREE.PerspectiveCamera();
    const rig = new CameraRig(camera, new CollisionWorld());
    rig.next();
    const car = new CarController({ x: 5, y: 0, z: 5 }, 0);
    settle(rig, car, 0.1);
    expect(camera.position.distanceTo(new THREE.Vector3(5, 1, 5))).toBeLessThan(1);
  });

  it('cinematic camera looks at the car from a distance', () => {
    const camera = new THREE.PerspectiveCamera();
    const rig = new CameraRig(camera, new CollisionWorld());
    rig.next();
    rig.next();
    const car = new CarController({ x: 0, y: 0, z: 0 }, 0);
    settle(rig, car, 0.5);
    const toCar = new THREE.Vector3(0, 1, 0).sub(camera.position).normalize();
    const view = camera.getWorldDirection(new THREE.Vector3());
    expect(view.dot(toCar)).toBeGreaterThan(0.95);
    expect(camera.position.length()).toBeGreaterThan(15);
  });
});
