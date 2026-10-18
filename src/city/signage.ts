import { Rng, hash3 } from '../core/random';
import { QuadBuilder, type GeometryData } from '../render/geometryData';
import { DISTRICTS } from './districts';
import type { Chunk } from './generator';

export interface Sign {
  kind: 'billboard' | 'vertical' | 'screen';
  /** Attachment point on the wall (centre of a billboard, inner edge of a vertical sign). */
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  /** Outward normal of the wall. */
  nx: number;
  nz: number;
  hue: number;
  seed: number;
}

export interface Hologram {
  x: number;
  y: number;
  z: number;
  size: number;
  hue: number;
  seed: number;
}

export interface SteamVent {
  x: number;
  z: number;
}

const VERTICAL_WIDTH = 1.6;
const WALLS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** Billboards and vertical neon signs on facades, holograms above the tallest roofs. */
export function placeSigns(chunk: Chunk, seed: number): { signs: Sign[]; holograms: Hologram[] } {
  const district = DISTRICTS[chunk.district];
  const rng = new Rng(hash3(seed ^ 0x51a9, chunk.cx, chunk.cz));
  const signs: Sign[] = [];
  const holograms: Hologram[] = [];

  const tokyo = chunk.district === 'neon' || chunk.district === 'downtown';
  for (const building of chunk.buildings) {
    const t = building.tiers[0];
    const placed: Sign[] = [];
    const add = (sign: Sign) => {
      if (placed.some((o) => sameWallOverlap(o, sign))) return false;
      placed.push(sign);
      signs.push(sign);
      return true;
    };

    // Giant screens on the buildings at an avenue crossing (the chunk's first block), Shibuya style.
    const atCrossing = t.x - t.w / 2 - chunk.origin.x < 20 && t.z - t.d / 2 - chunk.origin.z < 20;
    if (tokyo && atCrossing && rng.chance(0.85)) {
      const [nx, nz] = rng.pick<[number, number]>([[-1, 0], [0, -1]]);
      const wallW = nx === 0 ? t.w : t.d;
      const w = Math.min(wallW - 2, 26);
      const h = w * 0.56;
      const yMin = Math.max(18, h / 2 + 8);
      const yMax = t.y1 - 2 - h / 2;
      if (w > 12 && yMax > yMin) {
        add({ kind: 'screen', x: t.x + (nx * t.w) / 2, z: t.z + (nz * t.d) / 2, y: rng.range(yMin, yMax), w, h, nx, nz, hue: rng.int(0, 3), seed: rng.next() });
      }
    }

    // Stacks of vertical blades on the corners, one above the other.
    if (tokyo) {
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        if (!rng.chance(chunk.district === 'neon' ? 0.5 : 0.22)) continue;
        const onX = rng.chance(0.5);
        const nx = onX ? sx : 0;
        const nz = onX ? 0 : sz;
        const x = onX ? t.x + (sx * t.w) / 2 : t.x + sx * (t.w / 2 - 0.3);
        const z = onX ? t.z + sz * (t.d / 2 - 0.3) : t.z + (sz * t.d) / 2;
        const count = rng.int(3, 6);
        let y = 4;
        const top = Math.min(t.y1 - 1, 60);
        for (let k = 0; k < count; k++) {
          const h = rng.range(5, 9);
          if (y + h > top) break;
          add({ kind: 'vertical', x, z, y: y + h / 2, w: VERTICAL_WIDTH, h, nx, nz, hue: rng.int(0, 3), seed: rng.next() });
          y += h + 0.6;
        }
      }
    }

    for (const [nx, nz] of WALLS) {
      const wallW = nx === 0 ? t.w : t.d;
      const cx = t.x + (nx * t.w) / 2;
      const cz = t.z + (nz * t.d) / 2;
      // Tangent along the wall.
      const tx = nz;
      const tz = -nx;
      const at = (a: number) => ({ x: cx + tx * a, z: cz + tz * a });

      if (rng.chance(district.signDensity * 0.45)) {
        const w = Math.min(rng.range(6, 14), wallW - 2);
        const h = w * 0.56;
        const yMin = 6 + h / 2;
        const yMax = Math.min(t.y1 - 2 - h / 2, 70);
        if (w >= 4 && yMax > yMin) {
          const a = rng.range(-(wallW - w) / 2, (wallW - w) / 2);
          add({ kind: 'billboard', ...at(a), y: rng.range(yMin, yMax), w, h, nx, nz, hue: rng.int(0, 3), seed: rng.next() });
        }
      }
      if (wallW > 4 && rng.chance(district.signDensity * 0.5)) {
        const a = rng.pick([-1, 1]) * (wallW / 2 - 1.2);
        const h = rng.range(6, 16);
        const yMin = 5 + h / 2;
        const yMax = Math.min(t.y1 - 1 - h / 2, 50);
        if (yMax > yMin) add({ kind: 'vertical', ...at(a), y: rng.range(yMin, yMax), w: VERTICAL_WIDTH, h, nx, nz, hue: rng.int(0, 3), seed: rng.next() });
      }
    }

    const holoChance = chunk.district === 'downtown' ? 0.14 : chunk.district === 'neon' ? 0.08 : 0;
    if (building.height > 60 && rng.chance(holoChance)) {
      const top = building.tiers[building.tiers.length - 1];
      const size = rng.range(14, 28);
      holograms.push({ x: top.x, z: top.z, y: building.height + size / 2 + rng.range(4, 15), size, hue: rng.int(0, 3), seed: rng.next() });
    }
  }
  return { signs, holograms };
}

