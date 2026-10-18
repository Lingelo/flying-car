import * as THREE from 'three';
import { NEON_PALETTE } from './facade';
import { cityUniforms } from './cityUniforms';

const palette = `vec3 neonHue(float i) {
  return i < 0.5 ? vec3(${NEON_PALETTE[0].join(',')}) : i < 1.5 ? vec3(${NEON_PALETTE[1].join(',')}) : i < 2.5 ? vec3(${NEON_PALETTE[2].join(',')}) : vec3(${NEON_PALETTE[3].join(',')});
}
float signHash(vec2 p) { p = mod(p, 4096.0); return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
/** 5x5 pixel pseudo-glyph: a random but stable pattern per (cell, seed). */
float glyph(vec2 uv, vec2 cell, float seed) {
  vec2 px = floor(uv * 5.0);
  if (px.x < 0.0 || px.y < 0.0 || px.x > 4.0 || px.y > 4.0) return 0.0;
  // mirror horizontally like many CJK / katakana shapes
  px.x = min(px.x, 4.0 - px.x);
  return step(0.55, signHash(px + cell * 7.0 + seed * 131.0));
}`;

const vertex = `#include <common>
#include <fog_pars_vertex>
attribute vec2 aUv;
attribute vec4 aInfo;
varying vec2 vSignUv;
varying vec4 vInfo;
void main() {
  vSignUv = aUv;
  vInfo = aInfo;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const uniforms = () => THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]);

/** Animated billboards and vertical neon blades, entirely procedural (no texture to license). */
export function createSignMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms(), ...cityUniforms },
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: vertex,
    fragmentShader: `#include <common>
#include <fog_pars_fragment>
uniform float uNight;
uniform float uTime;
varying vec2 vSignUv;
varying vec4 vInfo;
${palette}
void main() {
  bool vertical = vInfo.x > 0.5;
  vec3 hue = neonHue(vInfo.y);
  float seed = vInfo.z;
  float aspect = vInfo.w;
  vec2 uv = vSignUv;
  vec3 col = vec3(0.01, 0.01, 0.02);
  float border = 1.0 - smoothstep(0.0, 0.035 * (vertical ? 1.0 : 1.0 / aspect), min(min(uv.x, 1.0 - uv.x) * (vertical ? 1.0 : aspect), min(uv.y, 1.0 - uv.y)));
  if (vertical) {
    // A column of glyphs, one per cell.
    float rows = floor(1.0 / aspect * 1.0 + 0.5);
    vec2 g = vec2(uv.x, uv.y * rows);
    vec2 cell = floor(g);
    float on = glyph((fract(g) - 0.15) / 0.7, cell, seed);
    col += hue * on * 1.4 + hue * border * 1.6;
  } else {
    // Rotating ads: a big glyph line, a gradient band and a scrolling ticker, changing every 6 s.
    float slot = floor(uTime / 6.0 + seed * 10.0);
    float adLayout = signHash(vec2(slot, seed * 97.0));
    vec3 hue2 = neonHue(floor(signHash(vec2(seed, slot)) * 4.0));
    vec3 bg = mix(hue * 0.18, hue2 * 0.35, uv.y + 0.2 * sin(uTime * 0.7 + seed * 6.0));
    col = bg;
    vec2 g = vec2(uv.x * aspect * 1.6, (uv.y - 0.35) * 1.6);
    vec2 cell = floor(g);
    if (cell.y == 0.0 && adLayout > 0.3) col += hue2 * 1.6 * glyph(fract(g) * 1.1 - 0.05, cell + slot, seed);
    float tick = step(0.08, uv.y) * step(uv.y, 0.22);
    vec2 tg = vec2((uv.x * aspect * 6.0) + uTime * 2.0, (uv.y - 0.08) / 0.14);
    col += hue * tick * glyph(fract(tg), floor(tg), seed + 0.5);
    col += hue * border * 1.5;
  }
  // Rare flicker of a dying neon.
  float flicker = signHash(vec2(floor(uTime * 12.0), seed * 50.0)) > 0.985 ? 0.2 : 1.0;
  col *= mix(0.55, 2.2, uNight) * flicker;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -4;
  return material;
}

/** Additive holograms floating above roofs: rings, glyphs and scanlines. */
export function createHologramMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...uniforms(), ...cityUniforms },
    fog: true,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: vertex,
    fragmentShader: `#include <common>
#include <fog_pars_fragment>
uniform float uNight;
uniform float uTime;
varying vec2 vSignUv;
varying vec4 vInfo;
${palette}
void main() {
  vec3 hue = neonHue(vInfo.y);
  float seed = vInfo.z;
  vec2 p = vSignUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float rings = smoothstep(0.03, 0.0, abs(r - 0.9)) + smoothstep(0.02, 0.0, abs(r - 0.75)) * step(0.0, sin(a * 6.0 + uTime * 1.5));
  vec2 g = (p * 0.55 + 0.5) * 3.0;
  float inner = r < 0.6 ? glyph(fract(g), floor(g) + floor(uTime / 4.0), seed) : 0.0;
  float scan = 0.65 + 0.35 * sin(vSignUv.y * 160.0 - uTime * 6.0);
  float flicker = 0.85 + 0.15 * sin(uTime * 23.0 + seed * 40.0);
  float alpha = (rings + inner * 0.8) * scan * flicker * mix(0.35, 1.0, uNight) * step(r, 1.0);
  gl_FragColor = vec4(hue * alpha * 1.6, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  });
}

/** Soft steam puffs rising from grates, animated on the GPU (`aSeed` gives each puff its phase). */
export function createSteamMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...uniforms(), ...cityUniforms, uScale: { value: 600 } },
    fog: true,
    transparent: true,
    depthWrite: false,
    vertexShader: `#include <common>
#include <fog_pars_vertex>
uniform float uTime;
uniform float uScale;
attribute float aSeed;
varying float vLife;
void main() {
  float life = fract(uTime * 0.12 + aSeed);
  vLife = life;
  vec3 p = position;
  p.y += life * 9.0;
  p.x += sin(aSeed * 40.0 + life * 3.0) * life * 2.0;
  p.z += cos(aSeed * 23.0 + life * 2.0) * life * 2.0;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uScale * (1.0 + life * 2.5) / -mvPosition.z;
  #include <fog_vertex>
}`,
    fragmentShader: `#include <common>
#include <fog_pars_fragment>
uniform float uNight;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.0, d) * (1.0 - vLife) * smoothstep(0.0, 0.1, vLife) * 0.22;
  gl_FragColor = vec4(mix(vec3(0.75), vec3(0.45, 0.4, 0.6), uNight), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  });
}
