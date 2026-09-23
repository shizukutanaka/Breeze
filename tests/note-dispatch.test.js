// tests/note-dispatch.test.js — Breeze deep-behavior test: /note must dispatch to
// exactly ONE handler. v3.3 added the no-arg '/note' viewer
// (`val === '/note' || startsWith('/note ')`) which fully subsumed the older
// `/note <text>` setter block that was never removed — so '/note hi' fired BOTH:
// two dbPut writes + two stacked toasts, and '/note clear' briefly stored the
// literal string 'clear' before the second handler overwrote it. One handler now
// covers show / set / 'clear'; the name-bearing toastNoteSavedFor key stays live
// (removing it would orphan the key in EN + 7 locale files).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('/note single dispatch', () => {
  it('exactly one /note handler block remains', () => {
    expect((SRC.match(/if \(val === '\/note' \|\| val\.startsWith\('\/note '\)\)/g) || []).length).toBe(1);
    expect((SRC.match(/if \(val\.startsWith\('\/note '\)\)/g) || []).length).toBe(0); // no orphan /note <text> setter
  });
  it('the survivor handles show / set / clear paths', () => {
    expect(SRC).toContain("arg === 'clear' ? '' : arg.slice(0, 1024)"); // set + clear
    expect(SRC).toContain("activeContact.notes ? t('noteLabel')");      // show
  });
  it('set path uses the name-bearing toast (keeps toastNoteSavedFor live)', () => {
    expect(SRC).toContain("t('toastNoteSavedFor', activeContact.name)");
    expect(SRC).not.toContain('toastNoteActionOff');
  });
});
