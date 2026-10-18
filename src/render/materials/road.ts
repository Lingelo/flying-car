import * as THREE from 'three';
import { cityUniforms } from './cityUniforms';

/** Asphalt with lane markings drawn from the road UVs (u across in metres, v along in metres). */
export function createRoadMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.9, metalness: 0.0 });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -4;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cityUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aUv;
attribute vec4 aInfo;
varying vec2 vRoadUv;
varying vec4 vRoad;
varying vec3 vRoadWorld;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vRoadUv = aUv;
vRoad = aInfo;
vRoadWorld = (modelMatrix * vec4(position, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uNight;
uniform float uWetness;
varying vec2 vRoadUv;
varying vec4 vRoad;
varying vec3 vRoadWorld;
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
      paint += line(u, 0.18, 0.07) + line(u, -0.18, 0.07);
      paint += (line(u, 4.0, 0.08) + line(u, -4.0, 0.08) + line(u, 8.0, 0.08) + line(u, -8.0, 0.08)) * dash;
    } else {
      paint += line(u, 0.0, 0.08) * dash;
    }
  } else {
    // Zebra crossings on the edges of intersections.
    float zebra = step(0.5, fract(u / 1.2)) * (1.0 - step(2.5, abs(abs(v) - (halfW - 2.5))));
    paint += zebra * 0.8;
  }
  paint = clamp(paint, 0.0, 1.0);
  float grain = roadNoise(vRoadWorld.xz * 2.0) * 0.06;
  diffuseColor.rgb = mix(diffuseColor.rgb + grain, vec3(0.75), paint * 0.85);
  puddle = smoothstep(0.55, 0.7, roadNoise(vRoadWorld.xz * 0.12) * 0.7 + roadNoise(vRoadWorld.xz * 0.5) * 0.3);
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, mix(0.25, 0.03, puddle), uWetness);
diffuseColor.rgb *= mix(1.0, 0.55, uWetness);`);
  };
  material.customProgramCacheKey = () => 'road-v1';
  return material;
}

/** Sidewalks and plazas: concrete slabs. */
export function createGroundMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.92, metalness: 0.0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cityUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aUv;
varying vec2 vGroundUv;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vGroundUv = aUv;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uWetness;
varying vec2 vGroundUv;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 g = abs(fract(vGroundUv / 2.0) - 0.5);
  vec2 w = fwidth(vGroundUv / 2.0);
  float joint = 1.0 - smoothstep(0.0, w.x + w.y + 0.01, 0.5 - max(g.x, g.y));
  diffuseColor.rgb *= 1.0 - 0.35 * joint;
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.2, uWetness);`);
  };
  material.customProgramCacheKey = () => 'ground-v1';
  return material;
}

export function createWaterMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: 0x03080f, roughness: 0.04, metalness: 0.2 });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -4;
  return material;
}
