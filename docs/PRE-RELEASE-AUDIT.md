# Pre-release audit — v3.7.0 (first public release candidate)

*2026-11-20. Measured against the repository's release-quality
gate: an item counts only with evidence; an item without
evidence is unmet, and unmet items are named, not hidden.*

## The nine items

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Claims match reality | **Pass after fixes** | The comparison page is test-pinned (`tests/comparison-claims.test.js`). This audit found and fixed two stale README claims: "Single HTML file (13K lines)" (the file is ~16K lines plus ES modules) and an unqualified "$0/month" (now "$0 within free tiers", matching the Running Costs table) |
| 2 | The artifact is obtainable and hash-verifiable | **Pass (mechanism)** | `tools/package-release.sh v3.7.0` built locally: ZIP (77 files) + `SHA256SUMS.txt`, `sha256sum -c` OK. The tag itself does not exist yet — cutting it is the owner's publication decision |
| 3 | A newcomer reaches first success in ~5 minutes, with a real screenshot | **Partial** | Quick Start is three steps and self-hosting is drilled by `tests/node-host.test.js`. The README screenshot was refreshed on 2026-11-20 from the current build (headless capture of the real app: identity created, main window, current composer with location/sticker actions); a real-device shot is still recommended before wide promotion |
| 4 | Tests honestly green | **Pass** | Full suite run at audit time: 1,961/1,962 with a single PoW-solving test flaking under parallel load (a different PoW test flaked on each of two runs; both files pass standalone — worker 463/463, mirror-drift 93/93 — the known shared-VM load effect, not a code failure). `validate.sh` PASSED (165/171) |
| 5 | Main flows actually run | **Partial, disclosed** | Messaging, groups (to n=1,000), two-relay discovery, TURN budget and recovery flows are drilled in-process against the real handlers. NOT yet done: two physical devices, real-network WebRTC, a real 3-party call. Disclosed in `docs/COMPARISON.md` ("Where Breeze loses") and the transparency report |
| 6 | Failures are never silent | **Pass** | Quota refusals name their scope and notify; a spent TURN budget notifies; the release workflow refuses a mismatched version label; errors surface with reasons in the UI/audit log |
| 7 | Data and rights are clean | **Pass** | The operator holds no user data by design (`tests/data-principle.test.js`). MIT LICENSE at the root; the vendored ML-KEM carries its provenance + tarball hash in its header; the BIP39 wordlist is vendored as data with its source named |
| 8 | Security review complete, no Critical/High open | **Pass with a named limit** | Per-stage security reviews are in the stage records; known limitations are documented (franking cannot bind a malicious sender; call-signalling TOFU window; no continuous PQ re-keying). An **external** audit has not happened — `docs/AUDIT.md` is the preparation for one, and the comparison page says so |
| 9 | Ledgers match reality | **Pass** | SHARE_PLAN stage records updated through stage 7; CHANGELOG sectioned ([3.7.0] cut from [Unreleased] by this audit — 3.6.1 had shipped without a changelog section, which is part of why the first tag is 3.7.0, not 3.6.1) |

## Socratic leftovers — questions this audit could not answer with code

- **Why would the first user come?** The release is a
  self-hosting ZIP; the hosted demo is still 404 (owner-side).
  Publishing the ZIP before the demo means the first audience
  is self-hosters and reviewers — a defensible first ring, but
  it should be a *decision*, not an accident.
- **Is 3.7.0 the right number?** Stages 4–7 added group calls,
  locations, stickers, profiles and the share infrastructure on
  top of 3.6.x, with no breaking wire change (capability
  negotiation absorbs the differences). A minor bump is the
  honest label; a 4.0.0 would claim a break that did not happen.
- **What would make us delay?** A Critical/High finding, a red
  suite, or a claim found stale. None is currently open.

## Remaining owner-side acts

1. Push the tag `v3.7.0` (publication decision) — the workflow
   then tests, gates, packages and creates the Release.
