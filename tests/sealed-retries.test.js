import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { sealMeta, unsealMeta } from '../src/crypto/seal.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const slice = (start, end) => html.slice(html.indexOf(start), html.indexOf(end));
const ORIGIN = 'https://relay.test';
const OTHER = 'https://other.test';
const subtle = crypto.subtle;
const META = { from: 'sender000001', fromPub: 'sender-public-key', fromName: 'Private sender',
  sig: 'author-signature', sigPub: 'signing-public-key', replyTo: { text: 'Private preview' }, selfSync: true, acctRoot: 'account-root' };

async function world({ caps = ['seal-v2'], contact = true } = {}) {
  const key = await subtle.generateKey('X25519', true, ['deriveBits']);
  const pub = btoa(String.fromCharCode(...new Uint8Array(await subtle.exportKey('raw', key.publicKey))));
  const to = pub.slice(0, 12);
  const payload = { to, ts: 1755000000000, ...META,
    payload: JSON.stringify({ t: 'pkm', ik: [11, 22, 33, 44], ct: 'ratchet ciphertext' }) };
  const state = { caps, status: 200, sealed: 200, plain: 200 };
  const stores = { contacts: new Map(contact ? [[to, { id: to, pubB64: pub }]] : []), settings: new Map() };
  const ls = new Map();
  const post = vi.fn(async (path, body, relay = ORIGIN) => {
    if (path === '/prekey/status') return new Response(JSON.stringify({ identityKey: pub, caps: state.caps }), { status: state.status });
    const status = path === '/sealed/send' ? state.sealed : state.plain;
    if (status === 'throw') throw new Error('Offline');
    return new Response(JSON.stringify({ ack: true }), { status });
  });
  const seal = vi.fn((...args) => sealMeta(subtle, ...args));
  let timer;
  const deps = {
    API: ORIGIN + '/api', MS: { MIN: 60000, HOUR: 3600000 }, CONFIG: { SEAL_V2_ENABLED: true },
    CAPS_SEAL_V2: 'seal-v2', _settings: {}, myId: META.from, myPubB64: META.fromPub,
    postAPIRaw: post, _servingRelayUrl: () => ORIGIN, isOriginRelay: e => e.url === ORIGIN,
    _normalizeRelayUrl: url => new URL(url).origin,
    _parsePeerCaps: data => data?.caps || [], sealMeta: seal,
    dbGet: async (store, id) => stores[store]?.get(id),
    dbPut: async (store, value, id) => stores[store].set(id, structuredClone(value)),
    _deviceRevocation: { allowed: async () => null },
    _updateOutboxBadge: vi.fn(), updateMsgStatus: vi.fn(), registerBackgroundSync: vi.fn(),
    _dbg: vi.fn(), _diagBump: vi.fn(), showToast: vi.fn(), announceToSR: vi.fn(), auditLog: vi.fn(), t: s => s,
    setTimeout: fn => { timer = fn; return 1; },
    localStorage: { getItem: id => ls.get(id), removeItem: id => ls.delete(id) },
  };
  const w = new Function(...Object.keys(deps), `
    let _isOffline = false;
    ${slice('const _retryQueue = [];', '// ---- Multi-device (Phase 1) ----')}
    ${slice('const _sealCapsCache = new Map();', '// ONE fan-out')}
    ${slice('// Stage-2 step 6: contacts', 'function scheduleRetry()')}
    ${slice('function scheduleRetry()', '// v3.6: Outbox badge')}
    _contactRelayVerdict = async () => 'ok';
    _contactRelayPost = (entry, path, body) => postAPIRaw(path, body, entry.url);
    return { relaySend, scheduleRetry, _retryQueue, _sealCapsCache, _buildWire, _depositCopy, _loadRetryQueue,
      setOffline: value => { _isOffline = value; } };
  `)(...Object.values(deps));
  return { ...w, ...deps, state, stores, ls, key, pub, to, payload, post, seal,
    retry: async () => { const fn = timer; timer = null; if (fn) await fn(); },
    deposits: () => post.mock.calls.filter(([path]) => path.endsWith('/send')),
    enqueue: item => { w._retryQueue.push(item); w.scheduleRetry(); },
  };
}

