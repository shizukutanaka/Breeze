// ============================================================================
// Breeze — ML-KEM-768 (FIPS 203), vendored from @noble/post-quantum 0.7.1
//
// WHY THIS FILE EXISTS: stage 3 (docs/PQ_STAGE3_PLAN.md, decision D1) adds
// post-quantum key agreement. The KEM is INJECTED into pq.js's combiner and
// must never be hand-rolled, so this module is a pinned, verbatim copy of the
// vetted upstream implementation — the same code the ecosystem ships —
// vendored into this repo's single-module shape. It is reference-only:
// nothing deployed imports it yet (the inline copy lands in stage 3 step 5).
//
// PROVENANCE AND SUPPLY-CHAIN VERIFICATION (checked at vendoring time,
// 2026-11-14, against the npm registry AND the tarballs actually used):
//   @noble/post-quantum 0.7.1 — ml-kem.js, _crystals.js, utils.js
//     tarball sha512: sha512-+P9981IiAnVh+rmcubozzVwrEy3XsN/tMhTnvsjV9VDaYpOnNCqWqKo2FLWxbu92YHfjGIlE5XnW175UK+ln+Q==
//     (identical to the integrity recorded in docs/PQ_STAGE3_PLAN.md D1)
//   @noble/hashes 2.4.0 — sha3.js, utils.js, _u64.js (pinned by post-quantum)
//     tarball sha512: sha512-X5XaVWZIBCT7HHZGm5I7ZQXDwLG+bGXuSrMQAW+7Zvl87h1kmc1ZB1VSRJcpUfoUrGQp4Fkoxm5kZ+Ms+aW+eA==
//   @noble/curves 2.4.0 — abstract/fft.js, plus aobject/validateObject from
//     utils.js (the two helpers fft.js's FFTCore imports)
//     tarball sha512: sha512-P4/62zrgfH33CneE3Dn4WhJVA22YUU0eR51wKIan4NVRvwsA0YnPTwWGpNbpuacSujmSFLvyzpyuR30+fbq2Ew==
// Correctness does not rest on this copy being read line-by-line: the NIST
// ACVP ML-KEM-768 vectors in tests/mlkem.test.js pin keygen / encapsulate /
// decapsulate to the official known answers.
//
// VENDORING RULES (plan D1): no algorithm edits. The only local changes are
//   1. import rewiring — the closure's cross-file imports resolve inside this
//      one module scope. Two bindings needed disambiguation:
//        - fft.js's `_1n` is renamed `_1nFft` (sha3.js has its own `_1n`);
//        - the aobject used by validateObject is renamed `aobjectC`
//          (@noble/curves' copy; @noble/hashes keeps its own `aobject`).
//      One pure re-export alias disappears: @noble/post-quantum utils'
//      `randomBytes` IS @noble/hashes' randomBytes object, so the alias
//      declaration is dropped and the name binds directly — same function.
//   2. pruning of top-level definitions nothing in the ML-KEM-768 closure
//      references (exports for ML-KEM-512/1024, ML-DSA/Falcon/SLH-DSA helpers,
//      unused hash wrappers and utilities). Four prunes needed a human call
//      because name-based linking cannot express the upstream binding:
//        - @noble/hashes validateObject (FFTCore imports the curves copy —
//          kept; the two implementations are byte-identical logic)
//        - @noble/hashes copyBytes (ml-kem binds post-quantum's — kept)
//        - @noble/post-quantum aobject (only its pruned opts validators
//          referenced it)
//        - @noble/curves fft's poly (its callers are pruned; it needs the
//          non-vendored validateField)
//      Pruned definitions, per source file:
//   @noble/hashes 2.4.0 — _u64.js:
//     - toBig
//     - fromNumH
//     - fromNumL
//     - setU64FromNum
//     - shrSH
//     - shrSL
//     - rotrSH
//     - rotrSL
//     - rotrBH
//     - rotrBL
//     - rotr32H
//     - rotr32L
//     - add3L
//     - add3H
//     - add4L
//     - add4H
//     - add5L
//     - add5H
//   @noble/hashes 2.4.0 — utils.js:
//     - ahash
//     - u8
//     - createView
//     - rotr
//     - rotl
//     - swap8IfBE
//     - hasHexBuiltin
//     - hexes
//     - bytesToHex
//     - asciiToBase16
//     - hexToBytes
//     - nextTick
//     - asyncLoop
//     - utf8ToBytes
//     - kdfInputToBytes
//     - concatBytes
//   @noble/hashes 2.4.0 — sha3.js:
//     - sha3_224
//     - sha3_384
//     - keccak_224
//     - keccak_256
//     - keccak_384
//     - keccak_512
//     - shake128_32
//     - shake256_64
//   @noble/curves 2.4.0 — abstract/fft.js:
//     - nextPowerOfTwo
//     - bitReversalPermutation
//     - _1nFft
//     - findGenerator
//     - rootsOfUnity
//     - FFT
//   @noble/post-quantum 0.7.1 — utils.js:
//     - abytesDoc
//     - concatBytesDoc
//     - byteSwap64
//     - baswap64If
//     - validateOpts
//     - VER_OPT_KEYS
//     - SIG_OPT_KEYS
//     - checkOptKeys
//     - validateVerOpts
//     - validateSigOpts
//     - EMPTY
//     - getMessage
//     - oidNistP
//     - XOF_OID_OUTPUT_LEN
//     - checkHash
//     - getMessagePrehash
//     - astring
//   @noble/post-quantum 0.7.1 — _crystals.js:
//     - XOF256
//   @noble/post-quantum 0.7.1 — ml-kem.js:
//     - ml_kem512
//     - ml_kem1024
//     - __tests
//
// Vendored size: 2243 lines / 89348 bytes (this file, as committed).
// (This is the number stage 3 step 4's reduction pass must make room for,
// plus the step 5 session wiring, under index.html's line ceiling.)
//
// LICENSE: MIT, (c) 2024 Paul Miller (https://paulmillr.com) — the license of
// all three vendored packages. Full text:
// The MIT License (MIT)
// 
// Copyright (c) 2024 Paul Miller (https://paulmillr.com)
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the “Software”), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
// ============================================================================

// ---- @noble/hashes 2.4.0 — _u64.js ----
const U32_MASK64 = /* @__PURE__ */ (() => BigInt(2 ** 32 - 1))();

// ---- @noble/hashes 2.4.0 — _u64.js ----
const _32n = /* @__PURE__ */ BigInt(32);
// Split bigint into two 32-bit halves. With `le=true`, returned fields become `{ h: low, l: high
// }` to match little-endian word order rather than the property names.

