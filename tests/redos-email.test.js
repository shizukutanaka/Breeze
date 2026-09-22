import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Pull the shipped email auto-link regex out of renderLinks and evaluate the real pattern.
const m = SRC.match(/\.replace\(\/\(\[a-zA-Z0-9\._%\+-\][^\n]*?\/g, '<a href="mailto:/);
const EMAIL_RE = new RegExp(m[0].match(/\/(.+)\/g, '/)[1], 'g');

describe('renderLinks email regex — ReDoS-resistant (CWE-1333)', () => {
  it('uses bounded quantifiers (the unbounded [0-9.-]+\\. class pair backtracked O(L²))', () => {
    expect(EMAIL_RE.source).toContain('{1,64}');
    expect(EMAIL_RE.source).toContain('{1,253}');
    expect(EMAIL_RE.source).toContain('{2,63}');
    expect(EMAIL_RE.source).not.toContain('[a-zA-Z]{2,}');
  });

  it('still auto-links ordinary addresses identically', () => {
    for (const s of ['a@b.co', 'x.y+z@sub.domain.com', 'First_Last-99@mail-server.example.org']) {
      expect(s.match(EMAIL_RE)?.[0]).toBe(s);
    }
    expect('not an email'.match(EMAIL_RE)).toBeNull();
    expect('@b.com'.match(EMAIL_RE)).toBeNull();   // no local part
    expect('a@b.c'.match(EMAIL_RE)).toBeNull();    // TLD < 2
    expect('a@b_x.com'.match(EMAIL_RE)).toBeNull();// _ never allowed in domain
  });

  it('a crafted 64KB near-miss renders in well under a second (was ~2s quadratic)', () => {
    const hostile = 'a.'.repeat(32000) + '@' + 'b.'.repeat(32000); // 64KB of label/dot runs
    const t0 = Date.now();
    hostile.replace(EMAIL_RE, 'X');
    expect(Date.now() - t0).toBeLessThan(500);
  });
});
