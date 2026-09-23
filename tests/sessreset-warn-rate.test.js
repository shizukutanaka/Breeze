import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const RESET = SRC.match(/_decryptFailures\[peerId\] >= CONFIG\.SESSION_RESET_THRESHOLD[\s\S]+?\n      \}/);

describe('session-reset warning rate limit (CWE-400)', () => {
  it('gates the warn behind _sessWarnAt (≤1/day/peer)', () => {
    expect(RESET).toBeTruthy();
    expect(RESET[0]).toContain('!(_sessWarnAt[peerId] > Date.now() - MS.DAY)');
    expect(RESET[0]).toContain('_sessWarnAt[peerId] = Date.now()');
    expect(RESET[0]).toContain("showKeyChangeWarning(peerId, peerPubB64, 'Session reset.')");
  });

  it('declares _sessWarnAt as an init-scoped per-peer map', () => {
    expect(SRC).toContain('const _sessWarnAt = {}');
    // must live inside initMessenger scope — declared adjacent to _decryptFailures
    expect(SRC.indexOf('const _sessWarnAt = {}')).toBeGreaterThan(SRC.indexOf('async function initMessenger'));
  });

  it('keeps session drop + counter zero unconditional (warn gate must not weaken reset)', () => {
    const block = RESET[0];
    expect(block.indexOf("await dbDel('identity', 'sess:' + peerId)")).toBeLessThan(block.indexOf('_sessWarnAt[peerId] > Date.now()'));
    expect(block.indexOf('_decryptFailures[peerId] = 0')).toBeLessThan(block.indexOf('_sessWarnAt[peerId] > Date.now()'));
  });

  it('fires once/day under a reset flood, warns again next day', () => {
    const DAY = 86400000;
    const warns = [];
    const _sessWarnAt = {};
    const fire = (now, peerId) => { if (!(_sessWarnAt[peerId] > now - DAY)) { _sessWarnAt[peerId] = now; warns.push(peerId); } };
    for (let i = 0; i < 50; i++) fire(1_000 + i, 'peerA');          // 50 resets same instant
    for (let i = 0; i < 50; i++) fire(1_000 + DAY - 1 + i, 'peerA'); // still same day
    fire(1_000 + DAY + 1, 'peerA');                                // next day → warn again
    fire(1_000, 'peerB');                                          // independent peer
    expect(warns).toEqual(['peerA', 'peerA', 'peerB']);
  });
});
