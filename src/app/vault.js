import { stageHistory, snapshotHistory, inspectHistory, commitHistory, historyDatabase } from './vault-history.js';
import { createBrowserVault, commitBrowserVault } from './vault-browser.js';

const VERSION = 1, ITERATIONS = 600000;
const CONTROL = 'breeze-vault', MANIFEST = 'vault:manifest';
const utf8 = new TextEncoder(), text = new TextDecoder('utf-8', { fatal: true });
const native = Object.fromEntries(['importKey', 'deriveKey', 'encrypt', 'decrypt'].map(k => [k, crypto.subtle[k].bind(crypto.subtle)]));
const bytes64 = a => { let s = ''; for (const b of new Uint8Array(a)) s += String.fromCharCode(b); return btoa(s); };
function un64(s) {
  if (typeof s !== 'string' || s.length > 32 * 1024 * 1024) throw new Error('vault encoding');
  const b = Uint8Array.from(atob(s), c => c.charCodeAt(0));
  if (bytes64(b) !== s) throw new Error('vault encoding');
  return b;
}
export const vaultSlot = (store, key) => store === 'identity' && typeof key === 'string' &&
  (['keys', 'signing', 'pq-priv', 'spk-priv', 'otp-priv'].includes(key) || /^(sess:|gsk:|gsk-peer:|verify:)/.test(key));
