// _replyCounts: reply-target counting over wire replyTo.msgId must use a
// null-prototype map + safeMsgId normalization — '__proto__'/'constructor' wire
// ids otherwise hit Object.prototype members (write silently dropped, inherited
// Function values corrupt the count). Same class as _ownArrayMap (reactions)
// and _groupTypingState (typers).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the real safeMsgId + the counting block.
const SM_START = SRC.indexOf('function safeMsgId(');
const SM_SRC = SRC.slice(SM_START, SRC.indexOf('\n}', SM_START) + 2);
const safeMsgId = new Function(SM_SRC + ' return safeMsgId;')();
const BLK_START = SRC.indexOf('const _replyCounts =');
const BLK = SRC.slice(BLK_START, SRC.indexOf('const renderBatch', BLK_START));
const runCounts = (msgs) => {
  const fn = new Function('safeMsgId', 'msgs', BLK + ' return _replyCounts;');
  return fn(safeMsgId, msgs);
};

describe('_replyCounts proto-key hardening (CWE-915)', () => {
  it('counts real reply targets', () => {
    const c = runCounts([
      { replyTo: { msgId: 'peerabc1234:1700' } },
      { replyTo: { msgId: 'peerabc1234:1700' } },
      { replyTo: { msgId: 'peerabc1234:1800' } },
      { msgId: 'm1' },
    ]);
    expect(c['peerabc1234:1700']).toBe(2);
    expect(c['peerabc1234:1800']).toBe(1);
  });
  it('__proto__/constructor wire ids become own properties — no silent drop, no inherited-member weirdness', () => {
    const c = runCounts([
      { replyTo: { msgId: '__proto__' } },
      { replyTo: { msgId: '__proto__' } },
      { replyTo: { msgId: 'constructor' } },
      { replyTo: { msgId: 'toString' } },
    ]);
    expect(Object.prototype.hasOwnProperty.call(c, '__proto__')).toBe(true);
    expect(c['__proto__']).toBe(2);
    expect(c['constructor']).toBe(1);
    expect(c['toString']).toBe(1);
    expect(Object.getPrototypeOf(c)).toBe(null);
  });
  it('normalizes the wire key through safeMsgId (charset-strip + 64 cap)', () => {
    const raw = 'peerabc1234:1' + '<>{}[]'.repeat(30);
    const c = runCounts([{ replyTo: { msgId: raw } }]);
    const key = safeMsgId(raw);
    expect(c[key]).toBe(1);
    expect(key.length).toBeLessThanOrEqual(64);
    expect(Object.keys(c)).toEqual([key]);
  });
  it('skips missing/non-string msgId', () => {
    const c = runCounts([
      { replyTo: {} },
      { replyTo: { msgId: 7 } },
      { replyTo: null },
      {},
    ]);
    expect(Object.keys(c).length).toBe(0);
  });
  it('wire-site tripwires', () => {
    const site = BLK;
    expect(site).toContain('Object.create(null)');
    expect(site).toContain('safeMsgId(m.replyTo.msgId)');
    expect(site).not.toContain('= {}');
    // read side untouched
    expect(SRC).toContain('replyCount: _replyCounts[m.msgId] || 0');
  });
});
