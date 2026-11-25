import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { encodeVaultValue, decodeVaultValue, newVault, unlockVault, rewrapVault, sealVaultRecord, openVaultRecord, sealVaultState, openVaultState, vaultSlot, atomicVaultRows, createVaultRuntime } from '../src/app/vault.js';

const pass = 'a separate strong vault passphrase';
describe('vault authenticated records and explicit codec', () => {
  it('round trips nested values and every supported byte view', () => {
    const value = { missing: undefined, empty: [], object: {}, scalar: [null, true, false, '', 3], buffer: new Uint8Array([1, 2]).buffer };
    for (const Type of [Uint8Array, Uint8ClampedArray, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array, DataView]) value[Type.name] = new Type(new ArrayBuffer(16));
    expect(decodeVaultValue(encodeVaultValue(value))).toEqual(value);
    const sub = new Uint8Array([99, 1, 2, 99]).subarray(1, 3);
    expect(decodeVaultValue(encodeVaultValue(sub))).toEqual(new Uint8Array([1, 2]));
    const proto = JSON.parse('{"__proto__":{"safe":true}}');
    expect(decodeVaultValue(encodeVaultValue(proto))).toEqual(proto);
    expect({}.safe).toBeUndefined();
  });
  it.each([new Date(), new Map(), NaN, Infinity, () => {}, 1n])('rejects unsupported values (%s)', value => {
    expect(() => encodeVaultValue(value)).toThrow();
  });
  it.each([['scalar', 1, 2], ['undefined', 1], ['scalar', {}], ['array', null], ['object', [['x', ['scalar', 1]], ['x', ['scalar', 2]]]], ['FakeArray', 'AAAA'], ['Uint32Array', 'AQ==']])('rejects malformed typed tags (%j)', (...value) => {
    expect(() => decodeVaultValue(new TextEncoder().encode(JSON.stringify(value)))).toThrow();
  });
  it('binds ciphertext to vault, account, store, slot and version; never accepts plaintext', async () => {
    const { manifest, key } = await newVault(pass);
    const record = await sealVaultRecord(key, manifest, 'breeze-messenger', 'identity', 'sess:alice', { key: new Uint8Array([1, 2]) });
    expect(await openVaultRecord(key, manifest, 'breeze-messenger', 'identity', 'sess:alice', record)).toEqual({ key: new Uint8Array([1, 2]) });
    for (const args of [
      [key, manifest, 'breeze-acc-b', 'identity', 'sess:alice', record],
      [key, manifest, 'breeze-messenger', 'contacts', 'sess:alice', record],
      [key, manifest, 'breeze-messenger', 'identity', 'sess:bob', record],
      [key, { ...manifest, id: 'another-vault' }, 'breeze-messenger', 'identity', 'sess:alice', record],
      [key, manifest, 'breeze-messenger', 'identity', 'sess:alice', { ...record, vaultV: 2 }],
      [key, manifest, 'breeze-messenger', 'identity', 'sess:alice', { key: [1, 2] }],
      [key, manifest, 'breeze-messenger', 'identity', 'sess:alice', { ...record, ct: record.ct.slice(4) }],
    ]) await expect(openVaultRecord(...args)).rejects.toThrow();
    expect(key.extractable).toBe(false);
    await expect(unlockVault(manifest, 'wrong passphrase')).rejects.toThrow();
  });
  it('password change rewraps only the same random data key', async () => {
    const { manifest, key } = await newVault(pass);
    const record = await sealVaultRecord(key, manifest, 'breeze-messenger', 'identity', 'keys', { priv: 'secret' });
    const next = await rewrapVault(manifest, pass, pass + ' changed');
    expect(next.id).toBe(manifest.id); expect(next.wrapped).not.toEqual(manifest.wrapped);
    expect(await openVaultRecord(await unlockVault(next, pass + ' changed'), next, 'breeze-messenger', 'identity', 'keys', record)).toEqual({ priv: 'secret' });
    await expect(unlockVault(next, pass)).rejects.toThrow();
    await expect(newVault('short')).rejects.toThrow('minimum');
    await expect(unlockVault({ ...next, v: 2 }, pass)).rejects.toThrow('version');
    await expect(unlockVault({ ...next, wrapped: { ...next.wrapped, iter: 1 } }, pass)).rejects.toThrow('KDF');
  });
  it('has the exact approved scope', () => {
    for (const slot of ['keys', 'signing', 'pq-priv', 'spk-priv', 'otp-priv', 'sess:a', 'gsk:g', 'gsk-peer:g:a']) expect(vaultSlot('identity', slot)).toBe(true);
    for (const slot of ['msgkey', 'account', 'draft:a', 'scheduled:a']) expect(vaultSlot('identity', slot)).toBe(false);
    expect(vaultSlot('messages', 'keys')).toBe(false);
  });
  it('authenticates migration phase, account list, restore index and staged-slot inventories', async () => {
    const { manifest, key } = await newVault(pass);
    const pending = await sealVaultState(key, { ...manifest, phase: 'enabling', accounts: ['breeze-messenger'], accountIndex: [{ id: 'default' }] }, [['breeze-messenger', [['keys', {}], ['sess:a', {}]]]]);
    expect((await openVaultState(key, pending)).inventories).toEqual([['breeze-messenger', ['keys', 'sess:a']]]);
    for (const change of [{ phase: 'ready' }, { accounts: [] }, { accountIndex: [] }, { auth: { ...pending.auth, ct: pending.auth.ct.slice(4) } }]) {
      await expect(openVaultState(key, { ...pending, ...change })).rejects.toThrow();
    }
    const ready = await sealVaultState(key, manifest);
    expect(await openVaultState(key, ready)).toEqual({ phase: 'ready', accounts: [], accountIndex: null, inventories: [] });
    await expect(openVaultState(key, manifest)).rejects.toThrow();
  });
});

