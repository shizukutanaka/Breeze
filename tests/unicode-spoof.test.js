// Display-name spoofing defense (Unicode TR36 §2 / TR39, "Trojan Source" class):
// direction controls reorder rendered text, invisible format chars pad a name
// into a visually-identical impostor. Identifiers arrive over channels the
// relay never sees (P2P envelopes, ?name= params, local edits), so the strip
// must exist in BOTH _worker.js (relay-stored metadata) and index.html
// (ingest-time _safeDisplayName). These tests pin behavior and the parity of
// the two character-class copies — the mirror-drift pattern for a non-crypto
// helper.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sanitizeString } from '../_worker.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const workerSrc = readFileSync(join(HERE, '..', '_worker.js'), 'utf8');

const RLO = '\u202E';   // RIGHT-TO-LEFT OVERRIDE
const LRO = '\u202D';   // LEFT-TO-RIGHT OVERRIDE
const RLI = '\u2067';   // RIGHT-TO-LEFT ISOLATE
const PDI = '\u2069';   // POP DIRECTIONAL ISOLATE
const ALM = '\u061C';   // ARABIC LETTER MARK
const LRM = '\u200E';   // LEFT-TO-RIGHT MARK
const ZWSP = '\u200B';
const SHY = '\u00AD';   // SOFT HYPHEN
const WJ = '\u2060';    // WORD JOINER
const BOM = '\uFEFF';
const MVS = '\u180E';   // MONGOLIAN VOWEL SEPARATOR
const HANGUL_FILLER = '\u115F';
const BRAILLE_BLANK = '\u2800';
const TAG_A = '\u{E0061}';  // TAG LATIN SMALL LETTER A
const MUSIC_INVIS = '\u{1D173}';
const ZWJ = '\u200D';    // kept: emoji sequences
const ZWNJ = '\u200C';   // kept: Indic/Arabic-script names
const VS16 = '\uFE0F';   // kept: emoji presentation selector

describe('worker sanitizeString — spoofing class', () => {
  it('strips direction overrides/isolates/marks', () => {
    expect(sanitizeString(`Al${RLO}ecil${PDI}ce`)).toBe('Alecilce');
    expect(sanitizeString(`${LRO}x${RLI}y${ALM}z${LRM}`)).toBe('xyz');
  });
  it('strips invisible format chars', () => {
    expect(sanitizeString(`a${ZWSP}b${SHY}c${WJ}d${BOM}e${MVS}`)).toBe('abcde');
    expect(sanitizeString(`q${HANGUL_FILLER}w${BRAILLE_BLANK}e${TAG_A}r${MUSIC_INVIS}`)).toBe('qwer');
  });
  it('keeps ZWJ/ZWNJ/variation selectors and combining marks', () => {
    const fam = `👨${ZWJ}👩${ZWJ}👧`;           // family emoji sequence
    expect(sanitizeString(fam)).toBe(fam);
    const arabic = 'اخت' + ZWNJ + 'بار';
    expect(sanitizeString(arabic)).toBe(arabic);
    const heart = '❤' + VS16;
    expect(sanitizeString(heart)).toBe(heart);
    expect(sanitizeString('na\u0308me')).toBe('na\u0308me');
  });
  it('spoofed impostor names collapse to the plain text they fake', () => {
    // "<RLO>tseilA" renders as "Alice" when the RLO is honored
    expect(sanitizeString(`${RLO}tseilA`)).toBe('tseilA');
    // invisible padding that made "Alice " distinct-but-identical-looking
    expect(sanitizeString(`Alice${ZWSP}${ZWSP}`)).toBe('Alice');
  });
  it('still strips C0 controls and caps length', () => {
    expect(sanitizeString('a\x0Bb\x0Dc')).toBe('abc');
    expect(sanitizeString('x'.repeat(300), 10)).toBe('x'.repeat(10));
  });
  it('non-strings stay empty', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
    expect(sanitizeString(42)).toBe('');
  });
});

describe('client _safeDisplayName — inline parity', () => {
  const helper = (() => {
    // Extract the real inline definitions (sw.test.js pattern) rather than
    // re-testing a copy: a drifted edit fails here, not in production.
    const src = html.match(/const _UNSAFE_DISPLAY_RE = [\s\S]*?_safeDisplayName[^\n]*\n/);
    expect(src, '_safeDisplayName must exist inline in index.html').toBeTruthy();
    return new Function(`${src[0]}; return _safeDisplayName;`)();
  })();

  it('same strips and keeps as the worker copy', () => {
    expect(helper(`Al${RLO}ecil${PDI}ce`)).toBe('Alecilce');
    expect(helper(`a${ZWSP}b${SHY}c${WJ}d${BOM}e${MVS}`)).toBe('abcde');
    expect(helper(`👨${ZWJ}👩${ZWJ}👧`)).toBe(`👨${ZWJ}👩${ZWJ}👧`);
    expect(helper(`${RLO}tseilA`)).toBe('tseilA');
  });
  it('caps length and tolerates non-strings', () => {
    expect(helper('x'.repeat(300), 10)).toBe('x'.repeat(10));
    expect(helper(null)).toBe('');
    expect(helper(undefined)).toBe('');
  });
  it('character class is byte-identical to the worker copy', () => {
    const pull = (s) => s.match(/const _UNSAFE_DISPLAY_RE = (\/[^;]+?\/gu);/)?.[1];
    const clientRe = pull(html);
    const workerRe = pull(workerSrc);
    expect(clientRe).toBeTruthy();
    expect(workerRe).toBeTruthy();
    expect(clientRe).toBe(workerRe);
  });
});

describe('ingest wiring tripwires', () => {
  // Each line was a raw .slice(0,N) before: identifiers entered IDB/display with
  // direction controls intact. A refactor that restores plain slicing re-opens
  // the spoof — these pins fail first.
  it('addContact sanitizes the peer-supplied name', () => {
    expect(html).toContain("_safeDisplayName(name, 64) || 'Contact'");
  });
  it('roster member names are sanitized in safeMemberList', () => {
    expect(html).toContain("_safeDisplayName(m.name, 64) || 'Member'");
  });
  it('group names are sanitized on join + roster poll', () => {
    expect(html).toContain("_safeDisplayName(data.name, 64) || 'Group'");
    expect(html).toContain('group.name = _safeDisplayName(data.name, 50)');
  });
  it('fromName (sender display + lastMsgSender) is normalized at ingest', () => {
    expect(html).toContain('fromName: _safeDisplayName(msg.fromName, 64)');
  });
  it('no raw peer-name slicing survived in the audited sites', () => {
    expect(html).not.toContain('m.name.slice(0, 64)');
    expect(html).not.toContain('data.name.slice(0, 64)');
    expect(html).not.toContain('msg.fromName.slice(0, 64)');
  });
});
