// msg.fromName is a self-claimed wire field: it fed meta.senderName (group + 1:1
// receive paths), group.lastMsgSender, and the mention-notification body RAW, while
// esc() only strips the bidi direction class — the invisible class (ZWSP, SHY, tag
// chars...) survived. A group member could send with fromName "Alice\u200B" and
// their message header + preview + notification read as member "Alice" — the same
// invisible-twin class as the contact-name (#139), invite-name (#149), and
// file-sourced-name (#158) fixes. Every fromName ingest now runs _safeDisplayName.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

// Extract _UNSAFE_DISPLAY_RE + the real _safeDisplayName arrow and evaluate it.
const reM = html.match(/const _UNSAFE_DISPLAY_RE\s*=\s*(\/[^\n]+\/[gimsuy]*);/);
const fnM = html.match(/const _safeDisplayName\s*=\s*(\([^;]+=>[^;]+);/);
if (!reM || !fnM) throw new Error('sanitizer source not found');
const _UNSAFE_DISPLAY_RE = new Function('return ' + reM[1])();
const _safeDisplayName = new Function('_UNSAFE_DISPLAY_RE', 'return ' + fnM[1])(_UNSAFE_DISPLAY_RE);

const ZWSP = '\u200B', SHY = '\u00AD', RLO = '\u202E';

describe('fromName wire ingest is sanitized at every site', () => {
  it('wire-site: group meta.senderName uses _safeDisplayName', () => {
    expect(html).toContain('const senderName = _safeDisplayName(msg.fromName, 64)');
  });

  it('wire-site: 1:1 meta.senderName uses _safeDisplayName', () => {
    expect(html).toContain('senderName: _safeDisplayName(msg.fromName, 64)');
  });

  it('wire-site: lastMsgSender + notification use the sanitized value', () => {
    expect(html).toContain('group.lastMsgSender = senderName;');
    expect(html).toContain('`@${senderName || \'?\'}: ${text.slice(0, 80)}`');
  });

  it('no remaining raw msg.fromName ingest into a display field', () => {
    const raw = html.match(/senderName:\s*msg\.fromName|lastMsgSender\s*=\s*msg\.fromName|@\$\{msg\.fromName\}/g);
    expect(raw).toBeNull();
  });
});

describe('real _safeDisplayName semantics on wire names', () => {
  it('strips invisible chars that form name twins', () => {
    expect(_safeDisplayName('Alice' + ZWSP, 64)).toBe('Alice');
    expect(_safeDisplayName('Ali' + SHY + 'ce', 64)).toBe('Alice');
    expect(_safeDisplayName('Bo' + ZWSP + 'b', 64)).toBe('Bob');
  });

  it('strips bidi direction controls (overlay header spoof)', () => {
    expect(_safeDisplayName('A' + RLO + 'B', 64)).toBe('AB');
  });

  it('preserves legitimate names incl. emoji/ZWJ', () => {
    expect(_safeDisplayName('Alice \u{1F389}', 64)).toBe('Alice \u{1F389}');
    expect(_safeDisplayName('\u7530\u4E2D \u592A\u90CE', 64)).toBe('\u7530\u4E2D \u592A\u90CE');
  });

  it('non-string wire input → empty string (header suppressed, not raw)', () => {
    expect(_safeDisplayName(undefined, 64)).toBe('');
    expect(_safeDisplayName(null, 64)).toBe('');
    expect(_safeDisplayName(42, 64)).toBe('');
  });

  it('caps at 64 chars', () => {
    expect(_safeDisplayName('A'.repeat(200), 64)).toBe('A'.repeat(64));
  });
});
