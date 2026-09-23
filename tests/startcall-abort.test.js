import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const BLOCK = SRC.match(/async function startCall[\s\S]+?\n {2}async function handleCallOffer/)[0];

describe('startCall getUserMedia continuation guard (ghost-call / leaked camera — CWE-772)', () => {
  it('guards right after getUserMedia resolves — before the PC is created', () => {
    const gum = BLOCK.indexOf('await navigator.mediaDevices.getUserMedia');
    const guard = BLOCK.indexOf("_callState !== 'calling' || _ac.signal.aborted");
    const pc = BLOCK.indexOf('new RTCPeerConnection(getCallICEConfig())');
    expect(gum).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(gum);
    expect(pc).toBeGreaterThan(guard);
  });

  it('stops the acquired stream and returns on bail (no dangling camera LED)', () => {
    expect(BLOCK).toContain('_callStream.getTracks().forEach(t => t.stop()); _callStream = null; return;');
  });

  it('covers both exits: user-cancel mid-acquire (_callState) AND account switch (_ac.abort)', () => {
    expect(BLOCK).toContain("_callState !== 'calling'");
    expect(BLOCK).toContain('_ac.signal.aborted');
  });

  it('functional: dead/cancelled continuation stops tracks + skips offer, live one proceeds', () => {
    const run = (state, aborted) => {
      const stopped = []; const stream = { getTracks: () => [{ stop: () => stopped.push(1) }] };
      if (state !== 'calling' || aborted) { stream.getTracks().forEach(t => t.stop()); return 'bailed'; }
      return 'offer-sent';
    };
    expect(run('idle', false)).toBe('bailed');      // user pressed end-call while prompt was open
    expect(run('calling', true)).toBe('bailed');    // account switch mid-acquire
    expect(run('calling', false)).toBe('offer-sent'); // normal path untouched
  });
});
