// Visual context menu (keyboard navigation, viewport clamping, single cleanup path)
// extracted from index.html.
//
// Zero closure dependencies — exposed via window.__breezeContextMenu.
// Absent module ⇒ index.html wrapper resolves null cleanly.

export function showContextMenu(x, y, items) {
  return new Promise(resolve => {
    // Close existing menus
    document.querySelectorAll('.ctx-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    // Position: keep within viewport
    menu.style.left = Math.min(x, window.innerWidth - 160) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - items.length * 40 - 8) + 'px';
    // Single cleanup path so every way of dismissing the menu (item click, outside
    // click, Escape) removes BOTH document-level listeners — closing any other way
    // used to leave the keydown listener attached forever (leak, one per menu open).
    const cleanup = () => {
      menu.remove();
      document.removeEventListener('click', closeHandler);
      document.removeEventListener('keydown', escHandler);
    };
    const closeHandler = (e) => {
      if (!menu.contains(e.target)) { cleanup(); resolve(null); }
    };
    const escHandler = (e) => {
      if (e.key === 'Escape') { cleanup(); resolve(null); }
    };
    items.forEach(item => {
      if (item === '---') {
        const sep = document.createElement('div');
        sep.className = 'folder-sep';
        menu.appendChild(sep);
        return;
      }
      const el = document.createElement('div');
      el.className = 'ctx-item';
      if (item.danger) { el.classList.remove('color-g', 'color-t3'); el.classList.add('color-r'); }
      el.textContent = item.label;
      el.tabIndex = 0;
      el.setAttribute('role', 'menuitem');
      el.onclick = () => { cleanup(); resolve(item.action); };
      el.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const its = [...menu.querySelectorAll('.ctx-item')];
          const idx = its.indexOf(el);
          const next = e.key === 'ArrowDown' ? its[idx + 1] || its[0] : its[idx - 1] || its[its.length - 1];
          if (next) next.focus();
        }
      };
      menu.appendChild(el);
    });
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu);
    // Focus first item for keyboard users
    requestAnimationFrame(() => { const first = menu.querySelector('.ctx-item'); if (first) first.focus(); });
    // Delay to avoid immediate close from the triggering right-click
    requestAnimationFrame(() => document.addEventListener('click', closeHandler));
    document.addEventListener('keydown', escHandler);
  });
}
