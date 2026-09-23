import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('leader-lock hold is session-scoped (releases on account switch)', () => {
  it('both hold-promises resolve on _ac abort — ifAvailable + queued branches', () => {
    const holds = SRC.match(/new Promise\(\(release\) => \{ _ac\.signal\.addEventListener\('abort', release, \{ once: true \}\); \}\)/g) || [];
    expect(holds.length).toBe(2);
  });
  it('no never-resolving hold remains on breeze-leader', () => {
    const block = SRC.match(/acquireLeaderLock[\s\S]+?\n  \}/)[0];
    expect(block).not.toContain('new Promise(() => {})');
    expect(block.match(/_ac\.signal\.addEventListener/g).length).toBe(2);
  });
  it('functional: the hold promise releases exactly once when _ac aborts', async () => {
    const ac = new AbortController();
    const fn = new Function('_ac', `return new Promise((release) => { _ac.signal.addEventListener('abort', release, { once: true }); })`);
    let resolved = false;
    fn(ac).then(() => { resolved = true; });
    await new Promise(r => setTimeout(r, 10));
    expect(resolved).toBe(false); // still held while session lives
    ac.abort();
    await new Promise(r => setTimeout(r, 10));
    expect(resolved).toBe(true); // released on switch
  });
  it('lock name + request structure unchanged (2 breeze-leader requests)', () => {
    expect(SRC.match(/navigator\.locks\.request\('breeze-leader'/g).length).toBe(2);
  });
});
