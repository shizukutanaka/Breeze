// E2E config for Breeze. Drives the REAL, shipped index.html (see tests/e2e/server.mjs
// for the one serve-time-only transform) against the real _worker.js logic backed by
// an in-memory KV — not a re-implementation. Complements tests/*.test.js (vitest),
// which verify extracted function fragments in Node but never load index.html as an
// actual document in an actual browser.
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT || 8787;

// Some environments preinstall a browser outside Playwright's managed cache —
// honour E2E_BROWSER_PATH or the historical /opt/pw-browsers/chromium when they
// actually exist; otherwise fall back to `npx playwright install chromium`'s
// managed download. A hardcoded path that doesn't exist fails every spec at
// launch, silently keeping the suite runnable only on the author's machine.
const PREINSTALLED = ['/opt/pw-browsers/chromium'];
const executablePath =
  process.env.E2E_BROWSER_PATH ||
  PREINSTALLED.find((p) => existsSync(p));

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false, // tests share one in-memory Worker KV — keep them serial to avoid cross-test interference
  // fullyParallel only serializes tests WITHIN a file; without workers:1, Playwright's
  // default (~half the CPU cores, 2 on this 4-core box) still runs DIFFERENT spec files
  // concurrently in separate worker processes — each hitting the same in-memory KV via
  // server.mjs, exactly the cross-test interference the line above claims to prevent.
  // Confirmed empirically: two full-suite runs each failed one arrival-after-reload
  // assertion, both times on the message never arriving in time (a different test in
  // each run) — every failure passed 3/3 and 6/6 when the same file ran alone. Root
  // cause was inter-file contention, not a product bug.
  workers: 1,
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
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
});
