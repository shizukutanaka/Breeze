// E2E config for Breeze. Drives the REAL, shipped index.html (see tests/e2e/server.mjs
// for the one serve-time-only transform) against the real _worker.js logic backed by
// an in-memory KV — not a re-implementation. Complements tests/*.test.js (vitest),
// which verify extracted function fragments in Node but never load index.html as an
// actual document in an actual browser.
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT || 8787;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false, // tests share one in-memory Worker KV — keep them serial to avoid cross-test interference
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node tests/e2e/server.mjs`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { E2E_PORT: String(PORT) },
    timeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // This environment preinstalls Chromium outside Playwright's managed cache
        // (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 is set so npm install doesn't refetch it).
        launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
      },
    },
  ],
});
