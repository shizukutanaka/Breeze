import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('deep-link param scrub (address bar/history)', () => {
  it('scrubs to pathname in the messenger boot branch before initMessenger', () => {
    const m = SRC.match(/show\('v-msg'\);\s*\n\s*history\.replaceState\(null, '', location\.pathname\);[\s\S]{0,400}?\n\s*initMessenger\(\)\.catch/);
    expect(m).toBeTruthy();
  });

  it('P snapshot is taken before the scrub site (downstream P.get reads unaffected)', () => {
    const pIdx = SRC.indexOf('const P = new URLSearchParams(location.search)');
    const sIdx = SRC.indexOf("history.replaceState(null, '', location.pathname); // consume deep-link params once");
    expect(pIdx).toBeGreaterThan(-1);
    expect(sIdx).toBeGreaterThan(pIdx);
  });

  it('every deep-link consumer still reads the snapshot: ?add ?open ?settings ?join', () => {
    expect(SRC).toContain("P.get('add')");
    expect(SRC).toContain("P.get('open')");
    expect(SRC).toContain("P.has('settings')");
    expect(SRC).toContain("P.get('join')");
  });

  it('functional: scrub clears location params while the P snapshot still yields them', () => {
    const loc = { href: 'https://breeze.example/?add=K3y%2B&open=c12&settings=1&join=tok', pathname: '/', search: '?add=K3y%2B&open=c12&settings=1&join=tok' };
    const P = new URLSearchParams(loc.search);
    const hist = { calls: [], replaceState(s, t, u) { this.calls.push(u); loc.href = 'https://breeze.example' + u; loc.search = ''; } };
    hist.replaceState(null, '', loc.pathname);
    expect(loc.search).toBe('');
    expect(P.get('add')).toBe('K3y+');
    expect(P.get('open')).toBe('c12');
    expect(P.has('settings')).toBe(true);
    expect(P.get('join')).toBe('tok');
  });
});
