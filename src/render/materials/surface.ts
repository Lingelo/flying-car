import * as THREE from 'three';
import { loadTextureSet, type TextureId } from '../textures';

/**
 * Surface kinds of props, viaducts and temples, stored in `info.x` of their quads. Each one maps to
 * a CC0 photo texture; PLAIN keeps the flat vertex colour (cables, glass).
 */
export const SURFACE = { METAL: 0, CONCRETE: 1, WOOD: 2, ROOF_TILES: 3, PLAIN: 4 } as const;
export type Surface = (typeof SURFACE)[keyof typeof SURFACE];

const TEXTURES: [TextureId, number][] = [
  ['rustyPaint', 2],
  ['concrete', 3],
  ['wood', 2],
  ['roofTiles', 2],
];

export const surfaceUniforms: Record<string, { value: unknown }> = {
  uSurfaceReady: { value: 0 },
  ...Object.fromEntries(TEXTURES.flatMap((_, i) => [[`uSurf${i}`, { value: null }], [`uSurfN${i}`, { value: null }]])),
};

export async function loadSurfaceTextures(): Promise<void> {
  const sets = await Promise.all(TEXTURES.map(([id]) => loadTextureSet(id)));
  if (sets.some((s) => !s)) return; // flat vertex colours stay
  sets.forEach((s, i) => {
    surfaceUniforms[`uSurf${i}`].value = s!.diff;
    surfaceUniforms[`uSurfN${i}`].value = s!.nor;
  });
  surfaceUniforms.uSurfaceReady.value = 1;
}

const samplers = TEXTURES.map((_, i) => `uniform sampler2D uSurf${i};\nuniform sampler2D uSurfN${i};`).join('\n');
const pick = (name: string) =>
  TEXTURES.map(([, metres], i) => `${i ? 'else ' : ''}if (k == ${i}) r = texture2D(${name}${i}, uv / ${metres.toFixed(1)});`).join('\n  ');

/**
 * Vertex-coloured material whose surfaces get the photo texture of their kind, projected on the
 * dominant axis of the world normal (box-like props need no UVs). The vertex colour tints it.
 */
export function createSurfaceMaterial(params: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.15, ...params });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, surfaceUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aInfo;
varying float vSurface;
varying vec3 vSurfWorld;
varying vec3 vSurfNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vSurface = aInfo.x;
vSurfWorld = (modelMatrix * vec4(position, 1.0)).xyz;
vSurfNormal = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uSurfaceReady;
${samplers}
varying float vSurface;
varying vec3 vSurfWorld;
varying vec3 vSurfNormal;
vec4 surfAlbedo(int k, vec2 uv) { vec4 r = vec4(0.5); ${pick('uSurf')} return r; }
vec4 surfNormal(int k, vec2 uv) { vec4 r = vec4(0.5, 0.5, 1.0, 1.0); ${pick('uSurfN')} return r; }
vec3 surfTn;
vec3 surfT;
vec3 surfB;
vec3 surfN;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
surfTn = vec3(0.0, 0.0, 1.0);
int surfKind = int(vSurface + 0.5);
surfN = normalize(vSurfNormal);
vec3 an = abs(surfN);
// Project on the plane facing the dominant axis; T/B follow that plane's uv axes.
vec2 suv;
if (an.y > an.x && an.y > an.z) { suv = vSurfWorld.xz; surfT = vec3(1.0, 0.0, 0.0); surfB = vec3(0.0, 0.0, 1.0); }
else if (an.x > an.z) { suv = vSurfWorld.zy; surfT = vec3(0.0, 0.0, 1.0); surfB = vec3(0.0, 1.0, 0.0); }
else { suv = vSurfWorld.xy; surfT = vec3(1.0, 0.0, 0.0); surfB = vec3(0.0, 1.0, 0.0); }
if (uSurfaceReady > 0.5 && surfKind < ${TEXTURES.length}) {
  vec3 photo = surfAlbedo(surfKind, suv).rgb;
  // The vertex colour sets the hue (red torii, white vending machines); the photo brings grain,
  // stains and wear around its own average brightness.
  diffuseColor.rgb *= clamp(photo / max(0.05, dot(photo, vec3(0.333))), 0.0, 2.0) * mix(0.75, 1.15, dot(photo, vec3(0.333)));
  surfTn = surfNormal(surfKind, suv).xyz * 2.0 - 1.0;
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
if (surfKind == ${SURFACE.METAL}) roughnessFactor *= 0.8;
if (surfKind == ${SURFACE.ROOF_TILES}) roughnessFactor = 0.55;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (uSurfaceReady > 0.5 && surfKind < ${TEXTURES.length}) {
  vec3 w = normalize(surfT * surfTn.x + surfB * surfTn.y + surfN * surfTn.z * 1.4);
  // Keep the detail on the side the face points to.
  if (dot(w, surfN) < 0.0) w = -w;
  normal = normalize((viewMatrix * vec4(w, 0.0)).xyz);
  #ifdef DOUBLE_SIDED
    normal *= faceDirection;
  #endif
}`);
  };
  material.customProgramCacheKey = () => 'surface-v1';
  return material;
}
