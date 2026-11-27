// Slash-command discovery popover for the composer. This module is only a
// discovery surface for the command implementations: it filters their name
// inventory and fronts concise descriptions for first-success actions.
export const SLASH_COMMANDS = ['/help', '/search', '/searchall', '/pins', '/bookmarks', '/reply', '/poll', '/timer', '/schedule', '/clear', '/export', '/import', '/summarize', '/reactions', '/compact', '/files', '/print', '/rendezvous', '/offlinepair', '/info', '/note', '/pin', '/mute', '/archive', '/unblock', '/members', '/admin', '/add', '/label', '/sort', '/newgroup', '/rename', '/invite', '/qr', '/share', '/contacts', '/focus', '/settings', '/theme', '/wallpaper', '/lock', '/sound', '/compress', '/alias', '/whoami', '/who', '/debug', '/online', '/security', '/verify', '/audit', '/retention', '/backup', '/keywrap', '/vault', '/sessions', '/wipe', '/gdpr', '/panic', '/devices', '/link', '/linkto', '/unlink', '/history', '/migrate', '/profile', '/stickers', '/location', '/retry', '/drop', '/room'];

export const SLASH_FEATURED = ['/invite', '/add', '/search', '/poll', '/timer', '/pin', '/export', '/help'];
export const SLASH_EXAMPLES = { '/search': '/search hello', '/poll': '/poll Lunch? | Yes | No', '/schedule': '/schedule 5m Hello', '/export': '/export json' };

export const SLASH_DESCS = {
  '/help': 'cmdDescHelp',
  '/search': 'cmdDescSearch',
  '/poll': 'cmdDescPoll',
  '/timer': 'cmdDescTimer',
  '/schedule': 'cmdDescSchedule',
  '/pin': 'cmdDescPin',
  '/pins': 'cmdDescPins',
  '/mute': 'cmdDescMute',
  '/invite': 'cmdDescInvite',
  '/qr': 'cmdDescQr',
  '/share': 'cmdDescShare',
  '/add': 'cmdDescAdd',
  '/newgroup': 'cmdDescNewgroup',
  '/export': 'cmdDescExport',
  '/backup': 'cmdDescBackup',
  '/settings': 'cmdDescSettings',
};

export function createSlashPicker({ input, DOM, t, esc, safeSetHTML }) {
  input?.addEventListener('input', (e) => {
    const input = e.target;
    const m = input.value.match(/^\/(\w*)$/);
    const existing = DOM.get('slash-picker');
    if (!m) { existing?.remove(); return; }
    const q = m[1].toLowerCase();
    const matches = q ? SLASH_COMMANDS.filter(c => c.slice(1).startsWith(q)).slice(0, 8) : SLASH_FEATURED;
    if (!matches.length) { existing?.remove(); return; }
    let pk = existing;
    if (!pk) {
      pk = document.createElement('div');
      pk.id = 'slash-picker';
      pk.className = 'mention-picker';
      pk.setAttribute('role', 'listbox');
      input.parentElement.classList.add('i-rel');
      input.parentElement.appendChild(pk);
    }
    safeSetHTML(pk, matches.map(c => {
      const desc = SLASH_DESCS[c] ? `<span class="i-small-muted"> ${esc(t(SLASH_DESCS[c]))}</span>` : '';
      const example = SLASH_EXAMPLES[c] ? ` <span class="i-small-muted">${esc(SLASH_EXAMPLES[c])}</span>` : '';
      return `<div class="mention-item i-ctx-row" role="option" data-cmd="${esc(c)}">${esc(c)}${desc}${example}</div>`;
    }).join(''));
    pk.querySelectorAll('.mention-item').forEach(item => {
      item.onmouseenter = () => { pk.querySelectorAll('.mention-item').forEach(i => i.classList.remove('i-bg-s2')); item.classList.add('i-bg-s2'); };
      item.onclick = () => {
        input.value = item.dataset.cmd + ' ';
        pk.remove();
        input.focus();
      };
    });
  });
  return { commands: SLASH_COMMANDS };
}
