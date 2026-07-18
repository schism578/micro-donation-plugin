const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

// Test connection
pool.query('SELECT 1')
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('PostgreSQL connection error:', err));

// Generic query function
function query(text, params) {
  return pool.query(text, params);
}

// -------------------- Donations --------------------

async function getDonations() {
  const res = await pool.query('SELECT * FROM donations ORDER BY id ASC');
  return res.rows;
}

// -------------------- Merchants --------------------

async function getMerchantByShopDomain(shopDomain) {
  const res = await pool.query('SELECT * FROM merchants WHERE shop_domain = $1', [shopDomain]);
  return res.rows[0] || null;
}

async function getMerchantSettings(merchantId = 1) {
  const res = await pool.query(
    'SELECT default_charity_id AS "defaultCharityId" FROM merchants WHERE id = $1',
    [merchantId]
  );
  if (res.rows.length === 0) return { defaultCharityId: null };
  return res.rows[0];
}

async function updateMerchantSettings(defaultCharityId, merchantId = 1) {
  await pool.query(
    'UPDATE merchants SET default_charity_id = $1 WHERE id = $2',
    [defaultCharityId, merchantId]
  );
  return getMerchantSettings(merchantId);
}

// -------------------- Aggregates --------------------

// Upserts a daily bucket in donation_aggregates for a single completed donation.
async function recordCompletedDonationAggregate(merchantId, charityId, amountCents, occurredAt) {
  await pool.query(
    `INSERT INTO donation_aggregates
       (merchant_id, charity_id, total_amount_cents, donation_count, period_start, period_end, last_aggregate_at)
     VALUES
       ($1, $2, $3, 1, date_trunc('day', $4::timestamp), date_trunc('day', $4::timestamp) + interval '1 day', NOW())
     ON CONFLICT (merchant_id, charity_id, period_start, period_end)
     DO UPDATE SET
       total_amount_cents = donation_aggregates.total_amount_cents + EXCLUDED.total_amount_cents,
       donation_count = donation_aggregates.donation_count + 1,
       last_aggregate_at = NOW()`,
    [merchantId, charityId, amountCents, occurredAt]
  );
}

async function deleteMerchant(shopDomain) {
  const merchant = await getMerchantByShopDomain(shopDomain);
  if (!merchant) return;

  await pool.query('DELETE FROM donation_aggregates WHERE merchant_id = $1', [merchant.id]);
  await pool.query('DELETE FROM donations WHERE merchant_id = $1', [merchant.id]);
  await pool.query('DELETE FROM merchants WHERE id = $1', [merchant.id]);
}

module.exports = {
  query,
  getDonations,
  getMerchantByShopDomain,
  getMerchantSettings,
  updateMerchantSettings,
  recordCompletedDonationAggregate,
  deleteMerchant,
  pool
};
