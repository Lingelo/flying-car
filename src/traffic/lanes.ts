import { AVENUE_WIDTH, BLOCK_SIZE, CHUNK_SIZE } from '../city/generator';

/** Altitudes of the air-traffic tiers (m). Corridors along x fly 10 m higher than along z. */
export const AIR_TIERS = [80, 150, 250, 400];
const X_AXIS_OFFSET = 10;
export const BEACON_SPACING = 50;
const BEACON_LATERAL = 7;
const LINES_PER_CHUNK = CHUNK_SIZE / BLOCK_SIZE;

export interface Lane {
  id: string;
  kind: 'air' | 'ground';
  /** Direction the lane runs along. */
  axis: 'x' | 'z';
  /** Lane centre on the other axis (x for axis z, z for axis x). */
  c: number;
  /** Centre line of the street below. */
  road: number;
  y: number;
  dir: 1 | -1;
  /** Air tier index, -1 on the ground. */
  tier: number;
  speedLimit: number;
  /** Room on each side of the lane centre for avoidance. */
  halfWidth: number;
}

const mod2 = (n: number) => ((n % 2) + 2) % 2;

/** Lanes running through a chunk: air corridors above its avenues, ground lanes on all its streets. */
export function lanesForChunk(cx: number, cz: number): Lane[] {
  const lanes: Lane[] = [];
  for (const axis of ['z', 'x'] as const) {
    const origin = axis === 'z' ? cx * CHUNK_SIZE : cz * CHUNK_SIZE;
    const lineBase = (axis === 'z' ? cx : cz) * LINES_PER_CHUNK;
    for (let i = 0; i < LINES_PER_CHUNK; i++) {
      const road = origin + i * BLOCK_SIZE;
      const line = lineBase + i;
      const avenue = i === 0;
      if (avenue) {
        AIR_TIERS.forEach((altitude, tier) => {
          lanes.push({
            id: `air:${axis}:${line}:${tier}`,
            kind: 'air',
            axis,
            c: road,
            road,
            y: altitude + (axis === 'x' ? X_AXIS_OFFSET : 0),
            dir: mod2(tier + line / LINES_PER_CHUNK) === 0 ? 1 : -1,
            tier,
            speedLimit: 45 + tier * 6,
            halfWidth: AVENUE_WIDTH / 2,
          });
        });
      }
      const offsets = avenue ? [2, 6, 10] : [3.5];
      for (const dir of [1, -1] as const) {
        offsets.forEach((offset, k) => {
          // Right-hand traffic: facing +z the right is -x, facing +x the right is +z.
          const c = axis === 'z' ? road - dir * offset : road + dir * offset;
          lanes.push({
            id: `g:${axis}:${line}:${dir}:${k}`,
            kind: 'ground',
            axis,
            c,
            road,
            y: 0,
            dir,
            tier: -1,
            speedLimit: avenue ? 19 - k * 2 : 12,
            halfWidth: 1.8,
          });
        });
      }
    }
  }
  return lanes;
}

/** World position at abscissa `s` along the lane axis, optionally shifted sideways. */
export function lanePoint(lane: Lane, s: number, lateral = 0): { x: number; y: number; z: number } {
  return lane.axis === 'z' ? { x: lane.c + lateral, y: lane.y, z: s } : { x: s, y: lane.y, z: lane.c + lateral };
}

export interface Beacon {
  x: number;
  y: number;
  z: number;
  axis: 'x' | 'z';
  tier: number;
  side: 1 | -1;
}

/** Floating guide lights on both edges of the air corridors of a chunk. */
export function beaconsForChunk(cx: number, cz: number): Beacon[] {
  const beacons: Beacon[] = [];
  for (const lane of lanesForChunk(cx, cz)) {
    if (lane.kind !== 'air') continue;
    const start = lane.axis === 'z' ? cz * CHUNK_SIZE : cx * CHUNK_SIZE;
    for (let s = Math.ceil(start / BEACON_SPACING) * BEACON_SPACING; s < start + CHUNK_SIZE; s += BEACON_SPACING) {
      for (const side of [1, -1] as const) {
        const p = lanePoint(lane, s, side * BEACON_LATERAL);
        beacons.push({ ...p, axis: lane.axis, tier: lane.tier, side });
      }
    }
  }
  return beacons;
}

const SIGNAL_CYCLE = 40;

/** City-wide traffic lights: green for one axis at a time, 3 s all-red in between. */
export function signalState(time: number): { x: boolean; z: boolean } {
  const t = ((time % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
  return { x: t < 17, z: t >= 20 && t < 37 };
}
