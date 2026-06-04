#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
#   Breeze v3.6.0 — Cross-Platform Build Script
#   Builds for: Web PWA, Electron (Win/Mac/Linux),
#               Tauri (Win/Mac/Linux), Capacitor (Android/iOS)
# ═══════════════════════════════════════════════════════════
set -euo pipefail

VERSION="3.6.0"
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="${ROOT}/release"

# Colors
G='\033[0;32m'; R='\033[0;31m'; Y='\033[0;33m'; B='\033[0;34m'; N='\033[0m'

usage() {
  echo "Usage: $0 <target>"
  echo ""
  echo "Targets:"
  echo "  web          Deploy to Cloudflare Pages"
  echo "  electron     Build Electron (Win/Mac/Linux)"
  echo "  tauri        Build Tauri (Win/Mac/Linux) [recommended]"
  echo "  android      Build Android APK"
  echo "  ios          Build iOS (requires macOS + Xcode)"
  echo "  all          Build everything"
  echo "  check        Validate all source files"
  echo ""
  echo "Options:"
  echo "  --release    Build in release mode (default)"
  echo "  --debug      Build in debug mode"
  exit 1
}

log() { echo -e "${G}[BUILD]${N} $1"; }
warn() { echo -e "${Y}[WARN]${N} $1"; }
err() { echo -e "${R}[ERROR]${N} $1"; exit 1; }

check_tool() {
  command -v "$1" &>/dev/null || { warn "$1 not found — skipping"; return 1; }
}

# ── Validate ─────────────────────────────────────────────
do_check() {
  log "Running quality gates..."
  cd "$ROOT"
  bash validate.sh
  node -e "const h=require('fs').readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*)<\/script>/);try{new Function(m[1]);console.log('✓ Client JS OK')}catch(e){console.log('✗ '+e.message);process.exit(1)}"
  node -c _worker.js
  log "All checks passed ✓"
}

# ── Web PWA ──────────────────────────────────────────────
do_web() {
  log "Deploying to Cloudflare Pages..."
  cd "$ROOT"
  if check_tool wrangler; then
    wrangler pages deploy . --project-name=breeze --commit-dirty=true
    log "Web deploy complete ✓"
  else
    err "wrangler CLI not found. Install: npm i -g wrangler"
  fi
}

# ── Electron ─────────────────────────────────────────────
do_electron() {
  log "Building Electron desktop apps..."
  cd "$ROOT/desktop"
  npm ci --prefer-offline 2>/dev/null || npm install

  mkdir -p "$OUT/electron"

  case "$(uname -s)" in
    Darwin)
      log "Building macOS .dmg..."
      npx electron-builder --mac --publish never
      cp dist/*.dmg "$OUT/electron/" 2>/dev/null || true
      log "Building Windows .exe (cross-compile)..."
      npx electron-builder --win --publish never || warn "Wine needed for Windows cross-compile"
      cp dist/*.exe "$OUT/electron/" 2>/dev/null || true
      ;;
    Linux)
      log "Building Linux AppImage + .deb..."
      npx electron-builder --linux --publish never
      cp dist/*.AppImage dist/*.deb "$OUT/electron/" 2>/dev/null || true
      log "Building Windows .exe (cross-compile)..."
      npx electron-builder --win --publish never || warn "Wine needed for Windows cross-compile"
      cp dist/*.exe "$OUT/electron/" 2>/dev/null || true
      ;;
    MINGW*|MSYS*|CYGWIN*)
      log "Building Windows .exe..."
      npx electron-builder --win --publish never
      cp dist/*.exe "$OUT/electron/" 2>/dev/null || true
      ;;
  esac

  log "Electron build complete ✓ → $OUT/electron/"
}

# ── Tauri (recommended) ──────────────────────────────────
do_tauri() {
  log "Building Tauri desktop apps (Rust binary ~5MB)..."
  check_tool cargo || err "Rust not installed. Install: https://rustup.rs"
  check_tool "cargo-tauri" || {
    log "Installing Tauri CLI..."
    cargo install tauri-cli 2>/dev/null || npm install -g @tauri-apps/cli
  }

  cd "$ROOT/tauri"
  mkdir -p "$OUT/tauri"

  case "$(uname -s)" in
    Darwin)
      log "Building macOS universal .dmg..."
      cargo tauri build --target universal-apple-darwin 2>/dev/null || cargo tauri build
      find src-tauri/target -name "*.dmg" -exec cp {} "$OUT/tauri/" \; 2>/dev/null || true
      ;;
    Linux)
      log "Building Linux AppImage + .deb..."
      cargo tauri build
      find src-tauri/target -name "*.AppImage" -o -name "*.deb" | head -4 | xargs -I {} cp {} "$OUT/tauri/" 2>/dev/null || true
      ;;
    MINGW*|MSYS*|CYGWIN*)
      log "Building Windows .exe + .msi..."
      cargo tauri build
      find src-tauri/target -name "*.exe" -o -name "*.msi" | head -4 | xargs -I {} cp {} "$OUT/tauri/" 2>/dev/null || true
      ;;
  esac

  log "Tauri build complete ✓ → $OUT/tauri/"
}

# ── Android ──────────────────────────────────────────────
do_android() {
  log "Building Android APK..."
  check_tool npx || err "Node.js not installed"

  cd "$ROOT/mobile"
  npm ci --prefer-offline 2>/dev/null || npm install
  node prepare.js

  mkdir -p "$OUT/android"

  if [ -n "${KEYSTORE_BASE64:-}" ]; then
    log "Decoding release keystore..."
    echo "$KEYSTORE_BASE64" | base64 -d > release.keystore
    bash scripts/build-mobile.sh android release
  else
    warn "No KEYSTORE_BASE64 set — building debug APK"
    bash scripts/build-mobile.sh android debug
  fi

  find . -name "*.apk" -exec cp {} "$OUT/android/" \; 2>/dev/null || true
  log "Android build complete ✓ → $OUT/android/"
}

# ── iOS ──────────────────────────────────────────────────
do_ios() {
  log "Building iOS..."
  [ "$(uname -s)" = "Darwin" ] || err "iOS builds require macOS"
  check_tool xcodebuild || err "Xcode not installed"

  cd "$ROOT/mobile"
  npm ci --prefer-offline 2>/dev/null || npm install
  node prepare.js

  mkdir -p "$OUT/ios"
  bash scripts/build-mobile.sh ios

  log "iOS build complete ✓ → $OUT/ios/"
  log "Open in Xcode: open ios/App/App.xcworkspace"
}

# ── Main ─────────────────────────────────────────────────
[ $# -lt 1 ] && usage
TARGET="$1"
mkdir -p "$OUT"

case "$TARGET" in
  web)      do_check && do_web ;;
  electron) do_check && do_electron ;;
  tauri)    do_check && do_tauri ;;
  android)  do_check && do_android ;;
  ios)      do_check && do_ios ;;
  check)    do_check ;;
  all)
    do_check
    do_electron 2>/dev/null || warn "Electron build failed"
    do_tauri 2>/dev/null || warn "Tauri build failed"
    do_android 2>/dev/null || warn "Android build failed"
    log "=== Build Summary ==="
    ls -lhR "$OUT/" 2>/dev/null
    ;;
  *) usage ;;
esac
