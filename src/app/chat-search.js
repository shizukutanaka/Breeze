// ============================================================================
// In-Chat Search Bar (Ctrl+Shift+F)
// Extracted verbatim from index.html to relieve the 16k-line cap without
// changing behavior. Loaded as an ESM bridge (window.__breezeChatSearch);
// if the module is absent, index.html degrades cleanly to an inert stub.
// ============================================================================

export function createChatSearch({ DOM, getActiveContact } = {}) {
  // Honor prefers-reduced-motion for JS-driven scrolling, like index.html.
  const _scrollBehavior = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; } catch { return 'smooth'; } };
  const _searchBar = DOM.get('search-bar');
  const _searchInput = DOM.get('search-chat-input');
  const _searchCount = DOM.get('search-match-count');
  let _searchMatches = [];
  let _searchIdx = 0;

  function openSearchBar() {
    if (!_searchBar || !getActiveContact?.()) return;
    _searchBar.classList.add('show');
    _searchInput.value = '';
    _searchInput.focus();
    _searchMatches = [];
    _searchIdx = 0;
    _searchCount.textContent = '';
  }

  function closeSearchBar() {
    _searchBar?.classList.remove('show');
    // Remove highlights
    document.querySelectorAll('.search-hl').forEach(el => {
      el.replaceWith(document.createTextNode(el.textContent));
    });
    _searchMatches = [];
  }

  function searchInChat(query) {
    // Remove previous highlights
    document.querySelectorAll('.search-hl').forEach(el => {
      el.replaceWith(document.createTextNode(el.textContent));
    });
    _searchMatches = [];
    _searchIdx = 0;
    if (!query || query.length < 2) { _searchCount.textContent = ''; return; }
    const q = query.toLowerCase();
    const msgs = document.querySelectorAll('.msg');
    msgs.forEach(el => {
      const textNodes = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      for (const node of textNodes) {
        const idx = node.textContent.toLowerCase().indexOf(q);
        if (idx >= 0) {
          const span = document.createElement('mark');
          span.className = 'search-hl';
          span.className = 'highlight-mark';
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + query.length);
          range.surroundContents(span);
          _searchMatches.push(span);
        }
      }
    });
    _searchCount.textContent = _searchMatches.length > 0 ? `${1}/${_searchMatches.length}` : '0';
    if (_searchMatches.length > 0) _searchMatches[0].scrollIntoView({ block: 'center', behavior: _scrollBehavior() });
  }

  function searchNext(dir) {
    if (_searchMatches.length === 0) return;
    _searchMatches[_searchIdx].classList.remove('i-search-hl-current');
    _searchIdx = (_searchIdx + dir + _searchMatches.length) % _searchMatches.length;
    _searchMatches[_searchIdx].classList.add('i-search-hl-current');
    _searchMatches[_searchIdx].scrollIntoView({ block: 'center', behavior: _scrollBehavior() });
    _searchCount.textContent = `${_searchIdx + 1}/${_searchMatches.length}`;
  }

  _searchInput?.addEventListener('input', (e) => searchInChat(e.target.value));
  _searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); searchNext(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') closeSearchBar();
  });
  DOM.get('search-chat-next')?.addEventListener('click', () => searchNext(1));
  DOM.get('search-chat-prev')?.addEventListener('click', () => searchNext(-1));
  DOM.get('search-chat-close')?.addEventListener('click', closeSearchBar);

  return { openSearchBar, closeSearchBar, searchInChat, searchNext };
}
