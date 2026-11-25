// SHARE_PLAN stage 5 step 4 — profile distribution logic + wiring.
// The completion conditions: the server never sees a plaintext
// display name or avatar (bundle/relay audit), and un-upgraded peers
// don't break (capability-gated sending).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CAPS_PROFILE, sanitizeProfile, sanitizeProfileImg, stripBidi,
  buildProfilePayload, parseProfilePayload, profileNewer, createProfileUI,
} from '../src/app/profile.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const JPEG = 'data:image/jpeg;base64,' + 'A'.repeat(400);
const PNG = 'data:image/png;base64,' + 'B'.repeat(400);

describe('profile sanitization', () => {
  it('accepts a normal profile and trims fields to bounds', () => {
    const p = sanitizeProfile({ name: '  Ana  ', emoji: '🌊', img: JPEG });
    expect(p).toEqual({ name: 'Ana', emoji: '🌊', img: JPEG });
    expect(sanitizeProfile({ name: 'x'.repeat(100) }).name).toHaveLength(64);
  });

  it('rejects empty names and non-objects', () => {
    expect(sanitizeProfile({ name: '   ' })).toBeNull();
    expect(sanitizeProfile(null)).toBeNull();
    expect(sanitizeProfile('Ana')).toBeNull();
  });

  it('strips bidi control characters from name and emoji (D27)', () => {
    // U+202E (RLO) renders the following text reversed — a spoofed name must
    // not survive sanitization on either the sending or receiving side.
    const p = sanitizeProfile({ name: 'Al\u202eice', emoji: '\u2066🌊' });
    expect(p.name).toBe('Alice');
    expect(p.emoji).toBe('🌊');
    expect(sanitizeProfile({ name: '\u202a\u2069' })).toBeNull(); // bidi-only → empty → rejected
    expect(stripBidi('a\u202bb\u2067c')).toBe('abc');
    expect(stripBidi(42)).toBe('');
  });

  it('the photo must be a strict data:image jpeg/png base64 URL', () => {
    expect(sanitizeProfileImg(JPEG)).toBe(JPEG);
    expect(sanitizeProfileImg(PNG)).toBe(PNG);
    expect(sanitizeProfileImg('data:image/svg+xml;base64,AAAA')).toBe(''); // svg can carry script
    expect(sanitizeProfileImg('data:text/html;base64,AAAA')).toBe('');
    expect(sanitizeProfileImg('https://evil.example/x.jpg')).toBe('');
    expect(sanitizeProfileImg('data:image/jpeg;base64,AAA" onerror="alert(1)')).toBe('');
    expect(sanitizeProfileImg('data:image/jpeg;base64,' + 'A'.repeat(40000))).toBe(''); // oversized
    expect(sanitizeProfileImg('')).toBe('');
  });
});

describe('profile payloads', () => {
  it('round-trips through build/parse', () => {
    const wire = buildProfilePayload({ name: 'Ana', emoji: '🌊', img: JPEG }, 1700000000000);
    const back = parseProfilePayload(wire, 1700000000000);
    expect(back).toEqual({ pv: 1700000000000, name: 'Ana', emoji: '🌊', img: JPEG });
  });

  it('parse refuses other types, bad versions and future-dated versions', () => {
    expect(parseProfilePayload('{"type":"sender_key","pv":1,"name":"A"}')).toBeNull();
    expect(parseProfilePayload('{"type":"profile","v":2,"pv":1,"name":"A"}')).toBeNull();
    expect(parseProfilePayload('{"type":"profile","v":1,"pv":99999999999999,"name":"A"}', 1700000000000)).toBeNull();
    expect(parseProfilePayload('not json')).toBeNull();
    expect(parseProfilePayload('{"type":"profile","v":1,"pv":5,"name":"A","img":"https://x/y.png"}', 1000).img).toBe('');
  });

  it('profileNewer is strictly monotonic per contact', () => {
    expect(profileNewer({ pv: 10 }, { profilePv: 9 })).toBe(true);
    expect(profileNewer({ pv: 10 }, { profilePv: 10 })).toBe(false);
    expect(profileNewer({ pv: 10 }, {})).toBe(true);
    expect(profileNewer(null, {})).toBe(false);
  });
});

