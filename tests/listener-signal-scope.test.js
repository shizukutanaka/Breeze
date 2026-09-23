import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// _ac's AbortController is created inside initMessenger and _messengerCleanup
// aborts it on account switch — every listener on a PERSISTENT target (static
// DOM elements via _DOM.get, document, window, shared containers) must be
// registered { signal: _ac.signal } or it accumulates one copy per switch.
describe('persistent-target listeners are abort-scoped (CWE-772)', () => {
  it('no persistent-target addEventListener inside initMessenger lacks signal', () => {
    const INIT_START = SRC.indexOf('async function initMessenger');
    const INIT_END = SRC.indexOf('await _boot();', INIT_START);
    expect(INIT_START).toBeGreaterThan(0);
    expect(INIT_END).toBeGreaterThan(INIT_START);

    // scanner: find .addEventListener( calls, balance parens skipping strings/
    // comments/template literals, isolate the final top-level argument.
    const targets = [];
    const re = /([A-Za-z0-9_$.?[\]()'"`%+-]+?)\s*\.\s*addEventListener\s*\(/g;
    let m;
    while ((m = re.exec(SRC))) {
      if (m.index < INIT_START || m.index > INIT_END) continue;
      let depth = 1, k = m.index + m[0].length;
      const argStart = k;
      while (k < SRC.length && depth > 0) {
        const c = SRC[k];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        else if (c === '"' || c === "'") {
          const q = c; k++;
          while (k < SRC.length && SRC[k] !== q) { if (SRC[k] === '\\') k++; k++; }
        } else if (c === '`') {
          k++;
          while (k < SRC.length) {
            if (SRC[k] === '\\') { k += 2; continue; }
            if (SRC[k] === '`') break;
            k++;
          }
        } else if (c === '/' && SRC[k + 1] === '/') {
          while (k < SRC.length && SRC[k] !== '\n') k++;
          continue;
        } else if (c === '/' && SRC[k + 1] === '*') {
          k = SRC.indexOf('*/', k + 2) + 1;
        }
        k++;
      }
      targets.push({ tgt: m[1].trim(), args: SRC.slice(argStart, k - 1) });
    }
    expect(targets.length).toBeGreaterThan(50);

    const PERSISTENT = /^(document|window|_msgBox|_scrollFab|_searchInput|chatArea|msgArea|voiceBtn|sttBtn)$/;
    const unscoped = targets.filter(({ tgt, args }) => {
      if (!(tgt.includes('_DOM.get') || PERSISTENT.test(tgt))) return false;
      if (tgt === 'navigator.serviceWorker?') return false; // owned by PR #205
      // final top-level arg = options object when present; check it (not the handler body)
      let depth = 0, lc = -1;
      for (let i = 0; i < args.length; i++) {
        const c = args[i];
        if ('{[('.includes(c)) depth++;
        else if ('}])'.includes(c)) depth--;
        else if (c === ',' && depth === 0) lc = i;
      }
      return !args.slice(lc + 1).includes('signal');
    }).map(({ tgt }) => tgt);
    expect(unscoped).toEqual([]);
  });

  it('representative sites are signal-scoped (search, send, global keydown)', () => {
    expect(SRC.includes("{ signal: _ac.signal, once: true })")).toBe(true);
    expect(/_DOM\.get\('b-msg-send'\)\?\.addEventListener\([\s\S]*?\{ signal: _ac.signal \}\)/.test(SRC)).toBe(true);
    expect(/document\.addEventListener\('keydown',[\s\S]*?\{ signal: _ac.signal \}\)/.test(SRC)).toBe(true);
  });

  it('functional: abort() removes signal-bound listeners; unbound survive (the bug)', () => {
    const ac = new AbortController();
    const t = new EventTarget();
    let bound = 0, unbound = 0;
    t.addEventListener('x', () => bound++, { signal: ac.signal });
    t.addEventListener('x', () => unbound++);
    t.dispatchEvent(new Event('x'));
    expect([bound, unbound]).toEqual([1, 1]);
    ac.abort(); // what _messengerCleanup does on account switch
    t.dispatchEvent(new Event('x'));
    expect(bound).toBe(1);
    expect(unbound).toBe(2);
  });
});
