import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ACCEPT = SRC.match(/async function acceptCall[\s\S]+?\n {2}function endCall/)[0];
const VOICE = SRC.match(/voiceBtn\.addEventListener\('click'[\s\S]+?toastMicDenied/)[0];

describe('media-acquire continuations must bail on dead/cancelled contexts (CWE-772)', () => {
  it('acceptCall guards between getUserMedia and PC creation, stopping the stream on bail', () => {
    const gum = ACCEPT.indexOf('getUserMedia');
    const guard = ACCEPT.indexOf("_callState !== 'calling' || _ac.signal.aborted");
    const pc = ACCEPT.indexOf('new RTCPeerConnection');
    expect(guard).toBeGreaterThan(gum);
    expect(pc).toBeGreaterThan(guard);
    expect(ACCEPT).toContain('_callStream.getTracks().forEach(t => t.stop()); _callStream = null; return;');
  });

  it('voice-record stops the granted stream when the context died mid-acquire', () => {
    const guard = VOICE.indexOf('_ac.signal.aborted');
    const pin = VOICE.indexOf('_recContact = activeContact');
    expect(guard).toBeGreaterThan(-1);
    expect(pin).toBeGreaterThan(guard); // recipient pinned only on a live context
    expect(VOICE).toContain('stream.getTracks().forEach(t => t.stop()); return;');
  });

  it('voice-record serializes acquires via _recPending and resets it on error', () => {
    expect(VOICE).toContain('if (_recPending) return; _recPending = true;');
    expect(SRC).toContain('let _recTimer = null, _recPending = false;');
    expect(SRC).toContain('catch(err) { _recPending = false;');
  });

  it('functional: pending flag blocks a racing acquire and is reset after resolution', async () => {
    let pending = false; const stopped = [];
    const acquire = async (stream, aborted) => {
      if (pending) return 'skipped';
      pending = true;
      await Promise.resolve();
      pending = false;
      if (aborted) { stream.getTracks().forEach(t => t.stop()); return 'bailed'; }
      return 'recording';
    };
    const stream = { getTracks: () => [{ stop: () => stopped.push(1) }] };
    const first = acquire(stream, true);
    const second = acquire(stream, true); // races the pending first
    expect(await first).toBe('bailed');
    expect(await second).toBe('skipped'); // racing acquire rejected while pending
    expect(stopped.length).toBe(1);      // only one stream actually granted + stopped
    expect(await acquire(stream, false)).toBe('recording'); // flag reset — not stuck true
  });
});
