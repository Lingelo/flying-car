import * as THREE from 'three';
import { cityUniforms } from '../render/materials/cityUniforms';

const BOX = 46;
const HEIGHT = 30;

/**
 * Rain streaks animated on the GPU in a box that tiles around the camera, so it rains everywhere
 * for a fixed cost. The number of drops drawn follows the rain intensity.
 */
export class Rain {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(private readonly maxDrops = 12000) {
    const corners = new Float32Array(maxDrops * 4 * 2);
    const seeds = new Float32Array(maxDrops * 4 * 3);
    const index = new Uint32Array(maxDrops * 6);
    for (let i = 0; i < maxDrops; i++) {
      const sx = Math.random() * BOX;
      const sz = Math.random() * BOX;
      const sy = Math.random();
      [[-1, 0], [1, 0], [1, 1], [-1, 1]].forEach(([cx, cy], k) => {
        corners.set([cx, cy], (i * 4 + k) * 2);
        seeds.set([sx, sy, sz], (i * 4 + k) * 3);
      });
      index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxDrops * 4 * 3), 3));
    g.setAttribute('aCorner', new THREE.BufferAttribute(corners, 2));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: cityUniforms.uTime, uNight: cityUniforms.uNight, uCamera: { value: new THREE.Vector3() }, uIntensity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      // Billboards face the camera either way round: never cull them.
      side: THREE.DoubleSide,
      vertexShader: `uniform float uTime;
uniform vec3 uCamera;
attribute vec2 aCorner;
attribute vec3 aSeed;
varying float vAlong;
varying float vNear;
void main() {
  // Tile the drop box around the camera.
  vec2 xz = uCamera.xz + mod(aSeed.xz - uCamera.xz, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
  float y = uCamera.y + fract(aSeed.y - uTime * 0.55) * ${HEIGHT.toFixed(1)} - ${(HEIGHT / 2).toFixed(1)};
  vec3 base = vec3(xz.x, y, xz.y);
  vec3 fall = normalize(vec3(0.12, -1.0, 0.05));
  vec3 toCam = normalize(uCamera - base);
  vec3 side = normalize(cross(fall, toCam)) * 0.011;
  vec3 p = base + side * aCorner.x - fall * aCorner.y * 0.9;
  vAlong = aCorner.y;
  // Drops right against the lens would show as bars: fade them out.
  vNear = smoothstep(1.5, 5.0, distance(base, uCamera));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: `uniform float uNight;
varying float vAlong;
varying float vNear;
void main() {
  float a = 0.35 * smoothstep(0.0, 0.4, vAlong) * (1.0 - vAlong * 0.3) * vNear;
  vec3 col = mix(vec3(0.75, 0.78, 0.85), vec3(0.55, 0.5, 0.8), uNight);
  gl_FragColor = vec4(col, a);
}`,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    g.setDrawRange(0, 0);
  }

  update(camera: THREE.Camera, intensity: number, quality = 1): void {
    this.material.uniforms.uCamera.value.copy(camera.position);
    const drops = Math.floor(this.maxDrops * Math.min(1, intensity) * quality);
    this.mesh.geometry.setDrawRange(0, drops * 6);
    this.mesh.visible = drops > 0;
  }
}
