const { Pool } = require('pg');

// Railway (and most hosts) provide a single DATABASE_URL; local dev uses
// the separate DB_* vars instead.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : new Pool({
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

// Donations that have a PaymentIntent but never got marked completed - the
// client-triggered confirm call is the primary path for that, but it can
// fail to reach us (tab closed, network drop), so these need to be
// reconciled directly against Stripe rather than trusted as still in-flight.
async function getStalePendingDonations(minutesOld = 5) {
  const res = await pool.query(
    `SELECT id, stripe_payment_intent_id FROM donations
     WHERE status = 'pending'
       AND stripe_payment_intent_id IS NOT NULL
       AND created_at < NOW() - ($1 || ' minutes')::interval`,
    [minutesOld]
  );
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

// Idempotently marks a donation completed and records its aggregate bucket.
// Returns the donation row if this call is what completed it, or null if
// it was already completed (safe to call from both the webhook and the
// client-triggered confirm endpoint without double-counting).
async function completeDonation(donationId) {
  const result = await pool.query(
    `UPDATE donations SET status='completed' WHERE id=$1 AND status != 'completed'
     RETURNING merchant_id, charity_id, amount_cents, created_at`,
    [donationId]
  );

  if (result.rows.length === 0) return null;

  const { merchant_id, charity_id, amount_cents, created_at } = result.rows[0];
  await recordCompletedDonationAggregate(merchant_id, charity_id, amount_cents, created_at);
  return result.rows[0];
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
  getStalePendingDonations,
  getMerchantByShopDomain,
  getMerchantSettings,
  updateMerchantSettings,
  recordCompletedDonationAggregate,
  completeDonation,
  deleteMerchant,
  pool
};
