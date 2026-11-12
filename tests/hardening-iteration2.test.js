import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRatchet } from '../src/crypto/ratchet.js';

// plan.md §2 (items A–E) regression pins.
//
// Audit note: all five §2 fixes were found ALREADY implemented in the deployed
// inline code (they landed with the source import / v3.6 hardening passes, but
// plan.md was never updated). The gap this file closes is coverage: vitest
// otherwise exercises the src/crypto *references*, while B–E live only inline
// in index.html (the mirror-drift hazard in CLAUDE.md), and A was pinned only
// at non-production parameters. These tests therefore:
//   - A: pin the production constants (MAX_SKIP=100 / MAX_GAP=2000) behaviourally
//        on the reference (ported verbatim from decryptFrom), plus the inline
//        invariants that cannot be extracted (bound + reject-before-advance +
//        commit-after-AEAD ordering) as scoped source contracts.
//   - B–E: scoped source contracts over the exact inline regions, sliced by
//        markers (the mirror-drift convention: fail loudly if markers move).

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const ratchetSrc = readFileSync(join(HERE, '..', 'src', 'crypto', 'ratchet.js'), 'utf8');

// Slice html between two markers; throw (fail loudly) if either marker moved.
function sliceBetween(startMarker, endMarker, label) {
  const s = html.indexOf(startMarker);
  const e = html.indexOf(endMarker, s);
  if (s < 0 || e < 0) {
    throw new Error(
      `hardening-iteration2 guard: could not locate the ${label} region in index.html ` +
      `(markers ${JSON.stringify(startMarker)} .. ${JSON.stringify(endMarker)}). ` +
      'If the code was renamed/moved, update tests/hardening-iteration2.test.js to match.',
    );
  }
  return html.slice(s, e);
}

describe('A — ratchet gap handling at production parameters (MAX_SKIP=100, MAX_GAP=2000)', () => {
  const R = createRatchet(); // defaults ARE the production parameters
  const randomChain = () => crypto.getRandomValues(new Uint8Array(32));

  it('reference defaults match the inline constants', () => {
    expect(ratchetSrc).toContain('MAX_SKIP: 100,');
    expect(ratchetSrc).toContain('MAX_GAP: 2000,');
  });

  it('a >MAX_SKIP gap still decrypts, retains exactly the last 100 skipped keys, and does not desync', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const msgs = [await R.ratchetEncrypt(sender, 'first')];
    for (let i = 0; i < 150; i++) msgs.push(await R.ratchetEncrypt(sender, 'm' + i));
    expect(await R.ratchetDecrypt(receiver, msgs[0])).toBe('first');
    // Deliver the last one (counter 151): a gap of 149 — beyond the old MAX_SKIP
    // cap that used to desync the chain permanently (plan.md §2 A).
    expect(await R.ratchetDecrypt(receiver, msgs[150])).toBe('m149');
    // Only the most recent MAX_SKIP=100 skipped keys are retained (counters 51–150).
    expect(Object.keys(receiver.skippedKeys)).toHaveLength(100);
    // A retained skipped message (counter 120) still decrypts…
    expect(await R.ratchetDecrypt(receiver, msgs[119])).toBe('m118');
    // …but one older than the retention window (counter 10) was never retained.
    expect(await R.ratchetDecrypt(receiver, msgs[9])).toBe(null);
    // Chain stayed aligned: the next in-order message decrypts.
    const next = await R.ratchetEncrypt(sender, 'after');
    expect(await R.ratchetDecrypt(receiver, next)).toBe('after');
  });

  it('a forged gap just past MAX_GAP (2001) is rejected and the chain is untouched', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const c1 = await R.ratchetEncrypt(sender, 'one');
    const forged = JSON.parse(await R.ratchetEncrypt(sender, 'x'));
    forged.c = 2002; // gap = 2002 - 0 - 1 = 2001 > MAX_GAP
    expect(await R.ratchetDecrypt(receiver, forged)).toBe(null);
    expect(receiver.recvCounter).toBe(0); // rejection must not move receive state
    expect(await R.ratchetDecrypt(receiver, c1)).toBe('one'); // legit message still works
  });
});

describe('A — inline decryptFrom gap invariants (source contract)', () => {
  const body = sliceBetween('async function _decryptFromRaw', '\n  // v3.6: Unpad', '_decryptFromRaw');
  const gapIdx = body.indexOf('const MAX_SKIP = 100;');

  it('declares the production bounds', () => {
    expect(gapIdx).toBeGreaterThanOrEqual(0);
    expect(body).toContain('const MAX_GAP = 2000;');
  });

  it('rejects an absurd gap before advancing the chain', () => {
    const rejectIdx = body.indexOf('if (gap > MAX_GAP)');
    const loopIdx = body.indexOf('for (let i = 0; i < gap; i++)');
    expect(rejectIdx).toBeGreaterThan(gapIdx);
    expect(loopIdx).toBeGreaterThan(rejectIdx);
  });

  it('advances the full gap but retains only the most recent MAX_SKIP keys', () => {
    expect(body).toContain('if (gap - i <= MAX_SKIP) stagedSkipped[');
  });

  it('commits receive state only after the AEAD check (staged commit)', () => {
    const aeadIdx = body.indexOf('AEAD auth failure', gapIdx);
    const commitIdx = body.indexOf('sess.recvCounter = p.c;', gapIdx);
    const mergeIdx = body.indexOf('Object.assign(sess.skippedKeys, stagedSkipped)', gapIdx);
    expect(aeadIdx).toBeGreaterThan(gapIdx);
    expect(commitIdx).toBeGreaterThan(aeadIdx);
    expect(mergeIdx).toBeGreaterThan(aeadIdx);
  });
});

