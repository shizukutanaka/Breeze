// ============================================================================
// GROUP CAPS — two-tier provenance (asserted vs proven). Mirror of the 1:1 fix:
// roster/prekey caps are UNSIGNED assertions — they feed the session cache only;
// member.caps holds PROVEN caps written solely by _markGroupMemberCapProven when
// the member demonstrably produced v5 traffic (v5 sender_key over its
// authenticated 1:1 channel, or a decryptable v5 group message).
//
// The bug this guards: before the fix, safeMemberList persisted whatever caps the
// roster claimed and _mergeStickyGroupCaps made them un-removable — ONE forged
// /group/info response permanently implanted 'group-v5' on a legacy member, the
// AND-rule flipped, the group upgraded to v5, and that member silently stopped
// reading every message forever. The relay can lie; it just can't persist a lie.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRatchet } from '../src/crypto/ratchet.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

// --- Extract the negotiate/caps block: _negotiateGroupCaps .. _markGroupMemberCapProven ---
const CAPS_START = '  function _negotiateGroupCaps(localCaps, memberCapsList) {';
const CAPS_END = '\n  function _concatBytes(parts) {';
const cs = html.indexOf(CAPS_START), ce = html.indexOf(CAPS_END, cs);
if (cs < 0 || ce < 0) {
  throw new Error(
    'group-caps-two-tier: could not locate the negotiate/caps block in index.html ' +
    '("function _negotiateGroupCaps" .. "function _concatBytes") — update this test if the block moved.',
  );
}

function makeCapsInline() {
  const idb = new Map();
  const peerCapsCache = new Map();
  const dbGet = async (_s, k) => (idb.has(k) ? idb.get(k) : null);
  const dbPut = async (_s, v, k) => { idb.set(k, v); };
  const factory = new Function(
    'crypto', 'CONFIG', 'myId', 'dbGet', 'dbPut', '_dbg', '_peerCapsCache', 'CAPS_GROUP_V5',
    html.slice(cs, ce) +
      '\nreturn { _negotiateGroupCaps, _computeGroupV5, _mergeStickyGroupCaps, _memberGroupCaps, _assertPeerCaps, _harvestGroupCaps, _markGroupMemberCapProven };',
  );
  const api = factory(globalThis.crypto, { GROUP_RATCHET_V5: true }, 'me', dbGet, dbPut, () => {}, peerCapsCache, 'group-v5');
  return { ...api, idb, peerCapsCache };
}

// --- safeMemberList (roster → record sanitization) ---
const sm = html.match(/  function safeMemberList\(raw\) \{[\s\S]*?\n  \}\n/);
if (!sm) throw new Error('group-caps-two-tier: safeMemberList not found in index.html');
const safeMemberList = new Function('CONFIG', '_safeDisplayName', sm[0] + '\nreturn safeMemberList;')(
  { GROUP_MAX: 50 }, (s) => String(s || '').slice(0, 64),
);

// --- decryptGroupMsg (real v5 decrypt must mark the member proven) ---
const dm = html.match(/  async function decryptGroupMsg\(groupId, senderId, payload\) \{[\s\S]*?\n  \}\n/);
if (!dm) throw new Error('group-caps-two-tier: decryptGroupMsg not found in index.html');
const RATCHET_HKDF_START = '  // --- HKDF helper (RFC 5869) ---';
const RATCHET_HKDF_END = '\n  // --- Session store';
const rhs = html.indexOf(RATCHET_HKDF_START), rhe = html.indexOf(RATCHET_HKDF_END, rhs);
if (rhs < 0 || rhe < 0) throw new Error('group-caps-two-tier: inline hkdf block not found');
const inlineHkdf = new Function('crypto', 'CONFIG', '_dbg', html.slice(rhs, rhe) + '\nreturn { hkdf };')(
  globalThis.crypto, { HKDF_HASH: 'SHA-256' }, () => {},
);

const refR = createRatchet({ hasX25519: false });
const _refCommit = async (mk) => Array.from(await refR.keyCommitment(new Uint8Array(mk)));
const _cmOk = async (p, mk) => !p.cm || Array.from(new Uint8Array(p.cm)).join(',') === (await _refCommit(mk)).join(',');

