// Wave-2 defect fixes (2026-11-21 ledger) — D02 / D05 / D30 pins.
//
// The reference halves are driven directly here. The client halves live
// inside index.html's monolith closure, which no harness executes whole;
// following the repo's wiring-pin convention (wave1-defects), those are
// pinned by the exact source shapes the fixes rely on.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRatchet, padBucketSize } from '../src/crypto/ratchet.js';
import { sealMeta, unsealMeta } from '../src/crypto/seal.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const subtle = globalThis.crypto.subtle;
const LOCALES = ['es', 'id', 'ja', 'ko', 'pt-BR', 'th', 'zh-TW'];
const locale = (l) => JSON.parse(readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8'));

describe('D02 — padded lengths snap to size buckets (256 / 1024 / 4096)', () => {
  it('padBucketSize returns the smallest bucket that fits, then multiples of the top', () => {
    expect(padBucketSize(1)).toBe(256);
    expect(padBucketSize(256)).toBe(256);
    expect(padBucketSize(257)).toBe(1024);
    expect(padBucketSize(1024)).toBe(1024);
    expect(padBucketSize(1025)).toBe(4096);
    expect(padBucketSize(4096)).toBe(4096);
    expect(padBucketSize(4097)).toBe(8192);
    expect(padBucketSize(10000)).toBe(12288);
    // A non-default boundary scales the whole ladder.
    expect(padBucketSize(300, 128)).toBe(512);
    expect(padBucketSize(3000, 128)).toBe(4096);
  });

  it('frameEncrypt pads into buckets and frameDecrypt still recovers every size', async () => {
    const r = createRatchet({ hasX25519: false });
    const msgKey = new Uint8Array(32).fill(0x07);
    // raw+3 framed lengths: 103 → 256, 303 → 1024, 2003 → 4096, 5003 → 8192.
    for (const [chars, bucket] of [[100, 256], [300, 1024], [2000, 4096], [5000, 8192]]) {
      const text = 'x'.repeat(chars);
      const { iv, ct } = await r.frameEncrypt(msgKey, text);
      expect(ct.length).toBe(bucket + 16); // padded frame + GCM tag
      const back = await r.unpadAndDecompress(await r.frameDecrypt(msgKey, iv, ct));
      expect(back).toBe(text); // unpadAndDecompress returns the decoded string
    }
  });

  it('a legacy 256-multiple frame (pre-bucket sender) still decrypts', async () => {
    const r = createRatchet({ hasX25519: false });
    const msgKey = new Uint8Array(32).fill(0x09);
    // Mint a frame the OLD way: ceil-to-256 padding, [flags][len:2][data].
    const raw = new TextEncoder().encode('legacy hello');
    const padded = new Uint8Array(Math.ceil((raw.length + 3) / 256) * 256);
    new DataView(padded.buffer).setUint16(1, raw.length);
    padded.set(raw, 3);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const key = await subtle.importKey('raw', msgKey, { name: 'AES-GCM' }, false, ['encrypt']);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, padded));
    const back = await r.unpadAndDecompress(await r.frameDecrypt(msgKey, iv, ct));
    expect(back).toBe('legacy hello');
  });

  it('sealMeta frames metadata into the same buckets and unsealMeta recovers it', async () => {
    const kp = await subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
    const pubRaw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
    // JSON sizes ≈ 60 → framed 256; ≈ 400 → framed 1024; ≈ 2100 → framed 4096.
    for (const [padChars, bucket] of [[0, 256], [330, 1024], [2000, 4096]]) {
      const meta = { from: 'ddddeeeeffff', fromName: 'A'.repeat(40 + padChars) };
      const se = await sealMeta(subtle, pubRaw, meta, 'aaaabbbbcccc', 1755000000000);
      expect(se.ct.length).toBe(bucket + 16); // framed plaintext + GCM tag
      const opened = await unsealMeta(subtle, kp.privateKey, se, 'aaaabbbbcccc', 1755000000000);
      expect(opened).toEqual(meta);
    }
  });

  it('index.html routes all three padding sites through the bucket helper', () => {
    expect(html).toContain('function _padBucketSize(n, boundary = 256)');
    expect(html).toContain('_padBucketSize(raw.length + 3, CONFIG.MSG_PAD_BOUNDARY)'); // 1:1
    expect(html).toContain('_padBucketSize(raw.length + 2, CONFIG.MSG_PAD_BOUNDARY)'); // group
    expect(html).toContain('const total = _padBucketSize(jsonBytes.length + 3);'); // seal meta
    expect(html).not.toContain('Math.ceil((raw.length + 3) / CONFIG.MSG_PAD_BOUNDARY)');
    expect(html).not.toContain('Math.ceil((raw.length + 2) / CONFIG.MSG_PAD_BOUNDARY)');
  });
});
