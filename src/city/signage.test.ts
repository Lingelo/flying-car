import { describe, expect, it } from 'vitest';
import { generateChunk, type Box, type Chunk } from './generator';
import { placeSigns, placeSteamVents, type Sign } from './signage';

const onWall = (s: Sign, t: Box) => {
  const eps = 0.5;
  const withinX = s.x >= t.x - t.w / 2 - eps && s.x <= t.x + t.w / 2 + eps;
  const withinZ = s.z >= t.z - t.d / 2 - eps && s.z <= t.z + t.d / 2 + eps;
  const onXFace = Math.abs(Math.abs(s.x - t.x) - t.w / 2) < eps && withinZ;
  const onZFace = Math.abs(Math.abs(s.z - t.z) - t.d / 2) < eps && withinX;
  return (onXFace || onZFace) && s.y - s.h / 2 >= t.y0 && s.y + s.h / 2 <= t.y1;
};

describe('placeSigns', () => {
  it('attaches every billboard and vertical sign to a facade', () => {
    for (const [cx, cz] of [[0, 0], [3, -2], [-7, 5]]) {
      const chunk = generateChunk(9, cx, cz);
      const { signs } = placeSigns(chunk, 9);
      expect(signs.length).toBeGreaterThan(0);
      for (const s of signs) expect(chunk.buildings.some((b) => onWall(s, b.tiers[0]))).toBe(true);
    }
  });

  it('never overlaps two signs on the same wall', () => {
    const chunk = generateChunk(9, 1, 1);
    const { signs } = placeSigns(chunk, 9);
    for (let i = 0; i < signs.length; i++)
      for (let j = i + 1; j < signs.length; j++) {
        const a = signs[i];
        const b = signs[j];
        const sameWall = a.nx === b.nx && a.nz === b.nz && Math.abs((a.x - b.x) * a.nx + (a.z - b.z) * a.nz) < 0.5;
        if (!sameWall) continue;
        const along = Math.abs((a.x - b.x) * a.nz + (a.z - b.z) * -a.nx);
        const vertical = Math.abs(a.y - b.y);
        expect(along * 2 >= a.w + b.w - 0.01 || vertical * 2 >= a.h + b.h - 0.01).toBe(true);
      }
  });

  it('is deterministic', () => {
    const chunk = generateChunk(3, 2, 2);
    expect(placeSigns(chunk, 3)).toEqual(placeSigns(chunk, 3));
  });

  it('puts more signs in the neon district than in the industrial zone', () => {
    const perBuilding = (district: Chunk['district']) => {
      let signs = 0;
      let buildings = 0;
      for (let x = -15; x < 15; x++)
        for (let z = -15; z < 15; z++) {
          const c = generateChunk(2077, x, z);
          if (c.district !== district) continue;
          signs += placeSigns(c, 2077).signs.length;
          buildings += c.buildings.length;
        }
      return signs / buildings;
    };
    expect(perBuilding('neon')).toBeGreaterThan(2 * perBuilding('industrial'));
  });

  it('floats holograms above the roofs they belong to', () => {
    let holograms = 0;
    for (let x = -6; x < 6; x++)
      for (let z = -6; z < 6; z++) {
        const chunk = generateChunk(5, x, z);
        for (const h of placeSigns(chunk, 5).holograms) {
          holograms++;
          const owner = chunk.buildings.find((b) => Math.abs(b.tiers.at(-1)!.x - h.x) < 1e-6 && Math.abs(b.tiers.at(-1)!.z - h.z) < 1e-6);
          expect(owner).toBeDefined();
          expect(h.y - h.size / 2).toBeGreaterThan(owner!.height);
        }
      }
    expect(holograms).toBeGreaterThan(0);
  });
});

describe('placeSteamVents', () => {
  it('puts vents on the ground, on streets', () => {
    const chunk = generateChunk(1, 0, 0);
    const vents = placeSteamVents(chunk, 1);
    expect(vents.length).toBeGreaterThan(0);
    for (const v of vents) {
      const onRoad = chunk.roads.some((r) => Math.abs(v.x - r.x) <= r.w / 2 && Math.abs(v.z - r.z) <= r.d / 2);
      expect(onRoad).toBe(true);
    }
  });
});

describe('Tokyo signage', () => {
  const scan = (district: Chunk['district']) => {
    const found: { chunk: Chunk; signs: Sign[] }[] = [];
    for (let x = -12; x < 12; x++)
      for (let z = -12; z < 12; z++) {
        const chunk = generateChunk(2077, x, z);
        if (chunk.district === district) found.push({ chunk, signs: placeSigns(chunk, 2077).signs });
      }
    return found;
  };

  it('stacks vertical signs on building corners in the neon district', () => {
    let stacked = 0;
    for (const { chunk, signs } of scan('neon')) {
      for (const b of chunk.buildings) {
        const t = b.tiers[0];
        const atCorner = signs.filter(
          (s) => s.kind === 'vertical' && Math.abs(Math.abs(s.x - t.x) - t.w / 2) < 0.6 && Math.abs(Math.abs(s.z - t.z) - t.d / 2) < 0.6,
        );
        // a stack: several blades at the same corner, one above the other
        const byCorner = new Map<string, number>();
        for (const s of atCorner) byCorner.set(`${Math.round(s.x)},${Math.round(s.z)}`, (byCorner.get(`${Math.round(s.x)},${Math.round(s.z)}`) ?? 0) + 1);
        for (const n of byCorner.values()) if (n >= 3) stacked++;
      }
    }
    expect(stacked).toBeGreaterThan(10);
  });

  it('puts giant screens only at avenue corners of the neon and downtown districts', () => {
    let screens = 0;
    for (const district of ['neon', 'downtown', 'canals', 'industrial'] as const) {
      for (const { chunk, signs } of scan(district)) {
        for (const s of signs.filter((s) => s.kind === 'screen')) {
          screens++;
          expect(['neon', 'downtown']).toContain(district);
          // on the avenue side of the chunk's first block
          expect(Math.min(s.x - chunk.origin.x, s.z - chunk.origin.z)).toBeLessThan(20);
          expect(s.w).toBeGreaterThan(12);
        }
      }
    }
    expect(screens).toBeGreaterThan(5);
  });
});
