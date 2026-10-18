import * as THREE from 'three';
import { cityUniforms } from '../render/materials/cityUniforms';
import { landmarksNear, TOWER_DECKS, TOWER_HEIGHT, type Landmark } from './reserved';
import { surfaceUniforms } from '../render/materials/surface';

/** Visual profile of the tower: (height, width) pairs, Tokyo Tower style. */
const PROFILE: [number, number][] = [[0, 44], [60, 24], [140, 14], [230, 7], [290, 3], [TOWER_HEIGHT, 0.6]];
const VIEW_RADIUS = 4500;

function towerGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const width: number[] = [];
  const index: number[] = [];
  for (let s = 0; s < PROFILE.length - 1; s++) {
    const [y0, w0] = PROFILE[s];
    const [y1, w1] = PROFILE[s + 1];
    // Four faces of the frustum section.
    for (let f = 0; f < 4; f++) {
      const corner = (w: number, k: number): [number, number] => {
        const h = w / 2;
        const c: [number, number][] = [[-h, -h], [h, -h], [h, h], [-h, h]];
        return c[(f + k) % 4];
      };
      const base = pos.length / 3;
      const [ax, az] = corner(w0, 0);
      const [bx, bz] = corner(w0, 1);
      const [cx, cz] = corner(w1, 1);
      const [dx, dz] = corner(w1, 0);
      pos.push(ax, y0, az, bx, y0, bz, cx, y1, cz, dx, y1, dz);
      uv.push(0, y0, 1, y0, 1, y1, 0, y1);
      width.push(w0, w0, w1, w1);
      index.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aWidth', new THREE.Float32BufferAttribute(width, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function latticeMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.4, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cityUniforms, surfaceUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aUv;
attribute float aWidth;
varying vec2 vTower;
varying float vWidth;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vTower = aUv;
vWidth = aWidth;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uNight;
uniform float uSurfaceReady;
uniform sampler2D uSurf0;
uniform sampler2D uSurfN0;
varying vec2 vTower;
varying float vWidth;
float strut(float d, float w) { return 1.0 - smoothstep(w, w + fwidth(d) * 1.5, d); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float x = vTower.x * vWidth;
float y = vTower.y;
float edge = strut(min(x, vWidth - x), 0.7);
// Distance (m) to the nearest horizontal ring and to the nearest strut of each diagonal set.
float ring = strut((0.5 - abs(fract(y / 10.0) - 0.5)) * 10.0, 0.35);
float d1 = strut((0.5 - abs(fract((x + y * 0.9) / 10.0) - 0.5)) * 10.0 * 0.74, 0.3);
float d2 = strut((0.5 - abs(fract((x - y * 0.9) / 10.0) - 0.5)) * 10.0 * 0.74, 0.3);
float lattice = max(max(edge, ring), max(d1, d2));
// Arches between the four legs.
float arch = 14.0 * sqrt(max(0.0, 1.0 - pow(y / 42.0, 2.0)));
if (abs(x - vWidth * 0.5) < arch && y < 42.0) lattice = 0.0;
if (vWidth < 2.0) lattice = 1.0;
if (lattice < 0.5) discard;
// International orange and white bands.
float band = mod(floor(y / ${(TOWER_HEIGHT / 9).toFixed(1)}), 2.0);
diffuseColor.rgb = band < 0.5 ? vec3(0.95, 0.28, 0.04) : vec3(0.9, 0.88, 0.85);
// Weathered paint: each 2.5 m strut segment a shade apart, rust streaks running down the legs.
float seg = fract(sin(dot(floor(vec2(x / 2.5, y / 2.5)), vec2(12.9898, 78.233))) * 43758.5453);
float streak = fract(sin(floor(x / 0.8) * 91.7) * 4375.85);
diffuseColor.rgb *= (0.78 + 0.22 * seg) * mix(1.0, 0.72, step(0.8, streak) * (1.0 - fract(y / 10.0)));
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55, ring * 0.5);
// Painted steel photo texture (rust, chips) over the bands.
if (uSurfaceReady > 0.5) {
  vec3 steel = texture2D(uSurf0, vec2(x, y) / 2.0).rgb;
  diffuseColor.rgb *= clamp(steel / max(0.05, dot(steel, vec3(0.333))), 0.0, 2.0) * mix(0.7, 1.1, dot(steel, vec3(0.333)));
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// Floodlit at night like the real "Landmark Light": projectors on each level throw a warm pool
// upwards that fades along the structure, the corner legs catching most of it.
float pool = pow(1.0 - fract(y / 40.0), 3.0);
totalEmissiveRadiance += diffuseColor.rgb * vec3(1.2, 0.6, 0.25) * uNight * (0.05 + 0.75 * pool) * (0.45 + 0.55 * edge);`)
      // Landmarks stay readable through the haze (AE5): only part of the fog applies.
      .replace('#include <fog_fragment>', `vec3 beforeFog = gl_FragColor.rgb;
#include <fog_fragment>
gl_FragColor.rgb = mix(beforeFog, gl_FragColor.rgb, 0.55);`);
  };
  m.customProgramCacheKey = () => 'tower-v4';
  return m;
}

/**
 * Observatory glazing for the deck boxes (box UVs: u around each face, v up): a lit band of tall
 * panes with dark mullions, solid cladding above and below.
 */
function deckWindows(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const band = y > size * 0.28 && y < size * 0.72;
      const mullion = x % 8 < 1;
      const v = band && !mullion ? 255 : 0;
      data.set([v, v, v, 255], (y * size + x) * 4);
    }
  const t = new THREE.DataTexture(data, size, size);
  t.needsUpdate = true;
  return t;
}

/** Landmark towers within 4.5 km, independent of chunk streaming so the skyline shows from afar. */
export class LandmarkView {
  readonly group = new THREE.Group();
  private readonly geometry = towerGeometry();
  private readonly material = latticeMaterial();
  private readonly deckMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a30, emissive: 0xffd9a0, emissiveIntensity: 0, emissiveMap: deckWindows(), roughness: 0.4, metalness: 0.5 });
  private readonly beacon = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false });
  private readonly towers = new Map<string, THREE.Group>();
  private lastUpdate = -Infinity;

  constructor(private readonly seed: number) {}

  private build(l: Landmark): THREE.Group {
    const g = new THREE.Group();
    g.position.set(l.x, 0, l.z);
    const lattice = new THREE.Mesh(this.geometry, this.material);
    lattice.castShadow = true;
    g.add(lattice);
    for (const [y, w, h] of TOWER_DECKS) {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), this.deckMaterial);
      deck.position.y = y;
      g.add(deck);
    }
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), this.beacon);
    light.position.y = TOWER_HEIGHT + 0.5;
    light.name = 'beacon';
    g.add(light);
    return g;
  }

  update(x: number, z: number, time: number, night: number): void {
    this.deckMaterial.emissiveIntensity = 0.4 + 2.2 * night;
    // Aviation light blinks once per second.
    this.beacon.color.setRGB(time % 1 < 0.5 ? 3 : 0.2, 0.1, 0.1);
    if (time - this.lastUpdate < 1) return;
    this.lastUpdate = time;
    const wanted = new Set<string>();
    for (const l of landmarksNear(this.seed, x, z, VIEW_RADIUS)) {
      const key = `${l.cx},${l.cz}`;
      wanted.add(key);
      if (!this.towers.has(key)) {
        const t = this.build(l);
        this.towers.set(key, t);
        this.group.add(t);
      }
    }
    for (const [key, t] of this.towers) {
      if (wanted.has(key)) continue;
      this.group.remove(t);
      t.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry !== this.geometry) (o as THREE.Mesh).geometry.dispose();
      });
      this.towers.delete(key);
    }
  }
}
