import { test, expect } from '@playwright/test';
import { createIdentity, enableDirectConnections } from './helpers.mjs';
import jsQR from 'jsqr';

const readContact = (page, peer) => page.evaluate(peer => new Promise((resolve, reject) => {
  const req = indexedDB.open('breeze-messenger');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const db = req.result, tx = db.transaction(['identity', 'contacts'], 'readonly');
    const contact = tx.objectStore('contacts').get(peer.slice(0, 12));
    const session = tx.objectStore('identity').get('sess:' + peer.slice(0, 12));
    tx.oncomplete = () => { resolve({ contact: contact.result, session: !!session.result, pq: !!session.result?.pq }); db.close(); };
  };
}), peer);
const direct = page => page.evaluate(() => JSON.parse(localStorage.getItem('brz-p2p-direct') || '{}').directAck || 0);
async function send(from, to, text) {
  const before = await direct(from);
  await from.locator('#msg-input').fill(text); await from.locator('#b-msg-send').click();
  await expect(to.locator('#msg-messages')).toContainText(text);
  await expect.poll(() => direct(from)).toBe(before + 1);
}
async function decodeInvite(page) {
  const code = await page.locator('[data-op="output"]').inputValue();
  const data = await page.locator('[data-op="qr"] canvas').evaluate(c => ({ w: c.width, h: c.height, pixels: Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data) }));
  expect(jsQR(new Uint8ClampedArray(data.pixels), data.w, data.h)?.data).toBe(code);
  return code;
}

