import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const CONV = SRC.match(/function updateConvStatus\(\) \{[\s\S]+?\n  \}\n/)[0];
const MEASURE = SRC.match(/async function measureNetworkQuality\(\) \{[\s\S]+?\n  \}\n/)[0];

describe('dead-context status writes on account switch', () => {
  it('updateConvStatus returns immediately on an aborted context', () => {
    // First statement of the function must be the abort guard — every later
    // write to the shared msg-conv-status element assumes a live context.
    expect(CONV).toContain('function updateConvStatus() { if (_ac.signal.aborted) return;');
    expect(CONV.indexOf('_ac.signal.aborted')).toBeLessThan(CONV.indexOf('msg-conv-status'));
  });
  it('measureNetworkQuality gates its shared-element write on the context signal', () => {
    // An in-flight /health fetch from the dead context must not stamp its RTT
    // into the element the next account is already using.
    expect(MEASURE).toContain('statusEl && activeContact && !_ac.signal.aborted');
  });
  it('both guards reference the per-init AbortController declared inside initMessenger', () => {
    expect(SRC).toContain('const _ac = new AbortController(); // Abort all listeners on account switch');
    expect(SRC.indexOf('const _ac = new AbortController()')).toBeLessThan(SRC.indexOf('function updateConvStatus()'));
    expect(SRC.indexOf('const _ac = new AbortController()')).toBeLessThan(SRC.indexOf('function measureNetworkQuality()'));
  });
  it('functional: the shipped guard shape suppresses writes once aborted', () => {
    const writer = new Function('_ac', 'statusEl', "if (_ac.signal.aborted) return; statusEl.textContent = 'stale';");
    const ac = new AbortController();
    const el = { textContent: '' };
    writer(ac, el);
    expect(el.textContent).toBe('stale');
    el.textContent = 'live';
    ac.abort();
    writer(ac, el);
    expect(el.textContent).toBe('live');
  });
});
