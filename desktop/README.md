# Breeze Desktop (Windows / macOS / Linux)

Electron wrapper for the Breeze web app.

## Quick Start

```bash
cd desktop
npm ci
npm start              # Dev mode (loads ../index.html)
BREEZE_URL=https://breeze.pages.dev npm start  # Remote mode
```

## Build

```bash
npm run build:win      # Windows (.exe + portable)
npm run build:mac      # macOS (.dmg, universal)
npm run build:linux    # Linux (.AppImage + .deb + .rpm)
npm run build:all      # All platforms
```

## Features

- System tray with badge count
- Auto-update via GitHub Releases
- `breeze://` deep link protocol
- Native notifications
- Window bounds persistence
- CSP enforcement
- Global shortcut: Ctrl+Shift+B

## Architecture

```
desktop/
├── main.js          — Main process (window, tray, IPC, updates)
├── preload.js       — contextBridge API (notify, badge, update)
├── package.json     — Electron 29 + electron-builder config
├── icon.*           — Platform icons
├── entitlements.mac.plist
└── scripts/
    └── postinst.sh  — Linux post-install (desktop entry)
```

## Code Signing

**Windows**: Set `CSC_LINK` (pfx path) and `CSC_KEY_PASSWORD` env vars.
**macOS**: Set `CSC_NAME` (Apple Developer ID) or use `--identity` flag.
**Linux**: No signing required for .AppImage.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BREEZE_URL` | Remote URL (default: load local index.html) |
| `GH_TOKEN` | GitHub token for auto-update publishing |
