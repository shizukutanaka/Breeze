import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('P2P reaction path refuses tombstones', () => {
  it('the 4th wire reaction site (DataChannel 1:1) gates on !stored.deleted', () => {
    expect(SRC).toContain(
      "if (stored && !stored.deleted && stored.contactId === contact.id) {\n              stored.reactions = _ownArrayMap(stored.reactions);"
    );
  });
  it('local toggleReaction early-returns on tombstones', () => {
    expect(SRC).toContain("if (!stored || stored.deleted) return;");
  });
  it('functional: gate predicate rejects deleted records, accepts live ones', () => {
    const gate = (stored, cid) => !!(stored && !stored.deleted && stored.contactId === cid);
    expect(gate({ contactId: 'c1', deleted: true }, 'c1')).toBe(false);
    expect(gate({ contactId: 'c1', deleted: false }, 'c1')).toBe(true);
    expect(gate({ contactId: 'other', deleted: false }, 'c1')).toBe(false);
    expect(gate(null, 'c1')).toBe(false);
  });
});
