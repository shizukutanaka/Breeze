// ============================================================================
// C9 / D23 — message-store encryption at rest.
//
// Pins four things:
//   1. The reference module (src/crypto/msgstore.js): seal/open round-trip,
//      wrong-key and tamper NEGATIVE controls, msgId (AAD) relocation
//      resistance, legacy plaintext passthrough.
//   2. The inline mirror in index.html: wire parity with the reference in
//      both directions (the mirror-drift doctrine), plus the documented
//      divergence — a failed inline open keeps the sealed record with an
//      empty body instead of yielding plaintext or destroying the row.
//   3. The key hierarchy: the store key is an ordinary I4 keywrap slot
//      ('msgkey'), so an AES key JWK wrapped by atrest under that slot
//      context unwraps, and fails under any other context.
//   4. The wiring: dbPut seals messages, _keywrapSlots carries 'msgkey',
//      loadIdentity/createIdentity initialise the key, history collection
//      reads through the opening read helper, and _msgOpenAll hands legacy
//      records to the migration callback exactly once.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createMsgStore } from '../src/crypto/msgstore.js';
import { createAtRest } from '../src/crypto/atrest.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

const store = createMsgStore();
const newKey = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
const REC = { msgId: 'me:1700000000000:1', contactId: 'c1', text: 'secret body — 秘密の本文', mine: true, ts: 1700000000000 };

describe('msgstore reference (src/crypto/msgstore.js)', () => {
  it('round-trips: seal hides the body, open restores it and every other field', async () => {
    const key = await newKey();
    const sealed = await store.sealRecord(key, REC);
    expect(sealed.text).toBe('');
    expect(sealed.enc.v).toBe(1);
    expect(JSON.stringify(sealed)).not.toContain('secret body');
    expect(sealed.contactId).toBe('c1');
    expect(sealed.mine).toBe(true);
    const opened = await store.openRecord(key, sealed);
    expect(opened).toEqual(REC);
    expect(opened.enc).toBeUndefined();
  });

  it('does not mutate the input record', async () => {
    const key = await newKey();
    const rec = { ...REC };
    await store.sealRecord(key, rec);
    expect(rec).toEqual(REC);
  });

  it('NEGATIVE: a different key cannot open a sealed record', async () => {
    const sealed = await store.sealRecord(await newKey(), REC);
    expect(await store.openRecord(await newKey(), sealed)).toBeNull();
  });

  it('NEGATIVE: tampered ciphertext does not open', async () => {
    const key = await newKey();
    const sealed = await store.sealRecord(key, REC);
    const ct = sealed.enc.ct;
    const tampered = { ...sealed, enc: { ...sealed.enc, ct: (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1) } };
    expect(await store.openRecord(key, tampered)).toBeNull();
  });

  it('NEGATIVE: ciphertext relocated to another msgId does not open (AAD binding)', async () => {
    const key = await newKey();
    const sealed = await store.sealRecord(key, REC);
    expect(await store.openRecord(key, { ...sealed, msgId: 'me:1700000000000:2' })).toBeNull();
  });

  it('legacy plaintext passes through both ways; empty/absent text is never sealed', async () => {
    const key = await newKey();
    expect(await store.openRecord(key, REC)).toEqual(REC);
    expect(await store.sealRecord(key, { ...REC, text: '' })).toEqual({ ...REC, text: '' });
    const sealed = await store.sealRecord(key, REC);
    expect(await store.sealRecord(key, sealed)).toBe(sealed); // idempotent
    const noId = { contactId: 'c1', text: 'x' };
    expect(await store.sealRecord(key, noId)).toBe(noId);
  });

  it('fresh IV per seal: the same body seals to different ciphertexts', async () => {
    const key = await newKey();
    const a = await store.sealRecord(key, REC);
    const b = await store.sealRecord(key, REC);
    expect(a.enc.iv).not.toBe(b.enc.iv);
    expect(a.enc.ct).not.toBe(b.enc.ct);
  });
});

