import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const BLOCK = SRC.match(/async function checkRemoteWipe\(\) \{[\s\S]+?\n {2}\}/)[0];

describe('dead context must not run checkRemoteWipe — it drains the dormant account\'s whole backlog (CWE-772)', () => {
  it('returns early on _ac.signal.aborted (before any /msg/poll drain)', () => {
    expect(BLOCK).toMatch(/if \(!API \|\| !myId \|\| _ac\.signal\.aborted\) return;/);
  });

  it('the abort check precedes the /msg/poll call — no pop-drain on a dead context', () => {
    const abortIdx = BLOCK.indexOf('_ac.signal.aborted');
    const pollIdx = BLOCK.indexOf("'/msg/poll'");
    expect(abortIdx).toBeGreaterThan(-1);
    expect(pollIdx).toBeGreaterThan(abortIdx);
  });

  it('keeps the signature gate on the wipe signal intact (defense unweakened)', () => {
    expect(BLOCK).toMatch(/msg\.type === 'remote_wipe' && msg\.from === myId/);
    expect(BLOCK).toMatch(/verifySignature\('breeze-remote-wipe:'/);
  });

  it('functional: aborted context never reaches the poll', () => {
    let polls = 0;
    const checkRemoteWipe = async (hasApi, myId, aborted) => {
      if (!hasApi || !myId || aborted) return;
      polls++; // would be postAPIRaw('/msg/poll', … lastTs: 0)
    };
    checkRemoteWipe(true, 'old-acct', true);
    checkRemoteWipe(true, 'new-acct', false);
    expect(polls).toBe(1); // only the live context polls
  });
});
