// auditLog() is the single funnel into the IDB 'audit' store. Its `detail` field
// was persisted verbatim — peers and URL params can feed it unbounded strings
// (addContact logs 'Added: ' + name where name is a raw ?add= param), bloating
// the audit store. These guards pin the funnel cap and its semantics by
// extracting the REAL function out of index.html (pattern mirrors
// file-meta-cap.test.js on devin/1790114768-file-meta-cap).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

function loadAuditLog() {
  const start = html.indexOf('async function auditLog');
  const end = html.indexOf('// Prune audit log', start);
  if (start < 0 || end < 0) throw new Error('auditLog not found in index.html');
  const src = html.slice(start, end).trim();
  const db = { objectStoreNames: { contains: () => true } };
  let captured = null;
  const dbPut = async (_store, rec) => { captured = rec; return true; };
  const _dbg = () => {};
  return { auditLog: new Function('db', 'dbPut', '_dbg', 'return ' + src)(db, dbPut, _dbg), get: () => captured };
}

describe('auditLog detail cap (audit-store bloat guard)', () => {
  it('caps an oversized string detail at 512 chars', async () => {
    const { auditLog, get } = loadAuditLog();
    await auditLog('contact', 'x'.repeat(2000));
    expect(get().detail).toHaveLength(512);
  });
  it('passes a short detail through verbatim', async () => {
    const { auditLog, get } = loadAuditLog();
    await auditLog('auth', 'Session started');
    expect(get().detail).toBe('Session started');
  });
  it('a peer/URL-length name is bounded, not persisted raw', async () => {
    const { auditLog, get } = loadAuditLog();
    const name = 'A'.repeat(65536); // ?add= name param shape
    await auditLog('contact', 'Added: ' + name + ' (abc123)');
    expect(get().detail.length).toBeLessThanOrEqual(512);
    expect(get().detail.startsWith('Added: ')).toBe(true);
  });
  it('non-string detail is JSON-stringified then capped', async () => {
    const { auditLog, get } = loadAuditLog();
    await auditLog('settings', { k: 'v'.repeat(2000) });
    expect(get().detail.length).toBeLessThanOrEqual(512);
    expect(get().detail.startsWith('{')).toBe(true);
  });
  it('ts/severity/type fields are preserved', async () => {
    const { auditLog, get } = loadAuditLog();
    await auditLog('security', 'evt', 'critical');
    const rec = get();
    expect(rec.type).toBe('security');
    expect(rec.severity).toBe('critical');
    expect(typeof rec.ts).toBe('number');
  });
});

describe('auditLog wire-site audit', () => {
  it('the funnel applies the cap, not ad-hoc call-site slices', () => {
    expect(html).toContain('detail: String(typeof detail === \'string\' ? detail : JSON.stringify(detail)).slice(0, 512)');
  });
  it('the raw ?add= name reaches the funnel (cap is what protects it)', () => {
    expect(html).toContain("auditLog('contact', 'Added: ' + name + ' (' + id + ')')");
  });
});
