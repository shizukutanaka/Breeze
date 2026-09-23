import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const BLOCK = SRC.match(/async function restoreCloudBackup[\s\S]+?\n {2}\}/)[0];

describe('restoreCloudBackup contact ingest parity with restoreBackup (TR39 / CWE-20)', () => {
  it('validates pubB64 with _isValidPubB64 (decoded 32/65-byte shape), not charset only', () => {
    expect(BLOCK).toContain('_isValidPubB64(c.pubB64)');
    expect(BLOCK).not.toMatch(/\^A-Za-z0-9/); // charset-only regex must not remain in this loop
  });

  it('sanitizes restored contact names via _safeDisplayName', () => {
    expect(BLOCK).toContain('_safeDisplayName(c.name, 64)');
    expect(BLOCK).not.toMatch(/dbPut\('contacts', c\)/); // raw store must not remain
  });

  it('bounds group members via safeMemberList', () => {
    expect(BLOCK).toContain('safeMemberList(c.members)');
  });

  it('functional: charset-only check accepts wrong-length keys that _isValidPubB64 rejects', () => {
    const charsetOnly = (s) => /^[A-Za-z0-9+/=]+$/.test(s);
    const isValidPub = (s) => { try { const n = atob(s).length; return n === 32 || n === 65; } catch { return false; } };
    const wrongLen = Buffer.from('short').toString('base64'); // 5 decoded bytes — charset passes
    expect(charsetOnly(wrongLen)).toBe(true);
    expect(isValidPub(wrongLen)).toBe(false);
    const good = Buffer.alloc(32, 7).toString('base64');
    expect(isValidPub(good)).toBe(true);
  });
});
