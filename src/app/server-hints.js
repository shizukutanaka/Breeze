// Server-situation hints (2026-11-27, Socratic round on first-run
// success): surfaces that must agree with the server gate about
// what "having a server" means, and must never let a delivery failure
// stay silent.
//
// 1. The no-default-server banner. The gate treats a local room as
//    having a server; the banner originally only knew about relays,
//    so a room host and a room guest both kept seeing "No server is
//    configured" while the gate said the opposite. bannerNeeded() is
//    the single rule both surfaces now share.
//
// 2. The delivery hint. With no relay on either side and the peer not
//    connected, a sent message sits in the local outbox with a check
//    mark and no explanation (measured in the two-party first-run
//    walk, 2026-11-27). deliveryStuck() detects exactly that state —
//    queued locally, no relay of mine, no known home relay of the
//    contact, peer not connected — and the hint names the next step
//    that actually works from this state. Measured the same day: for
//    an invite-added contact, manual connection codes refuse (no
//    pinned signing key, no session yet), so the working first step
//    is in-person pairing; connection codes come once paired. The
//    hint is a statement about this device only: it never claims a
//    message was or was not delivered elsewhere.
//
// 3. The host waiting hint. Joining a room is an event on the guest's
//    device only; the host's screen shows nothing when someone joins.
//    While hosting with no chat open, hostWaiting() shows the
//    explanation and the same pairing entry instead of silence.
export function noDefaultBannerNeeded(s) {
  return !!s.flagOn && !(s.relayCount > 0) && !s.hasRoom;
}

export function deliveryStuck(s) {
  if (!s || s.isGroup || !s.hasPub || s.mockOn) return false;
  if (s.peerOpen) return false;
  if (s.relayCount > 0 || s.contactHomes > 0) return false;
  return (s.queued || 0) > 0;
}

export function hostWaiting(s) {
  if (!s || !s.flagOn || !s.hasRoom || s.roomJoined || s.chatOpen || s.mockOn) return false;
  return !(s.relayCount > 0);
}

export function createServerHints(deps) {
  function updateBanner() {
    if (!deps.isNoDefault()) return;
    const banner = deps.dom('msg-server-banner'); if (!banner) return;
    if (!noDefaultBannerNeeded({ flagOn: true, relayCount: deps.relayCount(), hasRoom: deps.hasRoom() })) {
      if (banner.dataset.noDefault) { banner.classList.add('hidden'); delete banner.dataset.noDefault; banner.onclick = null; }
      return;
    }
    const setup = deps.dom('msg-setup');
    if (setup && banner.parentElement?.id === 'msg-main') setup.parentElement.insertBefore(banner, setup);
    banner.dataset.noDefault = '1'; banner.classList.remove('hidden'); banner.textContent = deps.t('serverNoDefault');
    banner.onclick = () => deps.onBannerClick();
  }

  function makeHint(id, onClick) {
    const bar = deps.inputBar(); if (!bar || !bar.parentElement) return null;
    const el = document.createElement('div');
    el.id = id; el.className = 'delivery-hint hidden'; el.setAttribute('role', 'note');
    const text = document.createElement('span');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-o btn-sm';
    btn.addEventListener('click', onClick);
    el.append(text, btn);
    bar.parentElement.insertBefore(el, bar);
    return { el, text, btn };
  }

  let hint = null;
  function ensureHint() {
    if (hint) return hint;
    hint = makeHint('msg-delivery-hint', () => {
      const c = deps.getActiveContact(); if (!c) return;
      if (c.sigPub || c.offlinePairing?.state === 'paired') deps.openRendezvous(c);
      else deps.openPairing();
    });
    return hint;
  }

  let hostHint = null;
  function ensureHostHint() {
    if (hostHint) return hostHint;
    hostHint = makeHint('msg-host-hint', () => deps.openPairing());
    return hostHint;
  }

  function updateHostHint() {
    const waiting = hostWaiting({
      flagOn: deps.isNoDefault(), hasRoom: deps.hasRoom(), roomJoined: deps.roomJoined(),
      chatOpen: !!deps.getActiveContact(), mockOn: deps.isMock(), relayCount: deps.relayCount(),
    });
    if (!waiting) { if (hostHint) hostHint.el.classList.add('hidden'); return; }
    if (!ensureHostHint()) return;
    hostHint.text.textContent = deps.t('hostWaitText');
    hostHint.btn.textContent = deps.t('hostWaitAction');
    hostHint.el.classList.remove('hidden');
  }

  function updateDeliveryHint() {
    updateHostHint();
    const c = deps.getActiveContact();
    const stuck = deliveryStuck({
      isGroup: !!c?.isGroup, hasPub: !!c?.pubB64, mockOn: deps.isMock(),
      peerOpen: c?.pubB64 ? deps.peerOpen(c.pubB64) : false,
      relayCount: deps.relayCount(), contactHomes: c ? deps.contactHomes(c) : 0,
      queued: c?.pubB64 ? deps.queuedFor(c.pubB64) : 0,
    });
    if (!stuck) { if (hint) hint.el.classList.add('hidden'); return; }
    if (!ensureHint()) return;
    const paired = !!(c.sigPub || c.offlinePairing?.state === 'paired');
    hint.text.textContent = deps.t('deliveryHintText', String(deps.queuedFor(c.pubB64)), c.name || '');
    hint.btn.textContent = deps.t(paired ? 'deliveryHintConnect' : 'deliveryHintAction');
    hint.el.classList.remove('hidden');
  }

  return { updateBanner, updateDeliveryHint };
}
