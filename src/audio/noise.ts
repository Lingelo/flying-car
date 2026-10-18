const cache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/** Two seconds of looping white or brown noise, shared per audio context. */
export function noiseBuffer(ctx: BaseAudioContext, colour: 'white' | 'brown'): AudioBuffer {
  let byColour = cache.get(ctx);
  if (!byColour) cache.set(ctx, (byColour = new Map()));
  const existing = byColour.get(colour);
  if (existing) return existing;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (colour === 'white') data[i] = white;
    else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  byColour.set(colour, buffer);
  return buffer;
}
