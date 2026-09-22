import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Group names are display names: every ingest path that lands a name into a
// group/contact record must pass _safeDisplayName (bidi direction controls +
// invisible format chars, TR39). The encrypted group-invite path was the last
// bare .slice() — a contact could name a group "Real Team\u200B" and it would
// plant as an invisible-twin of an existing group. This test pins the fix and
// audits every other wire-name ingest for the same gate.
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

describe('group-name sanitize — invite path', () => {
  it('encrypted group_invite name goes through _safeDisplayName', () => {
    const block = html.match(/const inviteName = [^\n]+/)?.[0];
    expect(block).toContain('_safeDisplayName(invite.name');
    expect(block).not.toMatch(/invite\.name\.slice/);
  });
  it('/group/info name goes through _safeDisplayName', () => {
    expect(html).toContain('group.name = _safeDisplayName(data.name');
  });
  it('member names in rosters go through _safeDisplayName (safeMemberList)', () => {
    const fn = html.match(/function safeMemberList\(raw\) \{[\s\S]+?\n  \}/)?.[0];
    expect(fn).toContain('_safeDisplayName(m.name');
  });
  it('no remaining bare .slice() on wire-supplied name fields', () => {
    // Any `something.name.slice(0, N)` inside invite/signal/data ingest is the
    // class this file audits — assert none survive outside sanitized sites.
    expect(html).not.toMatch(/invite\.name\.slice/);
    expect(html).not.toMatch(/msg\.fromName\.slice/);
    expect(html).not.toMatch(/data\.name\.slice/);
    expect(html).not.toMatch(/m\.name\.slice\(0, 64\)/);
  });
});

describe('_safeDisplayName semantics (extracted from source)', () => {
  const reSrc = html.match(/const _UNSAFE_DISPLAY_RE = (\/\[[^\n]+\]\/gu)/)?.[1];
  const fnSrc = html.match(/const _safeDisplayName = [^\n]+/)?.[0];
  const safe = new Function('re', `${fnSrc.replace('_UNSAFE_DISPLAY_RE', 're')}; return _safeDisplayName;`)(eval(reSrc));

  it('strips invisible format chars (ZWSP, SHY, tag chars)', () => {
    expect(safe('Ali\u200Bce')).toBe('Alice');
    expect(safe('Team\u00ADSupport')).toBe('TeamSupport');
    expect(safe('G\u{E0001}rp')).toBe('Grp');
  });
  it('strips bidi direction controls', () => {
    expect(safe('Na\u202Eme')).toBe('Name');
    expect(safe('X\u2066y\u2069z')).toBe('Xyz');
  });
  it('keeps legitimate complex names (emoji, ZWJ)', () => {
    expect(safe('Fam 👨\u200D👩\u200D👧\u200D👦')).toBe('Fam 👨\u200D👩\u200D👧\u200D👦');
  });
  it('caps length and handles non-strings', () => {
    expect(safe('a'.repeat(100), 64).length).toBe(64);
    expect(safe(null)).toBe('');
    expect(safe(123)).toBe('');
  });
});
