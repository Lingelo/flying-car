import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { debugState, waitForFrames } from './helpers';

type Game = { car: { state: { mode: string; deploy: number; position: { x: number; y: number; z: number }; velocity: { x: number; y: number; z: number } } }; streamer: { active: Map<string, unknown>; pending: Set<string> } };

/** Waits until no chunk is in flight, then lets a few frames upload what was mounted to the GPU. */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __game: Game }).__game.streamer.pending.size === 0, null, { timeout: 300_000 });
  const start = (await debugState(page)).frames;
  await page.waitForFunction((f) => (window as unknown as { __debug: { frames: number } }).__debug.frames >= f + 6, start, { timeout: 120_000 });
}

// AE5: a long straight flight keeps buildings ahead and memory flat. The flight is accelerated:
// the car jumps one chunk at a time above the rooftops, giving the streamer a few frames each time.
test('flying straight for 15 km keeps the city ahead and memory bounded (AE5)', async ({ page }) => {
  // About 240 rendered frames in software WebGL: several minutes on a CI runner.
  test.setTimeout(900_000);
  await page.goto('/?debug=1&quality=low');
  await waitForFrames(page, 10);
  // Measured in flight above the rooftops, like the rest of the test: the view, and so what reaches
  // the GPU, is the same at the start and on the way back.
  await page.evaluate(() => {
    const s = (window as unknown as { __game: Game }).__game.car.state;
    s.mode = 'flight';
    s.deploy = 1;
    s.position.y = 590;
    s.velocity.x = s.velocity.y = s.velocity.z = 0;
  });
  await settle(page);
  const startX = await page.evaluate(() => (window as unknown as { __game: Game }).__game.car.state.position.x);
  const base = (await debugState(page)).geometries;
  const chunks = 60;
  let maxActive = 0;
  for (let i = 0; i < chunks; i++) {
    await page.evaluate(() => {
      const g = (window as unknown as { __game: { car: { state: { mode: string; deploy: number; position: { x: number; y: number }; velocity: { x: number; y: number; z: number } } } } }).__game;
      const s = g.car.state;
      s.mode = 'flight';
      s.deploy = 1;
      s.position.y = 590;
      s.velocity.x = s.velocity.y = s.velocity.z = 0;
      s.position.x += 256;
    });
    const start = (await debugState(page)).frames;
    await page.waitForFunction((f) => (window as unknown as { __debug: { frames: number } }).__debug.frames >= f + 4, start);
    const state = await debugState(page);
    maxActive = Math.max(maxActive, state.activeChunks);
  }
  // Ring of radius 3 (29 chunks) plus the trailing hysteresis band.
  expect(maxActive).toBeLessThanOrEqual(49);
  // The chunk just ahead of the car gets loaded.
  await page.waitForFunction(() => {
    const g = (window as unknown as { __game: { car: { state: { position: { x: number; z: number } } }; streamer: { active: Map<string, unknown> } } }).__game;
    const cx = Math.floor(g.car.state.position.x / 256) + 1;
    const cz = Math.floor(g.car.state.position.z / 256);
    return g.streamer.active.has(`${cx},${cz}`);
  }, null, { timeout: 60_000 });
  const state = await debugState(page);
  expect(state.pooled).toBeLessThanOrEqual(maxActive + 2);
  // GPU geometries stay flat: back over the same streets after 15 km, the count matches the start —
  // what was unloaded on the way was disposed. Comparing the same place avoids district-to-district
  // differences in content.
  await page.evaluate((x) => {
    const s = (window as unknown as { __game: Game }).__game.car.state;
    s.position.x = x;
    s.position.y = 590;
    s.velocity.x = s.velocity.y = s.velocity.z = 0;
  }, startX);
  await settle(page);
  const back = (await debugState(page)).geometries;
  expect(back).toBeLessThanOrEqual(base * 1.25);
});
