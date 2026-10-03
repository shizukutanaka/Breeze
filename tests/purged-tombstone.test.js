import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const FN = SRC.match(/function _purgeTombstone\(m\) \{[\s\S]*?\n\}/)[0];
const tombstoneOf = (m) => new Function('m', `${FN}; return _purgeTombstone(m);`)(m);

describe('purged tombstones — local deletes cannot resurrect via re-delivery', () => {
  it('no hard delete remains on the messages store outside the group-destroy path', () => {
    // The group delete/leave purge keeps os.delete: contact + session + sender keys are
    // destroyed with it, so re-delivery drops upstream — tombstones there are dead weight.
    const sites = SRC.match(/objectStore\('messages'\)\.delete\(/g) || [];
    expect(sites.length).toBe(1);
    // Same for os.delete on the messages store — only the audit store prunes this way.
    const osDeletes = SRC.match(/os\.delete\(m\.msgId\)|os\.delete\(entry/g) || [];
    expect(osDeletes.length).toBe(1);
  });

  it('every local delete site routes through _purgeTombstone', () => {
    // helper def + retention + disappear-expiry filter + select-del + clear-button + /clear
    expect(SRC.match(/_purgeTombstone\(/g).length).toBeGreaterThanOrEqual(6);
  });

  it('tombstone keeps only the dedup identity — contactId and content are gone', () => {
    const t = tombstoneOf({
      msgId: 'alice:123', contactId: 'alice', mine: false, ts: 123,
      text: 'secret', fileData: 'x', replyTo: { msgId: 'y', text: 'q' }, pinned: true, isPoll: true,
    });
    expect(t.msgId).toBe('alice:123'); // dedup key survives
    expect(t.deleted).toBe(true);
    expect(t.purged).toBe(true);
    expect(t.contactId).toBeUndefined(); // invisible to contact-index queries + contactId-bound mutations
    expect(t.text).toBe('');
    expect(t.fileData).toBeUndefined();
    expect(t.replyTo).toBeUndefined();
  });

  it('functional: re-delivery after purge hits the tombstone and drops', async () => {
    // Receive-path contract: `if (await dbGet('messages', msgId)) return;` precedes
    // decrypt, dbPut, render, notification and the unread bump.
    const store = new Map([['alice:111', { msgId: 'alice:111', contactId: 'alice', text: 'hi', mine: false, ts: 111 }]]);
    store.set('alice:111', tombstoneOf(store.get('alice:111')));
    const dbGet = async (s, id) => (s === 'messages' ? store.get(id) : undefined);
    const receive = async () => { if (await dbGet('messages', 'alice:111')) return 'dropped'; return 'rendered'; };
    await expect(receive()).resolves.toBe('dropped');
  });

  it('functional: a tombstone satisfies every dedup guard shape in the file', () => {
    // All four receive paths share the same guard pair:
    //   if (_replayCache.has(msgId)) return;
    //   _replayCache.add(msgId);
    //   if (await dbGet('messages', msgId)) return;
    const guards = SRC.match(/await dbGet\('messages', (msgId|gmsgId|syncId)\)\) return/g) || [];
    expect(guards.length).toBeGreaterThanOrEqual(3); // 1:1 + voice + selfSync (+ group pre-check)
    const t = tombstoneOf({ msgId: 'x:1' });
    expect(!!t).toBe(true); // dbGet truthy → every guard drops
  });

  it('remote mutations are gated on !stored.deleted — tombstones are immutable', () => {
    // 1:1 relay edit + selfSync edit/reaction + group predicate + 3 reaction sites
    expect(SRC.match(/!stored\.deleted/g).length).toBeGreaterThanOrEqual(6);
    expect(SRC).toContain('!m.deleted && m.contactId === msg.groupId');
  });

  it('purged rows are skipped in both render paths', () => {
    expect(SRC).toContain('if (m.purged) return false');
    expect(SRC).toContain('if (m.purged) continue');
  });

  it('retention exempts purged tombstones (reaping reopens the hole)', () => {
    expect(SRC).toContain('m.ts < cutoff && !m.pinned && !m.purged');
  });
});
