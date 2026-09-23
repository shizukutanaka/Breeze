import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const CW_DROP = SRC.match(/function _cwDrop\(\) \{[\s\S]+?\n\}/)[0];
const makeDrop = (pending) => new Function('_cwPending', `${CW_DROP} return _cwDrop;`)(pending);

describe('crypto-worker liveness — hung/dead worker never stalls the caller', () => {
  it('_cwDrop resolves every pending op with null and drains the map', () => {
    const pending = {};
    const got = [];
    for (const id of [1, 2, 3]) pending[id] = { resolve: v => got.push(v), reject: () => {} };
    makeDrop(pending)();
    expect(got).toEqual([null, null, null]);
    expect(Object.keys(pending).length).toBe(0);
  });
  it('_cwDrop tolerates a throwing resolve', () => {
    const pending = { 1: { resolve() { throw new Error('x'); } }, 2: { resolve: v => v } };
    expect(() => makeDrop(pending)()).not.toThrow();
    expect(Object.keys(pending).length).toBe(0);
  });
  it('worker onerror flushes pending before nulling the worker', () => {
    expect(SRC).toContain('_cryptoWorker.onerror = () => { _cwDrop(); _cryptoWorker = null; }');
  });
  it('postMessage throw resolves null immediately (fallback path)', () => {
    const THROW_SITE = /try \{ w\.postMessage\(\{ id, op, keyRaw, iv, data: dataCopy \}, \[dataCopy\]\); \}\s*\n\s*catch \{ delete _cwPending\[id\]; resolve\(null\); return; \}/;
    expect(SRC).toMatch(THROW_SITE);
  });
  it('a hung worker is terminated and drained after a bounded wait', () => {
    const TIMEOUT = SRC.match(/setTimeout\(\(\) => \{\s*if \(!_cwPending\[id\]\) return;[\s\S]+?_cwDrop\(\);\s*\}, 10 \* MS\.SEC\);/);
    expect(TIMEOUT).not.toBeNull();
    // drive the timeout body with a fake worker + pending map
    const pending = { 7: { resolve: v => v, reject: () => {} } };
    const worker = { terminated: false, terminate() { this.terminated = true; } };
    const fn = new Function('_cwPending', '_cryptoWorker', '_cwDrop', 'id',
      TIMEOUT[0].replace(/^setTimeout\(\(\) => \{/, '').replace(/\}, 10 \* MS\.SEC\);$/, ''));
    let flushed = false;
    fn(pending, worker, () => { flushed = true; }, 7);
    expect(worker.terminated).toBe(true);
    expect(flushed).toBe(true);
  });
  it('timeout is a no-op once the op already settled', () => {
    const pending = {}; // id already deleted by onmessage
    const worker = { terminated: false, terminate() { this.terminated = true; } };
    const fn = new Function('_cwPending', '_cryptoWorker', '_cwDrop', 'id',
      "if (!_cwPending[id]) return; try { _cryptoWorker?.terminate(); } catch {} _cryptoWorker = null; _cwDrop();");
    fn(pending, worker, () => {}, 9);
    expect(worker.terminated).toBe(false);
  });
});
