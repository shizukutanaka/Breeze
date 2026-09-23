import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// The FULL teardown is the guarded registration; the minimal mid-init cleanup at the head of
// initMessenger is intentionally separate and must not be the block extracted here.
const CLEANUP = SRC.match(/if \(!_ac\.signal\.aborted\) _messengerCleanup = \(\) => \{[\s\S]+?\n    \};/)[0];

describe('speech-recognition lifecycle on account switch', () => {
  it('recognizer is hoisted to initMessenger scope and assigned at creation', () => {
    expect(SRC).toContain('let _sttActive = false, _sttRec = null;');
    expect(SRC).toContain('const recognition = _sttRec = new SpeechRecognition();');
  });
  it('cleanup aborts and nulls _sttRec inside _messengerCleanup', () => {
    expect(CLEANUP).toContain('_sttRec?.abort()');
    expect(CLEANUP).toContain('_sttRec = null;');
    expect(CLEANUP.indexOf('_fileChunks')).toBeLessThan(CLEANUP.indexOf('_sttRec?.abort()'));
  });
  it('exactly one abort site; all recognition handlers still wired via the local alias', () => {
    expect(SRC.match(/_sttRec\?\.abort\(\)/g).length).toBe(1);
    expect(SRC).toContain('recognition.onresult');
    expect(SRC).toContain('recognition.onend');
    expect(SRC).toContain('recognition.onerror');
    expect(SRC).toContain('recognition.start()');
  });
  it('functional: abort statement stops a stub recognizer', () => {
    const abort = new Function('_sttRec', '_dbg', "try { _sttRec?.abort(); } catch(e) { _dbg(e); } _sttRec = null;");
    const rec = { aborted: false, abort() { this.aborted = true; } };
    abort(rec, () => {});
    expect(rec.aborted).toBe(true);
    expect(() => abort(null, () => {})).not.toThrow();
    const errs = [];
    expect(() => abort({ abort() { throw new Error('boom'); } }, e => errs.push(e))).not.toThrow();
    expect(errs[0].message).toBe('boom');
  });
});
