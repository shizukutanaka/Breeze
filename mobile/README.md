# Breeze Mobile (Android + iOS)

Capacitor 6 wrapper for the Breeze web app.

The packaged webview serves from `https://app.breeze.local`, so API calls and invite
links resolve against `PACKAGED_API_ORIGIN`/`SHARE_BASE` in `index.html` (default:
the hosted breeze.pages.dev deployment — repoint it to self-host).

## Quick Start

```bash
cd mobile
npm ci
npm run prepare:www       # Copy web assets → www/
npm run android:open      # Open in Android Studio
npm run ios:open          # Open in Xcode (macOS only)
```

## Build APK

```bash
# Debug (unsigned)
npm run android:build:debug

# Release (requires keystore)
KEYSTORE_BASE64=... KEYSTORE_PASS=... ./scripts/build-mobile.sh android release
```

## Directory Structure

```
mobile/
├── capacitor.config.json   — App config (id, plugins, platform settings)
├── package.json            — Capacitor 6.x dependencies
├── prepare.js              — Web asset copier (validates + hashes)
├── scripts/
│   └── build-mobile.sh     — CI/local build script (Android/iOS)
└── www/                    — (generated) Web assets for Capacitor

Optional resource overlays can be placed under `res/` — `res/android/*` is copied
over `android/app/src/main/res/` at build time (guarded; absent = no-op).
```

## CI/CD

A release workflow (APK on tag push) is planned — `.github/workflows/` is not yet
active on GitHub (see `docs/CI-SETUP.md` for the blocker + activation runbook).
Until then build locally with `./scripts/build-mobile.sh android release`.
Required secrets when a workflow does land:

| Secret | Description |
|--------|-------------|
| `KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `KEYSTORE_PASS` | Keystore password |

Generate keystore:
```bash
keytool -genkey -v -keystore release.keystore \
  -alias breeze -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_PASSWORD -dname "CN=Breeze Messenger"
```

## Asset Links (Android App Links)

Edit `/.well-known/assetlinks.json` with your SHA-256 fingerprint:
```bash
keytool -list -v -keystore release.keystore -alias breeze | grep SHA256
```
