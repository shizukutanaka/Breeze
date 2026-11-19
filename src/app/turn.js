// Breeze stage 6 step 3 — TURN credential fetching.
// Owns the /api/turn round-trip and the spent-budget notice: when
// the relay's monthly issuance budget is used up it answers
// STUN-only with a turnQuota flag, and the user hears about it
// (once a day, details to the audit log) instead of watching
// relay-dependent calls silently fail to connect.
export function createTurnFetcher(D) {
  async function fetchCredentials() {
    if (!D.apiReady()) return;
    try {
      const resp = await D.postTurn({ userId: D.myId() });
      if (resp?.ok) {
        const cred = await resp.json();
        D.setCredential(cred);
        D.dbg(null, 'TURN credentials obtained');
        if (cred?.turnQuota?.exceeded) {
          const today = new Date().toDateString();
          if (D.noticeDay() !== today) {
            D.setNoticeDay(today);
            D.auditLog('relay', 'TURN monthly budget reached on this relay; calls fall back to direct/STUN only until the month rolls over.');
            D.showToast(D.t('toastTurnQuota'), 'error', 9000);
          }
        }
      }
    } catch(e) { D.dbg(e, 'turn'); }
  }
  return { fetchCredentials };
}
