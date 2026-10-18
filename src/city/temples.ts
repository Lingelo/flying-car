import { Rng, hash3 } from '../core/random';
import { QuadBuilder, type GeometryData } from '../render/geometryData';
import type { Box, Chunk } from './generator';
import { BLOCK_SPAN, templeBlock } from './reserved';
import { SURFACE, type Surface } from '../render/materials/surface';

type C3 = [number, number, number];
type V3 = [number, number, number];

export interface Temple {
  boxes: Box[];
  props: GeometryData;
  glow: GeometryData;
}

const WOOD: C3 = [0.32, 0.07, 0.05];
const WALL: C3 = [0.72, 0.69, 0.62];
const STONE: C3 = [0.42, 0.41, 0.4];
const ROOF: C3 = [0.1, 0.12, 0.12];
const VERMILION: C3 = [0.85, 0.2, 0.06];

const uv: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
/** Photo texture of each temple colour: lacquered or bare wood, plaster and stone, tiled roofs. */
const surfaceOf = (colour: C3): Surface =>
  colour === WOOD || colour === VERMILION ? SURFACE.WOOD : colour === ROOF ? SURFACE.ROOF_TILES : colour === WALL || colour === STONE ? SURFACE.CONCRETE : SURFACE.METAL;

function box(q: QuadBuilder, b: Box, colour: C3): void {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
  const { y0, y1 } = b;
  const info: [number, number, number, number] = [surfaceOf(colour), 0, 0, 0];
  q.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], uv, colour, info);
  q.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], uv, colour, info);
  q.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], uv, colour, info);
  q.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], uv, colour, info);
  q.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], uv, colour, info);
  q.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], uv, colour, info);
}

