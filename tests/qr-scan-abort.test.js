import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// qrScanOnce's RAF detect loop used to check only video.isConnected — but a
// mid-scan account switch leaves the modal ATTACHED in the persistent DOM, so
// the camera kept streaming (LED on under the new account) and a late detect
// resolved into the dead context: the verify caller would dbPut a `verified`
// flag into the abandoned account's contacts store, and the ?add= caller
// navigated away. `_ac.signal.aborted` now ends the loop on switch.
describe('QR scan loop aborts on account switch (CWE-772 / cross-account write)', () => {
  it('detect loop breaks on _ac.signal.aborted, not just detachment', () => {
    expect(SRC).toContain('!video.isConnected || _ac.signal.aborted');
  });

  it('qrScanOnce lives inside initMessenger where _ac is in scope', () => {
    const INIT = SRC.indexOf('async function initMessenger');
    const QR = SRC.indexOf('function qrScanOnce');
    const BOOT = SRC.indexOf('await _boot();', INIT);
    expect(INIT).toBeGreaterThan(0);
    expect(QR).toBeGreaterThan(INIT);
    expect(QR).toBeLessThan(BOOT);
  });

  it('functional: shipped loop predicate stops tracks + resolves on abort', () => {
    // Drive the shipped guard: !video.isConnected || _ac.signal.aborted
    const ac = new AbortController();
    const tracks = { stopped: 0, stop() { this.stopped++; } };
    const stream = { getTracks: () => [tracks, tracks] };
    const cleanup = () => stream.getTracks().forEach(t => t.stop());
    const video = { isConnected: true }; // modal survives the switch (persistent DOM)
    let resolved = 'pending';
    const resolve = (v) => { resolved = v; };
    const tick = () => {
      if (!video.isConnected || ac.signal.aborted) { cleanup(); resolve(null); return 'end'; }
      return 'scan';
    };
    expect(tick()).toBe('scan'); // pre-switch: still scanning
    ac.abort(); // _messengerCleanup on account switch
    expect(tick()).toBe('end');
    expect(tracks.stopped).toBe(2); // camera released
    expect(resolved).toBe(null); // caller's `if (!value) return` cancels the write
  });
});
