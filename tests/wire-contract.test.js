// Wire-contract pins between index.html (client) and _worker.js (server).
// These constants are negotiated by convention — no handshake exchanges them —
// so a drift on either side is a silent wire break the type system can't see.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = readFileSync(join(root, 'index.html'), 'utf8');
const worker = readFileSync(join(root, '_worker.js'), 'utf8');

const num = (src, re, name) => {
  const m = src.match(re);
  expect(m, `${name} not found`).not.toBeNull();
  return Number(m[1]);
};

describe('PoW contract', () => {
  it('client solve difficulty >= the worker acceptance floor — below it every request is POW_INVALID', () => {
    const clientDifficulty = num(client, /POW_DIFFICULTY:\s*(\d+)/, 'client POW_DIFFICULTY');
    const workerFloor = num(worker, /MIN_POW_DIFFICULTY\)\s*\|\|\s*(\d+)/, 'worker MIN_POW_DIFFICULTY fallback');
    expect(clientDifficulty).toBeGreaterThanOrEqual(workerFloor);
  });

  it('worker requires challenge to start `${pub}:` — the client must build it that way', () => {
    expect(worker).toContain('.startsWith(pub + ');
    // Client builds the challenge as `${pubB64}:${context}:${ts}` — always pub-prefixed.
    expect(client).toMatch(/myPubB64 \+ ':'/);
  });
});

describe('body-size contract', () => {
  it('the largest single-field cap fits inside MAX_BODY_BYTES — otherwise the field check is unreachable', () => {
    const bodyCap = num(worker, /MAX_BODY_BYTES = (\d+)/, 'MAX_BODY_BYTES');
    const fieldCap = num(worker, /\.length > (\d+) \* 1024/, 'largest per-field cap') * 1024;
    expect(fieldCap).toBeLessThanOrEqual(bodyCap);
  });
});
