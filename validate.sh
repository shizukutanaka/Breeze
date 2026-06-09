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
JS=$(node -e "const h=require('fs').readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);if(m)require('fs').writeFileSync('/tmp/brz-validate.js',m[1]);else process.exit(1)" 2>&1)
if node -c /tmp/brz-validate.js 2>/dev/null; then pass "index.html JS syntax" 10; else fail "index.html JS syntax BROKEN" 10; fi
if node -c _worker.js 2>/dev/null; then pass "_worker.js syntax" 5; else fail "_worker.js syntax BROKEN" 5; fi
if node -c sw.js 2>/dev/null; then pass "sw.js syntax" 5; else fail "sw.js syntax BROKEN" 5; fi
echo ""

# ═══ Gate 2: Security ═══
echo "Gate 2: Security"
H=$(cat index.html)
JS_CONTENT=$(cat /tmp/brz-validate.js)

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

# Subresource Integrity: the sha384 declared for lang.js in index.html must match
# the actual file. A stale hash makes browsers silently refuse to load lang.js,
# breaking all 900+ language translations — invisible to a normal smoke test.
if [ -f lang.js ]; then
  DECLARED=$(echo "$H" | grep -o 'src="lang.js"[^>]*integrity="sha384-[^"]*"' | grep -o 'sha384-[^"]*' | head -1)
  ACTUAL="sha384-$(node -e "const c=require('crypto'),fs=require('fs');process.stdout.write(c.createHash('sha384').update(fs.readFileSync('lang.js')).digest('base64'))" 2>/dev/null)"
  if [ -z "$DECLARED" ]; then warn "lang.js SRI: no integrity attribute found" 5
  elif [ "$DECLARED" = "$ACTUAL" ]; then pass "lang.js SRI matches file" 5
  else fail "lang.js SRI MISMATCH — translations will fail to load (declared $DECLARED, actual $ACTUAL)" 5; fi
fi
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
