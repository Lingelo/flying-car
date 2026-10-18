import { expect, test } from '@playwright/test';
import { collectErrors, debugState, waitForFrames } from './helpers';

test('the city loads and renders without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?debug=1');
  await waitForFrames(page, 20);
  const state = await debugState(page);
  expect(state.activeChunks).toBeGreaterThan(4);
  await expect(page.locator('.hud')).toBeVisible();
  await expect(page.locator('#app canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the car takes off from the keyboard', async ({ page }) => {
  await page.goto('/?debug=1');
  await waitForFrames(page, 10);
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => (window as unknown as { __debug: { mode: string } }).__debug.mode !== 'ground', null, { timeout: 30_000 });
});
