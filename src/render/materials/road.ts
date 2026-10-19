import * as THREE from 'three';
import { REFLECTION_FRAGMENT_PARS, REFLECTION_VERTEX, reflectionFragment } from '../reflection';
import { cityUniforms } from './cityUniforms';
import { loadTextureSet } from '../textures';

/** Photographic CC0 asphalt and paving (R9), filled once loaded; procedural look until then. */
export const groundUniforms: Record<string, { value: unknown }> = {
  uGroundReady: { value: 0 },
  uAsphalt: { value: null },
  uAsphaltN: { value: null },
  uPave: { value: null },
  uPaveN: { value: null },
};

export async function loadGroundTextures(): Promise<void> {
  const [asphalt, pave] = await Promise.all([loadTextureSet('asphalt'), loadTextureSet('pavement')]);
  if (!asphalt || !pave) return;
  // Set the values in place: compiled shaders hold these uniform objects.
  groundUniforms.uAsphalt.value = asphalt.diff;
  groundUniforms.uAsphaltN.value = asphalt.nor;
  groundUniforms.uPave.value = pave.diff;
  groundUniforms.uPaveN.value = pave.nor;
  groundUniforms.uGroundReady.value = 1;
}

/** GLSL: a tangent-space normal of a horizontal surface (uv = world x, -z) brought to view space. */
const GROUND_NORMAL = `
vec3 groundNormal(vec3 tn, float strength) {
  vec3 world = normalize(vec3(tn.x * strength, tn.z, -tn.y * strength));
  return normalize((viewMatrix * vec4(world, 0.0)).xyz);
}`;

