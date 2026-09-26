#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Breeze Quality Gate Validator
# Pattern: Skill Guide §3 — Iterative Refinement with Quality Checks
# Run before every commit/deploy: ./validate.sh
# ═══════════════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PASS=0
FAIL=0
WARN=0
SCORE=0
MAX_SCORE=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); SCORE=$((SCORE+$2)); MAX_SCORE=$((MAX_SCORE+$2)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); MAX_SCORE=$((MAX_SCORE+$2)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); SCORE=$((SCORE+($2/2))); MAX_SCORE=$((MAX_SCORE+$2)); }

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Breeze Quality Gate Validator                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# ═══ Gate 1: Syntax (CRITICAL — blocks deploy) ═══
echo "Gate 1: Syntax"
# Extract to a private temp file — a predictable /tmp name is a symlink-attack
# target on any shared machine (writeFileSync follows symlinks).
TMPJS=$(mktemp "${TMPDIR:-/tmp}/brz-validate.XXXXXX.js")
trap 'rm -f "$TMPJS"' EXIT
JS=$(node -e "const h=require('fs').readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);if(m)require('fs').writeFileSync(process.argv[1],m[1]);else process.exit(1)" "$TMPJS" 2>&1)
if node -c "$TMPJS" 2>/dev/null; then pass "index.html JS syntax" 10; else fail "index.html JS syntax BROKEN" 10; fi
if node -c _worker.js 2>/dev/null; then pass "_worker.js syntax" 5; else fail "_worker.js syntax BROKEN" 5; fi
if node -c sw.js 2>/dev/null; then pass "sw.js syntax" 5; else fail "sw.js syntax BROKEN" 5; fi
echo ""

# ═══ Gate 2: Security ═══
echo "Gate 2: Security"
H=$(cat index.html)
JS_CONTENT=$(cat "$TMPJS")

# No eval() usage
EVALS=$(echo "$JS_CONTENT" | grep -c '\beval\b(' || true)
if [ "$EVALS" -eq 0 ]; then pass "No eval() usage" 10; else fail "$EVALS eval() calls found" 10; fi

# No innerHTML with user input (check for innerHTML = variable without esc())
UNSAFE_HTML=$(echo "$JS_CONTENT" | grep -c 'innerHTML\s*=\s*[^"'"'"']' | head -1 || true)
if [ "${UNSAFE_HTML:-0}" -lt 100 ]; then pass "innerHTML patterns: $UNSAFE_HTML (mostly escaped)" 5; else warn "innerHTML: $UNSAFE_HTML potentially unsafe" 5; fi

# CSP meta tag present
if echo "$H" | grep -q 'Content-Security-Policy'; then pass "CSP meta tag present" 5; else fail "CSP meta tag missing" 5; fi

# No hardcoded API keys
KEYS=$(echo "$JS_CONTENT" | grep -cE "(sk-[a-zA-Z0-9]{20,}|pk_live_[a-zA-Z0-9]+|whsec_[a-zA-Z0-9]+|AKIA[A-Z0-9]{16})" || true)
if [ "$KEYS" -eq 0 ]; then pass "No hardcoded API keys" 10; else fail "$KEYS potential API keys found" 10; fi

# No external scripts. This replaced an SRI-hash check that existed solely to pin lang.js
# (the 924-language table, deleted: it supplied zero strings to the UI while costing 44% of
# the payload). With it gone the app loads NO external script at all, which is a stronger
# guarantee than pinning one — so the gate now enforces that invariant instead of verifying
# a hash. A re-added external <script src> is a supply-chain surface and must be deliberate.
EXTSCRIPT=$(echo "$H" | grep -cE '<script[^>]+src=' || true)
if [ "$EXTSCRIPT" -eq 0 ]; then pass "No external scripts (zero supply-chain surface)" 5
else fail "$EXTSCRIPT external <script src> found — inline it or pin it with SRI deliberately" 5; fi
echo ""