2. Restore the hosted demo (owner's Cloudflare account).
3. Real-device checks (two devices, group call, location
   sharing). The screenshot was refreshed headlessly on
   2026-11-20; a real-device shot remains a promotion-time
   nicety, not a release blocker.

## Addendum — 2026-11-20, software form (owner: "if it is not software, make it software")

The desktop build was exercised for real after this audit, and
it was NOT in releasable shape: (1) no package-lock.json existed
for desktop/, mobile/ or tauri/, so every scripted `npm ci`
failed immediately; (2) build.sh's copy_web resolved sources
from the caller's cwd, so packaged builds died with
"index.html missing"; (3) the Electron extraResources omitted
src/crypto and src/app — the packaged app would have booted
without its runtime-imported modules; (4) build.files omitted
nav-guard.js and csp-guard.js, so the packaged app crashed on
launch ("Cannot find module './nav-guard'", reproduced
headlessly under xvfb). All four are fixed, the Linux build now
produces AppImages whose unpacked tree carries the full module
set, and a headless launch runs without main-process or bridge
errors. The launch also exposed a fifth defect, in every form
including web: the location bridge referenced sanitizeLoc &
friends without importing them (ReferenceError aborted the
module block; the location bridge — and the backup bridge after
it — never registered). Fixed, and pinned by
tests/bridge-resolution.test.js; packaging shape is pinned by
tests/desktop-packaging.test.js. sw.js no longer raises an
uncaught addAll rejection under the desktop file:// origin.
README now presents the installable apps as the primary form.
Windows/macOS packaged builds and a real-machine launch remain
unverified (owner's PC).

## Addendum 2 — 2026-11-20, all-OS targeting (owner instruction)

Windows: a sixth defect — desktop/icon.ico held only 16x16 and
a malformed 192 entry, and electron-builder rejects icons
without a 256x256 entry; regenerated multi-resolution from
icon-1024.png and pinned by test. The Windows app package
itself (win-unpacked, x64 + arm64, Breeze.exe) builds, and the
NSIS payloads build; the final installer assembly on Linux
requires wine (electron-builder 24.x), so on this VM it stops
there — the release workflow builds it natively on
windows-latest instead. macOS DMG tooling is macOS-only
(dmg-license), likewise built on macos-latest. Android: the
Capacitor sync and asset preparation pass locally; the Gradle
distribution download is blocked by this VM's egress proxy
(environment limit, not a code defect). release.yml now has
package + desktop (win/mac/linux, native per OS, attached to
the Release on tag pushes) + android (debug APK as a workflow
artifact; public attachment waits for release signing secrets,
which are the owner's). iOS builds require a Mac with Xcode;
the mobile project is in-tree and syncs from the same tree.

## Addendum 3 — 2026-11-20: v3.7.0 published; desktop legs fixed and the tag re-pointed

The v3.7.0 tag was pushed and the Release published on 2026-11-20 (the
package job's ZIP + SHA256SUMS attached as designed). The three desktop
legs of that first run then each failed at a *different* point — none of
them visible to the local builds, which had only ever exercised the
Linux AppImage target on a machine with the author's tree already in
place:

- **Linux** died at the DEB target: electron-builder's fpm requires an
  author email for DEB/RPM metadata, and `desktop/package.json` carried
  a bare `"Breeze Project"` string. Reproduced from a clean checkout
  before fixing. The AppImages themselves had built fine.
- **macOS** built its DMG/ZIP, then failed at electron-builder's own
  publish step (`GH_TOKEN is not set`): the `publish` block — which
  must stay, because electron-updater reads its update feed from it —
  makes a tag build try to publish by itself, while this workflow
  attaches assets on its own. `build.sh` now passes `-p never` on
  every electron-builder invocation.
- **Windows** crashed inside `WinPackager.signApp` although no signing
  certificate exists anywhere: with nothing to sign with, the honest
  configuration is to not enter that path — `win.signAndEditExecutable`
  is now `false` until a certificate exists.

Fixes are pinned in `tests/desktop-packaging.test.js`. Two workflow
changes ride along: the Linux leg now also attaches the `.deb`/`.rpm`
it builds (they were built but never attached), and it provisions
`rpmbuild` explicitly instead of assuming the runner image has it.

Because a workflow re-run reuses the tagged commit, the fixes could
not reach the v3.7.0 run by re-running it. The Release was therefore
deleted and the `v3.7.0` tag re-pointed at the fixed tree on the same
day, before any announcement; the recreated Release carries the same
ZIP (its allowlist excludes everything the fix touched) plus the
desktop installers. Recorded here so the tag's history is not a
surprise to anyone who looks.
