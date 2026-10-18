import { hash3 } from '../core/random';
import { QuadBuilder, type GeometryData } from '../render/geometryData';
import { CHUNK_SIZE, type Box } from './generator';

/** Viaduct profile (m): deck carried on median pillars, above the street traffic. */
export const VIADUCT = { deckBottom: 12, deckTop: 13.6, width: 9, pillarSpacing: 32, pillar: 1.6, track: 2.2 };
export const TRAIN_SPEED = 22;
/** Distance between two trains on the same track (m). */
export const TRAIN_PERIOD = 1400;
const CAR_LENGTH = 20;
const CARS = 6;

/** One east-west avenue (z = cz · 256) in three carries an elevated line, chosen by the seed. */
export function hasRailLine(seed: number, cz: number): boolean {
  return hash3(seed ^ 0x7a11, 0, cz) % 3 === 0;
}

export interface RailSegment {
  deck: Box;
  pillars: Box[];
}

/** Deck and pillars of the chunk's stretch of line (KTD4), for rendering and collisions. */
export function railForChunk(seed: number, cx: number, cz: number): RailSegment {
  if (!hasRailLine(seed, cz)) return { deck: { x: 0, z: 0, w: 0, d: 0, y0: 0, y1: 0 }, pillars: [] };
  const ox = cx * CHUNK_SIZE;
  const z = cz * CHUNK_SIZE;
  const deck: Box = { x: ox + CHUNK_SIZE / 2, z, w: CHUNK_SIZE, d: VIADUCT.width, y0: VIADUCT.deckBottom, y1: VIADUCT.deckTop };
  const pillars: Box[] = [];
  // Mid-block positions only (local 16, 48, 80…): never inside a crossing.
  for (let x = 16; x < CHUNK_SIZE; x += VIADUCT.pillarSpacing) {
    pillars.push({ x: ox + x, z, w: VIADUCT.pillar, d: VIADUCT.pillar, y0: 0, y1: VIADUCT.deckBottom });
  }
  return { deck, pillars };
}

export interface TrainCar {
  x: number;
  y: number;
  z: number;
  dir: 1 | -1;
}

/**
 * Cars of the trains on a line between xMin and xMax at time t: a periodic timetable, so trains
 * are where they should be without any simulation.
 */
export function trainCars(seed: number, cz: number, t: number, xMin: number, xMax: number): TrainCar[] {
  const cars: TrainCar[] = [];
  const offset = (hash3(seed ^ 0x7a12, 1, cz) % 1000) / 1000;
  for (const dir of [1, -1] as const) {
    const z = cz * CHUNK_SIZE + dir * VIADUCT.track;
    // Head of the train with index 0 at abscissa `head`, others every TRAIN_PERIOD.
    const head = (((dir * t * TRAIN_SPEED + offset * TRAIN_PERIOD) % TRAIN_PERIOD) + TRAIN_PERIOD) % TRAIN_PERIOD;
    const first = Math.floor((xMin - head) / TRAIN_PERIOD) - 1;
    const last = Math.ceil((xMax - head) / TRAIN_PERIOD) + 1;
    for (let k = first; k <= last; k++) {
      const h = head + k * TRAIN_PERIOD;
      for (let c = 0; c < CARS; c++) {
        const x = h - dir * (c * (CAR_LENGTH + 0.8) + CAR_LENGTH / 2);
        if (x >= xMin && x <= xMax) cars.push({ x, y: VIADUCT.deckTop, z, dir });
      }
    }
  }
  return cars;
}

const box = (q: QuadBuilder, b: Box, ox: number, oz: number, color: [number, number, number]) => {
  const x0 = b.x - b.w / 2 - ox;
  const x1 = b.x + b.w / 2 - ox;
  const z0 = b.z - b.d / 2 - oz;
  const z1 = b.z + b.d / 2 - oz;
  const { y0, y1 } = b;
  const info: [number, number, number, number] = [0, 0, 0, 0];
  const uv: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  q.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], uv, color, info);
  q.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], uv, color, info);
  q.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], uv, color, info);
  q.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], uv, color, info);
  q.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], uv, color, info);
  q.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], uv, color, info);
};

/** Concrete viaduct with parapets and rails, plus its cyan underside light strips. */
export function buildRailGeometry(segment: RailSegment, ox: number, oz: number): { structure: GeometryData; lights: GeometryData } {
  const structure = new QuadBuilder();
  const lights = new QuadBuilder();
  if (segment.pillars.length) {
    const concrete: [number, number, number] = [0.32, 0.31, 0.33];
    const d = segment.deck;
    box(structure, d, ox, oz, concrete);
    for (const side of [1, -1]) {
      box(structure, { x: d.x, z: d.z + side * (d.d / 2 - 0.15), w: d.w, d: 0.3, y0: d.y1, y1: d.y1 + 1.1 }, ox, oz, concrete);
      for (const r of [-0.75, 0.75])
        box(structure, { x: d.x, z: d.z + side * VIADUCT.track + r, w: d.w, d: 0.12, y0: d.y1, y1: d.y1 + 0.18 }, ox, oz, [0.45, 0.45, 0.48]);
      box(lights, { x: d.x, z: d.z + side * (d.d / 2 - 0.4), w: d.w, d: 0.15, y0: d.y0 - 0.08, y1: d.y0 }, ox, oz, [0.3, 2.2, 2.6]);
    }
    for (const p of segment.pillars) box(structure, p, ox, oz, concrete);
  }
  return { structure: structure.finish(), lights: lights.finish() };
}
