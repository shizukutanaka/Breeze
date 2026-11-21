// Breeze wave-4 line-budget pass — local data lifecycle.
// Owns the three storage-maintenance jobs that used to live inline in
// index.html: the message retention policy, the remote-wipe check, and
// the quota-recovery cleanup of old messages. Bodies are moved verbatim;
// every live binding (settings, db handle, identity, API) arrives through
// the deps object so the inline side keeps one-line delegating wrappers
// under the original names.
export function createDataLifecycle(D) {
  // v3.3: ENTERPRISE — MESSAGE RETENTION POLICY
  // Auto-delete messages older than N days (compliance)
  async function enforceRetentionPolicy() {
    const settings = D.settings();
    if (!settings.retentionDays || settings.retentionDays <= 0) return;
    try {
      const cutoff = Date.now() - (settings.retentionDays * D.MS.DAY);
      const allMsgs = await D.dbGetAll('messages');
      const toDelete = allMsgs.filter(m => m.ts < cutoff && !m.pinned);
      if (toDelete.length === 0) return;
      // v3.3: PERFORMANCE — Batch delete in single transaction
      await new Promise((resolve) => {
        try {
          const tx = D.db().transaction('messages', 'readwrite');
          const os = tx.objectStore('messages');
          for (const m of toDelete) { os.delete(m.msgId); D.replayCache.delete(m.msgId); }
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch(e) { D.dbg(e, 'retention-batch'); resolve(false); }
      });
      D.auditLog('settings', `Retention policy: deleted ${toDelete.length} messages older than ${settings.retentionDays} days`);
    } catch(e) { D.dbg(e, 'retention'); }
  }

  // v3.3: ENTERPRISE — REMOTE WIPE
  // Check server for wipe signal; if found, destroy all local data
  async function checkRemoteWipe() {
    if (!D.api() || !D.myId()) return;
    try {
      const resp = await D.postAPIRaw('/msg/poll', { id: D.myId(), lastTs: 0, ...(await D.queueAuth('msg-poll')) });
      if (!resp.ok) return;
      const data = await resp.json();
      for (const msg of (data.messages || [])) {
        if (msg.type === 'remote_wipe' && msg.from === D.myId()) {
          D.auditLog('security', 'Remote wipe signal received', 'critical');
          // Destroy all data
          const db = D.db();
          const stores = [...db.objectStoreNames];
          for (const store of stores) {
            const tx = db.transaction(store, 'readwrite');
            tx.objectStore(store).clear();
          }
          localStorage.clear();
          sessionStorage.clear();
          D.showToast(D.t('toastWiped'), 'error');
          setTimeout(() => D.reload(), D.CONFIG.TOAST_DURATION_MS);
          return;
        }
      }
    } catch(e) { D.dbg(e, 'remote-wipe-check'); }
  }

  async function cleanupOldMessages() {
    try {
      const allMsgs = await D.dbGetAll('messages');
      if (allMsgs.length < 200) return; // Not enough to clean
      // Sort by timestamp, keep newest 80%
      allMsgs.sort((a, b) => a.ts - b.ts);
      const deleteCount = Math.floor(allMsgs.length * 0.2);
      const toDelete = allMsgs.slice(0, deleteCount).filter(m => !m.pinned && !m.bookmarked);
      // Await the transaction so callers can retry saves after space is freed
      await new Promise((resolve) => {
        const tx = D.db().transaction('messages', 'readwrite');
        const store = tx.objectStore('messages');
        for (const m of toDelete) store.delete(m.msgId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
      D.dbg(null, 'Cleaned ' + toDelete.length + ' old messages (quota recovery)');
    } catch(e) { D.dbg(e, 'cleanup'); }
  }

  return { enforceRetentionPolicy, checkRemoteWipe, cleanupOldMessages };
}
