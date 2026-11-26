import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BROWSER_SLOT, browserBootstrap, commitBrowserVault, createBrowserVault } from '../src/app/vault-browser.js';
import { newVault, openVaultRecord, sealVaultRecord } from '../src/app/vault.js';

class Storage {
  rows = new Map();
  get length() { return this.rows.size; }
  key(n) { return [...this.rows.keys()][n] ?? null; }
  getItem(k) { return this.rows.get(k) ?? null; }
  setItem(k, v) { this.rows.set(k, String(v)); }
  removeItem(k) { this.rows.delete(k); }
  clear() { this.rows.clear(); }
}
const methods = Object.fromEntries(['getItem', 'setItem', 'removeItem', 'key', 'clear'].map(k => [k, Storage.prototype[k]]));
const setup = () => {
  const local = new Storage(), session = new Storage();
  const boot = browserBootstrap(local, session, methods);
  return { local, session, boot };
};
let codec;
beforeAll(async () => {
  const { key, manifest } = await newVault('a separate strong vault passphrase');
  codec = { seal: (...args) => sealVaultRecord(key, manifest, ...args), open: (...args) => openVaultRecord(key, manifest, ...args) };
});
afterEach(() => vi.unstubAllGlobals());
const locks = () => {
  let tail = Promise.resolve();
  vi.stubGlobal('navigator', { locks: { request: (_name, work) => { const next = tail.then(work); tail = next.catch(() => {}); return next; } } });
};

describe('vault browser storage', () => {
  it('buffers pre-boot writes and leaves vault-off values unchanged', async () => {
    const { boot, local } = setup();
    boot.invoke(local, 'setItem', 'brz-drafts', 'draft');
    expect(local.getItem('brz-drafts')).toBeNull();
    expect(boot.invoke(local, 'getItem', 'brz-drafts')).toBe('draft');
    await createBrowserVault(boot, null);
    expect(local.getItem('brz-drafts')).toBe('draft');
    boot.invoke(local, 'clear');
    expect(local.length).toBe(0);
  });
  it('migrates empty stores, encrypts both scopes and restores plaintext only on authenticated disable', async () => {
    const { boot, local, session } = setup();
    local.setItem('brz-theme', 'dark'); local.setItem('brz-accounts', 'private-account');
    session.setItem('brz-shared-text', 'private-share');
    const plain = await createBrowserVault(boot, null), snapshot = await plain.freeze(true);
    expect(session.getItem('brz-shared-text')).toBe('private-share');
    await commitBrowserVault(boot, snapshot, codec);
    expect(JSON.stringify([...local.rows, ...session.rows])).not.toContain('private-');
    expect(local.getItem('brz-theme')).toBe('dark');
    const unlocked = await createBrowserVault(boot, codec);
    expect(boot.invoke(local, 'getItem', 'brz-accounts')).toBe('private-account');
    expect(boot.invoke(session, 'getItem', 'brz-shared-text')).toBe('private-share');
    await commitBrowserVault(boot, await unlocked.freeze(true), null);
    expect(local.getItem('brz-accounts')).toBe('private-account');
    expect(session.getItem('brz-shared-text')).toBe('private-share');
    expect(local.getItem(BROWSER_SLOT)).toBeNull();
    await commitBrowserVault(boot, [[], []], codec);
    expect(await (await createBrowserVault(boot, codec)).snapshot()).toEqual([[], []]);
  });
  it('serializes writes from two caches without losing other keys and denies reads after freeze', async () => {
    locks();
    const { boot, local } = setup();
    await commitBrowserVault(boot, [[], []], codec);
    const first = await createBrowserVault(boot, codec);
    const second = await createBrowserVault(boot, codec);
    first.setItem(0, 'brz-drafts', 'private-draft'); second.setItem(0, 'brz-diag', 'private-counter');
    await Promise.all([first.flush(), second.flush()]);
    expect((await second.snapshot())[0]).toEqual([['brz-drafts', 'private-draft'], ['brz-diag', 'private-counter']]);
    expect(JSON.stringify([...local.rows])).not.toContain('private-');
    boot.invoke(local, 'clear'); await second.flush();
    expect((await second.snapshot())[0]).toEqual([]);
    await first.freeze();
    expect(() => first.getItem(0, 'brz-drafts')).toThrow('locked');
    expect(() => first.setItem(0, 'brz-drafts', 'leak')).toThrow('locked');
    expect(local.getItem('brz-drafts')).toBeNull();
  });
  it.each([null, [[], [['brz-theme', 'not-private']]], [[['duplicate', 'one'], ['duplicate', 'two']], []], [[['value', 1]], []]])('rejects malformed browser journals before any writes (%j)', async snapshot => {
    const { boot, local } = setup();
    if (snapshot === null) snapshot = [[], null];
    await expect(commitBrowserVault(boot, snapshot, null)).rejects.toThrow('snapshot');
    expect(local.length).toBe(0);
  });
  it('rejects missing, tampered and cross-scope ciphertext instead of using plaintext', async () => {
    const { boot, local, session } = setup();
    await expect(createBrowserVault(boot, codec)).rejects.toThrow('inventory missing');
    await commitBrowserVault(boot, [[['brz-drafts', 'private']], []], codec);
    session.setItem(BROWSER_SLOT, local.getItem(BROWSER_SLOT));
    await expect(createBrowserVault(boot, codec)).rejects.toThrow();
    local.setItem(BROWSER_SLOT, '{}');
    await expect(createBrowserVault(boot, codec)).rejects.toThrow();
  });
  it('fails closed when persistence fails and never writes a plaintext fallback', async () => {
    locks();
    const { boot, local } = setup();
    await commitBrowserVault(boot, [[], []], codec);
    const failed = vi.fn(), storage = await createBrowserVault(boot, codec, failed);
    local.setItem(BROWSER_SLOT, '{}'); storage.setItem(0, 'brz-drafts', 'private-draft');
    await expect(storage.flush()).rejects.toThrow();
    expect(failed).toHaveBeenCalledOnce();
    expect(() => storage.getItem(0, 'brz-drafts')).toThrow();
    expect(local.getItem('brz-drafts')).toBeNull();
  });
});
