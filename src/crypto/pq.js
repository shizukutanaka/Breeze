// ============================================================================
// Breeze — Post-quantum hybrid key agreement (roadmap R1, reference-only)
//
// WHY: X25519 is broken by a CRQC (cryptographically-relevant quantum computer),
// and a relay that stores sealed envelopes today can decrypt them later once one
// exists — "harvest now, decrypt later". The mitigation the industry converged on
// is HYBRID key agreement: mix a classical ECDH secret and a post-quantum KEM
// secret into one KDF, so the result stays secure if EITHER primitive survives.
// Signal shipped this as PQXDH (2023) and extended it into the ratchet as SPQR
// (2025); TLS/IKEv2 use the same concatenate-then-KDF shape (RFC 9370).
//
// WHAT THIS IS: PQXDH, expressed as a minimal extension of the X3DH already in
// ratchet.js. Signal's PQXDH derives
//     SK = KDF(DH1 ‖ DH2 ‖ DH3 ‖ DH4 ‖ SS)
// where DH1..DH4 are exactly the four DHs Breeze's x3dhInitiator already computes
// (DH(IK,SPK), DH(EK,IK), DH(EK,SPK), DH(EK,OPK)) and SS is a KEM shared secret.
// So the PQ upgrade is: append SS, keep everything else byte-identical.
//
// WHAT THIS IS NOT: an ML-KEM implementation. Hand-rolling a lattice KEM is a
// well-known way to ship a broken one (timing leaks, bad sampling, no test
// vectors), and this repo forbids new runtime deps. The KEM is therefore
// INJECTED. Supply either:
//   - webCryptoKem() — uses crypto.subtle's ML-KEM once browsers ship it (the
//     WICG "Modern Algorithms in the Web Cryptography API" draft; expected ~2027,
//     which is why this module is reference-only today), or
//   - any object shaped { name, encapsulate(pk), decapsulate(sk, ct) }.
//
// FAIL-CLOSED: there is deliberately no "PQ if available, classical otherwise"
// path in here. A silent downgrade is indistinguishable from an attacker forcing
// one, so choosing classical-only stays an explicit caller decision (the caps
// negotiation in negotiate.js), not something this module does behind your back.
//
// TRANSCRIPT BINDING: the formal analyses of PQXDH (Bhargavan-Jacomme-Kiefer-
// Schmidt, USENIX Sec '24; Cryspen's review) highlight that the KEM public key
// and ciphertext must be authenticated/bound, or a peer can be confused about
// which encapsulation it is completing. Breeze's SPK signature already covers the
// bundle, and this module additionally binds (pqpk ‖ ct) into the HKDF info so a
// swapped ciphertext yields a different SK instead of a silently shared one.
// ============================================================================
import { u8, concatBytes, ctEqual } from './bytes.js';

export const PQ_INFO = 'breeze-pqxdh-v1';

// A KEM adapter over WebCrypto's ML-KEM, per the WICG modern-algos draft. The
// primitive name moved across draft revisions (encapsulateKey -> encapsulateBits),
// so probe both; SubtleCrypto.supports() is the spec'd feature-detection entry.
export function webCryptoKem(opts = {}) {
  const subtle = opts.subtle || globalThis.crypto?.subtle;
  const alg = opts.algorithm || 'ML-KEM-768';
  return {
    name: alg,
    available() {
      if (!subtle) return false;
      try {
        if (typeof subtle.supports === 'function') return !!subtle.supports('encapsulateBits', alg);
        return typeof subtle.encapsulateBits === 'function' || typeof subtle.encapsulateKey === 'function';
      } catch { return false; }
    },
    async encapsulate(pk) {
      if (!this.available()) throw new Error('ML-KEM unavailable in this runtime');
      const r = await subtle.encapsulateBits(alg, pk);
      return { ct: u8(r.ciphertext), ss: u8(r.sharedKey ?? r.sharedSecret) };
    },
    async decapsulate(sk, ct) {
      if (!this.available()) throw new Error('ML-KEM unavailable in this runtime');
      const r = await subtle.decapsulateBits(alg, sk, u8(ct));
      return u8(r.sharedKey ?? r.sharedSecret ?? r);
    },
  };
}

export function createPQXDH(opts = {}) {
  const kem = opts.kem;
  if (!kem) throw new Error('createPQXDH: a KEM must be injected (see webCryptoKem)');
  const subtle = opts.subtle || globalThis.crypto.subtle;
  const hashName = opts.hash || 'SHA-256';

  async function hkdf(ikm, salt, info, length) {
    const key = await subtle.importKey('raw', u8(ikm), 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await subtle.deriveBits(
      { name: 'HKDF', hash: hashName, salt, info: new TextEncoder().encode(info) }, key, length * 8,
    ));
  }

  // The info string carries the protocol label AND a transcript of the KEM public
  // key and ciphertext, so an SK is only ever shared by two parties that agree on
  // WHICH encapsulation happened (see TRANSCRIPT BINDING above).
  async function transcriptInfo(pqpk, ct, info) {
    const digest = new Uint8Array(await subtle.digest(hashName, concatBytes([u8(pqpk), u8(ct)])));
    let hex = '';
    for (const b of digest) hex += b.toString(16).padStart(2, '0');
    return `${info}:${hex}`;
  }

  // Combine the classical X3DH DH secrets with the KEM secret. dhParts MUST already
  // be in PQXDH's DH1..DH4 order — pass exactly what x3dhInitiator/x3dhResponder
  // concatenate, so the classical half stays byte-identical to the deployed X3DH.
  async function combine(dhParts, ss, pqpk, ct, info = PQ_INFO) {
    const parts = dhParts.map(u8);
    parts.push(u8(ss)); // SS goes LAST: SK = KDF(DH1‖DH2‖DH3‖DH4‖SS)
    return hkdf(concatBytes(parts), new Uint8Array(32), await transcriptInfo(pqpk, ct, info), 32);
  }

  // Initiator (Alice): encapsulate to the responder's advertised PQ pre-key, then
  // fold the resulting SS into the X3DH secret. Returns the ciphertext to ship
  // alongside the existing prekey message.
  async function initiate({ dhParts, pqPreKeyPub, info = PQ_INFO }) {
    if (!pqPreKeyPub) throw new Error('pqxdh initiate: responder advertised no PQ pre-key');
    const { ct, ss } = await kem.encapsulate(pqPreKeyPub);
    return { sk: await combine(dhParts, ss, pqPreKeyPub, ct, info), ct: u8(ct) };
  }

  // Responder (Bob): decapsulate with his PQ pre-key private half and recompute the
  // same SK from his mirrored DHs.
  async function respond({ dhParts, pqPreKeyPriv, pqPreKeyPub, ct, info = PQ_INFO }) {
    if (!ct) throw new Error('pqxdh respond: no KEM ciphertext in the prekey message');
    const ss = await kem.decapsulate(pqPreKeyPriv, ct);
    return { sk: await combine(dhParts, ss, pqPreKeyPub, ct, info) };
  }

  return { initiate, respond, combine, transcriptInfo, hkdf, kem, ctEqual };
}

export default createPQXDH;
