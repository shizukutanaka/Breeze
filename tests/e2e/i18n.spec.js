// Locale-loading E2E — the worldwide-readiness guard.
//
// Architecture under test: English is the only locale inside index.html (reference +
// fallback); every other language is pure data in locales/<lang>.json, fetched at boot,
// merged over English, and re-applied to the static DOM. This spec proves the mechanism in a
// real browser with a real Japanese locale, because the failure mode is silent: a broken
// loader shows English to everyone and no test that runs in English would ever notice.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('a Japanese browser gets the full Japanese UI from locales/ja.json', async ({ browser }) => {
  const ctx = await browser.newContext({
    locale: 'ja-JP',
    extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.45' },
  });
  const page = await ctx.newPage();
  const localeRequests = [];
  page.on('request', (r) => { if (r.url().includes('/locales/')) localeRequests.push(r.url()); });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');

  // The loader must actually fetch the Japanese file...
  await expect.poll(() => localeRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(localeRequests[0]).toContain('/locales/ja.json');

  // ...and the STATIC DOM must re-apply once it arrives. #b-msg-setup carries data-i18n and
  // its Japanese string lives only in the external file now, so this passing proves fetch,
  // merge and re-apply all worked (not just LANG detection).
  const ja = JSON.parse(readFileSync(join(ROOT, 'locales', 'ja.json'), 'utf8'));
  await expect(page.locator('#b-msg-setup')).toHaveText(ja.createFree, { timeout: 10_000 });

  // Dynamic UI reads the merged table too: create an identity and check a post-boot screen.
  await page.locator('#msg-name').fill('花子');
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();
  await expect(page.locator('#msg-input')).toHaveAttribute('placeholder', ja.msgPlaceholder);

  expect(errors, `page errors: ${JSON.stringify(errors)}`).toEqual([]);
  await ctx.close();
});

test('an unsupported locale falls back to English without errors', async ({ browser }) => {
  // Swahili has no locales/ file and no special-case anywhere. The app must boot in English
  // with zero errors — the fallback IS the feature (a worldwide app must never white-screen
  // because a translation is missing).
  const ctx = await browser.newContext({
    locale: 'sw-KE',
    extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.46' },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.locator('#msg-setup')).toBeVisible();
  await expect(page.locator('#b-msg-setup')).toHaveText('Create Identity — Free');
  expect(errors).toEqual([]);
  await ctx.close();
});

test('a Korean browser loads locales/ko.json (proves the pattern scales past the founding locale)', async ({ browser }) => {
  const ctx = await browser.newContext({
    locale: 'ko-KR',
    extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.47' },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  const ko = JSON.parse(readFileSync(join(ROOT, 'locales', 'ko.json'), 'utf8'));
  await expect(page.locator('#b-msg-setup')).toHaveText(ko.createFree, { timeout: 10_000 });
  expect(errors).toEqual([]);
  await ctx.close();
});

test('a Thai browser loads locales/th.json (second non-Latin script verified in a real browser)', async ({ browser }) => {
  const ctx = await browser.newContext({
    locale: 'th-TH',
    extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.48' },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  const th = JSON.parse(readFileSync(join(ROOT, 'locales', 'th.json'), 'utf8'));
  await expect(page.locator('#b-msg-setup')).toHaveText(th.createFree, { timeout: 10_000 });
  expect(errors).toEqual([]);
  await ctx.close();
});
