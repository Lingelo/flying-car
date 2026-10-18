import * as THREE from 'three';
import { FLOOR_HEIGHT } from '../../city/buildingMesh';
import { cityUniforms } from './cityUniforms';

/** Neon accent palette (magenta, cyan, violet, amber) picked per building from its seed. */
export const NEON_PALETTE: [number, number, number][] = [
  [1.0, 0.16, 0.75],
  [0.1, 0.85, 1.0],
  [0.55, 0.25, 1.0],
  [1.0, 0.62, 0.12],
];

/** Window column width per style: grid, ribbons, curtain wall, sparse, skywalk. */
export const STYLE_COLUMN_WIDTH = [3.2, 6.0, 1.8, 4.5, 2.0];

const vec3 = (c: number[]) => `vec3(${c.map((v) => v.toFixed(3)).join(',')})`;

/**
 * Building material: windows, storefronts and neon roof outlines are procedural, drawn from the
 * metre-based UVs and per-vertex info (seed, style, tier top, roof flag) built by `buildingMesh`.
 */
export function createFacadeMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.15 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cityUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 aUv;
attribute vec4 aInfo;
varying vec2 vFacadeUv;
varying vec4 vInfo;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vFacadeUv = aUv;
vInfo = aInfo;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uNight;
uniform float uWetness;
uniform float uTime;
varying vec2 vFacadeUv;
varying vec4 vInfo;
// Interleaved-gradient style hash: stable in low-precision GPUs, unlike fract(sin(x)).
float facadeHash(vec2 p) { p = mod(p, 4096.0); return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec3 neonColor(float seed) {
  float i = floor(fract(seed * 13.7) * 4.0);
  return i < 1.0 ? ${vec3(NEON_PALETTE[0])} : i < 2.0 ? ${vec3(NEON_PALETTE[1])} : i < 3.0 ? ${vec3(NEON_PALETTE[2])} : ${vec3(NEON_PALETTE[3])};
}
float windowMask;
vec3 facadeEmissive;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float seed = vInfo.x;
  int style = int(vInfo.y + 0.5);
  float tierTop = vInfo.z;
  bool roof = vInfo.w > 0.5;
  windowMask = 0.0;
  facadeEmissive = vec3(0.0);
  if (roof) {
    diffuseColor.rgb *= 0.55;
  } else {
    float colW = style == 0 ? ${STYLE_COLUMN_WIDTH[0].toFixed(1)} : style == 1 ? ${STYLE_COLUMN_WIDTH[1].toFixed(1)} : style == 2 ? ${STYLE_COLUMN_WIDTH[2].toFixed(1)} : style == 3 ? ${STYLE_COLUMN_WIDTH[3].toFixed(1)} : ${STYLE_COLUMN_WIDTH[4].toFixed(1)};
    vec2 cellUv = vFacadeUv / vec2(colW, ${FLOOR_HEIGHT.toFixed(2)});
    vec2 cell = floor(cellUv);
    vec2 f = fract(cellUv);
    vec2 fw = fwidth(cellUv);
    // Window opening inside each cell, per style.
    vec2 lo = style == 1 ? vec2(0.02, 0.3) : style == 2 ? vec2(0.06, 0.08) : style == 3 ? vec2(0.3, 0.3) : vec2(0.18, 0.25);
    vec2 hi = vec2(1.0) - lo;
    vec2 m = smoothstep(lo - fw, lo + fw, f) * (1.0 - smoothstep(hi - fw, hi + fw, f));
    float win = m.x * m.y;
    // Far away the pattern is smaller than a pixel: fade to its average to avoid moire.
    float far = clamp(max(fw.x, fw.y) * 2.0 - 0.4, 0.0, 1.0);
    float coverage = (hi.x - lo.x) * (hi.y - lo.y);
    win = mix(win, coverage, far);
    bool ground = vFacadeUv.y < 4.5;
    windowMask = ground ? 0.0 : win;
    float r = facadeHash(cell + vec2(seed * 917.0, seed * 413.0));
    float litRatio = mix(0.03, 0.3, uNight);
    float lit = (1.0 - smoothstep(litRatio - 0.02, litRatio + 0.02, r)) * windowMask;
    lit = mix(lit, litRatio * coverage, far);
    vec3 warm = vec3(1.0, 0.72, 0.42);
    vec3 cool = vec3(0.62, 0.8, 1.0);
    vec3 neon = neonColor(seed);
    float r2 = facadeHash(cell.yx + seed * 31.0);
    vec3 lightColor = r2 < 0.55 ? warm : r2 < 0.9 ? cool : neon;
    float dim = 0.35 + 0.65 * facadeHash(cell * 1.7 + seed * 53.0);
    facadeEmissive += lightColor * lit * dim * mix(0.25, 1.4, uNight);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.03, 0.05), windowMask);
    // Storefront band at street level.
    if (ground && style != 4) {
      float shop = step(0.6, fract(vFacadeUv.x / 9.0 + seed)) * step(1.2, vFacadeUv.y) * (1.0 - step(3.6, vFacadeUv.y));
      facadeEmissive += neon * shop * mix(0.3, 2.2, uNight) * (0.7 + 0.3 * sin(uTime * 3.0 + seed * 40.0));
    }
    // Neon outline under the roof of some buildings, and glowing skywalks.
    float outline = 1.0 - smoothstep(0.5, 0.9, tierTop - vFacadeUv.y);
    float hasOutline = step(fract(seed * 3.1), 0.55);
    facadeEmissive += neon * outline * hasOutline * mix(0.2, 3.0, uNight);
    if (style == 4) facadeEmissive += neon * 0.6 * windowMask * mix(0.2, 1.0, uNight);
  }
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.08, windowMask);
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.35, uWetness);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.8, windowMask);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += facadeEmissive;`,
      );
  };
  material.customProgramCacheKey = () => 'facade-v1';
  return material;
}