function makeDecryptor(marked) {
  const idb = new Map();
  const dbGet = async (_s, k) => (idb.has(k) ? idb.get(k) : null);
  const dbPut = async (_s, v, k) => { idb.set(k, v); };
  return {
    idb,
    decryptGroupMsg: new Function(
      'crypto', 'CONFIG', 'dbGet', 'dbPut', 'hkdf', 'u8', '_dbg', 'TextDecoder', 'verifySignature', '_cmOk', '_markGroupMemberCapProven', 'CAPS_GROUP_V5',
      dm[0] + '\nreturn decryptGroupMsg;',
    )(
      globalThis.crypto, { SKIP_KEY_TTL_MS: 60000, GROUP_MAX_SKIP: 50 }, dbGet, dbPut,
      inlineHkdf.hkdf, (a) => new Uint8Array(a), () => {}, TextDecoder,
      async () => true, _cmOk, async (g, m, c) => { marked.push([g, m, c]); }, 'group-v5',
    ),
  };
}

const V5_KEY = () => ({ chainKey: Array.from(new Uint8Array(32).fill(0x77)), counter: 0, epoch: 0, v: 5, skipped: {} });

// Hand-roll a legacy v3 ciphertext (raw HKDF key + counter salt + AES-GCM, padded).
async function v3Cipher(raw, text, counter = 0) {
  const msgKey = await inlineHkdf.hkdf(new Uint8Array(raw), new Uint8Array(new Uint32Array([counter]).buffer), 'group-msg', 32);
  const enc = new TextEncoder().encode(text);
  const padded = new Uint8Array(Math.ceil((enc.length + 2) / 256) * 256);
  new DataView(padded.buffer).setUint16(0, enc.length);
  padded.set(enc, 2);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', msgKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, padded);
  return JSON.stringify({ v: 3, g: true, i: Array.from(iv), d: Array.from(new Uint8Array(ct)), c: counter });
}

