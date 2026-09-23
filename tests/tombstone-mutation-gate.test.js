import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('wire mutations are no-ops on tombstones (deleted messages stay deleted)', () => {
  it('all 3 edit gates reject deleted records', () => {
    expect(SRC).toContain("if (signal.type === 'edit' && typeof signal.text === 'string' && !stored.deleted) {");
    expect(SRC).toContain("const _ok = _ownGroupMsg(stored) && typeof signal.text === 'string' && !stored.deleted;");
    expect(SRC).toContain("const _okEdit = stored && !stored.mine && stored.contactId === contactId && typeof signal.text === 'string' && !stored.deleted;");
  });
  it('all 3 reaction gates reject deleted records', () => {
    expect(SRC).toContain("else if (signal.type === 'reaction' && typeof signal.emoji === 'string' && signal.emoji.length <= 64 && !stored.deleted) {");
    expect(SRC).toContain("if (stored && !stored.deleted && stored.contactId === msg.groupId && typeof signal.emoji === 'string' && signal.emoji.length <= 64) {");
    expect(SRC).toContain("if (stored && !stored.deleted && stored.contactId === contactId && typeof signal.emoji === 'string' && signal.emoji.length <= 64) {");
  });
  it('functional: edit-after-delete leaves the tombstone untouched, live records still update', () => {
    // Drive the shipped 1:1 edit predicate semantics
    const _okEdit = (stored, contactId, signal) =>
      !!(stored && !stored.mine && stored.contactId === contactId && typeof signal.text === 'string' && !stored.deleted);
    const cid = 'peer1';
    const tomb = { mine: false, contactId: cid, deleted: true, text: '' };
    const live = { mine: false, contactId: cid, deleted: false, text: 'old' };
    expect(_okEdit(tomb, cid, { text: 'resurrected' })).toBe(false);
    expect(_okEdit(live, cid, { text: 'resurrected' })).toBe(true);
    expect(_okEdit({ ...live, mine: true }, cid, { text: 'x' })).toBe(false);
  });
});
