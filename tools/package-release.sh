#!/usr/bin/env bash
# ===========================================================================
# Breeze release packager — builds the self-hostable distribution ZIP.
#
#   bash tools/package-release.sh <version-label> <output-dir>
#   e.g. bash tools/package-release.sh v3.6.1 dist-release
#
# Produces in <output-dir>:
#   breeze-<version-label>.zip   the deployable unit (layout below)
#   SHA256SUMS.txt               one "<sha256>  <name>" line per file in the
#                                output dir (tools/release-checksums.sh);
#                                the release workflow's checksums job later
#                                regenerates it over the full asset set
#
# What the ZIP is (and is not):
#   The repository has two documented ways to run a relay on your own
#   placement (README.md, docs/SELF_HOSTING.md), and both run from the
#   repository root with no build step:
#     * Cloudflare Pages:  wrangler pages deploy .   (wrangler.toml sets
#       pages_build_output_dir = ".", the Worker is _worker.js and the
#       static app is served from the same root)
#     * Docker / bare Node: docker compose up -d  /  node server/index.js
#       (server/ hosts the identical _worker.js handler plus the static
#       app from the same root; .dockerignore already defines this
#       runtime tree by excluding desktop/, mobile/, tauri/, tests/…)
#   So the ZIP is exactly that shared runtime tree, laid out at the ZIP
#   root so the documented commands work verbatim right after unzip:
#   the web/PWA files, _worker.js, src/ modules the client imports,
#   locales/, server/, and the operator files (wrangler.toml, Dockerfile,
#   docker-compose.yml, .env.example template, README, SELF_HOSTING).
#
#   It is NOT a source archive (GitHub already attaches one to every
#   Release): tests/, tools/, desktop/, mobile/, tauri/, dist/ and the
#   planning docs stay out. The file list below is an explicit allowlist
#   — nothing enters the ZIP unless it is named here — so local state
#   can never leak in: no .env (only the .env.example template, whose
#   values are placeholders), no *.db relay state, no node_modules.
#   package.json is deliberately omitted: the Node host has zero npm
#   dependencies (server/README.md) and Pages needs no manifest.
#
# Version guard: the label must equal "v" + CONFIG.VERSION in index.html.
# The release-sync/app-version tests pin every in-repo version literal
# together; this extends the same pin to the release label itself, so a
# mistyped tag fails the release instead of shipping a mislabeled ZIP.
# ===========================================================================
set -euo pipefail

LABEL="${1:?usage: package-release.sh <version-label> <output-dir>}"
OUT="${2:?usage: package-release.sh <version-label> <output-dir>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_VERSION="$(grep -o "VERSION: '[^']*'" index.html | head -1 | sed "s/VERSION: '//; s/'//")"
if [ "$LABEL" != "v$APP_VERSION" ]; then
  echo "✗ version label '$LABEL' does not match index.html CONFIG.VERSION '$APP_VERSION' (expected 'v$APP_VERSION')" >&2
  exit 1
fi

ZIP_NAME="breeze-$LABEL.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
APP="$STAGE/app"
mkdir -p "$APP"

# --- Allowlist: root web + Worker files (Cloudflare Pages deploy unit) ---
ROOT_FILES=(
  index.html no-default-server-flag.js _worker.js sw.js manifest.json
  icon-192.png icon-512.png
  _headers _redirects _routes.json
  404.html 404.js robots.txt sitemap.xml
  .well-known/assetlinks.json
  # Operator files: Pages config, Docker/Node self-host, env template.
  wrangler.toml Dockerfile docker-compose.yml .dockerignore .env.example
  # Operator docs and license.
  README.md LICENSE SECURITY.md docs/SELF_HOSTING.md
)
for f in "${ROOT_FILES[@]}"; do
  if [ ! -f "$f" ]; then echo "✗ required file missing: $f" >&2; exit 1; fi
  mkdir -p "$APP/$(dirname "$f")"
  cp "$f" "$APP/$f"
done

# --- Allowlist: module trees the runtime loads by relative path ---
# index.html imports ./src/crypto/*.js and ./src/app/*.js, fetches
# locales/*.json at boot; server/*.js is the Node host (index.js imports
# ../_worker.js, so it must sit next to the root files above).
for dir in src/crypto src/app locales server; do
  mkdir -p "$APP/$dir"
  cp "$dir"/* "$APP/$dir/"
done

# Release assets are distribution artifacts, not a placement the operator
# implicitly endorses as their relay. Bundle the deployment-time flag and
# load it before the first module script; the repository's own index.html
# remains untouched, so source/self-host checkouts keep the legacy behavior.
if ! grep -q 'src="./no-default-server-flag.js"' "$APP/index.html"; then
  awk '!done && /<script type="module">/ { print "  <script src=\"./no-default-server-flag.js\"></script>"; done=1 } { print }'     "$APP/index.html" > "$APP/index.html.tmp"
  mv "$APP/index.html.tmp" "$APP/index.html"
fi
grep -c 'src="./no-default-server-flag.js"' "$APP/index.html" | grep -q '^1$' || {
  echo "✗ failed to inject no-default-server flag exactly once" >&2; exit 1;
}

# --- Leak guard: the staging tree must hold no local state or secrets ---
if find "$APP" \( -name '.env' -o -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' \
     -o -name '*.sqlite*' -o -name 'node_modules' -o -name '.git' \) | grep -q .; then
  echo "✗ staging tree contains local state / secret material — refusing to package" >&2
  find "$APP" \( -name '.env' -o -name '*.db*' -o -name '*.sqlite*' \) >&2
  exit 1
fi

# --- DEPLOY.txt: generated operator note (version + the 3 run paths) ---
COMMIT="unknown"
if git rev-parse HEAD >/dev/null 2>&1; then COMMIT="$(git rev-parse HEAD)"; fi
cat > "$APP/DEPLOY.txt" <<EOF
Breeze $LABEL — self-hostable release
Source commit: $COMMIT

This ZIP is the deployable unit: unzip it anywhere and run one of the
documented paths from this folder (full guide: docs/SELF_HOSTING.md).

Cloudflare Pages (free tier):
  wrangler pages deploy . --project-name=breeze
  wrangler kv:namespace create KV   # then bind it as KV (see guide)

Docker:
  BREEZE_ALLOWLIST=<your Breeze ID> docker compose up -d

Bare Node (requires Node >= 24, no npm install needed):
  node server/index.js

Verify the download against SHA256SUMS.txt on the Release page:
  sha256sum -c SHA256SUMS.txt

Distribution builds open with no server configured. After deployment,
open the app, add your relay URL under Settings → Home relays, and use
that explicit relay. The unmodified repository checkout does not include
this default-server suppression flag.
EOF

# --- Pack: sorted entry order, no extra file attributes ---
mkdir -p "$OUT"
OUT_ABS="$(cd "$OUT" && pwd)"
rm -f "$OUT_ABS/$ZIP_NAME" "$OUT_ABS/SHA256SUMS.txt"
( cd "$APP" && find . -type f | LC_ALL=C sort | sed 's|^\./||' | zip -q -X "$OUT_ABS/$ZIP_NAME" -@ )

bash "$ROOT/tools/release-checksums.sh" "$OUT_ABS"

echo "✓ $OUT_ABS/$ZIP_NAME ($(du -h "$OUT_ABS/$ZIP_NAME" | cut -f1), $(unzip -Z1 "$OUT_ABS/$ZIP_NAME" | wc -l) files)"
echo "✓ $OUT_ABS/SHA256SUMS.txt: $(cat "$OUT_ABS/SHA256SUMS.txt")"