describe('Group caps two-tier — asserted is session-only, proven persists', () => {
  it('asserted roster/prekey caps land in the session cache, pub-bound', () => {
    const i = makeCapsInline();
    i._harvestGroupCaps([{ id: 'p1', pub: 'p1restofpub', caps: ['group-v5'], name: 'P' }]);
    expect(i.peerCapsCache.get('p1').caps).toContain('group-v5');
  });

  it('pub↔id mismatch: forged caps are NOT cached (same bind as safeMemberList)', () => {
    const i = makeCapsInline();
    i._harvestGroupCaps([{ id: 'p1', pub: 'EVILdifferentpub', caps: ['group-v5'] }]);
    expect(i.peerCapsCache.has('p1')).toBe(false);
  });

  it('_memberGroupCaps unions proven member.caps + asserted session cache', () => {
    const i = makeCapsInline();
    i.peerCapsCache.set('p1', { caps: ['x3dh-v5'], ts: Date.now() });
    expect(i._memberGroupCaps({ id: 'p1', caps: ['group-v5'] })).toEqual(['group-v5', 'x3dh-v5']);
  });

  it('_computeGroupV5 counts asserted caps (anti-strip retained) but fails closed on none', () => {
    const i = makeCapsInline();
    i._assertPeerCaps('p1', 'p1pub', ['group-v5']);
    i._assertPeerCaps('p2', 'p2pub', ['group-v5']);
    expect(i._computeGroupV5({ members: [{ id: 'me' }, { id: 'p1' }, { id: 'p2' }] })).toBe(true);
    const j = makeCapsInline();
    j._assertPeerCaps('p1', 'p1pub', ['group-v5']); // p2 asserts nothing
    expect(j._computeGroupV5({ members: [{ id: 'me' }, { id: 'p1' }, { id: 'p2' }] })).toBe(false);
  });

  it('safeMemberList drops caps from records — asserted caps never persist', () => {
    const out = safeMemberList([{ id: 'p1', pub: 'p1pub', name: 'P', caps: ['group-v5'] }]);
    expect(out[0].caps).toBeUndefined();
    expect(out[0].pubB64).toBe('p1pub');
  });

  it('REGRESSION — one forged roster does NOT implant group-v5 past a session boundary', () => {
    // The pre-fix bug: the relay asserts group-v5 for a legacy member, safeMemberList
    // persisted it, _mergeStickyGroupCaps kept it un-removable → permanent silent exile.
    const roster = [{ id: 'leg', pub: 'legXYZpub', name: 'L', caps: ['group-v5'] }]; // forged
    const i = makeCapsInline();
    i._harvestGroupCaps(roster);
    const members = safeMemberList(roster);
    const g = { id: 'g1', members };
    expect(i._computeGroupV5(g)).toBe(true); // live session honors the assertion (anti-strip)
    expect(members[0].caps).toBeUndefined(); // but nothing persisted to the record
    const fresh = makeCapsInline();          // "restart": empty asserted cache, same record
    expect(fresh._computeGroupV5(g)).toBe(false); // forged cap is gone → back on v3
  });

  it('_markGroupMemberCapProven persists to member.caps + refreshes a live cache entry', async () => {
    const i = makeCapsInline();
    i.idb.set('g1', { id: 'g1', members: [{ id: 'me' }, { id: 'p1', pubB64: 'p1pub' }] });
    i.peerCapsCache.set('p1', { caps: ['x3dh-v5'], ts: Date.now() });
    await i._markGroupMemberCapProven('g1', 'p1', 'group-v5');
    expect(i.idb.get('g1').members[1].caps).toEqual(['group-v5']);
    expect(i.peerCapsCache.get('p1').caps).toEqual(['x3dh-v5', 'group-v5']);
    // Idempotent: no duplicate caps on a second mark.
    await i._markGroupMemberCapProven('g1', 'p1', 'group-v5');
    expect(i.idb.get('g1').members[1].caps).toEqual(['group-v5']);
  });

  it('_markGroupMemberCapProven: unknown group/member is a no-op', async () => {
    const i = makeCapsInline();
    await i._markGroupMemberCapProven('nope', 'p1', 'group-v5');
    i.idb.set('g1', { id: 'g1', members: [{ id: 'me' }] });
    await i._markGroupMemberCapProven('g1', 'ghost', 'group-v5');
    expect(i.idb.get('g1').members[0].caps).toBeUndefined();
  });

  it('proven cap survives a roster rewrite (merge carry-forward); asserted does not', async () => {
    const i = makeCapsInline();
    i.idb.set('g1', { id: 'g1', members: [{ id: 'me' }, { id: 'p1', pubB64: 'p1pub' }] });
    await i._markGroupMemberCapProven('g1', 'p1', 'group-v5');
    const prev = i.idb.get('g1').members;
    const next = safeMemberList([{ id: 'me', pub: 'mepub' }, { id: 'p1', pub: 'p1pub', caps: [] }]);
    const merged = i._mergeStickyGroupCaps(prev, next).members;
    expect(merged.find(m => m.id === 'p1').caps).toContain('group-v5');
    expect(i._computeGroupV5({ members: merged })).toBe(true);
  });

  it('a real v5 group decrypt marks the sender proven (functional)', async () => {
    const marked = [];
    const d = makeDecryptor(marked);
    d.idb.set('gsk-peer:G:S', V5_KEY());
    const { ciphertext } = await refR.groupSenderEncrypt(V5_KEY(), 'hello group');
    expect(await d.decryptGroupMsg('G', 'S', ciphertext)).toBe('hello group');
    expect(marked).toEqual([['G', 'S', 'group-v5']]);
  });

  it('a v3 decrypt does NOT mark — only demonstrable v5 traffic counts', async () => {
    const marked = [];
    const d = makeDecryptor(marked);
    const raw = Array.from(new Uint8Array(32).fill(0x33));
    d.idb.set('gsk-peer:G:S', { raw, counter: 0, epoch: 0 });
    expect(await d.decryptGroupMsg('G', 'S', await v3Cipher(raw, 'legacy msg'))).toBe('legacy msg');
    expect(marked).toEqual([]);
  });
});

describe('Group caps two-tier — wiring pins', () => {
  it('every roster ingest harvests asserted caps before sanitizing', () => {
    expect(html).toContain('_harvestGroupCaps(data.members)'); // join + poll
    expect(html).toContain('_harvestGroupCaps(invite.members)'); // invite
    expect((html.match(/_harvestGroupCaps\(data\.members\)/g) || []).length).toBe(2);
  });
  it('both proof sites mark: v5 sender_key receipt + v5 decrypt success', () => {
    expect(html).toContain('if (skEntry.v === 5) _markGroupMemberCapProven(skMsg.groupId');
    expect(html).toContain('if (p.v === 5 && peerSK.v === 5) _markGroupMemberCapProven(groupId, senderId, CAPS_GROUP_V5)');
  });
  it('createGroup seeds caps into the session cache, not the record', () => {
    expect(html).toContain('_assertPeerCaps(m.id, m.pubB64, capsById[m.id])');
  });
});
