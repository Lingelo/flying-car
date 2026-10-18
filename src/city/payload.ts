import type { GeometryData } from '../render/geometryData';
import { buildBuildingGeometry } from './buildingMesh';
import { generateChunk, type Chunk } from './generator';
import { buildGroundGeometry, type GroundGeometry } from './roadMesh';
import { buildRailGeometry, railForChunk, type RailSegment } from './rail';
import { buildStreetLifeGeometry, placeStreetLife, streetLifeBoxes } from './streetLife';
import { buildTemple } from './temples';
import { landmarkBoxes } from './reserved';
import type { Box } from './generator';
import { placeGiantHolograms, type GiantHologram } from './holograms';
import { buildHologramGeometry, buildSignGeometry, buildSignHalos, buildSteamParticles, placeSigns, placeSteamVents } from './signage';
import type { ChunkSource } from './streamer';

/** Chunk data plus its prebuilt geometry, as produced by the worker. */
export interface ChunkPayload {
  cx: number;
  cz: number;
  chunk: Chunk;
  buildings: GeometryData;
  buildingsLod: GeometryData;
  ground: GroundGeometry;
  failed?: boolean;
  signs: GeometryData;
  neonSigns: GeometryData;
  /** (x, y, z, size, hue) per sign halo. */
  signHalos: Float32Array;
  giantHolograms: GiantHologram[];
  holograms: GeometryData;
  /** (x, y, z, seed) per steam particle. */
  steam: Float32Array;
  rail: RailSegment;
  railStructure: GeometryData;
  railLights: GeometryData;
  streetProps: GeometryData;
  streetGlow: GeometryData;
  /** Extra collision boxes (poles, vending machines). */
  propBoxes: Box[];
  templeProps: GeometryData;
  templeGlow: GeometryData;
}

export function buildChunkPayload(seed: number, cx: number, cz: number): ChunkPayload {
  const chunk = generateChunk(seed, cx, cz);
  const { x: ox, z: oz } = chunk.origin;
  const { signs, holograms } = placeSigns(chunk, seed);
  const signGeometry = buildSignGeometry(signs, ox, oz);
  const rail = railForChunk(seed, cx, cz);
  const railGeometry = buildRailGeometry(rail, ox, oz);
  const life = placeStreetLife(chunk, seed);
  const lifeGeometry = buildStreetLifeGeometry(life, ox, oz);
  const temple = buildTemple(seed, chunk);
  return {
    cx,
    cz,
    chunk,
    buildings: buildBuildingGeometry(chunk, false),
    buildingsLod: buildBuildingGeometry(chunk, true),
    ground: buildGroundGeometry(chunk),
    signs: signGeometry.solid,
    neonSigns: signGeometry.neon,
    signHalos: buildSignHalos(signs, ox, oz),
    giantHolograms: placeGiantHolograms(chunk, seed),
    holograms: buildHologramGeometry(holograms, ox, oz),
    steam: buildSteamParticles(placeSteamVents(chunk, seed), ox, oz),
    rail,
    railStructure: railGeometry.structure,
    railLights: railGeometry.lights,
    streetProps: lifeGeometry.props,
    streetGlow: lifeGeometry.glow,
    propBoxes: [...streetLifeBoxes(life), ...temple.boxes, ...landmarkBoxes(seed, cx, cz)],
    templeProps: temple.props,
    templeGlow: temple.glow,
  };
}

/** Generates chunks and their geometry off the main thread. */
export class WorkerChunkSource implements ChunkSource<ChunkPayload> {
  private readonly worker = new Worker(new URL('./chunk.worker.ts', import.meta.url), { type: 'module' });
  private arrived: ChunkPayload[] = [];
  private readonly requested = new Set<string>();

  constructor(private readonly seed: number) {
    this.worker.onmessage = (event: MessageEvent<ChunkPayload>) => this.arrived.push(event.data);
    this.worker.onerror = (event) => {
      // The worker itself failed (script not loaded): release every pending chunk as failed.
      console.error('chunk worker error', event.message);
      for (const k of this.requested) {
        const [cx, cz] = k.split(',').map(Number);
        this.arrived.push({ cx, cz, failed: true } as ChunkPayload);
      }
      this.requested.clear();
    };
  }

  request(cx: number, cz: number): void {
    this.requested.add(`${cx},${cz}`);
    this.worker.postMessage({ seed: this.seed, cx, cz });
  }

  drain(): ChunkPayload[] {
    const out = this.arrived;
    this.arrived = [];
    for (const c of out) this.requested.delete(`${c.cx},${c.cz}`);
    return out;
  }

  dispose(): void {
    this.worker.terminate();
  }
}
