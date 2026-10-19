import { BLOCK_SIZE, CHUNK_SIZE, AVENUE_WIDTH, STREET_WIDTH } from '../city/generator';
import { Rng } from '../core/random';
import type { SphereObstacle } from '../physics/collide';
import { lanePoint, signalState, type Lane } from './lanes';

export interface VehicleType {
  length: number;
  radius: number;
  /** Fraction of the lane speed limit this type cruises at. */
  pace: number;
}

/** 0: hover sedan, 1: cargo van, 2: racer. */
export const VEHICLE_TYPES: VehicleType[] = [
  { length: 4.6, radius: 2.2, pace: 1 },
  { length: 7.2, radius: 3, pace: 0.82 },
  { length: 4.2, radius: 2, pace: 1.15 },
];

export interface Vehicle {
  id: number;
  lane: Lane;
  /** Abscissa along the lane axis (world coordinate). */
  s: number;
  /** Speed along the lane direction, >= 0. */
  v: number;
  /** Sideways offset from the lane centre, used to go around the player. */
  lateral: number;
  lateralTarget: number;
  type: number;
  /** Desired speed of this driver. */
  v0: number;
  /** Time spent stopped behind the player. */
  blocked: number;
}

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface TrafficOptions {
  maxVehicles: number;
  seed: number;
  /** Vehicles live within this distance of the player (m). */
  areaRadius: number;
}

// Intelligent Driver Model parameters, per lane kind.
const IDM = {
  air: { a: 4, b: 5, T: 1.1, s0: 8 },
  ground: { a: 2.5, b: 3.5, T: 1.3, s0: 3 },
};
const MAX_BRAKE = 9;
/** Beyond this deceleration a driver goes through an amber light rather than braking. */
const DILEMMA_DECEL = 6;
const PASS_CLEARANCE = 4.6;
const AVOID_AFTER = 2;
const LATERAL_SPEED = 4;
const SPAWN_GAP = 30;

const along = (lane: Lane, p: { x: number; z: number }) => (lane.axis === 'z' ? p.z : p.x) * lane.dir;
const across = (lane: Lane, p: { x: number; z: number }) => (lane.axis === 'z' ? p.x : p.z) - lane.c;

/** Air and street traffic around the player: lane following, red lights, reaction to the player. */
export class TrafficSim {
  readonly vehicles: Vehicle[] = [];
  private lanes: Lane[] = [];
  private laneIds = new Set<string>();
  private player: PlayerState | null = null;
  private readonly rng: Rng;
  private nextId = 1;

  constructor(private readonly options: TrafficOptions) {
    this.rng = new Rng(options.seed);
  }

  /** Lanes of the loaded chunks; vehicles on lanes that disappeared are recycled. */
  setLanes(lanes: Lane[]): void {
    this.lanes = lanes;
    this.laneIds = new Set(lanes.map((l) => l.id));
  }

  setPlayer(player: PlayerState | null): void {
    this.player = player;
  }

  setMaxVehicles(n: number): void {
    this.options.maxVehicles = n;
    if (this.vehicles.length > n) this.vehicles.length = n;
  }

  addVehicle(lane: Lane, s: number, v: number, type = 0): Vehicle {
    const vehicle: Vehicle = {
      id: this.nextId++,
      lane,
      s,
      v,
      lateral: 0,
      lateralTarget: 0,
      type,
      v0: lane.speedLimit * VEHICLE_TYPES[type].pace * this.rng.range(0.88, 1.08),
      blocked: 0,
    };
    this.vehicles.push(vehicle);
    return vehicle;
  }

  position(v: Vehicle): { x: number; y: number; z: number } {
    return lanePoint(v.lane, v.s, v.lateral);
  }

  /** Spheres of the vehicles near a point, for the player's collisions. */
  obstaclesNear(p: { x: number; y: number; z: number }, radius: number): SphereObstacle[] {
    const out: SphereObstacle[] = [];
    for (const v of this.vehicles) {
      const q = this.position(v);
      if (Math.abs(q.x - p.x) < radius && Math.abs(q.z - p.z) < radius && Math.abs(q.y - p.y) < radius)
        out.push({ x: q.x, y: q.y + (v.lane.kind === 'ground' ? 1 : 0), z: q.z, radius: VEHICLE_TYPES[v.type].radius });
    }
    return out;
  }

