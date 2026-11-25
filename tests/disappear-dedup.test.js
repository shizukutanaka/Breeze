import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Expired disappearing messages must be swept by exactly one periodic timer. For a
// while a 30s duplicate shadowed the canonical 10s sweep, doubling full-store scans
// and making deletion timing depend on which timer happened to fire first.
function intervalBlocks() {
  return [...html.matchAll(/_intervals\.push\(setInterval\(async \(\) => \{[\s\S]*?\n  \}, [^\n]+\)\);/g)]
    .map((m) => m[0]);
}
const expirySweeps = intervalBlocks().filter((block) =>
  block.includes('.disappearAt') && block.includes('disappearAt < now'));

describe('disappearing-message cleanup deduplication', () => {
  it('has exactly one periodic disappearAt expiry sweep', () => {
    expect(expirySweeps).toHaveLength(1);
  });

  it('keeps the surviving sweep registered with CONFIG.DISAPPEAR_CHECK_MS', () => {
    expect(expirySweeps.some((block) => block.includes('}, CONFIG.DISAPPEAR_CHECK_MS));'))).toBe(true);
  });

  it('removes the duplicate cleanup debug tag', () => {
    expect(html.includes('disappear-cleanup')).toBe(false);
  });
});
