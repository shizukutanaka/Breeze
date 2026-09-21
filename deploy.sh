#!/bin/bash
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
NC='\033[0m'; BOLD='\033[1m'
ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
err() { echo -e "${RED}✗${NC} $1"; }
h1() { echo ""; echo -e "${BOLD}=== $1 ===${NC}"; echo ""; }
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"; cd "$SCRIPT_DIR"

echo -e "\n${BOLD}🌊 Breeze Deploy${NC}\n"

# ── 1. Prerequisites ──
h1 "1. Prerequisites"
M=0
for cmd in git node npm; do command -v $cmd &>/dev/null && ok "$cmd" || { err "$cmd missing"; M=1; }; done
command -v wrangler &>/dev/null || { npm install -g wrangler; }; ok "wrangler"
[ $M -eq 1 ] && exit 1
[ -f validate.sh ] && bash validate.sh 2>&1 | tail -3

# ── 2. Git ──
h1 "2. Git"
[ ! -d .git ] && git init && git add . && git commit -m "deploy"
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

# ── 5. Push (optional) ──
h1 "5. Web Push (optional)"
read -p "  VAPID Public (blank=skip): " V
s() { [ -n "$2" ] && echo "$2" | wrangler pages secret put "$1" --project-name="$P" 2>/dev/null && ok "$1"; }
s VAPID_PUBLIC_KEY "$V"
read -p "  VAPID Private: " V; s VAPID_PRIVATE_KEY "$V"

# ── 6. TURN (optional) ──
h1 "6. TURN Relay (optional)"
read -p "  TURN URL (blank=skip): " V
if [ -n "$V" ]; then s TURN_URL "$V"; read -p "  TURN Secret: " V; s TURN_SECRET "$V"; fi

# Redeploy
wrangler pages deploy . --project-name="$P" 2>&1 | tail -3

h1 "Done"
echo -e "  ${GREEN}${BOLD}https://${P}.pages.dev${NC}"
echo "  Health: /api/health"
