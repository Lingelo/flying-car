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

  it('tucks the folded wheels under the floor in flight and lowers them to land', async () => {
    const { HALF_WIDTH, FLOOR_HEIGHT, WHEEL_RADIUS } = await import('./proceduralCar');
    const visual = await createCarVisual(() => Promise.reject(new Error('404')));
    const car = new CarController();
    car.state.deploy = 1;
    visual.update(car.state, 0, false);
    for (const w of visual.wheels) {
      // Folded flat: the wheel is a disc of radius WHEEL_RADIUS around the pivot, 0.27 m thick.
      expect(Math.abs(w.pivot.position.x) + WHEEL_RADIUS).toBeLessThanOrEqual(HALF_WIDTH);
      expect(w.pivot.position.y + 0.135).toBeLessThanOrEqual(FLOOR_HEIGHT + 0.01);
    }
    car.state.deploy = 0;
    visual.update(car.state, 0, false);
    for (const w of visual.wheels) expect(w.pivot.position.y).toBeCloseTo(WHEEL_RADIUS);
  });

  it('places the car at the controller position and heading', async () => {
    const visual = await createCarVisual(() => Promise.reject(new Error('404')));
    const car = new CarController({ x: 10, y: 5, z: -3 }, 1.2);
    visual.update(car.state, 0, false);
    expect(visual.root.position.toArray()).toEqual([10, 5, -3]);
    expect(visual.root.rotation.y).toBeCloseTo(1.2);
  });
});

describe('detailed procedural coupe', () => {
  it('has the parts of a real car', async () => {
    const { buildProceduralCar } = await import('./proceduralCar');
    const car = buildProceduralCar();
    for (const name of ['body', 'canopy', 'splitter', 'diffuser', 'spoiler', 'rim', 'tyre', 'brake-disc', 'caliper', 'headlight', 'taillight', 'nozzle', 'arch', 'intake', 'door-handle', 'vent', 'side-marker', 'sill-trim', 'plate', 'reflector', 'brake-light'])
      expect(car.root.getObjectByName(name), name).toBeDefined();
  });

  it('keeps sports car proportions', async () => {
    const { buildProceduralCar } = await import('./proceduralCar');
    const size = new THREE.Box3().setFromObject(buildProceduralCar().root).getSize(new THREE.Vector3());
    expect(size.z).toBeGreaterThan(4.1);
    expect(size.z).toBeLessThan(4.6);
    expect(size.x).toBeGreaterThan(1.8);
    expect(size.x).toBeLessThan(2.3);
    expect(size.y).toBeGreaterThan(1.05);
    expect(size.y).toBeLessThan(1.35);
  });

  it('cuts wheel arches in the body so the wheels show', async () => {
    const { buildBodyGeometry, WHEEL_POSITIONS, WHEEL_RADIUS } = await import('./proceduralCar');
    const g = buildBodyGeometry();
    const pos = g.getAttribute('position');
    const vertex = (k: number) => g.getIndex()?.getX(k) ?? k;
    const count = g.getIndex()?.count ?? pos.count;
    for (let f = 0; f < count; f += 3) {
      const c = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, vertex(f + k))).reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(3);
      for (const [wx, wz] of WHEEL_POSITIONS) {
        if (Math.sign(c.x) !== Math.sign(wx) || Math.abs(c.x) < 0.55) continue;
        expect(Math.hypot(c.z - wz, c.y - WHEEL_RADIUS)).toBeGreaterThan(WHEEL_RADIUS + 0.02);
      }
    }
  });
});
