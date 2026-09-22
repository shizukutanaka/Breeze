// Each rendered disappearing-message badge armed its own recurring ≤1s setTimeout
// loop (updateCountdown → setTimeout(updateCountdown…)) with no bound: a peer
// sending hundreds of disappearing messages spun up hundreds of perpetual wakes
// — CWE-400 asymmetric cost (one packet buys a forever-timer). The arm site now
// caps concurrent countdowns at 16 (_ttlArmed), and both exits of the countdown
// decrement the counter so badges freed by DOM pruning/expiry release the slot.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

describe('disappearing-message countdown cap', () => {
  it('wire-site: armed counter declared and bounded at the arm site', () => {
    expect(html).toContain('let _ttlArmed = 0;');
    expect(html).toContain('if (_ttlArmed < 16) { _ttlArmed++; requestAnimationFrame(() => setTimeout(updateCountdown, MS.SEC)); }');
  });

  it('wire-site: both countdown exits decrement the armed counter', () => {
    // !el branch (DOM pruned / conversation switched) and left<=0 (expired) each release the slot.
    const re = /Math\.max\(0, _ttlArmed - 1\)/g;
    expect(html.match(re)?.length).toBeGreaterThanOrEqual(2);
  });

  it('extracted updateCountdown: live badge reschedules without releasing the slot', () => {
    const fn = extractCountdown();
    const scheduled = [];
    const el = { textContent: '', classList: { add() {} }, closest: () => null };
    const ctx = ctxFor({ el, left: 30000, scheduled });
    const armed = { v: 3 };
    fn(armed, ctx)( );
    expect(scheduled.length).toBe(1);           // next tick scheduled (s=30 → 1s)
    expect(armed.v).toBe(3);                    // slot retained while badge lives
  });

  it('extracted updateCountdown: missing element releases the slot', () => {
    const fn = extractCountdown();
    const armed = { v: 2 };
    const ctx = ctxFor({ el: null, left: 30000, scheduled: [] });
    fn(armed, ctx)();
    expect(armed.v).toBe(1);
  });

  it('extracted updateCountdown: expiry releases the slot and fades the bubble', () => {
    const fn = extractCountdown();
    const removed = [];
    const msgEl = { classList: { add() {} }, remove: () => removed.push(true) };
    const el = { textContent: '', classList: { add() {} }, closest: () => msgEl };
    const scheduled = [];
    const armed = { v: 5 };
    const ctx = ctxFor({ el, left: -1, scheduled });
    fn(armed, ctx)();
    expect(armed.v).toBe(4);
    expect(scheduled.length).toBe(1);           // the fade-out removal timer
  });
});

function extractCountdown() {
  const start = html.indexOf('const updateCountdown = () => {');
  if (start < 0) throw new Error('updateCountdown not found');
  const end = html.indexOf('\n        };', start);
  if (end < 0) throw new Error('updateCountdown end not found');
  const src = html.slice(start, end + '\n        };'.length);
  // Params: armedRef {_ttlArmed}, ctx {_DOM, MS, CONFIG, disappearAt, timerId, setTimeout}
  return new Function(
    'armedRef', 'ctx',
    `let _ttlArmed = armedRef.v;
     const _DOM = ctx._DOM, MS = ctx.MS, CONFIG = ctx.CONFIG;
     const disappearAt = ctx.disappearAt, timerId = ctx.timerId, setTimeout = ctx.setTimeout;
     ${src}
     return () => { const r = updateCountdown(); armedRef.v = _ttlArmed; return r; };`
  );
}

function ctxFor({ el, left, scheduled }) {
  const realSetTimeout = (fn, ms) => { scheduled.push({ fn, ms }); };
  return {
    _DOM: { get: () => el },
    MS: { SEC: 1000 },
    CONFIG: { FADE_OUT_MS: 400 },
    disappearAt: Date.now() + left,
    timerId: 'ttl-x',
    setTimeout: realSetTimeout,
  };
}
