// ============================================================================
// Breeze — PQXDH session facade (stage-3 step 5, docs/PQ_STAGE3_PLAN.md D2/D5/D6)
//
// WHAT THIS IS: the deployed bridge between index.html's v5 session wiring
// and the PQXDH combiner (src/crypto/pq.js) running over the pinned vendored
// ML-KEM-768 (src/crypto/mlkem.js). It exists because step 4's reduction
// pass could not free the line budget for an inline KEM mirror, so — by the
// decision recorded in the plan's step-4 outcome — step 5 deploys through
// the SAME module route step 3 established for key material: index.html
// runtime-imports this module (INTEGRATION.md §0(A)) and exposes the helper
// as window.__breezePQXDH; the classic script calls it opportunistically.
//
// SCOPE: exactly two operations, both one-shot at session establishment.
//   - initiateSK(dhParts, pqPreKeyPub) — initiator: encapsulate to the
//     peer's VERIFIED PQ pre-key and fold the KEM secret into the X3DH
//     parts (pq.js's combiner: SS last, transcript-bound info).
//   - respondSK(dhParts, pqPrivRecord, pqct) — responder: re-derive the
//     secret key from the stored `pq-priv` seed (D4: the seed is the only
//     persisted form; the expanded key never leaves this module's caller
//     stack and is never stored or sent), decapsulate, combine.
// Negotiation (caps AND rule, signature verification) stays in the caller
// (index.html, mirroring negotiate.js): this facade assumes the pqPreKey
// it is handed has ALREADY been authenticated — the same division pq.js
// documents (fail-closed combiner, explicit caller decision).
//
// FAIL-CLOSED: initiateSK throws on malformed input (the caller converts
// that to "negotiate classical", an explicit outcome). respondSK returns
// null when the PQ private half is unavailable — no record, a malformed
// one, or a /keywrap-WRAPPED one (pqSeedFromRecord refuses a plaintext
// read of a locked seed; unwrapping is the passphrase flow's job, never
// done silently here) — and the caller MUST then refuse the session
// rather than derive a classical SK that cannot match the initiator's.
// A well-formed-but-foreign ciphertext decapsulates by ML-KEM implicit
// rejection to a pseudorandom secret, so the combined SK simply differs
// and the first message's AEAD rejects it downstream (transcript binding).
// ============================================================================
import { createPQXDH, nobleKem768 } from './pq.js';
import {
  pqSeedFromRecord, pqPublicKeyFromSeed, pqSecretKeyFromSeed, PQ_PUBLIC_KEY_BYTES,
} from './pqkey.js';
import { u8, arr } from './bytes.js';

export const PQ_CIPHERTEXT_BYTES = 1088; // FIPS 203 ML-KEM-768 ciphertext size

// The X3DH DH outputs are DH1..DH3 always, DH4 iff a one-time pre-key was
// consumed — 3 or 4 parts, never anything else. The combiner would happily
// KDF whatever it is given, so the count is pinned here: a wiring bug that
// dropped or duplicated a DH must fail loudly, not derive a weaker SK.
function checkDhParts(dhParts) {
  if (!Array.isArray(dhParts) || (dhParts.length !== 3 && dhParts.length !== 4)) {
    throw new Error(`pqxdh: dhParts must be the 3–4 X3DH DH outputs, got ${Array.isArray(dhParts) ? dhParts.length : typeof dhParts}`);
  }
  return dhParts.map(u8);
}

export function createPQSessionHelper(pqxdh = createPQXDH({ kem: nobleKem768() })) {
  return {
    // Initiator half. `pqPreKeyPub` is the RAW ML-KEM-768 public-key bytes
    // (the caller base64-decodes the bundle field and verifies pqPreKeySig
    // over exactly these bytes before calling). Returns { sk, ct } — sk a
    // 32-byte Uint8Array, ct as a plain number[] in the pkm envelope's
    // arr() byte encoding (plan D6).
    async initiateSK(dhParts, pqPreKeyPub) {
      const parts = checkDhParts(dhParts);
      const pub = u8(pqPreKeyPub);
      if (pub.length !== PQ_PUBLIC_KEY_BYTES) {
        throw new Error(`pqxdh: PQ pre-key is ${pub.length} bytes, expected ${PQ_PUBLIC_KEY_BYTES}`);
      }
      const { sk, ct } = await pqxdh.initiate({ dhParts: parts, pqPreKeyPub: pub });
      const ctU8 = u8(ct);
      if (ctU8.length !== PQ_CIPHERTEXT_BYTES) {
        throw new Error(`pqxdh: KEM ciphertext is ${ctU8.length} bytes, expected ${PQ_CIPHERTEXT_BYTES}`);
      }
      const skU8 = u8(sk);
      if (skU8.length !== 32) throw new Error(`pqxdh: combined SK is ${skU8.length} bytes, expected 32`);
      return { sk: skU8, ct: arr(ctU8) };
    },

    // Responder half. `pqPrivRecord` is the raw `pq-priv` IDB record (the
    // caller reads it; this module owns its shape via pqkey.js). `pqct` is
    // the envelope's byte array (or raw bytes). Returns the combined
    // 32-byte SK, or null when the PQ private half is unavailable / the
    // ciphertext is not an ML-KEM-768 ciphertext — the caller fails closed.
    async respondSK(dhParts, pqPrivRecord, pqct) {
      const seed = pqSeedFromRecord(pqPrivRecord);
      if (!seed) return null;
      const ct = u8(pqct);
      if (ct.length !== PQ_CIPHERTEXT_BYTES) return null;
      const parts = checkDhParts(dhParts);
      const { sk } = await pqxdh.respond({
        dhParts: parts,
        pqPreKeyPriv: pqSecretKeyFromSeed(seed),
        pqPreKeyPub: pqPublicKeyFromSeed(seed),
        ct,
      });
      const skU8 = u8(sk);
      return skU8.length === 32 ? skU8 : null;
    },
  };
}

export default createPQSessionHelper;
