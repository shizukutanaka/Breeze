// SHARE_PLAN stage 6 step 2 — home-relay discovery, generalized.
// Two users whose ONLY relays are different custom relays must be
// able to start a conversation with no invite link and no default
// relay in the path. The pieces: an @alias@relay address resolves
// the alias on the owner's relay; alias records publish the owner's
// home list; every direct envelope from a multi-relay account
// asserts its homes (sealed for v2 peers) and the recipient merges
// them into the contact's stored home for reply deposits.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseContactAddress } from '../src/app/address.js';
import { handleAliasSet, handleAliasGet, handleMsgSend, handleMsgPoll } from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

async function solvePoW(pub, difficulty = 8) {
  const ch = `${pub}:breeze-test`;
  const target = (2 ** (32 - difficulty)) >>> 0;
  for (let nonce = 0; nonce < 10_000_000; nonce++) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ch}:${nonce}`));
    if (new DataView(d).getUint32(0, false) < target) return { challenge: ch, nonce, difficulty };
  }
  throw new Error('PoW unsolved');
}

describe('address parsing', () => {
  it('parses @alias@relay and bare alias@relay', () => {
    expect(parseContactAddress('@alice@relay.example.com')).toEqual({ alias: 'alice', relayUrl: 'https://relay.example.com' });
    expect(parseContactAddress('bob_9@r2.example.org:8443')).toEqual({ alias: 'bob_9', relayUrl: 'https://r2.example.org:8443' });
  });

  it('rejects plain aliases, raw keys and malformed hosts', () => {
    expect(parseContactAddress('@alice')).toBeNull();
    expect(parseContactAddress('alice')).toBeNull();
    expect(parseContactAddress('@al@relay.example.com')).toBeNull();
    expect(parseContactAddress('@alice@relay..example.com')).toBeNull();
    expect(parseContactAddress('@alice@')).toBeNull();
    expect(parseContactAddress('aGVsbG8td29ybGQtdGhpcyBpcw==')).toBeNull();
    expect(parseContactAddress(42)).toBeNull();
  });
});

describe('worker: alias records publish home relays', () => {
  it('stores the sanitized list and returns it from get', async () => {
    const env = makeEnv({ ALIAS_REQUIRE_AUTH: 'false' });
    const pub = 'c'.repeat(44);
    const res = await handleAliasSet({ alias: 'carol', pub, name: 'Carol', pow: await solvePoW(pub), relays: [
      { url: 'javascript:alert(1)' },
      { url: 'https://ok.example', pin: 'x'.repeat(500) },
      'junk',
      { url: 'https://ok.example' },
    ] }, env, apiRequest('/api/alias/set', {}));
    expect(res.status).toBe(200);
    const got = await handleAliasGet({ alias: 'carol' }, env, apiRequest('/api/alias/get', {}));
    const data = await got.json();
    expect(data.pub).toBe(pub);
    expect(data.relays).toEqual([{ url: 'https://ok.example', pin: 'x'.repeat(128) }]);
  });

  it('a registration without relays stores none (old clients unaffected)', async () => {
    const env = makeEnv({ ALIAS_REQUIRE_AUTH: 'false' });
    const pub = 'd'.repeat(44);
    await handleAliasSet({ alias: 'dave', pub, name: 'Dave', pow: await solvePoW(pub) }, env, apiRequest('/api/alias/set', {}));
    const got = await handleAliasGet({ alias: 'dave' }, env, apiRequest('/api/alias/get', {}));
    const data = await got.json();
    expect(data.relays).toBeUndefined();
  });
});

describe('two independent relays, no invite, no default relay', () => {
  it('a full conversation circle crosses only the two custom relays', async () => {
    const envA = makeEnv({ ALIAS_REQUIRE_AUTH: 'false' }); // Alice's relay — shares nothing with B
    const envB = makeEnv({ ALIAS_REQUIRE_AUTH: 'false' }); // Bob's relay
    const alicePub = 'a'.repeat(12) + 'A'.repeat(32);
    const bobPub = 'b'.repeat(12) + 'B'.repeat(32);
    const aliceId = alicePub.slice(0, 12);
    const bobId = bobPub.slice(0, 12);

    // Alice registers her alias on HER relay, publishing her home.
    const set = await handleAliasSet({ alias: 'alice', pub: alicePub, name: 'Alice', pow: await solvePoW(alicePub), relays: [{ url: 'https://relay-a.example' }] }, envA, apiRequest('/api/alias/set', {}));
    expect(set.status).toBe(200);
    // Bob's relay knows nothing about Alice.
    const miss = await handleAliasGet({ alias: 'alice' }, envB, apiRequest('/api/alias/get', {}));
    expect(miss.status).toBe(404);

    // Bob resolves @alice@relay-a.example — the lookup lands on A.
    const got = await handleAliasGet({ alias: 'alice' }, envA, apiRequest('/api/alias/get', {}));
    const record = await got.json();
    expect(record.pub).toBe(alicePub);
    expect(record.relays).toEqual([{ url: 'https://relay-a.example' }]);

    // Bob deposits his first message at A (Alice's home), asserting
    // his own home in the envelope.
    const send1 = await handleMsgSend({ to: aliceId, from: bobId, fromPub: bobPub, fromName: 'Bob', payload: 'ciphertext-one', ts: Date.now(), fromRelays: [{ url: 'https://relay-b.example' }] }, '203.0.113.7', envA, apiRequest('/api/msg/send', {}));
    expect(send1.status).toBe(200);
    const pollA = await handleMsgPoll({ id: aliceId, lastTs: 0 }, envA, apiRequest('/api/msg/poll', {}));
    const inboxA = await pollA.json();
    expect(inboxA.messages).toHaveLength(1);
    expect(inboxA.messages[0].payload).toBe('ciphertext-one');
    expect(inboxA.messages[0].fromRelays).toEqual([{ url: 'https://relay-b.example' }]);

    // Alice replies by depositing at B (learned from the envelope).
    const send2 = await handleMsgSend({ to: bobId, from: aliceId, fromPub: alicePub, fromName: 'Alice', payload: 'ciphertext-two', ts: Date.now(), fromRelays: [{ url: 'https://relay-a.example' }], isLocation: true }, '203.0.113.7', envB, apiRequest('/api/msg/send', {}));
    expect(send2.status).toBe(200);
    const pollB = await handleMsgPoll({ id: bobId, lastTs: 0 }, envB, apiRequest('/api/msg/poll', {}));
    const inboxB = await pollB.json();
    expect(inboxB.messages).toHaveLength(1);
    expect(inboxB.messages[0].payload).toBe('ciphertext-two');
    expect(inboxB.messages[0].fromRelays).toEqual([{ url: 'https://relay-a.example' }]);
    // Stage-5 flags survive the plain path too.
    expect(inboxB.messages[0].isLocation).toBe(true);
  });
});

describe('stage 6 step 2 client wiring', () => {
  it('alias registrations publish the home list', () => {
    expect(html).toContain('function _myHomeWire()');
    expect(html.split('relays: _myHomeWire()').length - 1).toBe(2);
  });

  it('direct envelopes assert homes only for multi-relay accounts', () => {
    expect(html).toContain('payload = { ...payload, fromRelays: _myHomeWire() };');
    expect(html).toContain("Array.isArray(_settings.relays) && _settings.relays.length");
  });

  it('received homes merge into the contact record, sanitized', () => {
    expect(html).toContain('const learned = sanitizeHomeList(msg.fromRelays);');
    expect(html).toContain('c.home = merged; await dbPut(\'contacts\', c);');
  });

  it('the address form resolves on the named relay and adopts its list', () => {
    expect(html).toContain('globalThis.__breezeAddress?.parseContactAddress(input)');
    expect(html).toContain("postAPIRelay({ url: addr.relayUrl, pin: '' }, '/alias/get', { alias: addr.alias })");
    expect(html).toContain("from './src/app/address.js';");
    expect(sw).toContain("'/src/app/address.js'");
  });
});
