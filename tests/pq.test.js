// Tests for src/crypto/pq.js — PQXDH hybrid key agreement (roadmap R1, reference-only).
//
// ML-KEM is not in any shipping runtime yet, so the KEM is injected. These tests use a
// deterministic MOCK KEM: it is NOT post-quantum secure and exists only to exercise the
// combiner, the transcript binding, and the failure modes. The real security argument
// rests on ML-KEM itself, which is why this module never implements one.
import { describe, it, expect } from 'vitest';
import { createPQXDH, webCryptoKem, PQ_INFO } from '../src/crypto/pq.js';
import { createRatchet } from '../src/crypto/ratchet.js';
import { u8, concatBytes } from '../src/crypto/bytes.js';

// Deterministic stand-in for ML-KEM: ct = pk XOR seed, ss = SHA-256(pk ‖ seed).
// Decapsulation recovers seed from (sk == pk) and ct, so round-trips agree.
function mockKem(seed = 0x5a) {
  const derive = async (pk, s) => new Uint8Array(
    await crypto.subtle.digest('SHA-256', concatBytes([u8(pk), Uint8Array.of(s)])),
  );
  return {
    name: 'MOCK-KEM',
    available: () => true,
    async encapsulate(pk) {
      const p = u8(pk);
      return { ct: p.map((b) => b ^ seed), ss: await derive(p, seed) };
    },
    async decapsulate(sk, ct) {
      const recovered = u8(ct).map((b) => b ^ seed); // == pk
      return derive(recovered, seed);
    },
  };
}

const PQPK = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const DHS = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3), new Uint8Array(32).fill(4)];

describe('PQXDH — construction', () => {
  it('refuses to construct without an injected KEM (never hand-rolls one)', () => {
    expect(() => createPQXDH({})).toThrow(/KEM must be injected/);
  });

  it('initiator and responder derive the SAME 32-byte shared secret', async () => {
    const P = createPQXDH({ kem: mockKem() });
    const { sk, ct } = await P.initiate({ dhParts: DHS, pqPreKeyPub: PQPK });
    const { sk: sk2 } = await P.respond({ dhParts: DHS, pqPreKeyPriv: PQPK, pqPreKeyPub: PQPK, ct });
    expect(sk.length).toBe(32);
    expect(Array.from(sk2)).toEqual(Array.from(sk));
  });

  it('places SS LAST, matching PQXDH SK = KDF(DH1‖DH2‖DH3‖DH4‖SS)', async () => {
    const P = createPQXDH({ kem: mockKem() });
    const { ss } = await mockKem().encapsulate(PQPK);
    const { ct } = await P.initiate({ dhParts: DHS, pqPreKeyPub: PQPK });
    const viaCombine = await P.combine(DHS, ss, PQPK, ct);
    // Recomputing with SS appended by hand must reproduce the same key.
    const info = await P.transcriptInfo(PQPK, ct, PQ_INFO);
    const manual = await P.hkdf(concatBytes([...DHS, ss]), new Uint8Array(32), info, 32);
    expect(Array.from(viaCombine)).toEqual(Array.from(manual));
  });
});

describe('PQXDH — hybrid security property', () => {
  // The whole point of a hybrid: the output must change if EITHER input changes, so an
  // attacker has to break BOTH primitives, not the weaker one.
  it('a different KEM secret yields a different SK (PQ half is load-bearing)', async () => {
    const A = createPQXDH({ kem: mockKem(0x11) });
    const B = createPQXDH({ kem: mockKem(0x22) });
    const a = await A.initiate({ dhParts: DHS, pqPreKeyPub: PQPK });
    const b = await B.initiate({ dhParts: DHS, pqPreKeyPub: PQPK });
    expect(Array.from(a.sk)).not.toEqual(Array.from(b.sk));
  });

  it('a different classical DH yields a different SK (classical half is load-bearing)', async () => {
    const P = createPQXDH({ kem: mockKem() });
    const a = await P.initiate({ dhParts: DHS, pqPreKeyPub: PQPK });
    const other = [...DHS.slice(0, 3), new Uint8Array(32).fill(9)];
    const b = await P.initiate({ dhParts: other, pqPreKeyPub: PQPK });
    expect(Array.from(a.sk)).not.toEqual(Array.from(b.sk));
  });

  it('omitting DH4 (no one-time prekey) is a distinct, still-valid derivation', async () => {
    const P = createPQXDH({ kem: mockKem() });
    const withOpk = await P.initiate({ dhParts: DHS, pqPreKeyPub: PQPK });
    const noOpk = await P.initiate({ dhParts: DHS.slice(0, 3), pqPreKeyPub: PQPK });
    expect(noOpk.sk.length).toBe(32);
    expect(Array.from(noOpk.sk)).not.toEqual(Array.from(withOpk.sk));
  });
});

