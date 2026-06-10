# AGENTS.md — Breeze Messenger

## Philosophy
Carmack (performance-first), Martin (clean code, SOLID), Pike (simplicity, no frameworks).
Single HTML file + Cloudflare Worker. No build step. No framework. No external dependencies.

## Do
- use `t('key')` for ALL user-facing text (EN+JA i18n keys required)
- use `_DOM.get('id')` for DOM access (memoized, never raw getElementById)
- use `postAPIRaw(path, body)` or `_signal()` for API calls (never raw fetchT)
- use `_H` constant for JSON headers (never inline `{ 'Content-Type': ... }`)
- use `MS.HOUR`, `MS.DAY` etc for time values (never magic numbers like 86400000)
- use CSS utility classes `.i-*` for styles (never inline `style=""` in templates)
- use `esc()` for ALL user-provided text in innerHTML (XSS prevention)
- use `safeSetHTML(el, html)` for command output rendering (Trusted Types)
- use `downloadBlob(blob, filename)` for file downloads (DRY + auto revokeObjectURL)
- use `sanitizeString()` in Worker for all user inputs stored in KV
- use CSS classes `.swiping` / `.swipe-back` for touch animations (not .style.transform)
- keep functions small and focused (single responsibility)
- keep diffs small — avoid repo-wide rewrites unless explicitly asked
- add `try/catch` around all `await` calls
- always run `./validate.sh` after changes (must score 35/35)

## Don't
- don't hardcode colors — use CSS custom properties (`var(--g)`, `var(--t1)`, etc.)
- don't hardcode English strings — use `t('key')` with i18n
- don't use `document.getElementById` — use `_DOM.get()`
- don't use `fetchT(API + ...)` directly — use `postAPIRaw()` or `_signal()`
- don't use `eval()`, `Function()`, or `setTimeout` with strings
- don't use `.style.xxx =` for static styles — create CSS class
- don't add external npm dependencies (zero-dependency project)
- don't create separate .css or .js files — everything is in index.html
- don't store secrets in code — use Worker environment variables
- don't use `localStorage` for sensitive data — use IndexedDB (encrypted)

## Commands

```bash
# Validate (ALWAYS run after changes)
./validate.sh

# Syntax check single files
node -c _worker.js
node -e "const h=require('fs').readFileSync('index.html','utf8');const js=h.match(/<script>([\s\S]*?)<\/script>/)[1];require('fs').writeFileSync('/tmp/t.js',js);" && node -c /tmp/t.js

# Full build
./build.sh validate

# Deploy
wrangler pages deploy . --project-name=breeze
```

Note: Always validate after changes. Full build only when explicitly requested.

## Safety and permissions

Allowed without prompt:
- read files, view structure
- syntax check (node -c)
- validate.sh
- str_replace edits

Ask first:
- deleting files
- adding new CONFIG constants
- changing crypto algorithms
- modifying Worker endpoints
- changing billing logic

## Project structure

```
index.html          — Client: HTML + CSS + JS (single file, ~10K lines)
  <style>           — All CSS (lines 1-700)
  <body>            — HTML structure (lines 700-920)
  <script>          — All JS (lines 920-10200)
    CONFIG          — Constants (line ~889)
    MS              — Time constants (line ~952)
    _DOM            — Memoized DOM cache (line ~954)
    _H              — JSON headers constant (line ~965)
    _I              — i18n translations EN+JA (line ~968)
    LANG / t()      — Language detection + translation function
    _adaptiveConfig — Network-aware settings
    Crypto          — X25519/AES-256-GCM/Double Ratchet
    IDB             — IndexedDB (5 stores: identity, contacts, messages, audit, settings)
    Multi-account   — Account switching, tabs
    WebRTC          — P2P DataChannel + voice/video calls
    UI              — Contact list, chat, modals, commands
    Slash commands  — 52+ commands (/help, /security, /network, etc.)

_worker.js          — Cloudflare Worker: 38 API endpoints (~2K lines)
  Rate limiting     — Per-IP, per-endpoint, per-minute
  Input validation  — sanitizeString, validateUserId, size limits
  Billing           — Stripe (Lite $0.99, Plus $5.99, Pro $19.99)
  Webhook           — checkout.session.completed, subscription.deleted/updated
  KV structure      — slots:{userId}, cust:{customerId}, sig:{room}, msg:{}, etc.

sw.js               — Service Worker: offline cache + push notifications
lang.js             — 924 languages (generated, do not edit manually)
```

