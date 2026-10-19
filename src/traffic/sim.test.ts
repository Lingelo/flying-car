import { describe, expect, it } from 'vitest';
import { lanePoint, lanesForChunk, type Lane } from './lanes';
import { TrafficSim, VEHICLE_TYPES, type Vehicle } from './sim';

const DT = 1 / 30;
const lanesAround = (r: number) => {
  const all = new Map<string, Lane>();
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) for (const l of lanesForChunk(x, z)) all.set(l.id, l);
  return [...all.values()];
};

function oneLaneSim(lane: Lane) {
  const sim = new TrafficSim({ maxVehicles: 0, seed: 1, areaRadius: 800 });
  sim.setLanes([lane]);
  return sim;
}

const pos = (v: Vehicle) => lanePoint(v.lane, v.s, v.lateral);

describe('TrafficSim', () => {
  it('slows down behind a stopped player, then steers around after 2 s (AE7)', () => {
    const lane = lanesForChunk(0, 0).find((l) => l.kind === 'air' && l.axis === 'z' && l.dir === 1)!;
    const sim = oneLaneSim(lane);
    const v = sim.addVehicle(lane, -200, lane.speedLimit);
    const player = { ...lanePoint(lane, 0), vx: 0, vy: 0, vz: 0 };
    sim.setPlayer(player);
    let minGap = Infinity;
    let slowed = false;
    for (let t = 0; t < 30; t += DT) {
      sim.step(DT, t);
      const p = pos(v);
      const d = Math.hypot(p.x - player.x, p.y - player.y, p.z - player.z);
      minGap = Math.min(minGap, d);
      if (v.v < lane.speedLimit * 0.3) slowed = true;
    }
    expect(slowed).toBe(true);
    expect(minGap).toBeGreaterThan(4.5);
    // it went around the player and carried on
    expect(v.s).toBeGreaterThan(20);
  });

  it('lets the player fly with the flow without forced collisions (AE8)', () => {
    const lane = lanesForChunk(0, 0).find((l) => l.kind === 'air' && l.axis === 'z' && l.dir === 1)!;
    const sim = oneLaneSim(lane);
    for (let i = 0; i < 6; i++) sim.addVehicle(lane, -270 + i * 120, lane.speedLimit);
    const speed = lane.speedLimit * 0.9;
    let s = -60;
    let minGap = Infinity;
    for (let t = 0; t < 60; t += DT) {
      s += speed * DT;
      const p = lanePoint(lane, s);
      sim.setPlayer({ ...p, vx: 0, vy: 0, vz: speed });
      sim.step(DT, t);
      for (const v of sim.vehicles) {
        const q = pos(v);
        if (v.s < s) minGap = Math.min(minGap, Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z));
      }
    }
    expect(minGap).toBeGreaterThan(4.5);
  });

  it('bounces the player off a vehicle it rams (collision obstacles)', () => {
    const lane = lanesForChunk(0, 0).find((l) => l.kind === 'air')!;
    const sim = oneLaneSim(lane);
    sim.addVehicle(lane, 10, 0);
    sim.setPlayer({ ...lanePoint(lane, 0), vx: 0, vy: 0, vz: 0 });
    const obstacles = sim.obstaclesNear(lanePoint(lane, 0), 50);
    expect(obstacles).toHaveLength(1);
    expect(obstacles[0].radius).toBe(VEHICLE_TYPES[sim.vehicles[0].type].radius);
  });

  it('runs 10 simulated minutes without a collision between vehicles', () => {
    const sim = new TrafficSim({ maxVehicles: 220, seed: 7, areaRadius: 700 });
    sim.setLanes(lanesAround(2));
    sim.setPlayer({ x: 128, y: 0, z: 128, vx: 0, vy: 0, vz: 0 });
    let worstSameLane = Infinity;
    let worstCrossing = Infinity;
    for (let t = 0; t < 600; t += DT) {
      sim.step(DT, t);
      if (Math.round(t / DT) % 15 !== 0) continue;
      const byLane = new Map<string, Vehicle[]>();
      for (const v of sim.vehicles) (byLane.get(v.lane.id) ?? byLane.set(v.lane.id, []).get(v.lane.id)!).push(v);
      for (const list of byLane.values()) {
        list.sort((a, b) => a.s - b.s);
        for (let i = 1; i < list.length; i++) {
          const need = (VEHICLE_TYPES[list[i].type].length + VEHICLE_TYPES[list[i - 1].type].length) / 2;
          worstSameLane = Math.min(worstSameLane, list[i].s - list[i - 1].s - need);
        }
      }
      const ground = sim.vehicles.filter((v) => v.lane.kind === 'ground');
      const xs = ground.filter((v) => v.lane.axis === 'x').map(pos);
      for (const v of ground.filter((g) => g.lane.axis === 'z')) {
        const p = pos(v);
        for (const q of xs) worstCrossing = Math.min(worstCrossing, Math.hypot(p.x - q.x, p.z - q.z));
      }
    }
    expect(worstSameLane).toBeGreaterThan(0);
    expect(worstCrossing).toBeGreaterThan(2.5);
  });

  it('keeps the population around the player as it moves', () => {
    const sim = new TrafficSim({ maxVehicles: 120, seed: 3, areaRadius: 600 });
    for (let k = 0; k < 6; k++) {
      const cx = k * 2;
      const lanes = new Map<string, Lane>();
      for (let x = cx - 2; x <= cx + 2; x++) for (let z = -2; z <= 2; z++) for (const l of lanesForChunk(x, z)) lanes.set(l.id, l);
      sim.setLanes([...lanes.values()]);
      const player = { x: cx * 256 + 128, y: 100, z: 128, vx: 0, vy: 0, vz: 0 };
      sim.setPlayer(player);
      for (let t = 0; t < 5; t += DT) sim.step(DT, k * 5 + t);
      expect(sim.vehicles.length).toBe(120);
      for (const v of sim.vehicles) {
        const p = pos(v);
        expect(Math.hypot(p.x - player.x, p.z - player.z)).toBeLessThan(600 * 1.5);
      }
    }
  });

  it('stops ground traffic at red lights', () => {
    const lane = lanesForChunk(0, 0).find((l) => l.kind === 'ground' && l.axis === 'z' && l.dir === 1 && l.speedLimit === 12)!;
    const sim = oneLaneSim(lane);
    // z-axis lights are red during [0, 20) s; the next crossing is at s = 64
    const v = sim.addVehicle(lane, -40, lane.speedLimit);
    for (let t = 0; t < 18; t += DT) sim.step(DT, t);
    expect(v.v).toBeLessThan(0.5);
    expect(v.s).toBeLessThan(64 - 7);
    for (let t = 18; t < 36; t += DT) sim.step(DT, t);
    expect(v.s).toBeGreaterThan(64);
  });
});
