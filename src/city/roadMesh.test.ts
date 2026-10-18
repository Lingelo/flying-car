import { describe, expect, it } from 'vitest';
import { generateChunk } from './generator';
import { buildGroundGeometry, KERB_HEIGHT } from './roadMesh';

describe('ground geometry', () => {
  it('raises kerbs along both edges of every street, outside the roadway', () => {
    const chunk = generateChunk(2077, 0, 0);
    const { ground } = buildGroundGeometry(chunk);
    const p = ground.position;
    let kerbVertices = 0;
    for (let i = 0; i < p.length; i += 3) {
      const y = p[i + 1];
      if (y <= 0.001) continue;
      kerbVertices++;
      expect(y).toBeLessThanOrEqual(KERB_HEIGHT + 1e-6);
      // A raised vertex is never inside a carriageway (chunk-local coordinates).
      const x = p[i] + chunk.origin.x;
      const z = p[i + 2] + chunk.origin.z;
      const inside = chunk.roads.some((r) => Math.abs(x - r.x) < r.w / 2 - 0.01 && Math.abs(z - r.z) < r.d / 2 - 0.01);
      expect(inside).toBe(false);
    }
    expect(kerbVertices).toBeGreaterThan(200);
  });
});
