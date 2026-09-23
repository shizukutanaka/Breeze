import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const BLOCK = SRC.match(/function schedulePresence\(\) \{[\s\S]+?\n    \}/)[0];

describe('presence chain abort-gate (dead-context re-arm, CWE-772)', () => {
  it('schedulePresence bails at the top on an aborted context — all re-arm callers covered', () => {
    expect(BLOCK).toMatch(/function schedulePresence\(\) \{\s*if \(_ac\.signal\.aborted\) return;/);
  });

  it('the in-flight setTimeout callback re-checks abort before beat/updateConvStatus/re-arm', () => {
    const cb = BLOCK.match(/setTimeout\(\(\) => \{([\s\S]+?)\}, interval\)/)[1];
    expect(cb).toMatch(/^\s*if \(_ac\.signal\.aborted\) return;/);
    expect(cb).toContain('schedulePresence();');
  });

  it('still clears any pending timer before arming (single-chain invariant)', () => {
    expect(BLOCK).toContain('if (_presenceTimer) clearTimeout(_presenceTimer);');
  });

  it('functional: dead context skips re-arm; live context arms exactly one chain', () => {
    const timers = [];
    const clearTimeout_ = (t) => { const i = timers.indexOf(t); if (i > -1) timers.splice(i, 1); };
    const setTimeout_ = (fn) => { timers.push(fn); return fn; };
    const _ac = { signal: { aborted: false } };
    let _presenceTimer = null;
    const beat = () => {};
    const updateConvStatus = () => {};
    const document = { hidden: false };
    const CONFIG = { PRESENCE_BG_INTERVAL_MS: 120000, PRESENCE_INTERVAL_MS: 30000 };
    const activeContact = null;
    function schedulePresence() {
      if (_ac.signal.aborted) return; // dead context: never re-arm the presence chain
      if (_presenceTimer) clearTimeout(_presenceTimer);
      const interval = document.hidden ? CONFIG.PRESENCE_BG_INTERVAL_MS : CONFIG.PRESENCE_INTERVAL_MS;
      _presenceTimer = setTimeout_(() => { if (_ac.signal.aborted) return; beat(); if (activeContact) updateConvStatus(activeContact); schedulePresence(); }, interval);
    }
    schedulePresence();
    expect(timers.length).toBe(1);
    _ac.signal.aborted = true; // account switch mid-flight
    timers.pop()(); // the in-flight callback fires on a dead context
    expect(timers.length).toBe(0); // no re-arm — chain ends
    schedulePresence();
    expect(timers.length).toBe(0); // direct calls also no-op
  });
});
