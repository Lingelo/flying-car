import type { Environment } from '../atmosphere/environment';
import { CHUNK_SIZE, districtAt } from '../city/generator';
import type { Game } from '../game';

export interface BenchResult {
  avgFps: number;
  /** Frame rate of the slowest 1 % of frames. */
  low1Fps: number;
  frames: number;
  seconds: number;
  quality: string;
  gpu: string;
}

const WARMUP = 6;
const DURATION = 60;

/** Frame statistics from a list of frame durations in seconds. */
export function frameStats(durations: number[]): { avgFps: number; low1Fps: number } {
  if (!durations.length) return { avgFps: 0, low1Fps: 0 };
  const total = durations.reduce((a, b) => a + b, 0);
  const sorted = [...durations].sort((a, b) => b - a);
  const worst = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.01)));
  const worstAvg = worst.reduce((a, b) => a + b, 0) / worst.length;
  return { avgFps: durations.length / total, low1Fps: 1 / worstAvg };
}

/**
 * Scripted 60 s flight along a downtown avenue at night in the rain, the heaviest scene (AE12).
 * Started with ?bench=1; results are shown on screen and in window.__bench.
 */
export class Benchmark {
  private elapsed = 0;
  private readonly durations: number[] = [];
  done = false;

  constructor(
    private readonly game: Game,
    environment: Environment,
    seed: number,
    private readonly quality: () => string,
    private readonly gpu: string,
  ) {
    let start = { cx: 0, cz: 0 };
    search: for (let r = 0; r < 40; r++)
      for (let cx = -r; cx <= r; cx++)
        for (let cz = -r; cz <= r; cz++)
          if (Math.max(Math.abs(cx), Math.abs(cz)) === r && districtAt(seed, cx, cz) === 'downtown') {
            start = { cx, cz };
            break search;
          }
    const s = game.car.state;
    // Down the middle of an avenue (no building, no skywalk), between two traffic tiers.
    s.position.x = start.cx * CHUNK_SIZE;
    s.position.z = start.cz * CHUNK_SIZE - 600;
    s.position.y = 190;
    s.yaw = 0;
    s.mode = 'flight';
    s.deploy = 1;
    game.autopilot = { throttle: 0.75, steer: 0, lift: 0, boost: false };
    environment.autoTime = false;
    environment.hour = 22;
    environment.weather.force('rain');
    Object.assign(environment.weather.state, { rain: 1, wetness: 1, cloudiness: 0.92, fog: 0.0034 });
  }

  /** Call once per rendered frame with its duration. */
  frame(dt: number): void {
    if (this.done) return;
    this.elapsed += dt;
    const s = this.game.car.state;
    // Hold the altitude against small drifts.
    this.game.autopilot!.lift = Math.max(-1, Math.min(1, (190 - s.position.y) * 0.1));
    if (this.elapsed < WARMUP) return;
    this.durations.push(dt);
    if (this.elapsed >= WARMUP + DURATION) this.finish();
  }

  private finish(): void {
    this.done = true;
    this.game.autopilot = null;
    const stats = frameStats(this.durations);
    const result: BenchResult = { ...stats, frames: this.durations.length, seconds: DURATION, quality: this.quality(), gpu: this.gpu };
    Object.assign(window, { __bench: result });
    const panel = document.createElement('div');
    panel.className = 'bench-result';
    panel.innerHTML = `<b>BENCHMARK</b><br>${result.avgFps.toFixed(1)} fps de moyenne · 1 % bas ${result.low1Fps.toFixed(1)} fps<br>
      ${result.frames} images en ${DURATION} s · qualité ${result.quality}<br><small>${result.gpu}</small>`;
    Object.assign(panel.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', padding: '20px 28px',
      background: 'rgba(8,6,22,0.9)', border: '1px solid #7ff6ff', color: '#e8f6ff', font: '14px ui-monospace, monospace',
      lineHeight: '1.7', textAlign: 'center', zIndex: '20',
    });
    document.body.appendChild(panel);
  }
}
