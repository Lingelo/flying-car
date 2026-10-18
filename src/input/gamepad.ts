import type { Action } from './bindings';

export const DEADZONE = 0.15;

export interface GamepadLike {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
  mapping: string;
}

export interface PadState {
  axes: { throttle: number; steer: number; lift: number };
  look: { x: number; y: number };
  buttons: Set<Action>;
}

/** Removes stick noise around the centre and rescales the rest to keep the full range. */
export function applyDeadzone(v: number, zone = DEADZONE): number {
  const a = Math.abs(v);
  if (a < zone) return 0;
  return (Math.sign(v) * (a - zone)) / (1 - zone);
}

/** Standard-mapping buttons → actions (A boost, B photo, X next track, Y ground/flight…). */
const BUTTONS: [number, Action][] = [
  [0, 'boost'], [1, 'photo'], [2, 'radioNext'], [3, 'toggleFlight'],
  [8, 'camera'], [9, 'menu'], [12, 'hud'], [13, 'radio'],
];

export function readGamepad(pad: GamepadLike): PadState {
  const b = (i: number) => pad.buttons[i]?.value ?? 0;
  const buttons = new Set<Action>();
  for (const [index, action] of BUTTONS) if (pad.buttons[index]?.pressed) buttons.add(action);
  return {
    axes: {
      throttle: b(7) - b(6),
      steer: applyDeadzone(pad.axes[0] ?? 0),
      lift: b(5) - b(4),
    },
    look: { x: applyDeadzone(pad.axes[2] ?? 0), y: applyDeadzone(pad.axes[3] ?? 0) },
    buttons,
  };
}

/** First connected standard gamepad, if any. */
export function firstGamepad(): GamepadLike | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  for (const pad of navigator.getGamepads()) if (pad && pad.connected) return pad;
  return null;
}