// ---- @noble/hashes 2.4.0 — _u64.js ----
function fromBig(n, le = false) {
    if (le)
        return { h: Number(n & U32_MASK64), l: Number((n >> _32n) & U32_MASK64) };
    return { h: Number((n >> _32n) & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
// Split bigint list into `[highWords, lowWords]` when `le=false`; with `le=true`, the first array
// holds the low halves because `fromBig(...)` swaps the semantic meaning of `h` and `l`.

// ---- @noble/hashes 2.4.0 — _u64.js ----
function split(lst, le = false) {
    const len = lst.length;
    let Ah = new Uint32Array(len);
    let Al = new Uint32Array(len);
    for (let i = 0; i < len; i++) {
        const { h, l } = fromBig(lst[i], le);
        [Ah[i], Al[i]] = [h, l];
    }
    return [Ah, Al];
}
// Combine explicit `(high, low)` 32-bit halves into a bigint; `>>> 0` normalizes signed JS
// bitwise results back to uint32 first, and little-endian callers must swap.

// ---- @noble/hashes 2.4.0 — _u64.js ----
function add(Ah, Al, Bh, Bl) {
    const l = (Al >>> 0) + (Bl >>> 0);
    return { h: (Ah + Bh + ((l / 2 ** 32) | 0)) | 0, l: l | 0 };
}
// Addition with more than 2 elements
// Unmasked low-word accumulator for 3-way addition; pass the raw result into `add3H(...)`.

// ---- @noble/hashes 2.4.0 — utils.js ----
/**
 * Checks if something is Uint8Array. Be careful: nodejs Buffer will return true.
 * @param a - value to test
 * @returns `true` when the value is a Uint8Array-compatible view.
 * @example
 * Check whether a value is a Uint8Array-compatible view.
 * ```ts
 * isBytes(new Uint8Array([1, 2, 3]));
 * ```
 */
function isBytes(a) {
    // Plain `instanceof Uint8Array` is too strict for some Buffer / proxy / cross-realm cases.
    // The fallback still requires a real ArrayBuffer view, so plain
    // JSON-deserialized `{ constructor: ... }` spoofing is rejected, and
    // `BYTES_PER_ELEMENT === 1` keeps the fallback on byte-oriented views.
    return (a instanceof Uint8Array ||
        (ArrayBuffer.isView(a) &&
            a.constructor.name === 'Uint8Array' &&
            'BYTES_PER_ELEMENT' in a &&
            a.BYTES_PER_ELEMENT === 1));
}
// Shared error-message prefix builder. Only called on throw paths, so assert
// success paths never pay for the string concatenation.

// ---- @noble/hashes 2.4.0 — utils.js ----
const atitle = (title) => (title ? `"${title}" ` : '');
/**
 * Asserts something is a non-negative integer.
 * @param n - number to validate
 * @param title - label included in thrown errors
 * @returns The validated number.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate a non-negative integer option.
 * ```ts
 * anumber(32, 'length');
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
function anumber(n, title = '') {
    if (typeof n !== 'number')
        throw new TypeError(atitle(title) + 'expected number, got ' + typeof n);
    if (!Number.isSafeInteger(n) || n < 0)
        throw new RangeError(atitle(title) + 'expected integer >= 0, got ' + n);
    return n;
}
/**
 * Asserts something is a boolean.
 * @param value - value to validate
 * @param title - label included in thrown errors
 * @returns The validated boolean.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Validate a boolean option.
 * ```ts
 * abool(true, 'enableXOF');
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
function abool(value, title = '') {
    if (typeof value !== 'boolean')
        throw new TypeError(atitle(title) + 'expected boolean, got type=' + typeof value);
    return value;
}
/**
 * Asserts something is Uint8Array.
 * @param value - value to validate
 * @param length - optional exact length constraint
 * @param title - label included in thrown errors
 * @returns The validated byte array.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate that a value is a byte array.
 * ```ts
 * abytes(new Uint8Array([1, 2, 3]));
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
function abytes(value, length, title = '') {
    // Success path first: this runs at the start of every update() / digestInto(), and the
    // common `abytes(data)` form must not pay for length handling it does not use.
    if (isBytes(value) && (length === undefined || value.length === length))
        return value;
    // Error path: recompute freely to build the exact message.
    if (length !== undefined)
        anumber(length, 'length');
    const bytes = isBytes(value);
    const ofLen = length !== undefined ? ` of length ${length}` : '';
    const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
    const message = atitle(title) + 'expected Uint8Array' + ofLen + ', got ' + got;
    if (!bytes)
        throw new TypeError(message);
    throw new RangeError(message);
}
/**
 * Copies bytes into a fresh Uint8Array.
 * Buffer-style slices can alias the same backing store, so callers that need ownership should copy.
 * @param bytes - source bytes to clone
 * @returns Freshly allocated copy of `bytes`.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Clone a byte array before mutating it.
 * ```ts
 * const copy = copyBytes(new Uint8Array([1, 2, 3]));
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
const aobject = (value, label) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError((label === 'object' ? '' : `"${label}" `) + 'expected object, got type=' + typeof value);
};

// ---- @noble/hashes 2.4.0 — utils.js ----
const aopts = (value, label) => {
    aobject(value, label);
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null)
        throw new TypeError(`"${label}" expected plain object`);
    // Object.assign() treats an own "__proto__" source key as a write to the target's legacy
    // prototype setter. Reject it before merging so inherited option values cannot be injected.
    if (Object.hasOwn(value, '__proto__'))
        throw new TypeError(`"${label}.__proto__" is not allowed`);
};
/**
 * Asserts a hash instance has not been destroyed or finished.
 * @param instance - hash instance to validate
 * @param checkFinished - whether to reject finalized instances
 * @throws If the hash instance has already been destroyed or finalized. {@link Error}
 * @example
 * Validate that a hash instance is still usable.
 * ```ts
 * import { aexists } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const hash = sha256.create();
 * aexists(hash);
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
function aexists(instance, checkFinished = true) {
    // Runs on every update()/digestInto(); the flags are library-owned booleans, so only their
    // truthiness is checked - re-validating their type per call was pure hot-path overhead.
    if (instance.destroyed)
        throw new Error('hash was destroyed');
    if (checkFinished && instance.finished)
        throw new Error('digest() was already called');
}
/**
 * Asserts output is a sufficiently-sized byte array.
 * @param out - destination buffer
 * @param instance - hash instance providing output length
 * Oversized buffers are allowed; downstream code only promises to fill the first `outputLen` bytes.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate a caller-provided digest buffer.
 * ```ts
 * import { aoutput } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const hash = sha256.create();
 * aoutput(new Uint8Array(hash.outputLen), hash);
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
function aoutput(out, instance) {
    abytes(out, undefined, 'output');
    // `outputLen` is a library-owned readonly number; the negated comparison keeps failing fast
    // when it is missing/NaN (comparisons with undefined/NaN are false) without an anumber() call.
    const min = instance.outputLen;
    if (!(out.length >= min)) {
        throw new RangeError('"output" expected length >= ' + min);
    }
}
/**
 * Casts a typed array view to Uint8Array.
 * @param arr - source typed array
 * @returns Uint8Array view over the same buffer.
 * @example
 * Reinterpret a typed array as bytes.
 * ```ts
 * u8(new Uint32Array([1, 2]));
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
/**
 * Zeroizes typed arrays in place. Warning: JS provides no guarantees.
 * @param arrays - arrays to overwrite with zeros
 * @example
 * Zeroize sensitive buffers in place.
 * ```ts
 * clean(new Uint8Array([1, 2, 3]));
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
        arrays[i].fill(0);
    }
}
/**
 * Creates a DataView for byte-level manipulation.
 * @param arr - source typed array
 * @returns DataView over the same buffer region.
 * @example
 * Create a DataView over an existing buffer.
 * ```ts
 * createView(new Uint8Array(4));
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
/** Whether the current platform is little-endian. */
const isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44)();
/**
 * Byte-swap operation for uint32 values.
 * @param word - source word
 * @returns Word with reversed byte order.
 * @example
 * Reverse the byte order of a 32-bit word.
 * ```ts
 * byteSwap(0x11223344);
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
function byteSwap(word) {
    return (((word << 24) & 0xff000000) |
        ((word << 8) & 0xff0000) |
        ((word >>> 8) & 0xff00) |
        ((word >>> 24) & 0xff));
}
/**
 * Conditionally byte-swaps one 32-bit word on big-endian platforms.
 * @param n - source word
 * @returns Original or byte-swapped word depending on platform endianness.
 * @example
 * Normalize a 32-bit word for host endianness.
 * ```ts
 * swap8IfBE(0x11223344);
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
function byteSwap32(arr) {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = byteSwap(arr[i]);
    }
    return arr;
}
/**
 * Conditionally byte-swaps a Uint32Array on big-endian platforms.
 * @param u - array to normalize for host endianness
 * @returns Original or byte-swapped array depending on platform endianness.
 *   On big-endian runtimes this mutates `u` in place via `byteSwap32(...)`.
 * @example
 * Normalize a word array for host endianness.
 * ```ts
 * swap32IfBE(new Uint32Array([0x11223344]));
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
const swap32IfBE = isLE
    ? (u) => u
    : byteSwap32;
// Built-in hex conversion https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex

// ---- @noble/hashes 2.4.0 — utils.js ----
function checkOpts(defaults, opts, title = 'opts') {
    aopts(defaults, 'defaults');
    if (opts !== undefined)
        aopts(opts, title);
    // Callers read optional fields directly, so omitted values must not fall through to ambient
    // Object.prototype pollution (for example a forged `dkLen` changing SHAKE's default output).
    const merged = Object.assign(Object.create(null), defaults, opts);
    return merged;
}
/**
 * Creates a callable hash function from a stateful class constructor.
 * @param hashCons - hash constructor or factory
 * @param info - optional metadata such as DER OID
 * @returns Frozen callable hash wrapper with `.create()`.
 *   Wrapper construction eagerly calls `hashCons(undefined)` once to read
 *   `outputLen` / `blockLen`, so constructor side effects happen at module
 *   init time.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Wrap a stateful hash constructor into a callable helper.
 * ```ts
 * import { createHasher } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const wrapped = createHasher(sha256.create, { oid: sha256.oid });
 * wrapped(new Uint8Array([1]));
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
function createHasher(hashCons, info = {}) {
    if (typeof hashCons !== 'function')
        throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
    info = checkOpts({}, info, 'info');
    const hashC = (msg, opts) => hashCons(opts)
        .update(msg)
        .digest();
    const tmp = hashCons(undefined);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = (opts) => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
}
/**
 * Cryptographically secure PRNG backed by `crypto.getRandomValues`.
 * @param bytesLength - number of random bytes to generate
 * @returns Random bytes.
 * The platform `getRandomValues()` implementation still defines any
 * single-call length cap, and this helper rejects oversize requests
 * with a stable library `RangeError` instead of host-specific errors.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @throws If the current runtime does not provide `crypto.getRandomValues`. {@link Error}
 * @example
 * Generate a fresh random key or nonce.
 * ```ts
 * const key = randomBytes(16);
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
function randomBytes(bytesLength = 32) {
    // Match the repo's other length-taking helpers instead of relying on Uint8Array coercion.
    anumber(bytesLength, 'bytesLength');
    const cr = typeof globalThis === 'object' ? globalThis.crypto : null;
    if (typeof cr?.getRandomValues !== 'function')
        throw new Error('crypto.getRandomValues must be defined');
    // Web Cryptography API Level 2 §10.1.1:
    // if `byteLength > 65536`, throw `QuotaExceededError`.
    // Keep the guard explicit so callers can see the quota in code
    // instead of discovering it by reading the spec or host errors.
    // This wrapper surfaces the same quota as a stable library RangeError.
    if (bytesLength > 65536)
        throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
    return cr.getRandomValues(new Uint8Array(bytesLength));
}
/**
 * Creates OID metadata for NIST hashes with prefix `06 09 60 86 48 01 65 03 04 02`.
 * @param suffix - final OID byte for the selected hash.
 *   The helper accepts any byte even though only the documented NIST hash
 *   suffixes are meaningful downstream.
 * @returns Object containing the DER-encoded OID.
 * @example
 * Build OID metadata for a NIST hash.
 * ```ts
 * oidNist(0x01);
 * ```
 */

// ---- @noble/hashes 2.4.0 — utils.js ----
const oidNist = (suffix) => ({
    // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
    // Larger suffix values would need base-128 OID encoding and a different length byte.
    oid: Uint8Array.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, suffix]),
});

// ---- @noble/hashes 2.4.0 — sha3.js ----
// prettier-ignore
// No __PURE__ annotations in sha3 header:
// EVERYTHING is in fact used on every export.
// Various per round constants calculations
const _0n = BigInt(0);

// ---- @noble/hashes 2.4.0 — sha3.js ----
const _1n = BigInt(1);

// ---- @noble/hashes 2.4.0 — sha3.js ----
const _2n = BigInt(2);

// ---- @noble/hashes 2.4.0 — sha3.js ----
const _7n = BigInt(7);

// ---- @noble/hashes 2.4.0 — sha3.js ----
const _256n = BigInt(256);
// FIPS 202 Algorithm 5 rc(): when the outgoing bit is 1, the 8-bit LFSR xors
// taps 0, 4, 5, and 6, which compresses to the feedback mask `0x71`.

// ---- @noble/hashes 2.4.0 — sha3.js ----
const _0x71n = BigInt(0x71);

// ---- @noble/hashes 2.4.0 — sha3.js ----
const SHA3_PI = [];

// ---- @noble/hashes 2.4.0 — sha3.js ----
const SHA3_ROTL = [];

// ---- @noble/hashes 2.4.0 — sha3.js ----
const _SHA3_IOTA = []; // no pure annotation: var is always used
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
    // Pi
    [x, y] = [y, (2 * x + 3 * y) % 5];
    SHA3_PI.push(2 * (5 * y + x));
    // Rotational
    SHA3_ROTL.push((((round + 1) * (round + 2)) / 2) % 64);
    // Iota
    let t = _0n;
    for (let j = 0; j < 7; j++) {
        R = ((R << _1n) ^ ((R >> _7n) * _0x71n)) % _256n;
        if (R & _2n)
            t ^= _1n << ((_1n << BigInt(j)) - _1n);
    }
    _SHA3_IOTA.push(t);
}

// ---- @noble/hashes 2.4.0 — sha3.js ----
const IOTAS = split(_SHA3_IOTA, true);
// `split(..., true)` keeps the local little-endian lane-word layout used by
// `state32`, so these `H` / `L` tables follow the file's first-word /
// second-word lane slots rather than `_u64.ts`'s usual high/low naming.

// ---- @noble/hashes 2.4.0 — sha3.js ----
const SHA3_IOTA_H = IOTAS[0];

// ---- @noble/hashes 2.4.0 — sha3.js ----
const SHA3_IOTA_L = IOTAS[1];
// 64-bit left rotates as u32 pairs. Inlined here (not imported from _u64) so V8 can
// inline them into keccakP — the import path costs ~24% on sha3_256. SHA3 is the only
// consumer of left-rotates; other hashes use right-rotates from _u64.
// Valid for s in 1..31 (SH/SL) and 33..63 (BH/BL); keccak never rotates by 0/32/64.

