/** Room behind a window cell, in metres: x across, y up, z into the building. */
export interface RoomSize {
  width: number;
  height: number;
  depth: number;
}

export type RoomSurface = 'back' | 'left' | 'right' | 'floor' | 'ceiling';

/**
 * Interior mapping: the view ray entering the window at `entry` (on the glass plane, z = 0) with
 * direction `dir` (z > 0 into the room) hits the nearest face of the room box. The facade shader
 * runs the same computation (INTERIOR_GLSL) per pixel; this TypeScript twin is what the tests check.
 */
export function roomHit(entry: { x: number; y: number }, dir: { x: number; y: number; z: number }, size: RoomSize) {
  const tx = dir.x > 0 ? (size.width - entry.x) / dir.x : dir.x < 0 ? -entry.x / dir.x : Infinity;
  const ty = dir.y > 0 ? (size.height - entry.y) / dir.y : dir.y < 0 ? -entry.y / dir.y : Infinity;
  const tz = size.depth / Math.max(dir.z, 1e-4);
  const t = Math.min(tx, ty, tz);
  const point = { x: entry.x + dir.x * t, y: entry.y + dir.y * t, z: dir.z * t };
  let surface: RoomSurface = 'back';
  if (t === tx) surface = dir.x > 0 ? 'right' : 'left';
  else if (t === ty) surface = dir.y > 0 ? 'ceiling' : 'floor';
  return { surface, point, distance: t };
}

/**
 * GLSL of roomHit plus the shading of what is hit: wall colour, furniture silhouettes and posters on
 * the back wall, dark floor, ceiling light panel, blinds, depth falloff. Returns linear RGB albedo.
 */
export const INTERIOR_GLSL = `
vec3 interiorRoom(vec2 entry, vec3 dir, vec3 size, float roomSeed, out float lightPanel) {
  float tx = dir.x > 0.0 ? (size.x - entry.x) / dir.x : (dir.x < 0.0 ? -entry.x / dir.x : 1e6);
  float ty = dir.y > 0.0 ? (size.y - entry.y) / dir.y : (dir.y < 0.0 ? -entry.y / dir.y : 1e6);
  float tz = size.z / max(dir.z, 1e-4);
  float t = min(tx, min(ty, tz));
  vec3 p = vec3(entry + dir.xy * t, dir.z * t);
  float h1 = fract(roomSeed * 13.71);
  float h2 = fract(roomSeed * 7.13);
  float h3 = fract(roomSeed * 3.97);
  // Wall paint: off-white, beige, pale blue or a bold accent.
  vec3 wall = h1 < 0.35 ? vec3(0.78, 0.76, 0.72) : h1 < 0.6 ? vec3(0.72, 0.62, 0.5) : h1 < 0.85 ? vec3(0.55, 0.65, 0.75) : vec3(0.55, 0.25, 0.35);
  vec3 col;
  lightPanel = 0.0;
  if (t == tz) {
    col = wall;
    // Furniture against the back wall: a desk or shelving band, and a poster or screen.
    float desk = step(0.7, p.y) * step(p.y, 1.05) * step(0.3, p.x) * step(p.x, size.x - 0.4);
    float shelf = step(h2, 0.5) * step(1.4, p.y) * step(p.y, 2.4) * step(abs(p.x - size.x * 0.25), 0.5) * step(0.5, fract(p.y * 2.5));
    float poster = step(abs(p.x - size.x * (0.4 + h3 * 0.3)), 0.45) * step(abs(p.y - 1.9), 0.35);
    col = mix(col, vec3(0.12, 0.1, 0.09), max(desk, shelf));
    col = mix(col, h2 < 0.5 ? vec3(0.1, 0.5, 0.9) : vec3(0.9, 0.3, 0.5), poster * step(0.4, h3));
  } else if (t == ty) {
    if (dir.y > 0.0) {
      col = vec3(0.82);
      // Ceiling light panel.
      lightPanel = step(abs(p.z - size.z * 0.5), 0.6) * step(abs(p.x - size.x * 0.5), size.x * 0.3);
    } else {
      col = h2 < 0.5 ? vec3(0.22, 0.14, 0.08) : vec3(0.3, 0.3, 0.32);
    }
  } else {
    col = wall * 0.85;
    // A tall cabinet or a door on the side walls.
    col = mix(col, vec3(0.15, 0.12, 0.1), step(abs(p.z - size.z * 0.6), 0.4) * step(p.y, 2.1) * step(0.5, h3));
  }
  // Light falls off towards the back of the room.
  return col * mix(1.0, 0.45, clamp(p.z / size.z, 0.0, 1.0));
}`;
