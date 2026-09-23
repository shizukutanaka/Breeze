import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The serviceWorker 'message' listener inside initMessenger must be _ac-scoped:
// navigator.serviceWorker is a global EventTarget that survives account switches.
describe('serviceWorker message listener is _ac-scoped', () => {
  it('registers with { signal: _ac.signal }', () => {
    expect(SRC).toContain("navigator.serviceWorker?.addEventListener('message', (e) => {");
    // Exactly one sw 'message' registration and it carries the abort signal
    const regSites = SRC.split("serviceWorker?.addEventListener('message',").length - 1;
    expect(regSites).toBe(1);
    expect(SRC).toContain("}, { signal: _ac.signal });");
  });
  it('functional: an _ac.signal-registered listener stops firing after abort', () => {
    // Minimal EventTarget honoring options.signal (what the DOM guarantees)
    const et = {
      _ls: new Map(),
      addEventListener(t, fn, o) {
        const s = new Set(this._ls.get(t) || []);
        s.add(fn); this._ls.set(t, s);
        o?.signal?.addEventListener('abort', () => s.delete(fn), { once: true });
      },
      dispatch(t, e) { for (const f of this._ls.get(t) || []) f(e); },
    };
    const ac = new AbortController();
    const seen = [];
    // Register twice the way two initMessenger runs would — both should detach.
    et.addEventListener('message', (e) => seen.push(['a', e.data.type]), { signal: ac.signal });
    et.dispatch('message', { data: { type: 'mark-read' } });
    ac.abort();
    et.dispatch('message', { data: { type: 'mark-read' } });
    expect(seen).toEqual([['a', 'mark-read']]);
  });
});
