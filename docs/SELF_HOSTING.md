# Self-Hosting Guide

Breeze runs entirely on Cloudflare's free tier. This guide covers every deployment option.

## Minimum Deployment ($0/month, 5 minutes)

```bash
# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Deploy
wrangler pages deploy . --project-name=breeze

# 4. Create KV namespace and bind it
wrangler kv:namespace create KV
# Copy the ID, then go to:
# Dashboard > Pages > breeze > Settings > Functions > KV namespace bindings
# Variable name: KV → Select the namespace you created

# 5. Visit https://breeze.pages.dev
```

**That's it.** All features work except billing, AI, and push notifications.

## What Works at $0

| Feature | Status | Notes |
|---------|--------|-------|
| E2E encrypted chat | ✓ | Full Double Ratchet |
| P2P messaging | ✓ | WebRTC DataChannel |
| Voice/video calls | ✓ | WebRTC + free STUN |
| TURN relay | ✓ | Open Relay (20GB/month free) |
| Groups (100 members) | ✓ | Sender Key O(1) |
| File transfer | ✓ | Up to 50MB via P2P |
| 924 languages | ✓ | Auto-detected |
| Offline/PWA | ✓ | Service Worker |
| Translation | ✓ | MyMemory (5K chars/day free) |
| Billing/subscriptions | ✗ | Needs Stripe keys |
| AI assistant | ✗ | Needs API key (Groq is free) |
| Push notifications | ✗ | Needs VAPID keys |

## Free Tier Limits

| Resource | Free Tier | Usage per Active User |
|----------|-----------|----------------------|
| Worker requests | 100,000/day | ~500/day (polling + signaling) |
| KV reads | 100,000/day | ~200/day |
| KV writes | 1,000/day | ~350/day (optimized) |
| KV storage | 1 GB | ~10 KB/user |
| Static assets | Unlimited | ~400 KB (single HTML) |

**Supports ~3 concurrent active users on free tier.**

## Adding Optional Features

### Push Notifications (free)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

### AI Assistant (free with Groq)

```bash
# Sign up: https://console.groq.com
wrangler pages secret put GROQ_API_KEY
```

### Billing (Stripe — $0 until first sale)

```bash
# Sign up: https://dashboard.stripe.com
# Create 3 products with monthly prices

wrangler pages secret put STRIPE_SECRET_KEY
wrangler pages secret put STRIPE_WEBHOOK_SECRET
wrangler pages secret put STRIPE_PRICE_LITE    # $0.99/mo
wrangler pages secret put STRIPE_PRICE_PLUS    # $5.99/mo
wrangler pages secret put STRIPE_PRICE_PRO     # $19.99/mo
```

### TURN Server (for restrictive networks)

```bash
# Option A: Cloudflare Calls ($0.05/GB)
wrangler pages secret put TURN_KEY_ID
wrangler pages secret put TURN_KEY_API_TOKEN

# Option B: No config → free Open Relay (20GB/month)
# (This is the default — no action needed)
```

### Custom Domain

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

## Scaling Beyond Free Tier

When you outgrow the free tier ($5/month Workers Paid plan):

| Resource | Paid Plan |
|----------|-----------|
| Worker requests | 10 million/month |
| KV reads | 10 million/month |
| KV writes | 1 million/month |
| KV storage | 1 GB included |
| CPU time | 30 seconds/request |

This supports **thousands of concurrent users**.

## Docker (alternative)

Breeze is a static site + Cloudflare Worker. There's no Docker container needed.
If you want to run locally for development:

```bash
wrangler pages dev .
# Opens http://localhost:8788
```

## Updating

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

No build step. No dependencies to install. Just deploy.