// ---- @noble/hashes 2.4.0 — sha3.js ----
const rotlSH = (h, l, s) => (h << s) | (l >>> (32 - s));

// ---- @noble/hashes 2.4.0 — sha3.js ----
const rotlSL = (h, l, s) => (l << s) | (h >>> (32 - s));

// ---- @noble/hashes 2.4.0 — sha3.js ----
const rotlBH = (h, l, s) => (l << (s - 32)) | (h >>> (64 - s));

// ---- @noble/hashes 2.4.0 — sha3.js ----
const rotlBL = (h, l, s) => (h << (s - 32)) | (l >>> (64 - s));

// ---- @noble/hashes 2.4.0 — sha3.js ----
const rotlH = (h, l, s) => (s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s));

// ---- @noble/hashes 2.4.0 — sha3.js ----
const rotlL = (h, l, s) => (s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s));
// Reused Theta scratch buffer (column parities), same pattern as SHA256_W in sha2.
// keccakP never calls user code, so the shared buffer cannot be observed mid-permutation.

// ---- @noble/hashes 2.4.0 — sha3.js ----
const B = new Uint32Array(5 * 2);
/**
 * `keccakf1600` internal permutation, additionally allows adjusting the round count.
 * @param s - 5x5 Keccak state encoded as 25 lanes split into 50 uint32 words
 *   in this file's local little-endian lane-word order
 * @param rounds - number of rounds to execute
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @throws If `rounds` is outside the supported `1..24` range. {@link Error}
 * @example
 * Permute a Keccak state with the default 24 rounds.
 * ```ts
 * keccakP(new Uint32Array(50));
 * ```
 */

// ---- @noble/hashes 2.4.0 — sha3.js ----
function keccakP(s, rounds = 24) {
    if (!(s instanceof Uint32Array))
        throw new TypeError('"s" expected Uint32Array(50), got type=' + typeof s);
    if (s.length !== 50)
        throw new RangeError('"s" expected Uint32Array(50), got length=' + s.length);
    anumber(rounds, 'rounds');
    // This implementation precomputes only the standard Keccak-f[1600] 24-round Iota table.
    if (rounds < 1 || rounds > 24)
        throw new Error('"rounds" expected integer 1..24');
    // NOTE: all indices are x2 since we store state as u32 instead of u64 (bigints to slow in js)
    for (let round = 24 - rounds; round < 24; round++) {
        // Theta θ
        for (let x = 0; x < 10; x++)
            B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
        for (let x = 0; x < 10; x += 2) {
            const idx1 = (x + 8) % 10;
            const idx0 = (x + 2) % 10;
            const B0 = B[idx0];
            const B1 = B[idx0 + 1];
            const Th = rotlH(B0, B1, 1) ^ B[idx1];
            const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
            for (let y = 0; y < 50; y += 10) {
                s[x + y] ^= Th;
                s[x + y + 1] ^= Tl;
            }
        }
        // Rho (ρ) and Pi (π)
        let curH = s[2];
        let curL = s[3];
        for (let t = 0; t < 24; t++) {
            const shift = SHA3_ROTL[t];
            const Th = rotlH(curH, curL, shift);
            const Tl = rotlL(curH, curL, shift);
            const PI = SHA3_PI[t];
            curH = s[PI];
            curL = s[PI + 1];
            s[PI] = Th;
            s[PI + 1] = Tl;
        }
        // Chi (χ)
        // Same as:
        // for (let x = 0; x < 10; x++) B[x] = s[y + x];
        // for (let x = 0; x < 10; x++) s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
        for (let y = 0; y < 50; y += 10) {
            const b0 = s[y], b1 = s[y + 1], b2 = s[y + 2], b3 = s[y + 3];
            s[y] ^= ~s[y + 2] & s[y + 4];
            s[y + 1] ^= ~s[y + 3] & s[y + 5];
            s[y + 2] ^= ~s[y + 4] & s[y + 6];
            s[y + 3] ^= ~s[y + 5] & s[y + 7];
            s[y + 4] ^= ~s[y + 6] & s[y + 8];
            s[y + 5] ^= ~s[y + 7] & s[y + 9];
            s[y + 6] ^= ~s[y + 8] & b0;
            s[y + 7] ^= ~s[y + 9] & b1;
            s[y + 8] ^= ~b0 & b2;
            s[y + 9] ^= ~b1 & b3;
        }
        // Iota (ι)
        s[0] ^= SHA3_IOTA_H[round];
        s[1] ^= SHA3_IOTA_L[round];
    }
    clean(B);
}
/**
 * Keccak sponge function.
 * @param blockLen - absorb/squeeze rate in bytes
 * @param suffix - domain separation suffix byte
 * @param outputLen - default digest length in bytes. This base sponge only
 *   requires a non-negative integer; wrappers that need positive output
 *   lengths must enforce that themselves.
 * @param enableXOF - whether XOF output is allowed
 * @param rounds - number of Keccak-f rounds
 * @example
 * Build a sponge state, absorb bytes, then finalize a digest.
 * ```ts
 * const hash = new Keccak(136, 0x06, 32);
 * hash.update(new Uint8Array([1, 2, 3]));
 * hash.digest();
 * ```
 */

// ---- @noble/hashes 2.4.0 — sha3.js ----
class Keccak {
    state;
    pos = 0;
    posOut = 0;
    finished = false;
    state32;
    destroyed = false;
    blockLen;
    suffix;
    outputLen;
    canXOF;
    enableXOF = false;
    rounds;
    // NOTE: we accept arguments in bytes instead of bits here.
    constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        anumber(blockLen, 'blockLen');
        anumber(suffix, 'suffix');
        anumber(rounds, 'rounds');
        abool(enableXOF, 'enableXOF');
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.canXOF = enableXOF;
        this.rounds = rounds;
        // Can be passed from user as dkLen
        anumber(outputLen, 'outputLen');
        // Only keccak-f1600 is supported: 1600 bits (5x5 matrix of 64bit) === 200 bytes of state.
        if (!(0 < blockLen && blockLen < 200))
            throw new Error('"blockLen" must be 1..199');
        this.state = new Uint8Array(200);
        this.state32 = u32(this.state);
    }
    clone() {
        return this._cloneInto();
    }
    keccak() {
        swap32IfBE(this.state32);
        keccakP(this.state32, this.rounds);
        swap32IfBE(this.state32);
        this.posOut = 0;
        this.pos = 0;
    }
    update(data) {
        aexists(this);
        abytes(data);
        const { blockLen, state, state32 } = this;
        const len = data.length;
        // Absorb full blocks with u32 XORs when both sides are 4-byte aligned.
        // XOR of same-position words equals XOR of same-position bytes, so this is endianness-safe.
        const canUseU32 = blockLen % 4 === 0 && data.byteOffset % 4 === 0;
        const blockLen32 = blockLen / 4;
        const data32 = canUseU32 && len >= blockLen ? u32(data) : undefined;
        for (let pos = 0; pos < len;) {
            if (data32 !== undefined && this.pos === 0 && pos % 4 === 0 && len - pos >= blockLen) {
                for (let i = 0, o = pos / 4; i < blockLen32; i++)
                    state32[i] ^= data32[o + i];
                pos += blockLen;
                // Subclasses (_KeccakPRG) read `this.pos` inside their `keccak()` override,
                // so it must reflect the fully-absorbed block before the permutation fires.
                this.pos = blockLen;
                this.keccak();
                continue;
            }
            const take = Math.min(blockLen - this.pos, len - pos);
            for (let i = 0; i < take; i++)
                state[this.pos++] ^= data[pos++];
            if (this.pos === blockLen)
                this.keccak();
        }
        return this;
    }
    finish() {
        if (this.finished)
            return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        // FIPS 202 appends the SHA3/SHAKE domain-separation suffix before pad10*1.
        // These byte values already include the first padding bit, while the
        // final `0x80` below supplies the closing `1` bit in the last rate byte.
        state[pos] ^= suffix;
        // If that combined suffix lands in the last rate byte and already sets
        // bit 7, absorb it first so the final pad10*1 bit can be xored into a
        // fresh block.
        if ((suffix & 0x80) !== 0 && pos === blockLen - 1)
            this.keccak();
        state[blockLen - 1] ^= 0x80;
        this.keccak();
    }
    writeInto(out) {
        aexists(this, false);
        abytes(out);
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len;) {
            if (this.posOut >= blockLen)
                this.keccak();
            const take = Math.min(blockLen - this.posOut, len - pos);
            out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
            this.posOut += take;
            pos += take;
        }
        return out;
    }
    xofInto(out) {
        // Plain SHA3/Keccak usage with XOF is probably a mistake, but this base
        // class is also reused by SHAKE/cSHAKE/KMAC/TupleHash/ParallelHash/
        // TurboSHAKE/KangarooTwelve wrappers that intentionally enable XOF.
        if (!this.enableXOF)
            throw new Error('XOF is not enabled');
        return this.writeInto(out);
    }
    xof(bytes) {
        anumber(bytes);
        return this.xofInto(new Uint8Array(bytes));
    }
    digestInto(out) {
        aoutput(out, this);
        if (this.finished)
            throw new Error('digest() was already called');
        // `aoutput(...)` allows oversized buffers; digestInto() must fill only the advertised digest.
        this.writeInto(out.length === this.outputLen ? out : out.subarray(0, this.outputLen));
        this.destroy();
    }
    digest() {
        const out = new Uint8Array(this.outputLen);
        this.digestInto(out);
        return out;
    }
    destroy() {
        this.destroyed = true;
        clean(this.state);
    }
    _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to ||= new Keccak(blockLen, suffix, outputLen, enableXOF, rounds);
        // Reused destinations can come from a different rate/capacity variant, so clone must rewrite
        // the sponge geometry as well as the state words.
        to.blockLen = blockLen;
        to.state32.set(this.state32);
        // Sponge padding and XOF output are positional, so both offsets are part of the clone state.
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        // Suffix can change in cSHAKE
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        // Clones must preserve the public capability bit too; `_KMAC` reuses this path and deep clone
        // tests compare instance fields directly, so leaving `canXOF` behind makes the clone lie.
        to.canXOF = this.canXOF;
        to.destroyed = this.destroyed;
        return to;
    }
}

// ---- @noble/hashes 2.4.0 — sha3.js ----
const genKeccak = (suffix, blockLen, outputLen, info = {}) => createHasher(() => new Keccak(blockLen, suffix, outputLen), info);
/**
 * SHA3-224 hash function.
 * @param msg - message bytes to hash
 * @param opts - Reserved hash options.
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA3-224.
 * ```ts
 * sha3_224(new Uint8Array([97, 98, 99]));
 * ```
 */

