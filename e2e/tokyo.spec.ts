import { expect, test } from '@playwright/test';
import { waitForFrames } from './helpers';

test('signs use the bundled Japanese font, not pseudo-glyphs (AE2)', async ({ page }) => {
  await page.goto('/?debug=1&hour=22');
  await waitForFrames(page, 5);
  await page.waitForFunction(() => (window as unknown as { __debug: { atlasReady: boolean } }).__debug.atlasReady, null, { timeout: 60_000 });
  const fontLoaded = await page.evaluate(() => document.fonts.check('900 40px "Noto Sans JP"', 'ラーメン居酒屋'));
  expect(fontLoaded).toBe(true);
});
