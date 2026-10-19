import { QuadBuilder, type GeometryData } from '../render/geometryData';
import { AVENUE_WIDTH, BLOCK_SIZE, CHUNK_SIZE, STREET_WIDTH, type Chunk } from './generator';

const ROAD_Y = 0.05;
/** Height and width of the concrete kerbs lining every street. */
export const KERB_HEIGHT = 0.14;
const KERB_WIDTH = 0.22;
const LINES = Array.from({ length: CHUNK_SIZE / BLOCK_SIZE + 1 }, (_, i) => ({
  at: i * BLOCK_SIZE,
  width: i % (CHUNK_SIZE / BLOCK_SIZE) === 0 ? AVENUE_WIDTH : STREET_WIDTH,
}));

export interface GroundGeometry {
  /** Street segments and intersections; `info` = (width, avenue, intersection, axis or 2 = scramble crossing). */
  roads: GeometryData;
  ground: GeometryData;
  water: GeometryData;
}

const up: [number, number, number] = [0, 1, 0];
const white: [number, number, number] = [1, 1, 1];

/** Ground plane, streets split at intersections (so markings stop there) and canals of a chunk. */
export function buildGroundGeometry(chunk: Chunk): GroundGeometry {
  const roads = new QuadBuilder();
  const { x: ox, z: oz } = chunk.origin;
  // Shibuya-style diagonal crossing where two avenues meet in the busy districts.
  const scramble = chunk.district === 'neon' || chunk.district === 'downtown';

  for (let i = 0; i < LINES.length - 1; i++) {
    const line = LINES[i];
    const avenue = line.width === AVENUE_WIDTH ? 1 : 0;
    const hw = line.width / 2;
    for (let k = 0; k < LINES.length - 1; k++) {
      const from = LINES[k].at + LINES[k].width / 2;
      const to = LINES[k + 1].at - LINES[k + 1].width / 2;
      // Street along z at x = line.at; v runs along the street in world metres (dash continuity).
      const vz0 = (oz + from) % 240;
      const vz1 = vz0 + (to - from);
      roads.quad(
        [[line.at - hw, ROAD_Y, to], [line.at + hw, ROAD_Y, to], [line.at + hw, ROAD_Y, from], [line.at - hw, ROAD_Y, from]],
        up,
        [[-hw, vz1], [hw, vz1], [hw, vz0], [-hw, vz0]],
        white,
        [line.width, avenue, 0, 1],
      );
      // Street along x at z = line.at.
      const vx0 = (ox + from) % 240;
      const vx1 = vx0 + (to - from);
      roads.quad(
        [[from, ROAD_Y, line.at + hw], [to, ROAD_Y, line.at + hw], [to, ROAD_Y, line.at - hw], [from, ROAD_Y, line.at - hw]],
        up,
        [[-hw, vx0], [-hw, vx1], [hw, vx1], [hw, vx0]],
        white,
        [line.width, avenue, 0, 0],
      );
    }
    for (let k = 0; k < LINES.length - 1; k++) {
      const a = LINES[k];
      const ha = a.width / 2;
      roads.quad(
        [[line.at - hw, ROAD_Y, a.at + ha], [line.at + hw, ROAD_Y, a.at + ha], [line.at + hw, ROAD_Y, a.at - ha], [line.at - hw, ROAD_Y, a.at - ha]],
        up,
        [[-hw, ha], [hw, ha], [hw, -ha], [-hw, -ha]],
        white,
        [line.width, avenue, 1, scramble && i === 0 && k === 0 ? 2 : 0],
      );
    }
  }

  const ground = new QuadBuilder();
  // Kerbs along both edges of each street segment between intersections (info.x = 1).
  const kerb = (x0: number, z0: number, x1: number, z1: number, along: 'x' | 'z', facing: 1 | -1) => {
    const h = KERB_HEIGHT;
    const info: [number, number, number, number] = [1, 0, 0, 0];
    const len = along === 'z' ? z1 - z0 : x1 - x0;
    const uv: [number, number][] = [[0, 0], [len, 0], [len, 0.3], [0, 0.3]];
    ground.quad([[x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0]], up, uv, white, info);
    // Faces towards the road (`facing`) and towards the sidewalk.
    for (const side of [facing, -facing]) {
      if (along === 'z') {
        const x = side > 0 ? x1 : x0;
        const quad: [number, number, number][] = side > 0 ? [[x, 0, z1], [x, 0, z0], [x, h, z0], [x, h, z1]] : [[x, 0, z0], [x, 0, z1], [x, h, z1], [x, h, z0]];
        ground.quad(quad, [side, 0, 0], uv, white, info);
      } else {
        const z = side > 0 ? z1 : z0;
        const quad: [number, number, number][] = side > 0 ? [[x0, 0, z], [x1, 0, z], [x1, h, z], [x0, h, z]] : [[x1, 0, z], [x0, 0, z], [x0, h, z], [x1, h, z]];
        ground.quad(quad, [0, 0, side], uv, white, info);
      }
    }
  };
  for (let i = 0; i < LINES.length; i++) {
    const line = LINES[i];
    const hw = line.width / 2;
    for (let k = 0; k < LINES.length - 1; k++) {
      const from = LINES[k].at + LINES[k].width / 2;
      const to = LINES[k + 1].at - LINES[k + 1].width / 2;
      for (const s of [-1, 1] as const) {
        const inner = line.at + s * hw;
        const outer = inner + s * KERB_WIDTH;
        const lo = Math.min(inner, outer);
        const hi = Math.max(inner, outer);
        if (lo >= 0 && hi <= CHUNK_SIZE) {
          kerb(lo, from, hi, to, 'z', s > 0 ? -1 : 1);
          kerb(from, lo, to, hi, 'x', s > 0 ? -1 : 1);
        }
      }
    }
  }
  ground.quad(
    [[0, 0, CHUNK_SIZE], [CHUNK_SIZE, 0, CHUNK_SIZE], [CHUNK_SIZE, 0, 0], [0, 0, 0]],
    up,
    [[ox, oz + CHUNK_SIZE], [ox + CHUNK_SIZE, oz + CHUNK_SIZE], [ox + CHUNK_SIZE, oz], [ox, oz]].map(([u, v]) => [u % 512, v % 512]) as [number, number][],
    white,
    [0, 0, 0, 0],
  );

  const water = new QuadBuilder();
  for (const w of chunk.water) {
    const x0 = w.x - w.w / 2 - ox;
    const x1 = w.x + w.w / 2 - ox;
    const z0 = w.z - w.d / 2 - oz;
    const z1 = w.z + w.d / 2 - oz;
    water.quad([[x0, ROAD_Y, z1], [x1, ROAD_Y, z1], [x1, ROAD_Y, z0], [x0, ROAD_Y, z0]], up, [[x0, z1], [x1, z1], [x1, z0], [x0, z0]], white, [0, 0, 0, 0]);
  }

  return { roads: roads.finish(), ground: ground.finish(), water: water.finish() };
}
