import * as THREE from 'three';
import { Rng } from '../core/random';
import type { Bolt } from './lightning';

const CLOUD_BASE = 700;
const MAX_POINTS = 160;

/**
 * The bolt of a strike: a jagged trunk from the cloud base to the ground with a few forks, drawn as
 * additive ribbons facing the player and faded with the flash.
 */
export class LightningView {
  readonly mesh: THREE.Mesh;
  private readonly material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.75, 0.82, 1).multiplyScalar(6),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  private readonly positions = new Float32Array(MAX_POINTS * 6 * 3);
  private shown: number | null = null;

  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    g.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  update(bolt: Bolt | null, flash: number, focus: THREE.Vector3): void {
    this.mesh.visible = bolt !== null && flash > 0.02;
    if (!bolt || !this.mesh.visible) return;
    this.material.opacity = Math.min(1, flash * 1.4);
    if (this.shown === bolt.seed) return;
    this.shown = bolt.seed;
    const base = new THREE.Vector3(focus.x + Math.sin(bolt.azimuth) * bolt.distance, 0, focus.z + Math.cos(bolt.azimuth) * bolt.distance);
    // Ribbons face the player: their width runs across the line of sight.
    const across = new THREE.Vector3(Math.cos(bolt.azimuth), 0, -Math.sin(bolt.azimuth));
    const rng = new Rng(bolt.seed);
    let n = 0;
    const segment = (a: THREE.Vector3, b: THREE.Vector3, width: number) => {
      if (n >= MAX_POINTS) return;
      const wa = across.clone().multiplyScalar(width);
      const quad = [a.clone().sub(wa), b.clone().sub(wa), b.clone().add(wa), a.clone().sub(wa), b.clone().add(wa), a.clone().add(wa)];
      quad.forEach((p, k) => p.toArray(this.positions, (n * 6 + k) * 3));
      n++;
    };
    const branch = (from: THREE.Vector3, steps: number, width: number, drift: number) => {
      let p = from.clone();
      for (let i = 0; i < steps && p.y > 0; i++) {
        const next = p.clone().add(new THREE.Vector3(rng.range(-1, 1) * 28 + drift, -rng.range(18, 34), rng.range(-1, 1) * 28));
        next.y = Math.max(0, next.y);
        segment(p, next, width);
        if (width > 1.2 && rng.chance(0.1)) branch(next, rng.int(4, 10), width * 0.5, rng.range(-12, 12));
        p = next;
      }
    };
    branch(new THREE.Vector3(base.x, CLOUD_BASE, base.z), 60, 2.6, 0);
    const attr = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, n * 6);
  }
}
