#!/usr/bin/env bash
# ===========================================================================
# Breeze release checksums — write SHA256SUMS.txt covering EVERY asset.
#
#   bash tools/release-checksums.sh <asset-dir>
#
# Regenerates <asset-dir>/SHA256SUMS.txt with one "<sha256>  <name>" line
# per regular file in the directory (LC_ALL=C sorted), excluding
# SHA256SUMS.txt itself, so `sha256sum -c SHA256SUMS.txt` verifies the
# complete download set.
#
# Why this exists (measured on v3.7.1): the Release carried 11 downloads
# (self-host ZIP + 10 desktop installers) but SHA256SUMS.txt was 84 bytes
# — a single line for the ZIP — because tools/package-release.sh generated
# it before the desktop job attached its installers, and nothing ever
# regenerated it. Two callers now share this one generator:
#   * tools/package-release.sh — the packaging-time file (the output dir
#     holds just the ZIP at that point; same one-line result as before).
#   * .github/workflows/release.yml, job `checksums` — after the desktop
#     matrix attaches every installer, downloads the full asset set and
#     regenerates the sums over ALL of it, replacing the file on the
#     Release.
#
# Asset names are build-generated (no spaces/newlines), so the
# line-oriented format is safe here.
# ===========================================================================
set -euo pipefail

DIR="${1:?usage: release-checksums.sh <asset-dir>}"
[ -d "$DIR" ] || { echo "✗ not a directory: $DIR" >&2; exit 1; }
cd "$DIR"

rm -f SHA256SUMS.txt
find . -maxdepth 1 -type f ! -name 'SHA256SUMS.txt' -printf '%P\n' \
  | LC_ALL=C sort \
  | while IFS= read -r f; do sha256sum "$f"; done > SHA256SUMS.txt

echo "✓ $DIR/SHA256SUMS.txt: $(wc -l < SHA256SUMS.txt) file(s) covered"
