// ============================================================================
// Local AI-Native Helpers: Smart Replies & Extractive Message Summarization
// Extracted verbatim from index.html's initMessenger() to relieve the 16k-line
// cap without changing behavior. Loaded as an ESM bridge
// (window.__breezeSmartReplies); if the module is absent, index.html degrades
// cleanly to inert stubs.
// ============================================================================

export function generateSmartReplies(lastMsg, lang = 'en') {
  if (!lastMsg || typeof lastMsg !== 'string') return [];
  const lower = lastMsg.toLowerCase().trim();
  const len = lower.length;
  const ja = lang === 'ja' || /[\u3000-\u9fff]/.test(lastMsg);

  // Question patterns
  if (lower.endsWith('?') || lower.endsWith('？')) {
    if (/how are you|how's it going|元気/.test(lower)) return ja ? ['元気です！', '元気ですよ！そちらは？', 'まあまあです'] : ['Good, thanks!', "I'm doing well, you?", 'Not bad!'];
    if (/can you|could you|できる|してくれ/.test(lower)) return ja ? ['もちろん！', '確認します', 'ちょっと考えさせて'] : ['Sure!', "I'll check", 'Let me think about it'];
    if (/when|いつ/.test(lower)) return ja ? ['予定を確認します', '明日でどう？', '来週はどう？'] : ['Let me check my schedule', 'Tomorrow works', 'How about next week?'];
    if (/where|どこ/.test(lower)) return ja ? ['場所送るね', '調べてみる', 'いつもの場所？'] : ["I'll send the location", 'Let me find out', 'The usual place?'];
    if (/what do you think|どう思/.test(lower)) return ja ? ['賛成', 'いいね！', 'ちょっと考えさせて'] : ['I agree', 'Good idea!', 'Let me think about it'];
    return ja ? ['はい', 'いいえ', '確認します'] : ['Yes', 'No', 'Let me check'];
  }
  // Greeting
  if (/^(hi|hello|hey|yo|sup|おはよう|こんにちは|こんばんは|お疲れ)/.test(lower)) return ja ? ['おはよう！', 'こんにちは！', 'お疲れ様！'] : ['Hey!', 'Hi there!', "What's up?"];
  // Thanks
  if (/thank|thanks|ありがとう|thx/.test(lower)) return ja ? ['どういたしまして！', 'いえいえ！', 'いつでも！'] : ["You're welcome!", 'No problem!', 'Anytime!'];
  // Agreement
  if (/^(ok|okay|sure|got it|了解|わかった|おk)/.test(lower)) return ja ? ['良かった！', '了解！', 'いいね'] : ['Great!', 'Perfect', 'Sounds good'];
  // Farewell
  if (/bye|see you|later|またね|じゃあね|おやすみ/.test(lower)) return ja ? ['またね！', 'お疲れ様！', 'おやすみ！'] : ['See you!', 'Take care!', 'Bye!'];
  // Short
  if (len < 20) return ja ? ['👍', '了解', 'ありがとう'] : ['👍', 'Got it', 'Thanks'];
  // Long
  return ja ? ['なるほど', '詳しくありがとう', 'ちょっと考えさせて'] : ['That makes sense', 'I see, thanks for sharing', 'Let me think about this'];
}

export function summarizeMessages(messages, { t, activeContactName = '?', maxSentences = 3 } = {}) {
  if (!messages || messages.length === 0) return t('aiSummarizeEmpty');
  // Filter to text messages only
  const texts = messages.filter(m => m.text && !m.deleted && m.text.length > 5).map(m => ({
    text: m.text, mine: m.mine, ts: m.ts, sender: m.senderName || (m.mine ? t('you') : activeContactName || '?'),
  }));
  if (texts.length === 0) return t('aiSummarizeNoText');
  // Simple extractive summary: first, middle, last important messages
  const total = texts.length;
  const summary = [];
  summary.push(t('aiSummarizeMsgCount', total));
  // Topics: extract unique nouns/phrases > 4 chars
  const words = {};
  for (const msg of texts) {
    msg.text.split(/\s+/).forEach(w => {
      const clean = w.replace(/[^a-zA-Z\u3000-\u9fff\uff00-\uffef]/g, '');
      if (clean.length > 4) words[clean.toLowerCase()] = (words[clean.toLowerCase()] || 0) + 1;
    });
  }
  const topWords = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 5).map(w => w[0]);
  if (topWords.length > 0) summary.push(t('aiSummarizeTopics') + ': ' + topWords.join(', '));
  // Key messages
  const key = texts.filter(x => x.text.endsWith('?') || x.text.endsWith('!') || x.text.length > 50);
  const shown = key.slice(-maxSentences);
  for (const m of shown) {
    summary.push(`${m.sender}: "${m.text.slice(0, 80)}${m.text.length > 80 ? '...' : ''}"`);
  }
  return summary.join('\n');
}

export function createSmartReplies({ DOM, config, t, getLang, getActiveContact, sendMessage } = {}) {
  function showSmartReplies(lastMsgText) {
    const bar = DOM.get('smart-reply-bar');
    if (!bar) return;
    // Show local replies immediately (no latency)
    const localReplies = generateSmartReplies(lastMsgText, getLang ? getLang() : 'en');
    if (localReplies.length === 0) { bar.classList.add('hidden'); return; }
    bar.replaceChildren();
    bar.classList.remove('hidden');
    for (const r of localReplies) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-o btn-sm smart-reply';
      btn.textContent = r;
      btn.onclick = () => { DOM.get('msg-input').value = r; sendMessage(); bar.classList.add('hidden'); };
      bar.appendChild(btn);
    }
    setTimeout(() => { bar.classList.add('hidden'); }, config.SMART_REPLY_HIDE_MS);
  }

  return {
    generateSmartReplies: (lastMsg) => generateSmartReplies(lastMsg, getLang ? getLang() : 'en'),
    summarizeMessages: (messages, maxSentences = 3) => summarizeMessages(messages, {
      t,
      activeContactName: getActiveContact ? getActiveContact()?.name : '?',
      maxSentences,
    }),
    showSmartReplies,
  };
}
