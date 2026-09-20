import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // tests/e2e/*.spec.js are Playwright specs (see playwright.config.js) — they use
    // @playwright/test's own test()/expect() (browser-driven, not Node/vitest), and
    // vitest's default include glob would otherwise pick them up and fail to run them.
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
  },
});
