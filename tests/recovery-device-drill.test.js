// D24 recovery drill: the device registry's only signer is the root
// device (src/app/device-link.js refuses with devPrimaryOnly when
// acct.root !== myPubB64), so losing the root phone looks like losing
// device management itself. The documented escape is the recovery
// phrase: seed derivation is deterministic, so a phrase restore
// reproduces BOTH the identity key and the Ed25519 signing key the
// registry is verified against. This drill pins the whole chain end
// to end — phrase → restored material → the REAL linkDevicePub flow →
// a /device/set body whose signature verifies under the ORIGINAL
// root's registered signing key (the exact check _worker.js
// handleDeviceSet performs). The negative control signs with a
// different key and must fail that verification, so the drill cannot
// pass vacuously.
import { describe, it, expect } from 'vitest';
import { createSeedHelper } from '../src/crypto/seed.js';
import { createDeviceLink } from '../src/app/device-link.js';

const seed = createSeedHelper();
const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64');

async function sha256Short(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// A device-link deps object standing on the given (restored) material,
// mirroring how initMessenger instantiates the factory: signMessage is
// the real Ed25519 sign over the message text, base64-encoded, exactly
// as index.html's signMessage produces it.
async function depsFor(material, toasts, posted) {
  const signKey = await crypto.subtle.importKey('jwk', material.signingRecord.priv, { name: 'Ed25519' }, false, ['sign']);
  let confirms = 0;
  return {
    t: (k) => k,
    showToast: (msg, type) => toasts.push({ msg, type }),
    showConfirm: async () => (++confirms === 1), // approve the link, decline the history-transfer offer
    dbg: () => {},
    esc: (s) => s,
    myId: () => material.identityPubB64.slice(0, 12),
    myPubB64: () => material.identityPubB64,
    dbGet: async () => ({ root: material.identityPubB64, isPrimary: true }),
    dbPut: async () => {},
    fetchDeviceList: async () => [material.identityPubB64],
    postAPIRaw: async (path, body) => { posted.push({ path, body }); return { ok: true }; },
    signMessage: async (text) => b64(await crypto.subtle.sign({ name: 'Ed25519' }, signKey, new TextEncoder().encode(text))),
    bustDevCache: () => {},
    sendHistoryTo: async () => ({ sent: false }),
    hasApi: () => true,
    cmdPanel: () => { throw new Error('not used by linkDevicePub'); },
    deviceScanButton: () => { throw new Error('not used by linkDevicePub'); },
    safeSetHTML: () => {},
    clipboardWrite: async () => {},
    refreshDeviceRole: async () => {},
  };
}

async function verifyRegistrySig(originalPubJwk, body) {
  const pub = await crypto.subtle.importKey('jwk', originalPubJwk, { name: 'Ed25519' }, false, ['verify']);
  const digest = await sha256Short(JSON.stringify(body.devices.map((d) => d.pub)));
  const msg = new TextEncoder().encode(`breeze-device-set:${body.accountId}:${body.ts}:${digest}`);
  return crypto.subtle.verify({ name: 'Ed25519' }, pub, Buffer.from(body.sig, 'base64'), msg);
}

describe('D24 recovery drill — phrase restore restores device management', () => {
  const entropy = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 0xff);

  it('phrase restore reproduces the identity and signing material byte-for-byte', async () => {
    const phrase = await seed.entropyToPhrase(entropy);
    const original = await seed.deriveIdentityMaterial(entropy, '');
    const restored = await seed.deriveIdentityMaterial(await seed.phraseToEntropy(phrase), '');
    expect(restored.identityPubB64).toBe(original.identityPubB64);
    expect(restored.signingRecord.pubB64).toBe(original.signingRecord.pubB64);
    expect(restored.signingRecord.priv).toEqual(original.signingRecord.priv);
    expect(restored.identityPrivJwk).toEqual(original.identityPrivJwk);
  });

  it('the restored root can sign a registry write the original key verifies', async () => {
    const phrase = await seed.entropyToPhrase(entropy);
    const original = await seed.deriveIdentityMaterial(entropy, '');
    const restored = await seed.deriveIdentityMaterial(await seed.phraseToEntropy(phrase), '');
    const secondDevice = await seed.deriveIdentityMaterial(new Uint8Array(32).fill(0xab), '');

    const toasts = [], posted = [];
    const link = createDeviceLink(await depsFor(restored, toasts, posted));
    await link.linkDevicePub(secondDevice.identityPubB64);

    // The primary gate passed (no devPrimaryOnly refusal) and the write went out.
    expect(toasts.map((x) => x.msg)).toContain('devAdded');
    expect(toasts.map((x) => x.msg)).not.toContain('devPrimaryOnly');
    expect(posted).toHaveLength(1);
    expect(posted[0].path).toBe('/device/set');
    const body = posted[0].body;
    expect(body.root).toBe(original.identityPubB64);
    expect(body.accountId).toBe(original.identityPubB64.slice(0, 12));
    expect(body.devices.map((d) => d.pub)).toEqual(expect.arrayContaining([original.identityPubB64, secondDevice.identityPubB64]));
    // The Worker's own check: the signature verifies under the root's
    // REGISTERED Ed25519 key — the one from before the device was lost.
    expect(await verifyRegistrySig(original.signingRecord.pub, body)).toBe(true);
  });

  it('negative control: a registry write signed by a different key does not verify', async () => {
    const original = await seed.deriveIdentityMaterial(entropy, '');
    const stranger = await seed.deriveIdentityMaterial(new Uint8Array(32).fill(0x11), '');
    // Deps claim the original identity (pub/root) but sign with the
    // stranger's key — the drill's verification must reject the result.
    const toasts = [], posted = [];
    const deps = await depsFor(stranger, toasts, posted);
    deps.myPubB64 = () => original.identityPubB64;
    deps.myId = () => original.identityPubB64.slice(0, 12);
    deps.dbGet = async () => ({ root: original.identityPubB64, isPrimary: true });
    deps.fetchDeviceList = async () => [original.identityPubB64];
    const link = createDeviceLink(deps);
    const secondDevice = await seed.deriveIdentityMaterial(new Uint8Array(32).fill(0xcd), '');
    await link.linkDevicePub(secondDevice.identityPubB64);
    expect(posted).toHaveLength(1);
    expect(await verifyRegistrySig(original.signingRecord.pub, posted[0].body)).toBe(false);
  });
});
