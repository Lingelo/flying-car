import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CHUNK_SIZE } from './generator';
import { hasRailLine, trainCars } from './rail';

const colored = (g: THREE.BufferGeometry, c: [number, number, number]) => {
  const n = g.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g.index ? g.toNonIndexed() : g;
};

/** Instanced metro cars running on the elevated lines of the loaded area. */
export class TrainView {
  readonly mesh: THREE.InstancedMesh;
  readonly windows: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();

  constructor(private readonly seed: number, capacity = 240) {
    const body = new THREE.BoxGeometry(20, 3.3, 2.9);
    body.translate(0, 1.75, 0);
    const roof = new THREE.BoxGeometry(19.6, 0.3, 2.4);
    roof.translate(0, 3.55, 0);
    this.mesh = new THREE.InstancedMesh(
      mergeGeometries([colored(body, [0.78, 0.8, 0.84]), colored(roof, [0.35, 0.36, 0.4])]),
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.3 }),
      capacity,
    );
    // Lit window band and a green line stripe, like the Yamanote line.
    const band = new THREE.BoxGeometry(19.2, 1.0, 2.95);
    band.translate(0, 2.3, 0);
    const stripe = new THREE.BoxGeometry(19.8, 0.25, 2.96);
    stripe.translate(0, 1.3, 0);
    this.windows = new THREE.InstancedMesh(
      mergeGeometries([colored(band, [2.2, 2.0, 1.6]), colored(stripe, [0.3, 1.6, 0.5])]),
      new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      capacity,
    );
    for (const m of [this.mesh, this.windows]) {
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    this.mesh.castShadow = true;
  }

  /** Places the cars of every line crossing the loaded chunks at time t. */
  update(loaded: Iterable<{ cx: number; cz: number }>, t: number): void {
    const rows = new Map<number, { min: number; max: number }>();
    for (const { cx, cz } of loaded) {
      if (!hasRailLine(this.seed, cz)) continue;
      const r = rows.get(cz) ?? { min: Infinity, max: -Infinity };
      r.min = Math.min(r.min, cx * CHUNK_SIZE);
      r.max = Math.max(r.max, (cx + 1) * CHUNK_SIZE);
      rows.set(cz, r);
    }
    let n = 0;
    const capacity = this.mesh.instanceMatrix.count;
    for (const [cz, r] of rows) {
      for (const car of trainCars(this.seed, cz, t, r.min, r.max)) {
        if (n >= capacity) break;
        this.matrix.makeTranslation(car.x, car.y, car.z);
        this.mesh.setMatrixAt(n, this.matrix);
        this.windows.setMatrixAt(n, this.matrix);
        n++;
      }
    }
    this.mesh.count = this.windows.count = n;
    this.mesh.instanceMatrix.needsUpdate = this.windows.instanceMatrix.needsUpdate = true;
  }
}
