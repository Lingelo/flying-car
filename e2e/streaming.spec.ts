import { expect, test } from '@playwright/test';
import { debugState, waitForFrames } from './helpers';

// AE5: a long straight flight keeps buildings ahead and memory flat. The flight is accelerated:
// the car jumps one chunk at a time above the rooftops, giving the streamer a few frames each time.
test('flying straight for 15 km keeps the city ahead and memory bounded (AE5)', async ({ page }) => {
  await page.goto('/?debug=1&quality=low');
  await waitForFrames(page, 10);
  const chunks = 60;
  let maxActive = 0;
  const geometries: number[] = [];
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
    geometries.push(state.geometries);
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
  // GPU geometries stay flat: what is unloaded is disposed.
  const early = Math.max(...geometries.slice(10, 20));
  const late = Math.max(...geometries.slice(-10));
  expect(late).toBeLessThanOrEqual(early * 1.25);
});