/** Asphalt with lane markings drawn from the road UVs (u across in metres, v along in metres). */
export function createRoadMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.9, metalness: 0.0 });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -4;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cityUniforms, groundUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aUv;
attribute vec4 aInfo;
varying vec2 vRoadUv;
varying vec4 vRoad;
varying vec3 vRoadWorld;
${REFLECTION_VERTEX.pars}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${REFLECTION_VERTEX.main}
vRoadUv = aUv;
vRoad = aInfo;
vRoadWorld = (modelMatrix * vec4(position, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uNight;
uniform float uWetness;
uniform float uRain;
uniform float uTime;
uniform float uGroundReady;
uniform sampler2D uAsphalt;
uniform sampler2D uAsphaltN;
varying vec2 vRoadUv;
varying vec4 vRoad;
varying vec3 vRoadWorld;
${REFLECTION_FRAGMENT_PARS}
${GROUND_NORMAL}
vec3 asphaltTn;
float roadHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float roadNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(roadHash(i), roadHash(i + vec2(1, 0)), f.x), mix(roadHash(i + vec2(0, 1)), roadHash(i + vec2(1, 1)), f.x), f.y);
}
float line(float u, float at, float halfWidth) {
  float w = fwidth(u);
  return 1.0 - smoothstep(halfWidth - w, halfWidth + w, abs(u - at));
}
float puddle;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float width = vRoad.x;
  bool avenue = vRoad.y > 0.5;
  bool crossing = vRoad.z > 0.5;
  float u = vRoadUv.x;
  float v = vRoadUv.y;
  float halfW = width * 0.5;
  float paint = 0.0;
  if (!crossing) {
    float dash = step(0.5, fract(v / 6.0));
    paint += line(u, halfW - 0.6, 0.1);
    paint += line(u, -halfW + 0.6, 0.1);
    if (avenue) {
      paint += line(u, 1.5, 0.08) + line(u, -1.5, 0.08);
      paint += (line(u, 5.0, 0.08) + line(u, -5.0, 0.08) + line(u, 8.5, 0.08) + line(u, -8.5, 0.08)) * dash;
    } else {
      paint += line(u, 0.0, 0.08) * dash;
    }
  } else {
    // Zebra crossings on the edges of intersections.
    float zebra = step(0.5, fract(u / 1.2)) * (1.0 - step(2.5, abs(abs(v) - (halfW - 2.5))));
    paint += zebra * 0.8;
    if (vRoad.w > 1.5) {
      // Scramble crossing: zebra bands along both diagonals.
      float d1 = abs(u - v) * 0.7071;
      float d2 = abs(u + v) * 0.7071;
      float s1 = step(0.5, fract((u + v) * 0.7071 / 1.2)) * (1.0 - step(2.2, d1));
      float s2 = step(0.5, fract((u - v) * 0.7071 / 1.2)) * (1.0 - step(2.2, d2));
      paint += max(s1, s2) * 0.8 * step(abs(v), halfW - 5.0) * step(abs(u), halfW - 5.0);
    }
  }
  paint = clamp(paint, 0.0, 1.0);
  asphaltTn = vec3(0.0, 0.0, 1.0);
  vec3 base;
  if (uGroundReady > 0.5) {
    // Worn asphalt (6 m tile) with a finer second sample so it holds up close, and large patches
    // of repairs and oil stains.
    vec2 auv = vec2(vRoadWorld.x, -vRoadWorld.z);
    vec3 a = texture2D(uAsphalt, auv / 6.0).rgb * 0.7 + texture2D(uAsphalt, auv / 1.7 + 0.37).rgb * 0.3;
    asphaltTn = texture2D(uAsphaltN, auv / 6.0).xyz * 2.0 - 1.0;
    float patches = smoothstep(0.55, 0.62, roadNoise(vRoadWorld.xz * 0.08));
    base = a * mix(0.32, 0.24, patches) * (0.85 + 0.3 * roadNoise(vRoadWorld.xz * 0.4));
  } else {
    base = diffuseColor.rgb + roadNoise(vRoadWorld.xz * 2.0) * 0.06;
  }
  // Paint is worn by tyres: broken up by the asphalt grain.
  float wear = smoothstep(0.25, 0.6, roadNoise(vRoadWorld.xz * 6.0));
  diffuseColor.rgb = mix(base, vec3(0.72), paint * mix(0.55, 0.85, wear));
  puddle = smoothstep(0.55, 0.7, roadNoise(vRoadWorld.xz * 0.12) * 0.7 + roadNoise(vRoadWorld.xz * 0.5) * 0.3);
  // Rain ripples in the puddles: expanding rings in a 1.5 m grid, each with its own phase.
  vec2 cellR = floor(vRoadWorld.xz / 1.5);
  vec2 fr = fract(vRoadWorld.xz / 1.5) - 0.5;
  float phase = fract(uTime * 1.2 + roadHash(cellR) * 7.0);
  float ring = smoothstep(0.05, 0.0, abs(length(fr) - phase * 0.5)) * (1.0 - phase);
  diffuseColor.rgb += vec3(0.12) * ring * puddle * uRain;
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, mix(0.25, 0.03, puddle), uWetness);
diffuseColor.rgb *= mix(1.0, 0.55, uWetness);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Puddles are flat water: no asphalt relief under them.
normal = groundNormal(asphaltTn, 1.2 * (1.0 - puddle * uWetness));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  // Wet streets mirror the storefront neons: coloured streaks along both kerbs, stronger at
  // grazing angles (Fresnel). A cheap stand-in for screen-space reflections (KTD10).
  if (vRoad.z < 0.5) {
    float halfW = vRoad.x * 0.5;
    float kerb = exp(-pow((abs(vRoadUv.x) - (halfW - 1.5)) / 1.1, 2.0));
    // Broken into streaks running along the street, like reflections on rippled water.
    float streaks = smoothstep(0.35, 0.85, roadNoise(vec2(vRoadUv.x * 2.5, vRoadUv.y * 0.12)));
    float seg = floor(vRoadUv.y / 9.0 + (vRoadUv.x > 0.0 ? 0.5 : 0.0));
    float h = roadHash(vec2(seg, vRoadUv.x > 0.0 ? 1.0 : 2.0));
    vec3 neon = h < 0.25 ? vec3(1.0, 0.16, 0.75) : h < 0.5 ? vec3(0.1, 0.85, 1.0) : h < 0.75 ? vec3(0.55, 0.25, 1.0) : vec3(1.0, 0.62, 0.12);
    float on = step(0.35, roadHash(vec2(seg, 7.0)));
    float fresnel = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
    totalEmissiveRadiance += neon * kerb * streaks * on * fresnel * uWetness * mix(0.3, 1.0, puddle) * uNight * 0.8 * (1.0 - uReflectionOn);
  }
}
${reflectionFragment('uWetness * mix(0.18, 0.85, puddle)', 'puddle', 'vec2(roadNoise(vRoadWorld.xz * 3.0 + uTime) - 0.5, 0.0) * 0.004 * uRain')}`);
  };
  material.customProgramCacheKey = () => 'road-v3';
  return material;
}

/** Sidewalks and plazas: herringbone concrete paving; kerbs (info.x = 1) are plain concrete. */
export function createGroundMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.92, metalness: 0.0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cityUniforms, groundUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aUv;
attribute vec4 aInfo;
varying vec2 vGroundUv;
varying vec3 vGroundWorld;
varying float vKerb;
${REFLECTION_VERTEX.pars}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${REFLECTION_VERTEX.main}
vGroundUv = aUv;
vKerb = aInfo.x;
vGroundWorld = (modelMatrix * vec4(position, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uWetness;
uniform float uGroundReady;
uniform sampler2D uPave;
uniform sampler2D uPaveN;
varying vec2 vGroundUv;
varying vec3 vGroundWorld;
varying float vKerb;
${REFLECTION_FRAGMENT_PARS}
${GROUND_NORMAL}
float groundHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 paveTn;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  paveTn = vec3(0.0, 0.0, 1.0);
  if (vKerb > 0.5) {
    // Concrete kerb, a little chipped, dirtier at its foot.
    float chip = groundHash(floor(vGroundUv * vec2(4.0, 30.0)));
    diffuseColor.rgb = vec3(0.3, 0.3, 0.31) * (0.85 + 0.2 * chip) * mix(0.65, 1.0, smoothstep(0.0, 0.1, vGroundWorld.y));
  } else if (uGroundReady > 0.5) {
    vec2 puv = vec2(vGroundWorld.x, -vGroundWorld.z) / 2.0;
    vec3 tile = texture2D(uPave, puv).rgb;
    paveTn = texture2D(uPaveN, puv).xyz * 2.0 - 1.0;
    // Slabs vary from one to the next and darken with grime in large patches.
    float slab = groundHash(floor(vGroundWorld.xz / 0.5));
    float grime = groundHash(floor(vGroundWorld.xz / 7.0));
    diffuseColor.rgb = tile * 0.42 * (0.88 + 0.24 * slab) * mix(1.0, 0.7, step(0.6, grime));
  } else {
    vec2 g = abs(fract(vGroundUv / 2.0) - 0.5);
    vec2 w = fwidth(vGroundUv / 2.0);
    float joint = 1.0 - smoothstep(0.0, w.x + w.y + 0.01, 0.5 - max(g.x, g.y));
    diffuseColor.rgb *= 1.0 - 0.35 * joint;
  }
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.2, uWetness);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (vKerb < 0.5) normal = groundNormal(paveTn, 1.0);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
${reflectionFragment('uWetness * 0.35', '0.15', 'vec2(0.0)')}`);
  };
  material.customProgramCacheKey = () => 'ground-v3';
  return material;
}

export function createWaterMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: 0x03080f, roughness: 0.04, metalness: 0.2 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cityUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
${REFLECTION_VERTEX.pars}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${REFLECTION_VERTEX.main}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
${REFLECTION_FRAGMENT_PARS}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
${reflectionFragment('0.85', '0.8', 'vec2(sin(vReflectionUv.x / vReflectionUv.w * 40.0 + uTime), cos(vReflectionUv.y / vReflectionUv.w * 30.0 + uTime * 0.7)) * 0.003')}`);
  };
  material.customProgramCacheKey = () => 'water-v2';
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -4;
  return material;
}
