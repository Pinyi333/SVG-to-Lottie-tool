import { defineConfig, devices } from '@playwright/test';

/**
 * The app is served from the production build rather than the dev server, so
 * the smoke tests exercise what actually ships — including the base path and
 * the dynamically imported player chunk.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/SVG-to-Lottie-tool/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Environments that ship a preinstalled Chromium (CI images, sandboxes)
        // set this so Playwright uses it instead of downloading its own build,
        // which its version pin would otherwise insist on.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
  webServer: {
    // Serves the existing build rather than making one. The root `test:e2e`
    // script builds first, and CI has its own build step; building again here
    // doubled the work and blew past this timeout on a cold runner.
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/SVG-to-Lottie-tool/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
