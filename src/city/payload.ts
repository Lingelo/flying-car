import type { GeometryData } from '../render/geometryData';
import { buildBuildingGeometry } from './buildingMesh';
import { generateChunk, type Chunk } from './generator';
import { buildGroundGeometry, type GroundGeometry } from './roadMesh';
import { buildHologramGeometry, buildSignGeometry, buildSteamParticles, placeSigns, placeSteamVents } from './signage';
import type { ChunkSource } from './streamer';

/** Chunk data plus its prebuilt geometry, as produced by the worker. */
export interface ChunkPayload {
  cx: number;
  cz: number;
  chunk: Chunk;
  buildings: GeometryData;
  buildingsLod: GeometryData;
  ground: GroundGeometry;
  signs: GeometryData;
  holograms: GeometryData;
  /** (x, y, z, seed) per steam particle. */
  steam: Float32Array;
}

export function buildChunkPayload(seed: number, cx: number, cz: number): ChunkPayload {
  const chunk = generateChunk(seed, cx, cz);
  const { x: ox, z: oz } = chunk.origin;
  const { signs, holograms } = placeSigns(chunk, seed);
  return {
    cx,
    cz,
    chunk,
    buildings: buildBuildingGeometry(chunk, false),
    buildingsLod: buildBuildingGeometry(chunk, true),
    ground: buildGroundGeometry(chunk),
    signs: buildSignGeometry(signs, ox, oz),
    holograms: buildHologramGeometry(holograms, ox, oz),
    steam: buildSteamParticles(placeSteamVents(chunk, seed), ox, oz),
  };
}

/** Generates chunks and their geometry off the main thread. */
export class WorkerChunkSource implements ChunkSource<ChunkPayload> {
  private readonly worker = new Worker(new URL('./chunk.worker.ts', import.meta.url), { type: 'module' });
  private arrived: ChunkPayload[] = [];

  constructor(private readonly seed: number) {
    this.worker.onmessage = (event: MessageEvent<ChunkPayload>) => this.arrived.push(event.data);
  }

  request(cx: number, cz: number): void {
    this.worker.postMessage({ seed: this.seed, cx, cz });
  }

  drain(): ChunkPayload[] {
    const out = this.arrived;
    this.arrived = [];
    return out;
  }

  dispose(): void {
    this.worker.terminate();
  }
}
