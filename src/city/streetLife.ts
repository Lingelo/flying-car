import { Rng, hash3 } from '../core/random';
import { QuadBuilder, type GeometryData } from '../render/geometryData';
import { BLOCK_SIZE, CHUNK_SIZE, STREET_WIDTH, AVENUE_WIDTH, type Chunk } from './generator';

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

export interface StreetLife {
  lanterns: Lantern[];
  poles: Pole[];
  cables: Cable[];
  vending: Vending[];
}

const WALLS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const POLE_HEIGHT = 10;
const POLE_SPACING = 24;

/** Tokyo street dressing of a chunk: lanterns, utility poles and their cables, vending machines (KTD6). */
export function placeStreetLife(chunk: Chunk, seed: number): StreetLife {
  const rng = new Rng(hash3(seed ^ 0x3e1f, chunk.cx, chunk.cz));
  const lanterns: Lantern[] = [];
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
      // A string of lanterns under the eaves of izakaya and ramen shops.
      if (neon && wallW > 5 && rng.chance(0.45)) {
        const n = Math.floor((wallW - 2) / 1.6);
        const colour = rng.chance(0.8) ? 0 : 1;
        const y = rng.range(3.2, 4.2);
        for (let i = 0; i < n; i++) {
          const a = -((n - 1) * 1.6) / 2 + i * 1.6;
          lanterns.push({ x: cx + tx * a + nx * 0.7, y, z: cz + tz * a + nz * 0.7, colour });
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
  return { lanterns, poles, cables, vending };
}

const quadBox = (q: QuadBuilder, c: P3, w: number, h: number, d: number, colour: [number, number, number], top = true) => {
  const x0 = c.x - w / 2, x1 = c.x + w / 2, y0 = c.y, y1 = c.y + h, z0 = c.z - d / 2, z1 = c.z + d / 2;
  const info: [number, number, number, number] = [0, 0, 0, 0];
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
    q.quad([[a.x, a.y - r, a.z], [b.x, b.y - r, b.z], [b.x, b.y + r, b.z], [a.x, a.y + r, a.z]], [0, 0, 1], uv, black, [0, 0, 0, 0]);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    const sx = (-dz / l) * r;
    const sz = (dx / l) * r;
    q.quad([[a.x - sx, a.y, a.z - sz], [b.x - sx, b.y, b.z - sz], [b.x + sx, b.y, b.z + sz], [a.x + sx, a.y, a.z + sz]], [0, 1, 0], uv, black, [0, 0, 0, 0]);
  }
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
    quadBox(props, { x: p.x - ox, y: 0, z: p.z - oz }, 0.3, p.height, 0.3, [0.28, 0.27, 0.26]);
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
  for (const l of life.lanterns) {
    const colour: [number, number, number] = l.colour === 0 ? [2.6, 0.35, 0.18] : [2.2, 2.0, 1.6];
    quadBox(glow, { x: l.x - ox, y: l.y, z: l.z - oz }, 0.42, 0.62, 0.42, colour);
  }
  return { props: props.finish(), glow: glow.finish() };
}
