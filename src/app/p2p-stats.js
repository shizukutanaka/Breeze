// ============================================================================
// P2P ON-DEVICE STATISTICS — P2P_PLAN Step 1 (measurement + display).
//
// The no-telemetry rule (§0-3 of the plan) forbids server-side aggregation,
// so "what fraction of delivery is actually direct?" can only ever be
// answered on the device itself, for the device's own user. This module is
// the counter store behind that answer:
//
//   delivery  (localStorage 'brz-p2p-direct' — the Step 2 seed counters,
//              shape preserved so pre-Step-1 counts carry over):
//              directAck   = direct send whose post-persistence ack let the
//                            sender skip the mailbox deposit;
//              directNoAck = direct send attempted, deposit still made.
//              directRate  = directAck / (directAck + directNoAck).
//   routes    (localStorage 'brz-p2p-conn'):
//              one count per ESTABLISHED peer session, classified by the
//              selected local ICE candidate (host → direct, srflx/prflx →
//              srflx, relay → turn), plus 'failed' for attempts that hit
//              the connect timeout without ever connecting.
//
// Storage arrives via deps ({ load(key) -> object|null, save(key, obj) })
// so the counting math is unit-testable without a DOM; index.html injects
// a localStorage-backed adapter. Every operation is best-effort: a
// throwing store degrades to in-memory counts for the session, never to
// a broken send path (the feature degrades, the product doesn't).
// ============================================================================

export function classifyCandidateType(type) {
  if (type === 'relay') return 'turn';
  if (type === 'srflx' || type === 'prflx') return 'srflx';
  if (type === 'host') return 'direct';
  return null;
}

const DELIVERY_KEY = 'brz-p2p-direct';
const CONN_KEY = 'brz-p2p-conn';

function saneCount(v) {
  return (typeof v === 'number' && Number.isFinite(v) && v > 0) ? Math.floor(v) : 0;
}

export function createP2pStats(D = {}) {
  const load = typeof D.load === 'function' ? D.load : () => null;
  const save = typeof D.save === 'function' ? D.save : () => {};

  function read(key) {
    try {
      const v = load(key);
      return (v && typeof v === 'object') ? v : {};
    } catch { return {}; }
  }
  function write(key, obj) {
    try { save(key, obj); } catch { /* counters are best-effort by design */ }
  }
  function bump(key, field) {
    const s = read(key);
    s[field] = saneCount(s[field]) + 1;
    write(key, s);
  }

  return {
    // A direct delivery attempt resolved: acked=true means the deposit
    // was skipped (fully direct), false means the deposit still happened.
    noteDelivery(acked) { bump(DELIVERY_KEY, acked ? 'directAck' : 'directNoAck'); },

    // One peer session established; candidateType is the selected local
    // candidate's ICE type ('host' | 'srflx' | 'prflx' | 'relay').
    // Unknown types are ignored rather than miscounted.
    noteConnection(candidateType) {
      const route = classifyCandidateType(candidateType);
      if (route) bump(CONN_KEY, route);
    },

    // One connection attempt that never established (connect timeout).
    noteConnectionFailed() { bump(CONN_KEY, 'failed'); },

    snapshot() {
      const d = read(DELIVERY_KEY);
      const directAck = saneCount(d.directAck);
      const directNoAck = saneCount(d.directNoAck);
      const directTotal = directAck + directNoAck;
      const c = read(CONN_KEY);
      const conn = {
        direct: saneCount(c.direct),
        srflx: saneCount(c.srflx),
        turn: saneCount(c.turn),
        failed: saneCount(c.failed),
      };
      const connTotal = conn.direct + conn.srflx + conn.turn;
      return {
        directAck,
        directNoAck,
        directTotal,
        // null (not 0%) when nothing has been measured yet — the display
        // must not claim a rate it has no samples for.
        directRate: directTotal > 0 ? directAck / directTotal : null,
        conn,
        connTotal,
        connFailed: conn.failed,
      };
    },
  };
}
