import { ACTIONS, type Action, type Bindings } from './bindings';
import { readGamepad, type GamepadLike } from './gamepad';

/** Where keyboard state comes from (the DOM in the app, a stub in tests). */
export interface KeySource {
  isDown(code: string): boolean;
  wasPressed(code: string): boolean;
  endFrame(): void;
}

export interface Axes {
  throttle: number;
  steer: number;
  lift: number;
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/** Unifies keyboard, mouse and gamepad into actions; call `update` once per rendered frame. */
export class Input {
  readonly axes: Axes = { throttle: 0, steer: 0, lift: 0 };
  /** Camera look input this frame (mouse delta in pixels, or right stick). */
  readonly look = { x: 0, y: 0 };
  private readonly held = new Set<Action>();
  private readonly edges = new Set<Action>();
  private padPrevious = new Set<Action>();
  private mouse = { x: 0, y: 0 };

  constructor(
    private readonly keys: KeySource,
    public bindings: Bindings,
  ) {}

  addMouseDelta(dx: number, dy: number): void {
    this.mouse.x += dx;
    this.mouse.y += dy;
  }

  update(pad: GamepadLike | null): void {
    this.held.clear();
    this.edges.clear();
    for (const action of ACTIONS) {
      for (const code of this.bindings[action]) {
        if (this.keys.isDown(code)) this.held.add(action);
        if (this.keys.wasPressed(code)) this.edges.add(action);
      }
    }
    const k = (a: Action) => (this.held.has(a) ? 1 : 0);
    let throttle = k('forward') - k('back');
    let steer = k('right') - k('left');
    let lift = k('up') - k('down');
    this.look.x = this.mouse.x;
    this.look.y = this.mouse.y;
    this.mouse.x = this.mouse.y = 0;

    if (pad) {
      const state = readGamepad(pad);
      throttle += state.axes.throttle;
      steer += state.axes.steer;
      lift += state.axes.lift;
      this.look.x += state.look.x * 12;
      this.look.y += state.look.y * 12;
      for (const a of state.buttons) {
        this.held.add(a);
        if (!this.padPrevious.has(a)) this.edges.add(a);
      }
      this.padPrevious = state.buttons;
    }
    this.axes.throttle = clamp1(throttle);
    this.axes.steer = clamp1(steer);
    this.axes.lift = clamp1(lift);
    this.keys.endFrame();
  }

  isHeld(action: Action): boolean {
    return this.held.has(action);
  }

  /** True on the frame the action was triggered. */
  pressed(action: Action): boolean {
    return this.edges.has(action);
  }
}