describe('stage 5 step 4 wiring + server-blindness audit', () => {
  it('the capability is advertised in the bundle and only gates sending', () => {
    expect(html).toContain("const CAPS_PROFILE = 'profile-v1';");
    expect(html).toContain('caps.push(CAPS_PROFILE);');
    expect(CAPS_PROFILE).toBe('profile-v1');
  });

  it('the relay never sees profile fields: only the opaque flag is ferried', () => {
    expect(worker).not.toContain('avatarImg');
    expect(worker).not.toContain('profile-v1');
    expect(worker).not.toContain('sanitizeProfile');
    expect(worker).toContain('if (body.isProfile === true) msg.isProfile = true;');
  });

  it('profiles travel only as ratchet ciphertexts flagged isProfile', () => {
    const mod = readFileSync(new URL('../src/app/profile.js', import.meta.url), 'utf8');
    expect(mod).toContain('isProfile: true }, contact.pubB64);');
    expect(html).toContain('if (msg.isProfile) {');
    expect(html).toContain('if (msg.isProfile) {');
    expect(html).toContain('P?.parseProfilePayload(decrypted)');
    expect(html).toContain('P.profileNewer(prof, c)');
  });

  it('a local rename is never clobbered by a distributed profile', () => {
    expect(html).toContain('c.nameLocked = true;');
    expect(html).toContain('if (!c.nameLocked) c.name = prof.name;');
  });

  it('the module is bridged and precached', () => {
    expect(html).toContain("import { CAPS_PROFILE as _CAPS_PROFILE_STR, sanitizeProfile, buildProfilePayload, parseProfilePayload, profileNewer, createProfileUI } from './src/app/profile.js';");
    expect(sw).toContain("'/src/app/profile.js'");
  });

  it('the panel follows the _makeDialog house pattern (array destructure + safeSetHTML)', () => {
    const mod = readFileSync(new URL('../src/app/profile.js', import.meta.url), 'utf8');
    const start = mod.indexOf('async function _showProfilePanel()');
    const body = mod.slice(start, start + 700);
    expect(body).toContain('const [dlg, titleId] = D.makeDialog();');
    expect(body).toContain('D.safeSetHTML(dlg,');
    expect(html).not.toContain("_makeDialog('profile-title'");
  });
});