// ---- @noble/hashes 2.4.0 — sha3.js ----
const sha3_256 = /* @__PURE__ */ genKeccak(0x06, 136, 32, 
/* @__PURE__ */ oidNist(0x08));
/**
 * SHA3-384 hash function.
 * @param msg - message bytes to hash
 * @param opts - Reserved hash options.
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA3-384.
 * ```ts
 * sha3_384(new Uint8Array([97, 98, 99]));
 * ```
 */

// ---- @noble/hashes 2.4.0 — sha3.js ----
const sha3_512 = /* @__PURE__ */ genKeccak(0x06, 72, 64, 
/* @__PURE__ */ oidNist(0x0a));
/**
 * Keccak-224 hash function.
 * @param msg - message bytes to hash
 * @param opts - Reserved hash options.
 * @returns Digest bytes.
 * @example
 * Hash a message with Keccak-224.
 * ```ts
 * keccak_224(new Uint8Array([97, 98, 99]));
 * ```
 */

// ---- @noble/hashes 2.4.0 — sha3.js ----
const genShake = (suffix, blockLen, outputLen, info = {}) => createHasher((opts = {}) => {
    opts = checkOpts({}, opts);
    return new Keccak(blockLen, suffix, opts.dkLen === undefined ? outputLen : opts.dkLen, true);
}, info);
/**
 * SHAKE128 XOF with 128-bit security and a 16-byte default output.
 * @param msg - message bytes to hash
 * @param opts - Optional output-length override. See {@link ShakeOpts}.
 * @returns Digest bytes.
 * @example
 * Hash a message with SHAKE128.
 * ```ts
 * shake128(new Uint8Array([97, 98, 99]), { dkLen: 32 });
 * ```
 */

// ---- @noble/hashes 2.4.0 — sha3.js ----
const shake128 = 
/* @__PURE__ */
genShake(0x1f, 168, 16, /* @__PURE__ */ oidNist(0x0b));
/**
 * SHAKE256 XOF with 256-bit security and a 32-byte default output.
 * @param msg - message bytes to hash
 * @param opts - Optional output-length override. See {@link ShakeOpts}.
 * @returns Digest bytes.
 * @example
 * Hash a message with SHAKE256.
 * ```ts
 * shake256(new Uint8Array([97, 98, 99]), { dkLen: 64 });
 * ```
 */

// ---- @noble/hashes 2.4.0 — sha3.js ----
const shake256 = 
/* @__PURE__ */
genShake(0x1f, 136, 32, /* @__PURE__ */ oidNist(0x0c));
/**
 * SHAKE128 XOF with 256-bit output (NIST version).
 * @param msg - message bytes to hash
 * @param opts - Optional output-length override. See {@link ShakeOpts}.
 * @returns Digest bytes.
 * @example
 * Hash a message with SHAKE128 using a 32-byte default output.
 * ```ts
 * shake128_32(new Uint8Array([97, 98, 99]), { dkLen: 32 });
 * ```
 */

// ---- @noble/curves 2.4.0 — utils.js (aobject, validateObject only) ----
/**
 * Asserts something is a plain object-ish value, not null or array.
 * @param value - Value to validate.
 * @param title - Label included in thrown errors.
 * @returns The validated object.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Validate an options object before checking fields.
 *
 * ```ts
 * aobjectC({ flag: true });
 * ```
 */
function aobjectC(value, title = 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(title === 'object'
            ? 'expected valid options object'
            : `"${title}" expected object, got type=${typeof value}`);
    return value;
}
/**
 * Validates declared required and optional field types on a plain object.
 * Extra keys are intentionally ignored because many callers validate only the subset they use from
 * richer option bags or runtime objects.
 * This walks field schemas and formats detailed errors, so avoid it on hot paths; use direct
 * one-line guards such as `aobjectC()`, `afunction()`, `abool()`, or `asafenumber()` instead.
 * @param object - Object to validate.
 * @param fields - Required field types.
 * @param optFields - Optional field types.
 * @param title - Object label included in thrown errors.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Check user options before building a curve helper.
 *
 * ```ts
 * validateObject({ flag: true }, { flag: 'boolean' });
 * ```
 */

// ---- @noble/curves 2.4.0 — utils.js (aobject, validateObject only) ----
function validateObject(object, fields = {}, optFields = {}, title = 'object') {
    aobjectC(object, title);
    aobjectC(fields, 'fields');
    aobjectC(optFields, 'optFields');
    function checkField(fieldName, expectedType, isOpt) {
        const label = title === 'object' ? `param "${String(fieldName)}"` : `"${title}.${String(fieldName)}"`;
        // Config fields must be explicit own properties. Optional inherited values are rejected too
        // because callers keep reading the same options object after validation.
        const val = object[fieldName];
        // Runtime objects such as Field instances intentionally satisfy required method slots
        // via their shared prototype.
        if (!Object.hasOwn(object, fieldName) &&
            (isOpt ? val !== undefined : expectedType !== 'function')) {
            throw new TypeError(`${label} is invalid: expected own property`);
        }
        if (isOpt && val === undefined)
            return;
        const current = typeof val;
        if (current !== expectedType || val === null)
            throw new TypeError(`${label} is invalid: expected ${expectedType}, got ${current}`);
    }
    const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
    iter(fields, false);
    iter(optFields, true);
}

// ---- @noble/curves 2.4.0 — abstract/fft.js ----
function checkU32(n, title = 'n') {
    // 0xff_ff_ff_ff
    if (typeof n !== 'number')
        throw new TypeError(`wrong u32 integer "${title}": expected number, got type=${typeof n}`);
    if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff)
        throw new RangeError(`wrong u32 integer "${title}": expected 0..4294967295, got ${n}`);
    return n;
}
/**
 * Checks if integer is in form of `1 << X`.
 * @param x - Integer to inspect.
 * @returns `true` when the value is a power of two.
 * @example
 * Validate that an FFT size is a power of two.
 *
 * ```ts
 * isPowerOfTwo(8);
 * ```
 */

// ---- @noble/curves 2.4.0 — abstract/fft.js ----
function isPowerOfTwo(x) {
    checkU32(x, 'x');
    return (x & (x - 1)) === 0 && x !== 0;
}
/**
 * @param n - Input value.
 * @returns Next power of two within the u32/array-length domain.
 * @throws If `n` is not a valid unsigned 32-bit integer. {@link Error}
 * @example
 * Round an integer up to the FFT size it needs.
 *
 * ```ts
 * nextPowerOfTwo(9);
 * ```
 */

// ---- @noble/curves 2.4.0 — abstract/fft.js ----
function reverseBits(n, bits) {
    checkU32(n);
    if (typeof bits !== 'number')
        throw new TypeError('"bits" expected number, got type=' + typeof bits);
    if (!Number.isSafeInteger(bits) || bits < 0 || bits > 32)
        throw new Error(`expected integer 0 <= bits <= 32, got ${bits}`);
    let reversed = 0;
    for (let i = 0; i < bits; i++, n >>>= 1)
        reversed = (reversed << 1) | (n & 1);
    // JS bitwise ops are signed i32; cast back so 32-bit reversals stay in the unsigned u32 domain.
    return reversed >>> 0;
}
/**
 * Similar to `bitLen(x)-1` but much faster for small integers, like indices.
 * @param n - Input value.
 * @returns Base-2 logarithm. For `n = 0`, the current implementation returns `-1`.
 * @example
 * Compute the radix-2 stage count for one transform size.
 *
 * ```ts
 * log2(8);
 * ```
 */

// ---- @noble/curves 2.4.0 — abstract/fft.js ----
function log2(n) {
    checkU32(n);
    return 31 - Math.clz32(n);
}
/**
 * Moves lowest bit to highest position, which at first step splits
 * array on even and odd indices, then it applied again to each part,
 * which is core of fft
 * @param values - Mutable coefficient array.
 * @returns Mutated input array.
 * @throws If the array length is not a positive power of two. {@link Error}
 * @example
 * Reorder coefficients into bit-reversed order in place.
 *
 * ```ts
 * const values = Uint8Array.from([0, 1, 2, 3]);
 * bitReversalInplace(values);
 * ```
 */

// ---- @noble/curves 2.4.0 — abstract/fft.js ----
function bitReversalInplace(values) {
    if (!values ||
        typeof values !== 'object' ||
        typeof values.length !== 'number')
        throw new TypeError('"values" expected array-like, got type=' + typeof values);
    const n = values.length;
    // Size-1 FFT is the identity, so bit-reversal must stay a no-op there instead of rejecting it.
    if (!isPowerOfTwo(n))
        throw new Error('expected positive power-of-two length, got ' + n);
    const bits = log2(n);
    for (let i = 0; i < n; i++) {
        const j = reverseBits(i, bits);
        if (i < j) {
            const tmp = values[i];
            values[i] = values[j];
            values[j] = tmp;
        }
    }
    return values;
}
/**
 * @param values - Input values.
 * @returns Reordered copy.
 * @throws If the array length is not a positive power of two. {@link Error}
 * @example
 * Return a reordered copy instead of mutating the input in place.
 *
 * ```ts
 * const reordered = bitReversalPermutation([0, 1, 2, 3]);
 * ```
 */

// ---- @noble/curves 2.4.0 — abstract/fft.js ----
const FFTCore = (F, coreOpts) => {
    validateObject(coreOpts, { N: 'number', roots: 'object', dit: 'boolean' }, { invertButterflies: 'boolean', skipStages: 'number', brp: 'boolean' }, 'coreOpts');
    const { N, roots, dit, invertButterflies = false, skipStages = 0, brp = true } = coreOpts;
    checkU32(N, 'coreOpts.N');
    const bits = log2(N);
    if (!isPowerOfTwo(N))
        throw new Error('FFT: Polynomial size should be power of two');
    checkU32(skipStages, 'coreOpts.skipStages');
    const maxSkipStages = bits === 0 ? 0 : bits - 1;
    // Skipping every stage leaves only boundary layout changes, not a valid FFT loop shape.
    if (skipStages > maxSkipStages)
        throw new Error(`FFT: wrong skipStages: expected 0 <= skipStages <= ${maxSkipStages}`);
    // Wrong-sized root tables can stay in-bounds for some loop shapes and silently compute nonsense.
    if (roots.length !== N)
        throw new Error(`FFT: wrong roots length: expected ${N}, got ${roots.length}`);
    const isDit = dit !== invertButterflies;
    return (values) => {
        if (values.length !== N)
            throw new Error('FFT: wrong Polynomial length');
        if (dit && brp)
            bitReversalInplace(values);
        for (let i = 0, g = 1; i < bits - skipStages; i++) {
            // For each stage s (sub-FFT length m = 2^s)
            const s = dit ? i + 1 + skipStages : bits - i;
            const m = 1 << s;
            const m2 = m >> 1;
            const stride = N >> s;
            // Loop over each subarray of length m
            for (let k = 0; k < N; k += m) {
                // Loop over each butterfly within the subarray
                for (let j = 0, grp = g++; j < m2; j++) {
                    const rootPos = invertButterflies ? (dit ? N - grp : grp) : j * stride;
                    const i0 = k + j;
                    const i1 = k + j + m2;
                    const omega = roots[rootPos];
                    const b = values[i1];
                    const a = values[i0];
                    // Inlining gives us 10% perf in kyber vs functions
                    if (isDit) {
                        const t = F.mul(b, omega); // Standard DIT butterfly
                        values[i0] = F.add(a, t);
                        values[i1] = F.sub(a, t);
                    }
                    else if (invertButterflies) {
                        values[i0] = F.add(b, a); // DIT loop + inverted butterflies (Kyber decode)
                        values[i1] = F.mul(F.sub(b, a), omega);
                    }
                    else {
                        values[i0] = F.add(a, b); // Standard DIF butterfly
                        values[i1] = F.mul(F.sub(a, b), omega);
                    }
                }
            }
        }
        if (!dit && brp)
            bitReversalInplace(values);
        return values;
    };
};
/**
 * NTT aka FFT over finite field (NOT over complex numbers).
 * Naming mirrors other libraries.
 * @param roots - Roots-of-unity cache.
 * @param opts - Field operations. See {@link FFTOpts}.
 * @returns Forward and inverse FFT helpers.
 * @example
 * NTT aka FFT over finite field (NOT over complex numbers).
 *
 * ```ts
 * import { FFT, rootsOfUnity } from '@noble/curves/abstract/fft.js';
 * import { Field } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const fft = FFT(rootsOfUnity(Fp), Fp);
 * const values = fft.direct([1n, 2n, 3n, 4n]);
 * ```
 */