/** Two signs on the same wall that overlap along it and in height. */
function sameWallOverlap(a: Sign, b: Sign): boolean {
  if (a.nx !== b.nx || a.nz !== b.nz) return false;
  if (Math.abs((a.x - b.x) * a.nx + (a.z - b.z) * a.nz) >= 0.5) return false;
  const along = Math.abs((a.x - b.x) * a.nz - (a.z - b.z) * a.nx);
  return along * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
}

/** Steam rising from street grates. */
export function placeSteamVents(chunk: Chunk, seed: number): SteamVent[] {
  const rng = new Rng(hash3(seed ^ 0x57ea, chunk.cx, chunk.cz));
  const count = rng.int(3, 7);
  const vents: SteamVent[] = [];
  for (let i = 0; i < count; i++) {
    const road = rng.pick(chunk.roads);
    vents.push({ x: road.x + rng.range(-0.45, 0.45) * road.w, z: road.z + rng.range(-0.45, 0.45) * road.d });
  }
  return vents;
}

/** Quads of the signs relative to the chunk origin; `info` = (kind, hue, seed, aspect). */
export function buildSignGeometry(signs: Sign[], ox: number, oz: number): GeometryData {
  const q = new QuadBuilder();
  for (const s of signs) {
    const x = s.x - ox;
    const z = s.z - oz;
    const y0 = s.y - s.h / 2;
    const y1 = s.y + s.h / 2;
    const info: [number, number, number, number] = [s.kind === 'billboard' ? 0 : s.kind === 'screen' ? 3 : 1, s.hue, s.seed, s.w / s.h];
    if (s.kind !== 'vertical') {
      const off = 0.2;
      const tx = s.nz;
      const tz = -s.nx;
      const hw = s.w / 2;
      const bx = x + s.nx * off;
      const bz = z + s.nz * off;
      q.quad(
        [[bx - tx * hw, y0, bz - tz * hw], [bx + tx * hw, y0, bz + tz * hw], [bx + tx * hw, y1, bz + tz * hw], [bx - tx * hw, y1, bz - tz * hw]],
        [s.nx, 0, s.nz],
        [[0, 0], [1, 0], [1, 1], [0, 1]],
        [1, 1, 1],
        info,
      );
    } else {
      // Blade sticking out of the wall, visible from both sides (double-sided material).
      const ex = x + s.nx * s.w;
      const ez = z + s.nz * s.w;
      q.quad([[x, y0, z], [ex, y0, ez], [ex, y1, ez], [x, y1, z]], [s.nz, 0, -s.nx], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 1, 1], info);
    }
  }
  return q.finish();
}

/** Two crossed quads per hologram so it reads from every direction. */
export function buildHologramGeometry(holograms: Hologram[], ox: number, oz: number): GeometryData {
  const q = new QuadBuilder();
  for (const h of holograms) {
    const x = h.x - ox;
    const z = h.z - oz;
    const r = h.size / 2;
    const info: [number, number, number, number] = [2, h.hue, h.seed, 1];
    const uvs: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    q.quad([[x - r, h.y - r, z], [x + r, h.y - r, z], [x + r, h.y + r, z], [x - r, h.y + r, z]], [0, 0, 1], uvs, [1, 1, 1], info);
    q.quad([[x, h.y - r, z + r], [x, h.y - r, z - r], [x, h.y + r, z - r], [x, h.y + r, z + r]], [1, 0, 0], uvs, [1, 1, 1], info);
  }
  return q.finish();
}

/** Steam particles: (x, y, z, seed) per particle, relative to the chunk origin. */
export function buildSteamParticles(vents: SteamVent[], ox: number, oz: number, perVent = 14): Float32Array {
  const out = new Float32Array(vents.length * perVent * 4);
  let i = 0;
  vents.forEach((v, n) => {
    for (let p = 0; p < perVent; p++) {
      out[i++] = v.x - ox;
      out[i++] = 0.2;
      out[i++] = v.z - oz;
      out[i++] = n * 0.618 + p / perVent;
    }
  });
  return out;
}