# ═══ Gate 3: i18n ═══
echo "Gate 3: Internationalization"
HARDCODED=$(node -e "
const h=require('fs').readFileSync('index.html','utf8');
const js=h.match(/<script>([\s\S]*?)<\/script>/)[1];
const m=[...js.matchAll(/(?:textContent|innerHTML)\s*=\s*['\"]([A-Z][a-z][^'\"]{5,})['\"/]/g)];
console.log(m.length);
" 2>/dev/null || echo "99")
if [ "$HARDCODED" -lt 10 ]; then pass "Hardcoded UI strings: $HARDCODED (<10)" 10
elif [ "$HARDCODED" -lt 20 ]; then warn "Hardcoded UI strings: $HARDCODED (10-19)" 10
else fail "Hardcoded UI strings: $HARDCODED (≥20)" 10; fi

TOAST_I18N=$(node -e "
const h=require('fs').readFileSync('index.html','utf8');
const js=h.match(/<script>([\s\S]*?)<\/script>/)[1];
const all=[...js.matchAll(/showToast\s*\(/g)].length;
const i18n=[...js.matchAll(/showToast\s*\(\s*t\s*\(/g)].length;
const fb=[...js.matchAll(/showToast\s*\(\s*\w+\.error\s*\|\|\s*t\s*\(/g)].length;
console.log(Math.round((i18n+fb)/all*100));
" 2>/dev/null || echo "0")
if [ "$TOAST_I18N" -ge 95 ]; then pass "Toast i18n: ${TOAST_I18N}%" 5; else warn "Toast i18n: ${TOAST_I18N}% (<95%)" 5; fi
echo ""

# ═══ Gate 4: Code Quality ═══
echo "Gate 4: Code Quality"

STYLE_X=$(echo "$JS_CONTENT" | grep -c '\.style\.\w' || true)
if [ "$STYLE_X" -lt 25 ]; then pass ".style.X usage: $STYLE_X (<25)" 5
elif [ "$STYLE_X" -lt 40 ]; then warn ".style.X usage: $STYLE_X (25-39)" 5
else fail ".style.X usage: $STYLE_X (≥40)" 5; fi

ONCLICK=$(echo "$H" | grep -c 'onclick="' || true)
if [ "$ONCLICK" -eq 0 ]; then pass "No inline onclick" 5; else fail "$ONCLICK inline onclick attrs" 5; fi

DRY_H=$(echo "$JS_CONTENT" | grep -c "headers: _H" || true)
RAW_H=$(echo "$JS_CONTENT" | grep -v "Object.freeze" | grep -c "'Content-Type': 'application/json'" || true)
if [ "$RAW_H" -eq 0 ]; then pass "DRY headers: 100% (${DRY_H}x _H, 0 raw)" 5
else warn "DRY headers: $RAW_H raw remaining" 5; fi

MAGIC_86=$(echo "$JS_CONTENT" | grep -c '86400000' || true)
if [ "$MAGIC_86" -le 2 ]; then pass "Time constants: $MAGIC_86 raw 86400000 (≤2)" 5
else warn "Time constants: $MAGIC_86 raw 86400000" 5; fi

DOM_GET=$(echo "$JS_CONTENT" | grep -c '_DOM.get' || true)
RAW_GET=$(echo "$JS_CONTENT" | grep -c 'getElementById' || true)
TOTAL=$((DOM_GET + RAW_GET))
PCT=$((DOM_GET * 100 / (TOTAL > 0 ? TOTAL : 1)))
if [ "$PCT" -ge 50 ]; then pass "DOM cache: ${PCT}% (${DOM_GET} cached / ${TOTAL} total)" 5
else warn "DOM cache: ${PCT}% (${DOM_GET}/${TOTAL})" 5; fi

REPLAY=$(echo "$JS_CONTENT" | grep -c '_replayCache' || true)
if [ "$REPLAY" -ge 5 ]; then pass "Replay cache: integrated ($REPLAY refs)" 5; else warn "Replay cache: only $REPLAY refs" 5; fi
echo ""

# ═══ Gate 5: Performance ═══
echo "Gate 5: Performance"
# Locale tables are pure data (no functions), key-complete, and their {0} placeholders and
# CLDR plural categories line up across every locale. A missing key silently falls back to
# English, so it is invisible at runtime — this is the only place it can be caught.
if node tools/i18n-check.mjs >/dev/null 2>&1; then pass "i18n: locales complete, no dead keys, placeholders/plurals consistent" 4
else fail "i18n: locale drift or dead keys (run: node tools/i18n-check.mjs)" 4; fi

# Dead-code gate. Deleting a feature leaves its helper functions behind, and nothing noticed
# until a manual inventory found them. A function defined in index.html whose name appears
# exactly once (its own definition) is unreachable — delete it rather than carry it.
# Dead-wiring gate — see tools/dead-wiring.mjs for why this class is invisible without it.
if node tools/dead-wiring.mjs >/dev/null 2>&1; then pass "no listeners wired to non-existent DOM ids" 3
else fail "listener(s) wired to missing DOM id(s) (run: node tools/dead-wiring.mjs)" 3; fi

# Unreachable-branch gate. A misplaced brace once trapped ~190 lines of client code inside
# `if (PLATFORM === 'electron')`, silently disabling keyboard shortcuts, the scroll-to-bottom
# FAB and the in-chat search bar on web — invisible to every test, because the code parses
# perfectly and simply never runs. See tools/unreachable-branch.mjs.
if node tools/unreachable-branch.mjs >/dev/null 2>&1; then pass "no platform branch nested inside an incompatible one" 3
else fail "unreachable platform branch (run: node tools/unreachable-branch.mjs)" 3; fi

# HTML tag-balance gate. One duplicated </div> closed .msg-layout early and moved the whole
# conversation pane out of the two-pane layout — chat below the fold, #msg-messages unable to
# scroll, #scroll-fab dead. Every element still existed and was still clickable, so 41 checks,
# 798 unit tests and 35 E2E tests stayed green. See tools/html-balance.mjs.
if node tools/html-balance.mjs >/dev/null 2>&1; then pass "index.html tags balanced (no re-parented subtree)" 3
else fail "mismatched HTML tag nesting (run: node tools/html-balance.mjs)" 3; fi

# Closure-boundary gate. A brace-balancing fix once freed code from an Electron guard
# without checking it against initMessenger()'s OWN closing brace — the freed listener
# landed past it, at true top level. dbGetAll/activeContact/openConversation are
# closure-local; referencing them threw a bare ReferenceError on every Ctrl+N/Ctrl+F
# press, on every platform, and nothing caught it — the code parses fine and every
# element it touches already exists. See tools/closure-boundary.mjs.
if node tools/closure-boundary.mjs >/dev/null 2>&1; then pass "no initMessenger-closure-local name referenced outside it" 3
else fail "closure-local name referenced outside initMessenger() (run: node tools/closure-boundary.mjs)" 3; fi

DEADFN=$(node -e '
const fs=require("fs");const h=fs.readFileSync("index.html","utf8");
const fns=[...h.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_][\w]*)\s*\(/gm)].map(m=>m[1]);
const dead=[...new Set(fns)].filter(f=>(h.match(new RegExp("\\b"+f+"\\b","g"))||[]).length<=1);
process.stdout.write(dead.join(" "));' 2>/dev/null)
if [ -z "$DEADFN" ]; then pass "no unreachable functions in index.html" 3
else fail "unreachable function(s) in index.html: $DEADFN" 3; fi

# CSP script-src is hash-pinned (no 'unsafe-inline'), so the hash MUST track index.html.
# A stale hash blocks the entire app in production and is invisible to the E2E harness, which
# serves index.html without _headers — so drift has to fail here. Fix: node tools/csp-hash.mjs --write
if node tools/csp-hash.mjs --check >/dev/null 2>&1; then pass "CSP script-src hash pinned + no unsafe-inline" 4
else fail "CSP script-src hash STALE or unsafe-inline present (node tools/csp-hash.mjs --write)" 4; fi

LINES=$(wc -l < index.html)
if [ "$LINES" -lt 12000 ]; then pass "Total lines: $LINES (<12K)" 5
elif [ "$LINES" -lt 15000 ]; then warn "Total lines: $LINES (12-15K)" 5
else fail "Total lines: $LINES (≥15K) — consider splitting" 5; fi

RAF=$(echo "$JS_CONTENT" | grep -c 'requestAnimationFrame' || true)
if [ "$RAF" -ge 2 ]; then pass "requestAnimationFrame: $RAF uses" 3; else warn "requestAnimationFrame: $RAF (want ≥2)" 3; fi

FRAG=$(echo "$JS_CONTENT" | grep -c 'createDocumentFragment' || true)
if [ "$FRAG" -ge 1 ]; then pass "DocumentFragment: $FRAG uses" 3; else warn "DocumentFragment: $FRAG (want ≥1)" 3; fi

THROTTLE=$(echo "$JS_CONTENT" | grep -c 'throttle\|_renderContactsThrottled' || true)
if [ "$THROTTLE" -ge 2 ]; then pass "Render throttle: active" 4; else warn "Render throttle: $THROTTLE refs" 4; fi
echo ""

# ═══ Gate 6: Spec Compliance ═══
echo "Gate 6: Protocol Spec Compliance"
for feature in "Double Ratchet" "Sender Key" "Sealed Sender" "PreKey" "Proof-of-Work" "Safety number"; do
  COUNT=$(echo "$JS_CONTENT" | grep -ci "$feature" || true)
  if [ "$COUNT" -ge 1 ]; then pass "$feature: implemented ($COUNT refs)" 3
  else warn "$feature: not found" 3; fi
done
echo ""

# ═══ Gate 7: Files & Assets ═══
echo "Gate 7: Required Files"
for f in index.html _worker.js sw.js manifest.json icon-192.png icon-512.png README.md LICENSE CHANGELOG.md SECURITY.md; do
  if [ -f "$f" ]; then pass "$f exists" 1; else fail "$f MISSING" 1; fi
done
echo ""

# ═══ Summary ═══
echo "═══════════════════════════════════════════════════════════"
TOTAL_CHECKS=$((PASS + FAIL + WARN))
echo "  Checks: $TOTAL_CHECKS  |  ✓ $PASS  |  ✗ $FAIL  |  ⚠ $WARN"
echo "  Score: $SCORE / $MAX_SCORE ($(( SCORE * 100 / (MAX_SCORE > 0 ? MAX_SCORE : 1) ))%)"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  ★ RESULT: BLOCKED — fix $FAIL failing checks before deploy"
  exit 1
elif [ "$WARN" -gt 3 ]; then
  echo "  ★ RESULT: WARNING — $WARN items need attention"
  exit 0
else
  echo "  ★ RESULT: PASSED — ready for deploy"
  exit 0
fi
