#!/bin/bash
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
NC='\033[0m'; BOLD='\033[1m'
ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
err() { echo -e "${RED}✗${NC} $1"; }
h1() { echo ""; echo -e "${BOLD}=== $1 ===${NC}"; echo ""; }
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"; cd "$SCRIPT_DIR"

echo -e "\n${BOLD}🌊 Breeze Deploy v3.6${NC}\n"

# ── 1. Prerequisites ──
h1 "1. Prerequisites"
M=0
for cmd in git node npm; do command -v $cmd &>/dev/null && ok "$cmd" || { err "$cmd missing"; M=1; }; done
command -v wrangler &>/dev/null || { npm install -g wrangler; }; ok "wrangler"
[ $M -eq 1 ] && exit 1
[ -f validate.sh ] && bash validate.sh 2>&1 | tail -3

# ── 2. Git ──
h1 "2. Git"
[ ! -d .git ] && git init && git add . && git commit -m "v3.6.1"
if git remote get-url origin &>/dev/null; then ok "$(git remote get-url origin)"
else
  read -p "  GitHub URL: " RU
  [ -n "$RU" ] && git remote add origin "$RU" && git branch -M main && git push -u origin main && ok "Pushed"
fi

# ── 3. Cloudflare Pages ──
h1 "3. Deploy"
wrangler login 2>/dev/null || true
read -p "  Project name [breeze]: " P; P=${P:-breeze}
wrangler pages deploy . --project-name="$P" 2>&1 | tail -5; ok "Deployed"

# ── 4. KV ──
h1 "4. KV Storage"
echo "  Dashboard → $P → Settings → Bindings → Add KV (name: KV)"
read -p "  Done? [Enter] "

# ── 5. Optional secrets ──
# Multi-account billing (Stripe Lite/Plus/Pro) was removed in v3.6.1 — there is
# no /api/webhook endpoint and the Worker reads no STRIPE_* variable; wiring one
# up configures a dead feature. The secrets that actually exist:
#   ABUSE_WEBHOOK_URL   — notified on verified abuse reports (metadata only)
#   MIN_POW_DIFFICULTY  — PoW acceptance floor (default 20, matches the client)
#   *_REQUIRE_AUTH      — signed-request enforcement flags (see wrangler.toml;
#                         recommended once no pre-signing clients remain)
h1 "5. Optional secrets"
s() { [ -n "$2" ] && echo "$2" | wrangler pages secret put "$1" --project-name="$P" 2>/dev/null && ok "$1"; }
read -p "  Abuse-report webhook URL (blank=skip): " V; s ABUSE_WEBHOOK_URL "$V"
read -p "  PoW difficulty floor (blank=default): " V; s MIN_POW_DIFFICULTY "$V"
echo "  Auth-hardening flags (PRESENCE/ALIAS/GROUP/PUSH/TURN/QUEUE/PREKEY/BACKUP"
echo "  _REQUIRE_AUTH) — see wrangler.toml's comments before enabling."

# ── 6. Push (optional) ──
h1 "6. Web Push (optional)"
read -p "  VAPID Public (blank=skip): " V; s VAPID_PUBLIC_KEY "$V"
read -p "  VAPID Private: " V; s VAPID_PRIVATE_KEY "$V"

# ── 7. TURN (optional) ──
h1 "7. TURN Relay (optional)"
read -p "  TURN URL (blank=skip): " V
if [ -n "$V" ]; then s TURN_URL "$V"; read -p "  TURN Secret: " V; s TURN_SECRET "$V"; fi

# Redeploy
wrangler pages deploy . --project-name="$P" 2>&1 | tail -3

h1 "Done"
echo -e "  ${GREEN}${BOLD}https://${P}.pages.dev${NC}"
echo "  Health: /api/health"
