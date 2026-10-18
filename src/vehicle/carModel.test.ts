import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCarVisual, wheelFold } from './carModel';
import { CarController } from './controller';

describe('wheelFold', () => {
  it('folds the wheels from vertical (driving) to horizontal (thrusters)', () => {
    expect(wheelFold(0)).toBe(0);
    expect(wheelFold(1)).toBeCloseTo(Math.PI / 2);
    expect(wheelFold(0.5)).toBeGreaterThan(0);
    expect(wheelFold(0.5)).toBeLessThan(Math.PI / 2);
  });

  it('is monotonic', () => {
    let previous = -1;
    for (let d = 0; d <= 1; d += 0.05) {
      const angle = wheelFold(d);
      expect(angle).toBeGreaterThanOrEqual(previous);
      previous = angle;
    }
  });
});

describe('createCarVisual', () => {
  it('falls back to the procedural car when the glTF model is missing', async () => {
    const visual = await createCarVisual(() => Promise.reject(new Error('404')));
    expect(visual.source).toBe('procedural');
    expect(visual.wheels).toHaveLength(4);
  });

  it('uses the glTF model when it loads', async () => {
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.2, 1.9)));
    const visual = await createCarVisual(() => Promise.resolve(model));
    expect(visual.source).toBe('gltf');
    expect(visual.root.getObjectById(model.id)).toBeDefined();
  });

  it('deploys the thrusters and their glow with the controller', async () => {
    const visual = await createCarVisual(() => Promise.reject(new Error('404')));
    const car = new CarController();
    visual.update(car.state, 0, false);
    expect(visual.wheels[0].pivot.rotation.z).toBeCloseTo(0);
    expect(visual.thrusterGlow).toBe(0);
    car.state.deploy = 1;
    visual.update(car.state, 0, false);
    expect(Math.abs(visual.wheels[0].pivot.rotation.z)).toBeCloseTo(Math.PI / 2);
    expect(visual.thrusterGlow).toBeGreaterThan(0.9);
  });

  it('places the car at the controller position and heading', async () => {
    const visual = await createCarVisual(() => Promise.reject(new Error('404')));
    const car = new CarController({ x: 10, y: 5, z: -3 }, 1.2);
    visual.update(car.state, 0, false);
    expect(visual.root.position.toArray()).toEqual([10, 5, -3]);
    expect(visual.root.rotation.y).toBeCloseTo(1.2);
  });
});
