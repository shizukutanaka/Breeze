// tests/import-batch.test.js — Breeze deep-behavior test: importChat uses one indexed
// read + a single-transaction batch write instead of ~2N sequential IDB round-trips,
// and 'isMine' is an EXACT name match — 'Amelia' contains 'me' and 'Yousef' 'you',
// so the old includes() misattributed their messages as my own outgoing ones.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Drive the exact shipped expression out of index.html — the test fails if the
// operator drifts back to a substring match or the guard is dropped.
const exprMatch = SRC.match(/myNames\.some\(n => \([^\n]+?\) === n\)/);
const isMine = exprMatch && new Function('myNames', 'm', 'return ' + exprMatch[0] + ';');
const MY_NAMES = ['alice', 'you', 'me', 'self'];

describe('importChat isMine attribution', () => {
  it('extracts the shipped isMine expression', () => { expect(typeof isMine).toBe('function'); });
  it('substring lookalikes are NOT misattributed as mine', () => {
    expect(isMine(MY_NAMES, { sender: 'Amelia' })).toBe(false);  // contains 'me'
    expect(isMine(MY_NAMES, { sender: 'Yousef' })).toBe(false);  // contains 'you'
    expect(isMine(MY_NAMES, { sender: 'Myself!' })).toBe(false); // contains 'self'
  });
  it('exact name matches still attribute as mine', () => {
    expect(isMine(MY_NAMES, { sender: 'alice' })).toBe(true);
    expect(isMine(MY_NAMES, { sender: 'Alice' })).toBe(true); // case-insensitive via toLowerCase
    expect(isMine(MY_NAMES, { sender: 'you' })).toBe(true);
  });
  it('missing sender does not throw or match', () => {
    expect(isMine(MY_NAMES, { sender: undefined })).toBe(false);
  });
});

describe('batched import write path', () => {
  it('reads existing ids via the contact index, not per-message dbGet', () => {
    expect(SRC).toContain("new Set((await dbGetByIndex('messages', 'contact', contact.id)).map(m => m.msgId))");
    expect(SRC).not.toContain("const existing = await dbGet('messages', msgId)");
  });
  it('writes the batch in one helper call and dedups within the file itself', () => {
    expect(SRC).toContain("await dbPutMany('messages', batch)");
    expect(SRC).toContain('existingIds.add(msgId)');
    expect(SRC).not.toContain('includes(n)');
  });
});

describe('dbPutMany helper', () => {
  const start = SRC.indexOf('  async function dbPutMany');
  const fnSrc = SRC.slice(start, SRC.indexOf('\n  }', start) + 4);
  const putMany = new Function('db', '_dbg', fnSrc + '; return dbPutMany;');
  function fakeDb(puts, fail) {
    return { transaction: () => {
      const tx = { objectStore: () => ({ put: v => { puts.push(v); return {}; } }) };
      setTimeout(() => { fail ? (tx.onerror && tx.onerror()) : (tx.oncomplete && tx.oncomplete()); }, 0);
      return tx;
    } };
  }
  it('extracts the shipped dbPutMany function', () => { expect(typeof putMany(fakeDb([], false), () => {})).toBe('function'); });
  it('puts every value inside one transaction and resolves true', async () => {
    const puts = [];
    const ok = await putMany(fakeDb(puts, false), () => {})('messages', [{ msgId: 'a' }, { msgId: 'b' }, { msgId: 'c' }]);
    expect(ok).toBe(true);
    expect(puts.map(p => p.msgId)).toEqual(['a', 'b', 'c']);
  });
  it('resolves false on transaction error', async () => {
    const ok = await putMany(fakeDb([], true), () => {})('messages', [{ msgId: 'x' }]);
    expect(ok).toBe(false);
  });
});
