// Wave-6 defect fixes (2026-11-21 re-audit ledger R01–R09) — wiring pins.
//
// The client halves of these fixes live inside index.html's monolith
// closure, which no harness executes whole; following the repo's
// wiring-pin convention (wave1-defects / share-surface), these tests pin
// the exact source shapes the fixes rely on, so a refactor that silently
// drops one fails here instead of in production.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const infoPanels = readFileSync(new URL('../src/app/info-panels.js', import.meta.url), 'utf8');
const LOCALES = ['es', 'id', 'ja', 'ko', 'pt-BR', 'th', 'zh-TW'];

describe('R02 — msgkey degradation is counted and surfaced, never silent', () => {
  it('every _initMsgStoreKey failure exit bumps msgkeyInitFail', () => {
    const bumps = html.match(/_diagBump\('msgkeyInitFail'\)/g) || [];
    expect(bumps.length).toBe(4); // no-passphrase / unusable record / persist failed / exception
    expect(html).toContain("_dbg(null, 'msgkey: unusable record'); _diagBump('msgkeyInitFail'); return false;");
    expect(html).toContain("_dbg(null, 'msgkey: persist failed'); _diagBump('msgkeyInitFail'); return false;");
    expect(html).toContain("catch(e) { _dbg(e, 'msgkey-init'); _diagBump('msgkeyInitFail'); return false; }");
  });

  it('the misleading "store stays sealed this boot" claim is gone', () => {
    expect(html).not.toContain('store stays sealed this boot');
    expect(html).toContain('NEW writes fall back to plaintext (R02: counted in /security diagnostics)');
  });

  it('a no-key seal pass-through bumps msgPlaintextSave instead of silently returning the plaintext record', () => {
    expect(html).toContain("if (!_msgStoreKey) { _msgDiagBump('msgPlaintextSave'); return rec; }");
    expect(html).toContain("catch(e) { _dbg(e, 'msg-seal'); _msgDiagBump('msgPlaintextSave'); return rec; }");
    // The guard must no longer swallow the no-key case invisibly.
    expect(html).not.toContain("if (!_msgStoreKey || !rec || _msgIsSealed(rec)");
  });

  it('/security surfaces both counters via secDiagMsgStore (all locales)', () => {
    expect(infoPanels).toContain("D.t('secDiagMsgStore')");
    expect(infoPanels).toContain('_diagPersist.msgkeyInitFail');
    expect(infoPanels).toContain('_diagPersist.msgPlaintextSave');
    expect(html).toContain('secDiagMsgStore:');
    for (const loc of LOCALES) {
      const json = JSON.parse(readFileSync(new URL(`../locales/${loc}.json`, import.meta.url), 'utf8'));
      expect(typeof json.secDiagMsgStore, loc).toBe('string');
    }
  });
});
