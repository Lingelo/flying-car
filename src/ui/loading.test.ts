import { describe, expect, it, vi } from 'vitest';
import { LoadingScreen } from './loading';

/** Minimal stand-in for the #loading element of index.html. */
function fakeRoot() {
  const fill = { style: { width: '' } };
  const status = { textContent: '' };
  const classes = new Set<string>();
  const root = {
    querySelector: (sel: string) => (sel === '[data-fill]' ? fill : status),
    classList: { add: (c: string) => classes.add(c) },
    remove: () => undefined,
  };
  return { root: root as unknown as HTMLElement, fill, status, classes };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('LoadingScreen', () => {
  it('shows the running task and fills as tasks settle, failures included', async () => {
    const { root, fill, status } = fakeRoot();
    const screen = new LoadingScreen(root);
    let resolveA!: () => void;
    let rejectB!: (e: Error) => void;
    void screen.track('Façades', new Promise<void>((r) => (resolveA = r)));
    void screen.track('Enseignes', new Promise<void>((_, j) => (rejectB = j))).catch(() => undefined);
    expect(status.textContent).toBe('Façades');
    resolveA();
    await flush();
    expect(status.textContent).toBe('Enseignes');
    expect(screen.progress).toBe(0.5);
    rejectB(new Error('font missing'));
    await flush();
    expect(screen.progress).toBe(1);
    expect(fill.style.width).toBe('70%');
  });

  it('hides once tasks are done and the city is ready, not before', async () => {
    const { root, classes } = fakeRoot();
    const screen = new LoadingScreen(root);
    void screen.track('Rues', Promise.resolve());
    await flush();
    screen.update(0.5);
    expect(screen.visible).toBe(true);
    screen.update(1);
    expect(screen.visible).toBe(false);
    expect(classes.has('done')).toBe(true);
  });

  it('never keeps the player out longer than the maximum wait', () => {
    vi.useFakeTimers();
    const { root } = fakeRoot();
    const screen = new LoadingScreen(root, 1000);
    void screen.track('Façades', new Promise(() => undefined));
    screen.update(0);
    expect(screen.visible).toBe(true);
    vi.advanceTimersByTime(1500);
    screen.update(0);
    expect(screen.visible).toBe(false);
    vi.useRealTimers();
  });
});
