// Contact-home preflight (musk round 44): the contact-settings home
// relay flow must apply the same pasted-URL preflight as the server
// add-flow — bare hosts gain https:// and non-loopback http:// is
// refused before attestation or storage.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function extractFunction(name) {
  const match = INDEX.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  expect(match, `function ${name} present in index.html`).toBeTruthy();
  const start = match.index;
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

function contactHomeFlowHarness({ promptValue, attestResult = { verdict: 'unreachable', reason: 'unreachable' } }) {
  const state = {
    toasts: [],
    attestCalls: [],
    confirmCalls: 0,
    puts: [],
    audits: [],
  };
  const contact = { id: 'contact-1', name: 'Alice' };
  const src = [
    extractFunction('_normalizeRelayUrl'),
    extractFunction('_preflightRelayUrl'),
    extractFunction('_setContactHomeFlow'),
  ].join('\n');
  const flow = new Function(
    'showPrompt', 'sanitizeHomeList', 'showConfirm', 'dbPut', '_relayInfoCache', 'auditLog', 'showToast', 't', '_relayAttestCheck', 'relayFingerprint', '_dbg',
    `${src}; return _setContactHomeFlow;`
  )(
    async () => promptValue,
    home => (Array.isArray(home) ? home.filter(e => e && typeof e.url === 'string') : []),
    async () => { state.confirmCalls++; return true; },
    async (store, row) => { state.puts.push([store, row]); },
    { delete() {} },
    entry => state.audits.push(entry),
    (key, kind) => state.toasts.push([key, kind]),
    key => key,
    async url => { state.attestCalls.push(url); return attestResult; },
    async () => 'fingerprint',
    () => {},
  );
  return { state, contact, run: () => flow(contact) };
}

describe('_setContactHomeFlow preflight wiring', () => {
  it('routes the pasted input through _preflightRelayUrl instead of direct normalization', () => {
    const src = extractFunction('_setContactHomeFlow');
    expect(src).toContain('_preflightRelayUrl(trimmed)');
    expect(src).not.toContain('_normalizeRelayUrl(trimmed)');
  });

  it('maps an insecure pasted relay to relayAddInsecure before attestation', async () => {
    const { state, run } = contactHomeFlowHarness({ promptValue: 'http://relay.example.com' });
    await run();
    expect(state.toasts).toEqual([['relayAddInsecure', 'error']]);
    expect(state.attestCalls).toEqual([]);
    expect(state.puts).toEqual([]);
  });

  it('maps an invalid pasted relay to relayAddInvalid before attestation', async () => {
    const { state, run } = contactHomeFlowHarness({ promptValue: 'ftp://relay.example.com' });
    await run();
    expect(state.toasts).toEqual([['relayAddInvalid', 'error']]);
    expect(state.attestCalls).toEqual([]);
    expect(state.puts).toEqual([]);
  });

  it('still accepts a keyless relay unpinned without a fingerprint confirm', async () => {
    const { state, contact, run } = contactHomeFlowHarness({
      promptValue: 'https://relay.example.com',
      attestResult: { verdict: 'keyless' },
    });
    await run();
    expect(state.attestCalls).toEqual(['https://relay.example.com/api']);
    expect(state.confirmCalls).toBe(0);
    expect(contact.home).toEqual([{ url: 'https://relay.example.com', pin: '' }]);
    expect(state.puts).toEqual([['contacts', contact]]);
    expect(state.toasts).toEqual([['contactHomeSet', 'success']]);
  });
});
