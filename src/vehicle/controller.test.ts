import { describe, expect, it } from 'vitest';
import { CarController, type DriveInput } from './controller';
import { TUNING } from './tuning';

const DT = 1 / 60;
const idle: DriveInput = { throttle: 0, steer: 0, lift: 0, boost: false };
const run = (car: CarController, seconds: number, input: Partial<DriveInput> = {}) => {
  for (let t = 0; t < seconds; t += DT) car.step(DT, { ...idle, ...input });
};

describe('CarController', () => {
  it('takes off from a standstill in under 2 seconds (AE1)', () => {
    const car = new CarController();
    car.toggleFlight();
    expect(car.state.mode).toBe('takeoff');
    let elapsed = 0;
    while (car.state.mode !== 'flight' && elapsed < 5) {
      car.step(DT, idle);
      elapsed += DT;
    }
    expect(car.state.mode).toBe('flight');
    expect(elapsed).toBeLessThanOrEqual(2);
    expect(car.state.deploy).toBe(1);
    expect(car.state.position.y).toBeGreaterThan(3);
  });

  it('lands back on the ground when switching to ground mode (AE2)', () => {
    const car = new CarController();
    car.toggleFlight();
    run(car, 2);
    run(car, 3, { lift: 1 });
    expect(car.state.position.y).toBeGreaterThan(40);
    car.toggleFlight();
    expect(car.state.mode).toBe('landing');
    run(car, 10);
    expect(car.state.mode).toBe('ground');
    expect(car.state.position.y).toBe(0);
    expect(car.state.velocity.y).toBe(0);
    run(car, 2);
    expect(car.state.deploy).toBe(0);
  });

  it('never climbs above the ceiling (AE3)', () => {
    const car = new CarController();
    car.toggleFlight();
    run(car, 2);
    run(car, 60, { lift: 1, boost: true });
    expect(car.state.position.y).toBeCloseTo(TUNING.ceiling, 5);
    run(car, 5, { lift: 1 });
    expect(car.state.position.y).toBeLessThanOrEqual(TUNING.ceiling);
  });

  it('has no vertical thrust on the ground', () => {
    const car = new CarController();
    run(car, 3, { lift: 1, throttle: 1 });
    expect(car.state.position.y).toBe(0);
    expect(car.state.mode).toBe('ground');
  });

  it('accelerates to a top speed and boost goes faster', () => {
    const car = new CarController();
    run(car, 20, { throttle: 1 });
    const top = car.speed;
    expect(top).toBeGreaterThan(TUNING.ground.maxSpeed * 0.95);
    expect(top).toBeLessThanOrEqual(TUNING.ground.maxSpeed * 1.01);
    run(car, 20, { throttle: 1, boost: true });
    expect(car.speed).toBeGreaterThan(top * 1.2);
  });

  it('drifts in a tight turn at high speed, grips at low speed', () => {
    const fast = new CarController();
    run(fast, 12, { throttle: 1 });
    run(fast, 0.6, { throttle: 1, steer: 1 });
    const slow = new CarController();
    run(slow, 1, { throttle: 0.3 });
    run(slow, 0.6, { throttle: 0.3, steer: 1 });
    const slipAngle = (car: CarController) => Math.abs(car.lateralSpeed) / Math.max(1, car.speed);
    expect(slipAngle(fast)).toBeGreaterThan(0.08);
    expect(slipAngle(slow)).toBeLessThan(0.05);
  });

  it('turns right when steering right', () => {
    const car = new CarController();
    run(car, 2, { throttle: 1 });
    const before = car.forward();
    run(car, 0.5, { throttle: 1, steer: 1 });
    const after = car.forward();
    // the right of a car facing +z is -x: the heading rotates towards -x
    const cross = before.x * after.z - before.z * after.x;
    expect(cross).toBeGreaterThan(0);
  });

  it('brakes before reversing', () => {
    const car = new CarController();
    run(car, 3, { throttle: 1 });
    run(car, 0.5, { throttle: -1 });
    expect(car.forwardSpeed).toBeGreaterThan(0);
    run(car, 6, { throttle: -1 });
    expect(car.forwardSpeed).toBeLessThan(0);
    expect(car.forwardSpeed).toBeGreaterThanOrEqual(-TUNING.ground.reverseSpeed - 0.01);
  });
});

describe('CarController boost release', () => {
  it('bleeds off the extra boost speed instead of snapping back', () => {
    const car = new CarController();
    run(car, 25, { throttle: 1, boost: true });
    const boosted = car.forwardSpeed;
    car.step(DT, { ...idle, throttle: 1 });
    expect(boosted - car.forwardSpeed).toBeLessThan(2);
    run(car, 15, { throttle: 1 });
    expect(car.forwardSpeed).toBeLessThanOrEqual(TUNING.ground.maxSpeed * 1.02);
  });
});
