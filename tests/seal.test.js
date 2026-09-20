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
});
