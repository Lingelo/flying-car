import * as THREE from 'three';
import { ADDITIVE_FOG_DEFINES } from '../render/fog';
import { cityUniforms } from '../render/materials/cityUniforms';
import { NEON_PALETTE } from '../render/materials/facade';
import type { GiantHologram } from './holograms';

const MAX = 64;

/**
 * Giant translucent koi swimming in circles between the towers, Blade Runner style. Their whole
 * motion runs on the GPU from (centre, radius, phase, period): one draw call for all of them.
 */
export class HologramView {
  readonly mesh: THREE.InstancedMesh;
  private readonly centre = new Float32Array(MAX * 4);
  private readonly motion = new Float32Array(MAX * 4);

  constructor() {
    const g = new THREE.PlaneGeometry(1, 0.8, 24, 8);
    g.setAttribute('aCentre', new THREE.InstancedBufferAttribute(this.centre, 4));
    g.setAttribute('aMotion', new THREE.InstancedBufferAttribute(this.motion, 4));
    const palette = NEON_PALETTE.map((c) => `vec3(${c.join(',')})`);
    const material = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: cityUniforms.uTime, uNight: cityUniforms.uNight },
      fog: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    defines: ADDITIVE_FOG_DEFINES,
      vertexShader: `#include <common>
#include <fog_pars_vertex>
uniform float uTime;
attribute vec4 aCentre; // x, y, z, radius
attribute vec4 aMotion; // size, hue, phase, period
varying vec2 vUv;
varying float vHue;
void main() {
  float a = aMotion.z + 6.2831853 * uTime / aMotion.w;
  vec3 ring = vec3(cos(a), 0.0, sin(a));
  // Heading along the circle, in the direction of travel.
  vec3 forward = normalize(vec3(-sin(a), 0.0, cos(a))) * sign(aMotion.w);
  float size = aMotion.x;
  // Swimming: the body undulates more towards the tail.
  float tail = 0.5 - position.x;
  vec3 p = aCentre.xyz + ring * aCentre.w
    + forward * position.x * size
    + vec3(0.0, position.y * size + sin(uTime * 0.6 + aMotion.z) * 2.0, 0.0)
    + cross(forward, vec3(0.0, 1.0, 0.0)) * sin(position.x * 7.0 - uTime * 4.0) * tail * size * 0.08;
  vUv = position.xy;
  vHue = aMotion.y;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: `#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uNight;
varying vec2 vUv;
varying float vHue;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 p = vUv; // x in [-0.5, 0.5] head forward, y in [-0.4, 0.4]
  // Koi body: a tapered ellipse; fan tail; pectoral fins.
  float bx = p.x - 0.08;
  float halfH = 0.13 * sqrt(max(0.0, 1.0 - pow(bx / 0.36, 2.0))) * (bx < 0.0 ? 1.0 + bx * 1.2 : 1.0);
  float body = smoothstep(0.012, 0.0, abs(p.y) - halfH) * step(-0.3, bx);
  float tailFan = step(p.x, -0.2) * step(-0.5, p.x) * smoothstep(0.01, 0.0, abs(p.y) - (-0.2 - p.x) * 0.9 - 0.02) * (0.6 + 0.4 * sin(p.y * 60.0));
  float fins = smoothstep(0.01, 0.0, length((p - vec2(0.12, -0.15)) * vec2(1.2, 2.2)) - 0.08) * 0.8;
  float shape = max(max(body, tailFan * 0.8), fins);
  if (shape < 0.01) discard;
  // Holographic look: koi patches, edge glow, scanlines, glitch bands.
  float patches = step(0.5, h(floor(p * vec2(9.0, 6.0))));
  vec3 base = vHue < 0.5 ? ${palette[0]} : vHue < 1.5 ? ${palette[1]} : vHue < 2.5 ? ${palette[2]} : ${palette[3]};
  vec3 col = mix(base, vec3(1.0, 0.95, 0.9), patches * 0.6);
  float edge = smoothstep(0.03, 0.0, abs(abs(p.y) - halfH)) * body;
  float scan = 0.6 + 0.4 * sin(p.y * 220.0 - uTime * 8.0);
  float glitch = step(0.96, h(vec2(floor(uTime * 8.0), floor(p.y * 20.0)))) * 0.6;
  float alpha = (shape * 0.45 * scan + edge * 0.9) * (1.0 - glitch) * mix(0.35, 1.0, uNight);
  gl_FragColor = vec4(col * alpha * 1.4, alpha);
  #include <fog_fragment>
}`,
    });
    this.mesh = new THREE.InstancedMesh(g, material, MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }

  set(holograms: GiantHologram[]): void {
    const n = Math.min(MAX, holograms.length);
    for (let i = 0; i < n; i++) {
      const k = holograms[i];
      this.centre.set([k.x, k.y, k.z, k.radius], i * 4);
      this.motion.set([k.size, k.hue, k.phase, k.period], i * 4);
    }
    this.mesh.count = n;
    for (const name of ['aCentre', 'aMotion']) (this.mesh.geometry.getAttribute(name) as THREE.InstancedBufferAttribute).needsUpdate = true;
  }
}
