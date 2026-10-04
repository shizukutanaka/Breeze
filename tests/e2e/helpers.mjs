// Shared E2E helpers. `createIdentity` used to be copy-pasted into 11 spec files, and the
// copies had drifted: some seeded the consent banner, some didn't; some rejected on
// IndexedDB errors, some swallowed them. This is the canonical version.
import { expect } from '@playwright/test';

// Pre-accept the consent banner (it renders bottom-fixed and intercepts clicks on elements
// the specs drive — consent UX itself is covered by account.spec, not every spec's setup).
// Seeding is a no-op for specs that never hit the banner.
export function seedConsent(page) {
  return page.addInitScript(() => {
    try { localStorage.setItem('brz-consent', String(Date.now())); } catch {}
  });
}

// Drives the real identity-creation UI and returns the new identity's pubB64 read straight
// from IndexedDB (app internals live inside initMessenger()'s closure — unreachable from
// page.evaluate — but IndexedDB is a standard Web API). Mirrors initMessenger's own open
// (dbName 'breeze-messenger', DB_VER 5) and the 'identity' store's 'keys' record.
// `navigate: false` for callers that already goto'd a deep link (e.g. ?join= URLs), where
// re-navigating to '/' would discard the token.
export async function createIdentity(page, name, { navigate = true } = {}) {
  await seedConsent(page);
  if (navigate) await page.goto('/');
  await page.locator('#msg-name').fill(name);
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const getReq = req.result.transaction('identity', 'readonly')
        .objectStore('identity').get('keys');
      getReq.onsuccess = () => resolve(getReq.result?.pubB64);
      getReq.onerror = () => reject(getReq.error);
    };
  }));
}
