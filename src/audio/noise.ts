export type NoiseColour = 'white' | 'pink' | 'brown';

const cache = new WeakMap<BaseAudioContext, Map<NoiseColour, AudioBuffer>>();

/** Fills `data` with noise: white (flat, hissy), pink (-3 dB/oct, rain/surf) or brown (-6 dB/oct, rumble). */
export function fillNoise(data: Float32Array, colour: NoiseColour, random: () => number = Math.random): void {
  let last = 0;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = random() * 2 - 1;
    if (colour === 'white') data[i] = white;
    else if (colour === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      // Paul Kellet's pink noise filter.
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }
}

/** Two seconds of looping noise of the given colour, shared per audio context. */
export function noiseBuffer(ctx: BaseAudioContext, colour: NoiseColour): AudioBuffer {
  let byColour = cache.get(ctx);
  if (!byColour) cache.set(ctx, (byColour = new Map()));
  const existing = byColour.get(colour);
  if (existing) return existing;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  fillNoise(buffer.getChannelData(0), colour);
  byColour.set(colour, buffer);
  return buffer;
}
