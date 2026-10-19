import { describe, expect, it } from 'vitest';
import { CarController, type DriveInput } from '../vehicle/controller';
import { CollisionWorld, CAR_CENTER_Y, CAR_RADIUS, resolveSphere } from './collide';
import { SpatialHash } from './spatialHash';
import type { Box } from '../city/generator';

const DT = 1 / 60;
const idle: DriveInput = { throttle: 0, steer: 0, lift: 0, boost: false };
const wall: Box = { x: 0, z: 100, w: 60, d: 20, y0: 0, y1: 80 };

/** Steps the car and resolves collisions the way the game loop does. */
function simulate(car: CarController, world: CollisionWorld, seconds: number, input: Partial<DriveInput> = {}) {
  let hits = 0;
  for (let t = 0; t < seconds; t += DT) {
    const prev = { ...car.state.position };
    car.state.floor = world.floorAt(car.state.position.x, car.state.position.z, car.state.position.y);
    car.step(DT, { ...idle, ...input });
    if (world.resolveCar(car, prev)) hits++;
  }
  return hits;
}

const inside = (p: { x: number; y: number; z: number }, b: Box) =>
  Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.z - b.z) < b.d / 2 && p.y > b.y0 && p.y < b.y1;

describe('SpatialHash', () => {
  it('finds boxes near a point and forgets removed owners', () => {
    const hash = new SpatialHash<Box>(32);
    hash.insert('a', [wall]);
    expect(hash.query(0, 95, 2)).toContain(wall);
    expect(hash.query(500, 500, 2)).toHaveLength(0);
    hash.remove('a');
    expect(hash.query(0, 95, 2)).toHaveLength(0);
  });
});

describe('collisions', () => {
  it('bounces off a facade at full speed, slower but still drivable (AE4)', () => {
    const world = new CollisionWorld();
    world.addStatic('chunk', [wall]);
    const car = new CarController({ x: 0, y: 0, z: 0 });
    simulate(car, world, 5, { throttle: 1 });
    expect(car.forwardSpeed).toBeLessThan(40);
    expect(inside(car.state.position, wall)).toBe(false);
    expect(car.state.position.z).toBeLessThan(wall.z - wall.d / 2);
    // still drivable: reversing works
    simulate(car, world, 2, { throttle: -1 });
    expect(car.forwardSpeed).toBeLessThan(0);
  });

  it('never tunnels through a thin skywalk at maximum speed', () => {
    const world = new CollisionWorld();
    const walkway: Box = { x: 0, z: 200, w: 40, d: 1, y0: 40, y1: 44 };
    world.addStatic('chunk', [walkway]);
    const car = new CarController({ x: 0, y: 42 - 1, z: 0 });
    car.state.mode = 'flight';
    car.state.deploy = 1;
    simulate(car, world, 6, { throttle: 1, boost: true });
    expect(car.state.position.z).toBeLessThan(200);
  });

  it('resolves a sphere inside a box along the shortest way out', () => {
    const v = { x: 0, y: 0, z: 10 };
    const p = { x: 0, y: 10, z: wall.z - wall.d / 2 + 1 };
    const hit = resolveSphere(p, v, 1, wall);
    expect(hit).toBe(true);
    expect(p.z).toBeCloseTo(wall.z - wall.d / 2 - 1);
    expect(v.z).toBeLessThanOrEqual(0);
  });

  it('lands on a roof and falls when driving off its edge', () => {
    const world = new CollisionWorld();
    const roof: Box = { x: 0, z: 0, w: 40, d: 40, y0: 0, y1: 30 };
    world.addStatic('chunk', [roof]);
    const car = new CarController({ x: 0, y: 60, z: 0 });
    car.state.mode = 'landing';
    car.state.deploy = 1;
    simulate(car, world, 6);
    expect(car.state.mode).toBe('ground');
    expect(car.state.position.y).toBeCloseTo(30, 1);
    simulate(car, world, 6, { throttle: 1 });
    expect(car.state.position.y).toBe(0);
    expect(car.state.mode).toBe('ground');
  });

  it('never lands below the street (AE2)', () => {
    const world = new CollisionWorld();
    const car = new CarController({ x: 0, y: 120, z: 0 });
    car.state.mode = 'landing';
    car.state.deploy = 1;
    let lowest = Infinity;
    for (let t = 0; t < 8; t += DT) {
      simulate(car, world, DT);
      lowest = Math.min(lowest, car.state.position.y);
    }
    expect(lowest).toBe(0);
  });

  it('pushes the car out of a vehicle it runs into', () => {
    const world = new CollisionWorld();
    world.setVehicles([{ x: 0, y: CAR_CENTER_Y, z: 30, radius: 2.2 }]);
    const car = new CarController({ x: 0, y: 0, z: 0 });
    simulate(car, world, 3, { throttle: 1 });
    const d = Math.hypot(car.state.position.x, car.state.position.y, car.state.position.z - 30);
    expect(d).toBeGreaterThanOrEqual(CAR_RADIUS + 2.2 - 0.05);
  });
});
