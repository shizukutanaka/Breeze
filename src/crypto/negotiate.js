// ============================================================================
// Breeze — Protocol version negotiation (N3)
//
// Two clients agree on which v5 features to use based on the capability
// sets each advertises in its presence beacon and pre-key bundle. The rule
// is "AND": a feature is used only when both sides support it — no silent
// downgrade, no peer coercion into a weaker path.
//
// Backward-compatible: a legacy v4 client has no `caps` field; all v5
// features default to off (parsePeerCaps returns []).
//
// CONFIG.X3DH_V5_ENABLED, CONFIG.GROUP_RATCHET_V5 gate feature emission;
// the receive path always tries the highest version first (v5 > v4 > v3).
// ============================================================================

// Stable capability identifiers (strings carried over the wire).
export const CAPS = {
  X3DH_V5:   'x3dh-v5',   // authenticated X3DH, I1 (sign/verify SPK)
  GROUP_V5:  'group-v5',  // group FS + PCS + per-msg auth, I2/I3/N2
  FRANKING:  'franking',  // message franking send/report, I17
};

// The full v5 capability set (pass to advertise() for a fully-upgraded client).
export const ALL_V5 = Object.values(CAPS);

// Advertise local capabilities in a presence/bundle record.
// Returns a small object to merge into the presence/bundle payload.
export function advertise(localCaps = ALL_V5) {
  return {
    caps: localCaps,
    // Legacy compat: `x3dh` field so a pre-caps peer can see we support v5.
    x3dh: localCaps.includes(CAPS.X3DH_V5) ? 'v5' : 'v4',
  };
}

// Extract capabilities from a peer's presence/bundle record.
// Returns an array of capability strings. Empty for a legacy v4 peer.
export function parsePeerCaps(bundle) {
  if (!bundle) return [];
  if (Array.isArray(bundle.caps)) return bundle.caps;
  // Legacy fallback: infer from the `x3dh` field.
  const caps = [];
  if (bundle.x3dh === 'v5') caps.push(CAPS.X3DH_V5);
  return caps;
}

// Agree on which features to use given local and peer capability sets.
// Returns a negotiation result object used by the session-init code path.
// Rule: use a feature only when BOTH sides advertise it.
export function negotiate(localCaps, peerCaps) {
  const local = new Set(localCaps);
  const peer  = new Set(peerCaps);
  const both  = (cap) => local.has(cap) && peer.has(cap);
  return {
    useX3dhV5:  both(CAPS.X3DH_V5),
    useGroupV5: both(CAPS.GROUP_V5),
    useFranking: both(CAPS.FRANKING),
  };
}

// Group capability floor: a group feature is enabled only when EVERY member — us plus
// each peer in `memberCapsList` (e.g. each member's presence `caps` array) — advertises
// it. This is the N-party generalization of negotiate()'s AND rule: a single legacy
// member keeps the whole group on the backward-compatible path (no silent split where
// some members emit v5 the others can't read). An empty member list means "just us".
export function negotiateGroup(localCaps, memberCapsList = []) {
  const sets = [new Set(localCaps), ...memberCapsList.map((c) => new Set(Array.isArray(c) ? c : []))];
  const all = (cap) => sets.every((s) => s.has(cap));
  return {
    useGroupV5: all(CAPS.GROUP_V5),
    useFranking: all(CAPS.FRANKING),
  };
}
