# CI & Repository Structure — activation runbook

> **Status (audit, item 52): the quality gates are NOT enforced on GitHub yet.**
> This document records why, and exactly how a maintainer activates them. It also
> **preserves the `ci.yml` content in version control** — the workflow file is
> `.gitignore`d (see below), so without this doc it exists only in an ephemeral
> working tree and would be lost.

## The finding

A Socratic "process" audit of the repository surfaced three coupled facts:

1. **The default branch (`main`) contains only `breeze.zip`.** Its root has no
   `_worker.js`, no `index.html`, no `tests/`, no `src/` — the entire source is
   trapped inside the zip. `actions/checkout` on `main` therefore sees no code,
   so CI cannot run there even if a workflow existed (the Phase 0 blocker).
2. **The unpacked source tree lives on the working branch** (e.g.
   `claude/nice-ride-T6yb0`): full source, `tests/` (638 tests), `src/crypto/`,
   `validate.sh`, `package.json`. This is the intended source-of-truth layout —
   it just hasn't been merged to `main`.
3. **`.github/workflows/` is `.gitignore`d on every branch.** The automation
   account used for commits lacks GitHub's `workflows` OAuth scope, so it cannot
   push `.github/workflows/*` (GitHub rejects such pushes). The workflow files
   exist only locally / inside `breeze.zip`.

**Consequence:** `npm test`, `validate.sh`, the syntax checks, and the
`breeze.zip` build artifact step do **not** run automatically on GitHub. Every
regression-protection guarantee in this repo currently depends on a developer
running the suite locally. The hardening landed across items 26–51 is real and
locally green, but **nothing gates a merge** until the steps below are done.

## Activation (one-time, requires a maintainer with `workflows` permission)

1. **Land the source tree on `main`.** Merge the working branch (which holds the
   unpacked source + tests) into `main`, replacing the zip-only layout. After
   this, `main` checks out as real source. `breeze.zip` is already `.gitignore`d
   and is produced as a CI artifact instead of being tracked.
2. **Add the workflow from a privileged account.** From an account/token that has
   the GitHub `workflows` scope, create `.github/workflows/ci.yml` with the
   content in the next section (or remove the `.github/workflows/` line from
   `.gitignore` and `git add -f` it from such an account), then push.
3. **Verify.** Open a no-op PR against `main`; confirm the `CI` check runs
   checkout → `npm ci` → syntax check → `npm test` → `validate.sh` → build zip,
   and goes green.

## Canonical `ci.yml` (preserve / copy verbatim)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Syntax check
        run: |
          node -e "
            const h = require('fs').readFileSync('index.html','utf8');
            const js = h.match(/<script>([\s\S]*?)<\/script>/)[1];
            require('fs').writeFileSync('/tmp/t.js', js);
          "
          node -c /tmp/t.js
          node -c _worker.js
          node -c sw.js

      - name: Unit tests
        run: npm test

      - name: Quality gates
        run: |
          chmod +x validate.sh
          ./validate.sh

      - name: File size check
        run: |
          SIZE=$(wc -c < index.html)
          echo "index.html: $SIZE bytes"
          if [ "$SIZE" -gt 600000 ]; then
            echo "WARNING: index.html exceeds 600KB ($SIZE bytes)"
          fi

      - name: Build breeze.zip artifact
        run: bash build.sh zip

      - name: Upload breeze.zip
        uses: actions/upload-artifact@v4
        with:
          name: breeze-zip
          path: breeze.zip
          if-no-files-found: error
```

## Notes / suggested hardening once active

- **Node version**: the suite is verified locally on Node 22; `ci.yml` pins Node
  20. Both support the Ed25519/X25519 WebCrypto the crypto tests need. If CI ever
  fails on a curve primitive, bump `node-version` to `22` to match the verified
  baseline.
- **pow.test.js** was de-flaked (item 51) so the real difficulty-16 solves no
  longer time out under CI's parallel runners.
- The syntax-check step extracts the **first** `<script>` block of `index.html`;
  keep the main app logic in that block. Crypto modules under `src/crypto/` are
  syntax-checked transitively because `npm test` imports them.
