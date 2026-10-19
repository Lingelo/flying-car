import { Rng, hash3 } from '../core/random';
import { QuadBuilder, type GeometryData } from '../render/geometryData';
import { BLOCK_SIZE, CHUNK_SIZE, STREET_WIDTH, AVENUE_WIDTH, type Chunk } from './generator';
import { SURFACE, type Surface } from '../render/materials/surface';

type P3 = { x: number; y: number; z: number };

export interface Lantern extends P3 {
  /** 0 red paper lantern, 1 white. */
  colour: 0 | 1;
}

export interface Pole {
  x: number;
  z: number;
  height: number;
}

export interface Cable {
  a: Pole;
  b: Pole;
  /** Height of the cable at both ends and its sag at mid-span. */
  y: number;
  sag: number;
}

export interface Vending extends P3 {
  nx: number;
  nz: number;
  hue: number;
}

/** Shop canopy fixed to a facade: (x, z) is the middle of its back edge on the wall, y its height there. */
export interface Canopy extends P3 {
  nx: number;
  nz: number;
  w: number;
  depth: number;
  hue: number;
}

export interface StreetLife {
  canopies: Canopy[];
  lanterns: Lantern[];
  poles: Pole[];
  cables: Cable[];
  vending: Vending[];
}

const WALLS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const POLE_HEIGHT = 10;
const POLE_SPACING = 24;
/** How much lower the front edge of a canopy is than its back edge. */
const CANOPY_DROP = 0.18;
const LANTERN_HEIGHT = 0.56;

/** Tokyo street dressing of a chunk: lanterns, utility poles and their cables, vending machines (KTD6). */
export function placeStreetLife(chunk: Chunk, seed: number): StreetLife {
  const rng = new Rng(hash3(seed ^ 0x3e1f, chunk.cx, chunk.cz));
  const lanterns: Lantern[] = [];
  const canopies: Canopy[] = [];
  const vending: Vending[] = [];
  const neon = chunk.district === 'neon';
  const lively = neon || chunk.district === 'downtown' || chunk.district === 'canals';

  for (const b of chunk.buildings) {
    const t = b.tiers[0];
    for (const [nx, nz] of WALLS) {
      const wallW = nx === 0 ? t.w : t.d;
      const tx = nz;
      const tz = -nx;
      const cx = t.x + (nx * t.w) / 2;
      const cz = t.z + (nz * t.d) / 2;
      // A canopy over the shopfronts; in the neon district, izakaya lanterns hang from its edge.
      if (lively && wallW > 6 && rng.chance(neon ? 0.55 : 0.3)) {
        const w = rng.range(Math.min(5, wallW - 1), wallW - 1);
        const a0 = rng.range(-(wallW - 1 - w) / 2, (wallW - 1 - w) / 2);
        const canopy: Canopy = { x: cx + tx * a0, y: rng.range(2.9, 3.05), z: cz + tz * a0, nx, nz, w, depth: rng.range(1.1, 1.5), hue: rng.int(0, 4) };
        canopies.push(canopy);
        if (neon && rng.chance(0.6)) {
          const n = Math.floor((w - 0.6) / 1.2);
          const colour = rng.chance(0.8) ? 0 : 1;
          const front = canopy.depth - 0.15;
          const y = canopy.y - CANOPY_DROP - 0.1 - LANTERN_HEIGHT;
          for (let i = 0; i < n; i++) {
            const a = a0 - ((n - 1) * 1.2) / 2 + i * 1.2;
            lanterns.push({ x: cx + tx * a + nx * front, y, z: cz + tz * a + nz * front, colour });
          }
        }
      }
      if (lively && wallW > 4 && rng.chance(neon ? 0.12 : 0.06)) {
        const a = rng.range(-(wallW / 2 - 1.5), wallW / 2 - 1.5);
        vending.push({ x: cx + tx * a + nx * 0.45, y: 0, z: cz + tz * a + nz * 0.45, nx, nz, hue: rng.int(0, 3) });
      }
    }
  }

  // Utility poles along the sidewalks of the side streets (not the avenues), wired together.
  const poles: Pole[] = [];
  const cables: Cable[] = [];
  if (chunk.district !== 'downtown') {
    const lineWidth = (local: number) => (local % CHUNK_SIZE === 0 ? AVENUE_WIDTH : STREET_WIDTH);
    for (let i = 1; i < CHUNK_SIZE / BLOCK_SIZE; i++) {
      if (!rng.chance(0.7)) continue;
      const line = i * BLOCK_SIZE;
      const side = rng.pick([1, -1]);
      const along = rng.chance(0.5) ? 'z' : 'x';
      for (let k = 0; k < CHUNK_SIZE / BLOCK_SIZE; k++) {
        const from = k * BLOCK_SIZE + lineWidth(k * BLOCK_SIZE) / 2 + 3;
        const to = (k + 1) * BLOCK_SIZE - lineWidth((k + 1) * BLOCK_SIZE) / 2 - 3;
        let previous: Pole | null = null;
        for (let s = from; s <= to; s += POLE_SPACING) {
          const across = line + side * (STREET_WIDTH / 2 + 1);
          const pole: Pole =
            along === 'z'
              ? { x: chunk.origin.x + across, z: chunk.origin.z + s, height: POLE_HEIGHT }
              : { x: chunk.origin.x + s, z: chunk.origin.z + across, height: POLE_HEIGHT };
          poles.push(pole);
          if (previous) for (const y of [8.4, 9.0, 9.6]) cables.push({ a: previous, b: pole, y, sag: rng.range(0.4, 0.9) });
          previous = pole;
        }
      }
    }
  }
  return { canopies, lanterns, poles, cables, vending };
}

