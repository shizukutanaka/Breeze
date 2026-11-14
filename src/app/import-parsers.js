// ============================================================================
// MIGRATION PARSERS — chat-history import format parsers (LINE / WhatsApp /
// Telegram export formats), extracted from index.html's initMessenger
// closure (modularization: index.html carries a hard line budget in
// validate.sh). The parsers are pure text → message-list functions; the
// only app binding they use is the top-level t() (Telegram's unknown-sender
// label), which resolves from the global scope exactly as it did inline.
// importChat itself stays in index.html and reads these through the
// window.__breezeImportParsers bridge. Behaviour is unchanged.
// ============================================================================

// MIGRATION: Import from LINE / WhatsApp / Telegram

export function parseLINE(text) {
  const msgs = [];
  const lines = text.split('\n');
  let currentDate = '';
  for (const line of lines) {
    // Date line: 2024/01/15 Mon
    const dateMatch = line.match(/^(\d{4}\/\d{2}\/\d{2})/);
    if (dateMatch) { currentDate = dateMatch[1]; continue; }
    // Message: 14:23\tAlice\tHello!
    const msgMatch = line.match(/^(\d{1,2}:\d{2})\t([^\t]+)\t(.+)/);
    if (msgMatch && currentDate) {
      const [, time, sender, text] = msgMatch;
      const ts = new Date(currentDate.replace(/\//g, '-') + 'T' + time.padStart(5, '0') + ':00').getTime();
      if (!isNaN(ts)) msgs.push({ sender, text, ts });
    }
  }
  return msgs;
}

export function parseWhatsApp(text) {
  const msgs = [];
  const re = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*-\s*([^:]+):\s*(.+)/;
  for (const line of text.split('\n')) {
    const m = line.match(re);
    if (m) {
      const [, date, time, sender, text] = m;
      const ts = new Date(date + ' ' + time).getTime();
      if (!isNaN(ts)) msgs.push({ sender: sender.trim(), text: text.trim(), ts });
    }
  }
  return msgs;
}

export function parseTelegram(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    const msgs = (data.messages || [])
      .filter(m => m.type === 'message' && m.text)
      .map(m => ({
        sender: m.from || m.from_id || t('unknown'),
        text: typeof m.text === 'string' ? m.text : m.text.map?.(seg => typeof seg === 'string' ? seg : seg.text || '').join('') || '',
        ts: new Date(m.date).getTime(),
      }))
      .filter(m => !isNaN(m.ts) && m.text);
    return msgs;
  } catch { return []; }
}

export function detectAndParse(text) {
  // Auto-detect format
  if (text.startsWith('{') || text.startsWith('[')) return { source: 'Telegram', msgs: parseTelegram(text) };
  if (text.includes('[LINE]') || /^\d{4}\/\d{2}\/\d{2}/.test(text)) return { source: 'LINE', msgs: parseLINE(text) };
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4},/.test(text)) return { source: 'WhatsApp', msgs: parseWhatsApp(text) };
  // Try all
  let msgs = parseLINE(text);
  if (msgs.length > 0) return { source: 'LINE', msgs };
  msgs = parseWhatsApp(text);
  if (msgs.length > 0) return { source: 'WhatsApp', msgs };
  return { source: 'Unknown', msgs: [] };
}
