import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Account switch runs _messengerCleanup in the SAME document — a per-init
// _blobUrls set is orphaned with its closure, but blob: URLs are global: every
// minted URL for rendered voice/file/image attachments held its decoded bytes
// until page unload unless explicitly revoked (CWE-772, same lifecycle class
// as the BroadcastChannel/AudioContext/IDB-handle fixes).
const cleanupStart = src.indexOf('_messengerCleanup = () => {');
const cleanupEnd = src.indexOf('_sttRec = null;', cleanupStart);
const cleanup = src.slice(cleanupStart, cleanupEnd);

describe('blob: URLs are revoked on account switch (CWE-772)', () => {
  it('cleanup revokes every URL in _blobUrls and clears the set', () => {
    expect(cleanup).toContain('_blobUrls.forEach(u => URL.revokeObjectURL(u))');
    expect(cleanup).toContain('_blobUrls.clear()');
  });
  it('revocation is throw-contained (try/catch, _dbg)', () => {
    expect(cleanup).toContain("try { _blobUrls.forEach(u => URL.revokeObjectURL(u)); _blobUrls.clear(); } catch(e) { _dbg(e); }");
  });
  it('all minted attachment URLs are tracked in the set the cleanup drains', () => {
    // the renderer adds every createObjectURL it hands to <audio>/<img>/<a href>
    expect(src).toContain('_blobUrls.add(href)');
    const minted = src.match(/_blobUrls\.add\(href\)/g) || [];
    const created = src.match(/href = URL\.createObjectURL/g) || [];
    expect(minted.length).toBe(created.length);
  });
  it('functional: the shipped statement revokes each tracked URL once', () => {
    const revoked = [];
    const _blobUrls = new Set(['blob:a', 'blob:b', 'blob:c']);
    const URL = { revokeObjectURL: (u) => revoked.push(u) };
    new Function('_blobUrls', 'URL', '_dbg',
      `try { _blobUrls.forEach(u => URL.revokeObjectURL(u)); _blobUrls.clear(); } catch(e) { _dbg(e); } return _blobUrls.size;`
    )(_blobUrls, URL, () => { throw new Error('must not throw'); });
    expect(revoked.sort()).toEqual(['blob:a', 'blob:b', 'blob:c']);
    expect(_blobUrls.size).toBe(0);
  });
});
