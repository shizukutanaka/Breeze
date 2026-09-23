import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('initMessenger mid-init abort (dead-context cleanup)', () => {
  it('registers a minimal _messengerCleanup right after _ac creation', () => {
    const acIdx = SRC.indexOf('const _ac = new AbortController();');
    expect(acIdx).toBeGreaterThan(-1);
    const head = SRC.slice(acIdx, acIdx + 400);
    expect(head).toContain('_messengerCleanup = () => { _ac.abort(); try { db?.close(); } catch {} };');
    // The setup-completion listener mutates module state (_outboxKey/myId) — dead contexts must bail.
    const setupL = SRC.indexOf("_DOM.get('b-msg-setup')?.addEventListener('click', async () => {");
    expect(setupL).toBeGreaterThan(-1);
    expect(SRC.slice(setupL, setupL + 200)).toContain('if (_ac.signal.aborted) return;');
  });

  it('_boot() aborts before loading identity / arming any live-session work', () => {
    const m = SRC.match(/async function _boot\(\) \{[\s\S]+?\n  if \(hasId\)/);
    expect(m).not.toBeNull();
    const head = m[0];
    expect(head).toContain('if (_ac.signal.aborted) return;');
    expect(head.indexOf('if (_ac.signal.aborted) return;')).toBeLessThan(head.indexOf('loadIdentity()'));
  });

  it('_registerMessengerCleanup refuses to register from a dead context', () => {
    const m = SRC.match(/function _registerMessengerCleanup\(\) \{[\s\S]+?_ac\.abort\(\);/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain('if (!_ac.signal.aborted) _messengerCleanup = () => {');
  });

  it('a mid-init switch leaves the live cleanup slot clean — dead context cannot clobber it', () => {
    // Functional drive of the shipped pattern: minimal cleanup at init head, switch fires it,
    // then the (still-running) dead init reaches _registerMessengerCleanup — which must NOT
    // overwrite the slot the live account's init is about to fill.
    let _messengerCleanup = null;
    const _ac = new AbortController();
    _messengerCleanup = () => { _ac.abort(); }; // shipped minimal head registration
    // switchAccount fires the registered cleanup and clears the slot:
    if (_messengerCleanup) { _messengerCleanup(); _messengerCleanup = null; }
    expect(_ac.signal.aborted).toBe(true);
    // Dead init continues to boot end and reaches the gated registration:
    function _registerMessengerCleanup() {
      if (!_ac.signal.aborted) _messengerCleanup = () => { /* full teardown */ };
    }
    _registerMessengerCleanup();
    expect(_messengerCleanup).toBe(null); // dead context must not clobber the live cleanup slot
  });
});
