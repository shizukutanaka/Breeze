---
name: testing-breeze
description: How to browser-test the Breeze single-file PWA locally — serving, onboarding, slash-command UI, localStorage keys, and this machine's click-calibration quirks.
---

# Testing Breeze in a browser

## Serve & open
- `python3 -m http.server 8080` from the repo root, open `http://localhost:8080/index.html` in Chrome.
- Do NOT modify any file before serving: the CSP meta pins a hash of the inline script; edits break execution.
- On localhost the app is fully offline: `const API = location.hostname === 'localhost' || '127.0.0.1' ? '' : origin+'/api'` — ALL `/api/*` calls early-return (`if (!API) return`). No failed requests, no server banner. Anything needing the Worker API (@alias claiming, presence, TURN credentials, push) is untestable locally — it silently no-ops, which is correct.

## Golden path
- Onboarding: `#msg-name`, `#msg-alias` (pattern `[a-z0-9_]`, ≤20), `#b-msg-setup`. Identity is created client-side (WebCrypto + IndexedDB), lands on main UI with `breeze-xxxx-yyyy` short ID.
- Slash commands in `#msg-input` render panels into the message area even with no active contact: `/settings`, `/whoami`, `/qr`.
- Add contact: click `+` (`#b-msg-add`) → native `<dialog>` prompt. A raw base64 public key works fully offline; `@alias` needs the backend.
- Reload → identity loads from IndexedDB straight to main UI.
- localStorage keys for settings: `brz-relay-only`, `brz-send-sound`, `brz-notif-sound`, `brz-autolock` (`'1'`/`'0'`; relay-only auto-defaults only when the key is `null`). `_settings` is NOT reachable from the DevTools console (script-scoped) — verify via `localStorage` and rendered checkboxes.

## Known pitfalls (as of devin/i19-relay-only-default)
- **`safeSetHTML` strips `<label>`** (missing from `SAFE_TAGS` at index.html ~2678): every checkbox rendered through it (`/settings` panel, contact picker at ~7433) loses its label — option TEXT is a bare text node and does NOT toggle the input. Only the ~13px checkbox glyph is clickable. Expect most clicks near an option row to land on `DIV.cmd-panel-mono`.
- Chrome's "Install app" infobar and the in-app `.install-banner` can cover the bottom input bar; install the PWA (proves SW works — standalone window, shares localStorage/IndexedDB with the tab) or dismiss the banner's `×`.
- The 🗣 (STT) button sits right next to the textarea; a miss-click produces "Server error: not-allowed" toasts (SpeechRecognition denial) — cosmetic wording, not a defect.
- Installed-PWA windows hold in-memory `_settings` from their own load time — a `/settings` panel there can show stale checkbox states vs the current localStorage.

## Machine quirks (MacBook, 1024x768 screenshot space)
- `browser_console` and `read_dom` tools fail with "Chrome is not in the foreground" — work around by opening in-page DevTools (Cmd+Opt+J) and typing JS directly.
- Screen→viewport click mapping is ~`vp_x = 2.34·sx − 1` at 67% page zoom (Retina); tiny targets (~4px checkbox glyphs) may be unhittable — verify the element is topmost via `document.elementFromPoint(cx,cy)` and, for logic paths, `el.click()` in the page console is acceptable evidence.
- `Cmd+Tab` switches between the Chrome window and the installed "Breeze" PWA window (separate apps; clicking the Chrome Dock icon may not raise the browser window).