// Regression (found by driving two real browsers, bisected to the commit that added the
// add-contact greeting): the greeting was the FIRST ratchet message to a new contact, so
// it carried the one-shot X3DH header. The peer either dropped it (profile from an
// unknown sender) or was itself greeting at that moment (two initiator sessions, no
// responder) — and every chat message after it failed to decrypt. A profile may only
// ride a session that already exists.
describe('profile delivery never opens a session', () => {
  function harness({ session = false, caps = ['profile-v1'], saved = { name: 'Alice', emoji: '', img: '', pv: 7 } } = {}) {
    const state = { session, sends: [], encrypts: 0, contacts: new Map() };
    const ui = createProfileUI({
      dbGet: async (store, key) => (store === 'settings' ? saved : store === 'contacts' ? state.contacts.get(key) ?? null : null),
      dbPut: async (store, rec) => { if (store === 'contacts') state.contacts.set(rec.id, rec); },
      dbGetAll: async () => [...state.contacts.values()],
      encryptFor: async (wire) => { state.encrypts++; return 'enc:' + wire; },
      relaySend: async (id, env) => { state.sends.push(env); },
      fetchMemberCapsBatch: async (ids) => Object.fromEntries(ids.map((id) => [id, caps])),
      hasSession: async () => state.session,
      myId: () => 'me', myName: () => 'Alice', myPubB64: () => 'mePub', dbg: () => {},
    });
    return { ui, state };
  }
  const contact = () => ({ id: 'bobbobbobbob', pubB64: 'bobbobbobbobPUB' });

  it('does not encrypt or send while there is no session with the contact', async () => {
    const { ui, state } = harness({ session: false });
    expect(await ui.sendTo(contact())).toBe(false);
    expect(state.encrypts).toBe(0);
    expect(state.sends).toHaveLength(0);
  });

  it('sends once the session exists, flagged isProfile, and records the delivered version', async () => {
    const { ui, state } = harness({ session: false });
    const c = contact();
    state.contacts.set(c.id, { ...c });
    await ui.sendTo(c);
    state.session = true; // the first chat message has opened it
    expect(await ui.sendTo(c)).toBe(true);
    expect(state.sends).toHaveLength(1);
    expect(state.sends[0].isProfile).toBe(true);
    expect(c.profileSentPv).toBe(7);
    expect(state.contacts.get(c.id).profileSentPv).toBe(7);
  });

  it('is a no-op for a version the contact already has — in memory and after a reload', async () => {
    const { ui, state } = harness({ session: true });
    const c = contact();
    expect(await ui.sendTo(c)).toBe(true);
    expect(await ui.sendTo(contact())).toBe(false); // fresh object, same page load
    const reloaded = harness({ session: true });
    expect(await reloaded.ui.sendTo({ ...contact(), profileSentPv: 7 })).toBe(false); // marker from the stored record
    expect(state.sends).toHaveLength(1);
    expect(reloaded.state.sends).toHaveLength(0);
  });

  it('a newer profile version is delivered again', async () => {
    const saved = { name: 'Alice', emoji: '', img: '', pv: 7 };
    const { ui, state } = harness({ session: true, saved });
    const c = contact();
    await ui.sendTo(c);
    saved.pv = 8;
    expect(await ui.sendTo(c)).toBe(true);
    expect(state.sends).toHaveLength(2);
  });

  it('pv=0 uses the same default version (1) on both wire payload and delivery marker, never sending twice', async () => {
    const { ui, state } = harness({ session: true, saved: null });
    const c = contact();
    state.contacts.set(c.id, { ...c });
    // Concurrent calls for the same contact must not race past the marker check.
    const [r1, r2] = await Promise.all([ui.sendTo(c), ui.sendTo(c)]);
    expect([r1, r2]).toEqual([true, false]);
    expect(state.sends).toHaveLength(1);
    const wire = state.sends[0].payload.replace(/^enc:/, '');
    const parsed = parseProfilePayload(wire);
    expect(parsed.pv).toBe(1);
    expect(c.profileSentPv).toBe(1);
    expect(state.contacts.get(c.id).profileSentPv).toBe(1);
    // Subsequent call after reload with stored profileSentPv=1 is a no-op.
    const reloaded = harness({ session: true, saved: null });
    expect(await reloaded.ui.sendTo({ ...contact(), profileSentPv: 1 })).toBe(false);
    expect(reloaded.state.sends).toHaveLength(0);
  });

  it('wiring: the host supplies hasSession, retries after a chat send, and still ratchets a greeting from an unknown sender', () => {
    expect(html).toContain('hasSession: (id) => getSession(id).then(s => !!s),');
    expect(html).toContain("_profileUI?.sendTo(activeContact).catch(e => _dbg(e, 'profile-first'));");
    // The isProfile branch must reach decryptFrom without a stored contact.
    const branch = html.slice(html.indexOf('if (msg.isProfile) {'), html.indexOf('P.profileNewer(prof, c)'));
    expect(branch).toContain("msg.fromPub.slice(0, 12) === msg.from ? msg.fromPub : ''");
    expect(branch).toContain('const decrypted = pub ? await decryptFrom(msg.payload, pub) : null;');
    expect(branch).not.toMatch(/if \(!c\) return;\s*const decrypted/);
  });
});

describe('profile panel shows my ID (owner request)', () => {
  const src = readFileSync(new URL('../src/app/profile.js', import.meta.url), 'utf8');
  it('renders a read-only ID row bound to myPubB64 with a copy button', () => {
    expect(src).toContain("D.t('profileIdLabel')");
    expect(src).toContain('class="pf-id i-input-full" readonly');
    expect(src).toContain('D.myPubB64()');
    expect(src).toContain('pf-copy-id');
    expect(src).toContain('navigator.clipboard.writeText(D.myPubB64())');
  });
  it('the copy action writes only to the clipboard (no store writes)', () => {
    const panel = src.slice(src.indexOf('pf-copy-id'));
    const handler = panel.slice(0, panel.indexOf('const fileInput'));
    expect(handler).toContain('clipboard.writeText');
    expect(handler).not.toContain('dbPut');
  });
});
