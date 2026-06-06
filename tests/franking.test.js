// Message franking core tests (roadmap I17): verifiable abuse reporting.
import { describe, it, expect } from 'vitest';
import { createFranking } from '../src/crypto/franking.js';

const F = createFranking();

describe('commit / verify', () => {
  it('a genuine report verifies (the reported plaintext was really sent)', async () => {
    const msg = 'abusive message';
    const { commitment, opening } = await F.commit(msg);
    expect(await F.verify(msg, commitment, opening)).toBe(true);
    // Relay-side report flow: relay recorded `commitment` at send time.
    expect(await F.verifyReport({ message: msg, opening, recordedCommitment: commitment })).toBe(true);
  });

  it('rejects a report claiming a different message (binding)', async () => {
    const { commitment, opening } = await F.commit('what was actually sent');
    expect(await F.verify('a message that was NOT sent', commitment, opening)).toBe(false);
  });

  it('rejects a wrong / forged opening', async () => {
    const msg = 'hello';
    const { commitment } = await F.commit(msg);
    const wrongOpening = Array.from(crypto.getRandomValues(new Uint8Array(32)));
    expect(await F.verify(msg, commitment, wrongOpening)).toBe(false);
  });

  it('a tampered opening fails', async () => {
    const msg = 'hello';
    const { commitment, opening } = await F.commit(msg);
    const bad = opening.slice(); bad[0] ^= 0xff;
    expect(await F.verify(msg, commitment, bad)).toBe(false);
  });

  it('fresh randomness per commit (hiding — same message → different commitments)', async () => {
    const a = await F.commit('same');
    const b = await F.commit('same');
    expect(a.commitment).not.toEqual(b.commitment);
    expect(a.opening).not.toEqual(b.opening);
    // Each still verifies against its own opening.
    expect(await F.verify('same', a.commitment, a.opening)).toBe(true);
    expect(await F.verify('same', b.commitment, b.opening)).toBe(true);
    // …but not cross-wise.
    expect(await F.verify('same', a.commitment, b.opening)).toBe(false);
  });

  it('works on binary messages and unicode', async () => {
    const bin = crypto.getRandomValues(new Uint8Array(200));
    const r1 = await F.commit(bin);
    expect(await F.verify(bin, r1.commitment, r1.opening)).toBe(true);
    const uni = '通報テスト 🚩';
    const r2 = await F.commit(uni);
    expect(await F.verify(uni, r2.commitment, r2.opening)).toBe(true);
  });
});
