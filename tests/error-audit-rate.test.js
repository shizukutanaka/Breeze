import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extract(src, needle, fallbackOffset = 0) {
  const i = src.indexOf(needle);
  if (i < 0) throw new Error(`needle not found: ${needle.slice(0, 50)}`);
  return { i: i === -1 ? fallbackOffset : i };
}

// Build the shipped _auditErr function with the same top-level state it mutates.
function makeAuditErr() {
  const start = SRC.indexOf('function _auditErr(detail) {');
  const end = SRC.indexOf('\n}\n', start) + 3;
  const body = SRC.slice(start, end);
  // Recreate the module state the function closes over.
  const factory = new Function(`
    let _auditLogRef = null, _errAudited = 0, _errAuditResetAt = 0, _errAuditSuppressed = 0;
    let NOW = 0;
    const MS = { MIN: 60000 };
    const Date = { now: () => NOW };
    ${body}
    return {
      setRef: f => { _auditLogRef = f; },
      setNow: t => { NOW = t; },
      run: d => _auditErr(d),
      state: () => ({ n: _errAudited, suppressed: _errAuditSuppressed, resetAt: _errAuditResetAt }),
    };
  `);
  return factory();
}

describe('error audit bridge (was dead: auditLog is closure-local)', () => {
  it('wires _auditLogRef = auditLog inside initMessenger so listeners can reach it', () => {
    expect(SRC).toContain('_auditLogRef = auditLog; // expose to the top-level error/rejection listeners');
  });

  it('both window listeners route through _auditErr (no raw auditLog references outside initMessenger)', () => {
    expect(SRC).toContain("_auditErr('JS Error: ' + (event.message || '').slice(0, 200));");
    expect(SRC).toContain("_auditErr('Unhandled: ' + msg.slice(0, 200));");
    const topLevel = SRC.slice(0, SRC.indexOf('async function initMessenger'));
    expect(topLevel).not.toContain('auditLog(');
  });
});

describe('_auditErr rate limit', () => {
  it('silently skips before the bridge is set (pre-init errors)', () => {
    const h = makeAuditErr();
    const calls = [];
    h.run('boom'); // no ref — must not throw, must not call
    expect(h.state().n).toBe(0);
    h.setRef((...a) => calls.push(a));
    h.run('boom');
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toBe('error');
    expect(calls[0][1]).toBe('boom');
  });

  it('admits the first 10 error audits per window then suppresses', () => {
    const h = makeAuditErr();
    const calls = [];
    h.setRef((...a) => calls.push(a));
    h.setNow(1000);
    for (let i = 0; i < 25; i++) h.run('e' + i);
    expect(calls.length).toBe(10);
    expect(h.state().suppressed).toBe(15);
  });

  it('flushes one suppressed-count summary record on the next window', () => {
    const h = makeAuditErr();
    const calls = [];
    h.setRef((...a) => calls.push(a));
    h.setNow(1000);
    for (let i = 0; i < 20; i++) h.run('e' + i); // 10 land, 10 suppressed
    h.setNow(1000 + 61000); // new window
    h.run('next');
    expect(calls.length).toBe(12); // 10 + 1 summary + 1 new
    const summary = calls[10];
    expect(summary[0]).toBe('error');
    expect(summary[1]).toContain('suppressed 10 error audits');
    expect(summary[2]).toBe('warn');
    expect(calls[11][1]).toBe('next');
    // subsequent events in the new window write normally again
    h.run('next2');
    expect(calls.length).toBe(13);
  });

  it('window boundary is per-minute, not cumulative', () => {
    const h = makeAuditErr();
    const calls = [];
    h.setRef((...a) => calls.push(a));
    h.setNow(0);
    for (let i = 0; i < 10; i++) h.run('a');
    h.setNow(59000);
    h.run('b'); // still in window → suppressed
    expect(calls.length).toBe(10);
    h.setNow(61000);
    h.run('c');
    expect(calls.length).toBe(12); // summary + admitted write
  });
});
