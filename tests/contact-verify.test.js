import { describe, it, expect, vi } from 'vitest';
import { contactBinding, contactSafetyNumber, createContactVerify } from '../src/app/contact-verify.js';
import { vaultSlot } from '../src/app/vault.js';
import { readFileSync } from 'node:fs';

const key = n => btoa(String.fromCharCode(...new Uint8Array(32).fill(n)));
const alice = { id: 'alice', pubB64: key(1), sigPub: key(2) };
const bob = { id: 'bob', pubB64: key(3), sigPub: key(4) };
function setup() {
  const records = new Map([['contacts:bob', structuredClone(bob)]]);
  const D = {
    account: 'unit', now: () => 1234, t: value => value, esc: value => value,
    get: vi.fn(async (store, id) => structuredClone(records.get(store + ':' + id))),
    put: vi.fn(async (store, value, id) => { records.set(store + ':' + id, structuredClone(value)); return true; }),
    audit: vi.fn(async () => {}), dbg: vi.fn(), contacts: async () => [structuredClone(records.get('contacts:bob'))],
  };
  return { D, records, api: createContactVerify(D) };
}
describe('contact verification persistence', () => {
  it('only the newest concurrent header paint appends a badge and changed-key warning', async () => {
    const { api, D } = setup();
    await api.invalidate(bob.id);
    const parent = { parentElement: { querySelector: () => null }, insertAdjacentElement: vi.fn() };
    const header = { querySelector: () => null, appendChild: vi.fn(), closest: () => parent };
    D.active = () => bob; D.header = () => header; D.safeSetHTML = vi.fn();
    vi.stubGlobal('document', { createElement: () => ({ firstElementChild: {}, dataset: {} }) });
    try {
      await Promise.all([api.paintHeader(bob), api.paintHeader(bob)]);
      expect(header.appendChild).toHaveBeenCalledTimes(1);
      expect(parent.insertAdjacentElement).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
  it('binds both full pins and compares symmetrically without changing the legacy number', async () => {
    expect(await contactBinding(bob)).not.toBe(await contactBinding({ ...bob, sigPub: key(5) }));
    expect(await contactBinding(bob)).not.toBe(await contactBinding({ ...bob, pubB64: key(5) }));
    expect(await contactSafetyNumber(alice, bob)).toBe(await contactSafetyNumber(bob, alice));
    await expect(contactBinding({ ...bob, sigPub: '' })).rejects.toThrow();
  });
  it('persists method, timestamp and binding across factory reloads', async () => {
    const { api, D, records } = setup();
    await api.verify(bob, 'safety-number');
    expect(records.get('identity:verify:bob')).toMatchObject({ verified: true, at: 1234, method: 'safety-number', binding: await contactBinding(bob), strict: true });
    expect((await createContactVerify(D).state(bob)).verified).toBe(true);
    expect(await api.permit(bob)).toBe(true);
  });
  it.each(['pubB64', 'sigPub'])('invalidates %s changes, persists warning and blocks until re-verification', async field => {
    const { api, records, D } = setup();
    await api.verify(bob, 'safety-number');
    const changed = { ...bob, [field]: key(5) };
    records.set('contacts:bob', changed);
    await api.observe(changed);
    expect((await api.state(changed))).toMatchObject({ changed: true, verified: false });
    expect(await api.permit(changed)).toBe(false);
    expect(await createContactVerify(D).permit(changed)).toBe(false);
    await api.verify(changed, 'safety-number');
    expect(await api.permit(changed)).toBe(true);
    expect(D.audit).toHaveBeenCalledWith('security', expect.stringContaining('[keys]'), 'warn');
  });
  it.each(['signing', 'kt-rolled', 'kt-tampered', 'identity'])('persists a rejected %s mismatch even if pins do not change', async reason => {
    const { api, D } = setup();
    await api.verify(bob, 'safety-number');
    await api.invalidate(bob.id, reason);
    expect((await api.state(bob))).toMatchObject({ changed: true, verified: false });
    expect(await createContactVerify(D).permit(bob)).toBe(false);
    await api.setStrict(bob, false);
    expect(await api.permit(bob)).toBe(true);
    expect((await api.state(bob)).changed).toBe(true);
  });
  it('does not invalidate unchanged keys or unverified contacts', async () => {
    const { api, D } = setup();
    expect(await api.permit(bob)).toBe(true);
    expect((await api.state(bob)).verified).toBeFalsy();
    await api.verify(bob, 'safety-number');
    await api.observe({ ...bob, name: 'new name' });
    expect((await api.state(bob)).verified).toBe(true);
    expect(D.audit).toHaveBeenCalledTimes(1);
  });
  it.each(['sigPub', 'pubB64'])('treats disappearing %s as a change, without recovering an old stored pin', async field => {
    const { api } = setup();
    await api.verify(bob, 'safety-number');
    const missing = { ...bob }; delete missing[field];
    await api.observe(missing);
    expect((await api.state(bob))).toMatchObject({ verified: false, changed: true });
    expect(await api.permit(bob)).toBe(false);
  });
  it('uses the same records for groups and blocks a group containing a changed strict contact', async () => {
    const { api } = setup();
    await api.verify(bob, 'safety-number');
    expect((await api.labels([bob])).get(bob.id)).toContain('verified');
    const group = { id: 'group', isGroup: true, members: [bob] };
    expect(await api.security(group)).toContain('cvVerified');
    expect(await api.permit(group)).toBe(true);
    await api.invalidate(bob.id, 'signing');
    expect(await api.permit(group)).toBe(false);
    expect(await api.security(group)).toContain('cvChanged');
  });
  it('does not confuse incomplete legacy roster metadata with removal of a direct contact signing pin', async () => {
    const { api } = setup(); await api.verify(bob, 'safety-number');
    const member = { id: bob.id, pubB64: bob.pubB64 }, group = { id: 'old-group', isGroup: true, members: [member] };
    await api.observe(group);
    expect((await api.labels([member])).get(bob.id)).toContain('unverified');
    expect((await api.state(bob)).verified).toBe(true);
  });
  it('warns on replacement/removal of never-verified pins but permits their initial establishment', async () => {
    const { api, records } = setup();
    records.set('contacts:bob', { ...bob, sigPub: undefined });
    await api.observe(bob);
    expect((await api.state(bob)).changed).not.toBe(true);
    records.set('contacts:bob', bob);
    await api.observe({ ...bob, sigPub: undefined });
    expect((await api.state(bob)).changed).toBe(true);
    expect(await api.permit(bob)).toBe(false);
  });
  it('rejects sending rather than treating failed verification reads as missing records', async () => {
    const { api, D } = setup(); await api.verify(bob, 'safety-number');
    D.get.mockRejectedValue(new Error('read failed'));
    await expect(api.permit(bob)).rejects.toThrow('read failed');
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain("String(key).startsWith('verify:') || typeof _vault");
    expect(html).toContain("if (!globalThis.__breezeContactVerify) throw");
  });
  it('refuses confirmation if either the displayed binding or invalidation revision became stale', async () => {
    const { api, records } = setup();
    const expected = { binding: await contactBinding(bob), revision: 0 };
    await api.invalidate(bob.id, 'kt-tampered');
    await expect(api.verify(bob, 'safety-number', expected)).rejects.toThrow('during comparison');
    records.set('contacts:bob', { ...bob, sigPub: key(8) });
    await expect(api.verify(bob, 'safety-number')).rejects.toThrow('during comparison');
  });
  it('fails closed on persistence errors without reporting verified success', async () => {
    const { api, D } = setup();
    D.put.mockResolvedValue(false);
    await expect(api.verify(bob, 'safety-number')).rejects.toThrow('persistence');
    expect(D.audit).not.toHaveBeenCalled();
    await expect(api.invalidate(bob.id)).rejects.toThrow('persistence');
    expect(await api.permit(bob)).toBe(false);
  });
  it('migrates existing in-person confirmations once, but never imported plaintext flags later', async () => {
    const { api, records, D } = setup();
    records.set('contacts:bob', { ...bob, offlineVerified: true, offlinePairing: { remote: { pub: bob.pubB64, sigPub: bob.sigPub } } });
    await api.migrate();
    expect((await api.state(bob)).method).toBe('pairing-migration');
    records.delete('identity:verify:bob');
    await createContactVerify(D).migrate();
    expect((await api.state(bob)).verified).toBeFalsy();
  });
  it('accepts the explicit pairing method and protects records and the migration marker with the vault', async () => {
    const { api } = setup();
    await api.verify(bob, 'in-person-pairing');
    expect((await api.state(bob)).method).toBe('in-person-pairing');
    expect(vaultSlot('identity', 'verify:bob')).toBe(true);
    expect(vaultSlot('identity', 'verify:policy')).toBe(true);
    expect(vaultSlot('contacts', 'verify:bob')).toBe(false);
  });
});

describe('deployed verification hooks', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const load = (name, end, deps) => {
    const start = html.indexOf('  async function ' + name + '(');
    const src = html.slice(start, html.indexOf(end, start));
    return new Function(...Object.keys(deps), src + '\nreturn ' + name + ';')(...Object.values(deps));
  };
  it.each(['rolled', 'tampered'])('the real safety-number KT audit invalidates on %s', async verdict => {
    const { api, D } = setup(); await api.verify(bob, 'safety-number');
    const audit = load('_auditKeyTransparency', '\n  async function showSafetyNumber', {
      API: '/api', dbGet: D.get, dbPut: D.put, _contactVerify: api, _dbg: D.dbg,
      postAPIRaw: async () => ({ ok: true, json: async () => ({ log: [] }) }),
      _auditKeyHistory: async () => ({ verdict }), _ktHeadC: () => null,
    });
    expect((await audit(bob)).verdict).toBe(verdict);
    expect(await api.permit(bob)).toBe(false);
    expect((await api.state(bob)).reason).toBe('kt-' + verdict);
  });
  it('a vanished KT head invalidates even when the chain audit itself is ok', async () => {
    const { api, D, records } = setup(); await api.verify(bob, 'safety-number');
    records.set('identity:ktPin:bob', { c: 'pinned-head' });
    const audit = load('_auditKeyTransparency', '\n  async function showSafetyNumber', {
      API: '/api', dbGet: D.get, dbPut: D.put, _contactVerify: api, _dbg: D.dbg,
      postAPIRaw: async () => ({ ok: true, json: async () => ({ log: [] }) }),
      _auditKeyHistory: async () => ({ verdict: 'ok' }), _ktHeadC: () => null,
    });
    expect((await audit(bob)).verdict).toBe('tampered'); expect(await api.permit(bob)).toBe(false);
  });
  it.each(['identityKey', 'edIdentityKey'])('the real bundle rejection invalidates %s mismatch without adopting it', async field => {
    const { api, D, records } = setup();
    const c = { ...bob, id: bob.pubB64.slice(0, 12) }; records.set('contacts:' + c.id, c);
    await api.verify(c, 'safety-number');
    const fetch = load('_fetchSessionBundleV5', '\n  async function initSessionV5Initiator', {
      dbGet: D.get, _contactVerify: api, _dbg: D.dbg, showToast: vi.fn(), t: D.t, MS: { SEC: 1000 },
    });
    expect(await fetch(c.pubB64, { identityKey: c.pubB64, edIdentityKey: c.sigPub, [field]: key(9) })).toBe(false);
    expect(await api.permit(c)).toBe(false); expect(records.get('contacts:' + c.id)).toEqual(c);
  });
  it('the common message-signing/key-change warning persists invalidation', async () => {
    const { api, D } = setup(); await api.verify(bob, 'safety-number');
    const warn = load('showKeyChangeWarning', '\n  // --- Init session', {
      _contactVerify: api, dbGet: D.get, _DOM: { get: () => null }, activeContact: null,
      showToast: vi.fn(), t: D.t, announceToSR: vi.fn(), auditLog: D.audit,
    });
    await warn(bob.id, bob.pubB64, 'Signing key change');
    expect(await api.permit(bob)).toBe(false);
  });
  it('contact writes observe pin changes before the vault/plaintext branches', () => {
    const src = html.slice(html.indexOf('  async function dbPut('), html.indexOf('  // Automatic-backup change hook'));
    expect(src.indexOf('_contactVerify?.observe(val)')).toBeLessThan(src.indexOf('_vault.put('));
    expect(html).toContain("_contactVerify?.invalidate(ktPeerId, pinBroken ? 'kt-tampered' : 'kt-' + audit.verdict)");
  });
});
