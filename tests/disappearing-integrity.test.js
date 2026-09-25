import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const FN = SRC.match(/function _purgeTombstone\(m\) \{[\s\S]*?\n\}/)[0];
const tombstoneOf = (m) => new Function('m', `${FN}; return _purgeTombstone(m);`)(m);

describe('disappearing-message integrity — expiry must be total, not visual', () => {
  it('no hard delete remains on the messages store: sweepers and quota recovery tombstone', () => {
    // Aliased stores slipped past the objectStore('messages').delete() pin — a hard
    // delete frees the msgId and a re-delivered copy resurrects.
    expect(SRC.match(/store\.delete\(m\.msgId\)/g) || []).toHaveLength(0);
    expect(SRC.match(/dbDel\('messages'/g) || []).toHaveLength(0);
  });

  it('both interval sweepers and quota recovery route through _purgeTombstone', () => {
    // 10s sweeper (store.put), 30s sweeper (dbPut), quota recovery (store.put)
    expect(SRC.match(/store\.put\(_purgeTombstone\(m\)\)/g).length).toBeGreaterThanOrEqual(2);
    expect(SRC).toContain("await dbPut('messages', _purgeTombstone(m));");
    // Quota recovery must not prune tombstones themselves (retention rule parity).
    expect(SRC).toContain('!m.pinned && !m.bookmarked && !m.purged');
  });

  it('_fanOut propagates disappearAt to peer devices AND my sibling devices', () => {
    // 1:1 text send — peerExtra + selfExtra both carry it
    expect(SRC).toContain('sigPub: envelope.sigPub, disappearAt: envelope.disappearAt');
    expect(SRC).toContain('sfName: contact.name, disappearAt: envelope.disappearAt');
    // group text send — selfExtra (peerDevs is empty for groups by design)
    expect(SRC).toContain('sfName: contact.name, disappearAt: meta.disappearAt');
  });

  it('the selfSync store copies disappearAt — a sibling-held copy expires too', () => {
    expect(SRC).toContain('isPoll: msg.isPoll || undefined, disappearAt: msg.disappearAt, synced: true');
  });

  it('already-expired messages are tombstoned on arrival, before decrypt and render', () => {
    const guards = SRC.match(/msg\.disappearAt && msg\.disappearAt <= Date\.now\(\)\) \{ await dbPut\('messages', _purgeTombstone/g);
    expect(guards.length).toBe(2); // group path + 1:1 path
  });

  it('functional: an expired-on-arrival message is dropped like a deleted one', async () => {
    const store = new Map();
    const dbGet = async (s, id) => (s === 'messages' ? store.get(id) : undefined);
    const dbPut = async (s, v) => { if (s === 'messages') store.set(v.msgId, v); return true; };
    const msgId = 'peer:1000';
    // Receive-path guard shape: dedup miss → expire check → tombstone → return.
    if (!(await dbGet('messages', msgId))) {
      const disappearAt = Date.now() - 1;
      if (disappearAt <= Date.now()) {
        await dbPut('messages', tombstoneOf({ msgId, mine: false, ts: 1000 }));
      }
    }
    expect(store.get(msgId).purged).toBe(true);
    // Re-delivery of the same id drops via the same dedup guard.
    await expect(dbGet('messages', msgId)).resolves.toBeTruthy();
  });
});
