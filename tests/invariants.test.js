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

describe('SDP signature verification', () => {
  it('sig-poll verifies signed SDPs with verifySignature (a typo here is invisible — the call is inside a catch-all)', () => {
    // verifyMessage() was called instead — it does not exist, the ReferenceError was
    // swallowed by the surrounding catch, and signed SDPs were passed to
    // setRemoteDescription as the {sdp,sig,sigPub} wrapper → dropped → P2P never
    // established between signing clients. Pin the real call.
    expect(html).toContain('verifySignature(wrapper.sdp, wrapper.sig, wrapper.sigPub)');
    expect(html).not.toContain('verifyMessage(');
  });
});

describe('DH contributory checks (low-order/torsion key attacks)', () => {
  // eprint 2026/727: a low-order X25519 peer key makes deriveBits return an all-zero
  // shared secret the attacker knows — forged ratchet headers (p.rk) or bundle keys
  // would pin a poisoned chain. The single ecdhBits chokepoint must reject it, in
  // BOTH the deployed inline copy and the tested reference (mirror-drift hazard).
  it('inline ecdhBits rejects all-zero X25519 output', () => {
    expect(html).toContain("throw new Error('non-contributory X25519 DH')");
    expect(html).toContain('!bits.some(b => b !== 0)');
  });
  it('reference ecdhBits (src/crypto/ratchet.js) has the same guard', () => {
    const ref = readFileSync(join(HERE, '..', 'src/crypto/ratchet.js'), 'utf8');
    expect(ref).toContain("'non-contributory X25519 DH'");
  });
  it('session reset must NOT persist a key-bearing responder state at rest', () => {
    // initSessionResponder stores ratchetPriv = identity private key (exported to
    // plaintext JWK by saveSession). Persisting it on reset — forcible by any peer
    // with 3 garbage ciphertexts — is the DR paper's forced weak-state attack.
    const resetAt = html.indexOf('>= CONFIG.SESSION_RESET_THRESHOLD');
    const resetBlock = html.slice(resetAt, resetAt + 1200);
    expect(resetBlock).toContain("dbDel('identity', 'sess:' + peerId)");
    expect(resetBlock).not.toContain('initSessionResponder(peerPubB64)');
  });
});

describe('dm-sig-v1 sealed signaling (dm: room confidentiality)', () => {
  // The /signal relay is unauthenticated and rooms are named dm:<idA>:<idB> — anyone
  // knowing both ids could read ICE candidates (both parties' IPs) and typing/read
  // activity. dm-sig-v1 seals payloads to the peer's identity key (seal-v2 ECIES),
  // sign-then-seal so the inner Ed25519 SDP signature still proves authorship.
  it('advertises the capability so peers know to seal', () => {
    expect(html).toContain("CAPS_DM_SIG = 'dm-sig-v1'");
    expect(html).toContain('caps.push(CAPS_DM_SIG)');
  });
  it('_signal seals dm: and call: rooms — other rooms stay plaintext', () => {
    expect(html).toContain("room.startsWith('dm:') || room.startsWith('call:')");
    expect(html).toContain('_sealDmSignal(room, { type, data: wireData })');
    expect(html).toContain("wireType = 'enc'");
    // Both receive loops unseal enc envelopes — dm signals in the P2P poll, call signals in pollCallSignals
    expect(html).toContain('_unsealDmSignal(sigRoom, s.data)');
    expect(html).toContain('_unsealDmSignal(room, s.data)');
  });
  it('sender gates on the PEER caps and fails to plaintext, receiver fails closed', () => {
    expect(html).toContain('(await _peerCaps(peerId)).includes(CAPS_DM_SIG)');
    expect(html).toContain('_unsealDmSignal(sigRoom, s.data)');
    expect(html).toContain("w.enc !== 'dm-sig-v1'");
  });
  it('unsigned-type plaintexts are rejected once the peer is known-capable', () => {
    // typing/read + call-end carry no inner auth — a capable peer's real traffic is
    // sealed, so plaintext copies are forged. `wasSealed` must gate them or sealed
    // envelopes get dropped after restore.
    expect(html).toContain("!wasSealed && (s.type === 'typing' || s.type === 'read')");
    expect(html).toContain("!wasSealed && s.type === 'call-end'");
    expect(html).toContain('wasSealed = true');
  });
  it('seal is sign-then-seal: SDP signature rides INSIDE the ciphertext', () => {
    // The {sdp,sig,sigPub} wrapper is produced before _signal seals the payload —
    // verify the receiver unseals BEFORE the signature check runs.
    const unsealAt = html.indexOf('_unsealDmSignal(sigRoom, s.data)');
    const verifyAt = html.indexOf('verifySignature(wrapper.sdp');
    expect(unsealAt).toBeGreaterThan(-1);
    expect(verifyAt).toBeGreaterThan(unsealAt);
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
  it('group messages carry a per-sender signature (member-forgery defense, eprint 2025/554)', () => {
    // Every member holds every member's chain key for decryption — without a signature
    // any member can encrypt under another member's ck and claim `from: victim`. The
    // sender's Ed25519 key rides the sender-key distribution (sigPub); receivers that
    // recorded it MUST reject sig-less envelopes (a stripped/forged one) and verify the
    // sig over the canonical context; legacy senders (no sigPub on record) stay accepted.
    expect(html).toContain('sigPub: _signingPubB64 || undefined');
    expect(html).toContain('skEntry.sigPub = skMsg.sigPub');
    expect(html).toContain("breeze-group-msg:${groupId}:${out.ep | 0}:${out.c}:");
    expect(html).toContain("breeze-group-msg:${groupId}:${p.ep | 0}:${p.c | 0}:");
    expect(html).toContain('if (peerSK.sigPub)');
    expect(html).toContain("typeof p.sg === 'string' && p.sg && await verifySignature");
    expect(html).toContain('if (sgOk !== true) return null');
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
  it('device registry: stale signed records are rejected (monotonic ts floor)', () => {
    // A relay can replay an old signed registry to resurrect an unlinked device —
    // verified-and-stale must reject, not degrade silently to accepting it.
    expect(html).toContain('rec.ts < floor');
    expect(html).toContain("_devFloorBump(accountId, rec.ts)");
    expect(html).toContain("'devFloor'");
  });
  it('linkto pins rootEd only after the record sig verifies under it', () => {
    // rootEd rides OUTSIDE the signed blob — a relay could swap it to its own key and
    // make every future registry read "verify". The record's own sig (made by the real
    // root key) must verify under the candidate rootEd before it is pinned.
    const linkto = html.slice(html.indexOf("val.startsWith('/linkto '"));
    expect(linkto).toContain('verifySignature(`breeze-device-set:${rootPub.slice(0, 12)}:${rec.ts}:${digest}`');
    expect(linkto).toContain('if (okSig === true) rootEd = rec.rootEd');
  });
});
