import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VEHICLE_TYPES, vehicleShapes } from './vehicleShapes';

const box = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!;
};

/** Vertex colours darker than this are glass, tyres or trim, not paint. */
const isDark = (c: THREE.BufferAttribute, i: number) => c.getX(i) + c.getY(i) + c.getZ(i) < 0.6;

describe('traffic vehicles', () => {
  const shapes = vehicleShapes();

  it('builds a patrol sedan, a delivery van and a sports car of their real sizes', () => {
    expect(shapes).toHaveLength(VEHICLE_TYPES.length);
    expect(VEHICLE_TYPES.map((t) => t.name)).toEqual(['sedan', 'van', 'sports']);
    shapes.forEach(({ body }, i) => {
      const size = box(body).getSize(new THREE.Vector3());
      const t = VEHICLE_TYPES[i];
      expect(size.z).toBeGreaterThan(t.length * 0.95);
      expect(size.z).toBeLessThan(t.length * 1.08);
      expect(size.x).toBeGreaterThan(t.width * 0.9);
      expect(size.x).toBeLessThan(t.width * 1.1);
      expect(size.y).toBeGreaterThan(t.height * 0.85);
      expect(size.y).toBeLessThan(t.height * 1.15);
    });
    const heights = VEHICLE_TYPES.map((t) => t.height);
    expect(heights[1]).toBeGreaterThan(heights[0]);
    expect(heights[2]).toBeLessThan(heights[0]);
  });

  it('has painted panels and dark glass, tyres and trim', () => {
    for (const { body } of shapes) {
      // By surface area, not vertex count (wheels have many small triangles).
      const p = body.getAttribute('position') as THREE.BufferAttribute;
      const c = body.getAttribute('color') as THREE.BufferAttribute;
      const t = new THREE.Triangle();
      let dark = 0;
      let total = 0;
      for (let i = 0; i < p.count; i += 3) {
        t.setFromAttributeAndIndices(p, i, i + 1, i + 2);
        const area = t.getArea();
        total += area;
        if (isDark(c, i)) dark += area;
      }
      expect(dark / total).toBeGreaterThan(0.15);
      expect(dark / total).toBeLessThan(0.7);
    }
  });

  it('puts white lights at the front and red ones at the back', () => {
    for (const { lights } of shapes) {
      const p = lights.getAttribute('position') as THREE.BufferAttribute;
      const c = lights.getAttribute('color') as THREE.BufferAttribute;
      let front = 0;
      let back = 0;
      for (let i = 0; i < p.count; i++) {
        const white = c.getX(i) > 1 && c.getY(i) > 1 && c.getZ(i) > 1;
        const red = c.getX(i) > 1 && c.getY(i) < 0.3;
        if (white) {
          expect(p.getZ(i)).toBeGreaterThan(0);
          front++;
        }
        if (red) {
          expect(p.getZ(i)).toBeLessThan(0);
          back++;
        }
      }
      expect(front).toBeGreaterThan(0);
      expect(back).toBeGreaterThan(0);
    }
  });
});
