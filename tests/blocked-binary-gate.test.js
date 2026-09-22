import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const html = readFileSync('index.html', 'utf8');

// Extract handleBinaryChunk: slice from its signature to the next top-level comment
// that starts sendBinaryFile (robust against internal brace changes).
const start = html.indexOf('function handleBinaryChunk(contact, buffer)');
const end = html.indexOf('// Send file as binary chunks', start);
const fnSrc = html.slice(start, end);

describe('blocked-peer binary chunk gate', () => {
  it('gates contact.blocked at the ingest point', () => {
    expect(start).toBeGreaterThan(-1);
    // The blocked check must precede the 28-byte header parse.
    const blockedAt = fnSrc.indexOf('contact.blocked');
    const headerAt = fnSrc.indexOf('buffer.byteLength');
    expect(blockedAt).toBeGreaterThan(-1);
    expect(headerAt).toBeGreaterThan(-1);
    expect(blockedAt).toBeLessThan(headerAt);
  });

  it('the JSON-path blocked gate on onmessage still exists', () => {
    // Both ingest paths must be independently gated — the onmessage string path and
    // the ArrayBuffer path inside handleBinaryChunk.
    const om = html.indexOf('ch.onmessage = async (e) =>');
    const slice = html.slice(om, om + 3000);
    expect(slice).toContain('contact.blocked');
  });

  function makeFn(spies) {
    const CONFIG = { FILE_MAX: 50 * 1024 * 1024, CHUNK_SIZE: 64 * 1024 };
    const _fileChunks = {};
    const documentStub = { getElementById: () => null };
    const _DOM = { get: () => null };
    const activeContact = { id: 'someone-else' };
    const esc = (s) => s;
    const fmtSize = (n) => String(n);
    const _dbg = () => {};
    const handleIncoming = (m) => spies.calls.push(m);
    const fn = new Function(
      'CONFIG', '_fileChunks', 'document', '_DOM', 'activeContact', 'esc', 'fmtSize',
      '_dbg', 'handleIncoming', 'performance', 'TextDecoder',
      fnSrc + '\nreturn handleBinaryChunk;'
    );
    return fn(CONFIG, _fileChunks, documentStub, _DOM, activeContact, esc, fmtSize,
      _dbg, handleIncoming, performance, TextDecoder);
  }

  function chunkBuf(fileIdByte, seq, total, name, mime, data) {
    const nb = new TextEncoder().encode(name), mb = new TextEncoder().encode(mime);
    const buf = new ArrayBuffer(28 + nb.length + mb.length + data.length);
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < 16; i++) u8[i] = fileIdByte;
    const dv = new DataView(buf);
    dv.setUint32(16, seq); dv.setUint32(20, total);
    dv.setUint16(24, nb.length); dv.setUint16(26, mb.length);
    u8.set(nb, 28); u8.set(mb, 28 + nb.length); u8.set(data, 28 + nb.length + mb.length);
    return buf;
  }

  it('blocked peer: a complete transfer is dropped before ingest (no handleIncoming, no chunks)', () => {
    const spies = { calls: [] };
    const fn = makeFn(spies);
    const contact = { id: 'c1', pubB64: 'p', name: 'n', blocked: true };
    fn(contact, chunkBuf(1, 0, 1, 'evil.exe', 'application/x', new Uint8Array([1, 2, 3])));
    expect(spies.calls.length).toBe(0);
  });

  it('unblocked peer: single-chunk transfer completes to handleIncoming', () => {
    const spies = { calls: [] };
    const fn = makeFn(spies);
    const contact = { id: 'c1', pubB64: 'p', name: 'n', blocked: false };
    fn(contact, chunkBuf(2, 0, 1, 'a.png', 'image/png', new Uint8Array([9, 8, 7])));
    expect(spies.calls.length).toBe(1);
    const m = spies.calls[0];
    expect(m.isFile).toBe(true);
    expect(m.from).toBe('c1');
    expect(Array.from(m.fileBytes)).toEqual([9, 8, 7]);
    const p = JSON.parse(m.payload);
    expect(p.name).toBe('a.png');
    expect(p.mime).toBe('image/png');
  });

  it('unblocked peer: multi-chunk transfer completes once, in order', () => {
    const spies = { calls: [] };
    const fn = makeFn(spies);
    const contact = { id: 'c1', pubB64: 'p', name: 'n', blocked: false };
    fn(contact, chunkBuf(3, 0, 2, 'f.bin', 'application/octet-stream', new Uint8Array([1, 1])));
    expect(spies.calls.length).toBe(0);
    fn(contact, chunkBuf(3, 1, 2, 'f.bin', 'application/octet-stream', new Uint8Array([2, 2])));
    expect(spies.calls.length).toBe(1);
    expect(Array.from(spies.calls[0].fileBytes)).toEqual([1, 1, 2, 2]);
  });

  it('blocked mid-transfer: chunks stop accumulating after block', () => {
    const spies = { calls: [] };
    const fn = makeFn(spies);
    const contact = { id: 'c1', pubB64: 'p', name: 'n', blocked: false };
    fn(contact, chunkBuf(4, 0, 2, 'f.bin', 'x', new Uint8Array([1])));
    contact.blocked = true; // user blocks mid-transfer
    fn(contact, chunkBuf(4, 1, 2, 'f.bin', 'x', new Uint8Array([2])));
    expect(spies.calls.length).toBe(0); // never completes
  });
});
