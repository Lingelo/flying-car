import type { Box } from '../city/generator';
import type { CarController, Vec3 } from '../vehicle/controller';
import { SpatialHash } from './spatialHash';

/** The car is a bounding sphere resting on the ground. */
export const CAR_RADIUS = 1.8;
export const CAR_CENTER_Y = CAR_RADIUS;
const RESTITUTION = 0.3;
const TANGENT_KEEP = 0.7;
const MIN_SPEED_FOR_BOUNCE = 0.5;

export interface SphereObstacle {
  x: number;
  y: number;
  z: number;
  radius: number;
}

/**
 * Pushes a sphere out of a box and reflects the velocity on the contact normal.
 * Mutates `p` and `v`; returns true on contact.
 */
export function resolveSphere(p: Vec3, v: Vec3, r: number, b: Box): boolean {
  const cx = Math.max(b.x - b.w / 2, Math.min(p.x, b.x + b.w / 2));
  const cy = Math.max(b.y0, Math.min(p.y, b.y1));
  const cz = Math.max(b.z - b.d / 2, Math.min(p.z, b.z + b.d / 2));
  let nx = p.x - cx;
  let ny = p.y - cy;
  let nz = p.z - cz;
  let dist = Math.hypot(nx, ny, nz);
  let push: number;
  if (dist > 1e-6) {
    if (dist >= r - 1e-3) return false;
    nx /= dist;
    ny /= dist;
    nz /= dist;
    push = r - dist;
  } else {
    // Centre inside the box: leave through the closest face.
    const faces: [number, number, number, number][] = [
      [b.x + b.w / 2 - p.x, 1, 0, 0],
      [p.x - (b.x - b.w / 2), -1, 0, 0],
      [b.y1 - p.y, 0, 1, 0],
      [p.z - (b.z - b.d / 2), 0, 0, -1],
      [b.z + b.d / 2 - p.z, 0, 0, 1],
    ];
    faces.sort((a, c) => a[0] - c[0]);
    [dist, nx, ny, nz] = faces[0];
    push = dist + r;
  }
  p.x += nx * push;
  p.y += ny * push;
  p.z += nz * push;
  bounce(v, nx, ny, nz);
  return true;
}

function bounce(v: Vec3, nx: number, ny: number, nz: number): void {
  const vn = v.x * nx + v.y * ny + v.z * nz;
  if (vn >= 0) return;
  const tx = v.x - vn * nx;
  const ty = v.y - vn * ny;
  const tz = v.z - vn * nz;
  const out = Math.abs(vn) > MIN_SPEED_FOR_BOUNCE ? -vn * RESTITUTION : 0;
  v.x = tx * TANGENT_KEEP + nx * out;
  v.y = ty * TANGENT_KEEP + ny * out;
  v.z = tz * TANGENT_KEEP + nz * out;
}

function resolveSphereSphere(p: Vec3, v: Vec3, r: number, o: SphereObstacle): boolean {
  const dx = p.x - o.x;
  const dy = p.y - o.y;
  const dz = p.z - o.z;
  const dist = Math.hypot(dx, dy, dz);
  const min = r + o.radius;
  if (dist >= min || dist < 1e-6) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  const nz = dz / dist;
  p.x += nx * (min - dist);
  p.y += ny * (min - dist);
  p.z += nz * (min - dist);
  bounce(v, nx, ny, nz);
  return true;
}

/** Static boxes of the loaded chunks plus moving traffic spheres. */
export class CollisionWorld {
  private readonly hash = new SpatialHash<Box>(32);
  private vehicles: SphereObstacle[] = [];

  addStatic(owner: string, boxes: Box[]): void {
    this.hash.insert(owner, boxes);
  }

  removeStatic(owner: string): void {
    this.hash.remove(owner);
  }

  setVehicles(vehicles: SphereObstacle[]): void {
    this.vehicles = vehicles;
  }

  /** Height of the highest roof under (x, z) that is not above the car, or 0 for the street. */
  floorAt(x: number, z: number, y: number): number {
    let floor = 0;
    for (const b of this.hash.query(x, z, 0)) {
      if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2 && b.y1 <= y + 0.5) floor = Math.max(floor, b.y1);
    }
    return floor;
  }

  /**
   * Moves the car's sphere from `prev` to its new position in sub-steps no longer than half its
   * radius (no tunnelling at full speed) and resolves contacts. Returns true on impact.
   */
  resolveCar(car: CarController, prev: Vec3): boolean {
    const s = car.state;
    const target = s.position;
    const dx = target.x - prev.x;
    const dy = target.y - prev.y;
    const dz = target.z - prev.z;
    const length = Math.hypot(dx, dy, dz);
    const steps = Math.max(1, Math.ceil(length / (CAR_RADIUS * 0.5)));
    const candidates = this.hash.query(prev.x + dx / 2, prev.z + dz / 2, CAR_RADIUS + length / 2 + 1);
    const nearby = this.vehicles.filter((o) => Math.hypot(o.x - target.x, o.z - target.z) < length + CAR_RADIUS + o.radius + 2);
    if (!candidates.length && !nearby.length) return false;

    const p = { x: prev.x, y: prev.y + CAR_CENTER_Y, z: prev.z };
    const v = { ...s.velocity };
    let hit = false;
    for (let i = 0; i < steps && !hit; i++) {
      p.x += dx / steps;
      p.y += dy / steps;
      p.z += dz / steps;
      for (const b of candidates) hit = resolveSphere(p, v, CAR_RADIUS, b) || hit;
      for (const o of nearby) hit = resolveSphereSphere(p, v, CAR_RADIUS, o) || hit;
    }
    s.position.x = p.x;
    s.position.y = Math.max(s.floor, p.y - CAR_CENTER_Y);
    s.position.z = p.z;
    if (hit) car.setVelocity(v);
    return hit;
  }
}
