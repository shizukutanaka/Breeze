// XSS sink hardening tripwires — the render pipeline (esc → renderMarkdown →
// renderLinks) processes peer-controlled text, so the escaping invariants are
// pinned at the source level (same approach as tests/mirror-drift.test.js).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

describe('esc() quote encoding', () => {
  it('esc() encodes double and single quotes (attribute contexts)', () => {
    // esc() output lands in attribute slots (value=, data-emoji=, title=, alt=).
    // textContent→innerHTML encodes only <>&; without quote encoding a peer
    // reaction emoji like `" onmouseover=...` breaks the attribute boundary.
    expect(SRC).toMatch(/function esc\(s\) \{[^}]*&quot;[^}]*&#39;/);
  });
});

describe('renderLinks URL sink', () => {
  it('URL regex excludes quote characters', () => {
    // `href="${url}"` interpolates the match verbatim — the character class must
    // stop at " and ' or the match itself can carry an attribute breakout.
    expect(SRC).toMatch(/https\?\:\\\/\\\/\[\^\\s<>"'\]\+/);
  });
});

describe('file blobUrl sink', () => {
  it('peer-supplied blobUrl is scheme-restricted to blob:', () => {
    // fileData JSON is decrypted peer input; blobUrl flows into <a href> and
    // <img src>. A javascript: value would survive as a click-XSS vector.
    expect(SRC).toMatch(/blobUrl\s*&&|typeof f\.blobUrl === 'string' && f\.blobUrl\.startsWith\('blob:'\)/);
  });
});
