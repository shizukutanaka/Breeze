import { test, expect } from '@playwright/test';
import { createIdentity, seedConsent } from './helpers.mjs';

test('a restored identity alerts an existing device persistently, with review and acknowledgement', async ({ browser }) => {
  const first = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.201' } });
  const restored = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.202' } });
  const A = await first.newPage(), B = await restored.newPage();
  const errors = []; A.on('pageerror', e => errors.push(e.message)); B.on('pageerror', e => errors.push(e.message));
  await createIdentity(A, 'Existing device');
  await expect.poll(() => A.evaluate(() => localStorage.getItem('brz-installation-v1'))).not.toBeNull();
  const snapshot = await A.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction('identity'), values = tx.objectStore('identity').getAll(), keys = tx.objectStore('identity').getAllKeys();
      tx.oncomplete = () => { db.close(); resolve({ values: values.result, keys: keys.result }); };
    };
  }));
  await seedConsent(B); await B.goto('/'); await expect(B.locator('#msg-setup')).toBeVisible();
  await B.evaluate(snapshot => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction('identity', 'readwrite'), store = tx.objectStore('identity');
      store.clear(); snapshot.values.forEach((value, i) => store.put(value, snapshot.keys[i]));
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error);
    };
  }), snapshot);
  const announced = B.waitForResponse(r => r.url().endsWith('/api/account/activity') && !!r.request().postDataJSON()?.event && r.status() === 200);
  await B.reload(); await announced;
  await expect(B.locator('#msg-main')).toBeVisible();
  await A.reload();
  const banner = A.locator('[data-device-alert]');
  await expect(banner).toContainText('Another installation used this identity');
  await A.reload(); await expect(banner).toContainText('Another installation used this identity');
  await expect(A.locator('#msg-input-bar')).toBeInViewport();
  await A.screenshot({ path: '/Users/devin/new-device-alert.png', fullPage: true });
  await banner.getByRole('button', { name: 'Review devices' }).click();
  const modal = A.locator('.overlay.overlay-dark .modal');
  await expect(modal).toContainText('Account devices'); await expect(modal).toContainText('cannot be remotely revoked');
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
  await banner.getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(banner).toHaveCount(0);
  await A.reload(); await expect(A.locator('#msg-main')).toBeVisible();
  await expect(banner).toHaveCount(0);
  const linked = await A.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('breeze-messenger'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const get = key => new Promise(resolve => { db.transaction('identity').objectStore('identity').get(key).onsuccess = e => resolve(e.target.result); });
    const keys = await get('keys'), signing = await get('signing'); db.close();
    const pub = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const devices = [{ pub: keys.pubB64, name: 'primary' }, { pub, name: '' }], ts = Date.now(), accountId = keys.pubB64.slice(0, 12);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(devices.map(d => d.pub)))))).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
    const privateKey = await crypto.subtle.importKey('jwk', signing.priv, 'Ed25519', false, ['sign']);
    const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(`breeze-device-set:${accountId}:${ts}:${digest}`)))));
    const response = await fetch('/api/device/set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, root: keys.pubB64, devices, ts, sig }) });
    if (!response.ok) throw Error('registry write: ' + response.status);
    return { pub, root: keys.pubB64, accountId };
  });
  await A.reload(); await expect(banner).toContainText('Previously unseen linked device');
  await banner.getByRole('button', { name: 'Review devices' }).click();
  await modal.getByRole('button', { name: 'Unlink ' + linked.pub.slice(0, 12), exact: true }).click();
  const revoked = A.waitForResponse(r => r.url().endsWith('/api/device/set') && r.status() === 200);
  await A.locator('dialog[open] button[value="ok"]').click(); await revoked;
  const list = await (await A.request.post('/api/device/list', { data: { accountId: linked.accountId } })).json();
  expect(list.devices.map(d => d.pub)).toEqual([linked.root]);
  expect(errors).toEqual([]);
  await first.close(); await restored.close();
});
