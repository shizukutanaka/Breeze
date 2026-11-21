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

describe('R08 — a missing data-lifecycle bridge is reported, and the wipe check retries', () => {
  it('absence goes through _dlMiss: _dbg plus a once-per-boot diagnostics bump', () => {
    expect(html).toContain("const _dlMiss = (name) => { _dbg(null, 'data-lifecycle bridge missing: ' + name + ' skipped'); if (!_dlState.bumped) { _dlState.bumped = true; _diagBump('dataLifecycleBridgeMissing'); } };");
    expect(html).toContain("if (!b) { _dlMiss('enforceRetentionPolicy'); return; }");
    expect(html).toContain("if (!b) { _dlMiss('cleanupOldMessages'); return; }");
    // The old silent-delegation shapes are gone.
    expect(html).not.toContain('async function enforceRetentionPolicy() { return _dataLifecycle()?.enforceRetentionPolicy(); }');
    expect(html).not.toContain('async function cleanupOldMessages() { return _dataLifecycle()?.cleanupOldMessages(); }');
  });

  it('the wipe check retries a bounded number of times while the bridge is missing', () => {
    expect(html).toContain("if (b) return b.checkRemoteWipe(); _dlMiss('checkRemoteWipe'); if (++_dlState.wipeRetries <= 6) setTimeout(() => { checkRemoteWipe().catch(e => _dbg(e, 'wipe-retry')); }, 5 * MS.SEC);");
    expect(html).not.toContain('async function checkRemoteWipe() { return _dataLifecycle()?.checkRemoteWipe(); }');
  });

  it('/security surfaces the outage count via secDiagLifecycle (all locales)', () => {
    expect(infoPanels).toContain("D.t('secDiagLifecycle')");
    expect(infoPanels).toContain('_diagPersist.dataLifecycleBridgeMissing');
    expect(html).toContain('secDiagLifecycle:');
    for (const loc of LOCALES) {
      const json = JSON.parse(readFileSync(new URL(`../locales/${loc}.json`, import.meta.url), 'utf8'));
      expect(typeof json.secDiagLifecycle, loc).toBe('string');
    }
  });
});

describe('R09 — SPEC.md figures match the shipped code', () => {
  const spec = readFileSync(new URL('../SPEC.md', import.meta.url), 'utf8');

  it('the stale v3.6.0 figures are gone and the current ones are stated', () => {
    expect(spec).not.toContain('Detailed Specification v3.6.0');
    expect(spec).not.toContain('15,191 lines');
    expect(spec).not.toContain('GROUP_MAX: 100\n'); // trailing \n: 'GROUP_MAX: 1000' contains the prefix
    expect(spec).not.toContain('MAX_MSG_LENGTH: 10000');
    expect(spec).not.toContain('PRESENCE_INTERVAL_MS: 10000');
    expect(spec).toContain('GROUP_MAX: 1000');
    expect(spec).toContain('MAX_MSG_LENGTH: 4096');
    expect(spec).toContain('PRESENCE_INTERVAL_MS: 30000');
    // The values above are the ones the code actually ships.
    expect(html).toContain('GROUP_MAX: 1000,');
    expect(html).toContain('MAX_MSG_LENGTH: 4096,');
    expect(html).toContain('PRESENCE_INTERVAL_MS: 30000,');
  });

  it('the platform table no longer presents Tauri as the shipped desktop build', () => {
    expect(spec).not.toContain('Windows (alt) | Electron');
    expect(spec).toContain('Electron (NSIS, ~150MB) — shipped');
    expect(spec).toContain('Tauri — source only, not shipped');
  });
});
