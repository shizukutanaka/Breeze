Verify billing system integrity:
1. Check all 3 plans referenced: Lite ($0.99), Plus ($5.99), Pro ($19.99)
2. Verify STRIPE_PRICE_LITE/PLUS/PRO in Worker
3. Verify data-plan buttons in index.html pricing page
4. Verify slotMap: lite=2, plus=4, pro=999
5. Verify webhook: checkout.session.completed, subscription.deleted, subscription.updated
6. Check no $3, STRIPE_PRICE_ID_ACCOUNT, or license: KV references remain
