import type { KeySource } from './actions';

/** Keyboard state from DOM events; ignores typing in form fields (settings menu). */
export class KeyboardSource implements KeySource {
  private readonly down = new Set<string>();
  private readonly edges = new Set<string>();
  /** When set, the next key press is captured (key rebinding) instead of driving the game. */
  capture: ((code: string) => void) | null = null;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (this.capture) {
        e.preventDefault();
        const cb = this.capture;
        this.capture = null;
        cb(e.code);
        return;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.edges.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.edges.has(code);
  }

  endFrame(): void {
    this.edges.clear();
  }
}

/** Mouse look while the pointer is locked on the canvas (click to lock). */
export function bindPointerLock(canvas: HTMLCanvasElement, onDelta: (dx: number, dy: number) => void): void {
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) void canvas.requestPointerLock?.();
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) onDelta(e.movementX, e.movementY);
  });
}
