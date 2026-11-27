import { describe, it, expect } from 'vitest';
import worker from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';

// Operator billing, phase 1 (2026-11-27): the operator's payment
// gateway notifies the relay (signed webhook), the relay issues a
// time-boxed pass, the buyer claims it with their payment reference,
// and cost-creating operations require a valid pass. These tests pin
// the signature checks (fail closed), event dedupe, one-time claim,
// pass binding, expiry, refund/revoke, and that a billing-off relay
// behaves exactly as before.

const SECRET = 'whsec_test_secret';
const billingEnv = (extra = {}) => makeEnv({
  BILLING_ENABLED: 'true',
  BILLING_WEBHOOK_SECRET: SECRET,
  BILLING_CHECKOUT_URL: 'https://pay.example/checkout',
  BILLING_OPERATOR_TOKEN: 'op-token-123',
  ...extra,
});

async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const rawPost = (path, rawBody, headers = {}) => new Request('https://breeze.test' + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', ...headers },
  body: rawBody,
});
async function genericWebhook(env, event) {
  const raw = JSON.stringify(event);
  return worker.fetch(rawPost('/api/billing/webhook', raw, { 'x-breeze-signature': await hmacHex(SECRET, raw) }), env);
}
async function issuePass(env, ref = 'pay_1', eventId = 'evt_1') {
  const res = await genericWebhook(env, { id: eventId, type: 'payment.succeeded', paymentRef: ref, days: 30 });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.issued).toBe(true);
  expect(body.pass).toMatch(/^bzpass_[0-9a-f]{64}$/);
  return body.pass;
}

describe('billing: health advertisement', () => {
  it('advertises required + checkoutUrl + capability only when enabled', async () => {
    const on = await (await worker.fetch(new Request('https://breeze.test/api/health'), billingEnv())).json();
    expect(on.billing).toEqual({ required: true, checkoutUrl: 'https://pay.example/checkout' });
    expect(on.capabilities).toContain('billing-pass');
    const off = await (await worker.fetch(new Request('https://breeze.test/api/health'), makeEnv())).json();
    expect(off.billing.required).toBe(false);
    expect(off.capabilities).not.toContain('billing-pass');
  });
});

describe('billing: webhook', () => {
  it('rejects a bad signature and fails closed without a secret', async () => {
    const env = billingEnv();
    const raw = JSON.stringify({ id: 'evt_x', type: 'payment.succeeded', paymentRef: 'pay_x' });
    const bad = await worker.fetch(rawPost('/api/billing/webhook', raw, { 'x-breeze-signature': 'deadbeef' }), env);
    expect(bad.status).toBe(401);
    expect((await bad.json()).code).toBe('BILLING_BAD_SIGNATURE');
    const noSecret = billingEnv({ BILLING_WEBHOOK_SECRET: undefined });
    const res2 = await genericWebhook(noSecret, { id: 'evt_y', type: 'payment.succeeded', paymentRef: 'pay_y' });
    expect(res2.status).toBe(401);
  });

  it('is 404 when billing is disabled', async () => {
    const res = await genericWebhook(makeEnv(), { id: 'evt_z', type: 'payment.succeeded', paymentRef: 'pay_z' });
    expect(res.status).toBe(404);
  });

  it('accepts a Stripe-style signature and rejects a stale timestamp', async () => {
    const env = billingEnv();
    const event = { id: 'evt_stripe_1', type: 'checkout.session.completed', data: { object: { id: 'cs_123' } } };
    const raw = JSON.stringify(event);
    const t = Math.floor(Date.now() / 1000);
    const sig = await hmacHex(SECRET, `${t}.${raw}`);
    const ok = await worker.fetch(rawPost('/api/billing/webhook', raw, { 'stripe-signature': `t=${t},v1=${sig}` }), env);
    expect(ok.status).toBe(200);
    expect((await ok.json()).issued).toBe(true);
    const staleT = t - 3600;
    const staleSig = await hmacHex(SECRET, `${staleT}.${raw}`);
    const stale = await worker.fetch(rawPost('/api/billing/webhook', JSON.stringify({ ...event, id: 'evt_stripe_2' }), { 'stripe-signature': `t=${staleT},v1=${staleSig}` }), env);
    expect(stale.status).toBe(401);
  });

  it('dedupes a repeated event id (no second pass)', async () => {
    const env = billingEnv();
    const pass = await issuePass(env, 'pay_dup', 'evt_dup');
    const again = await genericWebhook(env, { id: 'evt_dup', type: 'payment.succeeded', paymentRef: 'pay_dup', days: 30 });
    expect((await again.json()).deduped).toBe(true);
    const claim = await worker.fetch(apiRequest('/api/billing/claim', { paymentRef: 'pay_dup' }), env);
    expect((await claim.json()).pass).toBe(pass);
  });
});

