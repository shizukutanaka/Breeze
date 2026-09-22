import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const WORKER = readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const MS = { SEC: 1000, MIN: 60000, HOUR: 3600000, DAY: 86400000 };

// Extract the shipped cursor-guard statement and evaluate the real predicate.
const stmt = SRC.match(/if \(typeof msg\.ts === 'number' && Number\.isFinite\(msg\.ts\) && msg\.ts > _lastPollTs && msg\.ts <= ([^\n]+?)\) _lastPollTs = msg\.ts;/);
const advance = new Function('msg', '_lastPollTs', 'MS', 'Date',
  `if (${stmt[0].slice(4, stmt[0].indexOf(') _lastPollTs'))}) return true; return false;`);

describe('poll cursor bound — _lastPollTs can\'t be pushed past undelivered mail (CWE-345)', () => {
  const now = Date.now();
  it('advances on a normal in-window timestamp', () => {
    expect(advance({ ts: now - 60000 }, now - 120000, MS, Date)).toBe(true);
    expect(advance({ ts: now + 4 * MS.MIN }, now, MS, Date)).toBe(true); // inside send window
  });
  it('rejects a poisoned far-future ts (was accepted at the old +MS.DAY bound)', () => {
    for (const ts of [now + 6 * MS.MIN, now + MS.HOUR, now + 23 * MS.HOUR, now + MS.DAY]) {
      expect(advance({ ts }, now, MS, Date)).toBe(false);
    }
  });
  it('still rejects non-numeric / non-finite / non-advancing ts', () => {
    for (const ts of ['x', NaN, Infinity, -1, now - 1, now]) {
      expect(advance({ ts }, now, MS, Date)).toBe(false);
    }
  });
  it('the bound mirrors the worker send window (tripwire: worker rejects |now-ts|>5min)', () => {
    expect(stmt[1]).toContain('5 * MS.MIN');
    // The worker-side freshness check this client bound mirrors must still exist.
    expect(WORKER).toContain('Math.abs(now - msgTs) > TIMEOUT_MS.REQ_TS');
    // The old day-wide window must not survive anywhere on the cursor.
    expect(SRC).not.toContain('msg.ts <= Date.now() + MS.DAY');
  });
});
