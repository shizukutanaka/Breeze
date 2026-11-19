# Pre-release audit — v3.7.0 (first public release candidate)

*2026-11-20. Measured against the repository's release-quality
gate: an item counts only with evidence; an item without
evidence is unmet, and unmet items are named, not hidden.*

## The nine items

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Claims match reality | **Pass after fixes** | The comparison page is test-pinned (`tests/comparison-claims.test.js`). This audit found and fixed two stale README claims: "Single HTML file (13K lines)" (the file is ~16K lines plus ES modules) and an unqualified "$0/month" (now "$0 within free tiers", matching the Running Costs table) |
| 2 | The artifact is obtainable and hash-verifiable | **Pass (mechanism)** | `tools/package-release.sh v3.7.0` built locally: ZIP (77 files) + `SHA256SUMS.txt`, `sha256sum -c` OK. The tag itself does not exist yet — cutting it is the owner's publication decision |
| 3 | A newcomer reaches first success in ~5 minutes, with a real screenshot | **Partial** | Quick Start is three steps and self-hosting is drilled by `tests/node-host.test.js`. The README screenshot predates the stage 4–7 UI (profile, stickers, location, group calls); the first-run screen it depicts is the identity-creation screen, but the shot should be refreshed on a real device before wide promotion |
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
   sharing) and a refreshed screenshot.

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