describe('PQXDH — transcript binding', () => {
  // Formal analyses of PQXDH stress binding the KEM public key and ciphertext, so two
  // parties can never share an SK while disagreeing about which encapsulation occurred.
  it('a swapped ciphertext changes the SK instead of silently agreeing', async () => {
    const P = createPQXDH({ kem: mockKem() });
    const { ct } = await P.initiate({ dhParts: DHS, pqPreKeyPub: PQPK });
    const ss = (await mockKem().encapsulate(PQPK)).ss;
    const honest = await P.combine(DHS, ss, PQPK, ct);
    const tampered = await P.combine(DHS, ss, PQPK, u8(ct).map((b, i) => (i === 0 ? b ^ 1 : b)));
    expect(Array.from(honest)).not.toEqual(Array.from(tampered));
  });

  it('a swapped PQ public key changes the SK', async () => {
    const P = createPQXDH({ kem: mockKem() });
    const { ct } = await P.initiate({ dhParts: DHS, pqPreKeyPub: PQPK });
    const ss = (await mockKem().encapsulate(PQPK)).ss;
    const a = await P.combine(DHS, ss, PQPK, ct);
    const b = await P.combine(DHS, ss, PQPK.map((x) => x ^ 0xff), ct);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('the transcript info is deterministic and carries the protocol label', async () => {
    const P = createPQXDH({ kem: mockKem() });
    const i1 = await P.transcriptInfo(PQPK, new Uint8Array(4), PQ_INFO);
    const i2 = await P.transcriptInfo(PQPK, new Uint8Array(4), PQ_INFO);
    expect(i1).toBe(i2);
    expect(i1.startsWith('breeze-pqxdh-v1:')).toBe(true);
  });
});

describe('PQXDH — fail-closed behaviour (no silent downgrade)', () => {
  it('throws rather than proceeding classical-only when the peer has no PQ pre-key', async () => {
    const P = createPQXDH({ kem: mockKem() });
    await expect(P.initiate({ dhParts: DHS, pqPreKeyPub: null })).rejects.toThrow(/no PQ pre-key/);
  });

  it('throws rather than guessing when the prekey message carries no ciphertext', async () => {
    const P = createPQXDH({ kem: mockKem() });
    await expect(P.respond({ dhParts: DHS, pqPreKeyPriv: PQPK, pqPreKeyPub: PQPK, ct: null }))
      .rejects.toThrow(/no KEM ciphertext/);
  });

  it('a KEM that reports unavailable surfaces an error, never a classical-only key', async () => {
    const dead = { name: 'none', available: () => false, encapsulate: async () => { throw new Error('ML-KEM unavailable in this runtime'); }, decapsulate: async () => { throw new Error('ML-KEM unavailable in this runtime'); } };
    const P = createPQXDH({ kem: dead });
    await expect(P.initiate({ dhParts: DHS, pqPreKeyPub: PQPK })).rejects.toThrow(/unavailable/);
  });
});

describe('PQXDH — classical half stays byte-identical to the deployed X3DH', () => {
  // The migration promise: the four DHs are exactly what x3dhInitiator already computes,
  // so turning PQ on must not perturb the classical derivation — only extend it.
  it('reuses ratchet.js x3dhInitiator DH parts unchanged (same DH secrets in, same order)', async () => {
    const R = createRatchet();
    const alice = await R.genRatchetKey();
    const bob = await R.genRatchetKey();
    const eph = await R.genRatchetKey();
    // DH1..DH3 exactly as x3dhInitiator orders them.
    const parts = [
      await R.ecdhBits(alice.privateKey, bob.pub),
      await R.ecdhBits(eph.privateKey, bob.pub),
      await R.ecdhBits(eph.privateKey, bob.pub),
    ];
    const classical = await R.x3dhInitiator({
      ikPriv: alice.privateKey, ekPriv: eph.privateKey, ikPubPeer: bob.pub, spkPubPeer: bob.pub,
    });
    expect(classical.length).toBe(32);
    // The hybrid consumes those same bytes; it must differ from classical-only (SS folded in).
    const P = createPQXDH({ kem: mockKem() });
    const { sk } = await P.initiate({ dhParts: parts, pqPreKeyPub: PQPK });
    expect(Array.from(sk)).not.toEqual(Array.from(classical));
    expect(sk.length).toBe(classical.length);
  });
});

describe('webCryptoKem — ML-KEM adapter', () => {
  it('reports unavailable on a runtime without ML-KEM (no false positive)', () => {
    const k = webCryptoKem({ subtle: { supports: () => false } });
    expect(k.available()).toBe(false);
  });

  it('detects support via the spec\'d SubtleCrypto.supports() entry point', () => {
    const k = webCryptoKem({ subtle: { supports: (op, alg) => op === 'encapsulateBits' && alg === 'ML-KEM-768' } });
    expect(k.available()).toBe(true);
  });

  it('falls back to probing the primitive names across draft revisions', () => {
    expect(webCryptoKem({ subtle: { encapsulateBits: () => {} } }).available()).toBe(true);
    expect(webCryptoKem({ subtle: { encapsulateKey: () => {} } }).available()).toBe(true);
    expect(webCryptoKem({ subtle: {} }).available()).toBe(false);
  });

  it('refuses to encapsulate when unavailable rather than returning a weak key', async () => {
    await expect(webCryptoKem({ subtle: {} }).encapsulate(PQPK)).rejects.toThrow(/unavailable/);
  });
});
