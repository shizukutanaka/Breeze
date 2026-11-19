// SHARE_PLAN stage 5 step 4 — profile distribution logic + wiring.
// The completion conditions: the server never sees a plaintext
// display name or avatar (bundle/relay audit), and un-upgraded peers
// don't break (capability-gated sending).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CAPS_PROFILE, sanitizeProfile, sanitizeProfileImg,
  buildProfilePayload, parseProfilePayload, profileNewer,
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
