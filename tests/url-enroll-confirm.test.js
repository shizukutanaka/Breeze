import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// URL-driven enrollment must ask first: ?add= and ?join= are attacker-sendable
// links — ?add= plants an unverified contact under a sender-chosen name, ?join=
// publishes id/pub/name to the roster. Both paths (boot + setup-completion) now
// gate on _confirmAddLink/_confirmJoin. These pins catch a regression that drops
// the confirm on either path.
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const ja = JSON.parse(readFileSync(join(__dirname, '..', 'locales', 'ja.json'), 'utf8'));

describe('url-enrollment gates', () => {
  it('both confirm helpers exist', () => {
    expect(html).toContain('async function _confirmJoin(token)');
    expect(html).toContain('async function _confirmAddLink(addKey)');
  });
  it('every ?add= call site goes through _confirmAddLink', () => {
    // Find each `addKey && addKey !== myPubB64` gate — the URL-param ingest sites.
    const sites = html.match(/addKey && addKey !== myPubB64[^\n]*/g) || [];
    expect(sites.length).toBeGreaterThanOrEqual(2); // boot + setup-completion
    for (const s of sites) expect(s).toContain('_confirmAddLink(addKey)');
    // And no bare `if (addKey` remains without the confirm.
    expect(html).not.toMatch(/if \(addKey && addKey !== myPubB64\)\s*\{/);
  });
  it('every processJoinToken call is preceded by _confirmJoin', () => {
    const joins = html.match(/[^\n]*processJoinToken\(joinToken\)[^\n]*/g) || [];
    for (const j of joins) expect(j).toContain('_confirmJoin(joinToken)');
  });
  it('_confirmAddLink warns the name is claimed, not verified', () => {
    const fn = html.match(/async function _confirmAddLink\(addKey\) \{[^\n]+\}/)?.[0];
    expect(fn).toContain('addLinkWarn');
    expect(fn).toContain('addLinkBtn');
    expect(fn).toContain('addLink');
  });
  it('_confirmJoin mirrors the original group-info fetch + confirm', () => {
    const fn = html.match(/async function _confirmJoin\(token\) \{[^\n]+\}/)?.[0];
    expect(fn).toContain("/group/info");
    expect(fn).toContain('joinShareInfo');
    expect(fn).toContain('joinBtn');
  });
});

describe('url-enrollment i18n', () => {
  it('EN keys present in _I', () => {
    for (const k of ['addLink', 'addLinkWarn', 'addLinkBtn']) {
      expect(html).toContain(`${k}:`);
    }
  });
  it('JA keys present in locales/ja.json', () => {
    for (const k of ['addLink', 'addLinkWarn', 'addLinkBtn']) {
      expect(ja[k], `missing ja.${k}`).toBeTruthy();
    }
  });
  it('no other locale file required — EN fallback covers them', () => {
    // _I lookup falls back to _I.en for missing keys; only ja must be complete.
    expect(html).toContain('_I[LANG]?.[key] ?? _I.en?.[key] ?? key');
  });
});
