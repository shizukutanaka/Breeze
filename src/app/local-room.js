// Local room (on-the-spot server, 2026-11-27 design): this device
// itself acts as the server for people nearby, using the existing
// in-person paths (invite, offline pairing, rendezvous). The room
// record lives in settings; the gate treats an active room as having
// a server. The honest limit (the host must stay here and awake) is
// stated in the gate copy. The join side: a 1-to-1 invite landing
// (?add=) is a door into the inviter's room — joining records the
// room under the inviter's name, never as the user's own server, and
// satisfies the gate, so an invited first run needs no server of
// their own. Group join tokens (?join=) are not covered: a group
// lives on a relay, so joining one honestly requires reaching it.
export function inviteParam(P, k) { return P && typeof P.get === 'function' ? P.get(k) : null; }

export function inviteHostName(P) {
  const addKey = inviteParam(P, 'add');
  if (!addKey) return null;
  const cleanName = (inviteParam(P, 'name') || '').trim();
  return cleanName || (addKey.startsWith('@') ? addKey : null);
}

export function createLocalRoomActions(deps) {
  async function start() {
    const settings = deps.getSettings();
    if (settings.localRoom) { deps.updateGate(); return; }
    settings.localRoom = { startedAt: Date.now() };
    await deps.saveSettings();
    deps.updateGate();
    deps.showToast(deps.t('gateLocalStarted'), 'success');
    if (deps.getMyId()) { try { await deps.shareInvite(); } catch (e) { deps.dbg(e, 'local-room-invite'); } }
  }
  async function stop() {
    const settings = deps.getSettings();
    if (!settings.localRoom) return;
    delete settings.localRoom;
    await deps.saveSettings();
    deps.updateGate();
    deps.showToast(deps.t('gateLocalStopped'), 'success');
  }
  async function join() {
    const settings = deps.getSettings();
    if (settings.localRoom) { deps.updateGate(); return; }
    settings.localRoom = { startedAt: Date.now(), joined: true, hostName: inviteHostName(deps.P) || '' };
    await deps.saveSettings();
    deps.updateGate();
    deps.showToast(deps.t('gateJoinedStarted'), 'success');
  }
  return { start, stop, join };
}
