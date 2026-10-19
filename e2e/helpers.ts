import type { Page } from '@playwright/test';

export interface DebugState {
  frames: number;
  activeChunks: number;
  pooled: number;
  mode: string;
  paused: boolean;
  geometries: number;
  night: number;
  fog: number;
  atlasReady: boolean;
}

export const debugState = (page: Page) => page.evaluate(() => (window as unknown as { __debug: DebugState }).__debug);

/** Collects page errors and console errors, ignoring the missing favicon. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Only the favicon may be missing; any other 404 (worker chunk, manifest…) is an error.
    if (m.type() === 'error' && !/favicon/.test(m.location().url)) errors.push(`${m.text()} ${m.location().url}`);
  });
  return errors;
}

export async function waitForFrames(page: Page, frames: number): Promise<void> {
  await page.waitForFunction((n) => ((window as unknown as { __debug?: DebugState }).__debug?.frames ?? 0) >= n, frames, { timeout: 120_000 });
}
