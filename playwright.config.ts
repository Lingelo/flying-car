import { defineConfig } from '@playwright/test';

// Headless Chromium renders WebGL in software (SwiftShader): slow but deterministic. Tests run at a
// reduced size and, except the high-quality smoke test, at ?quality=low (about 3x faster).
// PLAYWRIGHT_CHROMIUM_PATH points at a preinstalled browser when the bundled one is absent.
export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 960, height: 540 },
    acceptDownloads: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
