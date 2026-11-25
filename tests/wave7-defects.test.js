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

const location = readFileSync(new URL('../src/app/location.js', import.meta.url), 'utf8');

describe('D25 — secondary devices send to groups via per-device sender keys + registry attribution', () => {
  it('the device role tracks the account root for acctRoot naming', () => {
    expect(html).toContain('let _myAcctRoot = null;');
    expect(html).toContain('_myAcctRoot = acct?.root || null;');
  });

  it('group sends name acctRoot on relay deposits (transport, composer, sender-key distribution)', () => {
    const needle = "...(_isSecondaryDevice && _myAcctRoot ? { acctRoot: _myAcctRoot } : {})";
    expect(html.split(needle).length - 1).toBe(3);
  });

  it('secondaries skip the P2P direct leg for groups (relay-only), in both send paths', () => {
    expect(html.split('for (const m of _isSecondaryDevice ? [] : members)').length - 1).toBe(2);
  });

  it('the composer and sticker paths no longer refuse secondary group sends', () => {
    expect(html).not.toContain("input.value = text; // give the message back rather than eating it");
    expect(html).not.toContain("if (_isSecondaryDevice) { showToast(t('groupPrimaryOnly'), 'error'); return; }");
    expect(location).not.toContain("contact.isGroup && D.isSecondary()");
  });

  it('receivers attribute device senders through the root-signed registry verdict', () => {
    expect(html).toContain('async function _deviceAttributionOk(rootPubB64, devicePub)');
    expect(html).toContain('if (rootMember && await _deviceAttributionOk(msg.acctRoot, msg.fromPub)) { member = rootMember; peerPub = msg.fromPub; }');
    expect(html).toContain("if (rootC?.pubB64 === msg.acctRoot && await _deviceAttributionOk(msg.acctRoot, msg.fromPub)) { c = rootC; peerPub = msg.fromPub; }");
  });

  it('attributed traffic keeps account identity: msgId and reactor use the member id', () => {
    expect(html).toContain('const reactorId = member.id;');
    expect(html).toContain("const msgId = member.id + ':' + msg.ts;");
  });

  it('group calls accept linked-device seats since wave 12; group file sends joined the sender-key transport in wave 9', () => {
    const groupCall = readFileSync(new URL('../src/app/group-call.js', import.meta.url), 'utf8');
    expect(groupCall).not.toContain("if (D.isSecondary()) { showToast(t('groupPrimaryOnly'), 'error'); return; }");
    expect(groupCall).not.toContain('if (D.isSecondary()) return false;');
    expect(groupCall).toContain("t('gcallGenGate')"); // old-generation mixes are refused honestly, not silently
    expect(html).not.toContain("if (activeContact.isGroup && _isSecondaryDevice) { showToast(t('groupPrimaryOnly'), 'error'); return; }");
  });
});
