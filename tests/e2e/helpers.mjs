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

// Submits the setup form's default create button. Since recovery-plan step 3 that path
// first shows the one-time recovery-phrase dialog (OK stays disabled until "I have saved
// my recovery phrase" is ticked) whenever the browser has X25519 + Ed25519 WebCrypto;
// browsers without them skip straight to the messenger. Handle both, with the passphrase
// left empty (optional by design).
export async function submitSetup(page) {
  await page.locator('#b-msg-setup').click();
  const saved = page.locator('dialog[open] .rp-saved');
  await page.locator('dialog[open] .rp-saved, #msg-main:not(.hidden)').first().waitFor();
  if (await saved.isVisible()) {
    await saved.check();
    await page.locator('dialog[open] button[value="ok"]').click();
  }
}

// Drives the real identity-creation UI and returns the new identity's pubB64 read straight
// from IndexedDB (app internals live inside initMessenger()'s closure — unreachable from
// page.evaluate — but IndexedDB is a standard Web API). Mirrors initMessenger's own open
// (dbName 'breeze-messenger', DB_VER 5) and the 'identity' store's 'keys' record.
// `navigate: false` for callers that already goto'd a deep link (e.g. ?join= URLs), where
// re-navigating to '/' would discard the token.
export async function createIdentity(page, name, { navigate = true, alias = '' } = {}) {
  await seedConsent(page);
  if (navigate) await page.goto('/');
  await page.locator('#msg-name').fill(name);
  // Optional @alias typed into the setup form: identity creation claims it
  // through the real client path (bundle upload first, then the signed +
  // PoW alias claim — recovery-plan step 5), so specs get a genuinely
  // registered handle without touching the Worker API directly.
  if (alias) await page.locator('#msg-alias').fill(alias);
  await submitSetup(page);
  await expect(page.locator('#msg-main')).toBeVisible(alias ? { timeout: 60_000 } : {});
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

// Every stored message, with its body opened. Since D23 (C9) the 'messages' store holds
// bodies sealed at rest ({ text: '', enc: { v, iv, ct } }) under the 'msgkey' keywrap slot
// — a plaintext JWK while app-lock is off, which is how every spec runs — so reading
// `rec.text` straight off IndexedDB sees '' for every message the app wrote. This mirrors
// _msgOpenRecord (AES-GCM, AAD 'breeze-msgstore-v1:<msgId>'); legacy plaintext rows pass
// through unchanged, exactly as the app treats them.
export function readMessages(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const req = indexedDB.open('breeze-messenger', 5);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction(['messages', 'identity'], 'readonly');
      const all = tx.objectStore('messages').getAll();
      const keyReq = tx.objectStore('identity').get('msgkey');
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = async () => {
        try {
          const jwk = keyReq.result?.priv;
          const key = jwk ? await crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, false, ['decrypt']) : null;
          resolve(await Promise.all((all.result || []).map(async (rec) => {
            if (!rec.enc || !key) return rec;
            const pt = await crypto.subtle.decrypt(
              { name: 'AES-GCM', iv: unb64(rec.enc.iv), additionalData: new TextEncoder().encode('breeze-msgstore-v1:' + rec.msgId) },
              key, unb64(rec.enc.ct));
            return { ...rec, text: new TextDecoder().decode(pt) };
          })));
        } catch (e) { reject(e); }
      };
    };
  }));
}
