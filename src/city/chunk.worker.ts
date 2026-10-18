import { generateChunk } from './generator';

interface Request {
  seed: number;
  cx: number;
  cz: number;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { seed, cx, cz } = event.data;
  self.postMessage(generateChunk(seed, cx, cz));
};