describe('B — per-peer interval cleanup is centralized in the CLOSED transition', () => {
  const transition = sliceBetween(
    'peerState.transition = function(newState) {',
    "peerState.transition('SIGNALING');",
    'peerState.transition',
  );

  it('the CLOSED branch clears heartbeat, health timer and signaling poll', () => {
    const closedIdx = transition.indexOf("if (newState === 'CLOSED')");
    expect(closedIdx).toBeGreaterThanOrEqual(0);
    const closed = transition.slice(closedIdx);
    for (const name of ['_healthTimer', '_heartbeat', '_sigPoll']) {
      expect(closed).toContain(`clearInterval(this.${name})`);
      expect(closed).toContain(`this.${name} = null`);
    }
  });

  it('all three intervals are stored on peerState at creation', () => {
    expect(html).toContain('peerState._heartbeat = setInterval(');
    expect(html).toContain('peerState._healthTimer = setInterval(');
    expect(html).toContain('peerState._sigPoll = sigPoll;'); // cleared on CLOSED (see above)
    expect(html).toContain('const sigPoll = setInterval(');
  });
});

describe('C — controllerchange reloads only when replacing an existing controller', () => {
  const block = sliceBetween(
    'const hadController = !!navigator.serviceWorker.controller;',
    '\n  }).catch(e => _dbg(e));',
    'controllerchange guard',
  );

  it('captures hadController at load and guards the reload on it', () => {
    expect(block).toContain("addEventListener('controllerchange'");
    const guardIdx = block.indexOf('if (refreshing || !hadController) return;');
    const reloadIdx = block.indexOf('location.reload()');
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(reloadIdx).toBeGreaterThan(guardIdx);
  });
});

describe('D — fatal-error counter uses a 60 s sliding window in both handlers', () => {
  it('defines the window as 60 s', () => {
    expect(html).toContain('const _FATAL_WINDOW_MS = 60000;');
  });

  it("the 'error' handler resets the counter before incrementing it", () => {
    const handler = sliceBetween(
      "window.addEventListener('error', (event) => {",
      "window.addEventListener('unhandledrejection'",
      'error boundary (error)',
    );
    const resetIdx = handler.indexOf('if (Date.now() - _lastErrorAt > _FATAL_WINDOW_MS) { _fatalErrors = 0;');
    expect(resetIdx).toBeGreaterThanOrEqual(0);
    expect(handler.indexOf('_fatalErrors++;')).toBeGreaterThan(resetIdx);
    expect(handler).toContain('if (_fatalErrors >= 3'); // crash overlay threshold
  });

  it("the 'unhandledrejection' handler resets the counter before incrementing it", () => {
    const handler = sliceBetween(
      "window.addEventListener('unhandledrejection', (event) => {",
      '\n// v3.5: Auto theme',
      'error boundary (unhandledrejection)',
    );
    const resetIdx = handler.indexOf('if (Date.now() - _lastErrorAt > _FATAL_WINDOW_MS) { _fatalErrors = 0;');
    expect(resetIdx).toBeGreaterThanOrEqual(0);
    expect(handler.indexOf('_fatalErrors++;')).toBeGreaterThan(resetIdx);
  });
});

describe('E — message signature check pins the contact signing key (TOFU)', () => {
  const block = sliceBetween(
    '// v3.3: Verify Ed25519 signature if present.',
    'await dbPut(\'messages\', { msgId, contactId, text, mine: false, ts: msg.ts, ...meta,',
    'handleIncoming signature check',
  );

  it('pins contact.sigPub on first sighting', () => {
    expect(block).toContain('if (!contact.sigPub) {');
    expect(block).toContain('contact.sigPub = msg.sigPub; // trust on first use');
  });

  it('flags a changed signing key as tampered and raises the key-change warning', () => {
    const mismatchIdx = block.indexOf('contact.sigPub !== msg.sigPub');
    expect(mismatchIdx).toBeGreaterThanOrEqual(0);
    const mismatch = block.slice(mismatchIdx, mismatchIdx + 400);
    expect(mismatch).toContain('meta.tampered = true;');
    expect(mismatch).toContain('showKeyChangeWarning(');
  });

  it('verifies the signature against the pinned key only when not tampered', () => {
    const gateIdx = block.indexOf('if (!meta.tampered) {');
    expect(gateIdx).toBeGreaterThanOrEqual(0);
    expect(block.indexOf('verifySignature(text, msg.sig, msg.sigPub)', gateIdx)).toBeGreaterThan(gateIdx);
  });

  it('the signed-SDP path enforces the same pin', () => {
    const sdp = sliceBetween(
      'if (contact.sigPub && contact.sigPub !== wrapper.sigPub) {',
      'sdpJson = wrapper.sdp;',
      'signed SDP check',
    );
    expect(sdp).toContain('continue;'); // mismatched SDP is rejected
    expect(sdp).toContain('verifyMessage(wrapper.sdp, wrapper.sig, wrapper.sigPub)');
    expect(sdp).toContain('if (!contact.sigPub && wrapper.sigPub');
    expect(sdp).toContain('contact.sigPub = wrapper.sigPub;');
  });
});
