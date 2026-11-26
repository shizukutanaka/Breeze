export const BROWSER_SLOT = 'brz-vault-browser-v1';
export const privateBrowserKey = key => key !== BROWSER_SLOT && !['brz-theme', 'brz-consent', 'brz-lang'].includes(key);
const validRows = rows => Array.isArray(rows) && rows.every(r => Array.isArray(r) && r.length === 2 && typeof r[0] === 'string' && privateBrowserKey(r[0]) && typeof r[1] === 'string') && new Set(rows.map(r => r[0])).size === rows.length;

export function browserBootstrap(local, session, methods, pending = [new Map(), new Map()]) {
  const raw = [local, session].map(target => Object.fromEntries(['getItem', 'setItem', 'removeItem', 'key', 'clear'].map(name => [name, (...args) => methods[name].apply(target, args)])));
  let current;
  const keys = i => [...new Set([...Array.from({ length: [local, session][i].length }, (_, n) => raw[i].key(n)), ...pending[i].keys()])].filter(privateBrowserKey);
  return {
    raw, pending, keys,
    attach(value) { current = value; },
    invoke(target, method, key, value) {
      const i = target === local ? 0 : target === session ? 1 : -1;
      if (i < 0) return methods[method].call(target, key, value);
      if (method === 'clear') {
        if (current) current.clear(i);
        else for (const name of keys(i)) this.invoke(target, 'removeItem', name);
        for (const name of ['brz-theme', 'brz-consent', 'brz-lang']) raw[i].removeItem(name);
        return;
      }
      key = String(key);
      if (!privateBrowserKey(key)) return raw[i][method](key, value);
      if (current) return current[method](i, key, value);
      if (method === 'getItem') return pending[i].has(key) ? pending[i].get(key) : raw[i].getItem(key);
      pending[i].set(key, method === 'removeItem' ? null : String(value));
    },
  };
}

export async function createBrowserVault(bootstrap, codec, onError = () => {}) {
  if (!bootstrap) return null;
  let sealed = !!codec, closed = false, failure, tail = Promise.resolve();
  const { raw, pending } = bootstrap;
  const values = [new Map(), new Map()];
  const decode = async i => {
    const record = raw[i].getItem(BROWSER_SLOT);
    if (!record) { if (sealed && i === 0) throw new Error('vault browser inventory missing'); return []; }
    const rows = await codec.open('breeze-vault', 'browser', String(i), JSON.parse(record));
    if (!validRows(rows)) throw new Error('vault browser format');
    return rows;
  };
  for (let i = 0; i < 2; i++) {
    const entries = sealed ? await decode(i) : bootstrap.keys(i).map(k => [k, raw[i].getItem(k)]).filter(([, v]) => v !== null);
    for (const [k, v] of entries) values[i].set(k, v);
  }
  const assert = () => { if (closed || failure) throw failure || new Error('vault browser locked'); };
  const persist = (i, key, value) => {
    const work = async () => {
      const rows = new Map(await decode(i));
      if (key === null) rows.clear();
      else if (value === null) rows.delete(key); else rows.set(key, value);
      const record = await codec.seal('breeze-vault', 'browser', String(i), [...rows]);
      raw[i].setItem(BROWSER_SLOT, JSON.stringify(record));
    };
    tail = tail.then(() => navigator.locks.request('breeze-vault-browser:' + i, work)).catch(e => { failure = e; onError(e); });
  };
  const storage = {
    clear(i) { assert(); if (!sealed) return raw[i].clear(); values[i].clear(); persist(i, null, null); },
    getItem(i, key) { assert(); return sealed ? values[i].get(key) ?? null : raw[i].getItem(key); },
    setItem(i, key, value) { assert(); value = String(value); if (!sealed) return raw[i].setItem(key, value); values[i].set(key, value); persist(i, key, value); },
    removeItem(i, key) { assert(); if (!sealed) return raw[i].removeItem(key); values[i].delete(key); persist(i, key, null); },
    async snapshot() {
      await tail; assert();
      return sealed ? [await decode(0), await decode(1)] : [0, 1].map(i => bootstrap.keys(i).map(k => [k, raw[i].getItem(k)]).filter(([, v]) => v !== null));
    },
    async freeze(keep = false) {
      closed = true;
      globalThis.removeEventListener?.('storage', changed);
      try {
        await tail; if (failure) throw failure;
        return keep ? (sealed ? [await decode(0), await decode(1)] : [0, 1].map(i => bootstrap.keys(i).map(k => [k, raw[i].getItem(k)]).filter(([, v]) => v !== null))) : null;
      } finally {
        for (const map of values) map.clear();
        if (!keep) for (const key of bootstrap.keys(1)) raw[1].removeItem(key);
        codec = null;
      }
    },
    async flush() { await tail; if (failure) throw failure; },
  };
  const changed = event => {
    if (closed || !sealed || event.key !== BROWSER_SLOT) return;
    tail = tail.then(async () => {
      const rows = await decode(0);
      if (closed) return;
      values[0].clear(); for (const [k, v] of rows) values[0].set(k, v);
    }).catch(e => { failure = e; onError(e); });
  };
  globalThis.addEventListener?.('storage', changed);
  bootstrap.attach(storage);
  for (let i = 0; i < 2; i++) { for (const [k, v] of pending[i]) storage[v === null ? 'removeItem' : 'setItem'](i, k, v); pending[i].clear(); }
  await storage.flush();
  return storage;
}

export async function commitBrowserVault(bootstrap, snapshot, codec) {
  if (!bootstrap || !snapshot) return;
  if (!Array.isArray(snapshot) || snapshot.length !== 2 || snapshot.some(rows => !validRows(rows))) throw new Error('vault browser snapshot');
  for (let i = 0; i < 2; i++) {
    if (codec) bootstrap.raw[i].setItem(BROWSER_SLOT, JSON.stringify(await codec.seal('breeze-vault', 'browser', String(i), snapshot[i])));
    for (const key of bootstrap.keys(i)) bootstrap.raw[i].removeItem(key);
    bootstrap.pending[i].clear();
    if (!codec) { for (const [k, v] of snapshot[i]) bootstrap.raw[i].setItem(k, v); bootstrap.raw[i].removeItem(BROWSER_SLOT); }
  }
}
