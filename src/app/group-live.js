// ============================================================================
// GROUP LIVE RECEPTION — D25 wave 10: group traffic reaches linked devices.
//
// The gap this closes (measured on main e2fe409): every group deposit —
// message, sender-key distribution, persistent signal, kick notice — was
// addressed to the member's ROOT mailbox, and every device polls only its
// OWN mailbox ({ id: myId } in the poll cycle). A linked secondary device
// therefore never received group traffic live; history sync does not cover
// groups either (history-sync.js: "1:1 only; group history stays
// per-device for now"), so a secondary saw only its own sends (wave 6).
//
// The fix is addressing, not new crypto — the sender-key model makes it
// cheap: ONE ciphertext serves every copy (no per-device re-encryption),
// and the receive side already resolves device senders through the root's
// SIGNED device registry, stores peer sender keys per sender DEVICE id,
// and dedups by (root member id, ts). So the sender additionally deposits
// the identical envelope into the mailbox of every VERIFIED device of
// every member, and distributes its sender key to those devices too
// (encrypted per device, like the root distribution). Devices come only
// from _devicesFor / _myOtherDevices — both read the signature-verified
// registry and fall back to the root alone when it cannot be verified,
// so single-device accounts see byte-identical behaviour.
//
// Own-account copies (my primary's group messages on my secondary and
// vice versa) are flagged selfSync, mirroring the 1:1 fan-out. Since
// wave 12, group-call control ({gctl}) DOES ride depositCopies too —
// the host wraps it with the gctl flag preserved — so call invites
// reach linked devices and any device can hold the call seat.
//
// Deposit cost: per group message, deposits grow from (members - 1) to
// the sum of verified devices per member plus my other devices. The
// Worker caps a registry at 10 devices and the observed norm is 1-2, so
// the multiplier is ~1-2x — inside the fan-out coefficient F (1.5 light /
// 3.0 heavy) that docs/COST_MODEL.md already prices. Sender-key device
// distributions ride the same SK_REDIST_EVERY cadence as root ones.
// ============================================================================

// Pure planner: which EXTRA mailboxes a group send must deposit into.
// members: roster [{ id, pubB64 }] INCLUDING the sender's own account.
// devicesByMember: { memberId: [pub, ...] } — verified device lists (each
// includes the member's root pub). ownPubs: my account's other device
// pubs (may include my root when I am a secondary). Returns one entry
// per extra mailbox: { to, pub, own } — never a member root (the main
// deposit loop covers those), never my own pub, never a duplicate.
// `own` marks mailboxes of MY account, whose copies are selfSync.
export function planLiveTargets(members, devicesByMember, ownPubs, myPub, myRootPub) {
  const covered = new Set();
  for (const m of members || []) if (m?.pubB64) covered.add(m.pubB64);
  const seen = new Set();
  const out = [];
  const push = (pub, own) => {
    if (!pub || pub === myPub || covered.has(pub) || seen.has(pub)) return;
    seen.add(pub);
    out.push({ to: pub.slice(0, 12), pub, own: !!own });
  };
  for (const m of members || []) {
    if (!m?.id || !m?.pubB64) continue;
    const own = m.pubB64 === myRootPub;
    for (const pub of (devicesByMember && devicesByMember[m.id]) || []) push(pub, own);
  }
  // My own devices are targets even when the roster on this device does
  // not list my account (e.g. an invite-shaped roster): the root copy is
  // only skipped when a member deposit actually covers it (covered set).
  for (const pub of ownPubs || []) push(pub, true);
  return out;
}

