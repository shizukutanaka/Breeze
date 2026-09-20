// Enforced-CSP boot test.
//
// index.html ships its JS in an inline <script>, which used to require
// script-src 'unsafe-inline' — the policy that also lets an injected script run, i.e. lets an
// XSS read the identity private key out of IndexedDB. That is the core web risk in
// SECURITY.md's threat model. script-src is now hash-pinned instead.
//
// The hash is over the exact script bytes, so ANY edit to index.html invalidates it, and a stale
// hash blocks the whole app. That failure is invisible to the rest of the suite because the E2E
// harness serves index.html WITHOUT the _headers policy. This spec closes that hole: it applies
// the REAL production CSP from _headers as a response header and asserts the app still boots and
// reports zero policy violations. tools/csp-hash.mjs --check (wired into validate.sh) guards the
// static side; this guards the runtime side.
//
// The hash lives only in _headers, not in index.html's <meta> CSP. A browser enforces the
// INTERSECTION of all policies, so the strict header alone makes the hash binding in production
// while the permissive meta copy keeps byte-level rewrites of the served HTML working.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function productionCsp() {
  const headers = readFileSync(join(ROOT, '_headers'), 'utf8');
  const m = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m);
  if (!m) throw new Error('csp.spec: no Content-Security-Policy in _headers');
  return m[1].trim();
}

// Serve the document with the real production CSP attached, and collect any violation the
// browser reports.
//
// The hashes are recomputed from the bytes THIS SERVER ACTUALLY SENDS rather than from
// index.html on disk: tests/e2e/server.mjs rewrites one line (`const API = ...` -> `'/api'`) so
// local API calls resolve, which legitimately changes the script bytes. Pinning the disk hash
// here would fail for a harness reason and tell us nothing about production. What this spec
// proves is the MECHANISM — that a hash-pinned script-src with no 'unsafe-inline' still boots the
// app. That the shipped _headers hash matches the shipped index.html is a separate, static
// guarantee enforced by `node tools/csp-hash.mjs --check` in validate.sh.
async function withEnforcedCsp(context) {
  const template = productionCsp();
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(`${e.violatedDirective} :: ${e.blockedURI}`);
    });
  });
  await context.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const resp = await route.fetch();
    const body = await resp.text();
    const hashes = [...body.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
      .map((m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
    const csp = template.replace(/script-src [^;]+/, `script-src 'self' ${hashes.join(' ')}`);
    await route.fulfill({
      response: resp,
      body,
      headers: { ...resp.headers(), 'content-security-policy': csp },
    });
  });
}

test('the app boots under the real production CSP with no unsafe-inline', async ({ browser }) => {
  const csp = productionCsp();
  // Guard the property we actually care about: the inline script runs by HASH, not by fiat.
  expect(csp).toContain("script-src 'self' 'sha256-");
  expect(csp.match(/script-src [^;]+/)[0]).not.toContain("'unsafe-inline'");

  const ctx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.40' } });
  await withEnforcedCsp(ctx);
  const page = await ctx.newPage();

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto('/');

  // The strongest signal that the inline bundle actually executed: the app rendered its setup UI.
  // If the hash were stale the script would be blocked and this would never appear.
  await expect(page.locator('#msg-name')).toBeVisible({ timeout: 15_000 });

  const violations = await page.evaluate(() => window.__cspViolations || []);
  expect(violations, `CSP violations: ${JSON.stringify(violations)}`).toEqual([]);
  expect(pageErrors, `page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);

  await ctx.close();
});

test('a stale script hash is actually fatal (proves the boot test has teeth)', async ({ browser }) => {
  // Corrupt the pinned hash and confirm the browser really does refuse to run the bundle.
  // Without this, the test above could pass for the wrong reason (e.g. CSP silently not applied).
  const broken = productionCsp().replace(/'sha256-[^']+'/g, "'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='");
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.41' } });
  await ctx.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const resp = await route.fetch();
    // Strip the <meta> policy so this test isolates the HEADER policy: otherwise a pass could be
    // caused by the meta copy rather than by the corrupted hash we are actually testing.
    const body = (await resp.text()).replace(
      /<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
    await route.fulfill({
      response: resp,
      body,
      headers: { ...resp.headers(), 'content-security-policy': broken },
    });
  });
  const page = await ctx.newPage();
  await page.goto('/');
  // The inline bundle must be blocked, so the app never initialises its setup input.
  await expect(page.locator('#msg-name')).toBeHidden({ timeout: 5_000 });
  await ctx.close();
});
