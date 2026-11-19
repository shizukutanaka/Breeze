import { test, expect } from '@playwright/test';
import { createIdentity } from './helpers.mjs';

async function addAndOpen(page, pub) {
  await page.locator('#b-msg-add').click();
  const dialog = page.locator('dialog[aria-labelledby]');
  await dialog.locator('.modal-input').fill(pub);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();
  await page.locator('#msg-contacts .contact').click();
}
const directAcks = page => page.evaluate(() => JSON.parse(localStorage.getItem('brz-p2p-direct') || '{}').directAck || 0);
async function sendDirect(from, to, text) {
  const before = await directAcks(from);
  await from.locator('#msg-input').fill(text);
  const started = Date.now();
  await from.locator('#b-msg-send').click();
  await expect(to.locator('#msg-messages')).toContainText(text, { timeout: 10_000 });
  await expect.poll(() => directAcks(from), { timeout: 10_000 }).toBe(before + 1);
  expect(Date.now() - started).toBeLessThan(10_000);
}
async function trustedSession(page, peer) {
  return page.evaluate(peer => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction(['identity', 'contacts'], 'readonly');
      const sess = tx.objectStore('identity').get('sess:' + peer.slice(0, 12));
      const contact = tx.objectStore('contacts').get(peer.slice(0, 12));
      tx.oncomplete = () => { resolve(!!sess.result && !!contact.result?.sigPub); db.close(); };
    };
  }), peer);
}

for (const failure of ['abort', 'timeout']) {
  test(`manual SDP opens and delivers with every relay API ${failure}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const contexts = [], pages = [], blocked = [], signalRequests = [], successes = [], timedOut = [];
    const base = `http://127.0.0.1:${process.env.E2E_PORT || 8787}`;
    try {
      for (const n of [181, 182]) {
        const context = await browser.newContext({ serviceWorkers: 'block', extraHTTPHeaders: { 'CF-Connecting-IP': `203.0.113.${n + (failure === 'timeout' ? 2 : 0)}` } });
        await context.grantPermissions(['local-network-access'], { origin: base });
        contexts.push(context);
        const page = await context.newPage();
        await page.goto(base);
        pages.push(page);
      }
      const [alice, bob] = pages;
      const a = await createIdentity(alice, 'Manual Alice', { navigate: false });
      const b = await createIdentity(bob, 'Manual Bob', { navigate: false });
      await addAndOpen(alice, b); await addAndOpen(bob, a);
      for (const page of pages) await expect(page.locator('#msg-conv-status')).toContainText('Direct', { timeout: 30_000 });
      await sendDirect(alice, bob, 'normal session setup A');
      await sendDirect(bob, alice, 'normal session setup B');
      expect(await trustedSession(alice, b)).toBe(true); expect(await trustedSession(bob, a)).toBe(true);
      // Opening the separate manual ceremony tears down the old PC and its
      // signaling scheduler before relay access is blocked. No offer yet.
      for (const page of pages) {
        await page.locator('#msg-input').fill('/rendezvous');
        await page.locator('#msg-input').press('Enter');
        await expect(page.locator('.rendezvous-dialog')).toBeVisible();
      }
      for (const page of pages) {
        page.on('response', response => { if (new URL(response.url()).pathname.startsWith('/api/') && response.ok()) successes.push(response.url()); });
        page.on('requestfailed', request => { if (new URL(request.url()).pathname.startsWith('/api/')) timedOut.push(request.url()); });
        await page.route('**/api/**', async route => {
          blocked.push(route.request().url());
          if (new URL(route.request().url()).pathname === '/api/signal') signalRequests.push(route.request().postData());
          if (failure === 'abort') await route.abort('failed');
          // A deliberately unresolved route: the deployed fetchT's own
          // AbortSignal.timeout must end the fetch, not a synthetic 504.
        });
      }
      await alice.locator('[data-rv="offer"]').click();
      await expect(alice.locator('[data-rv="output"]')).toHaveValue(/^breeze-sdp1:/, { timeout: 65_000 });
      const offer = await alice.locator('[data-rv="output"]').inputValue();
      await bob.locator('[data-rv="paste"]').click();
      await bob.locator('[data-rv="input"]').fill(offer);
      await bob.locator('[data-rv="apply"]').click();
      await expect(bob.locator('[data-rv="output"]')).toHaveValue(/^breeze-sdp1:/, { timeout: 65_000 });
      const answer = await bob.locator('[data-rv="output"]').inputValue();
      await alice.locator('[data-rv="input"]').fill(answer);
      await alice.locator('[data-rv="apply"]').click();
      for (const page of pages) {
        await expect(page.locator('#msg-conv-status')).toContainText('Direct', { timeout: 20_000 });
        await page.locator('[data-rv="close"]').click();
      }
      await sendDirect(alice, bob, `manual ${failure} A to B`);
      await sendDirect(bob, alice, `manual ${failure} B to A`);
      expect(blocked.filter(url => url.endsWith('/api/abuse/record')).length).toBeGreaterThanOrEqual(2);
      if (failure === 'timeout') {
        await expect.poll(() => timedOut.filter(url => url.endsWith('/api/abuse/record')).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
      }
      expect(signalRequests).toEqual([]); expect(successes).toEqual([]);
      console.log(`manual ${failure}: bidirectional DC direct ACK; zero signal requests / successful relay responses; blocked ${blocked.length} auxiliary/background attempts`);
    } finally { for (const context of contexts) await context.close(); }
  });
}