const types = { Uint8Array, Uint8ClampedArray, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array, DataView };
function pack(v) {
  if (v === undefined) return ['undefined'];
  if (v === null || ['string', 'boolean'].includes(typeof v)) return ['scalar', v];
  if (typeof v === 'number' && Number.isFinite(v)) return ['scalar', v];
  if (v instanceof ArrayBuffer) return ['ArrayBuffer', bytes64(v)];
  if (ArrayBuffer.isView(v) && Object.hasOwn(types, v.constructor.name)) return [v.constructor.name, bytes64(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength))];
  if (Array.isArray(v)) return ['array', v.map(pack)];
  if (v && Object.getPrototypeOf(v) === Object.prototype) return ['object', Object.entries(v).map(([k, x]) => [k, pack(x)])];
  throw new Error('unsupported vault value');
}
function unpack(v) {
  if (!Array.isArray(v)) throw new Error('vault codec');
  const [tag, data] = v;
  if (tag === 'undefined' && v.length === 1) return undefined;
  if (v.length !== 2) throw new Error('vault codec length');
  if (tag === 'scalar' && (data === null || ['string', 'boolean'].includes(typeof data) || (typeof data === 'number' && Number.isFinite(data)))) return data;
  if (tag === 'array' && Array.isArray(data)) return data.map(unpack);
  if (tag === 'object' && Array.isArray(data)) {
    const result = {};
    for (const entry of data) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || Object.hasOwn(result, entry[0])) throw new Error('vault object');
      Object.defineProperty(result, entry[0], { value: unpack(entry[1]), enumerable: true, writable: true, configurable: true });
    }
    return result;
  }
  const b = un64(data);
  if (tag === 'ArrayBuffer') return b.buffer;
  if (Object.hasOwn(types, tag)) return new types[tag](b.buffer);
  throw new Error('vault codec tag');
}
export const encodeVaultValue = value => utf8.encode(JSON.stringify(pack(value)));
export const decodeVaultValue = value => unpack(JSON.parse(text.decode(value)));
const aad = (id, db, store, key) => utf8.encode(JSON.stringify(['BreezeVault', VERSION, id, db, store, key]));
async function crypt(key, value, context) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await native.encrypt({ name: 'AES-GCM', iv, additionalData: context }, key, value);
  return { iv: bytes64(iv), ct: bytes64(ct) };
}
async function open(key, value, context) {
  if (un64(value.iv).length !== 12) throw new Error('vault IV');
  return native.decrypt({ name: 'AES-GCM', iv: un64(value.iv), additionalData: context }, key, un64(value.ct));
}
async function kek(pass, wrapped) {
  if (wrapped.iter !== ITERATIONS || wrapped.kdf !== 'PBKDF2-SHA256' || un64(wrapped.salt).length !== 16) throw new Error('vault KDF');
  const base = await native.importKey('raw', utf8.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return native.deriveKey({ name: 'PBKDF2', salt: un64(wrapped.salt), iterations: wrapped.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function wrapDataKey(raw, pass, id) {
  if (typeof pass !== 'string' || pass.length < 12) throw new Error('vault passphrase minimum');
  const wrapped = { kdf: 'PBKDF2-SHA256', iter: ITERATIONS, salt: bytes64(crypto.getRandomValues(new Uint8Array(16))) };
  return { ...wrapped, ...await crypt(await kek(pass, wrapped), raw, aad(id, CONTROL, 'meta', 'data-key')) };
}
export async function newVault(pass) {
  const id = crypto.randomUUID(), raw = crypto.getRandomValues(new Uint8Array(32));
  try { return { manifest: { v: VERSION, id, wrapped: await wrapDataKey(raw, pass, id), phase: 'ready' }, key: await native.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']) }; }
  finally { raw.fill(0); }
}
async function dataKeyBytes(manifest, pass) {
  if (manifest?.v !== VERSION || typeof manifest.id !== 'string') throw new Error('unsupported vault version');
  return new Uint8Array(await open(await kek(pass, manifest.wrapped), manifest.wrapped, aad(manifest.id, CONTROL, 'meta', 'data-key')));
}
export async function unlockVault(manifest, pass) {
  const raw = await dataKeyBytes(manifest, pass);
  try { if (raw.length !== 32) throw new Error('vault data key'); return await native.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); }
  finally { raw.fill(0); }
}
export async function rewrapVault(manifest, oldPass, newPass) {
  const raw = await dataKeyBytes(manifest, oldPass);
  try { return { ...manifest, wrapped: await wrapDataKey(raw, newPass, manifest.id) }; }
  finally { raw.fill(0); }
}
export async function sealVaultRecord(key, manifest, db, store, recordKey, value) {
  return { vaultV: VERSION, vaultId: manifest.id, ...await crypt(key, encodeVaultValue(value), aad(manifest.id, db, store, recordKey)) };
}
export async function openVaultRecord(key, manifest, db, store, recordKey, value) {
  if (value?.vaultV !== VERSION || value.vaultId !== manifest.id) throw new Error('vault plaintext/version rejected');
  return decodeVaultValue(await open(key, value, aad(manifest.id, db, store, recordKey)));
}
const historyCodec = (key, manifest) => ({
  seal: (...args) => sealVaultRecord(key, manifest, ...args),
  open: (...args) => openVaultRecord(key, manifest, ...args),
});
export async function sealVaultState(key, manifest, stages = []) {
  const state = { phase: manifest.phase, accounts: manifest.accounts || [], accountIndex: manifest.accountIndex || null, inventories: stages.map(([name, rows]) => [name, rows.map(([slot]) => slot)]) };
  if (manifest.historyV !== undefined) state.historyV = manifest.historyV;
  if (manifest.storageV !== undefined) state.storageV = manifest.storageV;
  if (manifest.browser !== undefined) state.browser = manifest.browser;
  return { ...manifest, auth: await sealVaultRecord(key, manifest, CONTROL, 'meta', 'state', state) };
}
export async function openVaultState(key, manifest) {
  const state = await openVaultRecord(key, manifest, CONTROL, 'meta', 'state', manifest.auth);
  if (state.storageV !== manifest.storageV || JSON.stringify(state.browser) !== JSON.stringify(manifest.browser)) throw new Error('vault browser journal authentication');
  if (state.phase !== manifest.phase || state.historyV !== manifest.historyV || JSON.stringify(state.accounts) !== JSON.stringify(manifest.accounts || []) || JSON.stringify(state.accountIndex) !== JSON.stringify(manifest.accountIndex || null)) throw new Error('vault journal authentication');
  return state;
}

const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
const complete = tx => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error || new Error('vault transaction aborted')); });
async function connect(name, stores) {
  const existing = name === CONTROL ? null : (await indexedDB.databases()).find(db => db.name === name);
  const req = indexedDB.open(name, name === CONTROL ? 1 : existing?.version || 6);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (name === CONTROL) { db.createObjectStore('meta'); return; }
    if (db.objectStoreNames.contains('identity')) throw new Error('open account in current client before migration');
    const include = store => !stores || stores.includes(store);
    db.createObjectStore('identity');
    if (include('settings')) db.createObjectStore('settings');
    if (include('contacts')) db.createObjectStore('contacts', { keyPath: 'id' });
    if (include('messages')) {
      const messages = db.createObjectStore('messages', { keyPath: 'msgId' });
      messages.createIndex('contact', 'contactId'); messages.createIndex('ts', 'ts'); messages.createIndex('contact_ts', ['contactId', 'ts']);
    }
    if (include('audit')) { const audit = db.createObjectStore('audit', { keyPath: 'id', autoIncrement: true }); audit.createIndex('ts', 'ts'); audit.createIndex('type', 'type'); }
    if (include('calls')) { const calls = db.createObjectStore('calls', { keyPath: 'id', autoIncrement: true }); calls.createIndex('ts', 'ts'); calls.createIndex('contact', 'contactId'); }
  };
  return request(req);
}
async function entries(db, store = 'identity') {
  const tx = db.transaction(store), os = tx.objectStore(store);
  const [keys, values] = await Promise.all([request(os.getAllKeys()), request(os.getAll())]);
  return keys.map((k, i) => [k, values[i]]);
}
export function atomicVaultRows(db, rows, manifest) {
  const tx = db.transaction('identity', 'readwrite'), done = complete(tx), os = tx.objectStore('identity');
  try {
    for (const [key, value] of rows) os.put(value, key);
    if (manifest) os.put(manifest, MANIFEST); else os.delete(MANIFEST);
  } catch (e) { tx.abort(); return done.then(() => { throw e; }); }
  return done;
}

// Requests stay in the caller's transaction, including message+ratchet acceptance.
export function vaultDatabase(db, runtime) {
  return new Proxy(db, { get(target, prop) {
    if (prop !== 'transaction') { const v = target[prop]; return typeof v === 'function' ? v.bind(target) : v; }
    return (...args) => {
      runtime.assert();
      const tx = target.transaction(...args);
      runtime.transactions.add(tx);
      tx.addEventListener('complete', () => runtime.transactions.delete(tx));
      tx.addEventListener('abort', () => runtime.transactions.delete(tx));
      if (!runtime.enabled()) return tx;
      let pending = 0, ticking = false, writes = Promise.resolve();
      const jobs = [];
      const scheduled = action => {
        const req = { result: undefined, error: null };
        jobs.push(() => {
          try {
            const nativeRequest = action();
            nativeRequest.onsuccess = () => { req.result = nativeRequest.result; req.onsuccess?.({ target: req }); };
            nativeRequest.onerror = () => { req.error = nativeRequest.error; req.onerror?.({ target: req }); };
          } catch (e) { req.error = e; req.onerror?.({ target: req }); }
        });
        return req;
      };
      const keepAlive = os => {
        if (ticking) return;
        ticking = true;
        const tick = () => {
          while (jobs.length) jobs.shift()();
          if (!pending) { ticking = false; return; }
          try { const req = os.get(MANIFEST); req.onsuccess = tick; } catch { ticking = false; }
        };
        tick();
      };
      const guarded = (os, operation) => {
        const req = { result: undefined, error: null }, epoch = runtime.epoch();
        pending++; keepAlive(os);
        Promise.resolve().then(operation).then(value => {
          runtime.assert(epoch); req.result = value; pending--; req.onsuccess?.({ target: req });
        }).catch(e => { pending--; req.error = e; try { tx.abort(); } catch { /* already aborted */ } req.onerror?.({ target: req }); });
        return req;
      };
      return new Proxy(tx, { get(t, p) {
        if (p !== 'objectStore') { const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; }
        return name => {
          const os = t.objectStore(name);
          if (name !== 'identity') return os;
          const scheduledStore = new Proxy(os, { get(s, method) {
            const value = s[method];
            if (['get', 'put', 'add', 'delete', 'getAll', 'getAllKeys'].includes(method)) return (...args) => scheduled(() => value.apply(s, args));
            return typeof value === 'function' ? value.bind(s) : value;
          } });
          return new Proxy(os, { get(_s, method) {
            const s = scheduledStore;
            if (['openCursor', 'openKeyCursor'].includes(method)) return () => { throw new Error('vault cursor requires explicit keys'); };
            if (method === 'get') return key => {
              const raw = request(s.get(key));
              const metadata = vaultSlot(name, key) ? request(s.get(MANIFEST)) : null;
              return guarded(os, async () => {
                const value = await raw;
                if (value === undefined && metadata && (await runtime.open(db.name, MANIFEST, await metadata)).slots.includes(key)) throw new Error('vault record missing');
                return value === undefined || !vaultSlot(name, key) ? value : runtime.open(db.name, key, value);
              });
            };
            if (['getAll', 'getAllKeys'].includes(method)) return () => {
              const keys = request(s.getAllKeys()), values = request(s.getAll());
              return guarded(os, async () => {
                const [kk, vv] = await Promise.all([keys, values]);
                const inventory = await runtime.open(db.name, MANIFEST, vv[kk.indexOf(MANIFEST)]);
                if (inventory.slots.length !== kk.filter(k => vaultSlot(name, k)).length || inventory.slots.some(k => !kk.includes(k))) throw new Error('vault inventory mismatch');
                const opened = await Promise.all(vv.map((v, i) => vaultSlot(name, kk[i]) ? runtime.open(db.name, kk[i], v) : v));
                return method === 'getAllKeys' ? kk : opened;
              });
            };
            if (method === 'clear') return () => { throw new Error('authenticate vault disable before clearing keys'); };
            if (method === 'delete') return key => guarded(os, () => (writes = writes.then(async () => {
              await runtime.metadata(s, db.name, key, false); runtime.assert(); return request(s.delete(key));
            })));
            if (['put', 'add'].includes(method)) return (value, key) => guarded(os, () => (writes = writes.then(async () => {
              const sealed = vaultSlot(name, key) ? await runtime.seal(db.name, key, value) : value;
              await runtime.metadata(s, db.name, key, true); runtime.assert(); return request(s[method](sealed, key));
            })));
            const v = os[method]; return typeof v === 'function' ? v.bind(os) : v;
          } });
        };
      }, set(t, p, value) { t[p] = value; return true; } });
    };
  }, set(target, prop, value) { target[prop] = value; return true; } });
}

let singleton;
export function getVault(D) { return singleton ||= createVaultRuntime(D); }
export function createVaultRuntime(D) {
  const bootstrap = D.browser || globalThis.__breezeBrowser;
  let browser;
  let control, manifest = null, key = null, blocked = false, generation = 0, release, lease, quiesce = D.quiesce || (() => {});
  const transactions = new Set(), aborters = new Set(), expected = new Map(), timers = new Set();
  let cancelTimer;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('breeze-vault-v1') : null;
  const assert = (epoch = generation) => { if (blocked || epoch !== generation) throw new Error('vault locked'); };
  const enabled = () => !!manifest;
  const save = async (state, stages = []) => {
    state = await sealVaultState(key, state, stages);
    const tx = control.transaction('meta', 'readwrite'), done = complete(tx), os = tx.objectStore('meta');
    os.put(state, 'state');
    for (const [name, rows] of stages) os.put(rows, 'stage:' + name);
    await done; manifest = state;
  };
  const read = () => request(control.transaction('meta').objectStore('meta').get('state'));
  async function freeze(reload = false, keepBrowser = false) {
    blocked = true; generation++; key = null;
    for (const tx of transactions) { try { tx.abort(); } catch { /* completed */ } }
    for (const ac of aborters) ac.abort();
    for (const timer of timers) cancelTimer?.(timer);
    timers.clear();
    try { quiesce(); } catch (e) { D.dbg(e, 'vault-quiesce'); }
    try { return await browser?.freeze(keepBrowser); }
    finally {
      for (const cache of caches) { try { cache.clear(); } catch (e) { D.dbg(e, 'vault-cache'); } }
      caches.clear(); expected.clear();
      release?.(); release = null; lease = null;
      if (reload) D.reload();
    }
  }
  if (channel) channel.onmessage = e => { if (e.data?.type === 'freeze') freeze(true); };
  async function hold() {
    if (!navigator.locks) { if (manifest) throw new Error('vault requires Web Locks'); return; }
    if (!lease) lease = new Promise((resolve, reject) => {
      navigator.locks.request('breeze-vault-runtime', { mode: 'shared' }, () => {
        resolve(); return new Promise(r => { release = r; });
      }).catch(reject);
    });
    await lease;
  }
  async function exclusive(work) {
    if (!navigator.locks || !channel) throw new Error('vault requires Web Locks and BroadcastChannel');
    const locks = await navigator.locks.query();
    const clients = new Set(locks.held.filter(l => l.name === 'breeze-vault-runtime').map(l => l.clientId));
    if ([...locks.held, ...locks.pending].some(l => l.name === 'breeze-leader' && !clients.has(l.clientId))) throw new Error(D.t('vaultOldTabs'));
    const epoch = generation + 1;
    let freezing;
    const result = navigator.locks.request('breeze-vault-runtime', async () => {
      const snapshot = await freezing;
      if (generation !== epoch) throw new Error('vault changed concurrently');
      return work(snapshot);
    });
    channel.postMessage({ type: 'freeze' });
    freezing = freeze(false, true);
    await freezing;
    return result;
  }
  async function names() {
    const found = await indexedDB.databases();
    return [...new Set(['breeze-messenger', ...D.accounts().map(a => a.dbName || 'breeze-acc-' + a.id), ...found.map(d => d.name)].filter(n => n === 'breeze-messenger' || /^breeze-acc-[a-zA-Z0-9_-]+$/.test(n)))];
  }
  async function gate() {
    blocked = true;
    const epoch = generation;
    const unlocked = await D.gate(async pass => {
      const value = await unlockVault(manifest, pass);
      if (epoch !== generation) throw new Error('vault locked');
      return value;
    });
    if (epoch !== generation) throw new Error('vault locked');
    key = unlocked;
    blocked = false;
  }
  async function legacy(value, slot, pass) {
    if (!value?.wrapped && value?.kdf !== 'pbkdf2') return value;
    const envelope = value.wrapped || value;
    if (!Number.isInteger(envelope.iter) || envelope.iter <= 0 || envelope.iter > 2000000) throw new Error('legacy KDF');
    const base = await native.importKey('raw', utf8.encode(pass), 'PBKDF2', false, ['deriveKey']);
    const legacyKey = await native.deriveKey({ name: 'PBKDF2', salt: un64(envelope.salt), iterations: envelope.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const payload = JSON.parse(text.decode(await open(legacyKey, envelope, utf8.encode('breeze-atrest-v1:' + slot))));
    const { wrapped: _wrapped, priv: _priv, seed: _seed, ...rest } = value;
    return { ...rest, ...(slot === 'pq-priv' ? payload : { priv: payload }) };
  }
  async function historyStage(db, next, current, pass) {
    if (current?.historyV === 2) return snapshotHistory(db, historyCodec(key, current));
    if (current) {
      const rows = await entries(db), marker = rows.find(([slot]) => slot === MANIFEST)?.[1];
      const metadata = await openVaultRecord(key, current, db.name, 'identity', MANIFEST, marker);
      if (!Array.isArray(metadata.slots) || new Set(metadata.slots).size !== metadata.slots.length || rows.filter(([s]) => vaultSlot('identity', s)).length !== metadata.slots.length || metadata.slots.some(s => !vaultSlot('identity', s) || !rows.some(([slot]) => slot === s))) throw new Error('vault upgrade inventory');
    }
    return stageHistory(db, historyCodec(key, next), async (store, slot, value) => {
      if (store !== 'identity') return value;
      if (current && vaultSlot(store, slot)) return openVaultRecord(key, current, db.name, store, slot, value);
      if (value?.vaultV) throw new Error('unexpected encrypted account');
      try { return await legacy(value, slot, pass); }
      catch (e) {
        if (!D.prompt) throw e;
        pass = await D.prompt(D.t('vaultLegacy') + ' (' + db.name + ')');
        if (!pass) throw e;
        return legacy(value, slot, pass);
      }
    });
  }
  async function upgradeHistory() {
    const current = manifest, unlocked = key;
    await exclusive(async snapshot => {
      key = unlocked;
      const next = { ...current, historyV: 2, storageV: 1 }, stages = [];
      for (const name of await names()) {
        const db = await connect(name);
        try {
          if (db.objectStoreNames.contains('identity')) stages.push([name, [['history:v2', await historyStage(db, next, current, '')]]]);
        } finally { db.close(); }
      }
      await save({ ...next, phase: 'enabling', accounts: stages.map(([name]) => name), ...(snapshot ? { browser: await sealVaultRecord(key, next, CONTROL, 'meta', 'browser-journal', snapshot) } : {}) }, stages);
      await resume();
    });
  }
  async function resume() {
    if (manifest.phase === 'ready') return;
    if (!['enabling', 'disabling', 'restoring'].includes(manifest.phase) || !Array.isArray(manifest.accounts)) throw new Error('vault journal/version');
    const authenticated = await openVaultState(key, manifest);
    for (const name of manifest.accounts) {
      const rows = await request(control.transaction('meta').objectStore('meta').get('stage:' + name));
      if (!Array.isArray(rows)) throw new Error('missing vault journal');
      const slots = authenticated.inventories.find(([account]) => account === name)?.[1];
      if (JSON.stringify(slots) !== JSON.stringify(rows.map(([slot]) => slot))) throw new Error('vault journal inventory');
      const db = await connect(name);
      try {
        if (!db.objectStoreNames.contains('identity')) throw new Error('vault account schema missing');
        if (manifest.historyV === 2) {
          if (rows.length !== 1 || rows[0][0] !== 'history:v2') throw new Error('history journal format');
          await commitHistory(db, rows[0][1], historyCodec(key, manifest), manifest.phase === 'disabling');
          continue;
        }
        const output = [];
        for (const [slot, value] of rows) {
          const plain = await openVaultRecord(key, manifest, name, 'identity', slot, value);
          output.push([slot, manifest.phase === 'disabling' || slot === 'msgkey' ? plain : value]);
        }
        const marker = manifest.phase === 'disabling' ? null : await sealVaultRecord(key, manifest, name, 'identity', MANIFEST, { slots: output.map(([s]) => s).filter(s => vaultSlot('identity', s)) });
        await atomicVaultRows(db, output, marker);
      } finally { db.close(); }
    }
    if (manifest.browser) await commitBrowserVault(bootstrap, await openVaultRecord(key, manifest, CONTROL, 'meta', 'browser-journal', manifest.browser), manifest.phase === 'disabling' ? null : historyCodec(key, manifest));
    const next = manifest.phase === 'disabling' ? null : await sealVaultState(key, { v: VERSION, id: manifest.id, wrapped: manifest.wrapped, phase: 'ready', ...(manifest.historyV === 2 ? { historyV: 2 } : {}), ...(manifest.storageV === 1 ? { storageV: 1 } : {}) });
    if (manifest.phase === 'restoring' && manifest.accountIndex) D.restoreAccounts?.(manifest.accountIndex);
    const tx = control.transaction('meta', 'readwrite'), done = complete(tx), os = tx.objectStore('meta');
    for (const name of manifest.accounts) os.delete('stage:' + name);
    os.put(next, 'state'); await done; manifest = next;
  }
  async function initialize() {
    control ||= await connect(CONTROL);
    await hold(); manifest = await read();
    if (manifest) {
      if (manifest.v !== VERSION) throw new Error('unsupported vault version');
      await gate();
      await openVaultState(key, manifest);
      if (manifest.historyV !== undefined && manifest.historyV !== 2) throw new Error('unsupported history format');
      if (manifest.storageV !== undefined && manifest.storageV !== 1) throw new Error('unsupported browser format');
      if (manifest.phase !== 'ready') {
        const unlocked = key;
        await exclusive(async () => { key = unlocked; await resume(); });
        D.reload(); return new Promise(() => {});
      }
      browser = await createBrowserVault(bootstrap, manifest.storageV === 1 ? historyCodec(key, manifest) : null, e => { D.dbg(e, 'vault-browser'); channel?.postMessage({ type: 'freeze' }); freeze(true).catch(error => D.dbg(error, 'vault-freeze')); });
      if (manifest.historyV !== 2 || manifest.storageV !== 1) { await upgradeHistory(); D.reload(); return new Promise(() => {}); }
    } else {
      browser = await createBrowserVault(bootstrap, null);
      for (const name of await names()) {
        const db = await connect(name);
        let old = false;
        try { if (db.objectStoreNames.contains('identity')) old = (await entries(db)).some(([s, r]) => vaultSlot('identity', s) && (r?.wrapped || r?.kdf === 'pbkdf2')); }
        finally { db.close(); }
        if (old) { await runtime.command('/vault enable'); return new Promise(() => {}); }
      }
    }
  }
  let ready;
  const caches = new Set();
  const runtime = {
    assert, enabled, epoch: () => generation, transactions, caches,
    expected: (db, slot) => expected.get(db)?.has(slot),
    async metadata(os, db, slot, add) {
      if (!vaultSlot('identity', slot)) return;
      const record = await request(os.get(MANIFEST));
      const metadata = await runtime.open(db, MANIFEST, record), slots = new Set(metadata.slots);
      if (add) slots.add(slot); else slots.delete(slot);
      await request(os.put(await runtime.seal(db, MANIFEST, { slots: [...slots] }), MANIFEST));
      expected.set(db, slots);
    },
    open: async (db, slot, value) => { const epoch = generation; assert(epoch); if (!key) throw new Error('vault unavailable'); const plain = await openVaultRecord(key, manifest, db, 'identity', slot, value); assert(epoch); return plain; },
    seal: async (db, slot, value) => { const epoch = generation; assert(epoch); if (!key) throw new Error('vault unavailable'); const sealed = await sealVaultRecord(key, manifest, db, 'identity', slot, value); assert(epoch); return sealed; },
    async boot() { await (ready ||= initialize()); assert(); return runtime; },
    async flushBrowser() { await browser?.flush(); },
    async database(db) {
      assert();
      const marker = await request(db.transaction('identity').objectStore('identity').get(MANIFEST));
      if (manifest?.historyV === 2) {
        const codec = historyCodec(key, manifest);
        if (!marker) {
          for (const store of db.objectStoreNames) if ((await entries(db, store)).length) throw new Error('unmigrated history account');
          await commitHistory(db, await stageHistory(db, codec), codec);
        } else await snapshotHistory(db, codec);
        const guarded = Object.fromEntries(Object.entries(codec).map(([method, operation]) => [method, async (...args) => {
          const epoch = generation; assert(epoch);
          const value = await operation(...args); assert(epoch); return value;
        }]));
        return historyDatabase(db, guarded, runtime);
      }
      if (manifest && !marker) {
        const rows = await entries(db);
        if (rows.some(([k]) => vaultSlot('identity', k))) throw new Error('unmigrated vault account');
        await atomicVaultRows(db, [], await runtime.seal(db.name, MANIFEST, { slots: [] }));
      } else if (!manifest && marker) throw new Error('vault manifest missing');
      if (manifest) {
        const metadata = await runtime.open(db.name, MANIFEST, marker || await request(db.transaction('identity').objectStore('identity').get(MANIFEST)));
        if (!Array.isArray(metadata.slots)) throw new Error('vault manifest format');
        const rows = await entries(db), slots = new Set(metadata.slots);
        if (rows.some(([k]) => vaultSlot('identity', k) && !slots.has(k)) || [...slots].some(k => !rows.some(([s]) => s === k))) throw new Error('vault inventory mismatch');
        for (const [slot, value] of rows) if (vaultSlot('identity', slot)) await runtime.open(db.name, slot, value);
        expected.set(db.name, slots);
      }
      return vaultDatabase(db, runtime);
    },
    setQuiesce(fn) { quiesce = fn; },
    isBlocked: () => blocked,
    async lock() { if (!manifest) return; channel?.postMessage({ type: 'freeze' }); await freeze(); D.reload(); },
    async change(pass, enable, oldPass = pass) {
      if (!control) await runtime.boot();
      const current = manifest;
      let nextKey, next;
      if (enable) { if (current) throw new Error('vault already enabled'); ({ key: nextKey, manifest: next } = await newVault(pass)); next.historyV = 2; next.storageV = 1; }
      else { if (!current) return; nextKey = await unlockVault(current, pass); next = current; }
      return exclusive(async snapshot => {
        key = nextKey;
        const stages = [];
        for (const name of await names()) {
          const db = await connect(name);
          try {
            if (!db.objectStoreNames.contains('identity')) continue;
            if (next.historyV === 2) {
              stages.push([name, [['history:v2', await historyStage(db, next, current, oldPass)]]]);
              continue;
            }
            const stage = [];
            let legacyPass = oldPass;
            for (const [slot, value] of await entries(db)) {
              if (!vaultSlot('identity', slot) && !(slot === 'msgkey' && value?.wrapped)) continue;
              let plain;
              if (enable) {
                try { plain = await legacy(value, slot, legacyPass); }
                catch (e) {
                  if (!D.prompt) throw e;
                  legacyPass = await D.prompt(D.t('vaultLegacy') + ' (' + name + ')');
                  if (!legacyPass) throw e;
                  plain = await legacy(value, slot, legacyPass);
                }
              } else plain = await openVaultRecord(key, current, name, 'identity', slot, value);
              stage.push([slot, await sealVaultRecord(key, next, name, 'identity', slot, plain)]);
            }
            stages.push([name, stage]);
          } finally { db.close(); }
        }
        await save({ ...next, phase: enable ? 'enabling' : 'disabling', accounts: stages.map(([n]) => n), ...(snapshot ? { browser: await sealVaultRecord(key, next, CONTROL, 'meta', 'browser-journal', snapshot) } : {}) }, stages);
        await resume(); key = null; D.reload();
      });
    },
    async password(oldPass, newPass) {
      assert();
      const before = manifest, unlocked = key, next = await rewrapVault(before, oldPass, newPass);
      await exclusive(async () => {
        if (JSON.stringify(await read()) !== JSON.stringify(before)) throw new Error('vault changed concurrently');
        key = unlocked;
        await save(next); D.reload();
      });
    },
    async prekeys(db, spk, otp, pq) {
      assert();
      const tx = db.transaction('identity', 'readwrite'), done = complete(tx), os = tx.objectStore('identity');
      os.put({ priv: spk }, 'spk-priv'); os.put({ keys: otp }, 'otp-priv');
      if (pq) os.put(pq, 'pq-priv');
      await done;
    },
    async put(db, store, value, recordKey) {
      assert();
      const tx = db.transaction(store, 'readwrite'), done = complete(tx), os = tx.objectStore(store);
      if (recordKey === undefined) os.put(value); else os.put(value, recordKey);
      await done; return true;
    },
    async backup() {
      assert();
      if (!manifest || manifest.phase !== 'ready') throw new Error('vault backup unavailable');
      const accounts = [];
      for (const name of await names()) {
        const db = await connect(name);
        try {
          if (!db.objectStoreNames.contains('identity')) continue;
          if (manifest.historyV === 2) {
            const snapshot = await snapshotHistory(db, historyCodec(key, manifest));
            const opened = await inspectHistory(db, snapshot, historyCodec(key, manifest));
            const identity = [...opened.stores.get('identity').values()].find(r => r.key === 'keys')?.value;
            if (identity?.recoveryMode === 'none') throw new Error('disposable identity cannot be backed up');
            accounts.push({ name, snapshot });
            continue;
          }
          const snapshot = await entries(db), rows = snapshot.filter(([k]) => vaultSlot('identity', k));
          for (const [slot, value] of rows) {
            const plain = await runtime.open(name, slot, value);
            if (slot === 'keys' && plain.recoveryMode === 'none') throw new Error('disposable identity cannot be backed up');
          }
          const inventory = snapshot.find(([k]) => k === MANIFEST)?.[1];
          const slots = (await runtime.open(name, MANIFEST, inventory)).slots;
          if (slots.length !== rows.length || rows.some(([slot]) => !slots.includes(slot))) throw new Error('vault backup inventory');
          accounts.push({ name, rows, inventory });
        }
        finally { db.close(); }
      }
      const catalog = await sealVaultRecord(key, manifest, CONTROL, 'meta', 'backup:accounts', { accounts: accounts.map(a => a.name), accountIndex: D.accounts(), ...(browser ? { browser: await browser.snapshot() } : {}) });
      return { vaultBackupV: VERSION, manifest, accounts, catalog };
    },
    async restore(data, pass) {
      assert();
      if (data?.vaultBackupV !== VERSION || !Array.isArray(data.accounts) || data.accounts.length > 100) throw new Error('vault backup format');
      const restored = await unlockVault(data.manifest, pass), stages = [];
      await openVaultState(restored, data.manifest);
      const catalog = await openVaultRecord(restored, data.manifest, CONTROL, 'meta', 'backup:accounts', data.catalog);
      if (data.manifest.phase !== 'ready' || !Array.isArray(catalog.accounts) || new Set(catalog.accounts).size !== data.accounts.length || catalog.accounts.length !== data.accounts.length || data.accounts.some(a => !catalog.accounts.includes(a.name)) || new Set(data.accounts.map(a => a.name)).size !== data.accounts.length) throw new Error('vault backup catalog');
      if (!Array.isArray(catalog.accountIndex) || catalog.accountIndex.some(a => typeof a.id !== 'string' || !catalog.accounts.includes(a.dbName || 'breeze-acc-' + a.id))) throw new Error('vault backup account index');
      for (const account of data.accounts) {
        if (data.manifest.historyV === 2) {
          if (!(account.name === 'breeze-messenger' || /^breeze-acc-[a-zA-Z0-9_-]+$/.test(account.name)) || !Array.isArray(account.snapshot?.stores)) throw new Error('history backup account');
          const db = await connect(account.name, account.snapshot.stores.map(([name]) => name));
          try {
            await inspectHistory(db, account.snapshot, historyCodec(restored, data.manifest));
            for (const store of db.objectStoreNames) if ((await entries(db, store)).length) throw new Error('vault restore requires empty accounts');
          } finally { db.close(); }
          stages.push([account.name, [['history:v2', account.snapshot]]]);
          continue;
        }
        if (!(account.name === 'breeze-messenger' || /^breeze-acc-[a-zA-Z0-9_-]+$/.test(account.name)) || !Array.isArray(account.rows)) throw new Error('vault backup account');
        const inventory = await openVaultRecord(restored, data.manifest, account.name, 'identity', MANIFEST, account.inventory);
        if (!Array.isArray(inventory.slots) || inventory.slots.length !== account.rows.length || new Set(account.rows.map(([s]) => s)).size !== account.rows.length || account.rows.some(([s]) => !inventory.slots.includes(s))) throw new Error('vault backup inventory');
        for (const [slot, value] of account.rows) {
          if (!vaultSlot('identity', slot)) throw new Error('vault backup slot');
          await openVaultRecord(restored, data.manifest, account.name, 'identity', slot, value);
        }
        const db = await connect(account.name);
        try {
          if (!db.objectStoreNames.contains('identity') || (await entries(db)).some(([slot]) => vaultSlot('identity', slot))) throw new Error('vault restore requires empty accounts');
        } finally { db.close(); }
        stages.push([account.name, account.rows]);
      }
      if (manifest) throw new Error('disable current vault before restoring');
      await exclusive(async () => {
        for (const [name] of stages) {
          const db = await connect(name);
          try {
            if (data.manifest.historyV === 2) {
              for (const store of db.objectStoreNames) if ((await entries(db, store)).length) throw new Error('vault restore requires empty accounts');
            } else if ((await entries(db)).some(([slot]) => vaultSlot('identity', slot))) throw new Error('vault restore requires empty accounts');
          }
          finally { db.close(); }
        }
        key = restored;
        const snapshot = catalog.browser || [[], []];
        snapshot[0] = snapshot[0].filter(([k]) => k !== 'brz-accounts'); snapshot[0].push(['brz-accounts', JSON.stringify(catalog.accountIndex)]);
        await save({ ...data.manifest, storageV: 1, phase: 'restoring', accounts: stages.map(([n]) => n), browser: await sealVaultRecord(key, data.manifest, CONTROL, 'meta', 'browser-journal', snapshot) }, stages); await resume(); D.reload();
      });
    },
    async command(value) {
      try {
        if (!/^\/(vault|keywrap)( (enable|disable|lock|password))?$/.test(value)) throw new Error('unknown vault command');
        if (value.endsWith(' enable') && manifest) throw new Error('vault already enabled');
        if (value.endsWith(' disable') && !manifest) return;
        if (/^\/(vault|keywrap) lock$/.test(value)) return runtime.lock();
        if (/^\/(vault|keywrap) password$/.test(value)) {
          const old = await D.prompt(D.t('vaultUnlock')), pass = await D.prompt(D.t('vaultNew')), confirm = await D.prompt(D.t('vaultConfirm'));
          if (!old || !pass || pass !== confirm) throw new Error(D.t('vaultMismatch'));
          return await runtime.password(old, pass);
        }
        if (manifest) {
          if (!await D.confirm(D.t('vaultDisable'))) return;
          const pass = await D.prompt(D.t('vaultUnlock')); if (pass) await runtime.change(pass, false);
        } else {
          if (!await D.confirm(D.t('vaultScope'))) return;
          const pass = await D.prompt(D.t('vaultNew')); if (!pass) return;
          if (pass !== await D.prompt(D.t('vaultConfirm'))) throw new Error(D.t('vaultMismatch'));
          const old = await D.prompt(D.t('vaultLegacy')); if (old === null) return;
          await runtime.change(pass, true, old || pass);
        }
      } catch (e) { D.dbg(e, 'vault-command'); D.toast(D.t('vaultFailed')); if (blocked) D.reload(); }
    },
    installGuards(target = globalThis) {
      if (target.setTimeout) {
        cancelTimer = target.clearTimeout.bind(target);
        for (const method of ['setTimeout', 'setInterval']) {
          const schedule = target[method].bind(target);
          target[method] = (fn, delay, ...args) => {
            const epoch = generation;
            const callback = function(...values) { if (method === 'setTimeout') timers.delete(id); if (!blocked && epoch === generation) fn.apply(this, values); };
            Object.defineProperty(callback, 'name', { value: fn.name || '' });
            const id = schedule(callback, delay, ...args);
            timers.add(id); return id;
          };
        }
        for (const method of ['clearTimeout', 'clearInterval']) {
          const cancel = target[method].bind(target);
          target[method] = id => { timers.delete(id); return cancel(id); };
        }
      }
      const remove = target.indexedDB?.deleteDatabase.bind(target.indexedDB);
      if (remove) target.indexedDB.deleteDatabase = (...args) => { assert(); if (manifest) throw new Error('authenticate vault disable before deleting accounts'); return remove(...args); };
      for (const method of ['encrypt', 'decrypt', 'sign', 'deriveBits', 'deriveKey', 'generateKey']) {
        const original = target.crypto.subtle[method].bind(target.crypto.subtle);
        target.crypto.subtle[method] = async (...args) => { const epoch = generation; assert(epoch); const value = await original(...args); assert(epoch); return value; };
      }
      if (target.fetch) {
        const fetch = target.fetch.bind(target);
        target.fetch = async (input, opts = {}) => {
          const url = typeof input === 'string' ? input : input.url;
          const guarded = (opts.method || input.method || 'GET') !== 'GET' || /\/api(?:\/|$)/.test(url);
          if (!guarded) return fetch(input, opts);
          const epoch = generation; assert(epoch);
          const ac = new AbortController(); aborters.add(ac);
          opts.signal?.addEventListener('abort', () => ac.abort(), { once: true });
          try { const response = await fetch(input, { ...opts, signal: ac.signal }); assert(epoch); return response; }
          finally { aborters.delete(ac); }
        };
      }
      for (const type of ['RTCDataChannel', 'WebSocket']) {
        const proto = target[type]?.prototype;
        if (proto?.send) { const send = proto.send; proto.send = function(...args) { assert(); return send.apply(this, args); }; }
      }
    },
  };
  return runtime;
}

export function vaultGate(D, unlock) {
  return new Promise(resolve => {
    const overlay = document.createElement('dialog'); overlay.id = 'vault-gate'; overlay.className = 'lock-overlay i-flex-col';
    overlay.setAttribute('aria-label', D.t('vaultTitle'));
    const panel = document.createElement('div'); panel.className = 'modal i-max-popup i-flex-col';
    const title = document.createElement('h2'); title.className = 'modal-title'; title.textContent = D.t('vaultTitle');
    const hint = document.createElement('p'); hint.className = 'modal-desc'; hint.textContent = D.t('vaultRecovery');
    const input = document.createElement('input'); input.type = 'password'; input.className = 'modal-input'; input.autocomplete = 'current-password'; input.setAttribute('aria-label', D.t('vaultUnlock'));
    const button = document.createElement('button'); button.className = 'btn btn-g'; button.textContent = D.t('uiUnlock');
    const error = document.createElement('p'); error.className = 'modal-desc'; error.setAttribute('role', 'alert');
    panel.append(title, hint, input, button, error); overlay.append(panel); document.body.appendChild(overlay);
    overlay.addEventListener('cancel', e => e.preventDefault()); overlay.showModal(); input.focus();
    const submit = async () => {
      if (button.disabled) return; button.disabled = true;
      try { const key = await unlock(input.value); input.value = ''; overlay.close(); overlay.remove(); resolve(key); }
      catch { input.value = ''; error.textContent = D.t('vaultFailed'); }
      finally { button.disabled = false; input.focus(); }
    };
    button.onclick = submit; input.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
  });
}
