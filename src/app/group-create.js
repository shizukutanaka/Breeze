import { safeName } from './lookalike-names.js';

// Breeze — group creation flows (moved out of index.html in the
// stage 5 step 4 line-budget pass; behavior unchanged).
// createGroup: pick members from the contact list by number, enforce
// the member cap, store the group, and deposit an encrypted invite to
// each member. With no selection it falls back to a server-backed
// invite-link group (createGroupInviteLink). All host capabilities
// arrive as deps; nothing here touches storage or the DOM directly
// beyond what the deps expose.

export function createGroupCreate(D) {
  async function createGroup(name) {
    try {
      const contacts = await D.dbGetAll('contacts');
      const list = contacts.filter(c => !c.isGroup).map((c, i) => `${i + 1}. ${safeName(c.name)}`).join('\n');
      const sel = await D.showPrompt(D.t('addMembersPrompt') + '\n' + list, '', { placeholder: '1,2,3' });

      if (!sel || !sel.trim()) {
        // No members selected → create server-backed invite link
        await createGroupInviteLink(name);
        return;
      }

      const indices = sel.split(',').map(s => parseInt(s.trim()) - 1).filter(i => !isNaN(i));
      const members = indices.map(i => contacts[i]).filter(Boolean).map(c => ({ id: c.id, pubB64: c.pubB64, name: c.name }));
      if (members.length === 0) { await createGroupInviteLink(name); return; }
      if (D.groupV5() || D.authorCaps?.().length) {
        const capsById = await D.fetchCaps(members.map(m => m.id));
        for (const m of members) m.caps = capsById[m.id] || [];
      }
      members.push({ id: D.myId(), pubB64: D.myPubB64(), name: D.myName(), caps: [...(D.groupV5() ? [D.capsGroupV5()] : []), ...(D.authorCaps?.() || [])] });

      // A3: Group member limit
      const maxMembers = D.groupMax();
      if (members.length > maxMembers) {
        D.showToast(D.t('upgGroup', maxMembers), 'error');
        return;
      }

      const groupId = 'g_' + D.uid();
      await D.dbPut('contacts', {
        id: groupId, name, isGroup: true, members,
        addedAt: Date.now(), unread: 0, pubB64: '', createdBy: D.myId()
      });
      D.auditLog('group', 'Created group: ' + name + ' (' + members.length + ' members)');
      await D.renderContacts();

      const invite = await D.invitation?.({ type: 'group_invite', groupId, name, members }) || { type: 'group_invite', groupId, name, members };
      for (const m of members) {
        if (m.id === D.myId()) continue;
        const encrypted = await D.encryptFor(JSON.stringify(invite), m.pubB64);
        if (!encrypted) { D.dbg(null, 'encrypt failed for invite to ' + m.id?.slice(0, 8)); continue; }
        await D.relaySend(m.id, { to: m.id, from: D.myId(), fromPub: D.myPubB64(), fromName: D.myName(), payload: encrypted, ts: Date.now(), isGroupInvite: true }, m.pubB64);
      }

    } catch(_e) { D.dbg(_e, 'createGroup'); }
  }

  // Create server-backed group with shareable invite link
  async function createGroupInviteLink(name) {
    if (!D.hasApi()) { D.showToast(D.t('toastServerRequired'), 'error'); return; }
    try {
      const gcaps = [...(D.groupV5() ? [D.capsGroupV5()] : []), ...(D.authorCaps?.() || [])];
      const resp = await D.postAPIRaw('/group/create', { name, creatorId: D.myId(), creatorPub: D.myPubB64(), creatorName: D.myName(), caps: gcaps,
        ...(await D.groupCreateAuth(D.myPubB64(), name, D.myName(), gcaps)) });
      if (!resp.ok) { D.showToast(D.t('toastGroupFail'), 'error'); return; }
      const data = await resp.json();
      const groupId = 'g_' + data.token;
      await D.dbPut('contacts', {
        id: groupId, name, isGroup: true, joinToken: data.token, createdBy: D.myId(), // isGroupAdmin() needs createdBy or the creator fails their own /admin checks (E2E-found)
        members: [{ id: D.myId(), pubB64: D.myPubB64(), name: D.myName() }],
        addedAt: Date.now(), unread: 0, pubB64: ''
      });
      const invite = await D.invitation?.({ type: 'group_invite', groupId, name, members: [{ id: D.myId(), pubB64: D.myPubB64(), name: D.myName(), caps: gcaps }] });
      await D.renderContacts();

      // Generate and share invite link
      const joinUrl = D.origin() + D.pathname() + '?join=' + data.token + (invite?.protectionInvite ? '&invite=' + encodeURIComponent(JSON.stringify(invite)) : '');
      D.clipboardWrite(joinUrl);

      const [box, d] = D.cmdPanel('import-result');
      D.safeSetHTML(d, `<div class="i-title-g">${D.t('groupCreated', D.esc(name))}</div>
         <div class="i-mb12">${D.t('shareInvite')}</div>
         <div class="i-mono-box">${D.esc(joinUrl)}</div>
         <div class="i-g12">${D.t('clipboardCopied')}</div>`);
      box.replaceChildren();
      box.appendChild(d);

      startGroupMemberPoll(data.token, groupId); // creator otherwise only learns of joiners on next boot —
      // MUST precede the share await: a pending share sheet suspends this function,
      // and on browsers where share() never resolves (no gesture, headless) the poll never starts.
      await D.share({ title: D.t('groupInviteShareTitle', name), url: joinUrl });
    } catch(e) { D.dbg(e, 'grp'); D.showToast(D.t('toastGroupInviteFail'), 'error'); }
  }

  function startGroupMemberPoll(token, groupId) {
    if (!D.hasApi()) return;
    let polling = false, stopped = false, timer = null;
    const floor = () => (typeof D.powerFloorMs === 'function' ? (D.powerFloorMs() || 0) : 0);
    function schedule() {
      if (stopped) return;
      timer = setTimeout(tick, Math.max(5000, floor()));
      D.pushInterval?.(timer);
    }
    function stop() {
      stopped = true;
      if (timer) { clearTimeout(timer); timer = null; }
    }
    async function tick() {
      timer = null;
      if (stopped) return;
      if (D.powerOff?.() || polling) { schedule(); return; }
      polling = true;
      try {
        const resp = await D.postAPIRaw('/group/info', { token });
        if (!resp.ok) { stop(); return; }
        const data = await resp.json();
        const group = await D.dbGet('contacts', groupId);
        if (!group) { stop(); return; }

        const oldCount = group.members?.length || 0;
        const newMembers = safeMemberList(data.members);
        if (newMembers.length > oldCount) {
          if (D.admitRoster && !await D.admitRoster(group, newMembers)) return;
          group.members = newMembers;
          await D.dbPut('contacts', group);
          // sendMessage reads activeContact.members (separate object) — without this an open group silently excludes new joiners until reopened.
          D.syncActiveMembers(groupId, newMembers);
          // Add new individual contacts
          for (const m of newMembers) {
            if (m.id === D.myId()) continue;
            if (!(await D.dbGet('contacts', m.id))) await D.addContact(m.pubB64, m.name);
          }
          D.renderContacts();
        }
      } catch(e) { D.dbg(e); } finally { polling = false; schedule(); }
    }
    schedule();
    // Stop after 30 minutes
    const stopTimer = setTimeout(stop, 30 * D.minMs());
    D.pushInterval?.(stopTimer);
  }

  async function processJoinToken(token) {
    if (!D.hasApi()) return;
    try {
      const linkInvite = D.linkInvite?.();
      // Join the group on server
      const joinCaps = [...(D.groupV5() ? [D.capsGroupV5()] : []), ...(D.authorCaps?.() || [])];
      const joinAuth = D.groupJoinAuth ? await D.groupJoinAuth(token, D.myPubB64(), D.myName(), joinCaps) : {};
      const resp = await D.postAPIRaw('/group/join', { token, memberId: D.myId(), memberPub: D.myPubB64(), memberName: D.myName(), caps: joinCaps, ...joinAuth });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        D.showToast(err.error || D.t('toastJoinFail'), 'error');
        return;
      }
      const data = await resp.json();

      // Create local group contact
      const groupId = 'g_' + token;
      const existing = await D.dbGet('contacts', groupId);
      if (existing) {
        // Update members list
        const next = safeMemberList(data.members);
        if (!D.admitRoster || await D.admitRoster(existing, next)) {
          existing.members = next;
          await D.dbPut('contacts', existing);
        }
      } else {
        await D.dbPut('contacts', {
          id: groupId, name: typeof data.name === 'string' ? data.name.slice(0, 64) : 'Group',
          isGroup: true, joinToken: token,
          members: safeMemberList(data.members),
          addedAt: Date.now(), unread: 0, pubB64: ''
        });
      }

      // Also add individual contacts for each member
      for (const m of safeMemberList(data.members)) {
        if (m.id === D.myId()) continue;
        if (!(await D.dbGet('contacts', m.id))) {
          await D.addContact(m.pubB64, m.name);
        }
      }
      if (!existing && linkInvite) await D.acceptLink(groupId, linkInvite);

      await D.renderContacts();

      // Open the group conversation
      const group = await D.dbGet('contacts', groupId);
      if (group) D.openConversation(group);

      // Clean URL
      D.cleanUrl();

      // Start polling for new members
      startGroupMemberPoll(token, groupId);
    } catch(e) { D.dbg(e, 'join'); D.showToast(D.t('toastJoinFail'), 'error'); }
  }

  return { createGroup, createGroupInviteLink, startGroupMemberPoll, processJoinToken };
}

