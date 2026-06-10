// Shared byte/encoding helper tests.
import { describe, it, expect } from 'vitest';
import { u8, arr, toBytes, concatBytes, b64, unb64, ctEqual } from '../src/crypto/bytes.js';

describe('u8 / arr', () => {
  it('u8 passes a Uint8Array through and converts arrays', () => {
    const src = new Uint8Array([1, 2, 3]);
    expect(u8(src)).toBe(src);                    // no copy
    expect(Array.from(u8([4, 5]))).toEqual([4, 5]);
  });
  it('arr returns a plain Array of byte values', () => {
    expect(arr(new Uint8Array([9, 8, 7]))).toEqual([9, 8, 7]);
    expect(Array.isArray(arr(new Uint8Array([1])))).toBe(true);
  });
});

describe('toBytes', () => {
  it('UTF-8 encodes a string', () => {
    expect(Array.from(toBytes('A'))).toEqual([0x41]);
    expect(toBytes('🌸').length).toBe(4); // 4-byte UTF-8
  });
  it('normalizes a byte array', () => {
    expect(Array.from(toBytes([1, 2]))).toEqual([1, 2]);
  });
});

describe('concatBytes', () => {
  it('concatenates in order', () => {
    const out = concatBytes([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5])]);
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5]);
  });
  it('handles empty parts and an empty list', () => {
    expect(concatBytes([]).length).toBe(0);
    expect(Array.from(concatBytes([new Uint8Array(0), new Uint8Array([7])]))).toEqual([7]);
  });
});

describe('b64 / unb64 round-trip', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 42]);
    expect(Array.from(unb64(b64(bytes)))).toEqual(Array.from(bytes));
  });
  it('b64 accepts a plain array too', () => {
    expect(b64([0x41, 0x42])).toBe(btoa('AB'));
  });
});

describe('ctEqual (constant-time compare)', () => {
  it('true for equal byte arrays (Uint8Array or plain array inputs)', () => {
    expect(ctEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(ctEqual([1, 2, 3], new Uint8Array([1, 2, 3]))).toBe(true); // mixed input types
  });
  it('false on any byte difference', () => {
    expect(ctEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(ctEqual(new Uint8Array([1, 2, 3]), new Uint8Array([9, 2, 3]))).toBe(false);
  });
  it('false on length mismatch without throwing', () => {
    expect(ctEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
    expect(ctEqual([], [1])).toBe(false);
  });
  it('true for two empty arrays', () => {
    expect(ctEqual(new Uint8Array(0), [])).toBe(true);
  });
});