const quadBox = (q: QuadBuilder, c: P3, w: number, h: number, d: number, colour: [number, number, number], top = true, surface: Surface = SURFACE.METAL) => {
  const x0 = c.x - w / 2, x1 = c.x + w / 2, y0 = c.y, y1 = c.y + h, z0 = c.z - d / 2, z1 = c.z + d / 2;
  const info: [number, number, number, number] = [surface, 0, 0, 0];
  const uv: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  q.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], uv, colour, info);
  q.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], uv, colour, info);
  q.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], uv, colour, info);
  q.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], uv, colour, info);
  if (top) q.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], uv, colour, info);
  // Lanterns hang above eye level: they are seen from below.
  q.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], uv, colour, info);
};

/** Thin cable as two crossed ribbons, sagging in a few segments. */
const cableQuads = (q: QuadBuilder, c: Cable, ox: number, oz: number) => {
  const steps = 6;
  const pts: P3[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    pts.push({ x: c.a.x + (c.b.x - c.a.x) * f - ox, y: c.y - c.sag * 4 * f * (1 - f), z: c.a.z + (c.b.z - c.a.z) * f - oz });
  }
  const r = 0.025;
  const black: [number, number, number] = [0.02, 0.02, 0.025];
  const uv: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (let i = 0; i < steps; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    q.quad([[a.x, a.y - r, a.z], [b.x, b.y - r, b.z], [b.x, b.y + r, b.z], [a.x, a.y + r, a.z]], [0, 0, 1], uv, black, [SURFACE.PLAIN, 0, 0, 0]);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    const sx = (-dz / l) * r;
    const sz = (dx / l) * r;
    q.quad([[a.x - sx, a.y, a.z - sz], [b.x - sx, b.y, b.z - sz], [b.x + sx, b.y, b.z + sz], [a.x + sx, a.y, a.z + sz]], [0, 1, 0], uv, black, [SURFACE.PLAIN, 0, 0, 0]);
  }
};

/** Sloping canopy: fabric top, dark underside, a valance along the front and a light strip under it. */
const canopyQuads = (props: QuadBuilder, glow: QuadBuilder, k: Canopy, colour: [number, number, number], ox: number, oz: number) => {
  const tx = k.nz;
  const tz = -k.nx;
  const uv: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const info: [number, number, number, number] = [0, 0, 0, 0];
  const at = (along: number, out: number, y: number): [number, number, number] => [k.x - ox + tx * along + k.nx * out, y, k.z - oz + tz * along + k.nz * out];
  const h = k.w / 2;
  const yf = k.y - CANOPY_DROP;
  const slope = CANOPY_DROP / k.depth;
  const up: [number, number, number] = [k.nx * slope, 1, k.nz * slope];
  props.quad([at(-h, 0, k.y), at(-h, k.depth, yf), at(h, k.depth, yf), at(h, 0, k.y)], up, uv, colour, info);
  const under: [number, number, number] = [colour[0] * 0.25, colour[1] * 0.25, colour[2] * 0.25];
  props.quad([at(h, 0, k.y - 0.02), at(h, k.depth, yf - 0.02), at(-h, k.depth, yf - 0.02), at(-h, 0, k.y - 0.02)], [0, -1, 0], uv, under, info);
  // Valance: a short vertical band at the front, facing the street.
  const valance: [number, number, number] = [colour[0] * 0.8, colour[1] * 0.8, colour[2] * 0.8];
  props.quad([at(-h, k.depth, yf - 0.24), at(h, k.depth, yf - 0.24), at(h, k.depth, yf), at(-h, k.depth, yf)], [k.nx, 0, k.nz], uv, valance, info);
  props.quad([at(h, k.depth - 0.01, yf - 0.24), at(-h, k.depth - 0.01, yf - 0.24), at(-h, k.depth - 0.01, yf), at(h, k.depth - 0.01, yf)], [-k.nx, 0, -k.nz], uv, valance, info);
  // Warm strip light under the canopy, lighting the shopfront.
  const lamp: [number, number, number] = [2.4, 1.9, 1.3];
  glow.quad([at(h - 0.3, 0.25, k.y - 0.05), at(h - 0.3, 0.35, k.y - 0.05 - slope * 0.1), at(0.3 - h, 0.35, k.y - 0.05 - slope * 0.1), at(0.3 - h, 0.25, k.y - 0.05)], [0, -1, 0], uv, lamp, info);
};

