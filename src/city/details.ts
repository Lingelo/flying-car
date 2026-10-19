import { Rng, hash3 } from '../core/random';
import { QuadBuilder, type GeometryData } from '../render/geometryData';
import { SURFACE, type Surface } from '../render/materials/surface';
import type { Box, Chunk } from './generator';

type C3 = [number, number, number];
type V3 = [number, number, number];

export type RoofKind = 'parapet' | 'hut' | 'ac' | 'tank' | 'mast' | 'dish' | 'helipad' | 'crane';

/** Equipment standing on a roof: footprint (x, z, w, d) on the roof at height y, h tall. */
export interface RoofItem {
  kind: RoofKind;
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** Rotation about y (radians), for dishes and crane jibs. */
  angle: number;
  roof: Box;
}

/** Air conditioner or drain pipe on the outside of a wall facing (nx, nz); y is its bottom. */
export interface WallItem {
  kind: 'ac' | 'pipe';
  x: number;
  y: number;
  z: number;
  /** Width along the wall, height and depth out of it. */
  w: number;
  h: number;
  depth: number;
  nx: number;
  nz: number;
  tier: Box;
}

export interface Details {
  roof: RoofItem[];
  wall: WallItem[];
}

const WALLS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const FLOOR = 3.5;
/** Ground-floor shops (facade shader) end here: wall equipment starts above. */
const SHOPS_TOP = 4.5;

/**
 * Roof and wall equipment of a chunk (R4), pure and deterministic per seed (AE4): a parapet on
 * every roof, stair huts, air conditioners, water tanks, masts, dishes, helipads on tall towers and
 * the odd crane; air conditioners and drain pipes on the walls of low-rise districts.
 */
export function placeDetails(chunk: Chunk, seed: number): Details {
  const rng = new Rng(hash3(seed ^ 0x5d17, chunk.cx, chunk.cz));
  const roof: RoofItem[] = [];
  const wall: WallItem[] = [];
  const lowRise = chunk.district !== 'downtown';

  for (const b of chunk.buildings) {
    const t = b.tiers[b.tiers.length - 1];
    const taken: { x: number; z: number; w: number; d: number }[] = [];
    const add = (kind: RoofKind, w: number, d: number, h: number, margin = 0.8, angle = 0): boolean => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const fx = t.w / 2 - margin - w / 2;
        const fz = t.d / 2 - margin - d / 2;
        if (fx < 0 || fz < 0) return false;
        const x = t.x + rng.range(-fx, fx);
        const z = t.z + rng.range(-fz, fz);
        const clear = taken.every((o) => Math.abs(o.x - x) > (o.w + w) / 2 + 0.4 || Math.abs(o.z - z) > (o.d + d) / 2 + 0.4);
        if (!clear) continue;
        taken.push({ x, z, w, d });
        roof.push({ kind, x, y: t.y1, z, w, d, h, angle, roof: t });
        return true;
      }
      return false;
    };

    roof.push({ kind: 'parapet', x: t.x, y: t.y1, z: t.z, w: t.w, d: t.d, h: 1.0, angle: 0, roof: t });
    const small = Math.min(t.w, t.d);
    if (t.y1 > 120 && small >= 20 && rng.chance(0.7)) {
      const size = small - 5;
      roof.push({ kind: 'helipad', x: t.x, y: t.y1, z: t.z, w: size, d: size, h: 0.15, angle: 0, roof: t });
      taken.push({ x: t.x, z: t.z, w: size, d: size });
    }
    add('hut', 3.6, 3.0, 3.2);
    const acs = Math.max(2, Math.min(14, Math.floor((t.w * t.d) / 70)));
    for (let i = 0; i < acs; i++) add('ac', 1.3, 0.9, 1.0);
    if (t.y1 < 90 && rng.chance(0.5)) add('tank', 2.6, 2.6, 4.0);
    if (rng.chance(0.55)) add('mast', 0.4, 0.4, rng.range(6, 18));
    if (rng.chance(0.4)) add('dish', 1.6, 1.6, 2.0, 0.8, rng.range(0, Math.PI * 2));
    if (t.y1 > 50 && rng.chance(0.06)) add('crane', 2.2, 2.2, rng.range(22, 34), 2, rng.range(0, Math.PI * 2));

    if (!lowRise) continue;
    const base = b.tiers[0];
    for (const [nx, nz] of WALLS) {
      const wallW = nx === 0 ? base.w : base.d;
      if (wallW < 5 || base.y1 < SHOPS_TOP + FLOOR) continue;
      const floors = Math.floor((base.y1 - SHOPS_TOP - 1) / FLOOR);
      const units = Math.min(16, Math.floor(rng.range(0.15, 0.45) * floors * (wallW / 4)));
      const at = (along: number, out: number) => ({
        x: base.x + (nx * base.w) / 2 + nx * out + nz * along,
        z: base.z + (nz * base.d) / 2 + nz * out - nx * along,
      });
      for (let i = 0; i < units; i++) {
        const along = rng.range(-(wallW / 2 - 1), wallW / 2 - 1);
        const y = SHOPS_TOP + rng.int(0, floors - 1) * FLOOR + 0.3;
        const p = at(along, 0.2);
        wall.push({ kind: 'ac', x: p.x, y, z: p.z, w: 0.8, h: 0.55, depth: 0.36, nx, nz, tier: base });
      }
      if (rng.chance(0.6)) {
        const p = at(rng.range(-(wallW / 2 - 0.3), wallW / 2 - 0.3), 0.08);
        wall.push({ kind: 'pipe', x: p.x, y: SHOPS_TOP, z: p.z, w: 0.12, h: base.y1 - SHOPS_TOP - 0.3, depth: 0.12, nx, nz, tier: base });
      }
    }
  }
  return { roof, wall };
}

