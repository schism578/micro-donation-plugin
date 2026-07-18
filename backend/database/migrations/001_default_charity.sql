ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS default_charity_id INTEGER REFERENCES charities(id);
