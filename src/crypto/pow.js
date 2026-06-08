// Proof-of-Work: challenge format, client-side solving, and server-side verify.
//
// Protocol: find nonce such that SHA-256(challenge + ':' + nonce) has the top
// `difficulty` bits equal to zero. The challenge MUST embed the identity public
// key so a solved token cannot be replayed for a different identity.
//
// All functions are pure and dependency-injected (subtle passed in), compatible
// with browser WebCrypto, Node ≥20 globalThis.crypto, and Miniflare.

const MIN_DIFFICULTY = 16;
const MAX_DIFFICULTY = 32;

/**
 * Build a challenge string that embeds `pub` (prevents replay for other identities).
 * `extra` is an optional human-readable qualifier, e.g. the alias being registered.
 */
export function makeChallengeString(pub, extra = '') {
  const ts = Date.now();
  return extra ? `${pub}:${extra}:${ts}` : `${pub}:${ts}`;
}

/**
 * Solve a PoW puzzle: find the smallest nonce ≥ 0 satisfying the difficulty.
 * Returns { challenge, nonce, difficulty }.
 */
export async function solve(subtle, challenge, difficulty = MIN_DIFFICULTY) {
  const diff   = Math.min(Math.max(difficulty, MIN_DIFFICULTY), MAX_DIFFICULTY);
  const target = (2 ** (32 - diff)) >>> 0;
  const enc    = new TextEncoder();
  for (let nonce = 0; ; nonce++) {
    const digest = await subtle.digest('SHA-256', enc.encode(`${challenge}:${nonce}`));
    if (new DataView(digest).getUint32(0, false) < target) {
      return { challenge, nonce, difficulty: diff };
    }
  }
}

/**
 * Verify a PoW token submitted by a client.
 *
 * @param {SubtleCrypto} subtle
 * @param {{ challenge: string, nonce: number, difficulty: number }} pow
 * @param {string} pub  — the identity public key that must appear in the challenge
 *
 * @returns {Promise<{ ok: boolean, code?: string, difficulty?: number }>}
 */
export async function verify(subtle, pow, pub) {
  if (!pow || typeof pow.nonce !== 'number' || typeof pow.challenge !== 'string') {
    return { ok: false, code: 'POW_REQUIRED' };
  }
  const difficulty = Math.min(Math.max(parseInt(pow.difficulty) || 0, 0), MAX_DIFFICULTY);
  if (difficulty < MIN_DIFFICULTY) {
    return { ok: false, code: 'POW_TOO_EASY' };
  }
  if (pow.challenge.length > 512) {
    return { ok: false, code: 'POW_CHALLENGE_TOO_LONG' };
  }
  if (!pow.challenge.includes(pub)) {
    return { ok: false, code: 'POW_PUB_MISMATCH' };
  }
  const digest  = await subtle.digest('SHA-256', new TextEncoder().encode(`${pow.challenge}:${pow.nonce}`));
  const first32 = new DataView(digest).getUint32(0, false);
  const target  = (2 ** (32 - difficulty)) >>> 0;
  if (first32 >= target) {
    return { ok: false, code: 'POW_INVALID' };
  }
  return { ok: true, difficulty };
}
