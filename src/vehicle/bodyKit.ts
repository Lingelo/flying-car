import * as THREE from 'three';

/** A point of a side profile: (z forward, y up), metres. */
export type ProfilePoint = [number, number];
/** Plan-view shaping: the half width actually used at a given height and station. */
export type Warp = (x: number, y: number, z: number) => number;

/**
 * Extrudes a side profile across x in [-halfWidth, halfWidth] with chamfered edges, then warps it
 * in plan. Wheel wells cut in the profile stay clean polygons. Returns flat-shaded, non-indexed
 * geometry (facets read as panels).
 */
export function extrudeProfile(points: ProfilePoint[], halfWidth: number, warp: Warp, bevel = 0.02): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 2 * (halfWidth - bevel), bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 1 });
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    // Shape (sx, sy) extruded along sz becomes (z, y) extruded along -x: a proper rotation.
    const sx = pos.getX(i);
    const sy = pos.getY(i);
    pos.setXYZ(i, warp(halfWidth - bevel - pos.getZ(i), sy, sx), sy, sx);
  }
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

/** Polygonal wheel well centred on station z for a wheel of the given radius (clearance included). */
export function wheelWell(z: number, radius: number, floor: number): ProfilePoint[] {
  const r = radius + 0.07;
  return [
    [z - r * 1.08, floor],
    [z - r * 0.98, radius + 0.16],
    [z - r * 0.42, radius + r * 0.95],
    [z + r * 0.42, radius + r * 0.95],
    [z + r * 0.98, radius + 0.16],
    [z + r * 1.08, floor],
  ];
}
