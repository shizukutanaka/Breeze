import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('?add= link generation — pub key must be URL-encoded (base64 + breaks URLSearchParams parse)', () => {
  it('encodes myPubB64 in every ?add= generator (4 sites total)', () => {
    const uses = SRC.match(/encodeURIComponent\(myPubB64\)/g) || [];
    expect(uses.length).toBe(4); // 12568 (invite msg) + 13547 + 13577 + 13783
  });

  it('has no unencoded ?add= + myPubB64 site remaining (tripwire)', () => {
    expect(SRC).not.toMatch(/\?add=' \+ myPubB64/);
    expect(SRC).not.toMatch(/\?add=' \+ \([^)]*: ?myPubB64\)/);
    // no add-link template may concatenate a bare pub key
    expect(SRC).not.toMatch(/SHARE_BASE \+ '\?add=' \+ myPubB64/);
  });

  it('keeps the @alias branch unencoded (alias charset is query-safe)', () => {
    expect(SRC).toContain("'?add=' + (myAlias ? '@' + myAlias : encodeURIComponent(myPubB64))");
    expect(SRC).toContain("SHARE_BASE + '?add=' + encodeURIComponent(myPubB64) + '&name=' + encodeURIComponent(myName)");
  });

  it('round-trips a +-bearing base64 key through URLSearchParams (the actual bug)', () => {
    const pub = 'AB+C/DEF='; // contains '+', '/', '=' — standard btoa alphabet
    const fixed = new URLSearchParams('add=' + encodeURIComponent(pub)).get('add');
    const broken = new URLSearchParams('add=' + pub).get('add');
    expect(fixed).toBe(pub);      // encoded → parses back exactly
    expect(broken).toBe('AB C/DEF='); // unencoded '+' decodes to space → corrupt key
    expect(broken).not.toBe(pub);
  });
});
