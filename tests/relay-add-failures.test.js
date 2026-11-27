// A2: adding a home relay is the first-run gate, so an inconclusive
// attestation must carry WHY (timeout / no answer / not a Breeze
// server) far enough for the UI to name one actionable fix. These
// tests extract the shipped functions from index.html and drive them
// with transport stubs; no verdict may change.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Brace-matched extraction, aware of strings/comments so a brace in
// prose cannot terminate the function early. The extracted text is
// the shipped source itself, assembled into a fresh Function below.
function matchBrace(src, open) {
  let depth = 0;
  let state = 'code';
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (state === 'line') { if (ch === '\n') state = 'code'; continue; }
    if (state === 'block') { if (ch === '*' && next === '/') { state = 'code'; i++; } continue; }
    if (state === 'single' || state === 'double' || state === 'template') {
      if (ch === '\\') { i++; continue; }
      const end = state === 'single' ? "'" : state === 'double' ? '"' : '`';
      if (ch === end) state = 'code';
      continue;
    }
    if (ch === '/' && next === '/') { state = 'line'; i++; continue; }
    if (ch === '/' && next === '*') { state = 'block'; i++; continue; }
    if (ch === "'") { state = 'single'; continue; }
    if (ch === '"') { state = 'double'; continue; }
    if (ch === '`') { state = 'template'; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('unbalanced braces');
}

function extractFunction(name) {
  const start = INDEX.indexOf(`async function ${name}(`);
  expect(start, `${name} exists in index.html`).toBeGreaterThan(-1);
  const open = INDEX.indexOf('{', start);
  return INDEX.slice(start, matchBrace(INDEX, open) + 1);
}

// _preflightRelayUrl contains a regex with a '//' sequence, which the
// string-aware matchBrace above misreads as a line comment; extract it
// with a plain brace counter instead (the function body carries no
// braces inside strings, so the count is exact).
function extractPlainFunction(name) {
  const start = INDEX.indexOf(`function ${name}(`);
  expect(start, `${name} exists in index.html`).toBeGreaterThan(-1);
  const open = INDEX.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < INDEX.length; i++) {
    if (INDEX[i] === '{') depth++;
    else if (INDEX[i] === '}') {
      depth--;
      if (depth === 0) return INDEX.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced braces');
}

function buildAttestation({ fetchT, home = [], serving = 'https://serving.test' } = {}) {
  const source = `${extractFunction('_relayAttestCheck')}\n${extractPlainFunction('_preflightRelayUrl')}\n${extractFunction('attestNewRelay')}
    return { _relayAttestCheck, attestNewRelay };`;
  const normalize = (raw) => {
    try {
      const u = new URL(String(raw).trim());
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      return u.origin;
    } catch { return null; }
  };
  const make = new Function(
    'fetchT', '_H', '_dbg', 'verifySignature', '_normalizeRelayUrl', '_servingRelayUrl',
    'homeRelays', 'relayFingerprint',
    source,
  );
  return make(
    fetchT,
    { 'Content-Type': 'application/json' },
    () => {},
    async () => true,
    normalize,
    () => serving,
    () => home,
    async (key) => 'fp:' + key,
  );
}

const okJson = (value) => ({ ok: true, json: async () => value });
const failHttp = () => ({ ok: false, status: 404, json: async () => ({}) });
const timeoutError = () => Object.assign(new Error('timed out'), { name: 'TimeoutError' });

let oldNoDefault;
beforeEach(() => {
  oldNoDefault = globalThis.__BREEZE_NO_DEFAULT_SERVER__;
  globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
});
afterEach(() => {
  if (oldNoDefault === undefined) delete globalThis.__BREEZE_NO_DEFAULT_SERVER__;
  else globalThis.__BREEZE_NO_DEFAULT_SERVER__ = oldNoDefault;
});

describe('relay add failure reasons (A2)', () => {
  it('health fetch rejecting with a TypeError stays unreachable and maps to the unreachable error', async () => {
    const c = buildAttestation({ fetchT: async () => { throw new TypeError('failed to fetch'); } });
    const check = await c._relayAttestCheck('https://relay.test/api', null);
    expect(check.verdict).toBe('unreachable');
    expect(check.reason).toBe('unreachable');
    expect((await c.attestNewRelay('https://relay.test')).error).toBe('unreachable');
  });

  it('health fetch rejecting with a timeout-named error is classified as timeout', async () => {
    const c = buildAttestation({ fetchT: async () => { throw timeoutError(); } });
    const check = await c._relayAttestCheck('https://relay.test/api', null);
    expect(check.verdict).toBe('unreachable');
    expect(check.reason).toBe('timeout');
    expect((await c.attestNewRelay('https://relay.test')).error).toBe('timeout');
  });

  it('a non-ok health response is answered-but-not-Breeze', async () => {
    const c = buildAttestation({ fetchT: async () => failHttp() });
    const check = await c._relayAttestCheck('https://relay.test/api', null);
    expect(check.verdict).toBe('unreachable');
    expect(check.reason).toBe('not-breeze');
    expect((await c.attestNewRelay('https://relay.test')).error).toBe('not-breeze');
  });

  it('an attest answer naming a different key is inconsistent, hence not-Breeze', async () => {
    const fetchT = async (url) => url.endsWith('/health')
      ? okJson({ relayKey: 'relay-key-a' })
      : okJson({ relayKey: 'relay-key-b', sig: 'not-a-real-signature' });
    const c = buildAttestation({ fetchT });
    const check = await c._relayAttestCheck('https://relay.test/api', null);
    expect(check.verdict).toBe('unreachable');
    expect(check.reason).toBe('not-breeze');
    expect((await c.attestNewRelay('https://relay.test')).error).toBe('not-breeze');
  });

  it('attest fetch rejecting with a TypeError remains an unreachable verdict', async () => {
    const fetchT = async (url, opts) => {
      if (url.endsWith('/health')) return okJson({ relayKey: 'relay-key-a' });
      if (opts?.method === 'POST') throw new TypeError('socket reset');
      throw new Error('unexpected fetch ' + url);
    };
    const c = buildAttestation({ fetchT });
    const check = await c._relayAttestCheck('https://relay.test/api', null);
    expect(check.verdict).toBe('unreachable');
    expect(check.reason).toBe('unreachable');
    expect((await c.attestNewRelay('https://relay.test')).error).toBe('unreachable');
  });

  it('health without relayKey keeps the keyless verdict and keyless add-flow error', async () => {
    const c = buildAttestation({ fetchT: async () => okJson({ relayKey: null }) });
    const check = await c._relayAttestCheck('https://relay.test/api', null);
    expect(check.verdict).toBe('keyless');
    expect(check.reason).toBeUndefined();
    expect((await c.attestNewRelay('https://relay.test')).error).toBe('keyless');
  });

  it('the consistent happy path still verifies as ok', async () => {
    const fetchT = async (url) => url.endsWith('/health')
      ? okJson({ relayKey: 'relay-key-a' })
      : okJson({ relayKey: 'relay-key-a', sig: 'good-signature' });
    const c = buildAttestation({ fetchT });
    const check = await c._relayAttestCheck('https://relay.test/api', null);
    expect(check).toMatchObject({ verdict: 'ok', relayKey: 'relay-key-a' });
    const added = await c.attestNewRelay('https://relay.test/path?ignored=yes');
    expect(added.error).toBeUndefined();
    expect(added.relayKey).toBe('relay-key-a');
    expect(added.fingerprint).toBe('fp:relay-key-a');
  });
});

describe('relay add failure surfacing (source + i18n)', () => {
  it('_addRelayFlow and _setContactHomeFlow reference the two new failure keys', () => {
    const addFlow = extractFunction('_addRelayFlow');
    expect(addFlow).toContain("timeout: 'relayAddTimeout'");
    expect(addFlow).toContain("'not-breeze': 'relayAddNotBreeze'");
    const homeFlow = extractFunction('_setContactHomeFlow');
    expect(homeFlow).toContain('relayAddTimeout');
    expect(homeFlow).toContain('relayAddNotBreeze');
  });

  it('inline English and every locale file carry both keys; Japanese is really translated', () => {
    expect(INDEX.includes("relayAddTimeout: 'That server took too long to answer"), 'inline EN relayAddTimeout').toBe(true);
    expect(INDEX.includes("relayAddNotBreeze: 'That address answered, but it does not look like a Breeze server"), 'inline EN relayAddNotBreeze').toBe(true);
    const files = fs.readdirSync(path.join(ROOT, 'locales')).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
      const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', file), 'utf8'));
      expect(table.relayAddTimeout, `${file} relayAddTimeout`).toBeTruthy();
      expect(table.relayAddNotBreeze, `${file} relayAddNotBreeze`).toBeTruthy();
    }
    const ja = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales/ja.json'), 'utf8'));
    expect(ja.relayAddTimeout).not.toBe('That server took too long to answer — wait a moment and try again. If it keeps happening, check that the server is running and not overloaded.');
    expect(ja.relayAddNotBreeze).not.toBe('That address answered, but it does not look like a Breeze server — make sure the URL points to your Breeze server, not to a website or another app, then try again.');
  });
});
