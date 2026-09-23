import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the account-delete IDB block and the db-upgrade receiver branch.
const DEL_BLOCK = SRC.match(/try \{\s+const _delDb = acc\.dbName[\s\S]+?\} catch \(_e\) \{ _dbg\(_e, 'acc-delete-db'\); \}/)[0];
const CLOSE_BRANCH = SRC.match(/if \(type === 'db-upgrade'\) \{\s+\/\/ Targeted close[\s\S]+?\n      \}/)[0];

const runDelete = (indexedDB, acc, tabChannel) =>
  new Function('indexedDB', 'acc', '_tabChannel', 'DB_VER', '_dbg', `
    ${DEL_BLOCK.replace('const _delReq =', 'var _delReq =')}
    return _delReq;
  `)(indexedDB, acc, tabChannel, 5, () => {});

const runHandler = (eData, db) =>
  new Function('e', 'db', '_dbg', `const { type } = e.data || {}; ${CLOSE_BRANCH}`)(
    { data: eData }, db, () => {});

describe('account delete — IDB blocked handling', () => {
  it('onblocked posts a targeted db-upgrade with the deleted db name', () => {
    const req = {};
    const posted = [];
    const idb = { deleteDatabase: () => req };
    runDelete(idb, { dbName: 'breeze-acc-2', id: '2' }, { postMessage: m => posted.push(m) });
    req.onblocked();
    expect(posted).toEqual([{ type: 'db-upgrade', version: 5, dbName: 'breeze-acc-2' }]);
  });
  it('deleteDatabase throwing is contained (SecurityError)', () => {
    const idb = { deleteDatabase() { throw new Error('SecurityError'); } };
    expect(() => runDelete(idb, { id: '9' }, null)).not.toThrow();
  });
  it('onerror is wired (no unhandled error event)', () => {
    const req = {};
    runDelete({ deleteDatabase: () => req }, { id: '9' }, null);
    expect(typeof req.onerror).toBe('function');
  });
});

describe('db-upgrade receiver — targeted close', () => {
  const mkDb = name => ({ name, closed: false, close() { this.closed = true; } });
  it('matching dbName closes the connection', () => {
    const db = mkDb('breeze-acc-2');
    runHandler({ type: 'db-upgrade', dbName: 'breeze-acc-2' }, db);
    expect(db.closed).toBe(true);
  });
  it('mismatched dbName leaves this tab alone', () => {
    const db = mkDb('breeze-acc-3');
    runHandler({ type: 'db-upgrade', dbName: 'breeze-acc-2' }, db);
    expect(db.closed).toBe(false);
  });
  it('no dbName (legacy version upgrade) still closes', () => {
    const db = mkDb('breeze-messenger');
    runHandler({ type: 'db-upgrade', version: 5 }, db);
    expect(db.closed).toBe(true);
  });
  it('tripwire: delete uses a captured request + targeted broadcast', () => {
    expect(SRC).toContain('const _delReq = indexedDB.deleteDatabase(_delDb);');
    expect(SRC).toContain('dbName: _delDb');
    expect(SRC).toContain('const _delTarget = e.data?.dbName;');
  });
});
