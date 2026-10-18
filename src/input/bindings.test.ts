import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, loadBindings, rebind, saveBindings } from './bindings';
import { Input } from './actions';
import { applyDeadzone, readGamepad } from './gamepad';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

/** Keyboard stub: the set of keys currently held, plus keys pressed since last frame. */
class FakeKeys {
  down = new Set<string>();
  edges = new Set<string>();
  press(code: string) {
    this.down.add(code);
    this.edges.add(code);
  }
  release(code: string) {
    this.down.delete(code);
  }
  isDown(code: string) {
    return this.down.has(code);
  }
  wasPressed(code: string) {
    return this.edges.has(code);
  }
  endFrame() {
    this.edges.clear();
  }
}

describe('bindings', () => {
  it('a rebound key triggers the new action and no longer the old one', () => {
    const bindings = rebind(DEFAULT_BINDINGS, 'toggleFlight', 'KeyG');
    const keys = new FakeKeys();
    const input = new Input(keys, bindings);
    keys.press('KeyG');
    input.update(null);
    expect(input.pressed('toggleFlight')).toBe(true);
    keys.endFrame();
    keys.press('KeyF');
    input.update(null);
    expect(input.pressed('toggleFlight')).toBe(false);
  });

  it('moves a key away from the action that used it', () => {
    const bindings = rebind(DEFAULT_BINDINGS, 'camera', 'KeyW');
    expect(bindings.camera).toEqual(['KeyW']);
    expect(bindings.forward).not.toContain('KeyW');
  });

  it('falls back to defaults when storage is unavailable', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadBindings(throwing)).toEqual(DEFAULT_BINDINGS);
    expect(() => saveBindings(DEFAULT_BINDINGS, throwing)).not.toThrow();
    expect(loadBindings(null)).toEqual(DEFAULT_BINDINGS);
  });

  it('falls back to defaults on corrupted data and keeps valid entries', () => {
    const storage = new MemoryStorage();
    storage.setItem('flying-car.bindings', '{not json');
    expect(loadBindings(storage)).toEqual(DEFAULT_BINDINGS);
    storage.setItem('flying-car.bindings', JSON.stringify({ camera: ['KeyX'], forward: 'oops', unknown: ['KeyQ'] }));
    const loaded = loadBindings(storage);
    expect(loaded.camera).toEqual(['KeyX']);
    expect(loaded.forward).toEqual(DEFAULT_BINDINGS.forward);
    expect(loaded).not.toHaveProperty('unknown');
  });

  it('rejects stored codes that are not KeyboardEvent codes (markup)', () => {
    const storage = new MemoryStorage();
    storage.setItem('flying-car.bindings', JSON.stringify({ camera: ['<img src=x onerror=1>'] }));
    expect(loadBindings(storage).camera).toEqual(DEFAULT_BINDINGS.camera);
  });

  it('round-trips through storage', () => {
    const storage = new MemoryStorage();
    const custom = rebind(DEFAULT_BINDINGS, 'photo', 'KeyK');
    saveBindings(custom, storage);
    expect(loadBindings(storage)).toEqual(custom);
  });
});

describe('Input axes', () => {
  it('combines opposite keys into an axis', () => {
    const keys = new FakeKeys();
    const input = new Input(keys, DEFAULT_BINDINGS);
    keys.press('KeyW');
    input.update(null);
    expect(input.axes.throttle).toBe(1);
    keys.press('KeyS');
    input.update(null);
    expect(input.axes.throttle).toBe(0);
  });
});

describe('gamepad', () => {
  it('ignores stick noise inside the dead zone and rescales outside', () => {
    expect(applyDeadzone(0.1)).toBe(0);
    expect(applyDeadzone(-0.14)).toBe(0);
    expect(applyDeadzone(1)).toBe(1);
    expect(applyDeadzone(-1)).toBe(-1);
    expect(applyDeadzone(0.575)).toBeCloseTo(0.5);
  });

  it('maps a standard gamepad to actions', () => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    buttons[7] = { pressed: true, value: 0.8 }; // right trigger
    buttons[3] = { pressed: true, value: 1 }; // Y
    const state = readGamepad({ axes: [-1, 0, 0, 0], buttons, mapping: 'standard' });
    expect(state.axes.throttle).toBeCloseTo(0.8);
    expect(state.axes.steer).toBe(-1);
    expect(state.buttons.has('toggleFlight')).toBe(true);
  });
});
