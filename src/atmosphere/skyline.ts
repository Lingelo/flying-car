import * as THREE from 'three';
import { FOG_HEIGHT } from '../render/fog';

/** Unit ring scaled to the edge of the streamed city each frame. */
const RADIUS = 1;
const HEIGHT = 900;

/**
 * Distant city beyond the streamed chunks: two rings of tower silhouettes around the player, with
 * scattered lit windows and red aviation lights, sunk in the smog. Keeps the horizon from ending
 * in a flat wall of fog.
 */
export class Skyline {
  readonly mesh: THREE.Mesh;
  readonly uniforms = {
    uHaze: { value: new THREE.Color() },
    uNight: { value: 1 },
    uTime: { value: 0 },
    uFog: { value: 0.5 },
    uCircumference: { value: 2 * Math.PI * 1400 },
    /** Share of the skyline that shows through the fog at its distance (0 = lost in it). */
    uVisibility: { value: 1 },
  };

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, 128, 1, true);
    geometry.translate(0, HEIGHT / 2 - 40, 0);
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      vertexShader: `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: `
uniform vec3 uHaze;
uniform float uNight;
uniform float uTime;
uniform float uFog;
uniform float uCircumference;
uniform float uVisibility;
varying vec2 vUv;
float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
// One ring of towers: returns (coverage, window light) at a horizontal position x (metres along
// the ring) and height y (metres).
vec2 towers(float x, float y, float width, float tallest, float seed) {
  float cell = floor(x / width);
  float f = fract(x / width);
  float r = h11(cell + seed);
  float h = tallest * (0.15 + 0.85 * r * r) * (h11(cell * 0.37 + seed) < 0.12 ? 1.6 : 1.0);
  float inset = 0.08 + 0.2 * h11(cell + seed * 3.0);
  float body = step(inset, f) * step(f, 1.0 - inset) * step(y, h);
  // A setback crown on some towers, and a spire on the tallest.
  body = max(body, step(0.35, f) * step(f, 0.65) * step(y, h + 25.0) * step(0.7, r));
  body = max(body, step(abs(f - 0.5), 0.015) * step(y, h + 70.0) * step(0.9, r));
  vec2 win = vec2(floor(x / 3.2), floor(y / 4.0));
  float lit = step(0.93, h21(win + seed)) * step(0.25, fract(x / 3.2)) * step(0.3, fract(y / 4.0));
  float beacon = step(abs(y - h - 2.0), 3.0) * step(abs(f - 0.5), 0.02) * step(0.6, r) * step(0.5, fract(uTime * 0.5 + r));
  return vec2(body, lit * body + beacon * 4.0);
}
void main() {
  float x = vUv.x * uCircumference;
  float y = vUv.y * ${HEIGHT.toFixed(1)} - 40.0;
  vec2 back = towers(x * 1.6 + 911.0, y, 70.0, 420.0, 3.1);
  vec2 front = towers(x, y, 55.0, 300.0, 7.7);
  // Silhouettes a little darker than the smog, the far ring paler; the glow of the city rises
  // from the ground into the haze.
  vec3 smog = uHaze * (1.0 + 0.6 * exp(-max(y, 0.0) / 120.0));
  vec3 col = smog;
  // The far ring shows through less fog than the near one does not: both fade with uVisibility.
  col = mix(col, smog * 0.72, back.x * 0.6 * uVisibility * uVisibility);
  col = mix(col, smog * 0.5, front.x * 0.85 * uVisibility);
  vec3 warm = vec3(1.0, 0.75, 0.5);
  col += warm * (back.y * 0.25 * uVisibility + front.y * 0.45) * uNight * uVisibility;
  col += vec3(1.0, 0.1, 0.08) * step(3.5, front.y + back.y) * uNight * 0.6 * sqrt(uVisibility);
  float alpha = max(max(back.x, front.x), smoothstep(200.0, 0.0, y));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -0.5;
    scene.add(this.mesh);
  }

  /**
   * Centres the ring on the camera at `radius` (just beyond the streamed chunks) and matches it to
   * the fog colour and density.
   */
  update(camera: THREE.Camera, fog: THREE.FogExp2, night: number, time: number, radius: number): void {
    this.mesh.position.set(camera.position.x, 0, camera.position.z);
    this.mesh.scale.set(radius, 1, radius);
    this.uniforms.uCircumference.value = 2 * Math.PI * radius;
    this.uniforms.uHaze.value.copy(fog.color);
    this.uniforms.uNight.value = night;
    this.uniforms.uTime.value = time;
    this.uniforms.uFog.value = Math.min(1, fog.density / 0.008);
    // Same fog as the city (render/fog.ts) at the ring's distance, seen from the camera height:
    // the skyline must never be clearer than the streets in front of it.
    const layer = Math.exp(-Math.max(camera.position.y, 0) / FOG_HEIGHT);
    const optical = fog.density * radius * (0.12 + 0.88 * (0.5 + 0.5 * layer)) + (fog.density * radius * 0.2) ** 2;
    this.uniforms.uVisibility.value = Math.exp(-optical);
  }
}
