// Tests for src/crypto/mlkem.js — ML-KEM-768 vendored from
// @noble/post-quantum 0.7.1 (stage 3 step 1, docs/PQ_STAGE3_PLAN.md D1/D2).
//
// Correctness rests on official vectors, not round-trips: the NIST ACVP
// ML-KEM-768 known answers below pin the vendored code byte-for-byte. A
// self-consistent-but-wrong KEM (bad NTT, bad sampling, bad codec) fails
// these even though its own round-trips would still agree — that is the
// point of vendoring a vector-tested upstream instead of trusting a port.
//
// Vector source: ACVP-Server gen-val files ML-KEM-keyGen-FIPS203 and
// ML-KEM-encapDecap-FIPS203 (ML-KEM-768 groups only), extracted verbatim
// into tests/vectors/mlkem768-acvp.json — the same files the upstream
// repo's own test suite runs (test/acvp.test.ts there).
import { describe, it, expect } from 'vitest';
import { ml_kem768 } from '../src/crypto/mlkem.js';
import vectors from './vectors/mlkem768-acvp.json';

const hex = (h) => new Uint8Array(Buffer.from(h, 'hex'));
const eq = (a, b) => Buffer.from(a).equals(Buffer.from(b));
const seedOf = (v) => new Uint8Array(Buffer.concat([Buffer.from(v.d, 'hex'), Buffer.from(v.z, 'hex')]));

describe('ML-KEM-768 (vendored noble) — NIST ACVP known answers', () => {
  it('keyGen: keygen(d‖z) reproduces the official ek and dk for all 25 cases', () => {
    expect(vectors.keyGen.length).toBe(25);
    for (const v of vectors.keyGen) {
      const { publicKey, secretKey } = ml_kem768.keygen(seedOf(v));
      expect(eq(publicKey, hex(v.ek))).toBe(true);
      expect(eq(secretKey, hex(v.dk))).toBe(true);
      // The stored dk must re-derive the same ek (what getPublicKey is for).
      expect(eq(ml_kem768.getPublicKey(secretKey), publicKey)).toBe(true);
    }
  });

  it('encapsulation: encapsulate(ek, m) reproduces the official c and k for all 25 cases', () => {
    expect(vectors.encap.length).toBe(25);
    for (const v of vectors.encap) {
      const { cipherText, sharedSecret } = ml_kem768.encapsulate(hex(v.ek), hex(v.m));
      expect(eq(cipherText, hex(v.c))).toBe(true);
      expect(eq(sharedSecret, hex(v.k))).toBe(true);
    }
  });

  it('decapsulation: decapsulate(c, dk) reproduces the official k for all 10 cases', () => {
    expect(vectors.decap.length).toBe(10);
    for (const v of vectors.decap) {
      // The ACVP decapsulation set includes modified-ciphertext cases whose
      // expected k is the implicit-rejection secret — equality here proves
      // the FO transform's reject path, not just the happy path.
      expect(eq(ml_kem768.decapsulate(hex(v.c), hex(v.dk)), hex(v.k))).toBe(true);
    }
  });
});

describe('ML-KEM-768 (vendored noble) — shape and properties the stage-3 design relies on', () => {
  it('pins the FIPS 203 ML-KEM-768 sizes (bundle/pkm budget in plan D1/D3/D6)', () => {
    expect(ml_kem768.lengths.publicKey).toBe(1184);
    expect(ml_kem768.lengths.secretKey).toBe(2400);
    expect(ml_kem768.lengths.cipherText).toBe(1088);
    expect(ml_kem768.lengths.seed).toBe(64);
  });

  it('keygen is deterministic from the 64-byte seed (plan D4: persist the seed, re-derive the dk)', () => {
    const seed = new Uint8Array(64).fill(0x42);
    const a = ml_kem768.keygen(seed);
    const b = ml_kem768.keygen(seed);
    expect(eq(a.publicKey, b.publicKey)).toBe(true);
    expect(eq(a.secretKey, b.secretKey)).toBe(true);
  });

  it('round-trips with fresh randomness (sanity alongside the vectors)', () => {
    const { publicKey, secretKey } = ml_kem768.keygen();
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(publicKey);
    expect(sharedSecret.length).toBe(32);
    expect(eq(ml_kem768.decapsulate(cipherText, secretKey), sharedSecret)).toBe(true);
  });

  it('implicit rejection: a tampered ciphertext yields a DIFFERENT secret and never throws', () => {
    const { publicKey, secretKey } = ml_kem768.keygen(new Uint8Array(64).fill(3));
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(publicKey);
    for (const pos of [0, 500, 1087]) {
      const bad = Uint8Array.from(cipherText);
      bad[pos] ^= 1;
      const ss = ml_kem768.decapsulate(bad, secretKey);
      expect(ss.length).toBe(32);
      expect(eq(ss, sharedSecret)).toBe(false);
    }
  });

  it('implicit rejection: decapsulating under the wrong secret key yields a different secret, no throw', () => {
    const a = ml_kem768.keygen(new Uint8Array(64).fill(4));
    const b = ml_kem768.keygen(new Uint8Array(64).fill(5));
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(a.publicKey);
    const ss = ml_kem768.decapsulate(cipherText, b.secretKey);
    expect(ss.length).toBe(32);
    expect(eq(ss, sharedSecret)).toBe(false);
  });
});
