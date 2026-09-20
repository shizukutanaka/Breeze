#!/bin/bash
set -euo pipefail
#
# Breeze Mobile Build Script
#
# Usage:
#   ./build-mobile.sh android [debug|release]
#   ./build-mobile.sh ios
#   ./build-mobile.sh check
#
# Release env vars:
#   KEYSTORE_BASE64  — base64-encoded release.keystore
#   KEYSTORE_PASS    — keystore password
#   KEY_ALIAS        — key alias (default: breeze)

PLATFORM="${1:-check}"
MODE="${2:-debug}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(dirname "$DIR")"
cd "$DIR"

echo "════════════════════════════════════"
echo "  Breeze Mobile — $PLATFORM ($MODE)"
echo "════════════════════════════════════"

# ── Pre-check ──────────────────────────
command -v node >/dev/null || { echo "✗ Node.js required"; exit 1; }
node prepare.js --check || exit 1
[ "$PLATFORM" = "check" ] && { echo "✓ Pre-check passed"; exit 0; }

# ── Dependencies ───────────────────────
[ -d node_modules ] || npm ci

# ── Prepare www/ ───────────────────────
node prepare.js

# ── Android ────────────────────────────
if [ "$PLATFORM" = "android" ]; then
  command -v java >/dev/null || { echo "✗ Java 17+ required"; exit 1; }

  npx cap add android 2>/dev/null || true
  npx cap sync android

  # Apply overlays
  OVERLAY="$DIR/res/android"
  TARGET="$DIR/android/app/src/main/res"
  if [ -d "$OVERLAY" ]; then
    for d in "$OVERLAY"/*/; do
      [ -d "$d" ] && cp -r "$d" "$TARGET/" 2>/dev/null || true
    done
    echo "✓ Android overlays applied"
  fi

  # Release keystore from CI
  if [ "$MODE" = "release" ] && [ -n "${KEYSTORE_BASE64:-}" ]; then
    echo "$KEYSTORE_BASE64" | base64 -d > "$DIR/android/app/release.keystore"
    ALIAS="${KEY_ALIAS:-breeze}"
    PASS="${KEYSTORE_PASS:?KEYSTORE_PASS required}"

    # Write signing config
    cat >> "$DIR/android/app/build.gradle" << GRADLE

android {
    signingConfigs {
        release {
            storeFile file("release.keystore")
            storePassword "$PASS"
            keyAlias "$ALIAS"
            keyPassword "${KEY_PASS:-$PASS}"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
GRADLE
    echo "✓ Signing configured"
  fi

  # Build
  TASK="assembleDebug"
  [ "$MODE" = "release" ] && TASK="assembleRelease"
  cd "$DIR/android" && ./gradlew "$TASK" --no-daemon -q

  APK=$(find "$DIR/android/app/build/outputs/apk/" -name "*.apk" | head -1)
  if [ -n "$APK" ] && [ -f "$APK" ]; then
    echo "✓ APK: $APK ($(du -sh "$APK" | cut -f1))"
  else
    echo "✗ APK not found"; exit 1
  fi
fi

# ── iOS ────────────────────────────────
if [ "$PLATFORM" = "ios" ]; then
  [ "$(uname)" = "Darwin" ] || { echo "✗ macOS + Xcode required"; exit 1; }

  npx cap add ios 2>/dev/null || true
  npx cap sync ios
  echo "✓ iOS synced → Open: npx cap open ios"
fi

echo "Done."
