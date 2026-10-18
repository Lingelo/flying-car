import type { Page } from '@playwright/test';

export interface DebugState {
  frames: number;
  activeChunks: number;
  pooled: number;
  mode: string;
  paused: boolean;
}

export const debugState = (page: Page) => page.evaluate(() => (window as unknown as { __debug: DebugState }).__debug);

/** Collects page errors and console errors, ignoring the missing favicon. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('favicon') && !m.text().includes('404')) errors.push(m.text());
  });
  return errors;
}

export async function waitForFrames(page: Page, frames: number): Promise<void> {
  await page.waitForFunction((n) => ((window as unknown as { __debug?: DebugState }).__debug?.frames ?? 0) >= n, frames, { timeout: 120_000 });
}