describe('vault abort and lock boundary', () => {
  it('retains timer callback names, arguments and native receiver, and cancels on freeze', async () => {
    let next = 0;
    const jobs = new Map(), cancel = vi.fn(id => jobs.delete(id));
    const schedule = vi.fn((fn, _delay, ...args) => { jobs.set(++next, { fn, args }); return next; });
    const target = { setTimeout: schedule, setInterval: schedule, clearTimeout: cancel, clearInterval: cancel,
      crypto: { subtle: Object.fromEntries(['encrypt', 'decrypt', 'sign', 'deriveBits', 'deriveKey', 'generateKey'].map(k => [k, vi.fn()])) } };
    const reload = vi.fn(), runtime = createVaultRuntime({ reload, dbg: vi.fn() });
    runtime.installGuards(target);
    const seen = [];
    function namedTimer(value) { seen.push([this, value]); }
    const id = target.setTimeout(namedTimer, 10, 'argument');
    expect(jobs.get(id).fn.name).toBe('namedTimer');
    jobs.get(id).fn.apply(target, jobs.get(id).args);
    expect(seen).toEqual([[target, 'argument']]);
    const cleared = target.setInterval(namedTimer, 10); target.clearInterval(cleared);
    const active = target.setInterval(namedTimer, 10);
    const channel = new BroadcastChannel('breeze-vault-v1'); channel.postMessage({ type: 'freeze' });
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    expect(cancel).toHaveBeenCalledWith(active);
    expect(cancel.mock.calls.filter(([id]) => id === cleared)).toHaveLength(1);
    channel.close();
  });
  it('aborts an entire records+manifest write on a synchronous put failure', async () => {
    const put = vi.fn(() => { throw new Error('injected crash'); });
    const tx = { objectStore: () => ({ put }), abort: vi.fn(() => queueMicrotask(() => tx.onabort())) };
    await expect(atomicVaultRows({ transaction: () => tx }, [['keys', {}]], {})).rejects.toThrow();
    expect(tx.abort).toHaveBeenCalledOnce();
  });
  it('empty migration still commits a manifest, and reports transaction abort', async () => {
    const put = vi.fn(), tx = { objectStore: () => ({ put }) };
    const promise = atomicVaultRows({ transaction: () => tx }, [], { vaultV: 1 });
    expect(put).toHaveBeenCalledWith({ vaultV: 1 }, 'vault:manifest');
    tx.onabort(); await expect(promise).rejects.toThrow('aborted');
  });
  it('guards in-flight crypto with an epoch after cross-tab freeze', async () => {
    let finish; const decrypt = () => new Promise(resolve => { finish = resolve; });
    const target = { crypto: { subtle: Object.fromEntries(['encrypt', 'decrypt', 'sign', 'deriveBits', 'deriveKey', 'generateKey'].map(k => [k, decrypt])) } };
    const reload = vi.fn(), runtime = createVaultRuntime({ reload, dbg: vi.fn(), quiesce: vi.fn() });
    runtime.installGuards(target);
    const pending = target.crypto.subtle.decrypt();
    const channel = new BroadcastChannel('breeze-vault-v1'); channel.postMessage({ type: 'freeze' });
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    finish(new ArrayBuffer(1)); await expect(pending).rejects.toThrow('locked');
    await expect(target.crypto.subtle.sign()).rejects.toThrow('locked');
    channel.close();
  });
  it('gates boot on the mandatory module and denies quick replies before contact/decrypt handling', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const init = html.slice(html.indexOf('async function initMessenger('));
    expect(init.indexOf('if (!globalThis.__breezeVault) throw')).toBeLessThan(init.indexOf('const DB_VER'));
    expect(init.indexOf('await _vault.boot()')).toBeLessThan(init.indexOf('const DB_VER'));
    expect(init).toContain('installNotificationActions({ serviceWorker: navigator.serviceWorker, signal: _ac.signal, blocked: () => _vault.isBlocked()');
    const actions = readFileSync(new URL('../src/app/message-requests.js', import.meta.url), 'utf8');
    const handler = actions.slice(actions.indexOf('export function installNotificationActions('));
    expect(handler.indexOf('if (D.blocked?.()) return;')).toBeGreaterThan(-1);
    expect(handler.indexOf('if (D.blocked?.()) return;')).toBeLessThan(handler.indexOf("e.data?.type === 'quick-reply'"));
  });
});
