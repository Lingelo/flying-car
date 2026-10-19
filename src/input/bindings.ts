/** Keyboard-bindable actions. Axes come from pairs (forward/back, left/right, up/down). */
export const ACTIONS = [
  'forward', 'back', 'left', 'right', 'up', 'down', 'boost',
  'toggleFlight', 'camera', 'photo', 'capture', 'radio', 'radioNext', 'hud', 'menu',
] as const;
export type Action = (typeof ACTIONS)[number];
export type Bindings = Record<Action, string[]>;

export const ACTION_LABELS: Record<Action, string> = {
  forward: 'Accélérer',
  back: 'Freiner / reculer',
  left: 'Gauche',
  right: 'Droite',
  up: 'Monter',
  down: 'Descendre',
  boost: 'Boost',
  toggleFlight: 'Sol / vol',
  camera: 'Changer de caméra',
  photo: 'Mode photo',
  capture: 'Photo : capturer',
  radio: 'Radio marche / arrêt',
  radioNext: 'Piste suivante',
  hud: 'Afficher / masquer le HUD',
  menu: 'Menu',
};

export const DEFAULT_BINDINGS: Bindings = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['Space'],
  down: ['KeyC', 'ControlLeft'],
  boost: ['ShiftLeft'],
  toggleFlight: ['KeyF'],
  camera: ['KeyV'],
  photo: ['KeyP'],
  capture: ['Enter'],
  radio: ['KeyM'],
  radioNext: ['KeyR'],
  hud: ['KeyH'],
  menu: ['Escape'],
};

const STORAGE_KEY = 'flying-car.bindings';

/** Assigns `code` to `action` only, removing it from any other action. */
export function rebind(bindings: Bindings, action: Action, code: string): Bindings {
  const next = {} as Bindings;
  for (const a of ACTIONS) next[a] = bindings[a].filter((c) => c !== code);
  next[action] = [code];
  return next;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Reads saved bindings; any missing, invalid or unreadable entry falls back to its default. */
export function loadBindings(storage: StorageLike | null): Bindings {
  const result = structuredClone(DEFAULT_BINDINGS);
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return result;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return result;
    for (const action of ACTIONS) {
      const codes = (parsed as Record<string, unknown>)[action];
      if (Array.isArray(codes) && codes.length && codes.every((c) => typeof c === 'string' && /^[A-Za-z0-9]{1,31}$/.test(c))) {
        result[action] = codes as string[];
      }
    }
  } catch {
    // Storage disabled or corrupted: defaults.
  }
  return result;
}

export function saveBindings(bindings: Bindings, storage: StorageLike | null): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Private mode or quota: the bindings simply are not remembered.
  }
}