## Good examples (copy these patterns)

```javascript
// API call — GOOD
const resp = await postAPIRaw('/account/slots', { userId: _userId });
if (resp.ok) { const data = await resp.json(); ... }

// API call — BAD (don't do this)
const resp = await fetchT(API + '/account/slots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });

// DOM — GOOD
const el = _DOM.get('msg-input');

// DOM — BAD
const el = document.getElementById('msg-input');

// i18n — GOOD
showToast(t('toastSendFail'), 'error');

// i18n — BAD
showToast('Send failed', 'error');

// Template styles — GOOD
d.className = 'i-tiny-meta';

// Template styles — BAD
d.style.fontSize = '10px'; d.style.color = 'var(--t3)';

// Time — GOOD
setTimeout(fn, MS.MIN);

// Time — BAD
setTimeout(fn, 60000);

// Download — GOOD (v3.6)
downloadBlob(blob, 'export.json');

// Download — BAD
const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'export.json'; a.click();

// HTML output — GOOD (v3.6: Trusted Types)
safeSetHTML(el, html);

// HTML output — BAD (bypasses sanitization)
el.innerHTML = html;

// Swipe animation — GOOD (v3.6: CSS classes)
el.classList.add('swiping'); el.style.transform = `translateX(${dx}px)`;
// On end:
el.classList.remove('swiping'); el.classList.add('swipe-back');

// Swipe animation — BAD
el.style.transition = 'none'; el.style.transform = `translateX(${dx}px)`;
```

## Bad examples (avoid these patterns)
- `Admin.tsx`-style god functions — break into small focused functions
- Hardcoded `'Error occurred'` — use `t('errorKey')`
- `catch(e) {}` empty blocks — at minimum `_dbg(e)`
- `innerHTML = '<b>' + name` without `esc()` — XSS vulnerability

## Worker patterns

```javascript
// Handler — GOOD: validate early, return early
async function handleExample(body, env, request) {
  const { userId, data } = body;
  if (!userId) return json({ error: 'userId required' }, 400, request);
  if (!data || typeof data !== 'string') return json({ error: 'data required' }, 400, request);
  const clean = sanitizeString(data, 256);
  // ... process
  return json({ ok: true }, 200, request);
}

// KV — always use helpers with error handling
const val = await kvGet(env, `slots:${userId}`);   // returns null on error
const ok = await kvPut(env, key, value, { expirationTtl: 300 }); // returns false on error
```

## Adding a new slash command

1. Add handler in command section: `if (val === '/yourcommand') { ... }`
2. Add to /help output array
3. Add i18n keys (EN + JA) if producing UI text
4. Run `./validate.sh`

## Adding a new Worker endpoint

1. Add `case '/api/yourpath':` in switch statement
2. Add rate limit entry in `limits` object
3. Write handler with `if (!field) return json({ error }, 400, request)` validation
4. Sanitize all string inputs with `sanitizeString()`
5. Use `kvGet`/`kvPut` helpers (never raw `env.KV.get`)
6. Run `node -c _worker.js`

## CSS custom properties

```
--bg: background    --s1/s2/s3: surfaces    --b1: border
--t1/t2/t3: text    --g/gd/gl: green accent  --r: red/error
--rad: border-radius --font: system font      --mono: monospace
--ease: transition   --touch: 48px min target
```

## Quality gates (validate.sh)

| Gate | What |
|------|------|
| 1. Syntax | index.html, _worker.js, sw.js |
| 2. Security | eval=0, CSP present, no API key leaks |
| 3. i18n | Hardcoded strings < 10, toast i18n >= 95% |
| 4. Code Quality | .style.X < 25, onclick=0, DRY headers=100% |
| 5. Performance | Lines < 12K, RAF >= 2, Fragment >= 1 |
| 6. Protocol | 6 crypto features verified |
| 7. Files | 10 required files exist |

## PR checklist
- `./validate.sh` passes 35/35
- Syntax check green for all edited files
- i18n keys added for both EN and JA
- No hardcoded strings, colors, or magic numbers
- No inline styles in JS templates
- Diff is small and focused

## When stuck
- Propose a plan before making large changes
- Check SPEC.md for architectural decisions
- Check CONTRIBUTING.md for coding standards
- Ask a clarifying question rather than guessing
