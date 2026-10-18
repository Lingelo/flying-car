import { TUNING } from './tuning';

export type CarMode = 'ground' | 'takeoff' | 'flight' | 'landing';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface DriveInput {
  /** -1 (brake / reverse) to 1 (accelerate). */
  throttle: number;
  /** -1 (left) to 1 (right). */
  steer: number;
  /** -1 (descend) to 1 (climb), flight only. */
  lift: number;
  boost: boolean;
}

export interface CarState {
  mode: CarMode;
  position: Vec3;
  velocity: Vec3;
  /** Heading: the car faces (sin yaw, 0, cos yaw). */
  yaw: number;
  /** Visual attitude, smoothed (radians). */
  roll: number;
  pitch: number;
  /** Thruster deployment, 0 (wheels) to 1 (flight). */
  deploy: number;
  /** Height of the surface under the car (street or roof), set by the world each step. */
  floor: number;
}

const GRAVITY = 25;

const approach = (value: number, target: number, rate: number, dt: number) => value + (target - value) * (1 - Math.exp(-rate * dt));

/**
 * Arcade car that drives and flies. Pure simulation: no rendering, so the feel can be unit tested.
 * Collisions are resolved outside (physics/collide) by adjusting position and velocity.
 */
export class CarController {
  readonly state: CarState;
  /** Last steering input, kept for the visual bank. */
  private steer = 0;

  constructor(position: Vec3 = { x: 0, y: 0, z: 0 }, yaw = 0) {
    this.state = { mode: 'ground', position: { ...position }, velocity: { x: 0, y: 0, z: 0 }, yaw, roll: 0, pitch: 0, deploy: 0, floor: 0 };
  }

  forward(): { x: number; z: number } {
    return { x: Math.sin(this.state.yaw), z: Math.cos(this.state.yaw) };
  }

  private right(): { x: number; z: number } {
    return { x: -Math.cos(this.state.yaw), z: Math.sin(this.state.yaw) };
  }

  /** Signed speed along the heading (m/s). */
  get forwardSpeed(): number {
    const f = this.forward();
    return this.state.velocity.x * f.x + this.state.velocity.z * f.z;
  }

  get lateralSpeed(): number {
    const r = this.right();
    return this.state.velocity.x * r.x + this.state.velocity.z * r.z;
  }

  /** Horizontal speed (m/s). */
  get speed(): number {
    return Math.hypot(this.state.velocity.x, this.state.velocity.z);
  }

  get airborne(): boolean {
    return this.state.mode !== 'ground';
  }

  /** Ground → take-off, flight → landing; a second press cancels a transition in progress. */
  toggleFlight(): void {
    const s = this.state;
    if (s.mode === 'ground') s.mode = 'takeoff';
    else if (s.mode === 'takeoff' || s.mode === 'flight') s.mode = 'landing';
    else s.mode = 'flight';
  }

