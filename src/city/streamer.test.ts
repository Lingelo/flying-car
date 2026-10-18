import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, generateChunk, type Chunk } from './generator';
import { ChunkStreamer, type ChunkSink, type ChunkSource } from './streamer';
import { Pool } from './pool';

/** Source answering every request on the next drain, like a very fast worker. */
class InstantSource implements ChunkSource<Chunk> {
  private queue: Chunk[] = [];
  requests = 0;
  request(cx: number, cz: number) {
    this.requests++;
    this.queue.push(generateChunk(1, cx, cz));
  }
  drain() {
    const out = this.queue;
    this.queue = [];
    return out;
  }
}

interface Handle {
  key: string;
  lod: boolean;
}

class PooledSink implements ChunkSink<Chunk, Handle> {
  pool = new Pool<Handle>(() => ({ key: '', lod: false }));
  mountedThisFrame = 0;
  mount(chunk: Chunk, lod: boolean) {
    this.mountedThisFrame++;
    const h = this.pool.acquire();
    h.key = `${chunk.cx},${chunk.cz}`;
    h.lod = lod;
    return h;
  }
  unmount(h: Handle) {
    this.pool.release(h);
  }
  setLod(h: Handle, lod: boolean) {
    h.lod = lod;
  }
}

const settle = (streamer: ChunkStreamer<Chunk, Handle>, x: number, z: number, frames = 60) => {
  for (let i = 0; i < frames; i++) streamer.update(x, z);
};

describe('ChunkStreamer', () => {
  it('loads every chunk of the ring around the player', () => {
    const sink = new PooledSink();
    const streamer = new ChunkStreamer(new InstantSource(), sink, { radius: 3, lodRadius: 2, maxMountsPerFrame: 2 });
    settle(streamer, 10, 10);
    const keys = [...streamer.active.keys()];
    expect(keys).toContain('0,0');
    expect(keys).toContain('3,0');
    expect(keys).toContain('-3,0');
    expect(keys).not.toContain('4,0');
    // ring of radius 3 (euclidean, in chunk units)
    expect(keys.length).toBe(29);
  });

  it('mounts at most maxMountsPerFrame chunks per frame', () => {
    const sink = new PooledSink();
    const streamer = new ChunkStreamer(new InstantSource(), sink, { radius: 4, lodRadius: 3, maxMountsPerFrame: 2 });
    for (let i = 0; i < 30; i++) {
      sink.mountedThisFrame = 0;
      streamer.update(0, 0);
      expect(sink.mountedThisFrame).toBeLessThanOrEqual(2);
    }
  });

  it('keeps memory bounded while flying straight for 200 chunks (AE5)', () => {
    const sink = new PooledSink();
    const source = new InstantSource();
    const streamer = new ChunkStreamer(source, sink, { radius: 3, lodRadius: 2, maxMountsPerFrame: 2 });
    let maxActive = 0;
    for (let x = 0; x < 200 * CHUNK_SIZE; x += 40) {
      streamer.update(x, 100);
      maxActive = Math.max(maxActive, streamer.active.size);
      // the chunk ahead of the car is never missing for long
    }
    settle(streamer, 200 * CHUNK_SIZE, 100);
    expect(streamer.active.has(`${200 + 1},0`)).toBe(true);
    expect(maxActive).toBeLessThanOrEqual(29 + 2 * 9);
    expect(sink.pool.created).toBeLessThanOrEqual(maxActive);
  });

  it('reuses pooled chunks after a U-turn', () => {
    const sink = new PooledSink();
    const streamer = new ChunkStreamer(new InstantSource(), sink, { radius: 3, lodRadius: 2, maxMountsPerFrame: 2 });
    for (let x = 0; x < 30 * CHUNK_SIZE; x += 64) streamer.update(x, 0);
    const created = sink.pool.created;
    for (let x = 30 * CHUNK_SIZE; x > 0; x -= 64) streamer.update(x, 0);
    expect(sink.pool.created).toBe(created);
  });

  it('switches far chunks to the simplified level of detail', () => {
    const sink = new PooledSink();
    const streamer = new ChunkStreamer(new InstantSource(), sink, { radius: 5, lodRadius: 3, maxMountsPerFrame: 4 });
    settle(streamer, 10, 10);
    expect(streamer.active.get('0,0')!.handle.lod).toBe(false);
    expect(streamer.active.get('5,0')!.handle.lod).toBe(true);
    settle(streamer, 5 * CHUNK_SIZE + 10, 10);
    expect(streamer.active.get('5,0')!.handle.lod).toBe(false);
    expect(streamer.active.get('2,0')!.handle.lod).toBe(false);
  });

  it('requests the chunks ahead of the movement first', () => {
    const requested: string[] = [];
    const source: ChunkSource<Chunk> = {
      request: (cx, cz) => void requested.push(`${cx},${cz}`),
      drain: () => [],
    };
    const streamer = new ChunkStreamer(source, new PooledSink(), { radius: 3, lodRadius: 2, maxMountsPerFrame: 2, maxInFlight: 64 });
    streamer.update(10, 10, 1, 0); // heading +x
    const ahead = requested.indexOf('2,0');
    const behind = requested.indexOf('-2,0');
    expect(ahead).toBeGreaterThanOrEqual(0);
    expect(ahead).toBeLessThan(behind);
  });
});
