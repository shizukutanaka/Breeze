const MARKER = 'vault:manifest';
const request = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const done = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('history transaction aborted')); });
const token = key => {
  if (Array.isArray(key)) return 'array:' + JSON.stringify(key.map(token));
  if (key instanceof ArrayBuffer || ArrayBuffer.isView(key)) return 'bytes:' + [...new Uint8Array(key.buffer || key, key.byteOffset || 0, key.byteLength)].join(',');
  if (key instanceof Date) return 'date:' + key.getTime();
  return typeof key + ':' + key;
};
const range = query => query instanceof IDBKeyRange;
const matches = (key, query) => query === undefined || query === null || (range(query) ? query.includes(key) : indexedDB.cmp(key, query) === 0);
const field = (value, path) => Array.isArray(path) ? path.map(p => field(value, p)) : path.split('.').reduce((v, p) => v?.[p], value);

export async function historyEntries(db, store) {
  const os = db.transaction(store).objectStore(store);
  const [keys, values] = await Promise.all([request(os.getAllKeys()), request(os.getAll())]);
  return keys.map((key, i) => [key, values[i]]);
}

function diskValue(os, opaque, envelope) {
  if (os.keyPath === null) return envelope;
  if (typeof os.keyPath !== 'string' || os.keyPath.includes('.')) throw new Error('unsupported history key path');
  return { ...envelope, [os.keyPath]: opaque };
}

export async function stageHistory(db, codec, read = (_store, _key, value) => value) {
  const stores = [], catalog = {};
  for (const name of db.objectStoreNames) {
    const rows = [];
    for (const [key, value] of await historyEntries(db, name)) {
      if (name === 'identity' && key === MARKER) continue;
      const opaque = crypto.randomUUID();
      rows.push([opaque, await codec.seal(db.name, name, opaque, { key, value: await read(name, key, value) })]);
    }
    stores.push([name, rows]);
    catalog[name] = { revision: crypto.randomUUID(), keys: rows.map(([key]) => key) };
  }
  return { historyV: 2, stores, marker: await codec.seal(db.name, 'identity', MARKER, { historyV: 2, stores: catalog }) };
}

export async function inspectHistory(db, snapshot, codec) {
  if (snapshot?.historyV !== 2 || !Array.isArray(snapshot.stores) || snapshot.stores.length !== db.objectStoreNames.length) throw new Error('history format');
  const catalog = await codec.open(db.name, 'identity', MARKER, snapshot.marker);
  if (catalog.historyV !== 2 || !catalog.stores || Object.keys(catalog.stores).length !== snapshot.stores.length) throw new Error('history catalog');
  const result = new Map();
  for (const [name, rows] of snapshot.stores) {
    if (!db.objectStoreNames.contains(name) || result.has(name) || !Array.isArray(rows)) throw new Error('history store');
    const expected = catalog.stores[name]?.keys;
    const keys = new Set(expected);
    if (!Array.isArray(expected) || expected.length !== rows.length || keys.size !== expected.length || new Set(rows.map(([opaque]) => opaque)).size !== rows.length || rows.some(([opaque]) => !keys.has(opaque))) throw new Error('history inventory');
    const opened = new Map();
    await Promise.all(rows.map(async ([opaque, value]) => {
      const record = await codec.open(db.name, name, opaque, value);
      if (!record || record.key === undefined || opened.has(token(record.key))) throw new Error('history key');
      opened.set(token(record.key), { ...record, opaque });
    }));
    result.set(name, opened);
  }
  return { catalog, stores: result };
}

export async function snapshotHistory(db, codec) {
  const tx = db.transaction([...db.objectStoreNames]), names = [...db.objectStoreNames];
  const markerRequest = request(tx.objectStore('identity').get(MARKER));
  const stores = await Promise.all(names.map(async name => {
    const os = tx.objectStore(name), keys = request(os.getAllKeys()), values = request(os.getAll());
    const [kk, vv] = await Promise.all([keys, values]);
    return [name, kk.flatMap((key, i) => name === 'identity' && key === MARKER ? [] : [[key, vv[i]]])];
  }));
  const marker = await markerRequest;
  const snapshot = { historyV: 2, stores, marker };
  await inspectHistory(db, snapshot, codec);
  return snapshot;
}

