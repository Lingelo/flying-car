import { transferables } from '../render/geometryData';
import { buildChunkPayload } from './payload';

interface Request {
  seed: number;
  cx: number;
  cz: number;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { seed, cx, cz } = event.data;
  let payload;
  try {
    payload = buildChunkPayload(seed, cx, cz);
  } catch (error) {
    console.error(`chunk ${cx},${cz} failed`, error);
    self.postMessage({ cx, cz, failed: true });
    return;
  }
  const buffers = [payload.buildings, payload.buildingsLod, payload.ground.roads, payload.ground.ground, payload.ground.water, payload.signs, payload.holograms, payload.railStructure, payload.railLights, payload.streetProps, payload.streetGlow, payload.templeProps, payload.templeGlow].flatMap(transferables);
  buffers.push(payload.steam.buffer as ArrayBuffer);
  (self as unknown as Worker).postMessage(payload, buffers);
};
