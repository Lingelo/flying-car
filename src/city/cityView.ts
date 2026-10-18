import * as THREE from 'three';
import type { GeometryData } from '../render/geometryData';
import { createFacadeMaterial } from '../render/materials/facade';
import { createHologramMaterial, createSignMaterial, createSteamMaterial } from '../render/materials/hologram';
import { createGroundMaterial, createRoadMaterial, createWaterMaterial } from '../render/materials/road';
import type { ChunkPayload } from './payload';
import { Pool } from './pool';
import type { ChunkSink } from './streamer';

export function toBufferGeometry(data: GeometryData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
  g.setAttribute('aUv', new THREE.BufferAttribute(data.uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(data.color, 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(data.info, 4));
  g.setIndex(new THREE.BufferAttribute(data.index, 1));
  g.computeBoundingSphere();
  return g;
}

export interface ChunkHandle {
  group: THREE.Group;
  buildings: THREE.Mesh;
  roads: THREE.Mesh;
  ground: THREE.Mesh;
  water: THREE.Mesh;
  signs: THREE.Mesh;
  holograms: THREE.Mesh;
  steam: THREE.Points;
  full?: THREE.BufferGeometry;
  lod?: THREE.BufferGeometry;
}

const EMPTY = new THREE.BufferGeometry();

/** Mounts streamed chunks into the scene, reusing pooled meshes. */
export class CityView implements ChunkSink<ChunkPayload, ChunkHandle> {
  readonly root = new THREE.Group();
  readonly materials = {
    facade: createFacadeMaterial(),
    road: createRoadMaterial(),
    ground: createGroundMaterial(),
    water: createWaterMaterial(),
    sign: createSignMaterial(),
    hologram: createHologramMaterial(),
    steam: createSteamMaterial(),
  };
  private readonly pool = new Pool<ChunkHandle>(() => {
    const group = new THREE.Group();
    const mesh = (material: THREE.Material, shadows: boolean) => {
      const m = new THREE.Mesh(EMPTY, material);
      m.castShadow = shadows;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      group.add(m);
      return m;
    };
    return {
      group,
      buildings: mesh(this.materials.facade, true),
      roads: mesh(this.materials.road, false),
      ground: mesh(this.materials.ground, false),
      water: mesh(this.materials.water, false),
      signs: mesh(this.materials.sign, false),
      holograms: mesh(this.materials.hologram, false),
      steam: (() => {
        const p = new THREE.Points(EMPTY, this.materials.steam);
        p.matrixAutoUpdate = false;
        p.frustumCulled = false;
        group.add(p);
        return p;
      })(),
    };
  });

  constructor() {
    this.root.name = 'city';
  }

  /** Chunk mesh sets ever allocated: flat once the pool is warm (memory stays bounded). */
  get pooled(): number {
    return this.pool.created;
  }

  mount(payload: ChunkPayload, lod: boolean): ChunkHandle {
    const h = this.pool.acquire();
    h.full = toBufferGeometry(payload.buildings);
    h.lod = toBufferGeometry(payload.buildingsLod);
    h.buildings.geometry = lod ? h.lod : h.full;
    h.roads.geometry = toBufferGeometry(payload.ground.roads);
    h.ground.geometry = toBufferGeometry(payload.ground.ground);
    h.water.geometry = toBufferGeometry(payload.ground.water);
    h.signs.geometry = toBufferGeometry(payload.signs);
    h.holograms.geometry = toBufferGeometry(payload.holograms);
    h.holograms.renderOrder = 2;
    const steam = new THREE.BufferGeometry();
    const interleaved = new THREE.InterleavedBuffer(payload.steam, 4);
    steam.setAttribute('position', new THREE.InterleavedBufferAttribute(interleaved, 3, 0));
    steam.setAttribute('aSeed', new THREE.InterleavedBufferAttribute(interleaved, 1, 3));
    h.steam.geometry = steam;
    h.group.position.set(payload.chunk.origin.x, 0, payload.chunk.origin.z);
    h.group.updateMatrixWorld(true);
    this.root.add(h.group);
    return h;
  }

  unmount(h: ChunkHandle): void {
    this.root.remove(h.group);
    h.full?.dispose();
    h.lod?.dispose();
    for (const m of [h.roads, h.ground, h.water, h.signs, h.holograms, h.steam]) {
      m.geometry.dispose();
      m.geometry = EMPTY;
    }
    h.buildings.geometry = EMPTY;
    h.full = h.lod = undefined;
    this.pool.release(h);
  }

  setLod(h: ChunkHandle, lod: boolean): void {
    h.buildings.geometry = (lod ? h.lod : h.full) ?? EMPTY;
    h.buildings.castShadow = !lod;
  }
}