export async function commitHistory(db, snapshot, codec, plain = false) {
  const opened = await inspectHistory(db, snapshot, codec);
  const tx = db.transaction([...db.objectStoreNames], 'readwrite'), completed = done(tx);
  try {
    for (const name of db.objectStoreNames) tx.objectStore(name).clear();
    for (const [name, rows] of snapshot.stores) {
      const os = tx.objectStore(name);
      const output = plain ? [...opened.stores.get(name).values()].map(r => [r.key, r.value]) : rows.map(([opaque, value]) => [opaque, diskValue(os, opaque, value)]);
      for (const [key, value] of output) { if (os.keyPath === null) os.put(value, key); else os.put(value); }
    }
    if (!plain) tx.objectStore('identity').put(snapshot.marker, MARKER);
  } catch (e) { tx.abort(); await completed.catch(() => {}); throw e; }
  await completed;
}

export function historyDatabase(db, codec, runtime) {
  const cache = new Map();
  runtime.caches?.add(cache);
  return new Proxy(db, { get(target, property) {
    if (property !== 'transaction') { const value = target[property]; return typeof value === 'function' ? value.bind(target) : value; }
    return (names, mode = 'readonly', options) => {
      runtime.assert();
      const requested = typeof names === 'string' ? [names] : [...names];
      const tx = target.transaction([...new Set([...requested, 'identity'])], mode, options);
      const epoch = runtime.epoch(), writing = mode === 'readwrite';
      runtime.transactions.add(tx);
      let live = true, catalog, failure;
      const jobs = [], nativeJobs = [], views = new Map(), changed = new Set(), pending = new Set();
      const check = () => runtime.assert(epoch);
      const native = action => new Promise((resolve, reject) => nativeJobs.push(() => {
        try { const req = action(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); } catch (e) { reject(e); }
      }));
      const fail = e => {
        if (failure) return;
        failure = e; live = false;
        for (const req of pending) { req.error = e; try { req.onerror?.({ target: req }); } catch { /* abort below */ } }
        pending.clear();
        try { tx.abort(); } catch { /* transaction finished */ }
      };
      const pump = () => {
        while (nativeJobs.length) nativeJobs.shift()();
        if (!live) return;
        try { const req = tx.objectStore('identity').get(MARKER); req.onsuccess = pump; req.onerror = () => fail(req.error); } catch (e) { fail(e); }
      };
      const enqueue = operation => {
        check();
        const req = { result: undefined, error: null, transaction: tx };
        pending.add(req);
        jobs.push(async () => {
          try { check(); const value = await operation(); check(); req.result = value; pending.delete(req); req.onsuccess?.({ target: req }); }
          catch (e) { pending.delete(req); req.error = e; req.onerror?.({ target: req }); throw e; }
        });
        return req;
      };
      tx.addEventListener('complete', () => {
        runtime.transactions.delete(tx);
        if (!failure) for (const [name, rows] of views) cache.set(name, { revision: catalog.stores[name].revision, rows });
      });
      tx.addEventListener('abort', () => { live = false; cache.clear(); runtime.transactions.delete(tx); });
      const initialize = async () => {
        const marker = await native(() => tx.objectStore('identity').get(MARKER));
        catalog = await codec.open(db.name, 'identity', MARKER, marker);
        if (catalog.historyV !== 2) throw new Error('history format gate');
        for (const name of requested) {
          const inventory = catalog.stores[name];
          if (!inventory || !Array.isArray(inventory.keys)) throw new Error('history inventory missing');
          const old = cache.get(name);
          if (old?.revision === inventory.revision) { views.set(name, new Map(old.rows)); continue; }
          const os = tx.objectStore(name);
          const [keys, values] = await Promise.all([native(() => os.getAllKeys()), native(() => os.getAll())]);
          const actual = keys.filter(k => name !== 'identity' || k !== MARKER);
          const expected = new Set(inventory.keys);
          if (actual.length !== expected.size || actual.some(k => !expected.has(k))) throw new Error('history inventory mismatch');
          const rows = new Map();
          await Promise.all(keys.map(async (opaque, i) => {
            if (name === 'identity' && opaque === MARKER) return;
            const row = await codec.open(db.name, name, opaque, values[i]);
            if (!row || row.key === undefined || rows.has(token(row.key))) throw new Error('history record key');
            rows.set(token(row.key), { ...row, opaque });
          }));
          views.set(name, rows);
        }
        while (jobs.length) await jobs.shift()();
        check();
        if (changed.size) {
          for (const name of changed) catalog.stores[name] = { revision: crypto.randomUUID(), keys: [...views.get(name).values()].map(r => r.opaque) };
          const marker = await codec.seal(db.name, 'identity', MARKER, catalog);
          await native(() => tx.objectStore('identity').put(marker, MARKER));
        }
        check(); live = false;
      };
      const result = new Proxy(tx, { get(t, method) {
        if (method !== 'objectStore') { const value = t[method]; return typeof value === 'function' ? value.bind(t) : value; }
        return name => {
          if (!requested.includes(name)) throw new DOMException('Store not in transaction', 'NotFoundError');
          const os = t.objectStore(name);
          const required = query => { if (query === undefined || query === null) throw new DOMException('Key required', 'DataError'); if (!range(query)) indexedDB.cmp(query, query); return query; };
          const rows = (query, path, direction = 'next') => [...views.get(name).values()].flatMap(r => {
            const indexKey = path === undefined ? r.key : field(r.value, path);
            return indexKey !== undefined && (!Array.isArray(indexKey) || indexKey.every(k => k !== undefined)) && matches(indexKey, query) ? [{ ...r, indexKey }] : [];
          }).sort((a, b) => (indexedDB.cmp(a.indexKey, b.indexKey) || indexedDB.cmp(a.key, b.key)) * (direction.startsWith('prev') ? -1 : 1));
          const readAPI = path => ({
            get: query => { required(query); return enqueue(() => structuredClone(rows(query, path)[0]?.value)); },
            getKey: query => { required(query); return enqueue(() => structuredClone(rows(query, path)[0]?.key)); },
            count: query => enqueue(() => rows(query, path).length),
            getAll: (query, count) => enqueue(() => rows(query, path).slice(0, count).map(r => structuredClone(r.value))),
            getAllKeys: (query, count) => enqueue(() => rows(query, path).slice(0, count).map(r => structuredClone(r.key))),
            getAllRecords: (opts = {}) => enqueue(() => rows(opts.query, path, opts.direction).slice(0, opts.count).map(r => ({ key: structuredClone(r.indexKey), primaryKey: structuredClone(r.key), value: structuredClone(r.value) }))),
            openCursor: () => { throw new Error('history cursors require explicit enumeration'); },
            openKeyCursor: () => { throw new Error('history cursors require explicit enumeration'); },
          });
          const write = () => { if (!writing) throw new DOMException('Read-only transaction', 'ReadOnlyError'); check(); changed.add(name); };
          const put = (value, key, add) => {
            if (!writing) throw new DOMException('Read-only transaction', 'ReadOnlyError');
            value = structuredClone(value); key = structuredClone(key);
            return enqueue(async () => {
              write();
              if (os.keyPath !== null) {
                if (key !== undefined) throw new DOMException('Inline key', 'DataError');
                key = field(value, os.keyPath);
                if (key === undefined && os.autoIncrement) { key = Math.max(0, ...[...views.get(name).values()].map(r => typeof r.key === 'number' ? r.key : 0)) + 1; value[os.keyPath] = key; }
              }
              if (key === undefined || name === 'identity' && key === MARKER) throw new Error('history reserved/missing key');
              indexedDB.cmp(key, key);
              const old = views.get(name).get(token(key));
              if (add && old) throw new DOMException('Duplicate key', 'ConstraintError');
              const opaque = old?.opaque || crypto.randomUUID(), row = { key, value, opaque };
              const sealed = diskValue(os, opaque, await codec.seal(db.name, name, opaque, { key, value }));
              check(); await native(() => os.keyPath === null ? os.put(sealed, opaque) : os.put(sealed));
              views.get(name).set(token(key), row);
              return key;
            });
          };
          const api = { ...readAPI(),
            put: (value, key) => put(value, key, false), add: (value, key) => put(value, key, true),
            delete: query => { required(query); return enqueue(async () => { write(); for (const r of rows(query)) { await native(() => os.delete(r.opaque)); views.get(name).delete(token(r.key)); } }); },
            clear: () => enqueue(async () => { write(); if (name === 'identity') throw new Error('authenticate disable before clearing keys'); await native(() => os.clear()); views.get(name).clear(); }),
            index: index => readAPI(os.index(index).keyPath),
          };
          return new Proxy(os, { get(s, property) { if (Object.hasOwn(api, property)) return api[property]; const value = s[property]; return typeof value === 'function' ? value.bind(s) : value; } });
        };
      }, set(t, property, value) { t[property] = value; return true; } });
      pump(); initialize().catch(fail);
      return result;
    };
  }, set(target, property, value) { target[property] = value; return true; } });
}
