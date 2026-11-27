// Server-add preflight (mask iteration 36): pasted relay URLs are
// canonicalized before attestation, bare hosts gain https://, and a
// non-loopback http:// relay is refused before any network traffic.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function extractFunction(name) {
  const start = INDEX.indexOf(`function ${name}(`);
  expect(start, `function ${name} present in index.html`).toBeGreaterThan(-1);
  const open = INDEX.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < INDEX.length; i++) {
    if (INDEX[i] === '{') depth++;
    else if (INDEX[i] === '}') {
      depth--;
      if (depth === 0) return INDEX.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces extracting ${name}`);
}

function buildPreflight() {
  const src = `${extractFunction('_normalizeRelayUrl')}\n${extractFunction('_preflightRelayUrl')}`;
  return new Function(`${src}; return { _normalizeRelayUrl, _preflightRelayUrl };`)();
}

describe('_preflightRelayUrl (extracted from index.html)', () => {
  const { _preflightRelayUrl } = buildPreflight();

  it.each([
    ['relay.example.com', 'https://relay.example.com'],
    ['relay.example.com/', 'https://relay.example.com'],
    ['//relay.example.com', 'https://relay.example.com'],
    ['https://relay.example.com/some/path/', 'https://relay.example.com'],
    ['http://localhost:8787', 'http://localhost:8787'],
    ['http://127.0.0.1:8787', 'http://127.0.0.1:8787'],
    ['http://[::1]:8787', 'http://[::1]:8787'],
  ])('accepts %s as %s', (input, url) => {
    expect(_preflightRelayUrl(input)).toEqual({ url });
  });

  it.each([
    ['http://relay.example.com', 'insecure'],
    ['ftp://relay.example.com', 'invalid'],
    ['', 'invalid'],
    ['   ', 'invalid'],
  ])('rejects %s as %s', (input, error) => {
    expect(_preflightRelayUrl(input)).toEqual({ error });
  });

  it.each([undefined, null, 42, {}, []])('rejects non-string input %s as invalid', (input) => {
    expect(_preflightRelayUrl(input)).toEqual({ error: 'invalid' });
  });
});

describe('server-add wiring pins', () => {
  it('attestNewRelay goes through the preflight instead of raw normalization', () => {
    const start = INDEX.indexOf('async function attestNewRelay(');
    const end = INDEX.indexOf('async function addHomeRelay(', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const src = INDEX.slice(start, end);
    expect(src).toContain('_preflightRelayUrl(rawUrl)');
    expect(src).not.toContain('const url = _normalizeRelayUrl(rawUrl);');
  });

  it('the add-flow error map carries the insecure-relay copy key', () => {
    const start = INDEX.indexOf('async function _addRelayFlow(');
    expect(start).toBeGreaterThan(-1);
    const src = INDEX.slice(start, start + 1600);
    expect(src).toMatch(/insecure:\s*['"]relayAddInsecure['"]/);
  });
});
