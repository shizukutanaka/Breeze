# Breeze Desktop (Tauri)

Lightweight Rust-based desktop app. **~5MB binary** vs ~150MB Electron.

## Prerequisites

- [Rust](https://rustup.rs) (stable)
- [Node.js](https://nodejs.org) (v20+)
- Platform-specific:
  - **macOS:** Xcode Command Line Tools
  - **Linux:** `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf`
  - **Windows:** Visual Studio Build Tools (C++ workload)

## Build

```bash
cd tauri
npm install
npx @tauri-apps/cli build
```

## Platform-specific

```bash
# macOS Universal (Intel + Apple Silicon)
npx @tauri-apps/cli build --target universal-apple-darwin

# Windows
npx @tauri-apps/cli build --target x86_64-pc-windows-msvc

# Linux
npx @tauri-apps/cli build --target x86_64-unknown-linux-gnu
```

## Development

```bash
npx @tauri-apps/cli dev
```

## Features

- System tray (hide-to-tray on close)
- Global shortcut: `Ctrl+Shift+B`
- `breeze://` deep link protocol
- Native notifications
- Auto-update via GitHub releases
- CSP enforcement
- Sandboxed WebView

## Output

| Platform | Formats | Size |
|----------|---------|------|
| Windows | `.exe` (NSIS), `.msi` | ~5MB |
| macOS | `.dmg` (universal) | ~8MB |
| Linux | `.AppImage`, `.deb`, `.rpm` | ~5MB |

## vs Electron

| | Tauri | Electron |
|---|---|---|
| Binary size | ~5MB | ~150MB |
| RAM usage | ~30MB | ~200MB |
| Startup time | <0.5s | ~2s |
| Engine | System WebView | Bundled Chromium |
| Language | Rust | JavaScript |
