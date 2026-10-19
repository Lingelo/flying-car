import { describe, expect, it } from 'vitest';
import { Radio, type Track, type TrackPlayer } from './radio';
import { BPM_RANGE, fillImpulse, generatePattern, STEPS_PER_BAR } from './darkwave';
import { Rng } from '../core/random';

class FakePlayer implements TrackPlayer {
  log: string[] = [];
  position = 0;
  play(track: Track) {
    this.log.push(`play ${track.title}`);
    this.position = 0;
  }
  pause() {
    this.log.push('pause');
  }
  resume() {
    this.log.push(`resume@${this.position}`);
  }
  stop() {
    this.log.push('stop');
  }
}

const tracks: Track[] = [
  { title: 'A', artist: 'x', license: 'CC0', kind: 'generated', seed: 1 },
  { title: 'B', artist: 'x', license: 'CC0', kind: 'generated', seed: 2 },
  { title: 'C', artist: 'x', license: 'CC0', kind: 'generated', seed: 3 },
];

describe('Radio', () => {
  it('wraps to the first track after the last', () => {
    const player = new FakePlayer();
    const radio = new Radio(tracks, player);
    radio.toggle();
    radio.next();
    radio.next();
    expect(radio.current?.title).toBe('C');
    radio.next();
    expect(radio.current?.title).toBe('A');
  });

  it('reports "no track" without failing when the playlist is empty', () => {
    const radio = new Radio([], new FakePlayer());
    expect(() => {
      radio.toggle();
      radio.next();
    }).not.toThrow();
    expect(radio.status).toBe('empty');
    expect(radio.current).toBeNull();
  });

  it('keeps the position when switched off and on', () => {
    const player = new FakePlayer();
    const radio = new Radio(tracks, player);
    radio.toggle();
    player.position = 42;
    radio.toggle();
    expect(radio.status).toBe('off');
    radio.toggle();
    expect(player.log).toEqual(['play A', 'pause', 'resume@42']);
  });

  it('plays the next track when switching tracks while off, on the next power-on', () => {
    const player = new FakePlayer();
    const radio = new Radio(tracks, player);
    radio.next();
    expect(player.log).toEqual([]);
    radio.toggle();
    expect(player.log).toEqual(['play B']);
  });
});

describe('generatePattern', () => {
  const seeds = [1, 7, 11, 88, 451, 1024, 1982, 2077];

  it('is deterministic for a seed and different across seeds', () => {
    expect(generatePattern(7)).toEqual(generatePattern(7));
    expect(generatePattern(7)).not.toEqual(generatePattern(8));
  });

  it('keeps every note in the minor scale of the key', () => {
    for (const seed of seeds) {
      const p = generatePattern(seed);
      expect(['aeolian', 'phrygian']).toContain(p.mode);
      expect(p.scale).toContain(3); // minor third
      const notes = [...p.bass, ...p.arp, ...p.pads.flat()].filter((n) => n !== null) as number[];
      for (const n of notes) expect(p.scale).toContain((((n - p.root) % 12) + 12) % 12);
    }
  });

  it('stays at a darkwave tempo with the snare on 2 and 4', () => {
    for (const seed of seeds) {
      const p = generatePattern(seed);
      expect(p.bpm).toBeGreaterThanOrEqual(BPM_RANGE[0]);
      expect(p.bpm).toBeLessThanOrEqual(BPM_RANGE[1]);
      expect(p.snare.map((s, i) => (s ? i % STEPS_PER_BAR : -1)).filter((i) => i >= 0).every((i) => i === 4 || i === 12)).toBe(true);
      expect(p.bass.length).toBe(4 * STEPS_PER_BAR);
    }
  });

  it('keeps the arpeggio sparse', () => {
    for (const seed of seeds) {
      const p = generatePattern(seed);
      expect(p.arp.filter((n) => n !== null).length).toBeLessThan(p.arp.length / 2);
    }
  });
});

describe('fillImpulse', () => {
  it('decays to near silence and is deterministic for a random source', () => {
    const make = () => {
      const data = new Float32Array(8000);
      const rng = new Rng(3);
      fillImpulse(data, 4000, 2, () => rng.next());
      return data;
    };
    const ir = make();
    expect(ir).toEqual(make());
    const energy = (from: number, to: number) => ir.slice(from, to).reduce((sum, v) => sum + v * v, 0);
    expect(energy(7200, 8000)).toBeLessThan(energy(0, 800) / 100);
  });
});

describe('Radio.appendTracks', () => {
  it('adds tracks without restarting the one playing', () => {
    const player = new FakePlayer();
    const radio = new Radio(tracks.slice(0, 2), player);
    radio.toggle();
    radio.next();
    radio.appendTracks([tracks[2]]);
    expect(radio.current?.title).toBe('B');
    expect(player.log).toEqual(['play A', 'stop', 'play B']);
    radio.next();
    expect(radio.current?.title).toBe('C');
  });
});

describe('Radio.prependTracks', () => {
  it('opens on the new tracks when nothing played yet', () => {
    const player = new FakePlayer();
    const radio = new Radio(tracks.slice(1, 3), player);
    radio.prependTracks([tracks[0]]);
    radio.toggle();
    expect(radio.current?.title).toBe('A');
    expect(player.log).toEqual(['play A']);
  });

  it('keeps the track playing, then wraps around to the new ones', () => {
    const player = new FakePlayer();
    const radio = new Radio(tracks.slice(1, 3), player);
    radio.toggle();
    radio.prependTracks([tracks[0]]);
    expect(radio.current?.title).toBe('B');
    expect(player.log).toEqual(['play B']);
    radio.next();
    radio.next();
    expect(radio.current?.title).toBe('A');
  });
});