// Sender side, host-wired (the location-factory pattern). The cadence
// state for device distributions lives in this instance: per
// (group, device) it mirrors distributeSenderKey's rule — first sight,
// epoch change, roster change, or every SK_REDIST_EVERY sends.
export function createGroupLive(D) {
  const dist = new Map();

  async function devicesOf(member) {
    try {
      const list = await D.devicesFor(member);
      return (list || []).filter(p => p && p !== member.pubB64);
    } catch(e) { D.dbg(e, 'live-devices'); return []; }
  }

  function senderKeyPayload(sk, groupId) {
    return (D.groupRatchetV5() && sk.v === 5)
      ? { type: 'sender_key', groupId, chainKey: sk.chainKey, epoch: sk.epoch, v: 5 }
      : { type: 'sender_key', groupId, key: sk.raw, epoch: sk.epoch };
  }

  // Distribute my sender key for groupId to the given device pubs,
  // cadence-tracked per device. Shared by member devices and my own.
  async function distributeKeyToPubs(groupId, pubs, force, rosterSize) {
    if (!pubs.length) return;
    try {
      const sk = await D.getSenderKey(groupId);
      if (!sk) return;
      const payload = JSON.stringify({ ...senderKeyPayload(sk, groupId), ...await D.authorCapability?.(groupId) });
      const every = D.skRedistEvery();
      for (const devPub of pubs) {
        const devId = devPub.slice(0, 12);
        const dkey = groupId + ':' + devId;
        const rec = dist.get(dkey);
        if (!force && rec && rec.epoch === sk.epoch && rec.count < every && (!rosterSize || rec.roster === rosterSize)) { rec.count++; continue; }
        const encrypted = await D.encryptFor(payload, devPub);
        if (!encrypted) { D.dbg(null, 'live-sk encrypt failed'); continue; }
        await D.relaySend(devId, { to: devId, from: D.myId(), fromPub: D.myPubB64(), fromName: D.myName(), payload: encrypted, ts: Date.now(), isSenderKey: true, ...(D.acctRoot() ? { acctRoot: D.acctRoot() } : {}) }, devPub);
        dist.set(dkey, { epoch: sk.epoch, count: 0, roster: rosterSize || rec?.roster || 0 });
      }
    } catch(e) { D.dbg(e, 'live-sk-dist'); }
  }

  // Sender-key distribution to one roster member's verified devices.
  async function distributeKey(groupId, member, force = false, rosterSize = 0) {
    if (!member?.pubB64) return;
    await distributeKeyToPubs(groupId, await devicesOf(member), force, rosterSize);
  }

  // My sender key to my OTHER devices (primary -> secondaries, and a
  // secondary -> its siblings; the root itself is reached as a roster
  // member when the roster lists my account, and via ownPubs planning
  // here when it does not — myOtherDevices includes the root for a
  // secondary, so both directions are covered exactly once per cadence).
  async function distributeOwnKey(groupId, rosterSize = 0) {
    let pubs = [];
    try { pubs = (await D.myOtherDevices()) || []; } catch(e) { D.dbg(e, 'live-own-devices'); }
    await distributeKeyToPubs(groupId, pubs.filter(p => p && p !== D.myPubB64()), false, rosterSize);
  }

  // Deposit the SAME sender-key ciphertext into every planned device
  // mailbox. fields carries the caller's envelope extras (ts, groupId,
  // groupName, and replyTo/disappearAt on the text path). Own-account
  // copies are flagged selfSync like the 1:1 fan-out's.
  async function depositCopies(members, ciphertext, fields) {
    try {
      fields = { ...fields, ...await D.authorFields?.(fields.groupId, ciphertext) };
      const byMember = {};
      await Promise.all((members || []).map(async (m) => {
        if (m?.id) byMember[m.id] = await D.devicesFor(m).catch(() => null);
      }));
      let ownPubs = [];
      try { ownPubs = (await D.myOtherDevices()) || []; } catch(e) { D.dbg(e, 'live-own-devices'); }
      const targets = planLiveTargets(members, byMember, ownPubs, D.myPubB64(), D.myRootPub());
      await D.poolMap(targets, 8, async (t) => {
        try {
          await D.relaySend(t.to, { to: t.to, from: D.myId(), fromPub: D.myPubB64(), fromName: D.myName(), payload: ciphertext, ...fields, isGroupSK: true, ...(D.acctRoot() ? { acctRoot: D.acctRoot() } : {}), ...(t.own ? { selfSync: true } : {}) }, t.pub);
        } catch(e) { D.dbg(e, 'live-deposit'); }
      });
    } catch(e) { D.dbg(e, 'live-deposit-copies'); }
  }

  // Per-device ENCRYPTED deposit of a plaintext control payload (group
  // signals, kick notices): unlike message copies these ride the 1:1
  // ratchet, so each device gets its own ciphertext, exactly like the
  // root deposit it mirrors. fields may carry ts (signals) — it wins
  // over the default clock.
  async function depositEncrypted(member, plaintext, fields) {
    if (!member?.pubB64) return;
    const pubs = await devicesOf(member);
    await D.poolMap(pubs, 8, async (devPub) => {
      try {
        const encrypted = await D.encryptFor(plaintext, devPub);
        if (!encrypted) return;
        const devId = devPub.slice(0, 12);
        await D.relaySend(devId, { to: devId, from: D.myId(), fromPub: D.myPubB64(), fromName: D.myName(), payload: encrypted, ts: Date.now(), ...fields, ...(D.acctRoot() ? { acctRoot: D.acctRoot() } : {}) }, devPub);
      } catch(e) { D.dbg(e, 'live-deposit-enc'); }
    });
  }

  return { distributeKey, distributeOwnKey, depositCopies, depositEncrypted };
}
