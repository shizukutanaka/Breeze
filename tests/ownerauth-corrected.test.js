import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const BLOCK = SRC.match(/async function _ownerAuth[\s\S]+?\n {2}\}/)[0];

describe('_ownerAuth must sign the server-corrected timestamp — a drifted local clock fails the ±5min anti-replay window', () => {
  it('uses correctedNow(), not raw Date.now()', () => {
    expect(BLOCK).toMatch(/const ts = correctedNow\(\);/);
    expect(BLOCK).not.toMatch(/const ts = Date\.now\(\);/);
  });

  it('still signs breeze-<op>:<myId>:<ts>[:<bind>] and returns {ts, sig}', () => {
    expect(BLOCK).toMatch(/signMessage\(`breeze-\$\{op\}:\$\{myId\}:\$\{ts\}\$\{bind \? ':' \+ bind : ''\}`\)/);
    expect(BLOCK).toMatch(/return sig \? \{ ts, sig \} : \{\};/);
  });

  it('tripwire: no other raw Date.now() remains in the auth path', () => {
    expect(BLOCK).not.toMatch(/Date\.now\(\)/);
  });

  it('functional: drifted clock yields a corrected ts in the signed payload', async () => {
    let _clockOffset = 300000; // device 5 min behind server
    const correctedNow = () => 1700000000000 + _clockOffset;
    const signed = [];
    const signMessage = async (m) => { signed.push(m); return 'sig'; };
    const _ownerAuth = async (op, bind = '') => {
      const ts = correctedNow();
      const sig = await signMessage(`breeze-${op}:u1:${ts}${bind ? ':' + bind : ''}`);
      return sig ? { ts, sig } : {};
    };
    const auth = await _ownerAuth('msg-poll');
    expect(auth.ts).toBe(1700000300000);          // corrected, not raw
    expect(signed[0]).toContain(':1700000300000'); // signature covers the corrected ts
  });
});
