// Wave-7 defect fixes (2026-11-21 ledger D16, stage 1) — wiring pins.
//
// The client halves of these fixes live inside index.html's monolith
// closure, which no harness executes whole; following the repo's
// wiring-pin convention (wave1-defects / wave6-defects), these tests pin
// the exact source shapes the fixes rely on, so a refactor that silently
// drops one fails here instead of in production. The worker half of D16
// is behaviour-tested in tests/worker.test.js (the D16 race tests).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const infoPanels = readFileSync(new URL('../src/app/info-panels.js', import.meta.url), 'utf8');
const LOCALES = ['es', 'id', 'ja', 'ko', 'pt-BR', 'th', 'zh-TW'];

describe('D16 — sealed-queue recovery count is accumulated and surfaced in /security', () => {
  it('the sealed poll handler accumulates the relay-reported recovery count', () => {
    expect(html).toContain("if (Number.isInteger(sData.recovered) && sData.recovered > 0) _diagBump('sealedRecovered', sData.recovered);");
  });

  it('_diagBump accepts an amount (existing one-arg callers still add 1)', () => {
    expect(html).toContain('function _diagBump(field, n) {');
    expect(html).toContain("(Number.isFinite(n) && n > 0 ? Math.floor(n) : 1)");
  });

  it('/security renders the sealed-recovery counter with its label', () => {
    expect(infoPanels).toContain("D.t('secDiagSealed') + ': ' + (_diagPersist.sealedRecovered || 0),");
    expect(html).toContain("secDiagSealed: 'Sealed-queue write races the relay repaired (nothing lost)',");
  });

  it('every locale carries the secDiagSealed label', () => {
    for (const loc of LOCALES) {
      const json = readFileSync(new URL(`../locales/${loc}.json`, import.meta.url), 'utf8');
      expect(json, loc).toContain('"secDiagSealed"');
    }
  });
});
