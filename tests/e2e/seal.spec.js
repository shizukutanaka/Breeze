// Sealed Sender v2 E2E — wiretap test.
//
// The relay stores every /api/sealed/send envelope verbatim, so whatever appears in that
// request body IS what a curious relay operator reads. Before v2 the body carried the
// sender's id, full public key and display name in cleartext ("sealed" only against a relay
// that chose not to parse). This spec plays the wiretap: it captures every sealed-send body
// from a real browser exchange and asserts the sender is cryptographically absent — while
// the messages still deliver.
import { test, expect } from '@playwright/test';

const ip = (n) => ({ extraHTTPHeaders: { 'CF-Connecting-IP': `203.0.113.${n}` } });

async function createIdentity(page, name) {
  await page.goto('/');
  await page.locator('#msg-name').fill(name);
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('identity', 'readonly');
      const getReq = tx.objectStore('identity').get('keys');
      getReq.onsuccess = () => resolve(getReq.result?.pubB64);
      getReq.onerror = () => reject(getReq.error);
    };
  }));
}

async function addAndOpen(page, pubB64) {
  await page.locator('#b-msg-add').click();
  const dialog = page.locator('dialog[aria-labelledby]');
  await dialog.locator('.modal-input').fill(pubB64);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();
  const contact = page.locator('#msg-contacts .contact').first();
  await expect(contact).toBeVisible();
  await contact.click();
  await expect(page.locator('#msg-input-bar')).toBeVisible();
}

test('the relay never sees who sent a message (sealed-v2 wiretap)', async ({ browser }) => {
  const ctx1 = await browser.newContext(ip(90));
  const ctx2 = await browser.newContext(ip(91));
  const P = await ctx1.newPage(), Q = await ctx2.newPage();

  // The wiretap: every sealed envelope either browser hands the relay.
  const sealedBodies = [];
  for (const page of [P, Q]) {
    page.on('request', (r) => {
      if (r.url().includes('/api/sealed/send')) sealedBodies.push(r.postData() || '');
    });
  }

  const pubP = await createIdentity(P, 'Wiretap-Sender');
  const pubQ = await createIdentity(Q, 'Wiretap-Receiver');
  await addAndOpen(P, pubQ);
  await addAndOpen(Q, pubP);

  // P → Q, then Q → P (both directions must seal from the very first message).
  const msg1 = 'over the wire one ' + Date.now();
  await P.locator('#msg-input').fill(msg1);
  await P.locator('#b-msg-send').click();
  await expect(Q.locator('#msg-messages')).toContainText(msg1, { timeout: 15_000 });
  const msg2 = 'over the wire two ' + Date.now();
  await Q.locator('#msg-input').fill(msg2);
  await Q.locator('#b-msg-send').click();
  await expect(P.locator('#msg-messages')).toContainText(msg2, { timeout: 15_000 });

  // Delivery worked and at least two sealed envelopes crossed the wire...
  expect(sealedBodies.length).toBeGreaterThanOrEqual(2);
  // The identity keys as the raw byte-array text they would appear as inside a JSON payload —
  // this is exactly how the X3DH bootstrap header used to expose the sender on first contact.
  const rawBytes = (pub) => Array.from(atob(pub), (c) => c.charCodeAt(0)).join(',');
  for (const body of sealedBodies) {
    const parsed = JSON.parse(body);
    const env = JSON.parse(parsed.envelope);
    // ...every one of them v2-sealed...
    expect(env.sv).toBe(2);
    expect(env.se?.ct?.length).toBeGreaterThan(0);
    // ...none carrying sender fields at the envelope level...
    for (const field of ['from', 'fromPub', 'fromName', 'sig', 'sigPub']) {
      expect(env[field]).toBeUndefined();
    }
    // ...no sender name or pub anywhere in the wire bytes (base64 or raw-byte-array form —
    // the latter is how the pkm bootstrap header leaked the identity key, wiretap-found)...
    for (const leak of [pubP, pubQ, rawBytes(pubP), rawBytes(pubQ), 'Wiretap-Sender', 'Wiretap-Receiver']) {
      expect(body).not.toContain(leak);
    }
    // ...and the sender id (pub prefix) appears nowhere outside the routing "to".
    const outside = JSON.stringify({ ...env, to: '' });
    for (const id of [pubP.slice(0, 12), pubQ.slice(0, 12)]) {
      expect(outside).not.toContain(id);
    }
  }
  await ctx1.close(); await ctx2.close();
});
