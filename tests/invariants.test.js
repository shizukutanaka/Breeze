// Source-level tripwires for security invariants that live inline in index.html and
// cannot be imported. These guards were each added to close a real hole — a refactor
// that silently drops one must fail the suite, not ship quietly.
// (Pattern mirrors mirror-drift.test.js's readFileSync of the single-file client.)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

describe('mutation-binding invariants (cross-conversation tampering)', () => {
  it('relay isSignal edit requires the message to live in the sender\'s conversation', () => {
    expect(html).toContain("stored.contactId === contactId");
  });
  it('P2P DataChannel reaction requires the message to live in the sender\'s conversation', () => {
    expect(html).toContain('stored.contactId === contact.id');
  });
  it('P2P poll_vote binds to the sender\'s conversation poll only', () => {
    expect(html).toContain('pollMsg.contactId === contact.id');
  });
  it('group edit/delete enforce author-only + this-group binding', () => {
    expect(html).toContain('targetMsgId.startsWith(msg.from');
    expect(html).toContain('m.contactId === msg.groupId');
  });
  it('group reactions bind to this group', () => {
    expect(html).toContain('stored.contactId === msg.groupId');
  });
});

describe('P2P transfer bounds', () => {
  it('binary chunks cap per-chunk bytes (count cap alone allowed GBs)', () => {
    expect(html).toContain('data.length > CONFIG.CHUNK_SIZE');
  });
  it('incoming timestamps are clamped to the relay\'s ±5min window', () => {
    expect(html).toContain('msg.ts > Date.now() + 5 * MS.MIN');
  });
});

describe('fileData integrity', () => {
  it('received binary files persist bytes in IDB, not an ephemeral blob URL', () => {
    expect(html).toContain('fileBytes: full');
    expect(html).not.toContain('blobUrl: href');
  });
  it('fileData.blobUrl is never rendered into href/src (peer-shipped URL vector)', () => {
    expect(html).not.toContain('f.blobUrl');
  });
});

describe('poll receive path', () => {
  it('incoming type:poll messages are tagged so the card renders (not raw JSON)', () => {
    expect(html).toContain("meta.isPoll = true; meta.poll = _p");
  });
});

describe('group trust boundaries', () => {
  it('group_kick notices require the sender to be creator/admin', () => {
    expect(html).toContain('group.createdBy === senderId || (group.admins || []).includes(senderId)');
    expect(html).toContain('group-kick notice from non-admin');
  });
  it('roster poll applies member removals, not just growth', () => {
    expect(html).toContain('oldMembers.some(o => !newMembers.some(m => m.id === o.id))');
  });
  it('roster poll syncs createdBy/admins/name (transfer + rename visibility)', () => {
    // The local field is `createdBy` — every privilege gate reads it. Writing the
    // wire name `creatorId` to a `group.creatorId` property synced nothing.
    expect(html).toContain('group.createdBy !== data.creatorId');
    expect(html).toContain('group.createdBy = data.creatorId');
    expect(html).not.toContain('group.creatorId');
  });
  it('group invites run members through safeMemberList', () => {
    expect(html).toContain('safeMemberList(invite.members)');
  });
  it('group join seeds creatorId/admins from the join response', () => {
    expect(html).toContain("createdBy: typeof data.creatorId === 'string'");
  });
  it('sender-key channel requires roster membership (non-member key-plant + inject)', () => {
    // isSenderKey: reject keys from non-members when the group is known locally
    expect(html).toContain('(g.members || []).some(m => m.id === msg.from');
    // isGroupSK: same guard as the legacy per-member fallback
    expect(html).toContain('if (!member && msg.from !== myId) return;');
  });
});

describe('wire + storage invariants', () => {
  it('replyTo goes on the wire as a JSON string (Worker allowlist drops objects)', () => {
    expect(html).toContain('envelopeReplyTo(meta.replyTo)');
    expect(html).toContain("if (typeof msg.replyTo === 'string')");
  });
  it('chat import dedup key is unique per message AND bound to the conversation', () => {
    // minute-precision ts + index disambiguates within one file; contact.id prevents a
    // second import of the same export into a different chat colliding with the first.
    expect(html).toContain("'import:' + contact.id + ':' + m.ts + ':' + (isMine ? '1' : '0') + ':' + i");
  });
  it('scheduled sends restore the composer input (no draft clobber)', () => {
    expect(html.match(/savedInput = _DOM\.get\('msg-input'\)\.value/g)?.length).toBe(3);
  });
  it('announceOnly propagates via admin-gated group_meta and is enforced on receive', () => {
    expect(html).toContain('isGroupMeta: true');
    expect(html).toContain('group_meta from non-admin');
    expect(html).toContain('if (group.announceOnly && member)');
  });
  it('panic wipe closes the open db before deleteDatabase (connection blocks it)', () => {
    expect(html).toContain('db?.close()');
  });
  it('kicked-self path marks the group, toasts, and blocks sends', () => {
    expect(html).toContain('if (kickedId === myId)');
    expect(html).toContain('activeContact.kicked');
  });
  it('sw.js VERSION matches CONFIG.VERSION (hand-maintained duplicates drift)', () => {
    const sw = readFileSync(join(HERE, '..', 'sw.js'), 'utf8');
    const swV = sw.match(/const VERSION = '([^']+)'/)?.[1];
    const cfgV = html.match(/VERSION: '([^']+)'/)?.[1];
    expect(swV).toBeTruthy();
    expect(cfgV).toBeTruthy();
    expect(swV).toBe(cfgV);
  });
});
