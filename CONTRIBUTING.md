# Contributing to Breeze

Thank you for your interest in contributing to Breeze!

## Getting Started

```bash
git clone https://github.com/shizukutanaka/Breeze.git
cd breeze
```

No build step required — open `index.html` directly in a browser for local development.

For server features (signaling, billing), deploy to Cloudflare Pages:
```bash
wrangler pages dev .
```

## Development Guidelines

### Design Philosophy

Every change should align with our three principles:

1. **Carmack** (performance-first): Data-oriented design, avoid allocations, cache DOM
2. **Martin** (clean code): Single responsibility, DRY, no dead code
3. **Pike** (simplicity): No frameworks, no build steps, minimal dependencies

### Code Standards

| Rule | How |
|------|-----|
| UI text | Always use `t('key')` — never hardcode English |
| DOM access | Use `_DOM.get('id')` — never raw `getElementById` |
| API calls | Use `postAPIRaw()` / `_signal()` — never raw `fetchT(API+)` |
| Styles | Use CSS utility classes (`.i-*`) — never inline `style=""` |
| Time values | Use `MS.HOUR`, `MS.DAY` etc. — never magic numbers |
| Headers | Use `_H` constant — never `{ 'Content-Type': 'application/json' }` |

### Before Submitting

1. Run `./validate.sh` — must score 35/35 (100%)
2. Test in Chrome, Firefox, and Safari
3. Check browser DevTools console for errors
4. Add i18n keys for both EN and JA if adding UI text

### File Structure

```
index.html      — Client (HTML + CSS + JS, single file)
_worker.js      — Cloudflare Worker (API endpoints)
sw.js           — Service Worker (offline + push)
lang.js         — 924 languages (generated, do not edit)
validate.sh     — Quality gate validator
build.sh        — Multi-platform build script
```

### Adding a New Slash Command

1. Add handler in the command processing section (search for `val === '/yourcommand'`)
2. Add to `/help` output
3. Add i18n keys (EN + JA) if command produces UI text
4. Run `./validate.sh`

### Adding a New API Endpoint

1. Add route in `_worker.js` switch statement
2. Add rate limit entry
3. Add handler function
4. Use `postAPIRaw()` from client side
5. Document in SPEC.md

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
