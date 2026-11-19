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
const SIGNAL_KEY = 'brz-p2p-signal';
const TURN_KEY = 'brz-turn-usage';

// Stage 6 step 3: reduce one call's getStats report to the sample the
// TURN counters need — the selected pair's route and its byte total.
// Accepts the report's values as an array (RTCStatsReport is a Map).
// Returns null when no succeeded pair exists (nothing was measured;
// a missing sample must not masquerade as a direct call).
export function extractPairSample(statsValues) {
  if (!Array.isArray(statsValues)) return null;
  const byId = new Map(statsValues.filter(s => s && s.id).map(s => [s.id, s]));
  const pair = statsValues.find(s => s && s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated)
    || statsValues.find(s => s && s.type === 'candidate-pair' && s.state === 'succeeded');
  if (!pair) return null;
  const local = byId.get(pair.localCandidateId);
  const type = local?.candidateType || '';
  const bytes = (typeof pair.bytesSent === 'number' ? pair.bytesSent : 0) + (typeof pair.bytesReceived === 'number' ? pair.bytesReceived : 0);
  return { relayed: type === 'relay', route: classifyCandidateType(type), bytes };
}

function monthKey(ts = Date.now()) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

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

    // Sample a finished call's pc into the counters above. Lives on
    // the factory so both call managers share one implementation.
    sampleCall(pc, seconds) {
      try {
        pc.getStats().then(r => {
          const s = extractPairSample([...r.values()]);
          if (s) this.noteCallSample({ seconds, relayed: s.relayed, bytes: s.bytes });
        }).catch(() => {});
      } catch { /* counters are best-effort by design */ }
    },

    noteSignalSession() { bump(SIGNAL_KEY, 'sessions'); },
    noteSignalPoll(established) { bump(SIGNAL_KEY, established ? 'postEstablished' : 'preEstablished'); },

    // Stage 6 step 3: one finished call (or one group-call leg).
    // seconds/bytes are floored through saneCount; the monthly
    // window rolls over on its own so the operator-facing ratio —
    // TURN-relayed share of this month's call traffic — is always
    // current-month, never a lifetime blur.
    noteCallSample(sample) {
      if (!sample || typeof sample !== 'object') return;
      const seconds = saneCount(sample.seconds);
      const bytes = saneCount(sample.bytes);
      const s = read(TURN_KEY);
      const mk = monthKey();
      if (s.month !== mk) { s.month = mk; s.mCallSeconds = 0; s.mRelaySeconds = 0; s.mRelayBytes = 0; s.mTotalBytes = 0; }
      s.calls = saneCount(s.calls) + 1;
      s.callSeconds = saneCount(s.callSeconds) + seconds;
      s.totalBytes = saneCount(s.totalBytes) + bytes;
      s.mCallSeconds = saneCount(s.mCallSeconds) + seconds;
      s.mTotalBytes = saneCount(s.mTotalBytes) + bytes;
      if (sample.relayed) {
        s.relayCalls = saneCount(s.relayCalls) + 1;
        s.relaySeconds = saneCount(s.relaySeconds) + seconds;
        s.relayBytes = saneCount(s.relayBytes) + bytes;
        s.mRelaySeconds = saneCount(s.mRelaySeconds) + seconds;
        s.mRelayBytes = saneCount(s.mRelayBytes) + bytes;
      }
      write(TURN_KEY, s);
    },

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
      const p = read(SIGNAL_KEY);
      const signal = {
        sessions: saneCount(p.sessions),
        preEstablished: saneCount(p.preEstablished),
        postEstablished: saneCount(p.postEstablished),
      };
      const u = read(TURN_KEY);
      const mTotalBytes = saneCount(u.mTotalBytes);
      const turn = {
        calls: saneCount(u.calls),
        callSeconds: saneCount(u.callSeconds),
        relayCalls: saneCount(u.relayCalls),
        relaySeconds: saneCount(u.relaySeconds),
        relayBytes: saneCount(u.relayBytes),
        totalBytes: saneCount(u.totalBytes),
        month: typeof u.month === 'string' ? u.month : null,
        mCallSeconds: saneCount(u.mCallSeconds),
        mRelaySeconds: saneCount(u.mRelaySeconds),
        mRelayBytes: saneCount(u.mRelayBytes),
        mTotalBytes,
        // This month's TURN share of call traffic, by bytes — null
        // until something has actually been measured.
        mRelayShare: mTotalBytes > 0 ? saneCount(u.mRelayBytes) / mTotalBytes : null,
      };
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
        signal,
        turn,
      };
    },
  };
}
