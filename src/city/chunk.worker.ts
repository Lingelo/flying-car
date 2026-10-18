import { transferables } from '../render/geometryData';
import { buildChunkPayload } from './payload';

interface Request {
  seed: number;
  cx: number;
  cz: number;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { seed, cx, cz } = event.data;
  const payload = buildChunkPayload(seed, cx, cz);
  const buffers = [payload.buildings, payload.buildingsLod, payload.ground.roads, payload.ground.ground, payload.ground.water, payload.signs, payload.holograms].flatMap(transferables);
  buffers.push(payload.steam.buffer as ArrayBuffer);
  (self as unknown as Worker).postMessage(payload, buffers);
};
