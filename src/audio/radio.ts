import { DarkwavePlayer, generatePattern } from './darkwave';

export interface Track {
  title: string;
  artist: string;
  license: string;
  kind: 'generated' | 'file';
  /** Generated tracks: pattern seed. */
  seed?: number;
  /** File tracks: URL relative to the site. */
  url?: string;
}

/** Plays tracks; the radio only drives it. */
export interface TrackPlayer {
  play(track: Track): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

export type RadioStatus = 'empty' | 'off' | 'on';

/** Built-in station: generated darkwave, no licence needed. */
export const GENERATED_TRACKS: Track[] = [
  { title: 'Pluie acide', artist: 'Onde Noire (générative)', license: 'généré', kind: 'generated', seed: 2077 },
  { title: 'Béton froid', artist: 'Onde Noire (générative)', license: 'généré', kind: 'generated', seed: 1982 },
  { title: 'Nuit sans étoiles', artist: 'Onde Noire (générative)', license: 'généré', kind: 'generated', seed: 451 },
  { title: 'Sous la dalle', artist: 'Onde Noire (générative)', license: 'généré', kind: 'generated', seed: 88 },
  { title: 'Mémoire synthétique', artist: 'Onde Noire (générative)', license: 'généré', kind: 'generated', seed: 1024 },
  { title: 'Dernière ligne', artist: 'Onde Noire (générative)', license: 'généré', kind: 'generated', seed: 666 },
];

/** Car radio: on/off keeps the position, next wraps around, an empty playlist is not an error. */
export class Radio {
  private index = 0;
  private on = false;
  /** True when the current track has been started and can be resumed. */
  private started = false;

  constructor(
    private tracks: Track[],
    private readonly player: TrackPlayer,
  ) {}

  get status(): RadioStatus {
    if (!this.tracks.length) return 'empty';
    return this.on ? 'on' : 'off';
  }

  get current(): Track | null {
    return this.tracks[this.index] ?? null;
  }

  setTracks(tracks: Track[]): void {
    this.tracks = tracks;
    this.index = 0;
    this.started = false;
    if (this.on && tracks.length) this.startCurrent();
  }

  /** Adds tracks at the end, leaving the current track and its playback alone. */
  /**
   * Puts tracks at the head of the playlist (the station's own music before the generated one).
   * A track already playing keeps playing; otherwise the first new track becomes current.
   */
  prependTracks(tracks: Track[]): void {
    if (!tracks.length) return;
    this.tracks = [...tracks, ...this.tracks];
    if (this.started) this.index += tracks.length;
    else this.index = 0;
  }

  appendTracks(tracks: Track[]): void {
    const wasEmpty = !this.tracks.length;
    this.tracks = [...this.tracks, ...tracks];
    if (wasEmpty) this.index = 0;
  }

  toggle(): void {
    if (!this.tracks.length) return;
    this.on = !this.on;
    if (!this.on) {
      this.player.pause();
    } else if (this.started) {
      this.player.resume();
    } else {
      this.startCurrent();
    }
  }

  next(): void {
    if (!this.tracks.length) return;
    this.index = (this.index + 1) % this.tracks.length;
    this.started = false;
    if (this.on) {
      this.player.stop();
      this.startCurrent();
    }
  }

  private startCurrent(): void {
    const track = this.current;
    if (!track) return;
    this.player.play(track);
    this.started = true;
  }
}

/** Plays generated tracks with the synthesizer and file tracks with an audio element. */
export class AudioTrackPlayer implements TrackPlayer {
  private synth: DarkwavePlayer | null = null;
  private synthStep = 0;
  private element: HTMLAudioElement | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly output: AudioNode,
  ) {}

  play(track: Track): void {
    this.stop();
    if (track.kind === 'generated') {
      this.synth = new DarkwavePlayer(this.ctx, this.output, generatePattern(track.seed ?? 1));
      this.synth.start(0);
    } else if (track.url) {
      this.element = new Audio(track.url);
      this.element.crossOrigin = 'anonymous';
      this.element.loop = true;
      this.ctx.createMediaElementSource(this.element).connect(this.output);
      void this.element.play().catch(() => undefined);
    }
  }

  pause(): void {
    if (this.synth) {
      this.synthStep = this.synth.position;
      this.synth.stop();
    }
    this.element?.pause();
  }

  resume(): void {
    this.synth?.start(this.synthStep);
    void this.element?.play().catch(() => undefined);
  }

  stop(): void {
    this.synth?.dispose();
    this.synth = null;
    this.synthStep = 0;
    if (this.element) {
      this.element.pause();
      this.element.src = '';
      this.element = null;
    }
  }
}

/** Optional extra tracks listed in public/audio/radio/manifest.json (with their licence). */
export async function loadManifest(base: string): Promise<Track[]> {
  try {
    const res = await fetch(`${base}audio/radio/manifest.json`);
    if (!res.ok) return [];
    const list: unknown = await res.json();
    if (!Array.isArray(list)) return [];
    return list
      .filter((t): t is { title: string; artist: string; license: string; file: string } =>
        !!t && typeof t.title === 'string' && typeof t.file === 'string' && typeof t.license === 'string')
      .map((t) => ({ title: t.title, artist: t.artist ?? '', license: t.license, kind: 'file' as const, url: `${base}audio/radio/${t.file}` }));
  } catch {
    return [];
  }
}
