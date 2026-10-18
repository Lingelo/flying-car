import * as THREE from 'three';
import type { GeometryData } from '../render/geometryData';
import { createFacadeMaterial } from '../render/materials/facade';
import { createHaloMaterial, createHologramMaterial, createNeonMaterial, createSignMaterial, createSteamMaterial } from '../render/materials/hologram';
import { createGroundMaterial, createRoadMaterial, createWaterMaterial } from '../render/materials/road';
import { createSurfaceMaterial } from '../render/materials/surface';
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
  neonSigns: THREE.Mesh;
  halos: THREE.Points;
  holograms: THREE.Mesh;
  steam: THREE.Points;
  railStructure: THREE.Mesh;
  railLights: THREE.Mesh;
  streetProps: THREE.Mesh;
  streetGlow: THREE.Mesh;
  templeProps: THREE.Mesh;
  templeGlow: THREE.Mesh;
  full?: THREE.BufferGeometry;
  lod?: THREE.BufferGeometry;
}

const EMPTY = new THREE.BufferGeometry();

/**
 * Many chunk layers are empty (no rail, no temple…): those meshes are hidden instead of getting an
 * empty geometry, so they cost nothing in the main, reflection and shadow passes.
 */
function assign(mesh: THREE.Mesh, data: GeometryData): void {
  const empty = data.index.length === 0;
  mesh.geometry = empty ? EMPTY : toBufferGeometry(data);
  mesh.visible = !empty;
}

/** Mounts streamed chunks into the scene, reusing pooled meshes. */
export class CityView implements ChunkSink<ChunkPayload, ChunkHandle> {
  readonly root = new THREE.Group();
  readonly materials = {
    facade: createFacadeMaterial(),
    road: createRoadMaterial(),
    ground: createGroundMaterial(),
    water: createWaterMaterial(),
    sign: createSignMaterial(),
    neon: createNeonMaterial(),
    halo: createHaloMaterial(),
    hologram: createHologramMaterial(),
    steam: createSteamMaterial(),
    rail: createSurfaceMaterial({ roughness: 0.85, metalness: 0.05 }),
    railLights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    props: createSurfaceMaterial({ roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide }),
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
      neonSigns: mesh(this.materials.neon, false),
      halos: (() => {
        const p = new THREE.Points(EMPTY, this.materials.halo);
        p.matrixAutoUpdate = false;
        p.frustumCulled = false;
        p.renderOrder = 5;
        group.add(p);
        return p;
      })(),
      holograms: mesh(this.materials.hologram, false),
      railStructure: mesh(this.materials.rail, true),
      railLights: mesh(this.materials.railLights, false),
      streetProps: mesh(this.materials.props, false),
      streetGlow: mesh(this.materials.railLights, false),
      templeProps: mesh(this.materials.props, true),
      templeGlow: mesh(this.materials.railLights, false),
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
    assign(h.water, payload.ground.water);
    assign(h.signs, payload.signs);
    assign(h.neonSigns, payload.neonSigns);
    h.neonSigns.renderOrder = 3;
    const halos = new THREE.BufferGeometry();
    const haloData = new THREE.InterleavedBuffer(payload.signHalos, 5);
    halos.setAttribute('position', new THREE.InterleavedBufferAttribute(haloData, 3, 0));
    halos.setAttribute('aHalo', new THREE.InterleavedBufferAttribute(haloData, 2, 3));
    h.halos.geometry = halos;
    assign(h.holograms, payload.holograms);
    assign(h.railStructure, payload.railStructure);
    assign(h.railLights, payload.railLights);
    assign(h.streetProps, payload.streetProps);
    assign(h.streetGlow, payload.streetGlow);
    assign(h.templeProps, payload.templeProps);
    assign(h.templeGlow, payload.templeGlow);
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
    for (const m of [h.roads, h.ground, h.water, h.signs, h.neonSigns, h.halos, h.holograms, h.steam, h.railStructure, h.railLights, h.streetProps, h.streetGlow, h.templeProps, h.templeGlow]) {
      if (m.geometry !== EMPTY) m.geometry.dispose();
      m.geometry = EMPTY;
      m.visible = true;
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
