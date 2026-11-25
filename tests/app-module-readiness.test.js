import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('const _appModulesReady =');
const end = html.indexOf('\n\n', start);
const readiness = html.slice(start, end);

describe('app-module readiness', () => {
  it.each(['loading', 'interactive', 'complete'])('waits for deferred modules with readyState=%s', async (readyState) => {
    let listener;
    const document = {
      readyState,
      addEventListener(event, callback, options) {
        expect(event).toBe('DOMContentLoaded');
        expect(options).toEqual({ once: true });
        listener = callback;
      },
    };
    const ready = new Function('document', readiness + '\nreturn _appModulesReady;')(document);
    let settled = false;
    ready.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(readyState === 'complete');
    if (listener) listener();
    await ready;
    expect(settled).toBe(true);
  });

  it('creates readiness before initial boot and awaits it before all bridge captures on every init', () => {
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(html.indexOf('  initMessenger().catch('));
    const init = html.slice(html.indexOf('async function initMessenger(dbName) {'));
    const wait = init.indexOf('await _appModulesReady;');
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThan(init.indexOf("_perf.mark('initMessenger')"));
    for (const bridge of ['DirectAck', 'P2pStats', 'Call', 'Backup', 'HistoryTools', 'Share']) {
      expect(wait).toBeLessThan(init.indexOf('globalThis.__breeze' + bridge));
    }
  });
});
