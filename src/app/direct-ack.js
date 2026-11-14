// ============================================================================
// DIRECT-DELIVERY ACK WAITER — P2P_PLAN Step 2 (direct-first delivery).
//
// Until Step 2, every message travelled BOTH paths unconditionally: the
// WebRTC DataChannel AND a sealed-sender mailbox deposit (plan weakness
// W1 — direct delivery never reduced relay writes). The receiver already
// answers each direct message with an app-layer ack on the message
// channel ({ type: 'ack', i: <ts>, st: 0 }), sent after handleIncoming
// has persisted it. This waiter lets the SENDER act on that ack:
//
//   const acked = await waiter.expect(peerPub, ts);  // before dc.send()
//   dc.send(envelope);
//   if (!acked) depositAsBefore();                   // timeout / no ack
//
// Contract (the plan's compatibility rule): ANY doubt resolves to
// "deposit". A missing module, a closed channel, a slow peer, an old
// peer that never acks — all end in the deposit, exactly as pre-Step-2.
// The waiter itself is deliberately tiny and dependency-free so the
// decision can be unit-tested without a DOM: timers arrive via deps
// (tests inject fakes), defaulting to the globals.
//
// Keys are `${peerPub}:${ts}`: ts is unique per sender (monotonic send
// clock), and per-peer keying keeps a group send's members apart even
// though they share one ts.
// ============================================================================

export function createDirectAckWaiter(D = {}) {
  const timeoutMs = (typeof D.timeoutMs === 'number' && D.timeoutMs > 0) ? D.timeoutMs : 5000;
  const setT = D.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const clearT = D.clearTimeout || ((id) => clearTimeout(id));
  const pending = new Map(); // key -> { resolve, timer }

  const keyOf = (peerPub, ts) => String(peerPub) + ':' + String(ts);

  function settle(key, value) {
    const entry = pending.get(key);
    if (!entry) return false;
    pending.delete(key);
    clearT(entry.timer);
    entry.resolve(value);
    return true;
  }

  // Register the expectation BEFORE the caller sends, so an ack that
  // races the send can never slip past. Resolves true on ack, false on
  // timeout. Re-expecting the same key settles the previous wait false
  // (a duplicate key means the earlier send is superseded anyway).
  function expect(peerPub, ts) {
    const key = keyOf(peerPub, ts);
    settle(key, false);
    return new Promise((resolve) => {
      const timer = setT(() => { if (pending.delete(key)) resolve(false); }, timeoutMs);
      pending.set(key, { resolve, timer });
    });
  }

  // Called from the DataChannel ack handler. Returns whether a waiter
  // was actually waiting (useful for tests; callers may ignore it).
  function resolve(peerPub, ts) {
    return settle(keyOf(peerPub, ts), true);
  }

  // Abandon a wait (e.g. the send itself threw): resolves false so the
  // caller falls back to the deposit instead of hanging on the timeout.
  function cancel(peerPub, ts) {
    return settle(keyOf(peerPub, ts), false);
  }

  return {
    expect, resolve, cancel,
    get size() { return pending.size; },
    get timeoutMs() { return timeoutMs; },
  };
}
