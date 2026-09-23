import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const CLEANUP = SRC.match(/_messengerCleanup = \(\) => \{[\s\S]+?\n    \};/)[0];

describe('recording AudioContext release on account switch', () => {
  it('cleanup closes and nulls _recAC inside _messengerCleanup', () => {
    expect(CLEANUP).toContain('_recAC?.close()');
    expect(CLEANUP).toContain('_recAC = null;');
    // positioned after the MediaRecorder teardown it depends on
    expect(CLEANUP.indexOf('_mediaRecorder.stop()')).toBeLessThan(CLEANUP.indexOf('_recAC?.close()'));
  });
  it('recording handler assigns the hoisted _recAC (no local shadow)', () => {
    expect(SRC).toContain('let _recAC = null; // recording AudioContext');
    expect(SRC).toContain('_recAC = new (window.AudioContext || window.webkitAudioContext)();');
    // no leftover local `_audioCtx` binding inside the click handler block
    const handler = SRC.match(/voiceBtn\.addEventListener\('click'[\s\S]+?\n    \}\);/)[0];
    expect(handler).not.toContain('let _audioCtx');
    expect(handler).not.toContain('_audioCtx.');
  });
  it('onstop still closes the context on the normal path', () => {
    const onstop = SRC.match(/_mediaRecorder\.onstop = async \(\) => \{[\s\S]+?_analyser = null;/)[0];
    expect(onstop).toContain('_recAC.close()');
    expect(onstop).toContain('_recAC = null');
  });
  it('no dangling _audioCtx references remain anywhere', () => {
    // the only _audioCtx left in the file is the top-level singleton getter _audioCtx()
    const leftover = SRC.match(/_audioCtx\b(?!\()/g) || [];
    expect(leftover.length).toBe(0);
  });
  it('functional: close statement releases a stub context', () => {
    const close = new Function('_recAC', '_dbg', "try { _recAC?.close(); } catch(e) { _dbg(e); } _recAC = null;");
    const ac = { closed: false, close() { this.closed = true; } };
    close(ac, () => {});
    expect(ac.closed).toBe(true);
    expect(() => close(null, () => {})).not.toThrow();
    const errs = [];
    expect(() => close({ close() { throw new Error('x'); } }, e => errs.push(e))).not.toThrow();
    expect(errs.length).toBe(1);
  });
});