// ---- @noble/post-quantum 0.7.1 — utils.js ----
// Import-alias binding from @noble/post-quantum utils.js
// (its `abytes as abytes_` import of @noble/hashes' abytes):
const abytes_ = abytes;
/**
 * Asserts that a value is a byte array and optionally checks its length.
 * Returns the original reference unchanged on success, and currently also accepts Node `Buffer`
 * values through the upstream validator.
 * This helper throws on malformed input, so APIs that must return `false` need to guard lengths
 * before decoding or before calling it.
 * @example
 * Validate that a value is a byte array with the expected length.
 * ```ts
 * abytes(new Uint8Array([1]), 1);
 * ```
 */

// ---- @noble/post-quantum 0.7.1 — utils.js ----
function aarray(item, title, inner = () => { }) {
    if (!Array.isArray(item))
        throw new TypeError(`"${title}" expected array, got type=${typeof item}`);
    for (let i = 0; i < item.length; i++)
        inner(item[i], `${title}[${i}]`);
    return item;
}

// ---- @noble/post-quantum 0.7.1 — utils.js ----
function equalBytes(a, b) {
    a = abytes(a);
    b = abytes(b);
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
        diff |= a[i] ^ b[i];
    return diff === 0;
}
/**
 * Copies bytes into a fresh `Uint8Array`.
 * Returns a detached plain `Uint8Array` after validating that the input is real bytes.
 * @param bytes - Source bytes.
 * @returns Copy of the input bytes.
 * @example
 * Copy bytes into a fresh array.
 * ```ts
 * copyBytes(new Uint8Array([1, 2]));
 * ```
 */

// ---- @noble/post-quantum 0.7.1 — utils.js ----
function copyBytes(bytes) {
    // The typed-array constructor copies a typed-array source through its internal byte storage.
    // Unlike `Uint8Array.from`, it does not invoke a subclass-overridden iterator. Keep the explicit
    // validation because the constructor itself would also accept arrays and other typed arrays.
    return new Uint8Array(abytes(bytes));
}
/**
 * Byte-swaps each 64-bit lane in place.
 * Falcon's exact binary64 tables are stored as little-endian byte payloads, so BE runtimes need
 * this boundary helper before aliasing them as host `Float64Array` lanes.
 * @param arr - Byte buffer whose length is a multiple of 8.
 * @returns The same buffer after in-place 64-bit lane byte swaps.
 * @example
 * Byte-swap one 64-bit lane in place.
 * ```ts
 * byteSwap64(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
 * ```
 */

// ---- @noble/post-quantum 0.7.1 — utils.js ----
function splitCoder(label, ...lengths) {
    const getLength = (c) => typeof c === 'number' ? c : c.bytesLen;
    const bytesLen = lengths.reduce((sum, a) => sum + getLength(a), 0);
    return {
        bytesLen,
        encode: (bufs) => {
            const res = new Uint8Array(bytesLen);
            for (let i = 0, pos = 0; i < lengths.length; i++) {
                const c = lengths[i];
                const l = getLength(c);
                const b = typeof c === 'number' ? bufs[i] : c.encode(bufs[i]);
                abytes_(b, l, label);
                res.set(b, pos);
                if (typeof c !== 'number')
                    b.fill(0); // clean
                pos += l;
            }
            return res;
        },
        decode: (buf) => {
            abytes_(buf, bytesLen, label);
            const res = [];
            for (const c of lengths) {
                const l = getLength(c);
                const b = buf.subarray(0, l);
                res.push(typeof c === 'number' ? b : c.decode(b));
                buf = buf.subarray(l);
            }
            return res;
        },
    };
}
// nano-packed.array (fixed size)
/**
 * Builds a fixed-length vector coder from another fixed-length coder.
 * Element decoding receives `subarray(...)` views, so aliasing depends on the element coder.
 * Element coder `encode(...)` results are treated as owned scratch: `vecCoder` copies them into
 * the output and then zeroizes them with `fill(0)`. If an element encoder forwards caller-owned
 * bytes, it must do so only after detaching them into a disposable copy. `vecCoder` also trusts
 * the `BytesCoderLen` contract: each encoded element must already be exactly `c.bytesLen` bytes.
 * @param c - Element coder.
 * @param vecLen - Number of elements in the vector.
 * @returns Fixed-length vector coder.
 * @example
 * Build a fixed-length vector coder from another fixed-length coder.
 * ```ts
 * vecCoder(
 *   { bytesLen: 1, encode: (n: number) => Uint8Array.of(n), decode: (b: Uint8Array) => b[0] || 0 },
 *   2
 * ).encode([1, 2]);
 * ```
 */

// ---- @noble/post-quantum 0.7.1 — utils.js ----
function vecCoder(c, vecLen) {
    const coder = c;
    const bytesLen = vecLen * coder.bytesLen;
    return {
        bytesLen,
        encode: (u) => {
            const uArr = aarray(u, 'u');
            if (uArr.length !== vecLen)
                throw new RangeError(`vecCoder.encode: wrong length=${uArr.length}. Expected: ${vecLen}`);
            const res = new Uint8Array(bytesLen);
            for (let i = 0, pos = 0; i < uArr.length; i++) {
                const b = coder.encode(uArr[i]);
                res.set(b, pos);
                b.fill(0); // clean
                pos += b.length;
            }
            return res;
        },
        decode: (a) => {
            abytes_(a, bytesLen);
            const r = [];
            for (let i = 0; i < a.length; i += coder.bytesLen)
                r.push(coder.decode(a.subarray(i, i + coder.bytesLen)));
            return r;
        },
    };
}
/**
 * Overwrites supported typed-array inputs with zeroes in place.
 * Accepts direct typed arrays and one-level arrays of them.
 * @param list - Typed arrays or one-level lists of typed arrays to clear.
 * @example
 * Overwrite typed arrays with zeroes.
 * ```ts
 * const buf = Uint8Array.of(1, 2, 3);
 * cleanBytes(buf);
 * ```
 */

// ---- @noble/post-quantum 0.7.1 — utils.js ----
function cleanBytes(...list) {
    for (const t of list) {
        if (Array.isArray(t))
            for (const b of t)
                b.fill(0);
        else
            t.fill(0);
    }
}
/**
 * Creates a 32-bit mask with the lowest `bits` bits set.
 * @param bits - Number of low bits to keep.
 * @returns Bit mask with `bits` ones.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Create a low-bit mask for packed-field operations.
 * ```ts
 * const mask = getMask(4);
 * ```
 */

// ---- @noble/post-quantum 0.7.1 — utils.js ----
function getMask(bits) {
    anumber(bits, 'bits');
    if (bits > 32)
        throw new RangeError('"bits" expected <= 32, got ' + bits);
    // JS shifts are modulo 32, so bit 32 needs an explicit full-width mask.
    return bits === 32 ? 0xffffffff : ~(-1 << bits) >>> 0;
}

// ---- @noble/post-quantum 0.7.1 — _crystals.js ----
/**
 * Creates shared modular arithmetic, NTT, and packing helpers for CRYSTALS schemes.
 * @param opts - Polynomial and transform parameters. See {@link CrystalOpts}.
 * @returns CRYSTALS arithmetic and encoding helpers.
 * @example
 * Create shared modular arithmetic and NTT helpers for a CRYSTALS parameter set.
 * ```ts
 * const crystals = genCrystals({
 *   newPoly: (n) => new Uint16Array(n),
 *   N: 256,
 *   Q: 3329,
 *   F: 3303,
 *   ROOT_OF_UNITY: 17,
 *   brvBits: 7,
 *   isKyber: true,
 * });
 * const reduced = crystals.mod(-1);
 * ```
 */
