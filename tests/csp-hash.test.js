// Tests for tools/csp-hash.mjs's check verdict (cspProblems) and the hash
// computation the _headers pin depends on. The tool is the only thing standing
// between a hand-edited _headers and a silently unpinned CSP — its own false
// negatives are the interesting bugs.
import { describe, it, expect } from 'vitest';
import { computeHashes, cspProblems } from '../tools/csp-hash.mjs';

const BASE = "default-src 'self'; script-src 'self' 'sha256-AAA'; style-src 'self';";

describe('cspProblems — the --check verdict', () => {
  it('passes when header equals the freshly computed policy', () => {
    expect(cspProblems(BASE, BASE)).toEqual([]);
  });

  it('flags a stale script-src (hash drift)', () => {
    const stale = "default-src 'self'; script-src 'self' 'sha256-OLD'; style-src 'self';";
    expect(cspProblems(stale, BASE)).toEqual(['_headers CSP script-src is stale']);
  });

  it("flags 'unsafe-inline' inside script-src", () => {
    const lax = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self';";
    const ps = cspProblems(lax, BASE);
    expect(ps).toContain("_headers script-src still allows 'unsafe-inline'");
    expect(ps).toContain('_headers CSP script-src is stale');
  });

  it('flags a CSP with NO script-src at all (the original false negative)', () => {
    // rewriteScriptSrc no-ops without a directive, so want === header and the
    // stale check alone would have passed an unpinned policy forever.
    const bare = "default-src 'self'; style-src 'self';";
    expect(cspProblems(bare, bare)).toEqual([
      '_headers CSP has no script-src directive — nothing pins the inline scripts',
    ]);
  });
});

describe('computeHashes — what the browser actually hashes', () => {
  it('hashes every inline script, skipping src= scripts', () => {
    const html = '<script>const a = 1;</script><script src="/x.js"></script><script id="s2">const b = 2;</script>';
    expect(computeHashes(html)).toHaveLength(2);
  });

  it('is deterministic on the exact inner bytes', () => {
    const h1 = computeHashes('<script>let x = 1;</script>');
    const h2 = computeHashes('<script>let x = 1;</script>');
    const h3 = computeHashes('<script>let x = 2;</script>');
    expect(h1).toEqual(h2);
    expect(h1).not.toEqual(h3);
    expect(h1[0]).toMatch(/^'sha256-[A-Za-z0-9+/=]+'$/);
  });
});
