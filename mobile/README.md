# Breeze Mobile (Android + iOS)

Capacitor 6 wrapper for the Breeze web app.

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
├── res/
│   ├── android/
│   │   ├── values/strings.xml
│   │   └── xml/network_security_config.xml
│   └── ios/
│       └── Info.plist.additions
└── www/                    — (generated) Web assets for Capacitor
```

## CI/CD

GitHub Actions `release.yml` builds APK on tag push. Required secrets:

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
