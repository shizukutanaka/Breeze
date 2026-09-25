import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The preview contract: lastMsg/lastMsgAt describe the NEWEST surviving message —
// it anchors conversation sorting, and _refreshPreview's delete matching keys on
// `c.lastMsgAt === deletedTs`. Dual-path delivery is out-of-order by design, so an
// unconditional write lets an old late copy rewind it.
describe('contact preview is monotonic in ts — reordered delivery cannot rewind it', () => {
  it('all five receive-path preview writes are ts-guarded', () => {
    expect(SRC.match(/msg\.ts > \(target\.lastMsgAt \|\| 0\)/g)).toHaveLength(2);   // selfSync file + text
    expect(SRC.match(/msg\.ts > \(group\.lastMsgAt \|\| 0\)/g)).toHaveLength(1);    // group
    expect(SRC.match(/msg\.ts > \(contact\.lastMsgAt \|\| 0\)/g)).toHaveLength(2);  // voice + 1:1
    // Every lastMsgAt write sits inside one of those guards — none unconditional.
    expect(SRC.match(/lastMsgAt = msg\.ts/g).length).toBe(5);
  });

  it('guards bound future ts — a far-future ts cannot pin the preview', () => {
    // Same sanity ceiling as the poll loop's lastPollTs bound.
    const capped = SRC.match(/lastMsgAt \|\| 0\) && msg\.ts <= Date\.now\(\) \+ MS\.DAY/g);
    expect(capped.length).toBe(5);
  });

  it('functional: an older late message does not rewind lastMsg/lastMsgAt', () => {
    const c = { lastMsg: 'newest', lastMsgAt: 200 };
    const arrive = (c, text, ts) => { if (ts > (c.lastMsgAt || 0) && ts <= Date.now() + 86400000) { c.lastMsg = text.slice(0, 40); c.lastMsgAt = ts; } };
    // Newer arrives first (P2P), older second (sealed) — dual-path reorder.
    arrive(c, 'old-sealed-copy', 100);
    expect(c.lastMsg).toBe('newest');
    expect(c.lastMsgAt).toBe(200);
    // A genuinely newer message still claims the preview.
    arrive(c, 'actually-newest', 300);
    expect(c.lastMsg).toBe('actually-newest');
    expect(c.lastMsgAt).toBe(300);
    // A far-future ts is rejected — the preview cannot be pinned forward.
    arrive(c, 'future-hijack', Date.now() + 86400000 * 30);
    expect(c.lastMsg).toBe('actually-newest');
    expect(c.lastMsgAt).toBe(300);
  });

  it('_refreshPreview still keys deletion on lastMsgAt — the contract holds', () => {
    expect(SRC).toContain('if (!c || c.lastMsgAt !== deletedTs) return;');
  });
});