function quadNormal(a: V3, b: V3, c: V3): V3 {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

/**
 * Hip roof with upturned eaves: rows from the eave to the ridge along a concave profile, the
 * classic temple silhouette.
 */
function curvedRoof(q: QuadBuilder, cx: number, cz: number, eaveY: number, ridgeY: number, halfW: number, halfD: number, ridgeHalf: number): void {
  const rows = 5;
  const at = (f: number) => ({
    y: eaveY + (ridgeY - eaveY) * f ** 1.7,
    hw: halfW + (ridgeHalf - halfW) * f,
    hd: halfD * (1 - f),
  });
  for (let r = 0; r < rows; r++) {
    const a = at(r / rows);
    const b = at((r + 1) / rows);
    const faces: [V3, V3, V3, V3][] = [
      [[cx - a.hw, a.y, cz - a.hd], [cx + a.hw, a.y, cz - a.hd], [cx + b.hw, b.y, cz - b.hd], [cx - b.hw, b.y, cz - b.hd]],
      [[cx + a.hw, a.y, cz + a.hd], [cx - a.hw, a.y, cz + a.hd], [cx - b.hw, b.y, cz + b.hd], [cx + b.hw, b.y, cz + b.hd]],
      [[cx + a.hw, a.y, cz - a.hd], [cx + a.hw, a.y, cz + a.hd], [cx + b.hw, b.y, cz + b.hd], [cx + b.hw, b.y, cz - b.hd]],
      [[cx - a.hw, a.y, cz + a.hd], [cx - a.hw, a.y, cz - a.hd], [cx - b.hw, b.y, cz - b.hd], [cx - b.hw, b.y, cz + b.hd]],
    ];
    for (const f of faces) q.quad(f, quadNormal(f[0], f[1], f[2]), uv, ROOF, [SURFACE.ROOF_TILES, 0, 0, 0]);
  }
}

/** Temple grounds on the reserved block: platform, hall with a curved roof, torii, stone lanterns. */
export function buildTemple(seed: number, chunk: Chunk): Temple {
  const block = templeBlock(seed, chunk.cx, chunk.cz, chunk.district);
  const props = new QuadBuilder();
  const glow = new QuadBuilder();
  const boxes: Box[] = [];
  if (!block) return { boxes, props: props.finish(), glow: glow.finish() };
  const rng = new Rng(hash3(seed ^ 0x7e3c, chunk.cx, chunk.cz));
  // Local coordinates (relative to the chunk origin), centred on the block interior.
  const cx = block.i * BLOCK_SPAN + BLOCK_SPAN / 2;
  const cz = block.j * BLOCK_SPAN + BLOCK_SPAN / 2 + 3;
  const scale = rng.range(0.85, 1.1);
  const hallW = 18 * scale;
  const hallD = 12 * scale;
  const hallH = 6.5 * scale;

  const local = (b: Box): Box => ({ ...b, x: b.x + chunk.origin.x, z: b.z + chunk.origin.z });
  const solid = (b: Box, colour: C3) => {
    box(props, b, colour);
    boxes.push(local(b));
  };

  solid({ x: cx, z: cz, w: hallW + 8, d: hallD + 8, y0: 0, y1: 1.1 }, STONE);
  solid({ x: cx, z: cz, w: hallW, d: hallD, y0: 1.1, y1: 1.1 + hallH }, WALL);
  // Wooden posts and beams on the facade.
  for (let k = 0; k <= 6; k++) {
    const x = cx - hallW / 2 + (k * hallW) / 6;
    box(props, { x, z: cz - hallD / 2 - 0.2, w: 0.5, d: 0.5, y0: 1.1, y1: 1.1 + hallH }, WOOD);
  }
  box(props, { x: cx, z: cz - hallD / 2 - 0.25, w: hallW + 0.4, d: 0.5, y0: 1.1 + hallH - 0.8, y1: 1.1 + hallH }, WOOD);
  curvedRoof(props, cx, cz, 1.1 + hallH - 0.3, 1.1 + hallH + 6.5 * scale, hallW / 2 + 3.2, hallD / 2 + 3.2, hallW * 0.28);
  boxes.push(local({ x: cx, z: cz, w: hallW + 4, d: hallD + 4, y0: 1.1 + hallH, y1: 1.1 + hallH + 6.5 * scale }));

  // Torii gate on the path from the street (towards -z).
  const tz = block.j * BLOCK_SPAN + 11;
  const span = 6.4;
  for (const side of [-1, 1]) solid({ x: cx + (side * span) / 2, z: tz, w: 0.7, d: 0.7, y0: 0, y1: 7 }, VERMILION);
  box(props, { x: cx, z: tz, w: span + 1.2, d: 0.5, y0: 5.7, y1: 6.2 }, VERMILION);
  box(props, { x: cx, z: tz, w: span + 3.2, d: 0.8, y0: 7, y1: 7.5 }, VERMILION);
  box(props, { x: cx, z: tz, w: span + 3.8, d: 0.9, y0: 7.5, y1: 7.8 }, [0.08, 0.06, 0.06]);
  // Stone lanterns along the path, lit at night.
  for (const side of [-1, 1]) {
    for (const z of [tz + 6, tz + 12]) {
      const x = cx + side * 3.4;
      solid({ x, z, w: 0.8, d: 0.8, y0: 0, y1: 1.4 }, STONE);
      box(glow, { x, z, w: 0.6, d: 0.6, y0: 1.4, y1: 1.9 }, [2.4, 1.5, 0.5]);
      box(props, { x, z, w: 1.1, d: 1.1, y0: 1.9, y1: 2.2 }, STONE);
    }
  }
  // Lanterns under the eaves.
  for (let k = 0; k < 5; k++) {
    box(glow, { x: cx - hallW / 2 + 1.5 + (k * (hallW - 3)) / 4, z: cz - hallD / 2 - 1.8, w: 0.5, d: 0.5, y0: 1.1 + hallH - 1.6, y1: 1.1 + hallH - 0.9 }, [2.6, 0.4, 0.15]);
  }
  return { boxes, props: props.finish(), glow: glow.finish() };
}
