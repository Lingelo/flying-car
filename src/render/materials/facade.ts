import * as THREE from 'three';
import { ATLAS_GLSL } from '../signAtlas';
import { FLOOR_HEIGHT } from '../../city/buildingMesh';
import manifest from '../textureManifest.json';
import { loadTextureSet, type TextureId } from '../textures';
import { cityUniforms } from './cityUniforms';
import { INTERIOR_GLSL } from './interior';

/** Neon accent palette (magenta, cyan, violet, amber) picked per building from its seed. */
export const NEON_PALETTE: [number, number, number][] = [
  [1.0, 0.16, 0.75],
  [0.1, 0.85, 1.0],
  [0.55, 0.25, 1.0],
  [1.0, 0.62, 0.12],
];

/** Window column width per style: grid, ribbons, curtain wall, sparse, skywalk. */
export const STYLE_COLUMN_WIDTH = [3.2, 6.0, 1.8, 4.5, 2.0];

/** Wall materials, in the order the shader indexes them (0–3 by style, 4 industrial). */
export const FACADE_TEXTURES: TextureId[] = ['panels', 'tileFacade', 'precast', 'tiles', 'corrugated'];
const metres = (id: TextureId) => manifest.textures.find((t) => t.id === id)!.metres;

const vec3 = (c: number[]) => `vec3(${c.map((v) => v.toFixed(3)).join(',')})`;

/** Wall textures shared by every facade, filled once the CC0 maps are loaded. */
export const facadeUniforms: Record<string, { value: unknown }> = {
  uFacadeReady: { value: 0 },
  /** Japanese sign atlas for the shop sign bands, once its font is loaded. */
  uShopAtlas: { value: null },
  uShopAtlasReady: { value: 0 },
  /** Flat concrete roofs. */
  uRoofTex: { value: null },
  uRoofN: { value: null },
  ...Object.fromEntries(FACADE_TEXTURES.flatMap((_, i) => [[`uWall${i}`, { value: null }], [`uWallN${i}`, { value: null }]])),
};

export async function loadFacadeTextures(): Promise<void> {
  const [sets, rooftop] = await Promise.all([Promise.all(FACADE_TEXTURES.map((id) => loadTextureSet(id))), loadTextureSet('rooftop')]);
  if (sets.some((s) => !s) || !rooftop) return; // keep the procedural look
  facadeUniforms.uRoofTex.value = rooftop.diff;
  facadeUniforms.uRoofN.value = rooftop.nor;
  sets.forEach((s, i) => {
    facadeUniforms[`uWall${i}`].value = s!.diff;
    facadeUniforms[`uWallN${i}`].value = s!.nor;
  });
  facadeUniforms.uFacadeReady.value = 1;
}

const samplerDecls = FACADE_TEXTURES.map((_, i) => `uniform sampler2D uWall${i};\nuniform sampler2D uWallN${i};`).join('\n');
// Branches on a per-building index: textureGrad keeps mipmapping correct in non-uniform flow.
const pick = (name: string) =>
  FACADE_TEXTURES.map((id, i) => `${i ? 'else ' : ''}if (m == ${i}) r = textureGrad(${name}${i}, uv / ${metres(id).toFixed(1)}, gx / ${metres(id).toFixed(1)}, gy / ${metres(id).toFixed(1)});`).join('\n    ');

/**
 * Building material: photographic CC0 walls with normal maps and grime, windows that open onto
 * interior-mapped rooms (R2), storefronts at street level and neon outlines under the roofs.
 */