const genCrystals = (opts) => {
    // isKyber: true means Kyber, false means Dilithium
    const { newPoly, N, Q, F, ROOT_OF_UNITY, brvBits, isKyber } = opts;
    // Normalize JS `%` into the canonical Z_m representative `[0, modulo-1]` expected by
    // FIPS 203 §2.3 / FIPS 204 §2.3 before downstream mod-q arithmetic.
    const mod = (a, modulo = Q) => {
        const result = (a % modulo) | 0;
        return (result >= 0 ? result | 0 : (modulo + result) | 0) | 0;
    };
    // FIPS 204 §7.4 uses the centered `mod ±` representative for low bits, keeping the
    // positive midpoint when `modulo` is even.
    // Center to `[-floor((modulo-1)/2), floor(modulo/2)]`.
    const smod = (a, modulo = Q) => {
        const r = mod(a, modulo) | 0;
        return (r > modulo >> 1 ? (r - modulo) | 0 : r) | 0;
    };
    // Kyber uses the FIPS 203 Appendix A `BitRev_7` table here via the first 128 entries, while
    // Dilithium uses the FIPS 204 §7.5 / Appendix B `BitRev_8` zetas table over all 256 entries.
    function getZettas() {
        const out = newPoly(N);
        for (let i = 0; i < N; i++) {
            const b = reverseBits(i, brvBits);
            const p = BigInt(ROOT_OF_UNITY) ** BigInt(b) % BigInt(Q);
            out[i] = Number(p) | 0;
        }
        return out;
    }
    const nttZetas = getZettas();
    // Number-Theoretic Transform
    // Explained: https://electricdusk.com/ntt.html
    // Kyber has slightly different params, since there is no 512th primitive root of unity mod q,
    // only 256th primitive root of unity mod. Which also complicates MultiplyNTT.
    const inv = (_a) => {
        throw new Error('not implemented');
    };
    // ML-KEM (Kyber) polynomials always enter the transform reduced to [0, Q), so add/sub only
    // need one conditional correction instead of `%`; measured ~20% faster NTT there.
    // ML-DSA keeps the generic mod() path on purpose: its first forward stage sees centered
    // (negative) coefficients, and `sub(a, t)` can drop below -Q (t is a mul output in [0, Q)),
    // so a single correction is not enough. A guarded fast path with mod() fallback was measured
    // slower than plain `%` for the 23-bit Q (V8 int32 modulo is one div; the branches lose).
    const field = isKyber
        ? {
            add: (a, b) => {
                const r = (a + b) | 0;
                return r >= Q ? (r - Q) | 0 : r;
            },
            sub: (a, b) => {
                const r = (a - b) | 0;
                return r < 0 ? (r + Q) | 0 : r;
            },
            mul: (a, b) => mod((a | 0) * (b | 0)) | 0,
            inv,
        }
        : {
            add: (a, b) => mod((a | 0) + (b | 0)) | 0,
            sub: (a, b) => mod((a | 0) - (b | 0)) | 0,
            mul: (a, b) => mod((a | 0) * (b | 0)) | 0,
            inv,
        };
    const nttOpts = {
        N,
        roots: nttZetas,
        invertButterflies: true,
        skipStages: isKyber ? 1 : 0,
        brp: false,
    };
    const dif = FFTCore(field, { dit: false, ...nttOpts });
    const dit = FFTCore(field, { dit: true, ...nttOpts });
    const NTT = {
        encode: (r) => {
            return dif(r);
        },
        decode: (r) => {
            dit(r);
            // The inverse-NTT normalization factor is family-specific: FIPS 203 Algorithm 10 line 14
            // uses `128^-1 mod q` for Kyber, while FIPS 204 Algorithm 42 lines 21-23 use `256^-1 mod q`.
            // kyber uses 128 here, because brv && stuff
            for (let i = 0; i < r.length; i++)
                r[i] = mod(F * r[i]);
            return r;
        },
    };
    // Pack one little-endian `d`-bit word per coefficient, matching FIPS 203 ByteEncode /
    // ByteDecode and the FIPS 204 BitsToBytes-based polynomial packing helpers.
    const bitsCoder = (d, c) => {
        // Validate the carry shape once: JS bitwise operations silently truncate wider accumulators.
        for (let i = 0, bufLen = 0; i < N; i++) {
            bufLen += d;
            if (bufLen > 32)
                getMask(bufLen);
            bufLen %= 8;
        }
        const mask = getMask(d);
        const bytesLen = d * (N / 8);
        return {
            bytesLen,
            encode: (poly_) => {
                const poly = poly_;
                const r = new Uint8Array(bytesLen);
                for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < poly.length; i++) {
                    buf |= (c.encode(poly[i]) & mask) << bufLen;
                    bufLen += d;
                    // Take the low byte directly: `& 0xff` matches the previous getMask(bufLen) result
                    // after Uint8Array truncation, without a validated function call per output byte.
                    for (; bufLen >= 8; bufLen -= 8, buf >>= 8)
                        r[pos++] = buf & 0xff;
                }
                return r;
            },
            decode: (bytes) => {
                const r = newPoly(N);
                for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < bytes.length; i++) {
                    buf |= bytes[i] << bufLen;
                    bufLen += 8;
                    for (; bufLen >= d; bufLen -= d, buf >>= d)
                        r[pos++] = c.decode(buf & mask);
                }
                return r;
            },
        };
    };
    return {
        mod,
        smod,
        nttZetas: nttZetas,
        NTT: {
            encode: (r) => NTT.encode(r),
            decode: (r) => NTT.decode(r),
        },
        bitsCoder: bitsCoder,
    };
};

// ---- @noble/post-quantum 0.7.1 — _crystals.js ----
const createXofShake = (shake) => (seed, blockLen) => {
    if (!blockLen)
        blockLen = shake.blockLen;
    // Optimizations that won't mater:
    // - cached seed update (two .update(), on start and on the end)
    // - another cache which cloned into working copy
    // Faster than multiple updates, since seed less than blockLen
    const _seed = new Uint8Array(seed.length + 2);
    _seed.set(seed);
    const seedLen = seed.length;
    const buf = new Uint8Array(blockLen); // == shake128.blockLen
    let h = shake.create({});
    let calls = 0;
    let xofs = 0;
    return {
        stats: () => ({ calls, xofs }),
        get: (x, y) => {
            // Rebind to `seed || x || y` so callers can implement the spec's per-coordinate
            // SHAKE inputs like `rho || j || i` and `rho || IntegerToBytes(counter, 2)`.
            _seed[seedLen + 0] = x;
            _seed[seedLen + 1] = y;
            h.destroy();
            h = shake.create({}).update(_seed);
            calls++;
            return () => {
                xofs++;
                return h.xofInto(buf);
            };
        },
        clean: () => {
            h.destroy();
            cleanBytes(buf, _seed);
        },
    };
};
/**
 * SHAKE128-based extendable-output reader factory used by ML-KEM.
 * `get(x, y)` selects one coordinate pair at a time; calling it again invalidates previously
 * returned readers, and each squeeze reuses one mutable internal output buffer.
 * @param seed - Seed bytes for the reader.
 * @param blockLen - Optional output block length.
 * @returns Stateful XOF reader.
 * @example
 * Build the ML-KEM SHAKE128 matrix expander and read one block.
 * ```ts
 * import { randomBytes } from '@noble/post-quantum/utils.js';
 * import { XOF128 } from '@noble/post-quantum/_crystals.js';
 * const reader = XOF128(randomBytes(32));
 * const block = reader.get(0, 0)();
 * ```
 */

// ---- @noble/post-quantum 0.7.1 — _crystals.js ----
const XOF128 = /* @__PURE__ */ createXofShake(shake128);
/**
 * SHAKE256-based extendable-output reader factory used by ML-DSA.
 * `get(x, y)` appends raw one-byte coordinates to the seed, invalidates previously returned
 * readers, and reuses one mutable internal output buffer for each squeeze.
 * @param seed - Seed bytes for the reader.
 * @param blockLen - Optional output block length.
 * @returns Stateful XOF reader.
 * @example
 * Build the ML-DSA SHAKE256 coefficient expander and read one block.
 * ```ts
 * import { randomBytes } from '@noble/post-quantum/utils.js';
 * import { XOF256 } from '@noble/post-quantum/_crystals.js';
 * const reader = XOF256(randomBytes(32));
 * const block = reader.get(0, 0)();
 * ```
 */

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
/** Key encapsulation mechanism interface */
const N = 256; // Kyber (not FIPS-203) supports different lengths, but all std modes were using 256

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const Q = 3329; // 13*(2**8)+1, modulo prime

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const F = 3303; // 3303 ≡ 128**(−1) mod q (FIPS-203)

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const ROOT_OF_UNITY = 17; // ζ = 17 ∈ Zq is a primitive 256-th root of unity modulo Q. ζ**128 ≡−1
// treeshake: keep genCrystals behind the object so PARAMS-only bundles can drop it entirely.
// Shared CRYSTALS helper in the ML-KEM branch: Kyber mode, 7-bit bit-reversal,
// and Uint16Array polys because current coefficients stay reduced modulo q.

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const crystals = /* @__PURE__ */ genCrystals({
    N,
    Q,
    F,
    ROOT_OF_UNITY,
    newPoly: (n) => new Uint16Array(n),
    brvBits: 7,
    isKyber: true,
});
/** Internal params of ML-KEM versions */
// prettier-ignore
/** Built-in ML-KEM parameter presets keyed by the public export names
 * `ml_kem512` / `ml_kem768` / `ml_kem1024`.
 * `RBGstrength` is Table 2's required randomness-source strength in bits,
 * not a generic security label.
 */

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const PARAMS = /* @__PURE__ */ (() => Object.freeze({
    512: Object.freeze({ N, Q, K: 2, ETA1: 3, ETA2: 2, du: 10, dv: 4, RBGstrength: 128 }),
    768: Object.freeze({ N, Q, K: 3, ETA1: 2, ETA2: 2, du: 10, dv: 4, RBGstrength: 192 }),
    1024: Object.freeze({ N, Q, K: 4, ETA1: 2, ETA2: 2, du: 11, dv: 5, RBGstrength: 256 }),
}))();
// FIPS-203: compress/decompress

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const compress = (d) => {
    // d=12 is the ByteEncode12/ByteDecode12 path, not lossy compression.
    // ByteDecode12 interprets each 12-bit word modulo q; without that reduction the public-key
    // modulus check in encapsulate() becomes a no-op for malformed coefficients like 4095.
    if (d >= 12)
        return { encode: (i) => i, decode: (i) => (i >= Q ? i - Q : i) };
    // Comments map to python implementation in RFC (draft-cfrg-schwabe-kyber)
    // const round = (i: number) => Math.floor(i + 0.5) | 0;
    const a = 2 ** (d - 1);
    return {
        // This only matches standalone Compress_d after bitsCoder masks the result into Z_(2^d).
        encode: (i) => ((i << d) + Q / 2) / Q,
        // const decompress = (i: number) => round((Q / 2 ** d) * i);
        decode: (i) => (i * Q + a) >>> d,
    };
};
// Raw ByteEncode_d / ByteDecode_d from FIPS 203 operate on d-bit words directly.
// That differs from `polyCoder(d)` for d<12, where noble folds packing together with the lossy
// ciphertext compression step used by u/v. Tests that exercise the spec's raw packing surface need
// this exact non-lossy variant instead.

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const byteCoder = (d) => crystals.bitsCoder(d, d === 12
    ? { encode: (i) => i, decode: (i) => (i >= Q ? i - Q : i) }
    : { encode: (i) => i, decode: (i) => i });
