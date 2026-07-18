INSERT INTO merchants (shop_domain)
VALUES ('test-shop.myshopify.com');

INSERT INTO charities (name, stripe_account_id)
VALUES ('Global Food Relief', 'acct_test_123');

INSERT INTO donations (merchant_id, charity_id, order_id, amount_cents, status)
VALUES (1, 1, 'ORDER123', 42, 'pending');
