import { describe, expect, it } from 'vitest';
import { CarController, type DriveInput } from '../vehicle/controller';
import { CollisionWorld } from '../physics/collide';
import { lanesForChunk } from '../traffic/lanes';
import { CHUNK_SIZE } from './generator';
import { hasRailLine, railForChunk, TRAIN_PERIOD, TRAIN_SPEED, trainCars, VIADUCT } from './rail';

const DT = 1 / 60;
const idle: DriveInput = { throttle: 0, steer: 0, lift: 0, boost: false };
const railRow = (seed: number) => {
  for (let cz = -20; cz < 20; cz++) if (hasRailLine(seed, cz)) return cz;
  throw new Error('no rail line');
};

describe('elevated railway', () => {
  it('runs along some avenues, deterministically, continuous across chunks', () => {
    const cz = railRow(7);
    const a = railForChunk(7, 0, cz);
    const b = railForChunk(7, 1, cz);
    expect(a).toEqual(railForChunk(7, 0, cz));
    expect(a.deck.z).toBe(cz * CHUNK_SIZE);
    expect(a.deck.x + a.deck.w / 2).toBeCloseTo(b.deck.x - b.deck.w / 2);
    let lines = 0;
    for (let z = -30; z < 30; z++) if (hasRailLine(7, z)) lines++;
    expect(lines).toBeGreaterThan(10);
    expect(lines).toBeLessThan(35);
  });

  it('keeps pillars on the median, clear of ground lanes and crossings', () => {
    const cz = railRow(7);
    const { pillars } = railForChunk(7, 2, cz);
    const lanes = lanesForChunk(2, cz).filter((l) => l.kind === 'ground' && l.axis === 'x' && Math.abs(l.road - cz * CHUNK_SIZE) < 1);
    for (const p of pillars) {
      for (const lane of lanes) expect(Math.abs(lane.c - p.z)).toBeGreaterThan(p.d / 2 + 1.8 + 0.3);
      const local = ((p.x % 64) + 64) % 64;
      expect(local > 13 && local < 51).toBe(true);
    }
  });

  it('lets the car drive under the viaduct and bounces it off the deck (AE4)', () => {
    const cz = railRow(7);
    const rail = railForChunk(7, 0, cz);
    const world = new CollisionWorld();
    world.addStatic('rail', [rail.deck, ...rail.pillars]);
    // drive along the avenue, in the inner lane, under the deck
    const lane = lanesForChunk(0, cz).find((l) => l.kind === 'ground' && l.axis === 'x' && l.dir === 1 && Math.abs(l.road - cz * CHUNK_SIZE) < 1 && Math.abs(l.c - l.road) < 4)!;
    const car = new CarController({ x: 10, y: 0, z: lane.c }, Math.PI / 2);
    let hits = 0;
    for (let t = 0; t < 6; t += DT) {
      const prev = { ...car.state.position };
      car.state.floor = world.floorAt(prev.x, prev.z, prev.y);
      car.step(DT, { ...idle, throttle: 0.6 });
      if (world.resolveCar(car, prev)) hits++;
    }
    expect(hits).toBe(0);
    expect(car.state.position.x).toBeGreaterThan(80);
    // fly into the deck side
    // sphere centre (y + 1.8) level with the deck
    const flyer = new CarController({ x: 100, y: VIADUCT.deckBottom - 1, z: cz * CHUNK_SIZE - 30 }, 0);
    flyer.state.mode = 'flight';
    flyer.state.deploy = 1;
    for (let t = 0; t < 4; t += DT) {
      const prev = { ...flyer.state.position };
      flyer.step(DT, { ...idle, throttle: 1 });
      if (world.resolveCar(flyer, prev)) hits++;
    }
    expect(hits).toBeGreaterThan(0);
    expect(flyer.state.position.z).toBeLessThan(cz * CHUNK_SIZE);
  });

  it('runs trains on a fixed timetable', () => {
    const cz = railRow(7);
    const now = trainCars(7, cz, 100, -2000, 2000);
    const later = trainCars(7, cz, 100 + TRAIN_PERIOD / TRAIN_SPEED, -2000, 2000);
    expect(now.length).toBeGreaterThan(0);
    expect(later.map((c) => c.x.toFixed(2)).sort()).toEqual(now.map((c) => c.x.toFixed(2)).sort());
    for (const c of now) expect(c.y).toBeGreaterThan(VIADUCT.deckTop - 0.01);
  });
});
