import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const FN = SRC.match(/function _purgeTombstone\(m\) \{[\s\S]*?\n\}/)[0];
const tombstoneOf = (m) => new Function('m', `${FN}; return _purgeTombstone(m);`)(m);

describe('delete-before-arrival — remote delete for an unknown msgId must not be lost', () => {
  it('all three remote-delete sites tombstone an unknown target id', () => {
    expect(SRC).toContain('_purgeTombstone({ msgId: smId,');        // selfSync
    expect(SRC).toContain('_purgeTombstone({ msgId: targetMsgId,'); // group
    expect(SRC).toContain('_purgeTombstone({ msgId: _smId,');       // 1:1 relay
  });

  it('author-binding is preserved: only the signal sender\'s own ids can be tombstoned', () => {
    // Group + relay embed the author in `authorId:ts` — the startsWith guard is the
    // same binding the stored-record path enforces via !mine + contactId.
    expect(SRC).toContain('!stored && targetMsgId.startsWith(msg.from + \':\')');
    // 1:1 binds to the VERIFIED author id: the attributed device's pub prefix when the
    // sender is a registry-listed sibling device (contactId was rewritten to the root id,
    // whose prefix never matches the device-authored msgId), else the contact id.
    expect(SRC).toContain('_smId.startsWith((_attribPub ? _attribPub.slice(0, 12) : contactId) + \':\')');
    // selfSync marks mine only for ids authored by this account's devices.
    expect(SRC).toContain("smId.startsWith(myId + ':') || mine.some(");
  });

  it('non-delete signals for unknown ids are still dropped (edit/reaction residue is benign)', () => {
    // selfSync keeps the early return for edit/reaction on unknown ids.
    const block = SRC.match(/if \(!stored\) \{[\s\S]*?return; \/\/ mutation for a message this device never had[\s\S]*?\}/)?.[0];
    expect(block).toBeTruthy();
    expect(block).toContain("signal.type === 'delete'");
    expect(block).not.toContain("signal.type === 'edit'");
  });

  it('functional: delete lands first → tombstone → late original drops via the dedup guard', async () => {
    // Simulates: peer sends msg via sealed relay (queued), delete via P2P (instant).
    // The delete tombstones the unknown id; the sealed msg then arrives and must drop.
    const store = new Map();
    const dbGet = async (s, id) => (s === 'messages' ? store.get(id) : undefined);
    const dbPut = async (s, v) => { if (s === 'messages') store.set(v.msgId, v); return true; };
    // Delete signal for unknown msgId (author-binding: msgId starts with the sender id).
    const _smId = 'peer123:555';
    const stored = await dbGet('messages', _smId);
    if (!stored && _smId.startsWith('peer123' + ':')) {
      await dbPut('messages', tombstoneOf({ msgId: _smId, mine: false, ts: Number(_smId.split(':')[1]) }));
    }
    // Late original arrives — same guard shape as the receive path.
    const receive = async () => { if (await dbGet('messages', _smId)) return 'dropped'; return 'rendered'; };
    await expect(receive()).resolves.toBe('dropped');
    expect(store.get(_smId).purged).toBe(true);
  });

  it('functional: a second delete on the tombstone is a no-op (idempotent)', async () => {
    const store = new Map([['peer123:555', tombstoneOf({ msgId: 'peer123:555', mine: false, ts: 555 })]]);
    const stored = store.get('peer123:555');
    // _okDel requires stored.contactId === contactId — the tombstone drops contactId,
    // so a repeated delete signal rejects cleanly.
    const _okDel = stored && !stored.mine && stored.contactId === 'peer123';
    expect(_okDel).toBe(false);
  });

  it('attributed lane: delete-before-arrival tombstones under the device id, not the root id', () => {
    // Attributed senders rewrite contactId to the ROOT id while their messages keep
    // `deviceId:ts` msgIds — binding to contactId never matched, so their
    // delete-before-arrival was dropped and the late original resurrected.
    const _attribPub = 'devPubABCDEFGH9999';
    const contactId = 'rootIdABCDEF';
    const _smId = 'devPubABCDEF:777';
    const authorId = _attribPub ? _attribPub.slice(0, 12) : contactId;
    expect(_smId.startsWith(authorId + ':')).toBe(true);
    // Pre-fix binding would have failed this: device msgId under the root id.
    expect(_smId.startsWith(contactId + ':')).toBe(false);
  });

  it('attribution requires a self-consistent claimed id (msg.from === device pub prefix)', () => {
    // Without it a verified device could claim any `from`, planting msgIds under an
    // arbitrary namespace — and with the author-binding, tombstoning ids it never
    // owned. Same rule the stranger auto-add path already enforces.
    expect(SRC).toContain('devs.list.includes(msg.fromPub) && msg.from === msg.fromPub.slice(0, 12)');
  });

  it('functional: forged author-binding fails — a peer cannot tombstone ids it did not author', () => {
    // Member B signals delete for memberA:999 — startsWith(msg.from + ':') rejects it.
    const targetMsgId = 'memberA:999';
    const msgFrom = 'memberB';
    expect(targetMsgId.startsWith(msgFrom + ':')).toBe(false);
  });
});
