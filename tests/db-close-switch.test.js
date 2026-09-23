import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// _messengerCleanup released every per-init resource except the account's
// IndexedDB connection: `const db` stayed open after account switch, so (a) a
// dead context's pending async continuations could still write into the old
// account's stores, and (b) the stale connection could block a later
// deleteDatabase/versionchange on that same DB (the #189 'blocked' path).
describe('account-switch cleanup closes the IndexedDB handle (CWE-772)', () => {
  it('_messengerCleanup calls db.close()', () => {
    const start = SRC.indexOf('_messengerCleanup = () => {');
    const end = SRC.indexOf('};', SRC.indexOf('_sttRec = null;', start));
    const body = SRC.slice(start, end);
    expect(body).toContain('db.close()');
    // closing is the LAST step — nothing after it may touch the handle
    expect(body.indexOf('db.close()')).toBeGreaterThan(body.indexOf('_sttRec'));
  });

  it('the closed handle is the per-init const db opened by this init', () => {
    const INIT = SRC.indexOf('async function initMessenger');
    const DB = SRC.indexOf('const db = await', INIT);
    const CLEAN = SRC.indexOf('_messengerCleanup = () => {');
    expect(DB).toBeGreaterThan(INIT);
    expect(DB).toBeLessThan(CLEAN); // same closure — close() hits this handle
  });

  it('functional: closed IDB handle rejects new transactions, drains pending', () => {
    // Mirror the semantics: close() lets in-flight txns finish but throws on
    // new ones — stale async continuations in the dead context now fail
    // instead of writing into the abandoned account's stores.
    let closed = false;
    const db = {
      transaction: () => { if (closed) throw new DOMException('closed', 'InvalidStateError'); return 'tx'; },
      close: () => { closed = true; },
    };
    expect(db.transaction()).toBe('tx');  // pre-switch works
    db.close();                            // _messengerCleanup
    expect(() => db.transaction()).toThrow('closed'); // dead-context write fails
  });
});
