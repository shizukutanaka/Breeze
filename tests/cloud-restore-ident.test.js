import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const CLOUD = SRC.match(/async function restoreCloudBackup[\s\S]+?\n {2}\}/)[0];
const FILE = SRC.match(/async function restoreBackup[\s\S]+?\n {2}\}/)[0];

describe('restoreCloudBackup identity gate — parity with restoreBackup (account-brick guard)', () => {
  it('requires data.identity.pubB64 before writing the keys store', () => {
    expect(CLOUD).toContain('!data.identity?.pubB64');
    expect(CLOUD).toContain("dbPut('identity', data.identity, 'keys')");
  });

  it('aborts the whole restore with toastInvalidBackup on a missing identity (same as file path)', () => {
    expect(CLOUD).toContain("showToast(t('toastInvalidBackup'), 'error'); return;");
    expect(FILE).toContain('!data.identity?.pubB64');
    expect(FILE).toContain('toastInvalidBackup');
  });

  it('runs the identity check BEFORE any dbPut in the restore body', () => {
    const gateIdx = CLOUD.indexOf('!data.identity?.pubB64');
    const firstPut = CLOUD.indexOf('dbPut(');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(firstPut);
  });

  it('functional: missing/empty identity rejected, pubB64-bearing one passes', () => {
    const usable = (id) => !!id?.pubB64;
    expect(usable(null)).toBe(false);
    expect(usable(undefined)).toBe(false);
    expect(usable({})).toBe(false);
    expect(usable({ name: 'x' })).toBe(false); // truthy record, no key — pre-fix wrote this raw
    expect(usable({ pubB64: 'AAAA' })).toBe(true);
  });
});
