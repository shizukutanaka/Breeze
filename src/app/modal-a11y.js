// D17: accessibility for the overlay modals. The app's dialogs come in
// two families: native <dialog> (showModal already traps focus, sets
// the top layer and handles ESC) and hand-rolled overlays — a fixed
// backdrop div holding a .modal box, appended to <body> by ~30 call
// sites that each invented their own open/close wiring. Only TWO of
// the overlays carried aria-modal, none trapped Tab, and initial focus
// was whatever the site remembered to do. Rather than editing every
// site, this installer watches <body> for overlays containing a
// .modal and enhances each one as it appears: role/aria-modal on the
// box, initial focus to the first focusable control (unless the site
// already focused something inside — several pickers do), a Tab trap
// on the overlay, and focus restoration to the opener when the
// overlay is removed. Sites keep their own close gestures (backdrop
// click, buttons, ESC where wired); this layer only governs focus.
// Absent or failed module ⇒ modals behave exactly as before.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(root) {
  if (!root?.querySelectorAll) return [];
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => {
    if (el.hidden) return false;
    // display:none controls (e.g. a .d-none row) report no rects and
    // focusing them is a no-op that would strand the trap's wrap math.
    if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false;
    return true;
  });
}

export function enhanceModal(root, doc) {
  const modal = root.classList?.contains('modal') ? root : root.querySelector?.('.modal');
  if (!modal || root.__breezeModalA11y) return null;
  root.__breezeModalA11y = true;
  if (!modal.getAttribute('role')) modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const prev = doc.activeElement || null;
  const onKey = (ev) => {
    if (ev.key !== 'Tab') return;
    const items = focusableIn(modal);
    if (!items.length) { ev.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1], cur = doc.activeElement;
    if (!modal.contains(cur)) { ev.preventDefault(); first.focus(); }
    else if (ev.shiftKey && cur === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && cur === last) { ev.preventDefault(); first.focus(); }
  };
  root.addEventListener('keydown', onKey);
  if (!modal.contains(doc.activeElement)) {
    const items = focusableIn(modal);
    if (items.length) items[0].focus();
    else { modal.setAttribute('tabindex', '-1'); modal.focus?.(); }
  }
  let released = false;
  return function release() {
    if (released) return;
    released = true;
    root.removeEventListener?.('keydown', onKey);
    delete root.__breezeModalA11y;
    const cur = doc.activeElement;
    if (prev && typeof prev.focus === 'function' && doc.contains?.(prev)
      && (!cur || cur === doc.body || root.contains(cur))) prev.focus();
  };
}

export function installModalA11y(env = {}) {
  const doc = env.document || globalThis.document;
  const MO = env.MutationObserver || globalThis.MutationObserver;
  if (!doc?.body || typeof MO !== 'function') return { disconnect() {} };
  const releases = new Map();
  const obs = new MO((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes || []) {
        if (node?.nodeType !== 1) continue;
        const release = enhanceModal(node, doc);
        if (release) releases.set(node, release);
      }
      for (const node of rec.removedNodes || []) {
        const release = releases.get(node);
        if (release) { releases.delete(node); release(); }
      }
    }
  });
  obs.observe(doc.body, { childList: true });
  return { disconnect() { obs.disconnect(); for (const r of releases.values()) r(); releases.clear(); } };
}

export default installModalA11y;