// --- Inline mirror -----------------------------------------------------------
const s = html.indexOf('const _AT_REST_AAD_DOMAIN');
const e = html.indexOf('\nfunction arr(', s);
if (s < 0 || e < 0) throw new Error('msgstore test: could not locate the inline at-rest/msgstore blocks in index.html');
const inlineFactory = new Function(
  'crypto', 'CONFIG', 'u8', '_dbg',
  html.slice(s, e) +
    '\nreturn { _msgSealRecord, _msgOpenRecord, _msgOpenAll, _msgIsSealed, _MSG_AAD_DOMAIN, setKey: (k) => { _msgStoreKey = k; } };',
);
const inline = inlineFactory(globalThis.crypto, { AES_KEY_BITS: 256, IV_BYTES: 12, PBKDF2_AT_REST_ITERATIONS: 1000 }, (a) => new Uint8Array(a), () => {});

describe('msgstore inline mirror (index.html)', () => {
  it('AAD domain matches the reference', () => {
    expect(inline._MSG_AAD_DOMAIN).toBe(store.AAD_DOMAIN);
    expect(store.AAD_DOMAIN).toBe('breeze-msgstore-v1');
  });

  it('WIRE PARITY: reference-sealed opens inline, inline-sealed opens in the reference', async () => {
    const key = await newKey();
    inline.setKey(key);
    const refSealed = await store.sealRecord(key, REC);
    expect(await inline._msgOpenRecord(refSealed)).toEqual(REC);
    const inlineSealed = await inline._msgSealRecord({ ...REC });
    expect(inlineSealed.text).toBe('');
    expect(await store.openRecord(key, inlineSealed)).toEqual(REC);
  });

  it('NEGATIVE (inline): wrong key yields NO plaintext — the sealed record is kept intact', async () => {
    const sealed = await store.sealRecord(await newKey(), REC);
    inline.setKey(await newKey());
    const out = await inline._msgOpenRecord(sealed);
    expect(out.text).toBe('');
    expect(out.enc).toEqual(sealed.enc); // row preserved for a later, correct unlock
    inline.setKey(null);
    expect(await inline._msgOpenRecord(sealed)).toBe(sealed); // no key loaded: untouched
  });

  it('_msgOpenAll opens sealed records and hands legacy ones to migrate exactly once', async () => {
    const key = await newKey();
    inline.setKey(key);
    const sealed = await store.sealRecord(key, REC);
    const legacy = { msgId: 'me:1700000000001:2', contactId: 'c1', text: 'old plaintext', mine: false, ts: 1700000000001 };
    const migrate = vi.fn();
    const out = await inline._msgOpenAll([sealed, legacy], migrate);
    expect(out[0]).toEqual(REC);
    expect(out[1]).toEqual(legacy);
    expect(migrate).toHaveBeenCalledTimes(1);
    expect(migrate).toHaveBeenCalledWith(legacy);
    await inline._msgOpenAll([legacy], migrate); // same session: no re-migration loop
    expect(migrate).toHaveBeenCalledTimes(1);
  });
});

describe('msgkey in the I4 keywrap hierarchy', () => {
  it("the AES store key JWK wraps/unwraps under the 'msgkey' slot context only", async () => {
    const atRest = createAtRest({ iterations: 1000 });
    const key = await newKey();
    const jwk = await crypto.subtle.exportKey('jwk', key);
    const wrapped = await atRest.wrapJWK(jwk, 'pass phrase', 'msgkey');
    expect(await atRest.unwrapJWK(wrapped, 'pass phrase', 'msgkey')).toEqual(jwk);
    expect(await atRest.unwrapJWK(wrapped, 'pass phrase', 'keys')).toBeNull(); // slot relocation fails
    expect(await atRest.unwrapJWK(wrapped, 'wrong phrase', 'msgkey')).toBeNull();
    // And the unwrapped JWK is a working store key.
    const restored = await crypto.subtle.importKey('jwk', await atRest.unwrapJWK(wrapped, 'pass phrase', 'msgkey'), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    expect(await store.openRecord(restored, await store.sealRecord(key, REC))).toEqual(REC);
  });

  it('wiring: slots, dbPut seal hook, boot init, opened history collection', () => {
    expect(html).toContain("const _keywrapSlots = ['keys', 'signing', 'pq-priv', 'msgkey'];");
    expect(html).toContain("if (store === 'messages') val = await _msgSealRecord(val);");
    expect(html).toContain('await _initMsgStoreKey(bootPassphrase, true);');
    expect(html).toContain('await _initMsgStoreKey(null);');
    const collect = html.slice(html.indexOf('async function _collectHistory'), html.indexOf('const _sendHistoryTo'));
    expect(collect).toContain("dbGetByIndex('messages', 'contact', contactId)");
  });
});
