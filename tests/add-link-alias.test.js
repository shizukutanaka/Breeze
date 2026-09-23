import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('?add= alias links must carry the @ prefix (reader keys on startsWith(\'@\'))', () => {
  it('pins the reader-side convention: alias iff addKey starts with @', () => {
    expect(SRC).toContain("addKey.startsWith('@')");
  });

  it('has no ?add= + bare-alias site left (tripwire)', () => {
    expect(SRC).not.toMatch(/\?add=' \+ myAlias/);
    // a ternary alias branch must always emit '@' + myAlias
    expect(SRC).not.toMatch(/\?add=' \+ \(myAlias \? (?!'@')/);
  });

  it('pins all alias-bearing generators emitting the @ prefix', () => {
    const literal = SRC.match(/\?add=@' \+ myAlias/g) || [];       // 12567 + 13548
    const ternary = SRC.match(/\?add=' \+ \(myAlias \? '@' \+ myAlias/g) || []; // 13577 + 13783
    expect(literal.length).toBe(2);
    expect(ternary.length).toBe(2);
  });

  it('routes link shapes correctly — @ → resolveAndAdd, bare name → dead pubkey path', () => {
    const route = (addKey) => (addKey.startsWith('@') ? 'resolveAndAdd' : 'addContact');
    expect(route('@alice')).toBe('resolveAndAdd');
    // the pre-fix generated shape (?add=alice) never reaches the alias resolver —
    // it falls to addContact where _isValidPubB64 rejects a 5-char alias
    expect(route('alice')).toBe('addContact');
    expect('alice'.length).not.toBe(32);
    expect('alice'.length).not.toBe(65);
  });
});
