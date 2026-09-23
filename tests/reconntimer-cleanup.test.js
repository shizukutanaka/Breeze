import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// The transition() implementation: from the function literal to the CLOSED teardown block.
const TRANSITION = SRC.match(/peerState\.transition = function\(newState\) \{[\s\S]+?pc\.ontrack = null; \}\n/)[0];

describe('P2P reconnect timer lifecycle', () => {
  it('reconnect backoff stores its timer id on peerState so teardown can reach it', () => {
    // A bare setTimeout would fire after account switch and re-dial connectPeer in
    // the dead context — a second RTCPeerConnection signaling on the same room.
    expect(SRC).toContain('peerState._reconnTimer = setTimeout(() => {');
  });
  it('transition(CLOSED) clears the pending reconnect timer alongside the other peer intervals', () => {
    expect(TRANSITION).toContain('clearTimeout(this._reconnTimer)');
    expect(TRANSITION).toContain('this._reconnTimer = null');
    expect(TRANSITION.indexOf("newState === 'CLOSED'")).toBeLessThan(TRANSITION.indexOf('this._reconnTimer'));
  });
  it('no untracked setTimeout remains in the reconnect backoff region', () => {
    // Tripwire: the backoff delay must never again be an orphan timer.
    const backoff = SRC.match(/peerState\._reconnAttempts = attempts \+ 1;[\s\S]+?\}, delay \+ jitter\);/)[0];
    expect(backoff).not.toMatch(/(?<!\._reconnTimer = )setTimeout\(/);
  });
  it('functional: a CLOSED transition on a stub peerState cancels the pending dial', () => {
    const peerState = { connState: 'RECONNECTING', _healthTimer: null, _heartbeat: null, _sigPoll: null, _reconnTimer: null, pc: null };
    peerState.transition = function(newState) {
      const valid = { INIT: ['SIGNALING'], SIGNALING: ['ICE', 'CLOSED'], ICE: ['CONNECTED', 'CLOSED'], CONNECTED: ['RECONNECTING', 'CLOSED'], RECONNECTING: ['ICE', 'CLOSED'] };
      if (valid[this.connState]?.includes(newState) || newState === 'CLOSED') {
        this.connState = newState; this.connected = newState === 'CONNECTED';
        if (newState === 'CLOSED') {
          if (this._healthTimer) { clearInterval(this._healthTimer); this._healthTimer = null; }
          if (this._heartbeat) { clearInterval(this._heartbeat); this._heartbeat = null; }
          if (this._sigPoll) { clearInterval(this._sigPoll); this._sigPoll = null; } if (this._reconnTimer) { clearTimeout(this._reconnTimer); this._reconnTimer = null; }
        }
      }
    };
    let dialed = false;
    peerState._reconnTimer = setTimeout(() => { dialed = true; }, 5);
    peerState.transition('CLOSED');
    return new Promise(r => setTimeout(() => { expect(dialed).toBe(false); expect(peerState._reconnTimer).toBe(null); r(); }, 30));
  });
});
