import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { buildRelayEnv, createRelayServer } from '../../server/node-host.js';
import { createIdentity, openAddContact, enableDirectConnections } from './helpers.mjs';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

async function addAndOpen(page, pub) {
  await openAddContact(page);
  const dialog = page.locator('dialog[open] .add-form-contact');
  await dialog.locator('.modal-input').fill(pub);
  await dialog.locator('button.btn-g').click();
  await expect(dialog).toBeHidden();
  await page.locator('#msg-contacts .contact:not(.self-card)').click();
}
const count = page => page.evaluate(() => JSON.parse(localStorage.getItem('brz-p2p-signal') || '{}').postEstablished || 0);

for (const wakeEnabled of [false, true]) {
test(`Node relay ${wakeEnabled ? 'pauses established polls' : 'retains 15s fallback'} for 30s idle after glare`, async ({ browser }) => {
  test.setTimeout(180_000);
  const db = new DatabaseSync(':memory:');
  const env = buildRelayEnv({ db, source: { MAILBOX_WS_ENABLED: String(wakeEnabled) } });
  const server = createRelayServer({ env, trustProxy: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const contexts = [];
  try {
    const pages = [];
    const sockets = [];
    const ephemeralDeposits = [];
    const offers = new Set();
    let releasePolls;
    const offersReady = new Promise(resolve => { releasePolls = resolve; });
    for (const ip of ['203.0.113.41', '203.0.113.42']) {
      const context = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': ip }, serviceWorkers: 'block' });
      await context.grantPermissions(['local-network-access'], { origin: base });
      contexts.push(context);
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__sdpGlare = { collisions: 0, errors: [] };
        const apply = RTCPeerConnection.prototype.setRemoteDescription;
        RTCPeerConnection.prototype.setRemoteDescription = async function(description) {
          if (description.type === 'offer' && this.signalingState === 'have-local-offer') window.__sdpGlare.collisions++;
          try { return await apply.call(this, description); }
          catch(e) { window.__sdpGlare.errors.push(e.message); throw e; }
        };
      });
      // Hold incoming signaling until both clients have deposited local offers,
      // forcing polite glare and exercising the browser's implicit rollback.
      await page.route(base + '/api/signal', async route => {
        const body = route.request().postDataJSON();
        if (body.type === 'typing' || body.type === 'read') ephemeralDeposits.push(body.type);
        if (body.type === 'poll') await offersReady;
        const response = await route.fetch();
        if (body.type === 'offer' && response.ok()) {
          offers.add(body.sender);
          if (offers.size === 2) releasePolls();
        }
        await route.fulfill({ response });
      });
      // The shipped app disables API use on localhost. Apply the same local-only
      // API enablement as server.mjs, retaining hash-pinned scripts.
      await page.route(base + '/', async route => {
        const response = await route.fetch();
        const body = (await response.text()).replace(/^const API = .*$/m, "const API = location.origin + '/api';");
        const hashes = [...body.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
          .map(m => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
        const headers = response.headers();
        headers['content-security-policy'] = headers['content-security-policy'].replace(/script-src [^;]+/, `script-src 'self' ${hashes.join(' ')}`);
        await route.fulfill({ response, body, headers });
      });
      page.on('websocket', socket => { if (socket.url().includes('/mailbox/ws?')) sockets.push(socket); });
      await page.goto(base + '/');
      pages.push(page);
    }
    const [alice, bob] = pages;
    const a = await createIdentity(alice, 'Wake Alice', { navigate: false });
    const b = await createIdentity(bob, 'Wake Bob', { navigate: false });
    for (const page of pages) await enableDirectConnections(page);
    await bob.locator('#b-msg-settings').click();
    await bob.locator('input[data-setting="rr-delay"]').uncheck();
    await bob.locator('#b-settings-back').click();
    await expect(bob.locator('#settings-view')).toBeHidden();
    await addAndOpen(alice, b);
    await addAndOpen(bob, a);
    for (const page of pages) await expect(page.locator('#msg-conv-status')).toContainText('Direct', { timeout: 30_000 });
    expect(sockets).toHaveLength(wakeEnabled ? 2 : 0);
    const glare = await Promise.all(pages.map(page => page.evaluate(() => window.__sdpGlare)));
    expect(glare.reduce((sum, state) => sum + state.collisions, 0)).toBeGreaterThan(0);
    expect(glare.flatMap(state => state.errors)).toEqual([]);
    // Allow the existing mailbox safety cycle to observe the negotiation's
    // final generation before measuring an idle interval (no extra requests).
    await new Promise(resolve => setTimeout(resolve, 35_000));
    const before = await Promise.all(pages.map(count));
    await new Promise(resolve => setTimeout(resolve, 30_000));
    const after = await Promise.all(pages.map(count));
    const delta = after.map((value, i) => value - before[i]);
    expect(delta).toEqual(wakeEnabled ? [0, 0] : [2, 2]);
    console.log(`signal-wake=${wakeEnabled} idle 30s: ${JSON.stringify(before)} -> ${JSON.stringify(after)}; delta ${JSON.stringify(delta)}`);
    const depositsBefore = ephemeralDeposits.length;
    const text = 'message after signal-poll pause';
    const directAcks = await alice.evaluate(() => JSON.parse(localStorage.getItem('brz-p2p-direct') || '{}').directAck || 0);
    await alice.locator('#msg-input').fill(text);
    await expect(bob.locator('#typing-indicator')).toHaveClass(/active/);
    await alice.locator('#b-msg-send').click();
    await expect(bob.locator('#msg-messages')).toContainText(text, { timeout: 10_000 });
    await expect(alice.locator('#msg-conv-status')).toContainText('Direct');
    await expect.poll(() => alice.evaluate(() => JSON.parse(localStorage.getItem('brz-p2p-direct') || '{}').directAck || 0)).toBe(directAcks + 1);
    const sentStatus = alice.locator('.msg.me').filter({ hasText: text }).locator('.msg-status');
    await expect(sentStatus).not.toHaveClass(/read/);
    await bob.locator('#msg-contacts .contact:not(.self-card)').click();
    await expect(sentStatus).toHaveClass(/read/);
    expect(ephemeralDeposits.slice(depositsBefore)).toEqual([]);
    if (wakeEnabled) {
      expect(await Promise.all(pages.map(count))).toEqual(after);
      console.log('typing + read over DC: no signal deposits; post-established counters unchanged');
    }
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});
}
