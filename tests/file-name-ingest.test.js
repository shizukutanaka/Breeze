// File-sourced name ingest must flow through _safeDisplayName like every other
// ingest point (addContact, /contacts import, group_invite — #139/#149 family):
// a crafted backup JSON or LINE/WhatsApp export file can carry bidi direction
// controls and invisible format chars in its name fields, planting invisible-twin
// names into the contacts/messages stores that render everywhere and evade all
// render-time defenses (esc() deliberately keeps ZWSP/ZWJ for legit text).
// This test audits BOTH ingest sites against the REAL _safeDisplayName extracted
// from index.html.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

// Extract the real _safeDisplayName + its regex.
const m = html.match(/const _UNSAFE_DISPLAY_RE = (\/.+\/gu);[\s\S]*?const _safeDisplayName = \(s, n = 64\) => ([^;]+);/);
if (!m) throw new Error('sanitizer not found');
const _UNSAFE_DISPLAY_RE = new Function('return ' + m[1])();
const _safeDisplayName = (s, n = 64) =>
  typeof s === 'string' ? s.replace(_UNSAFE_DISPLAY_RE, '').slice(0, n) : '';

describe('file-sourced name ingest → _safeDisplayName', () => {
  it('wire-site: backup-restore contact name is sanitized (file + cloud share _restoreContacts)', () => {
    expect(html).toContain("name: _safeDisplayName(c.name, 64) || (c.isGroup ? 'Group' : 'Contact')");
    expect(html.match(/await _restoreContacts\(data\.contacts\)/g) || []).toHaveLength(2);
  });

  it('wire-site: importChat senderName is sanitized', () => {
    expect(html).toContain('senderName: isMine ? myName : _safeDisplayName(m.sender, 64)');
  });

  it('wire-site: no name ingest stores a bare .slice(0,64) anywhere', () => {
    // Every stored name field must route through the sanitizer; a raw slice would
    // let invisible/bidi chars reach the contacts/messages stores unfiltered.
    const leftovers = html.match(/name:\s*typeof [^=]*=== 'string' \? [^:]*\.slice\(0, ?64\)|senderName:[^\n]*\.slice\(0, ?64\)/g) || [];
    expect(leftovers).toEqual([]);
  });

  it('semantics: bidi controls + invisible chars are stripped (TR39)', () => {
    const evil = 'Al\u202Eic\u2066e\u200B'; // RLO + LRI + ZWSP
    expect(_safeDisplayName(evil, 64)).toBe('Alice');
    expect(_safeDisplayName('Team\u200BAlpha', 64)).toBe('TeamAlpha'); // ZWSP twin
    expect(_safeDisplayName('Ann\u00ADa', 64)).toBe('Anna');            // SHY
  });

  it('semantics: non-string input returns empty (callers supply fallback)', () => {
    for (const bad of [undefined, null, 42, {}, []]) {
      expect(_safeDisplayName(bad, 64)).toBe('');
    }
  });
});
