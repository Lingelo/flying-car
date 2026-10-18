/**
 * Fixed-timestep clock: the simulation advances in constant steps whatever the frame rate,
 * and rendering interpolates between the last two steps with `alpha`.
 */
export class FixedStep {
  private accumulator = 0;

  constructor(
    readonly step: number,
    private readonly maxSteps = 5,
  ) {}

  advance(dt: number): { steps: number; alpha: number } {
    this.accumulator += Math.max(0, dt);
    let steps = Math.floor(this.accumulator / this.step);
    if (steps > this.maxSteps) {
      // Too far behind (tab in background, long hitch): drop the backlog instead of spiralling.
      steps = this.maxSteps;
      this.accumulator = 0;
    } else {
      this.accumulator -= steps * this.step;
    }
    return { steps, alpha: Math.min(this.accumulator / this.step, 0.999999) };
  }
}

export interface Loop {
  start(): void;
  stop(): void;
}

/** Drives `update` at a fixed rate and `render` once per animation frame. */
export function createLoop(
  update: (dt: number) => void,
  render: (alpha: number, frameDt: number) => void,
  step = 1 / 60,
): Loop {
  const clock = new FixedStep(step);
  let last = 0;
  let handle = 0;
  const frame = (now: number) => {
    const frameDt = last ? (now - last) / 1000 : step;
    last = now;
    const { steps, alpha } = clock.advance(frameDt);
    for (let i = 0; i < steps; i++) update(step);
    render(alpha, frameDt);
    handle = requestAnimationFrame(frame);
  };
  return {
    start() {
      last = 0;
      handle = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(handle);
    },
  };
}
