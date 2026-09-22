// Bearer params must not linger in the location bar or browser history once captured —
// OIDC/OAuth clients strip ?code/?state via history.replaceState for the same reason
// (OWASP: secrets in URLs persist in history, tab previews, screenshots, copied links).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('credential params scrubbed from URL after capture', () => {
  const scrubIdx = html.indexOf("if (location.search || location.hash) history.replaceState(null, '', '/')");

  it('scrubs the location early, after P/joinToken capture and before consumers', () => {
    expect(scrubIdx, 'early replaceState scrub must exist').toBeGreaterThan(-1);
    expect(html.indexOf('new URLSearchParams(location.search)')).toBeLessThan(scrubIdx);
    expect(html.indexOf('const joinToken =')).toBeLessThan(scrubIdx);
    // before the param-consuming branches (drop page / initMessenger)
    expect(scrubIdx).toBeLessThan(html.indexOf("if (P.has('drop'))"));
    expect(scrubIdx).toBeLessThan(html.indexOf('initMessenger()'));
  });

  it('captures the # fragment BEFORE scrubbing (the ?drop key lives there)', () => {
    const hashIdx = html.indexOf('const _urlHash = location.hash.slice(1)');
    expect(hashIdx, 'hash must be captured before the wipe').toBeGreaterThan(-1);
    expect(hashIdx).toBeLessThan(scrubIdx);
  });

  it('drop handler reads the captured hash — a live read after the scrub is always empty', () => {
    expect(html).toMatch(/const keyB64 = _urlHash/);
    expect(html).not.toMatch(/const keyB64 = location\.hash/);
  });

  it('all param consumers read the P snapshot (unaffected by the scrub)', () => {
    for (const param of ["P.get('add')", "P.get('name')", "P.get('open')", "P.get('drop')", "P.get('join')", "P.get('text')"]) {
      expect(html, `${param} reader missing`).toContain(param);
    }
    // no live re-reads of the search params after the snapshot
    expect(html.match(/new URLSearchParams\(location\.search\)/g)).toHaveLength(1);
  });
});
