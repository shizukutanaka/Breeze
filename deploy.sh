#!/bin/bash
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
NC='\033[0m'; BOLD='\033[1m'
ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
err() { echo -e "${RED}✗${NC} $1"; }
h1() { echo ""; echo -e "${BOLD}=== $1 ===${NC}"; echo ""; }
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"; cd "$SCRIPT_DIR"

echo -e "\n${BOLD}🌊 Breeze Deploy v3.5${NC}\n"

# ── 1. Prerequisites ──
h1 "1. Prerequisites"
M=0
for cmd in git node npm; do command -v $cmd &>/dev/null && ok "$cmd" || { err "$cmd missing"; M=1; }; done
command -v wrangler &>/dev/null || { npm install -g wrangler; }; ok "wrangler"
[ $M -eq 1 ] && exit 1
[ -f validate.sh ] && bash validate.sh 2>&1 | tail -3

# ── 2. Legal (特定商取引法) ──
h1 "2. Legal Info"
if grep -q '\[Your Name / Company\]' index.html 2>/dev/null; then
  read -p "  販売者名: " SN; read -p "  所在地: " SA; read -p "  メール: " SE
  if [ -n "$SN" ]; then
    sed -i.bak "s|\[Your Name / Company\]|$SN|g;s|\[Your Address\]|$SA|g;s|\[email@example.com\]|$SE|g" index.html
    rm -f index.html.bak; ok "Updated"
  else warn "Skipped"; fi
else ok "Already set"; fi

# ── 3. Git ──
h1 "3. Git"
[ ! -d .git ] && git init && git add . && git commit -m "v3.5.0"
if git remote get-url origin &>/dev/null; then ok "$(git remote get-url origin)"
else
  read -p "  GitHub URL: " RU
  [ -n "$RU" ] && git remote add origin "$RU" && git branch -M main && git push -u origin main && ok "Pushed"
fi

# ── 4. Cloudflare Pages ──
h1 "4. Deploy"
wrangler login 2>/dev/null || true
read -p "  Project name [breeze]: " P; P=${P:-breeze}
wrangler pages deploy . --project-name="$P" 2>&1 | tail -5; ok "Deployed"

# ── 5. KV ──
h1 "5. KV Storage"
echo "  Dashboard → $P → Settings → Bindings → Add KV (name: KV)"
read -p "  Done? [Enter] "

# ── 6. Stripe (Lite/Plus/Pro) ──
h1 "6. Stripe"
echo "  Create 3 products:"
echo "    Lite  \$0.99/mo → STRIPE_PRICE_LITE"
echo "    Plus  \$5.99/mo → STRIPE_PRICE_PLUS"
echo "    Pro  \$19.99/mo → STRIPE_PRICE_PRO"
echo "  Webhook: https://${P}.pages.dev/api/webhook"
echo "  Events: checkout.session.completed, customer.subscription.deleted,"
echo "          customer.subscription.updated, invoice.payment_failed"
echo ""
s() { [ -n "$2" ] && echo "$2" | wrangler pages secret put "$1" --project-name="$P" 2>/dev/null && ok "$1"; }
read -p "  Secret Key (sk_...): " V; s STRIPE_SECRET_KEY "$V"
read -p "  Webhook Secret (whsec_...): " V; s STRIPE_WEBHOOK_SECRET "$V"
read -p "  Lite Price ID: " V; s STRIPE_PRICE_LITE "$V"
read -p "  Plus Price ID: " V; s STRIPE_PRICE_PLUS "$V"
read -p "  Pro Price ID: " V; s STRIPE_PRICE_PRO "$V"

# ── 7. Push (optional) ──
h1 "7. Web Push (optional)"
read -p "  VAPID Public (blank=skip): " V; s VAPID_PUBLIC_KEY "$V"
read -p "  VAPID Private: " V; s VAPID_PRIVATE_KEY "$V"

# ── 8. TURN (optional) ──
h1 "8. TURN Relay (optional)"
read -p "  TURN URL (blank=skip): " V
if [ -n "$V" ]; then s TURN_URL "$V"; read -p "  TURN Secret: " V; s TURN_SECRET "$V"; fi

# Redeploy
wrangler pages deploy . --project-name="$P" 2>&1 | tail -3

h1 "Done"
echo -e "  ${GREEN}${BOLD}https://${P}.pages.dev${NC}"
echo "  Health: /api/health | Pricing: /?pricing"
echo "  Test card: 4242 4242 4242 4242"