for (const blockedStun of [false, true]) test(`fresh contacts pair, confirm and exchange direct messages with all API access blocked before identity creation${blockedStun ? ' and unreachable STUN' : ''}`, async ({ browser }) => {
  test.setTimeout(240000);
  const contexts = [], pages = [], successes = [], signals = [];
  try {
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext({ serviceWorkers: 'block', extraHTTPHeaders: { 'CF-Connecting-IP': `203.0.113.${191 + i}` } });
      await context.grantPermissions(['local-network-access'], { origin: `http://127.0.0.1:${process.env.E2E_PORT || 8787}` });
      contexts.push(context);
      await context.addInitScript(blockedStun => {
        const Native = window.RTCPeerConnection;
        window.__iceTrace = []; window.__icePeers = [];
        window.RTCPeerConnection = class extends Native {
          constructor(config) {
            if (blockedStun) config = { ...config, iceServers: [{ urls: 'stun:192.0.2.1:3478' }] };
            super(config);
            const pc = window.__icePeers.push(this) - 1;
            const types = () => (this.localDescription?.sdp.match(/ typ (\w+)/g) || []).map(s => s.slice(5));
            const record = (event, detail = {}) => window.__iceTrace.push({ pc, ms: Math.round(performance.now()), event, state: this.iceGatheringState, types: types(), ...detail });
            record('created', { servers: config.iceServers.map(s => s.urls), pool: config.iceCandidatePoolSize });
            this.addEventListener('icegatheringstatechange', () => record('gathering'));
            this.addEventListener('icecandidate', e => record('candidate', { candidateType: e.candidate?.type || null }));
            this.addEventListener('icecandidateerror', e => record('candidate-error', { url: e.url, code: e.errorCode, text: e.errorText }));
            const apply = this.setLocalDescription;
            this.setLocalDescription = async (...args) => { record('set-local'); const r = await apply.apply(this, args); record('local-set', { kind: this.localDescription.type }); return r; };
          }
        };
      }, blockedStun);
      const page = await context.newPage(); pages.push(page);
      page.on('response', r => { if (r.url().includes('/api/') && r.ok()) successes.push(r.url()); });
      await context.route('**/api/**', async route => { if (new URL(route.request().url()).pathname === '/api/signal') signals.push(route.request().postData()); await route.abort('failed'); });
      await page.goto('/');
    }
    const [a, b] = pages;
    const ap = await createIdentity(a, 'Offline Alice', { navigate: false }), bp = await createIdentity(b, 'Offline Bob', { navigate: false });
    for (const page of pages) {
      await enableDirectConnections(page);
      await page.locator('#contact-filter').fill('/offlinepair'); await page.locator('#contact-filter').press('Enter');
      await expect(page.locator('[data-op="output"]')).toHaveValue(/^breeze-inv1z:/);
      await expect(page.locator('[data-op="confirm"]')).toBeDisabled();
    }
    const ac = await decodeInvite(a), bc = await decodeInvite(b);
    for (const [page, code, peer] of [[a, bc, bp], [b, ac, ap]]) {
      await page.locator('[data-op="input"]').fill(code); await page.locator('[data-op="import"]').click();
      await expect(page.locator('[data-op="fingerprint"]')).toHaveText(/^(\d{5} ){5}\d{5}$/);
      expect((await readContact(page, peer)).contact).toBeUndefined();
      await expect(page.locator('[data-op="confirm"]')).toBeDisabled();
    }
    expect(await a.locator('[data-op="fingerprint"]').textContent()).toBe(await b.locator('[data-op="fingerprint"]').textContent());
    for (const [page, peer] of [[a, bp], [b, ap]]) {
      await page.locator('[data-op="matches"]').check(); await page.locator('[data-op="confirm"]').click();
      await expect(page.locator('[data-op="status"]')).toContainText('Contact verified');
      const state = await readContact(page, peer);
      expect(state.session).toBe(false); expect(state.contact.offlinePairing.state).toBe('pending'); expect(state.contact.offlineVerified).toBe(true);
      await page.locator('[data-op="close"]').click();
      await page.locator('#msg-contacts .contact:not(.self-card)').click();
      await page.locator('#msg-input').fill('/rendezvous'); await page.locator('#msg-input').press('Enter');
      await expect(page.locator('.rendezvous-dialog')).toBeVisible();
    }
    await a.locator('[data-rv="offer"]').click();
    await expect(a.locator('[data-rv="output"]')).toHaveValue(/^breeze-sdp1z:/, { timeout: 65000 });
    if (blockedStun) {
      expect(await a.evaluate(() => window.__icePeers.at(-1).getConfiguration().iceCandidatePoolSize)).toBe(0);
      expect(await a.evaluate(() => window.__icePeers.at(-1).iceGatheringState)).toBe('gathering');
    }
    const offer = await a.locator('[data-rv="output"]').inputValue();
    await b.locator('[data-rv="input"]').fill(offer); await b.locator('[data-rv="apply"]').click();
    await expect(b.locator('[data-rv="output"]')).toHaveValue(/^breeze-sdp1z:/, { timeout: 65000 });
    await a.locator('[data-rv="input"]').fill(await b.locator('[data-rv="output"]').inputValue()); await a.locator('[data-rv="apply"]').click();
    for (const [page, peer] of [[a, bp], [b, ap]]) {
      await expect.poll(async () => (await readContact(page, peer)).contact?.offlinePairing.state, { timeout: 30000 }).toBe('paired');
      expect((await readContact(page, peer)).pq).toBe(true);
      await page.locator('[data-rv="close"]').click();
      await expect(page.locator('#msg-conv-status')).toContainText('Direct');
    }
    await send(a, b, 'New offline contact: hello'); await send(b, a, 'New offline contact: reply');
    expect(signals).toEqual([]); expect(successes).toEqual([]);
    console.log('offline before identity setup: mutual fingerprint confirmation + PQXDH + bidirectional DC/direct ACK; zero signal requests and successful relay responses');
  } finally {
    for (const [i, page] of pages.entries()) {
      console.log('offline ICE ' + i + ': ' + JSON.stringify(await page.evaluate(() => window.__iceTrace)));
    }
    for (const context of contexts) await context.close();
  }
});
