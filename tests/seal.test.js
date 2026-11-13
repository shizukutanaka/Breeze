// Sealed Sender v2 — the property under test is the one SECURITY.md used to merely claim:
// the relay must not be able to identify the sender from what it stores. These tests pin
// the reference implementation; tests/mirror-drift.test.js cross-tests the inline copy.
import { describe, it, expect } from 'vitest';
import { sealMeta, unsealMeta } from '../src/crypto/seal.js';

const subtle = globalThis.crypto.subtle;

async function identity() {
  const kp = await subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  return { kp, pubRaw: new Uint8Array(await subtle.exportKey('raw', kp.publicKey)) };
}

// The pre-padding sealMeta, byte for byte: raw JSON straight into AES-GCM.
// Kept here so the backward-compat tests can mint blobs in the exact format
// already sitting in relays' queues when the padding shipped.
async function legacySealMeta(recipientPubRaw, meta, to, ts) {
  const eph = await subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const ephPubRaw = new Uint8Array(await subtle.exportKey('raw', eph.publicKey));
  const peerPub = await subtle.importKey('raw', recipientPubRaw, { name: 'X25519' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'X25519', public: peerPub }, eph.privateKey, 256));
  const hk = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
  const key = new Uint8Array(await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('breeze-seal-v2') },
    hk, 256));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const k = await subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`breeze-seal-v2:${to}:${ts}`) },
    k, new TextEncoder().encode(JSON.stringify(meta)));
  const b64 = (u8) => btoa(String.fromCharCode(...u8));
  return { ek: b64(ephPubRaw), iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) };
}

const TO = 'aaaabbbbcccc';
const TS = 1755000000000;
const META = {
  from: 'ddddeeeeffff', fromPub: 'A'.repeat(43) + '=', fromName: 'Alice',
  sig: 's'.repeat(86), sigPub: 'p'.repeat(43) + '=',
  replyTo: { text: 'the plaintext preview that used to leak' },
  selfSync: true, sfFor: 'gggghhhhiiii', acctRoot: 'R'.repeat(43) + '=',
};

describe('sealed sender v2 (reference)', () => {
  it('round-trips: the recipient opens what the sender sealed', async () => {
    const r = await identity();
    const se = await sealMeta(subtle, r.pubRaw, META, TO, TS);
    const opened = await unsealMeta(subtle, r.kp.privateKey, se, TO, TS);
    expect(opened).toEqual(META);
  });

  it('the sealed blob leaks nothing: no meta field appears in the wire bytes', async () => {
    const r = await identity();
    const se = await sealMeta(subtle, r.pubRaw, META, TO, TS);
    const wire = JSON.stringify({ to: TO, ts: TS, payload: 'ciphertext', sv: 2, se });
    for (const leak of [META.from, META.fromPub, META.fromName, META.sigPub, META.replyTo.text, META.acctRoot]) {
      expect(wire).not.toContain(leak);
    }
  });

  it('only the recipient can open it — a different identity key gets null', async () => {
    const r = await identity();
    const eve = await identity();
    const se = await sealMeta(subtle, r.pubRaw, META, TO, TS);
    expect(await unsealMeta(subtle, eve.kp.privateKey, se, TO, TS)).toBeNull();
  });

  it('AAD binds the recipient: a blob re-addressed to another inbox refuses to open', async () => {
    const r = await identity();
    const se = await sealMeta(subtle, r.pubRaw, META, TO, TS);
    expect(await unsealMeta(subtle, r.kp.privateKey, se, 'zzzzyyyyxxxx', TS)).toBeNull();
  });

  it('AAD binds the timestamp: a replayed blob with a shifted ts refuses to open', async () => {
    const r = await identity();
    const se = await sealMeta(subtle, r.pubRaw, META, TO, TS);
    expect(await unsealMeta(subtle, r.kp.privateKey, se, TO, TS + 1)).toBeNull();
  });

  it('a tampered ciphertext refuses to open', async () => {
    const r = await identity();
    const se = await sealMeta(subtle, r.pubRaw, META, TO, TS);
    const bent = { ...se, ct: [...se.ct] };
    bent.ct[0] = (bent.ct[0] + 1) & 0xff;
    expect(await unsealMeta(subtle, r.kp.privateKey, bent, TO, TS)).toBeNull();
  });

  it('accepts the recipient pub as base64 too (the shape the client actually holds)', async () => {
    const r = await identity();
    const pubB64 = btoa(String.fromCharCode(...r.pubRaw));
    const se = await sealMeta(subtle, pubB64, META, TO, TS);
    expect(await unsealMeta(subtle, r.kp.privateKey, se, TO, TS)).toEqual(META);
  });

  it('pads the metadata: ct length is the 256-bucket of the framed JSON, never the exact length', async () => {
    const r = await identity();
    const se = await sealMeta(subtle, r.pubRaw, META, TO, TS);
    const jsonLen = new TextEncoder().encode(JSON.stringify(META)).length;
    // frame = [marker:1][len:2][JSON] zero-padded to a 256 multiple; GCM adds its 16-byte tag
    expect(se.ct.length).toBe(Math.ceil((jsonLen + 3) / 256) * 256 + 16);
    expect(se.ct.length).not.toBe(jsonLen + 16);
  });

  it('two metas of different exact lengths in the same bucket seal to identical ct lengths', async () => {
    const r = await identity();
    const a = await sealMeta(subtle, r.pubRaw, { from: 'x', fromName: 'Al' }, TO, TS);
    const b = await sealMeta(subtle, r.pubRaw, { from: 'x', fromName: 'A considerably longer display name' }, TO, TS);
    expect(a.ct.length).toBe(256 + 16);
    expect(b.ct.length).toBe(a.ct.length);
    // and both still open to their own contents — the bucket hides length, not data
    expect(await unsealMeta(subtle, r.kp.privateKey, a, TO, TS)).toEqual({ from: 'x', fromName: 'Al' });
    expect(await unsealMeta(subtle, r.kp.privateKey, b, TO, TS)).toEqual({ from: 'x', fromName: 'A considerably longer display name' });
  });

  it('a meta crossing a bucket boundary moves up exactly one bucket', async () => {
    const r = await identity();
    const big = { from: 'x', replyTo: { text: 'p'.repeat(400) } };
    const se = await sealMeta(subtle, r.pubRaw, big, TO, TS);
    const jsonLen = new TextEncoder().encode(JSON.stringify(big)).length;
    expect(jsonLen + 3).toBeGreaterThan(256);
    expect(se.ct.length).toBe(Math.ceil((jsonLen + 3) / 256) * 256 + 16);
    expect(await unsealMeta(subtle, r.kp.privateKey, se, TO, TS)).toEqual(big);
  });

  it('opens a legacy pre-padding blob (raw JSON plaintext, no frame)', async () => {
    const r = await identity();
    const se = await legacySealMeta(r.pubRaw, META, TO, TS);
    const jsonLen = new TextEncoder().encode(JSON.stringify(META)).length;
    expect(se.ct.length).toBe(jsonLen + 16); // the old wire shape: exact length + tag
    expect(await unsealMeta(subtle, r.kp.privateKey, se, TO, TS)).toEqual(META);
  });
});
