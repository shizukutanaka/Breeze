// Regression: the selfSync store path (a copy of a message I sent from a sibling
// device) wrote `target.lastMsg / lastMsgAt` UNCONDITIONALLY — the only preview
// writer left without the monotonic guard. Delivery is out-of-order by design
// (dual path + relay TTL), so a sibling's older message landing after a newer
// inbound rewound the preview to stale text. Worse, `_refreshPreview` matches
// `c.lastMsgAt === deletedTs` to detect that the preview IS the deleted message —
// a rewound lastMsgAt breaks that match, so deleting the real newest message
// leaves its text in the preview (the deleted-preview leak class resurfaces).
// msg.ts is already clamped to `Date.now() + 5 * MS.MIN` at handler entry, so a
// monotonic guard is the only missing half.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The selfSync store tail — between the file-branch and the catch.
const ss = html.match(/const fileText = '📎 ' \+ fileName;[\s\S]*?catch\(e\) \{ _dbg\(e, 'self-sync'\); \}/);

describe('selfSync preview writes are monotonic', () => {
  it('extracts the selfSync store block', () => { expect(ss).toBeTruthy(); });

  it('file branch guards lastMsg/lastMsgAt on msg.ts > lastMsgAt', () => {
    expect(ss[0]).toContain("if (msg.ts > (target.lastMsgAt || 0)) { target.lastMsg = fileText.slice(0, 40); target.lastMsgAt = msg.ts; }");
  });

  it('text branch guards lastMsg/lastMsgAt on msg.ts > lastMsgAt', () => {
    expect(ss[0]).toContain("if (msg.ts > (target.lastMsgAt || 0)) { target.lastMsg = (msg.isPoll ? '📊 ' : '') + syncText.slice(0, 40); target.lastMsgAt = msg.ts; }");
  });

  it('no unconditional target.lastMsgAt write remains in the block', () => {
    // Any `target.lastMsgAt = msg.ts` outside the guard is the rewind.
    const unguarded = ss[0].split('\n').filter(l =>
      l.includes('target.lastMsgAt = msg.ts') && !l.includes('msg.ts > (target.lastMsgAt'));
    expect(unguarded).toHaveLength(0);
  });

  it('no unconditional target.lastMsg write remains in the block', () => {
    const unguarded = ss[0].split('\n').filter(l =>
      l.includes('target.lastMsg =') && !l.includes('msg.ts > (target.lastMsgAt'));
    expect(unguarded).toHaveLength(0);
  });
});
