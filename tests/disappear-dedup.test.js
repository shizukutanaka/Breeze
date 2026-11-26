import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Expired disappearing messages must be swept by exactly one periodic timer. For a
// while a 30s duplicate shadowed the canonical 10s sweep, doubling full-store scans
// and making deletion timing depend on which timer happened to fire first. The sweep
// is now a self-rescheduling timeout chain so it can honour the power-mode floor.
function cleanupBlock() {
  const start = html.indexOf('  // Disappearing message cleanup: run every 10s');
  const end = html.indexOf('\n\n  // GROUP CHAT', start);
  if (start < 0 || end < 0) throw Error('disappearing cleanup markers moved');
  return html.slice(start, end);
}
const sweepLines = () => [...html.matchAll(/if \(m\.disappearAt && m\.disappearAt < now\) store\.delete\(m\.msgId\);/g)];

describe('disappearing-message cleanup deduplication', () => {
  it('has exactly one periodic disappearAt expiry sweep', () => {
    expect(sweepLines()).toHaveLength(1);
    expect(cleanupBlock()).toContain('if (m.disappearAt && m.disappearAt < now) store.delete(m.msgId);');
  });

  it('keeps the surviving sweep power-aware and registered with CONFIG.DISAPPEAR_CHECK_MS', () => {
    const block = cleanupBlock();
    expect(block).toContain('CONFIG.DISAPPEAR_CHECK_MS');
    expect(block).toContain('_disappearCleanupTimer = setTimeout(');
    expect(block).not.toContain('_intervals.push(setInterval(');
  });

  it('removes the duplicate cleanup debug tag', () => {
    expect(html.includes('disappear-cleanup')).toBe(false);
  });
});
