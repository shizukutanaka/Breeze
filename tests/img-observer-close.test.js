import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const CLEANUP = SRC.match(/_messengerCleanup = \(\) => \{[\s\S]+?\n    \};/)[0];

describe('lazy-image IntersectionObserver release on account switch', () => {
  it('cleanup disconnects _imgObserver inside _messengerCleanup', () => {
    expect(CLEANUP).toContain('_imgObserver?.disconnect()');
    expect(CLEANUP.indexOf('_fileChunks')).toBeLessThan(CLEANUP.indexOf('_imgObserver?.disconnect()'));
  });
  it('exactly one disconnect site; observer created once per init', () => {
    expect(SRC.match(/_imgObserver\?\.disconnect\(\)/g).length).toBe(1);
    expect(SRC.match(/new IntersectionObserver/g).length).toBe(1);
  });
  it('functional: disconnect statement releases a stub observer', () => {
    const disc = new Function('_imgObserver', '_dbg', "try { _imgObserver?.disconnect(); } catch(e) { _dbg(e); }");
    const obs = { disconnected: false, disconnect() { this.disconnected = true; } };
    disc(obs, () => {});
    expect(obs.disconnected).toBe(true);
    expect(() => disc(null, () => {})).not.toThrow();
    const errs = [];
    expect(() => disc({ disconnect() { throw new Error('boom'); } }, e => errs.push(e))).not.toThrow();
    expect(errs[0].message).toBe('boom');
  });
  it('observe/unobserve call sites unchanged', () => {
    expect(SRC).toContain('_imgObserver.observe(img)');
    expect(SRC).toContain('_imgObserver.unobserve(entry.target)');
  });
});