const UV: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
const GREY: C3 = [0.55, 0.55, 0.56];
const DARK: C3 = [0.1, 0.1, 0.11];
const CONCRETE: C3 = [0.42, 0.41, 0.4];
const WHITE_PAINT: C3 = [0.8, 0.8, 0.78];
const PAD: C3 = [0.13, 0.14, 0.15];
const YELLOW: C3 = [0.75, 0.6, 0.12];

/**
 * Box centred on (x, z) with its base at y, rotated by `angle` about y and tilted by `tilt` about
 * its own x axis (dishes). Faces carry the surface kind for the photo textures.
 */
function cuboid(q: QuadBuilder, x: number, y: number, z: number, w: number, h: number, d: number, colour: C3, surface: Surface, angle = 0, tilt = 0): void {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const local = (lx: number, ly: number, lz: number): V3 => {
    // Tilt about x through the box centre, then rotate about y.
    const cy = ly - h / 2;
    const ty = cy * ct - lz * st + h / 2;
    const tz = cy * st + lz * ct;
    return [x + lx * ca + tz * sa, y + ty, z - lx * sa + tz * ca];
  };
  const axis = (lx: number, ly: number, lz: number): V3 => {
    const ty = ly * ct - lz * st;
    const tz = ly * st + lz * ct;
    return [lx * ca + tz * sa, ty, -lx * sa + tz * ca];
  };
  const [hw, hd] = [w / 2, d / 2];
  const info: [number, number, number, number] = [surface, 0, 0, 0];
  const faces: [V3[], V3][] = [
    [[local(-hw, 0, hd), local(hw, 0, hd), local(hw, h, hd), local(-hw, h, hd)], axis(0, 0, 1)],
    [[local(hw, 0, hd), local(hw, 0, -hd), local(hw, h, -hd), local(hw, h, hd)], axis(1, 0, 0)],
    [[local(hw, 0, -hd), local(-hw, 0, -hd), local(-hw, h, -hd), local(hw, h, -hd)], axis(0, 0, -1)],
    [[local(-hw, 0, -hd), local(-hw, 0, hd), local(-hw, h, hd), local(-hw, h, -hd)], axis(-1, 0, 0)],
    [[local(-hw, h, hd), local(hw, h, hd), local(hw, h, -hd), local(-hw, h, -hd)], axis(0, 1, 0)],
    [[local(-hw, 0, -hd), local(hw, 0, -hd), local(hw, 0, hd), local(-hw, 0, hd)], axis(0, -1, 0)],
  ];
  for (const [quad, n] of faces) q.quad(quad as [V3, V3, V3, V3], n, UV, colour, info);
}

