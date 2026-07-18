ALTER TABLE donation_aggregates
  ADD CONSTRAINT donation_aggregates_unique_bucket
  UNIQUE (merchant_id, charity_id, period_start, period_end);
