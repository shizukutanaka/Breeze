// Chat-history tools extracted from initMessenger; live account bindings arrive via deps.
export function createHistoryTools(D) {
  // v3.3: ENTERPRISE — GDPR DATA EXPORT
  // Export all personal data as structured JSON (GDPR Art. 20)
  async function gdprExport() {
    try {  
      const identity = await D.dbGet('identity', 'keys');
      const contacts = await D.dbGetAll('contacts');
      const messages = await D.dbGetAll('messages');
      const audit = D.db().objectStoreNames.contains('audit') ? await D.dbGetAll('audit') : [];
      const settings = D.db().objectStoreNames.contains('settings') ? await D.dbGet('settings', 'app') : null;
      return {
        exportType: 'GDPR Data Export (Art. 15/20)',
        exportedAt: new Date().toISOString(),
        version: CONFIG.VERSION,
        identity: identity ? { name: identity.name, alias: identity.alias, pubB64: identity.pubB64, createdAt: identity.createdAt } : null,
        contacts: contacts.map(c => ({ id: c.id, name: c.name, alias: c.alias, isGroup: c.isGroup, createdAt: c.createdAt, pinned: c.pinned, muted: c.muted, blocked: c.blocked, archived: c.archived, notes: c.notes, labels: c.labels || [] })),
        messages: messages.map(m => ({ msgId: m.msgId, contactId: m.contactId, text: m.text?.slice(0, 200), mine: m.mine, ts: m.ts, hasFile: !!m.fileData, hasVoice: !!m.voice })),
        auditLog: audit.slice(-1000),
        settings,
        totalMessages: messages.length,
        totalContacts: contacts.length,
        totalFiles: messages.filter(m => m.fileData || m.voice).length,
      };
    
    } catch(_e) { _dbg(_e, 'gdprExport'); }
  }

  // MIGRATION: Import from LINE / WhatsApp / Telegram — the format parsers
  // live in src/app/import-parsers.js (modularization); read through the
  // bridge — absent ⇒ the parsers' own Unknown result.
  const detectAndParse = (text) => globalThis.__breezeImportParsers?.detectAndParse(text) || { source: 'Unknown', msgs: [] };

  async function importChat(file) {
    try {  
      if (!D.activeContact()) { showToast(t('toastOpenChat'), 'error'); return; }
      const text = await file.text();
      const { source, msgs } = detectAndParse(text);
      if (msgs.length === 0) { showToast(t('toastNoImportMsgs'), 'error'); return; }
  
      const myNames = [D.myName().toLowerCase(), D.myAlias()?.toLowerCase(), 'you', 'me', 'self'].filter(Boolean);
      let imported = 0;
      for (const m of msgs) {
        const isMine = myNames.some(n => m.sender.toLowerCase().includes(n));
        const msgId = 'import:' + m.ts + ':' + (isMine ? '1' : '0');
        const existing = await D.dbGet('messages', msgId);
        if (existing) continue;
        await D.dbPut('messages', {
          msgId, contactId: D.activeContact().id,
          text: typeof m.text === 'string' ? m.text.slice(0, CONFIG.MAX_MSG_LENGTH) : '',
          mine: isMine, ts: m.ts,
          senderName: isMine ? D.myName() : (typeof m.sender === 'string' ? m.sender.slice(0, 64) : ''),
          imported: true
        });
        imported++;
      }
  
      D.activeContact().lastMsg = msgs[msgs.length - 1]?.text?.slice(0, 40) || '';
      D.activeContact().lastMsgAt = msgs[msgs.length - 1]?.ts || Date.now();
      await D.dbPut('contacts', D.activeContact());
  
      // Refresh conversation
      await D.openConversation(D.activeContact());
      showToast(t('toastImported', imported, source), "success");
    
    } catch(_e) { _dbg(_e, 'importChat'); }
  }

  async function exportChat(val) {
    const sub = val.slice(7).trim() || 'json';
    if (sub === 'all') {
      const allContacts = await D.dbGetAll('contacts');
      const allMsgs = await D.dbGetAll('messages');
      const chats = {};
      for (const c of allContacts) {
        const msgs = allMsgs.filter(m => m.contactId === c.id).sort((a, b) => a.ts - b.ts);
        if (msgs.length === 0) continue;
        chats[c.name || c.id] = msgs.map(m => ({ ts: m.ts, text: m.text, mine: m.mine }));
      }
      const blob = new Blob([JSON.stringify({ version: CONFIG.VERSION, exportedAt: new Date().toISOString(), chats }, null, 2)], { type: 'application/json' });
      downloadBlob(blob, 'breeze-all-' + new Date().toISOString().slice(0,10) + '.json');
      showToast(t('toastExportedMessages', allMsgs.length, Object.keys(chats).length), 'success');
    } else if (sub === 'csv') {
      if (!D.activeContact()) { showToast(t('toastOpenChat'), 'error'); return; }
      const msgs = (await D.dbGetByIndex('messages', 'contact', D.activeContact().id)).sort((a, b) => a.ts - b.ts);
      const rows = [t('csvHeader')];
      for (const m of msgs) { if (!m.deleted) rows.push('"' + new Date(m.ts).toISOString() + '","' + (m.mine ? D.myName() : D.activeContact().name).replace(/"/g, '""') + '","' + (m.text||'').replace(/"/g,'""').replace(/\n/g,' ') + '"'); }
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      downloadBlob(blob, 'breeze-' + D.activeContact().name.replace(/\s+/g,'-') + '-' + new Date().toISOString().slice(0,10) + '.csv');
      showToast(t('toastExportedMessagesCSV', msgs.length), 'success');
    } else if (sub === 'html') {
      // v3.6: Human-readable HTML chat export (printable, self-contained)
      if (!D.activeContact()) { showToast(t('toastOpenChat'), 'error'); return; }
      const msgs = (await D.dbGetByIndex('messages', 'contact', D.activeContact().id)).sort((a, b) => a.ts - b.ts);
      const rows = msgs.filter(m => !m.deleted).map(m => {
        const sender = m.mine ? D.myName() : (m.senderName || D.activeContact().name);
        const time = new Date(m.ts).toLocaleString();
        const cls = m.mine ? 'me' : 'them';
        return `<div class="${cls}"><b>${esc(sender)}</b> <span class="ts">${esc(time)}</span><br>${esc(m.text || t('htmlExportFileLabel'))}</div>`;
      }).join('\n');
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(D.activeContact().name)}</title>
<style>body{font-family:system-ui;max-width:700px;margin:0 auto;padding:20px;background:#f5f5f5}
.me,.them{padding:8px 14px;border-radius:12px;margin:4px 0;max-width:80%}
.me{background:#d1fae5;margin-left:auto;text-align:right}.them{background:#fff}
b{font-size:13px}.ts{font-size:11px;color:#888}h1{font-size:18px}</style></head>
<body><h1>🌊 ${esc(D.activeContact().name)}</h1><p>${t('htmlExportMeta', msgs.length, new Date().toLocaleDateString())}</p>${rows}</body></html>`;
      downloadBlob(new Blob([html], { type: 'text/html' }), 'breeze-' + D.activeContact().name.replace(/\s+/g, '-') + '-' + new Date().toISOString().slice(0, 10) + '.html');
      showToast(t('toastExportedMessagesHTML', msgs.length), 'success');
    } else {
      if (!D.activeContact()) { showToast(t('toastOpenChat'), 'error'); return; }
      const msgs = (await D.dbGetByIndex('messages', 'contact', D.activeContact().id)).sort((a, b) => a.ts - b.ts).map(m => ({ ts: m.ts, text: m.text, mine: m.mine, sender: m.senderName || (m.mine ? D.myName() : D.activeContact().name) }));
      const blob = new Blob([JSON.stringify({ version: CONFIG.VERSION, contact: D.activeContact().name, messages: msgs }, null, 2)], { type: 'application/json' });
      downloadBlob(blob, 'breeze-' + D.activeContact().name.replace(/\s+/g,'-') + '-' + new Date().toISOString().slice(0,10) + '.json');
      showToast(t('toastExportedMessagesJSON', msgs.length), 'success');
    }
    D.auditLog('settings', 'Export: ' + sub);
  }

  async function exportGdpr() {
    const data = await gdprExport();
    if (!data) { showToast(t('toastServerError'), 'error'); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `breeze-gdpr-export-${new Date().toISOString().slice(0,10)}.json`);
    D.auditLog('settings', 'GDPR data export performed');
    showToast(t('toastGdprExport', data.totalMessages, data.totalContacts, data.totalFiles), 'success');
  }

  return { gdprExport, importChat, exportChat, exportGdpr };
}
