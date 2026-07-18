CREATE TABLE charities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  stripe_account_id TEXT NOT NULL,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE merchants (
  id SERIAL PRIMARY KEY,
  shop_domain TEXT UNIQUE NOT NULL,
  access_token TEXT,
  default_charity_id INTEGER REFERENCES charities(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE donations (
  id SERIAL PRIMARY KEY,
  merchant_id INTEGER REFERENCES merchants(id),
  charity_id INTEGER REFERENCES charities(id),
  order_id TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE donation_aggregates (
  id SERIAL PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  charity_id INTEGER NOT NULL REFERENCES charities(id),
  total_amount_cents INTEGER NOT NULL,
  donation_count INTEGER NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  last_aggregate_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (merchant_id, charity_id, period_start, period_end)
);