  step(dt: number, time: number): void {
    this.recycle();
    this.populate();

    const byLane = new Map<string, Vehicle[]>();
    for (const v of this.vehicles) {
      let list = byLane.get(v.lane.id);
      if (!list) byLane.set(v.lane.id, (list = []));
      list.push(v);
    }
    const signals = signalState(time);

    for (const list of byLane.values()) {
      const lane = list[0].lane;
      list.sort((a, b) => a.s * lane.dir - b.s * lane.dir);
      const idm = IDM[lane.kind];
      const playerOnLane = this.playerOnLane(lane);

      for (let i = 0; i < list.length; i++) {
        const me = list[i];
        const myLength = VEHICLE_TYPES[me.type].length;
        const myAlong = me.s * lane.dir;
        let gap = Infinity;
        let leaderSpeed = 0;

        const leader = list[i + 1];
        if (leader) {
          gap = leader.s * lane.dir - myAlong - (myLength + VEHICLE_TYPES[leader.type].length) / 2;
          leaderSpeed = leader.v;
        }

        let blockedByPlayer = false;
        if (playerOnLane && playerOnLane.along > myAlong && Math.abs(playerOnLane.across - me.lateral) < PASS_CLEARANCE) {
          const g = playerOnLane.along - myAlong - myLength / 2 - 2.5;
          if (g < gap) {
            gap = g;
            leaderSpeed = Math.max(0, playerOnLane.speed);
            blockedByPlayer = true;
          }
        }

        if (lane.kind === 'ground' && !(lane.axis === 'x' ? signals.x : signals.z)) {
          const stop = this.nextStopLine(lane, myAlong + myLength / 2);
          const g = stop - myAlong - myLength / 2;
          const needed = (me.v * me.v) / (2 * Math.max(g, 0.01));
          if (g < gap && needed < DILEMMA_DECEL) {
            gap = g;
            leaderSpeed = 0;
          }
        }

        // IDM acceleration.
        const dv = me.v - leaderSpeed;
        const desiredGap = idm.s0 + me.v * idm.T + (me.v * dv) / (2 * Math.sqrt(idm.a * idm.b));
        let accel = idm.a * (1 - (me.v / me.v0) ** 4);
        if (gap < Infinity) accel -= idm.a * (Math.max(0, desiredGap) / Math.max(gap, 0.1)) ** 2;
        accel = Math.max(-MAX_BRAKE, accel);
        me.v = Math.max(0, me.v + accel * dt);
        if (gap < 0.5) me.v = Math.min(me.v, leaderSpeed);
        me.s += lane.dir * me.v * dt;

        // Going around a player who stays in the way (air corridors are wide enough).
        if (blockedByPlayer && playerOnLane!.speed < 2 && gap < 40) me.blocked += dt;
        else if (!blockedByPlayer) me.blocked = 0;
        if (me.blocked > AVOID_AFTER && lane.kind === 'air') {
          const side = playerOnLane!.across > me.lateral ? -1 : 1;
          me.lateralTarget = side * Math.min(lane.halfWidth - 2, 7.5);
        } else if (!playerOnLane || playerOnLane.along < myAlong - 15) {
          me.lateralTarget = 0;
        }
        const dl = me.lateralTarget - me.lateral;
        me.lateral += Math.sign(dl) * Math.min(Math.abs(dl), LATERAL_SPEED * dt);
      }
    }
  }

  /** Where the player is relative to a lane, when inside its corridor. */
  private playerOnLane(lane: Lane): { along: number; across: number; speed: number } | null {
    const p = this.player;
    if (!p) return null;
    const verticalRoom = lane.kind === 'air' ? 8 : 3;
    if (Math.abs(p.y - lane.y) > verticalRoom) return null;
    const a = across(lane, p);
    if (Math.abs(a) > lane.halfWidth + 2) return null;
    const speed = (lane.axis === 'z' ? p.vz : p.vx) * lane.dir;
    return { along: along(lane, p), across: a, speed };
  }

  /**
   * Next stop line ahead of a vehicle front, in along-lane coordinates (world abscissa × dir).
   * Crossings sit every BLOCK_SIZE along the axis, avenues (wider) every CHUNK_SIZE.
   */
  private nextStopLine(lane: Lane, frontAlong: number): number {
    const front = frontAlong * lane.dir;
    const k0 = Math.floor(front / BLOCK_SIZE);
    let best = Infinity;
    for (let k = k0 - 1; k <= k0 + 2; k++) {
      const centre = k * BLOCK_SIZE;
      const width = centre % CHUNK_SIZE === 0 ? AVENUE_WIDTH : STREET_WIDTH;
      const stopAlong = (centre - lane.dir * (width / 2 + 1.5)) * lane.dir;
      if (stopAlong >= frontAlong - 0.5 && stopAlong < best) best = stopAlong;
    }
    return best;
  }

  private recycle(): void {
    const p = this.player;
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      let gone = !this.laneIds.has(v.lane.id);
      if (!gone && p) {
        const q = this.position(v);
        gone = Math.hypot(q.x - p.x, q.z - p.z) > this.options.areaRadius * 1.25;
      }
      if (gone) this.vehicles.splice(i, 1);
    }
  }

  private populate(): void {
    const p = this.player;
    if (!p || !this.lanes.length) return;
    const r = this.options.areaRadius;
    const candidates = this.lanes.filter((l) => Math.abs(across(l, p)) < r);
    if (!candidates.length) return;
    const initial = this.vehicles.length < this.options.maxVehicles * 0.5;
    for (let n = 0; n < 24 && this.vehicles.length < this.options.maxVehicles; n++) {
      const lane = this.rng.pick(candidates);
      const centre = lane.axis === 'z' ? p.z : p.x;
      const half = Math.sqrt(Math.max(0, r * r - across(lane, p) ** 2));
      // Fill everywhere at start, then feed from the upstream edge.
      const s = initial ? centre + this.rng.range(-half, half) : centre - lane.dir * half * this.rng.range(0.75, 1);
      if (lane.kind === 'ground') {
        const m = ((s % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE;
        if (m < 16 || m > BLOCK_SIZE - 16) continue;
      }
      if (this.vehicles.some((v) => v.lane.id === lane.id && Math.abs(v.s - s) < SPAWN_GAP)) continue;
      const type = lane.kind === 'ground' ? (this.rng.chance(0.2) ? 1 : 0) : this.rng.int(0, 2);
      this.addVehicle(lane, s, lane.speedLimit * 0.7, type);
    }
  }
}
