import { describe, expect, it } from 'vitest';
import { Radio, type Track, type TrackPlayer } from './radio';
import { generatePattern, SCALE } from './synthwave';

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
  it('is deterministic for a seed and different across seeds', () => {
    expect(generatePattern(7)).toEqual(generatePattern(7));
    expect(generatePattern(7)).not.toEqual(generatePattern(8));
  });

  it('keeps every note in the scale of the key', () => {
    const p = generatePattern(11);
    for (const n of [...p.bass, ...p.arp].filter((n) => n !== null) as number[]) {
      expect(SCALE).toContain((((n - p.root) % 12) + 12) % 12);
    }
    expect(p.bpm).toBeGreaterThanOrEqual(84);
    expect(p.bpm).toBeLessThanOrEqual(112);
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
