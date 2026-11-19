// ============================================================================
// RELAY REJECTION CLASSIFICATION — SHARE_PLAN stage 6, client side of the
// API-style cost model (docs/COST_MODEL.md section 10).
//
// The relay refuses a deposit in two different 429 dialects:
//   USAGE_QUOTA_EXCEEDED — the identity's fair-use budget on this relay
//     (daily / monthly deposit caps) is spent. The message is NOT lost:
//     it stays in the on-device retry queue and delivery resumes when
//     the window resets — or immediately once the user adds their own
//     relay. The server is explicit that a quota-denied envelope must
//     not be swallowed as an ordinary delivery failure.
//   MAILBOX_RATE_LIMITED — a short burst limit, where the long-standing
//     behaviour (quiet retry after Retry-After) is the right answer.
//
// Until now the client classified only the second: a quota refusal fell
// through to the plain fallback path (spending a second deposit against
// the same exhausted budget) or surfaced as a generic "rate limited"
// toast whose seconds-scale retry hint describes a window that actually
// resets in hours. This module is the pure half of the fix: classify the
// response body, and throttle the user-facing notice so a stalled outbox
// explains itself once per episode instead of once per message. No
// network, no storage, no telemetry — the details worth keeping go to
// the on-device audit log at the call site.
// ============================================================================

// Classify a parsed 429 body from a relay deposit endpoint.
// Returns { kind: 'quota', scope, limit, retryAfterSec } for a spent
// fair-use budget, { kind: 'limited', retryAfterSec } for a burst limit,
// and null for anything else (including a missing or garbled body), so
// callers keep their previous fallback behaviour for unknown refusals.
export function classifyRelayRejection(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.code === 'USAGE_QUOTA_EXCEEDED') {
    return {
      kind: 'quota',
      scope: typeof body.quotaScope === 'string' ? body.quotaScope : null,
      limit: Number.isFinite(body.quotaLimit) ? body.quotaLimit : null,
      retryAfterSec: Number.isFinite(body.retryAfter) ? body.retryAfter : null,
    };
  }
  if (body.code === 'MAILBOX_RATE_LIMITED') {
    return {
      kind: 'limited',
      retryAfterSec: Number.isFinite(body.retryAfter) ? body.retryAfter : null,
    };
  }
  return null;
}

// A throttled notifier for quota episodes. note(info) invokes the
// injected notify callback with the classification and returns true the
// first time, then stays silent until cooldownMs has elapsed — a queue
// full of owed deposits is one episode, not fifty separate alarms.
// The caller supplies cooldownMs (index.html passes MS.HOUR); now is
// injectable for tests.
export function createQuotaNotice({ notify, now = () => Date.now(), cooldownMs = 0 } = {}) {
  let lastShownAt = null;
  return {
    note(info) {
      const at = now();
      if (lastShownAt !== null && at - lastShownAt < cooldownMs) return false;
      lastShownAt = at;
      notify(info);
      return true;
    },
  };
}
