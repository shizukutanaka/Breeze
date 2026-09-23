import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Round-40 sweep: every one-shot / user-triggered resp.json() site is routed through
// _safeJson (a hostile relay can answer ANY call with a huge body — same threat model
// as the recurring polls covered by the 8MB/32MB/4MB/1MB caps). The seven recurring
// poll sites keep their own caps and are pinned by the tripwire test below.

function safeJsonBody() {
  const start = SRC.indexOf('async function _safeJson(resp, maxBytes)');
  expect(start).toBeGreaterThan(-1);
  const end = SRC.indexOf('\n}', start) + 2;
  return SRC.slice(start, end);
}

describe('_safeJson — helper semantics', () => {
  const fn = new Function(`${safeJsonBody()}; return _safeJson;`)();
  const resp = (body, cl) => ({ headers: { get: () => cl }, text: async () => body });

  it('parses a body under the cap', async () => {
    expect(await fn(resp('{"a":1}'), 1024)).toEqual({ a: 1 });
  });
  it('rejects on Content-Length before reading the body', async () => {
    let read = false;
    const r = { headers: { get: () => '999999' }, text: async () => { read = true; return ''; } };
    await expect(fn(r, 1024)).rejects.toThrow('too large');
    expect(read).toBe(false);
  });
  it('rejects on decoded length when Content-Length is absent (chunked)', async () => {
    await expect(fn(resp('x'.repeat(2048), null), 1024)).rejects.toThrow('too large');
  });
});

describe('one-shot endpoints route through _safeJson', () => {
  const sites = [
    ['/drop/read', "const data = await _safeJson(resp, 1024 * 1024); // drop ct"],
    ['/group/info preview', "_safeJson(r, 1024 * 1024)"],
    ['/health drift', "const health = await _safeJson(r, 256 * 1024);"],
    ['/health banner', "await _safeJson(r, 256 * 1024).catch(() => ({}))"],
    ['/health vapid', "_safeJson(healthResp, 256 * 1024)"],
    ['/prekey/fetch', "const bundle = await _safeJson(resp, 1024 * 1024);"],
    ['/prekey/fetch/batch', "const { results } = await _safeJson(resp, 1024 * 1024);"],
    ['/device/list', "const rec = await _safeJson(resp, 1024 * 1024);"],
    ['/prekey/status', "const data = resp?.ok ? await _safeJson(resp, 256 * 1024) : null;"],
    ['/msg/send ack', "const data = await _safeJson(resp, 256 * 1024).catch(() => ({}));"],
    ['/sealed/send ack', "const data = await _safeJson(resp, 256 * 1024).catch(() => ({}));"],
    ['/abuse/report', "await _safeJson(resp, 256 * 1024).catch(() => ({}))"],
    ['/group/create', "const data = await _safeJson(resp, 256 * 1024);"],
    ['/group/join err', "const err = await _safeJson(resp, 256 * 1024).catch(() => ({}));"],
    ['/group/join data', "const data = await _safeJson(resp, 1024 * 1024);"],
    ['/prekey/status mine', "const st = (resp && resp.ok) ? await _safeJson(resp, 256 * 1024).catch(() => null) : null;"],
    ['/presence write', "const data = resp?.ok ? await _safeJson(resp, 256 * 1024).catch(() => null) : null;"],
    ['/alias/get', "const data = await _safeJson(resp, 256 * 1024);\n          pubB64 = data.pub"],
    ['/alias/set err', "const d = await _safeJson(resp, 256 * 1024).catch(() => ({}));"],
    ['/turn', "_turnCredential = await _safeJson(resp, 256 * 1024);"],
    ['/backup/upload info', "const info = await _safeJson(resp, 256 * 1024).catch(() => null);"],
    ['/backup/download', "const { backup } = await _safeJson(resp, 8 * 1024 * 1024);"],
    ['/ktlog/get', "const { log } = await _safeJson(resp, 1024 * 1024);"],
    ['/online', "const data = await _safeJson(resp, 256 * 1024);\n            const peerCount"],
    ['/device/list linkto', "const rec = resp?.ok ? await _safeJson(resp, 1024 * 1024) : null;"],
    ['/group/kick err', "const kickData = await _safeJson(kickResp, 256 * 1024).catch(() => ({}));"],
  ];
  for (const [name, needle] of sites) {
    it(`${name}`, () => expect(SRC).toContain(needle));
  }
});

describe('remaining raw resp.json() sites are only the recurring polls', () => {
  it('exactly 7 unbounded reads remain (msg/sealed/sig/presence polls)', () => {
    const raw = SRC.match(/await (?:sResp|resp|r|healthResp|kickResp)\.json\(\)/g) || [];
    expect(raw.length).toBe(7);
  });
});
