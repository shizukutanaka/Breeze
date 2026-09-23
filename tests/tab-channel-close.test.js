import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The close statement must live inside _registerMessengerCleanup's arrow —
// slice the block between its markers and pin the statement there.
const CLEANUP = SRC.match(/_messengerCleanup = \(\) => \{[\s\S]+?\n    \};/)[0];
const CLOSE_STMT = CLEANUP.match(/try \{ if \(_tabChannel\) \{ _tabChannel\.onmessage = null; _tabChannel\.close\(\); \} \} catch\(e\) \{ _dbg\(e\); \}/)[0];
const close = new Function('_tabChannel', '_dbg', CLOSE_STMT);

describe('account-switch BroadcastChannel lifecycle', () => {
  it('closes the channel and detaches onmessage inside _messengerCleanup', () => {
    const ch = { onmessage: () => {}, closed: false, close() { this.closed = true; } };
    close(ch, () => {});
    expect(ch.closed).toBe(true);
    expect(ch.onmessage).toBe(null);
  });
  it('null channel is a no-op', () => {
    expect(() => close(null, () => {})).not.toThrow();
  });
  it('a throwing close() is contained via _dbg', () => {
    const errs = [];
    const ch = { onmessage: () => {}, close() { throw new Error('boom'); } };
    expect(() => close(ch, e => errs.push(e))).not.toThrow();
    expect(errs[0].message).toBe('boom');
  });
  it('exactly one close site, after file-chunk cleanup, at the end of _messengerCleanup', () => {
    expect(SRC.match(/_tabChannel\.close\(\)/g).length).toBe(1);
    expect(CLEANUP.indexOf('_fileChunks')).toBeLessThan(CLEANUP.indexOf('_tabChannel.close()'));
    expect(CLEANUP.indexOf('_tabChannel.close()')).toBeGreaterThan(CLEANUP.indexOf('_replayCache._map.clear()'));
  });
  it('channel creation site unchanged (still feature-gated per init)', () => {
    expect(SRC).toContain("new BroadcastChannel('breeze-sync')");
    expect(SRC.match(/new BroadcastChannel\(/g).length).toBe(1);
  });
});