  step(dt: number, input: DriveInput): void {
    const s = this.state;
    const flying = s.mode !== 'ground';
    const params = flying ? TUNING.flight : TUNING.ground;
    const boost = input.boost && input.throttle > 0;
    const maxSpeed = params.maxSpeed * (boost ? TUNING.boostSpeed : 1);
    const accel = params.accel * (boost ? TUNING.boostAccel : 1);

    // Steering first: the heading turns, the velocity stays in world space and is then pulled
    // towards the new heading by the tyre (or thruster) grip — which is what makes the car drift.
    const speedAlong = this.forwardSpeed;
    let yawRate: number;
    if (flying) {
      yawRate = params.turnRate * (0.6 + 0.4 * Math.min(1, Math.abs(speedAlong) / 30));
    } else {
      yawRate = (params.turnRate * Math.min(1, Math.abs(speedAlong) / 8)) / (1 + Math.abs(speedAlong) / 60);
      if (speedAlong < 0) yawRate = -yawRate;
    }
    s.yaw -= input.steer * yawRate * dt;

    // Longitudinal: throttle against quadratic drag, braking before reversing.
    let vf = this.forwardSpeed;
    let vr = this.lateralSpeed;
    if (input.throttle > 0) vf += accel * input.throttle * dt;
    else if (input.throttle < 0) vf += (vf > 0.5 ? params.brake : accel) * input.throttle * dt;
    const drag = (accel / (maxSpeed * maxSpeed)) * vf * Math.abs(vf);
    vf -= drag * dt;
    if (input.throttle === 0) vf = approach(vf, 0, flying ? 0.25 : 0.5, dt);
    vf = Math.max(-params.reverseSpeed, Math.min(vf, maxSpeed));

    // Lateral grip: lower when turning hard at speed, which lets the car drift.
    const drifting = !flying && Math.abs(input.steer) > 0.5 && Math.abs(speedAlong) > TUNING.ground.driftSpeed;
    const grip = flying ? TUNING.flight.grip : drifting ? TUNING.ground.driftGrip : TUNING.ground.grip;
    vr *= Math.exp(-grip * dt);

    const f = this.forward();
    const r = this.right();
    s.velocity.x = f.x * vf + r.x * vr;
    s.velocity.z = f.z * vf + r.z * vr;

    this.vertical(dt, input);

    s.position.x += s.velocity.x * dt;
    s.position.z += s.velocity.z * dt;
    s.position.y += s.velocity.y * dt;
    this.clampAltitude();

    // Visual attitude: bank into turns, nose follows the climb.
    this.steer = input.steer;
    const bankTarget = flying ? -this.steer * 0.45 * Math.min(1, this.speed / 40) : -this.steer * 0.05 * Math.min(1, this.speed / 30);
    s.roll = approach(s.roll, bankTarget, 4, dt);
    s.pitch = approach(s.pitch, flying ? Math.max(-0.35, Math.min(0.35, s.velocity.y / 60)) : 0, 4, dt);
  }

  private vertical(dt: number, input: DriveInput): void {
    const s = this.state;
    switch (s.mode) {
      case 'ground':
        // Wheels: fall when driving off a roof, otherwise stick to the surface.
        s.velocity.y = s.position.y > s.floor + 0.01 ? s.velocity.y - GRAVITY * dt : 0;
        s.deploy = Math.max(0, s.deploy - dt / TUNING.retractTime);
        break;
      case 'takeoff':
        s.deploy = Math.min(1, s.deploy + dt / TUNING.takeoffTime);
        s.velocity.y = TUNING.takeoffClimb;
        if (s.deploy >= 1) s.mode = 'flight';
        break;
      case 'flight': {
        const climb = TUNING.flight.climbRate * (input.boost ? TUNING.boostSpeed : 1);
        s.velocity.y = approach(s.velocity.y, input.lift * climb, TUNING.flight.climbResponse, dt);
        s.deploy = 1;
        break;
      }
      case 'landing':
        s.velocity.y = -Math.min(TUNING.flight.landingSpeed, Math.max(6, (s.position.y - s.floor) * 1.5));
        break;
    }
  }

  private clampAltitude(): void {
    const s = this.state;
    if (s.position.y >= TUNING.ceiling) {
      s.position.y = TUNING.ceiling;
      s.velocity.y = Math.min(0, s.velocity.y);
    }
    if (s.mode === 'ground') {
      if (s.position.y <= s.floor) {
        s.position.y = s.floor;
        s.velocity.y = 0;
      }
    } else if (s.mode === 'landing' && s.position.y <= s.floor) {
      s.position.y = s.floor;
      s.velocity.y = 0;
      s.mode = 'ground';
    } else if (s.mode === 'flight' && s.position.y < s.floor + TUNING.hoverMin) {
      s.position.y = s.floor + TUNING.hoverMin;
      s.velocity.y = Math.max(0, s.velocity.y);
    }
  }

  /** Called by collision resolution when the car hit something (reduces speed). */
  setVelocity(v: Vec3): void {
    this.state.velocity.x = v.x;
    this.state.velocity.y = v.y;
    this.state.velocity.z = v.z;
  }
}