/** Ribbed paper lantern (chochin): a bulging octagonal barrel with black caps, on a short cord. */
const lanternQuads = (props: QuadBuilder, glow: QuadBuilder, l: Lantern, ox: number, oz: number) => {
  const sides = 10;
  const rows = 7;
  const radius = (t: number) => 0.13 + 0.09 * Math.sin(Math.PI * t);
  const cap = 0.04;
  const body = LANTERN_HEIGHT - 2 * cap;
  const base: [number, number, number] = l.colour === 0 ? [2.6, 0.32, 0.16] : [2.3, 2.05, 1.6];
  const info: [number, number, number, number] = [0, 0, 0, 0];
  const uv: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const cx = l.x - ox;
  const cz = l.z - oz;
  const ring = (t: number, i: number): [number, number, number] => {
    const a = (i / sides) * Math.PI * 2;
    return [cx + Math.cos(a) * radius(t), l.y + cap + t * body, cz + Math.sin(a) * radius(t)];
  };
  for (let r = 0; r < rows; r++) {
    // Bamboo ribs show as slightly darker bands between the paper rows.
    const shade = r % 2 ? 0.82 : 1;
    const c: [number, number, number] = [base[0] * shade, base[1] * shade, base[2] * shade];
    for (let i = 0; i < sides; i++) {
      const a = ((i + 0.5) / sides) * Math.PI * 2;
      glow.quad([ring(r / rows, i + 1), ring(r / rows, i), ring((r + 1) / rows, i), ring((r + 1) / rows, i + 1)], [Math.cos(a), 0, Math.sin(a)], uv, c, info);
    }
  }
  const black: [number, number, number] = [0.03, 0.025, 0.02];
  quadBox(props, { x: cx, y: l.y, z: cz }, 0.24, cap, 0.24, black);
  quadBox(props, { x: cx, y: l.y + LANTERN_HEIGHT - cap, z: cz }, 0.24, cap, 0.24, black);
  quadBox(props, { x: cx, y: l.y + LANTERN_HEIGHT, z: cz }, 0.015, 0.1, 0.015, black);
};

/** Collision boxes of the props: poles and vending machines. */
export function streetLifeBoxes(life: StreetLife): import('./generator').Box[] {
  return [
    ...life.poles.map((p) => ({ x: p.x, z: p.z, w: 0.4, d: 0.4, y0: 0, y1: p.height })),
    ...life.vending.map((v) => ({ x: v.x, z: v.z, w: v.nx === 0 ? 1 : 0.8, d: v.nx === 0 ? 0.8 : 1, y0: 0, y1: 1.85 })),
  ];
}

/** Props (poles, cables, vending cabinets) and glowing parts (lanterns, vending fronts). */
export function buildStreetLifeGeometry(life: StreetLife, ox: number, oz: number): { props: GeometryData; glow: GeometryData } {
  const props = new QuadBuilder();
  const glow = new QuadBuilder();
  for (const p of life.poles) {
    quadBox(props, { x: p.x - ox, y: 0, z: p.z - oz }, 0.3, p.height, 0.3, [0.28, 0.27, 0.26], true, SURFACE.CONCRETE);
    quadBox(props, { x: p.x - ox, y: p.height - 1.6, z: p.z - oz }, 1.6, 0.12, 0.12, [0.2, 0.2, 0.2]);
    // Small transformer drum.
    quadBox(props, { x: p.x - ox + 0.35, y: p.height - 3.2, z: p.z - oz }, 0.45, 0.8, 0.45, [0.35, 0.36, 0.34]);
  }
  for (const c of life.cables) cableQuads(props, c, ox, oz);
  const neon: [number, number, number][] = [[2.4, 0.4, 1.8], [0.3, 2.0, 2.4], [1.4, 0.6, 2.4], [2.4, 1.5, 0.3]];
  for (const v of life.vending) {
    const c = { x: v.x - ox, y: 0, z: v.z - oz };
    const along = v.nx === 0;
    quadBox(props, c, along ? 1.0 : 0.8, 1.85, along ? 0.8 : 1.0, [0.85, 0.86, 0.9]);
    // Lit front panel, just proud of the cabinet face.
    const f = { x: c.x + v.nx * 0.41, y: 0.35, z: c.z + v.nz * 0.41 };
    quadBox(glow, f, along ? 0.8 : 0.02, 1.3, along ? 0.02 : 0.8, neon[v.hue], false);
  }
  const fabric: [number, number, number][] = [[0.42, 0.08, 0.07], [0.12, 0.13, 0.15], [0.55, 0.5, 0.42], [0.08, 0.2, 0.22], [0.3, 0.3, 0.3]];
  for (const k of life.canopies) canopyQuads(props, glow, k, fabric[k.hue], ox, oz);
  for (const l of life.lanterns) lanternQuads(props, glow, l, ox, oz);
  return { props: props.finish(), glow: glow.finish() };
}
