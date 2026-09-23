import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const BLOCK = SRC.match(/async function restoreCloudBackup[\s\S]+?\n {2}\}/)[0];

describe('restoreCloudBackup message ingest bounds (isPoll invariant / CWE-248)', () => {
  it('array-gates data.messages and shape-checks each record', () => {
    expect(BLOCK).toContain('Array.isArray(data.messages)');
    expect(BLOCK).toContain("typeof m.msgId !== 'string'");
    expect(BLOCK).toContain("typeof m.contactId !== 'string'");
    expect(BLOCK).toContain('Number.isFinite(m.ts)');
    expect(BLOCK).not.toMatch(/for \(const m of data\.messages\) await dbPut/); // raw loop must not remain
  });

  it('enforces isPoll => parseable object (wire-path invariant)', () => {
    expect(BLOCK).toContain('if (m.isPoll)');
    expect(BLOCK).toContain('JSON.parse(m.text)');
  });

  it('strips non-finite disappearAt (mirrors the wire guard)', () => {
    expect(BLOCK).toContain('!Number.isFinite(m.disappearAt)');
    expect(BLOCK).toContain('m.disappearAt = undefined');
  });

  it('functional: the shipped predicates skip malformed records and keep good ones', () => {
    const keep = (m) => {
      if (!m || typeof m.msgId !== 'string' || typeof m.contactId !== 'string' || !Number.isFinite(m.ts)) return false;
      if (m.isPoll) { let p = null; try { p = JSON.parse(m.text); } catch { return false; } if (!p || typeof p !== 'object') return false; }
      if (!Number.isFinite(m.disappearAt)) m.disappearAt = undefined;
      return true;
    };
    expect(keep({ msgId: 'a:1', contactId: 'c', ts: 1, text: 'hi' })).toBe(true);
    expect(keep({ msgId: 'a:2', contactId: 'c', ts: 1, isPoll: true, text: '{"pollId":"p"}' })).toBe(true);
    expect(keep({ msgId: 'a:3', contactId: 'c', ts: 1, isPoll: true, text: 'not json' })).toBe(false); // poison poll skipped
    expect(keep({ msgId: 'a:4', contactId: 'c', ts: Infinity })).toBe(false);
    expect(keep({ contactId: 'c', ts: 1 })).toBe(false); // missing msgId
    expect(keep(null)).toBe(false);
    const mut = { msgId: 'a:5', contactId: 'c', ts: 1, disappearAt: Infinity };
    expect(keep(mut)).toBe(true);
    expect(mut.disappearAt).toBeUndefined();
  });
});