// Sanitize a server-returned member list to known-safe field sizes. The
// roster is relay-supplied (untrusted): an account id is defined as the
// pub's first 12 base64 chars, so require pubB64.slice(0,12) === id —
// otherwise a tampered roster can bind a member's id to an attacker's
// pub and every fan-out (sender keys, group sends, kick notices)
// silently encrypts that member's share to the attacker.
export function safeMemberList(raw, max = 1000) { // max tracks CONFIG.GROUP_MAX (stage 5 step 3)
  return (Array.isArray(raw) ? raw : [])
    .map(m => (m && typeof m === 'object') ? {
      id: typeof m.id === 'string' ? m.id.slice(0, 128) : '',
      pubB64: typeof m.pub === 'string' ? m.pub.slice(0, 200) : (typeof m.pubB64 === 'string' ? m.pubB64.slice(0, 200) : ''),
      name: typeof m.name === 'string' ? m.name.slice(0, 64) : 'Member',
      caps: Array.isArray(m.caps) ? m.caps.filter(c => typeof c === 'string').slice(0, 20).map(c => String(c).slice(0, 32)) : undefined,
    } : { id: '', pubB64: '', name: 'Member' })
    .filter(m => m.id && /^[A-Za-z0-9+/=]{12,200}$/.test(m.pubB64) && m.pubB64.slice(0, 12) === m.id)
    .slice(0, max);
}
