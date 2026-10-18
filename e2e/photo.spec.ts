import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { waitForFrames } from './helpers';

test('photo mode freezes the world and saves a PNG without the HUD (AE11)', async ({ page }, info) => {
  await page.goto('/?debug=1&hour=21');
  await waitForFrames(page, 10);
  await page.keyboard.press('KeyP');
  await expect(page.locator('.hud')).toHaveClass(/hidden/);
  await expect(page.locator('.hud-photo')).toHaveClass(/show/);
  await page.waitForFunction(() => (window as unknown as { __debug: { paused: boolean } }).__debug.paused);

  const download = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^neon-city-\d{8}-\d{6}\.png$/);
  const path = info.outputPath(file.suggestedFilename());
  await file.saveAs(path);
  const png = await readFile(path);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.length).toBeGreaterThan(20_000);

  await page.keyboard.press('KeyP');
  await expect(page.locator('.hud')).not.toHaveClass(/hidden/);
});