// NOTE: we merge encoding and compress because it is faster, also both require same d param
// d=12 is the ByteEncode12/ByteDecode12 path rather than compression, and caller-side
// public-key modulus checks route through this helper's decode/encode roundtrip.
// Converts between bytes and d-bits compressed representation.
// Kinda like convertRadix2 from @scure/base.
// decode(encode(t)) == t, but there is loss of information on encode(decode(t))

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const polyCoder = (d) => (d === 12 ? byteCoder(12) : crystals.bitsCoder(d, compress(d)));
// Coefficients always stay reduced in [0, Q) here (samplers, NTT and coders all reduce),
// so one conditional correction replaces the generic mod().

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
function polyAdd(a_, b_) {
    const a = a_;
    const b = b_;
    // Mutates `a` in place; callers must pass two N=256 polynomials.
    for (let i = 0; i < N; i++) {
        const r = a[i] + b[i]; // a += b
        a[i] = r >= Q ? r - Q : r;
    }
}

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
function polySub(a_, b_) {
    const a = a_;
    const b = b_;
    // Mutates `a` in place; callers must pass two N=256 polynomials.
    for (let i = 0; i < N; i++) {
        const r = a[i] - b[i]; // a -= b
        a[i] = r < 0 ? r + Q : r;
    }
}
// FIPS-203: Computes the product of two degree-one polynomials with respect to a quadratic modulus

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
function BaseCaseMultiply(a0, a1, b0, b1, zeta) {
    // `zeta` here is Algorithm 11's γ = ζ^(2BitRev_7(i)+1).
    // Reduce a1*b1 before multiplying by zeta: a1*b1*zeta would reach ~2^35, forcing JS engines
    // into slow float fmod; with the extra reduction every intermediate fits int32.
    const c0 = crystals.mod(crystals.mod(a1 * b1) * zeta + a0 * b0);
    const c1 = crystals.mod(a0 * b1 + a1 * b0);
    return { c0, c1 };
}
// FIPS-203: Computes the product (in the ring Tq) of two NTT representations.
// Works in place on `f`; `g` is read-only and both inputs must already be in NTT form.

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
function MultiplyNTTs(f_, g_) {
    const f = f_;
    const g = g_;
    for (let i = 0; i < N / 2; i++) {
        let z = crystals.nttZetas[64 + (i >> 1)];
        if (i & 1)
            z = -z;
        const { c0, c1 } = BaseCaseMultiply(f[2 * i + 0], f[2 * i + 1], g[2 * i + 0], g[2 * i + 1], z);
        f[2 * i + 0] = c0;
        f[2 * i + 1] = c1;
    }
    return f;
}
// Return poly in NTT representation

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
function SampleNTT(xof_) {
    const xof = xof_;
    // The reader must already bind the Algorithm 7 seed||j||i bytes
    // and return block lengths divisible by 3.
    const r = new Uint16Array(N);
    for (let j = 0; j < N;) {
        const b = xof();
        if (b.length % 3)
            throw new Error('SampleNTT: unaligned block');
        for (let i = 0; j < N && i + 3 <= b.length; i += 3) {
            const d1 = ((b[i + 0] >> 0) | (b[i + 1] << 8)) & 0xfff;
            const d2 = ((b[i + 1] >> 4) | (b[i + 2] << 4)) & 0xfff;
            if (d1 < Q)
                r[j++] = d1;
            if (j < N && d2 < Q)
                r[j++] = d2;
        }
    }
    return r;
}
// Sampling from the centered binomial distribution
// Returns poly with small coefficients (noise/errors) stored modulo q in ordinary coefficient form.
// Current callers only use Table 2 eta values {2,3} and PRF outputs of exactly 64*eta bytes.

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const sampleCBDBytes = (buf, eta) => {
    const r = new Uint16Array(N);
    // CBD consumes the PRF bitstream in little-endian byte order; normalize the word view on BE,
    // then swap it back so callers still observe `buf` as read-only.
    const b32 = u32(buf);
    swap32IfBE(b32);
    let len = 0;
    for (let i = 0, p = 0, bb = 0, t0 = 0; i < b32.length; i++) {
        let b = b32[i];
        for (let j = 0; j < 32; j++) {
            bb += b & 1;
            b >>= 1;
            len += 1;
            if (len === eta) {
                t0 = bb;
                bb = 0;
            }
            else if (len === 2 * eta) {
                r[p++] = crystals.mod(t0 - bb);
                bb = 0;
                len = 0;
            }
        }
    }
    swap32IfBE(b32);
    if (len)
        throw new Error(`sampleCBD: leftover bits: ${len}`);
    return r;
};

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
function sampleCBD(PRF_, seed, nonce, eta) {
    const PRF = PRF_;
    return sampleCBDBytes(PRF((eta * N) / 4, seed, nonce), eta);
}
// K-PKE
// Internal ML-KEM subroutine only: exact 32-byte `seed` / `msg` inputs
// come from Algorithms 13-15, and the helper mutates decoded temporary
// polynomials in place while leaving caller byte arrays unchanged.

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const genKPKE = (opts_) => {
    const opts = opts_;
    const { K, PRF, XOF, HASH512, ETA1, ETA2, du, dv } = opts;
    const poly1 = polyCoder(1);
    const polyV = polyCoder(dv);
    const polyU = polyCoder(du);
    const publicCoder = splitCoder('publicKey', vecCoder(polyCoder(12), K), 32);
    const secretCoder = vecCoder(polyCoder(12), K);
    const cipherCoder = splitCoder('ciphertext', vecCoder(polyU, K), polyV);
    const seedCoder = splitCoder('seed', 32, 32);
    // Algorithm 14 (K-PKE.Encrypt) core, after ek parsing. `tHat` and every poly returned by
    // `getA(i, j)` are treated as disposable scratch: they are mutated in place and wiped/dropped,
    // so callers holding cached copies must pass fresh copies.
    const encryptCore = (tHat, getA, msg, seed) => {
        const rHat = [];
        for (let i = 0; i < K; i++)
            rHat.push(crystals.NTT.encode(sampleCBD(PRF, seed, i, ETA1)));
        const tmp2 = new Uint16Array(N);
        const u = [];
        for (let i = 0; i < K; i++) {
            const e1 = sampleCBD(PRF, seed, K + i, ETA2);
            const tmp = new Uint16Array(N);
            for (let j = 0; j < K; j++) {
                const aij = getA(i, j); // A[j][i], inplace transpose access
                polyAdd(tmp, MultiplyNTTs(aij, rHat[j])); // t += aij * rHat[j]
            }
            polyAdd(e1, crystals.NTT.decode(tmp)); // e1 += tmp
            u.push(e1);
            polyAdd(tmp2, MultiplyNTTs(tHat[i], rHat[i])); // t2 += tHat[i] * rHat[i]
            cleanBytes(tmp);
        }
        const e2 = sampleCBD(PRF, seed, 2 * K, ETA2);
        polyAdd(e2, crystals.NTT.decode(tmp2)); // e2 += tmp2
        const v = poly1.decode(msg); // encode plaintext m into polynomial v
        polyAdd(v, e2); // v += e2
        cleanBytes(tHat, rHat, tmp2, e2);
        return cipherCoder.encode([u, v]);
    };
    return {
        secretCoder,
        lengths: {
            secretKey: secretCoder.bytesLen,
            publicKey: publicCoder.bytesLen,
            cipherText: cipherCoder.bytesLen,
        },
        keygen: (seed) => {
            abytes(seed, 32, 'seed');
            const seedDst = new Uint8Array(33);
            seedDst.set(seed);
            // FIPS 203 Algorithm 13 appends the parameter-set byte `k`
            // before `G(d || k)`, so expanding the same 32-byte seed
            // under a different ML-KEM parameter set yields unrelated keys.
            seedDst[32] = K;
            const seedHash = HASH512(seedDst);
            const [rho, sigma] = seedCoder.decode(seedHash);
            const sHat = [];
            const tHat = [];
            for (let i = 0; i < K; i++)
                sHat.push(crystals.NTT.encode(sampleCBD(PRF, sigma, i, ETA1)));
            const x = XOF(rho);
            for (let i = 0; i < K; i++) {
                const e = crystals.NTT.encode(sampleCBD(PRF, sigma, K + i, ETA1));
                for (let j = 0; j < K; j++) {
                    const aji = SampleNTT(x.get(j, i)); // A[i][j], inplace
                    polyAdd(e, MultiplyNTTs(aji, sHat[j]));
                }
                tHat.push(e); // t ← A ◦ s + e
            }
            x.clean();
            const res = {
                publicKey: publicCoder.encode([tHat, rho]),
                secretKey: secretCoder.encode(sHat),
            };
            cleanBytes(rho, sigma, sHat, tHat, seedDst, seedHash);
            return res;
        },
        encrypt: (publicKey, msg, seed) => {
            const [tHat, rho] = publicCoder.decode(publicKey);
            const x = XOF(rho);
            const res = encryptCore(tHat, (i, j) => SampleNTT(x.get(i, j)), msg, seed);
            x.clean();
            return res;
        },
        // Expands the full Â matrix (public data derived from rho) once, so repeated encryptions
        // against the same ek skip the K² SampleNTT XOF expansions. Cached polys are copied per
        // call because encryptCore mutates its inputs in place.
        prepare: (publicKey) => {
            const [tHat, rho] = publicCoder.decode(publicKey);
            const x = XOF(rho);
            const A = [];
            for (let i = 0; i < K; i++)
                for (let j = 0; j < K; j++)
                    A.push(SampleNTT(x.get(i, j)));
            x.clean();
            return {
                encrypt: (msg, seed) => encryptCore(tHat.map((p) => p.slice()), (i, j) => A[i * K + j].slice(), msg, seed),
                clean: () => cleanBytes(tHat, A),
            };
        },
        decrypt: (cipherText, privateKey) => {
            const [u, v] = cipherCoder.decode(cipherText);
            const sk = secretCoder.decode(privateKey); // s  ← ByteDecode_12(dkPKE)
            const tmp = new Uint16Array(N);
            // tmp += sk[i] * u[i]
            for (let i = 0; i < K; i++)
                polyAdd(tmp, MultiplyNTTs(sk[i], crystals.NTT.encode(u[i])));
            polySub(v, crystals.NTT.decode(tmp)); // w = v' - tmp
            // `v` now holds w, from which the plaintext is just a 1-bit threshold away, so wipe it too.
            // encode() allocates its own buffer, so the returned bytes do not alias `v`.
            const res = poly1.encode(v);
            cleanBytes(tmp, sk, u, v);
            return res;
        },
    };
};
/**
 * Public ML-KEM wrapper over the internal K-PKE subroutine.
 * `keygen(seed)` and `encapsulate(publicKey, msg)` are deterministic/test-oriented hooks that map
 * more directly to Algorithms 16-17 than to the pure no-input / random-internal Algorithms 19-20.
 * `encapsulate`'s optional `msg` is the 32-byte message randomness `m` of Algorithm 17, the
 * pre-image the shared secret is derived from, NOT a plaintext to encrypt: ML-KEM is a key
 * encapsulation mechanism, not a cipher. Omit it to draw fresh randomness; pass it only to
 * reproduce a known-answer vector, and only as 32 uniformly random bytes, since a low-entropy or
 * reused value makes the shared secret predictable. The same holds for `keygen`'s optional `seed`.
 * decapsulate() tries to follow the Algorithms 18/21 implicit-reject structure as closely as
 * practical here by re-encrypting, comparing ciphertexts, returning `Khat` on match or `Kbar` on
 * mismatch, and zeroizing the non-returned shared-secret candidate; JS/JIT still provides no
 * constant-time guarantees for that path.
 */

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
function createKyber(opts) {
    const rawOpts = opts;
    const KPKE = genKPKE(rawOpts);
    const { HASH256, HASH512, KDF } = rawOpts;
    const { secretCoder: KPKESecretCoder, lengths } = KPKE;
    const secretCoder = splitCoder('secretKey', lengths.secretKey, lengths.publicKey, 32, 32);
    const msgLen = 32;
    const seedLen = 64;
    // FIPS-203 includes additional verification check for modulus
    const validateModulus = (publicKey, fn) => {
        const eke = publicKey.subarray(0, 384 * rawOpts.K);
        // Copy because of inplace encoding
        const ek = KPKESecretCoder.encode(KPKESecretCoder.decode(copyBytes(eke)));
        // (Modulus check.) Perform the computation ek ← ByteEncode12(ByteDecode12(eke)).
        // If ek = ̸ eke, the input is invalid. (See Section 4.2.1.)
        const ok = equalBytes(ek, eke);
        cleanBytes(ek);
        if (!ok)
            throw new Error(`ML-KEM.${fn}: wrong publicKey modulus`);
    };
    const kemLengths = Object.freeze({
        ...lengths,
        seed: 64,
        msg: msgLen,
        msgRand: msgLen,
        secretKey: secretCoder.bytesLen,
    });
    return Object.freeze({
        info: Object.freeze({ type: 'ml-kem' }),
        lengths: kemLengths,
        keygen: (seed) => {
            // A generated seed carries z (the implicit-rejection secret) and must be wiped once the
            // secret key holds a copy, matching ml-dsa / slh-dsa / falcon keygen. A caller-supplied
            // seed is the caller's to manage (and the immutability test requires it stay untouched).
            const ownSeed = seed === undefined;
            const s = ownSeed ? randomBytes(seedLen) : seed;
            let sk;
            let publicKeyHash;
            try {
                abytes(s, seedLen, 'seed');
                const keys = KPKE.keygen(s.subarray(0, 32));
                const publicKey = keys.publicKey;
                sk = keys.secretKey;
                publicKeyHash = HASH256(publicKey);
                // (dkPKE||ek||H(ek)||z)
                const secretKey = secretCoder.encode([sk, publicKey, publicKeyHash, s.subarray(32)]);
                return {
                    publicKey: publicKey,
                    secretKey: secretKey,
                };
            }
            finally {
                if (sk !== undefined)
                    cleanBytes(sk);
                if (publicKeyHash !== undefined)
                    cleanBytes(publicKeyHash);
                if (ownSeed)
                    cleanBytes(s);
            }
        },
        getPublicKey: (secretKey) => {
            const [_sk, publicKey, _publicKeyHash, _z] = secretCoder.decode(secretKey);
            return Uint8Array.from(publicKey);
        },
        encapsulate: (publicKey, msg) => {
            // A generated message is the preimage of the shared secret (K = G(m || H(ek))[0:32]) and
            // must be wiped. A caller-supplied message is the deterministic-randomness hook and the
            // caller's to manage (the immutability test requires it stay untouched).
            const ownMsg = msg === undefined;
            const m = ownMsg ? randomBytes(msgLen) : msg;
            let kr;
            try {
                abytes(publicKey, lengths.publicKey, 'publicKey');
                abytes(m, msgLen, 'message');
                validateModulus(publicKey, 'encapsulate');
                // derive randomness
                kr = HASH512.create().update(m).update(HASH256(publicKey)).digest();
                const cipherText = KPKE.encrypt(publicKey, m, kr.subarray(32, 64));
                return {
                    cipherText: cipherText,
                    sharedSecret: kr.subarray(0, 32),
                };
            }
            finally {
                if (kr !== undefined)
                    cleanBytes(kr.subarray(32));
                if (ownMsg)
                    cleanBytes(m);
            }
        },
        decapsulate: (cipherText, secretKey) => {
            abytes(secretKey, secretCoder.bytesLen, 'secretKey'); // 768*k + 96
            abytes(cipherText, lengths.cipherText, 'cipherText'); // 32(du*k + dv)
            // test ← H(dk[384𝑘 ∶ 768𝑘 + 32])) .
            const k768 = secretCoder.bytesLen - 96;
            const start = k768 + 32;
            const test = HASH256(secretKey.subarray(k768 / 2, start));
            // If test ≠ dk[768𝑘 + 32 ∶ 768𝑘 + 64], then input checking has failed.
            if (!equalBytes(test, secretKey.subarray(start, start + 32)))
                throw new Error('invalid secretKey: hash check failed');
            const [sk, publicKey, publicKeyHash, z] = secretCoder.decode(secretKey);
            const msg = KPKE.decrypt(cipherText, sk);
            // derive randomness, Khat, rHat = G(mHat || h)
            const kr = HASH512.create().update(msg).update(publicKeyHash).digest();
            const Khat = kr.subarray(0, 32);
            // re-encrypt using the derived randomness
            const cipherText2 = KPKE.encrypt(publicKey, msg, kr.subarray(32, 64));
            // if ciphertexts do not match, “implicitly reject”
            const isValid = equalBytes(cipherText, cipherText2);
            const Kbar = KDF.create({ dkLen: 32 }).update(z).update(cipherText).digest();
            // kr[32:64] is the derived K-PKE encryption randomness: wipe it like encapsulate() does.
            cleanBytes(msg, cipherText2, kr.subarray(32), !isValid ? Khat : Kbar);
            return (isValid ? Khat : Kbar);
        },
        /**
         * Experimental prototype: pre-expand a public key so repeated encapsulate/decapsulate
         * against the same key skip re-validation, H(ek), t̂ decoding and the K² SampleNTT
         * XOF expansions of Â. Only public data is cached; see {@link KEMPrepared}.
         */
        prepare: (publicKey) => {
            abytes(publicKey, lengths.publicKey, 'publicKey');
            validateModulus(publicKey, 'prepare');
            const ek = copyBytes(publicKey); // detach from the caller before caching
            const publicKeyHash = HASH256(ek);
            const cached = KPKE.prepare(ek);
            return Object.freeze({
                publicKey: ek,
                encapsulate: (msg) => {
                    // As in the non-prepared encapsulate: a generated message is the shared-secret
                    // preimage and is wiped; a caller-supplied one is left untouched.
                    const ownMsg = msg === undefined;
                    const m = ownMsg ? randomBytes(msgLen) : msg;
                    let kr;
                    try {
                        abytes(m, msgLen, 'message');
                        kr = HASH512.create().update(m).update(publicKeyHash).digest();
                        const cipherText = cached.encrypt(m, kr.subarray(32, 64));
                        return {
                            cipherText: cipherText,
                            sharedSecret: kr.subarray(0, 32),
                        };
                    }
                    finally {
                        if (kr !== undefined)
                            cleanBytes(kr.subarray(32));
                        if (ownMsg)
                            cleanBytes(m);
                    }
                },
                decapsulate: (cipherText, secretKey) => {
                    abytes(secretKey, secretCoder.bytesLen, 'secretKey');
                    abytes(cipherText, lengths.cipherText, 'cipherText');
                    const [sk, ekEmbedded, storedHash, z] = secretCoder.decode(secretKey);
                    // Under KEMPrepared's read-only publicKey contract, bind dk to the prepared key.
                    // Together with publicKeyHash = H(ek) computed in prepare(), this is equivalent to (and
                    // stronger than) FIPS 203 §7.3's `H(dk[384k : 768k+32]) == dk[768k+32 : 768k+64]`.
                    if (!equalBytes(ekEmbedded, ek) || !equalBytes(storedHash, publicKeyHash))
                        throw new Error('ML-KEM.decapsulate: secretKey does not match prepared publicKey');
                    const msg = KPKE.decrypt(cipherText, sk);
                    // derive randomness, Khat, rHat = G(mHat || h)
                    const kr = HASH512.create().update(msg).update(publicKeyHash).digest();
                    const Khat = kr.subarray(0, 32);
                    // re-encrypt using the derived randomness and cached Â/t̂
                    const cipherText2 = cached.encrypt(msg, kr.subarray(32, 64));
                    // if ciphertexts do not match, “implicitly reject”
                    const isValid = equalBytes(cipherText, cipherText2);
                    const Kbar = KDF.create({ dkLen: 32 }).update(z).update(cipherText).digest();
                    cleanBytes(msg, cipherText2, kr.subarray(32), !isValid ? Khat : Kbar);
                    return (isValid ? Khat : Kbar);
                },
                clean: cached.clean,
            });
        },
    });
}
// FIPS 203's PRF_eta binding: current callers use only 32-byte keys, one-byte nonces,
// and dkLen values {128, 192}; out-of-range nonce numbers still wrap modulo 256 here.

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
function shakePRF(dkLen, key, nonce) {
    return shake256
        .create({ dkLen })
        .update(key)
        .update(new Uint8Array([nonce]))
        .digest();
}
// Fixed ML-KEM hash/XOF bindings. `KDF` here is the spec's fixed 32-byte `J` call,
// and swapping any field changes the scheme rather than tuning an internal dependency.

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const opts = /* @__PURE__ */ (() => ({
    HASH256: sha3_256,
    HASH512: sha3_512,
    KDF: shake256,
    XOF: XOF128,
    PRF: shakePRF,
}))();
// Parameter-set instantiation step for the spec's "ML-KEM-x" names; current correctness relies
// on the internal PARAMS rows rather than local validation of arbitrary KEMParam objects.

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const mk = (params) => createKyber({
    ...opts,
    ...params,
});
/**
 * ML-KEM-512: Table 2 row `k=2, η1=3, η2=2, du=10, dv=4`; Table 3 sizes `800/1632/768/32`.
 * The ASD lifecycle note here is external policy guidance, not a FIPS 203 requirement.
 * @example
 * Generate deterministic ML-KEM-512 keys, encapsulate a shared secret, and decapsulate it.
 * ```ts
 * import { ml_kem512 } from '@noble/post-quantum/ml-kem.js';
 * const seed = new Uint8Array(ml_kem512.lengths.seed!);
 * const { secretKey, publicKey } = ml_kem512.keygen(seed);
 * const msg = new Uint8Array(ml_kem512.lengths.msgRand!);
 * const { cipherText, sharedSecret } = ml_kem512.encapsulate(publicKey, msg);
 * const recovered = ml_kem512.decapsulate(cipherText, secretKey);
 * const publicKey2 = ml_kem512.getPublicKey(secretKey);
 * ```
 */

// ---- @noble/post-quantum 0.7.1 — ml-kem.js ----
const ml_kem768 = /* @__PURE__ */ (() => mk(PARAMS[768]))();
/**
 * ML-KEM-1024: Table 2 row `k=4, η1=2, η2=2, du=11, dv=5`; Table 3 sizes `1568/3168/1568/32`.
 * The ASD lifecycle note here is external policy guidance, not a FIPS 203 requirement.
 */

export { ml_kem768 };
