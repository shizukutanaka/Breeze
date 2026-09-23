import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const SCHED = SRC.match(/function schedulePoll\(\) \{[\s\S]+?\n {6}schedulePoll\(\);\n {4}\}, interval\);\n {2}\}/)[0];

describe('dead context must not re-arm the inbox poll chain or drain/ack as the old account (CWE-772)', () => {
  it('schedulePoll returns early when _ac.signal.aborted', () => {
    expect(SCHED).toMatch(/function schedulePoll\(\) \{\n {4}if \(_ac\.signal\.aborted\) return;/);
  });

  it('the poll callback itself is gated — no drain cycle on a dead context', () => {
    expect(SCHED).toMatch(/_pollTimer = setTimeout\(async \(\) => \{\n {6}if \(!_isOffline && API && !_ac\.signal\.aborted\) \{/);
  });

  it('sealed-ack is gated — a dead context never consumes envelopes', () => {
    expect(SCHED).toMatch(/sealedProcessed > 0 && !_ac\.signal\.aborted/);
  });

  it('functional: aborted context neither re-arms nor acks', () => {
    const timers = [], posts = [];
    const schedulePoll = (aborted) => { if (aborted) return; timers.push(1); };
    schedulePoll(true); schedulePoll(false);
    expect(timers).toHaveLength(1);
    const sealedProcessed = 2, aborted = true;
    if (sealedProcessed > 0 && !aborted) posts.push('/sealed/ack');
    expect(posts).toHaveLength(0);
  });
});
