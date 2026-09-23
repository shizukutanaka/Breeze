import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const WHO = SRC.match(/val === '\/who'\) \{[\s\S]+?const aliasUrl[^\n]+\n/)[0];

describe('/who share-link generators (dead-link fix)', () => {
  it('addUrl encodes the pub key — base64 "+" survives URLSearchParams parse', () => {
    expect(WHO).toContain("'?add=' + encodeURIComponent(myPubB64)");
  });

  it("aliasUrl carries the '@' prefix — bare alias routed to pubkey parse is a dead link", () => {
    expect(WHO).toContain("'?add=@' + myAlias");
  });

  it('tripwire: no remaining bare-concat pub-key generator (?add= + myPubB64)', () => {
    expect(SRC).not.toContain("?add=' + myPubB64");
    expect(WHO).not.toContain("'?add=' + myAlias");
  });

  it('functional: built links round-trip — "+"-bearing key parses back identical, "@alice" routes to alias branch', () => {
    const SHARE_BASE = 'https://breeze.example/';
    const myPubB64 = 'AbC+/dEfG+IjK==';
    const myAlias = 'alice';
    const addUrl = SHARE_BASE + '?add=' + encodeURIComponent(myPubB64);
    const aliasUrl = SHARE_BASE + '?add=@' + myAlias;
    const p1 = new URL(addUrl).searchParams.get('add');
    expect(p1).toBe(myPubB64); // '+' survives
    const p2 = new URL(aliasUrl).searchParams.get('add');
    expect(p2.startsWith('@')).toBe(true);
    expect(p2.slice(1)).toBe(myAlias);
  });
});