describe('billing: claim', () => {
  it('claims once with the payment reference; the second claim is 410', async () => {
    const env = billingEnv();
    const pass = await issuePass(env, 'pay_claim');
    const missing = await worker.fetch(apiRequest('/api/billing/claim', { paymentRef: 'nope' }), env);
    expect(missing.status).toBe(404);
    const first = await worker.fetch(apiRequest('/api/billing/claim', { paymentRef: 'pay_claim' }), env);
    expect(first.status).toBe(200);
    expect((await first.json()).pass).toBe(pass);
    const second = await worker.fetch(apiRequest('/api/billing/claim', { paymentRef: 'pay_claim' }), env);
    expect(second.status).toBe(410);
    expect((await second.json()).code).toBe('PASS_ALREADY_CLAIMED');
  });
});

describe('billing: the gate', () => {
  it('blocks gated operations without a pass (402) and admits a valid one', async () => {
    const env = billingEnv();
    const noPass = await worker.fetch(apiRequest('/api/alias/set', { userId: 'user0001' }), env);
    expect(noPass.status).toBe(402);
    const noPassBody = await noPass.json();
    expect(noPassBody.code).toBe('BILLING_PASS_REQUIRED');
    expect(noPassBody.checkoutUrl).toBe('https://pay.example/checkout');
    const wrong = await worker.fetch(apiRequest('/api/alias/set', { userId: 'user0001', pass: 'bzpass_' + '0'.repeat(64) }), env);
    expect(wrong.status).toBe(402);
    expect((await wrong.json()).code).toBe('BILLING_PASS_INVALID');
    const pass = await issuePass(env);
    const okRes = await worker.fetch(apiRequest('/api/alias/set', { userId: 'user0001', pass }), env);
    expect(okRes.status).not.toBe(402);
    expect((await okRes.clone().json()).code ?? '').not.toMatch(/^BILLING_/);
  });

  it('binds the pass to the first userId and refuses another account', async () => {
    const env = billingEnv();
    const pass = await issuePass(env);
    await worker.fetch(apiRequest('/api/alias/set', { userId: 'owner001', pass }), env);
    const other = await worker.fetch(apiRequest('/api/alias/set', { userId: 'someoneelse', pass }), env);
    expect(other.status).toBe(403);
    expect((await other.json()).code).toBe('BILLING_PASS_BOUND');
    const check = await worker.fetch(apiRequest('/api/billing/check', { pass }), env);
    expect((await check.json()).bound).toBe(true);
  });

  it('rejects an expired pass', async () => {
    const env = billingEnv();
    const token = 'bzpass_' + 'a'.repeat(64);
    const hash = await sha256Hex(token);
    await env.KV.put(`billing:pass:${hash}`, JSON.stringify({ expiresAt: Date.now() - 1000, boundTo: null, paymentRef: 'old', createdAt: 0 }));
    const res = await worker.fetch(apiRequest('/api/alias/set', { userId: 'user0001', pass: token }), env);
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe('BILLING_PASS_INVALID');
  });

  it('does not gate anything when billing is disabled', async () => {
    const res = await worker.fetch(apiRequest('/api/alias/set', { userId: 'user0001' }), makeEnv());
    expect((await res.json()).code ?? '').not.toMatch(/^BILLING_/);
  });
});

describe('billing: refund and operator revoke', () => {
  it('a refund webhook revokes the pass and its claim', async () => {
    const env = billingEnv();
    const pass = await issuePass(env, 'pay_refund', 'evt_refund_issue');
    const refund = await genericWebhook(env, { id: 'evt_refund', type: 'payment.refunded', paymentRef: 'pay_refund' });
    expect((await refund.json()).revoked).toBe(true);
    const check = await worker.fetch(apiRequest('/api/billing/check', { pass }), env);
    expect((await check.json()).ok).toBe(false);
    const claim = await worker.fetch(apiRequest('/api/billing/claim', { paymentRef: 'pay_refund' }), env);
    expect(claim.status).toBe(404);
  });

  it('operator revoke requires the operator token', async () => {
    const env = billingEnv();
    const pass = await issuePass(env, 'pay_op', 'evt_op_issue');
    const noTok = await worker.fetch(apiRequest('/api/billing/revoke', { pass }), env);
    expect(noTok.status).toBe(401);
    const ok = await worker.fetch(apiRequest('/api/billing/revoke', { pass }, { 'x-breeze-operator': 'op-token-123' }), env);
    expect((await ok.json()).revoked).toBe(true);
    const check = await worker.fetch(apiRequest('/api/billing/check', { pass }), env);
    expect((await check.json()).ok).toBe(false);
  });
});
