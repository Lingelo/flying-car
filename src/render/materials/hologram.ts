import * as THREE from 'three';
import { NEON_PALETTE } from './facade';
import { cityUniforms } from './cityUniforms';
import { ATLAS_GLSL } from '../signAtlas';

/** Japanese sign atlas, set once the font is loaded (until then signs show pseudo-glyphs). */
export const signUniforms = {
  uAtlas: { value: null as THREE.Texture | null },
  uTubeAtlas: { value: null as THREE.Texture | null },
  uAtlasReady: { value: 0 },
};

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

/**
 * Signs of Tokyo: vertical blades, banners and giant screens with real Japanese words from the
 * atlas, in three looks (neon on dark, lit colour panel, white panel with red letters).
 */
export function createSignMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms(), ...cityUniforms, ...signUniforms },
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: vertex,
    fragmentShader: `#include <common>
#include <fog_pars_fragment>
uniform float uNight;
uniform float uTime;
uniform sampler2D uAtlas;
uniform float uAtlasReady;
varying vec2 vSignUv;
varying vec4 vInfo;
${palette}
${ATLAS_GLSL}
vec3 signFace(float kind, float seed, vec3 hue, vec2 uv, float aspect) {
  float look = signHash(vec2(seed * 91.0, 3.0));
  vec4 cell = atlasCell(kind, seed);
  // Keep the cell's own aspect: letterbox the text inside the sign.
  vec2 t = atlasText(uAtlas, cell, uv);
  float crisp = t.x;
  float glow = t.y;
  if (look < 0.6) {
    vec3 panel = hue * 1.1 + 0.08;
    return mix(panel, vec3(0.02), crisp * 0.92);
  }
  vec3 paper = vec3(1.0, 0.95, 0.86) * 1.15;
  return mix(paper, vec3(0.85, 0.04, 0.07), crisp);
}
void main() {
  float kind = vInfo.x;
  vec3 hue = neonHue(vInfo.y);
  float seed = vInfo.z;
  float aspect = vInfo.w;
  vec2 uv = vSignUv;
  // Double-sided signs read the right way round from behind too.
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  vec3 col;
  bool vertical = kind > 0.5 && kind < 1.5;
  bool giant = kind > 2.5 && kind < 3.5;
  if (kind > 3.5) {
    // Open steel frame carrying neon tubes: border, cross struts and mounting rails.
    vec2 m = vec2(min(uv.x, 1.0 - uv.x) * aspect, min(uv.y, 1.0 - uv.y));
    float bar = step(min(m.x, m.y), 0.035);
    float strut = step(abs(fract(uv.y * 4.0) - 0.5), 0.025 * aspect) + step(abs(uv.x - 0.5) * aspect, 0.03);
    if (bar + strut < 0.5) discard;
    gl_FragColor = vec4(vec3(0.05, 0.05, 0.06) * mix(1.0, 0.4, uNight), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    return;
  }
  float edge = min(min(uv.x, 1.0 - uv.x) * (vertical ? 1.0 : aspect), min(uv.y, 1.0 - uv.y) * (vertical ? 1.0 / aspect : 1.0));
  float border = 1.0 - smoothstep(0.0, 0.04, edge);
  if (uAtlasReady > 0.5) {
    if (vertical) {
      col = signFace(0.0, seed, hue, uv, aspect);
    } else if (!giant && aspect > 1.5) {
      col = signFace(1.0, seed, hue, uv, aspect);
    } else {
      // Screens change advert every 6 s; giant ones add an LED grid and rolling colour bands.
      float slot = floor(uTime / 6.0 + seed * 10.0);
      float s2 = fract(seed + slot * 0.618);
      vec3 hue2 = neonHue(floor(signHash(vec2(seed, slot)) * 4.0));
      vec3 bg = mix(hue * 0.25, hue2 * 0.6, uv.y + 0.25 * sin(uTime * 0.8 + uv.x * 6.0 + seed * 9.0));
      vec2 t = atlasText(uAtlas, atlasCell(2.0, s2), uv);
      col = bg * (1.0 - t.x) + vec3(1.6) * t.x + hue2 * t.y * 0.6;
      if (giant) {
        vec2 led = fract(uv * vec2(aspect, 1.0) * 90.0);
        col *= 0.75 + 0.25 * step(0.25, led.x) * step(0.25, led.y);
        col *= 0.9 + 0.1 * sin(uv.y * 400.0 - uTime * 20.0);
      }
    }
    col += hue * border * 1.2;
  } else {
    // Pseudo-glyph fallback while the Japanese font loads.
    col = vec3(0.01, 0.01, 0.02);
    vec2 g = vertical ? vec2(uv.x, uv.y * floor(1.0 / aspect + 0.5)) : vec2(uv.x * aspect * 1.6, (uv.y - 0.35) * 1.6);
    col += hue * glyph(fract(g) * 1.1 - 0.05, floor(g), seed) * 1.4 + hue * border * 1.5;
  }
  float flicker = signHash(vec2(floor(uTime * 12.0), seed * 50.0)) > 0.99 ? 0.25 : 1.0;
  col *= mix(0.6, 1.9, uNight) * flicker;
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

/** Neon tubes: hollow glowing letters on their frame, white-hot core and coloured halo (R5). */
export function createNeonMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms(), ...cityUniforms, ...signUniforms },
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
uniform sampler2D uTubeAtlas;
uniform float uAtlasReady;
varying vec2 vSignUv;
varying vec4 vInfo;
${palette}
${ATLAS_GLSL}
void main() {
  if (uAtlasReady < 0.5) discard;
  float kind = vInfo.x;
  vec3 hue = neonHue(vInfo.y);
  float seed = vInfo.z;
  float aspect = vInfo.w;
  vec2 uv = vSignUv;
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  bool vertical = kind > 0.5 && kind < 1.5;
  float cellKind = vertical ? 0.0 : aspect > 1.5 ? 1.0 : 2.0;
  vec4 c = atlasCell(cellKind, seed);
  vec3 tube = texture2D(uTubeAtlas, vec2(mix(c.x, c.z, uv.x), mix(c.w, c.y, uv.y))).rgb;
  // Old neon buzzes: a band of the sign flickers now and then.
  float band = floor(uv.y * 3.0 + uv.x * 2.0);
  float buzz = signHash(vec2(floor(uTime * 14.0), seed * 40.0 + band)) > 0.97 ? 0.15 : 1.0;
  vec3 col = (vec3(1.0, 0.95, 0.9) * tube.r * 2.2 + hue * tube.g * 2.6 + hue * tube.b * 0.9) * buzz;
  col *= mix(0.45, 1.6, uNight);
  if (dot(col, vec3(1.0)) < 0.004) discard;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -4;
  material.polygonOffsetUnits = -8;
  return material;
}

/** Glow of the neons in the humid air: soft additive sprites, stronger in mist and rain (R6). */
export function createHaloMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...uniforms(), ...cityUniforms, uScale: { value: 900 } },
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `#include <common>
#include <fog_pars_vertex>
uniform float uScale;
attribute vec2 aHalo; // size, hue
varying float vHue;
void main() {
  vHue = aHalo.y;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = min(512.0, uScale * aHalo.x / -mvPosition.z);
  #include <fog_vertex>
}`,
    fragmentShader: `#include <common>
#include <fog_pars_fragment>
uniform float uNight;
uniform float uHaze;
varying float vHue;
${palette}
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-d * d * 4.0) * (1.0 - smoothstep(0.8, 1.0, d));
  vec3 col = neonHue(vHue) * a * uNight * (0.035 + 0.16 * uHaze);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`,
  });
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
