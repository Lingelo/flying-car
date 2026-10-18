import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { lanesForChunk } from './lanes';
import { TrafficSim } from './sim';
import { TrafficRender } from './trafficRender';

const setup = () => {
  const sim = new TrafficSim({ maxVehicles: 0, seed: 1, areaRadius: 500 });
  const lanes = lanesForChunk(0, 0);
  sim.setLanes(lanes);
  const render = new TrafficRender(64);
  return { sim, lanes, render };
};

const visible = (render: TrafficRender) => render.bodies.reduce((n, m) => n + m.count, 0);

describe('TrafficRender', () => {
  it('shows one instance per simulated vehicle', () => {
    const { sim, lanes, render } = setup();
    sim.addVehicle(lanes[0], 10, 0, 0);
    sim.addVehicle(lanes[1], 20, 0, 1);
    sim.addVehicle(lanes[2], 30, 0, 2);
    sim.addVehicle(lanes[3], 40, 0, 0);
    render.update(sim, 0);
    expect(visible(render)).toBe(4);
    expect(render.bodies[0].count).toBe(2);
  });

  it('hides instances of vehicles that left', () => {
    const { sim, lanes, render } = setup();
    sim.addVehicle(lanes[0], 10, 0, 0);
    sim.addVehicle(lanes[0], 60, 0, 0);
    render.update(sim, 0);
    sim.vehicles.pop();
    render.update(sim, 0);
    expect(visible(render)).toBe(1);
  });

  it('places and orients an instance along its lane', () => {
    const { sim, lanes, render } = setup();
    const lane = lanes.find((l) => l.kind === 'air' && l.axis === 'x' && l.dir === 1)!;
    sim.addVehicle(lane, 33, 0, 0);
    render.update(sim, 0);
    const m = new THREE.Matrix4();
    render.bodies[0].getMatrixAt(0, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    expect(p.x).toBeCloseTo(33);
    expect(p.z).toBeCloseTo(lane.c);
    // model front is +z: a vehicle heading +x is rotated by +90° around y
    const front = new THREE.Vector3(0, 0, 1).applyMatrix4(m.extractRotation(m));
    expect(front.x).toBeCloseTo(1, 1);
  });

  it('never shows more instances than its capacity', () => {
    const { sim, lanes, render } = setup();
    for (let i = 0; i < 200; i++) sim.addVehicle(lanes[i % lanes.length], i * 10, 0, 0);
    render.update(sim, 0);
    expect(render.bodies[0].count).toBeLessThanOrEqual(64);
  });
});
