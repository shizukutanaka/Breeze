// Emoji picker UI (categories, frequency-weighted recents, search, Escape/outside-click close)
// extracted from index.html.
//
// Instantiated inside initMessenger with closure bindings injected via D.
// Absent module ⇒ inert stub in index.html so the rest of the app still boots.

export const EMOJI_CATEGORIES = {
  '😀': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','🫨','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  '👋': ['👋','🤚','🖐','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁','👅','👄','🫦','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵'],
  '🐶': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷','🕸','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🪸','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎'],
  '🍎': ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🫚','🥐','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾'],
  '⚽': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸','🥌','🎿','⛷','🏂','🪂','🏋','🤼','🤸','🤺','⛹','🤾','🏌','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎗','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻'],
  '🚗': ['🚗','🚕','🚙','🏎','🚌','🚎','🚐','🚑','🚒','🚓','🚔','🚖','🚘','🚍','🚲','🛴','🏍','🛵','🛺','🚁','🛸','🚀','🛶','⛵','🚤','🛥','🛳','⛴','🚢','✈','🛩','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','🛬','🛫','🏠','🏡','🏘','🏚','🏗','🏭','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛','⛪','🕌','🕍','🛕','🕋','⛩'],
  '❤': ['❤','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤‍🔥','❤‍🩹','❣','💕','💞','💓','💗','💖','💘','💝','💟','☮','✝','☪','🕉','☸','✡','🔯','🕎','☯','☦','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛','🉑','☢','☣','📴','📳','🈶','🈚','🈸','🈺','🈷','✴','🆚','💮','🉐','㊙','㊗','🈴','🈵','🈹','🈲','🅰','🅱','🆎','🅾','🆑','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼','⁉','🔅','🔆','〽','⚠','🚸','🔱','⚜','🔰','♻','✅','🈯','💹','❇','✳','❎','🌐','💠','Ⓜ','🌀','💤','🏧','🚾','♿','🅿','🛗','🈳','🈂','🛂','🛃','🛄','🛅'],
};

const CAT_LABELS = ['😀','👋','🐶','🍎','⚽','🚗','❤'];
const CAT_ARIA = ['emojiCatSmileys','emojiCatPeople','emojiCatAnimals','emojiCatFood','emojiCatActivities','emojiCatTravel','emojiCatSymbols'];

export function createEmojiPicker(D) {
  const { DOM, t, signal } = D;
  const emojiBtn = DOM.get('b-msg-emoji');
  const input = DOM.get('msg-input');
  if (!emojiBtn || !input) return { togglePicker() {} };

  let recentEmojis = [];
  try { recentEmojis = JSON.parse(localStorage.getItem('brz-recent-emoji') || '[]'); } catch {}

  let pickerEl = null;

  function togglePicker() {
    if (pickerEl) { pickerEl.remove(); pickerEl = null; emojiBtn.setAttribute('aria-expanded', 'false'); return; }
    pickerEl = document.createElement('div');
    pickerEl.className = 'emoji-picker';
    pickerEl.setAttribute('role', 'dialog');
    pickerEl.setAttribute('aria-label', t('ttEmoji'));
    pickerEl.setAttribute('aria-modal', 'true');
    let activeCategory = '😀';

    // Search
    const searchDiv = document.createElement('div');
    searchDiv.className = 'emoji-picker-search';
    const searchInput = document.createElement('input');
    searchInput.placeholder = t('searchEmojiPh');
    searchInput.setAttribute('aria-label', t('searchEmojiPh'));
    searchDiv.appendChild(searchInput);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'emoji-picker-tabs';
    if (recentEmojis.length > 0) {
      const rb = document.createElement('button');
      rb.textContent = '🕐'; rb.title = t('emojiCatRecent');
      rb.setAttribute('aria-label', t('emojiCatRecent'));
      rb.onclick = () => renderGrid(recentEmojis, rb);
      tabs.appendChild(rb);
    }
    CAT_LABELS.forEach((cat, i) => {
      const b = document.createElement('button');
      b.textContent = cat;
      b.title = t(CAT_ARIA[i]);
      b.setAttribute('aria-label', t(CAT_ARIA[i]));
      if (cat === activeCategory) b.classList.add('active');
      b.onclick = () => renderGrid(EMOJI_CATEGORIES[cat], b);
      tabs.appendChild(b);
    });

    // Grid
    const grid = document.createElement('div');
    grid.className = 'emoji-picker-grid';
    grid.setAttribute('role', 'grid');

    function renderGrid(emojis, activeTab) {
      grid.replaceChildren();
      tabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      if (activeTab) activeTab.classList.add('active');
      emojis.forEach(item => {
        // v3.6: Support both string (legacy) and {em, count} (frequency) format
        const em = typeof item === 'object' ? item.em : item;
        const b = document.createElement('button');
        b.textContent = em;
        b.setAttribute('aria-label', em);
        b.onclick = () => insertEmoji(em);
        grid.appendChild(b);
      });
    }

    function insertEmoji(em) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = input.value.substring(0, start) + em + input.value.substring(end);
      input.selectionStart = input.selectionEnd = start + em.length;
      input.focus();
      // v3.6: Frequency-weighted recent (most-used rises to top)
      const idx = recentEmojis.findIndex(e => e.em === em || e === em);
      if (idx >= 0) {
        const entry = typeof recentEmojis[idx] === 'object' ? recentEmojis[idx] : { em, count: 0 };
        entry.count = (entry.count || 0) + 1;
        recentEmojis.splice(idx, 1);
        recentEmojis.unshift(entry);
      } else {
        recentEmojis.unshift({ em, count: 1 });
      }
      recentEmojis = recentEmojis.slice(0, 32);
      // Sort by frequency (highest first), keep insertion order for ties
      recentEmojis.sort((a, b) => (b.count || 0) - (a.count || 0));
      try { localStorage.setItem('brz-recent-emoji', JSON.stringify(recentEmojis)); } catch {}
    }

    searchInput.oninput = () => {
      const q = searchInput.value.toLowerCase();
      if (!q) { renderGrid(EMOJI_CATEGORIES[activeCategory]); return; }
      const all = Object.values(EMOJI_CATEGORIES).flat();
      renderGrid(all.filter((e, i) => i < 80), null);
    };

    pickerEl.append(searchDiv, tabs, grid);
    renderGrid(EMOJI_CATEGORIES[activeCategory], tabs.children[recentEmojis.length > 0 ? 1 : 0]);

    // Position near emoji button
    const bar = DOM.get('msg-input-bar');
    bar.classList.add('i-rel');
    bar.appendChild(pickerEl);
    emojiBtn.setAttribute('aria-expanded', 'true');
    searchInput.focus();

    // Close on Escape or outside click
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'click' && pickerEl?.contains(e.target)) return;
      if (e.type === 'click' && e.target === emojiBtn) return;
      pickerEl?.remove(); pickerEl = null;
      emojiBtn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
    setTimeout(() => {
      document.addEventListener('click', close, signal ? { signal } : undefined);
      document.addEventListener('keydown', close, signal ? { signal } : undefined);
    }, 100);
  }

  emojiBtn.onclick = togglePicker;
  window.togglePicker = togglePicker; // v3.6: Expose for Ctrl+E shortcut
  return { togglePicker };
}