/** Upright prism with `sides` faces (tanks), base at y. */
function prism(q: QuadBuilder, x: number, y: number, z: number, r: number, h: number, sides: number, colour: C3, surface: Surface): void {
  const info: [number, number, number, number] = [surface, 0, 0, 0];
  const at = (i: number, yy: number): V3 => [x + Math.cos((i / sides) * Math.PI * 2) * r, yy, z + Math.sin((i / sides) * Math.PI * 2) * r];
  for (let i = 0; i < sides; i++) {
    const a = ((i + 0.5) / sides) * Math.PI * 2;
    q.quad([at(i + 1, y), at(i, y), at(i, y + h), at(i + 1, y + h)], [Math.cos(a), 0, Math.sin(a)], UV, colour, info);
    // Lid as a fan of degenerate quads.
    q.quad([[x, y + h, z], at(i + 1, y + h), at(i, y + h), [x, y + h, z]], [0, 1, 0], UV, colour, info);
  }
}

/** Geometry of the details: solid equipment (props) and glowing beacons and pad lights. */
export function buildDetailGeometry(details: Details, ox: number, oz: number): { props: GeometryData; glow: GeometryData } {
  const q = new QuadBuilder();
  const glow = new QuadBuilder();
  const M = SURFACE.METAL;
  const C = SURFACE.CONCRETE;
  for (const r of details.roof) {
    const x = r.x - ox;
    const z = r.z - oz;
    switch (r.kind) {
      case 'parapet': {
        // Low wall around the roof edge, 25 cm thick.
        const t = 0.25;
        cuboid(q, x, r.y, z + r.d / 2 - t / 2, r.w, r.h, t, CONCRETE, C);
        cuboid(q, x, r.y, z - r.d / 2 + t / 2, r.w, r.h, t, CONCRETE, C);
        cuboid(q, x + r.w / 2 - t / 2, r.y, z, t, r.h, r.d - 2 * t, CONCRETE, C);
        cuboid(q, x - r.w / 2 + t / 2, r.y, z, t, r.h, r.d - 2 * t, CONCRETE, C);
        break;
      }
      case 'hut':
        cuboid(q, x, r.y, z, r.w, r.h, r.d, CONCRETE, C);
        cuboid(q, x, r.y, z + r.d / 2 + 0.03, 0.9, 2.1, 0.06, DARK, M);
        cuboid(q, x, r.y + r.h, z, r.w + 0.3, 0.15, r.d + 0.3, DARK, C);
        break;
      case 'ac':
        cuboid(q, x, r.y, z, r.w, r.h, r.d, GREY, M);
        // Fan grille on top.
        cuboid(q, x, r.y + r.h, z, r.w * 0.6, 0.04, r.d * 0.75, DARK, M);
        break;
      case 'tank': {
        const legs = 1.4;
        for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]) cuboid(q, x + lx, r.y, z + lz, 0.15, legs, 0.15, DARK, M);
        cuboid(q, x, r.y + legs - 0.1, z, r.w, 0.1, r.d, DARK, M);
        prism(q, x, r.y + legs, z, r.w / 2 - 0.05, r.h - legs, 10, WHITE_PAINT, M);
        break;
      }
      case 'mast':
        cuboid(q, x, r.y, z, 0.16, r.h, 0.16, GREY, M);
        for (let k = 1; k <= 3; k++) cuboid(q, x, r.y + (r.h * k) / 4, z, 1.4 - k * 0.3, 0.06, 0.06, GREY, M);
        // Red obstruction light, blinking is left to the bloom: a steady lamp reads fine.
        cuboid(glow, x, r.y + r.h, z, 0.3, 0.3, 0.3, [3, 0.15, 0.1], SURFACE.PLAIN);
        break;
      case 'dish':
        cuboid(q, x, r.y, z, 0.15, 1.1, 0.15, DARK, M);
        cuboid(q, x, r.y + 0.9, z, 1.5, 1.5, 0.08, WHITE_PAINT, M, r.angle, -0.6);
        break;
      case 'helipad': {
        cuboid(q, x, r.y, z, r.w, 0.06, r.d, PAD, C);
        // Yellow touchdown ring as 16 segments, a white H in the middle.
        const ring = r.w * 0.36;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          cuboid(q, x + Math.cos(a) * ring, r.y + 0.06, z + Math.sin(a) * ring, ring * 0.38, 0.02, 0.35, YELLOW, SURFACE.PLAIN, -a + Math.PI / 2);
        }
        const s = r.w * 0.09;
        cuboid(q, x - s, r.y + 0.06, z, s * 0.35, 0.02, s * 2.6, WHITE_PAINT, SURFACE.PLAIN);
        cuboid(q, x + s, r.y + 0.06, z, s * 0.35, 0.02, s * 2.6, WHITE_PAINT, SURFACE.PLAIN);
        cuboid(q, x, r.y + 0.06, z, s * 2, 0.02, s * 0.35, WHITE_PAINT, SURFACE.PLAIN);
        // Edge lights.
        for (let k = 0; k < 12; k++) {
          const f = (k / 12) * 4;
          const side = Math.floor(f);
          const u = (f - side - 0.5) * r.w;
          const h = r.w / 2;
          const [lx, lz] = side === 0 ? [u, -h] : side === 1 ? [h, u] : side === 2 ? [-u, h] : [-h, -u];
          cuboid(glow, x + lx, r.y + 0.06, z + lz, 0.25, 0.12, 0.25, [0.3, 2.4, 0.6], SURFACE.PLAIN);
        }
        break;
      }
      case 'crane': {
        const jib = 18;
        cuboid(q, x, r.y, z, 1.6, r.h, 1.6, YELLOW, M);
        cuboid(q, x, r.y + r.h, z, 1.2, 1.0, jib + 6, YELLOW, M, r.angle);
        const ca = Math.sin(r.angle);
        const cb = Math.cos(r.angle);
        cuboid(q, x - ca * (jib / 2 + 2), r.y + r.h - 1.5, z - cb * (jib / 2 + 2), 2, 1.5, 2, CONCRETE, C, r.angle);
        cuboid(q, x, r.y + r.h + 1, z, 1.8, 2, 1.8, DARK, M);
        cuboid(glow, x + ca * (jib / 2 + 3), r.y + r.h + 1.1, z + cb * (jib / 2 + 3), 0.35, 0.35, 0.35, [3, 0.15, 0.1], SURFACE.PLAIN);
        break;
      }
    }
  }
  for (const w of details.wall) {
    const out = w.depth / 2;
    const x = w.x - ox - w.nx * (w.kind === 'ac' ? 0.2 - out : 0);
    const z = w.z - oz - w.nz * (w.kind === 'ac' ? 0.2 - out : 0);
    const along = w.nx === 0;
    const sx = along ? w.w : w.depth;
    const sz = along ? w.depth : w.w;
    if (w.kind === 'ac') {
      cuboid(q, x, w.y, z, sx, w.h, sz, WHITE_PAINT, M);
      cuboid(q, x + w.nx * (out + 0.01), w.y + 0.08, z + w.nz * (out + 0.01), along ? w.w * 0.55 : 0.02, w.h * 0.7, along ? 0.02 : w.w * 0.55, DARK, M);
      // Its bracket.
      cuboid(q, x, w.y - 0.06, z, sx, 0.06, sz, DARK, M);
    } else {
      cuboid(q, x, w.y, z, sx, w.h, sz, [0.3, 0.3, 0.32], M);
    }
  }
  return { props: q.finish(), glow: glow.finish() };
}
