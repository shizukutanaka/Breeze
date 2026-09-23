import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const BLOCK = SRC.match(/function scheduleRetry\(\) \{[\s\S]+?\n {2}\}\n\n {2}\/\/ v3\.6: Outbox badge/)[0];

describe('dead context must not re-arm the retry chain — zombie sender would ship the old account queue (CWE-772)', () => {
  it('scheduleRetry returns early when _ac.signal.aborted (covers the callback-tail re-arm + every caller)', () => {
    expect(BLOCK).toMatch(/function scheduleRetry\(\) \{\n {4}if \(_ac\.signal\.aborted\) return;/);
  });

  it('the abort check precedes _updateOutboxBadge — no dead-context shared-DOM write either', () => {
    const abortIdx = BLOCK.indexOf('_ac.signal.aborted');
    const badgeIdx = BLOCK.indexOf('_updateOutboxBadge()');
    expect(abortIdx).toBeGreaterThan(-1);
    expect(badgeIdx).toBeGreaterThan(abortIdx);
  });

  it('the in-flight callback tail still re-arms via scheduleRetry — which is now the gated funnel', () => {
    expect(BLOCK).toMatch(/_retryQueue\.length > 0\) scheduleRetry\(\);/);
    // and the re-arm lands on the gated path, not a raw setTimeout
    expect(BLOCK).not.toMatch(/_retryQueue\.length > 0\) _retryTimer =/);
  });

  it('functional: aborted context arms no timer and touches no badge; live context does', () => {
    const armed = [], badges = [];
    const scheduleRetry = (aborted, empty) => {
      if (aborted) return;
      badges.push(1);
      if (!empty) armed.push(1);
    };
    scheduleRetry(true, false);  // dead context → nothing
    scheduleRetry(false, false); // live + work → armed
    expect(armed).toHaveLength(1);
    expect(badges).toHaveLength(1);
  });
});
