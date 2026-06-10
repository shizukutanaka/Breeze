#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"; cd "$SCRIPT_DIR"

VERSION="3.6.0"
WEB_FILES=(index.html sw.js manifest.json lang.js icon-192.png icon-512.png)
# ESM crypto reference modules. index.html loads these via `import './src/crypto/*.js'`
# once the browser port lands (docs/INTEGRATION.md §0), so packaged builds must ship the
# directory — flattening into the app root would break the relative import path.
CRYPTO_DIR="src/crypto"

echo "=== Breeze Build v${VERSION} ==="
echo ""

copy_web() {
  local dst="$1"
  for f in "${WEB_FILES[@]}"; do
    [ -f "$f" ] && cp "$f" "$dst/" || { echo "✗ $f missing"; exit 1; }
  done
  # Ship the crypto modules with their path preserved so `./src/crypto/*.js` resolves
  # in Electron/mobile bundles (Cloudflare Pages already serves the repo tree directly).
  if [ -d "$CRYPTO_DIR" ]; then
    mkdir -p "$dst/$CRYPTO_DIR"
    cp "$CRYPTO_DIR"/*.js "$dst/$CRYPTO_DIR/"
    echo "✓ Crypto modules copied to $dst/$CRYPTO_DIR/"
  fi
  echo "✓ Web files copied to $dst/"
}

case "${1:-help}" in
  validate)
    bash validate.sh
    ;;

  web)
    echo "[Web] Deploying to Cloudflare Pages..."
    wrangler pages deploy . --project-name=breeze
    ;;

  desktop)
    echo "[Desktop] Building all platforms..."
    cd desktop && npm ci
    copy_web .
    npx electron-builder --win --x64
    npx electron-builder --linux --x64
    echo "✓ Win+Linux in desktop/dist/"
    ;;

  win|windows)
    cd desktop && npm ci
    copy_web .
    npx electron-builder --win --x64
    ;;

  mac|macos)
    cd desktop && npm ci
    copy_web .
    npx electron-builder --mac --universal
    ;;

  linux)
    cd desktop && npm ci
    copy_web .
    npx electron-builder --linux --x64
    ;;

  android)
    echo "[Android] Building APK..."
    cd mobile
    npm ci
    chmod +x scripts/build-mobile.sh
    ./scripts/build-mobile.sh android "${2:-debug}"
    ;;

  ios)
    echo "[iOS] Syncing..."
    cd mobile
    npm ci
    chmod +x scripts/build-mobile.sh
    ./scripts/build-mobile.sh ios
    ;;

  zip)
    # Produce breeze.zip from the tracked source (single source of truth).
    # The repo tree is authoritative; the zip is a build artifact for any
    # consumer that still wants a single-file snapshot.
    echo "[Zip] Building breeze.zip from tracked source..."
    rm -f breeze.zip
    git ls-files | zip -q breeze.zip -@
    echo "✓ breeze.zip ($(du -h breeze.zip | cut -f1))"
    ;;

  test)
    echo "[Test] Running vitest..."
    npm test
    ;;

  clean)
    echo "[Clean]"
    rm -rf mobile/www mobile/android mobile/ios mobile/node_modules
    rm -rf desktop/dist desktop/node_modules
    rm -f breeze.zip
    echo "✓ Clean"
    ;;

  *)
    echo "Usage: ./build.sh <command>"
    echo ""
    echo "  validate   Run quality gates (35 checks)"
    echo "  test       Run vitest unit tests"
    echo "  zip        Build breeze.zip artifact from tracked source"
    echo "  web        Deploy to Cloudflare Pages"
    echo "  desktop    Build Win + Linux (Electron)"
    echo "  win        Build Windows only"
    echo "  mac        Build macOS only"
    echo "  linux      Build Linux only"
    echo "  android    Build APK [debug|release]"
    echo "  ios        Sync iOS (requires macOS + Xcode)"
    echo "  clean      Remove all build artifacts"
    ;;
esac
