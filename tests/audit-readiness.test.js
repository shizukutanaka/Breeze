// SHARE_PLAN stage 7 step 2 — audit readiness stays real.
// docs/AUDIT.md promises an external reviewer that the whole
// crypto picture can be reconstructed from the repo: every
// src/crypto module is on its map, the vectors it names exist,
// and the spec covers call signalling. If a module is added or
// a vector renamed and the map is not updated, this fails.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const audit = read('docs/AUDIT.md');
const spec = read('docs/CRYPTO-SPEC.md');

describe('audit readiness', () => {
  it('every src/crypto module appears on the AUDIT.md map', () => {
    for (const f of readdirSync(join(root, 'src/crypto')).filter((x) => x.endsWith('.js'))) {
      expect(audit, `AUDIT.md does not mention ${f}`).toContain(f);
    }
  });

  it('every vector the map names exists and parses', () => {
    for (const f of ['session-kat.json', 'mlkem768-acvp.json', 'rendezvous-codes.json']) {
      const p = join(root, 'tests/vectors', f);
      expect(existsSync(p), `${f} missing`).toBe(true);
      expect(() => JSON.parse(readFileSync(p, 'utf8'))).not.toThrow();
      expect(audit).toContain(f);
    }
  });

  it('the spec covers call signalling and points at the audit map', () => {
    expect(spec).toContain('## 6c. Call signalling');
    expect(spec).toContain('docs/AUDIT.md');
    expect(audit).toContain('Security Advisories');
  });
});
