// Server-situation hints (2026-11-27, Socratic round on first-run
// success): two surfaces that must agree with the server gate about
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
//    contact, peer not connected — and the hint names the way out
//    (exchange connection codes, which connects the peer and flushes
//    the outbox). It is a statement about this device only: it never
//    claims a message was or was not delivered elsewhere.
export function noDefaultBannerNeeded(s) {
  return !!s.flagOn && !(s.relayCount > 0) && !s.hasRoom;
}

export function deliveryStuck(s) {
  if (!s || s.isGroup || !s.hasPub || s.mockOn) return false;
  if (s.peerOpen) return false;
  if (s.relayCount > 0 || s.contactHomes > 0) return false;
  return (s.queued || 0) > 0;
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

  let hintEl = null, hintText = null, hintBtn = null;
  function ensureHint() {
    if (hintEl) return hintEl;
    const bar = deps.inputBar(); if (!bar || !bar.parentElement) return null;
    hintEl = document.createElement('div');
    hintEl.id = 'msg-delivery-hint'; hintEl.className = 'delivery-hint hidden'; hintEl.setAttribute('role', 'note');
    hintText = document.createElement('span');
    hintBtn = document.createElement('button');
    hintBtn.type = 'button'; hintBtn.className = 'btn btn-o btn-sm';
    hintBtn.addEventListener('click', () => { const c = deps.getActiveContact(); if (c) deps.openRendezvous(c); });
    hintEl.append(hintText, hintBtn);
    bar.parentElement.insertBefore(hintEl, bar);
    return hintEl;
  }

  function updateDeliveryHint() {
    const c = deps.getActiveContact();
    const stuck = deliveryStuck({
      isGroup: !!c?.isGroup, hasPub: !!c?.pubB64, mockOn: deps.isMock(),
      peerOpen: c?.pubB64 ? deps.peerOpen(c.pubB64) : false,
      relayCount: deps.relayCount(), contactHomes: c ? deps.contactHomes(c) : 0,
      queued: c?.pubB64 ? deps.queuedFor(c.pubB64) : 0,
    });
    if (!stuck) { if (hintEl) hintEl.classList.add('hidden'); return; }
    if (!ensureHint()) return;
    hintText.textContent = deps.t('deliveryHintText', String(deps.queuedFor(c.pubB64)), c.name || '');
    hintBtn.textContent = deps.t('deliveryHintAction');
    hintEl.classList.remove('hidden');
  }

  return { updateBanner, updateDeliveryHint };
}
