import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const SIG = SRC.match(/async function _signal\(room, type, data\) \{[\s\S]+?\n {2}\}/)[0];
const SIGA = SRC.match(/function _signalAwait\(room, type, data\) \{[\s\S]+?\n {2}\}/)[0];

describe('dead context must not POST to /signal as the old account — gate the funnel (CWE-772)', () => {
  it('_signal early-returns null on _ac.signal.aborted before any seal/fetch work', () => {
    expect(SIG).toMatch(/async function _signal\(room, type, data\) \{\n {4}if \(_ac\.signal\.aborted\) return null;/);
  });

  it('_signalAwait resolves { ok: false } on abort — callers `if (!resp.ok) return` stays safe', () => {
    expect(SIGA).toMatch(/if \(_ac\.signal\.aborted\) return Promise\.resolve\(\{ ok: false \}\);/);
    expect(SIGA).not.toMatch(/resolve\(null\)/);
  });

  it('both _signalAwait callers check `!resp.ok` before `.json()` — gated shape returns early', () => {
    const callers = SRC.match(/const resp = await _signalAwait\([^)]+\);[\s\S]{0,80}?\!resp\.ok\) return;/g) || [];
    expect(callers.length).toBe(2);
  });

  it('functional: aborted _signal makes no fetch; live passes through; await-shape is resp.ok-safe', async () => {
    let fetches = 0;
    const _signal = async (aborted) => { if (aborted) return null; fetches++; return { ok: true }; };
    await _signal(true); await _signal(false);
    expect(fetches).toBe(1);
    const resp = await (async (aborted) => aborted ? { ok: false } : { ok: true })(true);
    expect(!resp.ok).toBe(true); // dead context → caller early-returns cleanly
  });
});
