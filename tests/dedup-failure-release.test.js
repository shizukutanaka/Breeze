// Regression: the 1:1 receive path took the speculative _replayCache mark BEFORE
// decrypting, and every failure return kept it. msgId = `from:ts`, so a redelivery
// of the SAME envelope — the sealed-path copy landing after the P2P copy, the retry
// queue's repost, a poll re-delivery before ACK — carries the same msgId and hits
// `if (_replayCache.has(msgId)) return`.
//
// A TRANSIENT decrypt failure (message arrives before the session exists — a pkm
// bootstrap racing through the slower path, a ratchet gap that later resyncs)
// therefore poisoned the msgId permanently: the copy that WOULD now decrypt was
// dedup-dropped. Same delivery-ordering class fixed for group sender-keys earlier —
// this is the 1:1-layer twin. The sibling paths (group ~dedup, voice dedup) already
// mark AFTER a successful decrypt; the fix releases the mark on every failure exit.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The 1:1 tail of handleIncoming — the block between the speculative mark and the
// sig-verify block, which must release the mark on every failure path.
const tail = html.match(/_replayCache\.add\(msgId\);[\s\S]*?verifySignature/);

describe('1:1 dedup mark is released on every failure exit', () => {
  it('extracts the 1:1 receive tail', () => { expect(tail).toBeTruthy(); });

  it('file decrypt failure releases the mark', () => {
    expect(tail[0]).toContain("if (!fileMsg) { _replayCache.delete(msgId); return; }");
  });

  it('oversized file data releases the mark', () => {
    expect(tail[0]).toContain("_fp.data.length > 350000) { _replayCache.delete(msgId); return; }");
  });

  it('the file-branch catch releases the mark', () => {
    expect(tail[0]).toContain("} catch { _replayCache.delete(msgId); return; }");
  });

  it('text decrypt failure releases the mark', () => {
    expect(tail[0]).toContain("if (!text) { _replayCache.delete(msgId); return; }");
  });

  it('oversized text releases the mark', () => {
    expect(tail[0]).toContain("text.length > 65536) { _replayCache.delete(msgId); return; }");
  });

  it('keeps the speculative mark (concurrent-path duplicate protection)', () => {
    // In the 1:1 block specifically (the mark precedes every released failure path).
    expect(tail[0]).toMatch(/_replayCache\.has\(msgId\)\) return;[\s\S]*?_replayCache\.add\(msgId\)/);
  });
});

describe('sibling paths keep mark-after-success ordering (unchanged)', () => {
  it('group dedup still marks only after decrypt success', () => {
    // group path: `if (!text) return` precedes `_replayCache.add(msgId)`
    expect(html).toMatch(/if \(!text\) return;\s*\n\s*\/\/ Cap group message text[\s\S]*?_replayCache\.has\(msgId\)/);
  });

  it('voice dedup still marks only after decrypt success', () => {
    expect(html).toMatch(/if \(!decrypted\) return;\s*\n[\s\S]*?_replayCache\.has\(msgId\)/);
  });
});