export function createFacadeMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cityUniforms, facadeUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 aUv;
attribute vec4 aInfo;
varying vec2 vFacadeUv;
varying vec4 vInfo;
varying vec3 vWallNormal;
varying vec3 vFacadeWorld;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vFacadeUv = aUv;
vInfo = aInfo;
vWallNormal = normal;
vFacadeWorld = (modelMatrix * vec4(position, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uNight;
uniform float uWetness;
uniform float uTime;
uniform float uFacadeReady;
uniform sampler2D uShopAtlas;
uniform sampler2D uRoofTex;
uniform sampler2D uRoofN;
uniform float uShopAtlasReady;
${ATLAS_GLSL}
${samplerDecls}
varying vec2 vFacadeUv;
varying vec4 vInfo;
varying vec3 vWallNormal;
varying vec3 vFacadeWorld;
float facadeHash(vec2 p) { p = mod(p, 4096.0); return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float facadeNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(facadeHash(i), facadeHash(i + vec2(1, 0)), f.x), mix(facadeHash(i + vec2(0, 1)), facadeHash(i + vec2(1, 1)), f.x), f.y);
}
vec3 neonColor(float seed) {
  float i = floor(fract(seed * 13.7) * 4.0);
  return i < 1.0 ? ${vec3(NEON_PALETTE[0])} : i < 2.0 ? ${vec3(NEON_PALETTE[1])} : i < 3.0 ? ${vec3(NEON_PALETTE[2])} : ${vec3(NEON_PALETTE[3])};
}
vec4 wallAlbedo(int m, vec2 uv, vec2 gx, vec2 gy) {
  vec4 r = vec4(0.5);
  ${pick('uWall')}
  return r;
}
vec4 wallNormal(int m, vec2 uv, vec2 gx, vec2 gy) {
  vec4 r = vec4(0.5, 0.5, 1.0, 1.0);
  ${pick('uWallN')}
  return r;
}
${INTERIOR_GLSL}
float windowMask;
vec3 facadeEmissive;
vec3 facadeTangentNormal;
float facadeRough;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float district = floor(vInfo.x);
  float seed = fract(vInfo.x);
  int style = int(vInfo.y + 0.5);
  float tierTop = vInfo.z;
  bool roof = vInfo.w > 0.5;
  windowMask = 0.0;
  facadeEmissive = vec3(0.0);
  facadeTangentNormal = vec3(0.0, 0.0, 1.0);
  facadeRough = 0.85;

  // Tint normalised around 1, so the photographic albedo keeps its range.
  vec3 tint = diffuseColor.rgb / max(0.001, dot(diffuseColor.rgb, vec3(0.333)));
  int m = district > 2.5 ? 4 : int(mod(float(style) + floor(seed * 3.0), 4.0));
  vec2 wallUv = roof ? vFacadeWorld.xz : vFacadeUv + vec2(seed * 37.0, 0.0);
  vec2 gx = dFdx(wallUv);
  vec2 gy = dFdy(wallUv);
  vec3 albedo;
  if (uFacadeReady > 0.5) {
    albedo = wallAlbedo(m, wallUv, gx, gy).rgb * mix(vec3(1.0), tint, 0.35);
    facadeTangentNormal = wallNormal(m, wallUv, gx, gy).xyz * 2.0 - 1.0;
    if (roof) {
      // Painted concrete roof slab with ponding stains.
      vec2 ruv = vec2(vFacadeWorld.x, -vFacadeWorld.z) / ${metres('rooftop').toFixed(1)};
      albedo = texture2D(uRoofTex, ruv).rgb * (0.75 + 0.5 * facadeNoise(vFacadeWorld.xz * 0.15));
      facadeTangentNormal = texture2D(uRoofN, ruv).xyz * 2.0 - 1.0;
    }
    // Up close, a finer sample of the same material adds grain and relief where the base texture
    // would turn soft (detail layer, faded out with distance).
    float near = 1.0 - smoothstep(12.0, 45.0, distance(vFacadeWorld, cameraPosition));
    if (near > 0.0) {
      vec2 duv = wallUv * 4.3 + 0.31;
      vec3 detail = wallAlbedo(m, duv, gx * 4.3, gy * 4.3).rgb;
      albedo *= mix(1.0, clamp(dot(detail, vec3(0.333)) * 2.2, 0.55, 1.45), near * 0.6);
      vec3 dn = wallNormal(m, duv, gx * 4.3, gy * 4.3).xyz * 2.0 - 1.0;
      facadeTangentNormal = normalize(vec3(facadeTangentNormal.xy + dn.xy * 0.6 * near, facadeTangentNormal.z));
    }
  } else {
    albedo = diffuseColor.rgb * (0.85 + 0.3 * facadeNoise(wallUv * 0.7));
  }

  // Weathering: dirty foot, darker crown, rain streaks running down the walls.
  float streaks = facadeNoise(vec2(vFacadeUv.x * 1.3, vFacadeUv.y * 0.04 + seed * 9.0));
  float dirt = 0.25 * (1.0 - smoothstep(0.0, 6.0, vFacadeUv.y)) + 0.3 * smoothstep(0.55, 0.95, streaks) + 0.12 * smoothstep(tierTop - 4.0, tierTop, vFacadeUv.y);
  albedo *= 1.0 - (roof ? 0.35 : dirt);

  if (roof) {
    albedo *= 0.6;
  } else {
    float colW = style == 0 ? ${STYLE_COLUMN_WIDTH[0].toFixed(1)} : style == 1 ? ${STYLE_COLUMN_WIDTH[1].toFixed(1)} : style == 2 ? ${STYLE_COLUMN_WIDTH[2].toFixed(1)} : style == 3 ? ${STYLE_COLUMN_WIDTH[3].toFixed(1)} : ${STYLE_COLUMN_WIDTH[4].toFixed(1)};
    vec2 cellSize = vec2(colW, ${FLOOR_HEIGHT.toFixed(2)});
    vec2 cellUv = vFacadeUv / cellSize;
    vec2 cell = floor(cellUv);
    vec2 f = fract(cellUv);
    vec2 fw = fwidth(cellUv);
    vec2 lo = style == 1 ? vec2(0.03, 0.28) : style == 2 ? vec2(0.05, 0.1) : style == 3 ? vec2(0.3, 0.32) : vec2(0.16, 0.24);
    vec2 hi = vec2(1.0) - lo;
    vec2 open2 = smoothstep(lo - fw, lo + fw, f) * (1.0 - smoothstep(hi - fw, hi + fw, f));
    float open = open2.x * open2.y;
    // Frame around the opening: a raised metal border with a bevelled normal.
    vec2 frameLo = lo - 0.05;
    vec2 frameHi = hi + 0.05;
    vec2 inFrame2 = step(frameLo, f) * step(f, frameHi);
    float frame = inFrame2.x * inFrame2.y * (1.0 - open);
    float far = clamp(max(fw.x, fw.y) * 2.0 - 0.4, 0.0, 1.0);
    bool street = vFacadeUv.y < 4.5;
    windowMask = street ? 0.0 : mix(open, (hi.x - lo.x) * (hi.y - lo.y), far);

    if (!street) {
      vec2 toCentre = f - 0.5;
      facadeTangentNormal = normalize(mix(facadeTangentNormal, vec3(sign(toCentre) * step(abs(toCentre), vec2(0.5)) * 0.5 * frame, 1.0), frame));
      albedo = mix(albedo, vec3(0.05, 0.055, 0.06), frame * 0.85);
      // Concrete sill under each window, and its drip stain.
      float sill = step(abs(f.y - (frameLo.y - 0.02)), 0.025) * step(frameLo.x, f.x) * step(f.x, frameHi.x);
      albedo = mix(albedo, albedo * 1.25, sill);
      albedo *= 1.0 - 0.25 * smoothstep(0.0, 0.2, frameLo.y - f.y) * step(f.y, frameLo.y) * step(frameLo.x, f.x) * step(f.x, frameHi.x) * step(0.4, streaks);

      // Interior mapping: the room behind this window, seen through the glass.
      vec3 V = normalize(vFacadeWorld - cameraPosition);
      vec3 N = normalize(vWallNormal);
      vec3 T = vec3(N.z, 0.0, -N.x);
      vec3 dir = normalize(vec3(dot(V, T), V.y, -dot(V, N)));
      float roomSeed = facadeHash(cell * vec2(1.0, 7.0) + seed * 311.0);
      vec2 entry = (f - lo) / (hi - lo) * cellSize;
      float lightPanel;
      vec3 roomCol = interiorRoom(entry, dir, vec3(cellSize, 4.0 + roomSeed * 3.0), roomSeed, lightPanel);
      float litRatio = mix(0.03, 0.15, uNight);
      bool lit = roomSeed < litRatio;
      vec3 warm = vec3(1.0, 0.78, 0.55);
      vec3 cool = vec3(0.7, 0.85, 1.0);
      vec3 lamp = fract(roomSeed * 91.0) < 0.6 ? warm : fract(roomSeed * 91.0) < 0.92 ? cool : neonColor(roomSeed);
      // Window dressing: sheer curtains drawn (glowing with the lamp, with folds), blinds pulled
      // down some way, or bare glass onto the room.
      float dressing = fract(roomSeed * 47.0);
      float wx = (f.x - lo.x) / (hi.x - lo.x);
      float wy = (f.y - lo.y) / (hi.y - lo.y);
      float blind = dressing > 0.4 && dressing < 0.65 ? fract(roomSeed * 17.0) * 0.8 : 0.0;
      float slats = step(1.0 - blind, wy) * (0.75 + 0.25 * step(0.5, fract(wy * 40.0)));
      vec3 seen = mix(roomCol, vec3(0.5, 0.47, 0.42) * slats, step(1.0 - blind, wy));
      if (dressing < 0.4) {
        float folds = 0.7 + 0.3 * sin(wx * 38.0 + roomSeed * 20.0) * sin(wx * 11.0);
        float gap = step(abs(wx - 0.5), 0.06 * fract(roomSeed * 5.0));
        seen = mix(vec3(0.55, 0.5, 0.42) * folds, roomCol, gap);
      }
      float fres = pow(1.0 - abs(dot(V, N)), 5.0);
      vec3 inside = lit ? seen * lamp * mix(0.5, 1.0, uNight) + lamp * lightPanel * 1.4 * step(0.4, dressing) : seen * mix(0.18, 0.006, uNight);
      // A television flickering blue in some dark rooms.
      if (!lit && fract(roomSeed * 29.0) < 0.05 * uNight) {
        float flick = 0.5 + 0.5 * sin(uTime * 9.0 + roomSeed * 50.0) * sin(uTime * 3.1 + roomSeed * 9.0);
        inside += vec3(0.06, 0.1, 0.24) * flick * roomCol * 3.0;
      }
      // Far away rooms blur into their average glow (no aliasing).
      vec3 farGlow = lamp * litRatio * mix(0.25, 0.7, uNight);
      facadeEmissive += mix(inside * (1.0 - fres * 0.85) * open, farGlow * windowMask, far);
      albedo = mix(albedo, vec3(0.015, 0.02, 0.025), windowMask);
    } else if (style != 4) {
      // Street level: bays of shops between piers. Each bay is a lit shopfront (kick plate, glazing
      // with mullions over a deep interior-mapped shop, a backlit sign band above), a closed roller
      // shutter, or a glazed entrance lobby.
      float bw = 4.0 + floor(fract(seed * 7.3) * 3.0);
      float bayId = floor(vFacadeUv.x / bw);
      float bx = vFacadeUv.x - bayId * bw;
      float y = vFacadeUv.y;
      float kind = facadeHash(vec2(bayId, seed * 977.0));
      float pier = 0.35;
      vec2 sfw = fwidth(vFacadeUv);
      float inBay = smoothstep(pier - sfw.x, pier + sfw.x, bx);
      float glassTop = 3.0;
      float signLo = 3.15;
      float signHi = 4.05;
      // Piers and the wall above the sign keep the wall material; the shop zone is framed in black.
      float shopZone = inBay * step(y, signHi);
      albedo = mix(albedo, albedo * 0.7, inBay * step(signHi, y) * step(y, signHi + 0.12));
      vec3 lamp = fract(kind * 31.0) < 0.55 ? vec3(1.0, 0.86, 0.66) : fract(kind * 31.0) < 0.85 ? vec3(0.82, 0.92, 1.0) : neonColor(kind);
      if (shopZone > 0.5) {
        albedo = vec3(0.025, 0.026, 0.03);
        facadeRough = 0.4;
        float sx = bx - pier;
        float sw = bw - pier;
        // Sign band: a lightbox with rows of blocky characters, lit at night.
        if (y > signLo) {
          float sy = (y - signLo) / (signHi - signLo);
          // Shop name from the Japanese atlas (a banner cell), or blocky pseudo-glyphs until it loads.
          float glyph;
          vec2 su = vec2((sx - 0.3) / (sw - 0.6), (sy - 0.1) / 0.8);
          float inside = step(0.0, su.x) * step(su.x, 1.0) * step(0.0, su.y) * step(su.y, 1.0);
          if (uShopAtlasReady > 0.5) {
            glyph = inside * smoothstep(0.35, 0.6, atlasText(uShopAtlas, atlasCell(1.0, fract(kind * 71.0 + seed * 13.0)), su).r);
          } else {
            vec2 g = vec2(sx / 0.42, (sy - 0.18) / 0.64);
            glyph = inside * step(0.0, g.y) * step(g.y, 1.0) * step(0.45, facadeHash(floor(vec2(g.x * 3.0, g.y * 3.0)) + kind * 53.0)) * step(0.15, fract(g.x)) * step(fract(g.x), 0.9);
          }
          bool whiteBox = fract(kind * 13.0) < 0.4;
          vec3 boxCol = whiteBox ? vec3(0.95, 0.93, 0.88) : neonColor(kind * 3.0);
          vec3 inkCol = whiteBox ? neonColor(kind * 5.0) * 0.25 : vec3(1.0, 0.97, 0.9);
          float edge = step(sy, 0.06) + step(0.94, sy);
          vec3 sign = mix(boxCol * (whiteBox ? 1.0 : 0.35), inkCol, glyph);
          albedo = mix(sign * 0.6, vec3(0.03), edge);
          facadeEmissive += sign * (1.0 - edge) * mix(0.15, 1.2, uNight);
        } else if (y > glassTop) {
          albedo = vec3(0.06, 0.065, 0.07);
        } else if (kind < 0.6 || kind > 0.82) {
          bool lobby = kind > 0.82;
          float kick = lobby ? 0.05 : 0.38;
          if (y < kick) {
            albedo = vec3(0.04, 0.04, 0.045);
          } else {
            // Glazing: mullions every ~1.5 m and a transom bar; the shop behind in perspective.
            float panes = max(1.0, floor(sw / 1.5));
            float px = fract(sx / sw * panes);
            float mull = 1.0 - step(0.025, px) * step(px, 0.975);
            float transom = step(abs(y - 2.45), 0.035);
            float frame = max(mull, transom);
            vec3 V = normalize(vFacadeWorld - cameraPosition);
            vec3 N = normalize(vWallNormal);
            vec3 T = vec3(N.z, 0.0, -N.x);
            vec3 dir = normalize(vec3(dot(V, T), V.y, -dot(V, N)));
            float lightPanel;
            vec2 entry = vec2(sx, y - kick);
            vec3 room = interiorRoom(entry, dir, vec3(sw, glassTop - kick + 0.4, lobby ? 7.0 : 4.5), kind, lightPanel);
            // Shelves of goods: bright horizontal bands with dotted products.
            float shelves = step(0.7, fract((y - kick) / 0.45)) * (0.6 + 0.4 * step(0.5, fract(sx * 3.1 + kind * 7.0)));
            vec3 goods = mix(room, room * 1.6 + neonColor(kind * 9.0 + floor(sx * 3.1)) * 0.25, shelves * (lobby ? 0.0 : 1.0));
            bool lit = facadeHash(vec2(bayId * 3.0 + 1.0, seed * 131.0)) < mix(0.35, 0.75, uNight);
            float fres = pow(1.0 - abs(dot(V, N)), 4.0);
            vec3 inside = lit ? goods * lamp * mix(0.8, 1.25, uNight) + lamp * lightPanel * 1.8 : goods * 0.03;
            facadeEmissive += inside * (1.0 - fres * 0.8) * (1.0 - frame);
            albedo = mix(vec3(0.01, 0.012, 0.015), vec3(0.05, 0.05, 0.055), frame);
            windowMask = 1.0 - frame;
            // Door: a darker double leaf with a bright push bar, centred in lobbies.
            if (lobby && abs(sx - sw * 0.5) < 0.9 && y < 2.3) {
              float bar = step(abs(y - 1.05), 0.02) * step(0.12, abs(sx - sw * 0.5));
              facadeEmissive += vec3(0.8) * bar * mix(0.2, 1.0, uNight);
            }
          }
        } else {
          // Closed roller shutter: corrugated steel with a bottom rail and some grime.
          float rib = sin((y / 0.075) * 6.2832);
          facadeTangentNormal = normalize(vec3(0.0, rib * 0.35, 1.0));
          float grime = 0.75 + 0.25 * facadeNoise(vec2(sx * 2.0, y * 0.6) + kind * 30.0);
          albedo = vec3(0.32, 0.33, 0.34) * grime * (0.85 + 0.15 * rib);
          albedo = mix(albedo, vec3(0.05), step(y, 0.12));
          facadeRough = 0.55;
          // A small lit plate and the glow of a street lamp across the shutter at night.
          facadeEmissive += lamp * 0.04 * uNight;
        }
      }
    }

    // Neon outline under the roof of some buildings, and glowing skywalks.
    vec3 neon = neonColor(seed);
    float outline = 1.0 - smoothstep(0.5, 0.9, tierTop - vFacadeUv.y);
    float hasOutline = step(fract(seed * 3.1), 0.55);
    facadeEmissive += neon * outline * hasOutline * mix(0.2, 3.0, uNight);
    if (style == 4) facadeEmissive += neon * 0.6 * windowMask * mix(0.2, 1.0, uNight);
  }
  diffuseColor.rgb = albedo;
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.06, windowMask);
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.35, uWetness);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.85, windowMask);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  // Tangent-space detail (texture relief, window frames) brought to view space.
  vec3 Nw = normalize(vWallNormal);
  vec3 Tw = abs(Nw.y) > 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(Nw.z, 0.0, -Nw.x);
  vec3 Bw = abs(Nw.y) > 0.5 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 tn = facadeTangentNormal * vec3(0.8, 0.8, 1.0);
  vec3 world = normalize(Tw * tn.x + Bw * tn.y + Nw * tn.z);
  normal = normalize((viewMatrix * vec4(world, 0.0)).xyz);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += facadeEmissive;`,
      );
  };
  material.customProgramCacheKey = () => 'facade-v6';
  return material;
}
