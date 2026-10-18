import * as THREE from 'three';
import { ADDITIVE_FOG_DEFINES } from '../render/fog';
import { cityUniforms } from '../render/materials/cityUniforms';
import type { Lane } from './lanes';

/**
 * Distant traffic as moving points of light along the air corridors, beyond the simulated area:
 * the city looks busy to the horizon for the cost of one draw call.
 */
export class TrafficStreaks {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(private readonly perLane = 26) {
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: cityUniforms.uTime, uNight: cityUniforms.uNight, uCentre: { value: new THREE.Vector2() }, uSpan: { value: 2600 }, uInner: { value: 420 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    defines: ADDITIVE_FOG_DEFINES,
      fog: true,
      vertexShader: `#include <common>
#include <fog_pars_vertex>
uniform float uTime;
uniform vec2 uCentre;
uniform float uSpan;
uniform float uInner;
attribute vec4 aLane; // c, y, axis (0 = z, 1 = x), dir
attribute vec2 aMotion; // seed, speed
varying float vDir;
varying float vFade;
void main() {
  float run = fract(aMotion.x + uTime * aMotion.y / uSpan) * uSpan - uSpan * 0.5;
  float centre = aLane.z > 0.5 ? uCentre.x : uCentre.y;
  float s = centre + run * aLane.w;
  vec3 p = aLane.z > 0.5 ? vec3(s, aLane.y, aLane.x) : vec3(aLane.x, aLane.y, s);
  vDir = aLane.w;
  // The simulated traffic takes over near the player.
  vFade = smoothstep(uInner, uInner + 150.0, abs(run));
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(2600.0 / -mvPosition.z, 1.5, 5.0);
  #include <fog_vertex>
}`,
      fragmentShader: `#include <common>
#include <fog_pars_fragment>
uniform float uNight;
varying float vDir;
varying float vFade;
void main() {
  float d = length(gl_PointCoord - 0.5);
  // Head and tail lights barely show in daylight.
  float a = smoothstep(0.5, 0.1, d) * vFade * mix(0.12, 1.0, uNight);
  vec3 col = vDir > 0.0 ? vec3(1.6, 1.5, 1.3) : vec3(1.8, 0.15, 0.2);
  gl_FragColor = vec4(col * a, a);
  #include <fog_fragment>
}`,
    });
    this.points = new THREE.Points(new THREE.BufferGeometry(), this.material);
    this.points.frustumCulled = false;
  }

  setLanes(lanes: Lane[]): void {
    const air = lanes.filter((l) => l.kind === 'air');
    const n = air.length * this.perLane;
    const lane = new Float32Array(n * 4);
    const motion = new Float32Array(n * 2);
    let i = 0;
    for (const l of air) {
      for (let k = 0; k < this.perLane; k++, i++) {
        lane.set([l.c, l.y, l.axis === 'x' ? 1 : 0, l.dir], i * 4);
        const seed = (Math.sin((i + 1) * 12.9898) * 43758.5453) % 1;
        motion.set([Math.abs(seed), l.speedLimit * (0.85 + 0.3 * Math.abs((seed * 7) % 1))], i * 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aLane', new THREE.BufferAttribute(lane, 4));
    g.setAttribute('aMotion', new THREE.BufferAttribute(motion, 2));
    this.points.geometry.dispose();
    this.points.geometry = g;
  }

  update(x: number, z: number): void {
    this.material.uniforms.uCentre.value.set(x, z);
  }
}