function assertSealed(body) {
  const wire = JSON.parse(body.envelope);
  expect(Object.keys(wire).sort()).toEqual(['payload', 'se', 'sv', 'to', 'ts']);
  expect(wire.sv).toBe(2);
  expect(wire.se.ct.length).toBeGreaterThan(0);
  for (const value of [META.from, META.fromPub, META.fromName, META.sig, META.sigPub, META.acctRoot, META.replyTo.text, '11,22,33,44']) {
    expect(JSON.stringify(body)).not.toContain(value);
  }
  expect(JSON.parse(wire.payload).ik).toBeUndefined();
  return wire;
}

describe('deployed sealed sender retries and fallbacks', () => {
  it('does nothing with an empty retry queue', async () => {
    const w = await world();
    w.scheduleRetry(); await w.retry();
    expect(w.post).not.toHaveBeenCalled();
  });

  it('preserves the recipient key offline and seals the retry, including the bootstrap identity', async () => {
    const w = await world({ contact: false });
    w.setOffline(true);
    await w.relaySend(w.to, w.payload, w.pub);
    expect(w.post).not.toHaveBeenCalled();
    expect(w._retryQueue[0].sealPub).toBe(w.pub);
    expect(w.stores.settings.get('retryQueue')[0].sealPub).toBe(w.pub);
    w.setOffline(false);
    await w.retry();
    expect(w._retryQueue).toHaveLength(0);
    const [[path, body]] = w.deposits();
    expect(path).toBe('/sealed/send');
    const wire = assertSealed(body);
    expect(await unsealMeta(subtle, w.key.privateKey, wire.se, w.to, w.payload.ts)).toEqual({ ...META, _pkik: [11, 22, 33, 44] });
  });

  it.each([503, 'throw'])('never downgrades a failed capable send (%s), and retries the same wire', async failure => {
    const w = await world();
    w.state.sealed = failure;
    await w.relaySend(w.to, w.payload, w.pub);
    expect(w._retryQueue).toHaveLength(1);
    const first = w.deposits()[0][1];
    assertSealed(first);
    await w.retry();
    expect(w._retryQueue).toHaveLength(1);
    expect(w.deposits().every(([path]) => path === '/sealed/send')).toBe(true);
    w.state.sealed = 200;
    await w.retry();
    expect(w._retryQueue).toHaveLength(0);
    expect(w.deposits().every(([, body]) => body.envelope === first.envelope)).toBe(true);
  });

  it('keeps a failed seal queued without consuming delivery attempts or sending plaintext', async () => {
    const w = await world();
    w.seal.mockResolvedValue(null);
    await w.relaySend(w.to, w.payload, w.pub);
    for (let i = 0; i < 4; i++) await w.retry();
    expect(w.deposits()).toEqual([]);
    expect(w._retryQueue[0].attempts).toBe(0);
    w.seal.mockImplementation((...args) => sealMeta(subtle, ...args));
    await w.retry();
    expect(w._retryQueue).toHaveLength(0);
    assertSealed(w.deposits()[0][1]);
  });

  it.each([[], undefined])('retains legacy delivery only after a successful legacy capability answer (%s)', async caps => {
    const w = await world(); w.state.caps = caps;
    w.state.sealed = 503;
    await w.relaySend(w.to, w.payload, w.pub);
    expect(w.deposits().map(([path]) => path)).toEqual(['/sealed/send', '/msg/send']);
    expect(w.deposits()[1][1]).toEqual(w.payload);
    w.enqueue({ to: w.to, payload: w.payload, attempts: 0 });
    await w.retry();
    expect(w._retryQueue).toHaveLength(0);
    expect(w.deposits().at(-1)[0]).toBe('/msg/send');
  });

  it.each([404, 429, 503])('queues an unknown peer on capability HTTP %s rather than guessing legacy', async status => {
    const w = await world(); w.state.status = status;
    await w.relaySend(w.to, w.payload, w.pub);
    await w.retry();
    expect(w.deposits()).toEqual([]);
    expect(w._retryQueue[0].attempts).toBe(0);
    w.state.status = 200;
    await w.retry();
    assertSealed(w.deposits()[0][1]);
  });

  it('does not treat a malformed capability answer as legacy', async () => {
    const w = await world(); w.state.caps = 'seal-v2';
    await w.relaySend(w.to, w.payload, w.pub);
    expect(w.deposits()).toEqual([]);
    expect(w._retryQueue).toHaveLength(1);
  });

  it('keeps a known-capable peer sealed after cache expiry and a failed refresh', async () => {
    const w = await world();
    w._sealCapsCache.set(w.to, { ok: true, pub: w.pub, ts: 0 });
    w.state.status = 503;
    w.enqueue({ to: w.to, payload: w.payload, attempts: 0 });
    await w.retry();
    assertSealed(w.deposits()[0][1]);
  });

  it('cannot use an expired negative cache entry to downgrade during an outage', async () => {
    const w = await world();
    w._sealCapsCache.set(w.to, { ok: false, pub: w.pub, ts: 0 });
    w.state.status = 503;
    w.enqueue({ to: w.to, payload: w.payload, attempts: 0 });
    await w.retry();
    expect(w.deposits()).toEqual([]);
    expect(w._retryQueue[0].attempts).toBe(0);
  });

  it('does not downgrade when local sealing is disabled for a capable recipient', async () => {
    const w = await world(); w.CONFIG.SEAL_V2_ENABLED = false;
    await w.relaySend(w.to, w.payload, w.pub);
    await w.retry();
    expect(w.deposits()).toEqual([]);
    expect(w._retryQueue[0].attempts).toBe(0);
  });

  it.each(['malformed JSON', 'wrong identity'])('queues rather than guessing legacy on %s', async kind => {
    const w = await world();
    w.post.mockResolvedValue(new Response(kind === 'malformed JSON' ? '{' : JSON.stringify({ identityKey: 'another-peer', caps: [] })));
    await w.relaySend(w.to, w.payload, w.pub);
    expect(w.deposits()).toEqual([]);
    expect(w._retryQueue).toHaveLength(1);
  });

  it.each(['idb', 'localStorage'])('reseals pre-change ordinary queue entries restored from %s', async source => {
    const w = await world({ contact: false });
    const saved = [{ to: w.to, payload: w.payload, attempts: 2 }];
    if (source === 'idb') w.stores.settings.set('retryQueue', saved);
    else w.ls.set('brz-retry-queue', JSON.stringify(saved));
    await w._loadRetryQueue(); await w.retry();
    expect(w._retryQueue).toHaveLength(0);
    assertSealed(w.deposits()[0][1]);
  });

  it.each(['legacy', 'corrupt'])('reseals %s persisted fan-out wires and owes only unsuccessful relays', async kind => {
    const w = await world();
    w.state.sealed = 503;
    w.enqueue({ to: w.to, payload: w.payload, attempts: 0,
      wire: kind === 'legacy' ? JSON.stringify(w.payload) : '{', relays: [{ url: OTHER, pin: '' }] });
    await w.retry();
    expect(w._retryQueue).toHaveLength(1);
    const first = w.deposits()[0];
    expect(first[2]).toBe(OTHER);
    assertSealed(first[1]);
    expect(w.deposits().every(([path]) => path === '/sealed/send')).toBe(true);
    w.state.sealed = 200;
    await w.retry();
    expect(w._retryQueue).toHaveLength(0);
    expect(w.deposits()[1][1]).toEqual(first[1]);
  });

  it('keeps failed legacy retries queued instead of treating an HTTP error as delivery', async () => {
    const w = await world({ caps: [] });
    w.state.sealed = 503; w.state.plain = 503;
    w.enqueue({ to: w.to, payload: w.payload, attempts: 0 });
    await w.retry();
    expect(w._retryQueue).toHaveLength(1);
  });

  it('uses the same sealed wire on a capable peer alternate-home fallback', async () => {
    const w = await world();
    w.stores.contacts.get(w.to).home = [{ url: ORIGIN, pin: '' }, { url: OTHER, pin: '' }];
    w.post.mockImplementation(async (path, body, relay = ORIGIN) => {
      if (path === '/prekey/status') return new Response(JSON.stringify({ identityKey: w.pub, caps: ['seal-v2'] }));
      return new Response(JSON.stringify({ ack: true }), { status: relay === ORIGIN ? 503 : 200 });
    });
    await w.relaySend(w.to, w.payload, w.pub);
    const posts = w.deposits();
    expect(posts.map(([path]) => path)).toEqual(['/sealed/send', '/sealed/send']);
    expect(posts[1][2]).toBe(OTHER);
    expect(posts[1][1]).toEqual(posts[0][1]);
    assertSealed(posts[1][1]);
    expect(w._retryQueue).toHaveLength(0);
  });
});
