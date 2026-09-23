import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const BLOCK = SRC.match(/\} else if \(contact\.sigPub !== msg\.sigPub\) \{[\s\S]+?\n        \}/);

describe('sigPub key-change warning rate limit (CWE-400)', () => {
  it('gates showKeyChangeWarning behind a ≤1/day/peer check', () => {
    expect(BLOCK).toBeTruthy();
    expect(BLOCK[0]).toContain('!contact.sigWarnedAt || Date.now() - contact.sigWarnedAt > MS.DAY');
    expect(BLOCK[0]).toContain('contact.sigWarnedAt = Date.now()');
    expect(BLOCK[0]).toContain('showKeyChangeWarning');
  });

  it('still marks EVERY mismatched-key message tampered (badge unaffected)', () => {
    expect(BLOCK[0]).toContain('meta.tampered = true');
    // tampered must sit before the warn-once gate so badging is unconditional
    expect(BLOCK[0].indexOf('meta.tampered = true')).toBeLessThan(BLOCK[0].indexOf('contact.sigWarnedAt'));
  });

  it('fires once per day regardless of key-flapping, warns again on later rotations', () => {
    const DAY = 86400000;
    const contact = { sigPub: 'K1' };
    const warns = [], tampered = [];
    let now = 1000;
    const ingest = (k) => {
      let t = false;
      if (!contact.sigPub) contact.sigPub = k;
      else if (contact.sigPub !== k) {
        t = true;
        if (!contact.sigWarnedAt || now - contact.sigWarnedAt > DAY) { contact.sigWarnedAt = now; warns.push(k); }
      }
      tampered.push(t);
    };
    ['K2', 'K3', 'K2', 'K3', 'K2'].forEach(ingest);   // burst: flapping attacker
    now += DAY + 1;                                  // a day later
    ['K4', 'K5'].forEach(ingest);                    // more rotations
    expect(warns).toEqual(['K2', 'K4']);             // 1/day regardless of key count
    expect(tampered.filter(Boolean)).toHaveLength(7);
  });

  it('persists sigWarnedAt via the contact write already following the block', () => {
    const assignIdx = SRC.indexOf('contact.sigWarnedAt = Date.now()');
    expect(assignIdx).toBeGreaterThan(-1);
    expect(SRC.indexOf("await dbPut('contacts', contact)", assignIdx)).toBeGreaterThan(assignIdx);
  });
});
