const express = require('express');
const router = express.Router();
const db = require('../services/db');
const stripeService = require('../services/stripe');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// POST /api/donations
router.post('/', async (req, res) => {
  let { merchant_id, charity_id, shop_domain, order_id, amount_cents } = req.body;

  if ((!merchant_id && !shop_domain) || !order_id || !amount_cents) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Guard for Stripe minimum amount ($0.50 = 50 cents)
  if (amount_cents < 50) {
    return res.status(400).json({ error: "Donation amount must be at least $0.50" });
  }

  try {
    // The storefront widget identifies itself by shop domain (it has no way
    // to know its own numeric merchant id), so resolve both the merchant
    // and their configured default charity from that.
    if (!merchant_id && shop_domain) {
      const merchant = await db.getMerchantByShopDomain(shop_domain);
      if (!merchant) {
        return res.status(400).json({ error: "Unknown shop_domain" });
      }
      merchant_id = merchant.id;
      if (!charity_id) {
        if (!merchant.default_charity_id) {
          return res.status(400).json({ error: "Merchant has not configured a default charity" });
        }
        charity_id = merchant.default_charity_id;
      }
    }

    if (!charity_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Charity must have finished Stripe Connect onboarding before we can
    // route a destination charge to it.
    const charityResult = await db.query(
      "SELECT stripe_account_id, payouts_enabled FROM charities WHERE id=$1",
      [charity_id]
    );
    if (charityResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid charity_id" });
    }
    const charity = charityResult.rows[0];
    if (!charity.payouts_enabled) {
      // The account.updated webhook is the fast path for this, but its
      // delivery has proven unreliable, so fall back to asking Stripe
      // directly before rejecting a charity that may actually be ready.
      const liveStatus = await stripeService.retrieveAccountStatus(charity.stripe_account_id);
      if (liveStatus.payouts_enabled) {
        await db.query(
          "UPDATE charities SET charges_enabled=$1, payouts_enabled=$2 WHERE id=$3",
          [liveStatus.charges_enabled, liveStatus.payouts_enabled, charity_id]
        );
        charity.payouts_enabled = true;
      } else {
        return res.status(400).json({ error: "Charity is not yet able to receive donations" });
      }
    }

    // Check if donation already exists
    const existing = await db.query(
      "SELECT * FROM donations WHERE merchant_id=$1 AND order_id=$2",
      [merchant_id, order_id]
    );

    if (existing.rows.length > 0) {
      return res.status(200).json({
        donation: existing.rows[0],
        message: "Donation already exists for this order"
      });
    }

    // Insert donation with status 'pending'
    const result = await db.query(
      `INSERT INTO donations (merchant_id, charity_id, order_id, amount_cents, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [merchant_id, charity_id, order_id, amount_cents]
    );
    const donation = result.rows[0];

    // Create Stripe PaymentIntent - transfer_data.destination routes the
    // funds to the charity's connected account automatically as part of
    // the charge itself, no separate transfer call needed.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: "usd",
      // allow_redirects: 'never' keeps this to payment methods (card, Link)
      // that can confirm without navigating away, since the widget confirms
      // in place on the merchant's storefront page.
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      transfer_data: {
        destination: charity.stripe_account_id
      },
      metadata: {
        donation_id: donation.id,
        merchant_id,
        charity_id,
        order_id
      }
    });

    // Update donation row with Stripe PaymentIntent ID
    await db.query(
      `UPDATE donations SET stripe_payment_intent_id=$1 WHERE id=$2`,
      [paymentIntent.id, donation.id]
    );
    donation.stripe_payment_intent_id = paymentIntent.id;

    res.json({
      donation,
      payment_intent_client_secret: paymentIntent.client_secret
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create donation" });
  }
});

// POST /api/donations/:id/confirm
// Called by the storefront widget right after stripe.confirmPayment()
// succeeds client-side. The account.updated/payment_intent.succeeded
// webhook is a nice-to-have fast path, but its delivery has proven
// unreliable, so this is the primary way donations actually get marked
// completed - idempotent, safe even if the webhook also fires.
router.post('/:id/confirm', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM donations WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Donation not found" });
    }
    const donation = result.rows[0];

    if (donation.status !== 'completed') {
      const paymentIntent = await stripe.paymentIntents.retrieve(donation.stripe_payment_intent_id);
      if (paymentIntent.status === 'succeeded') {
        await db.completeDonation(donation.id);
        donation.status = 'completed';
      }
    }

    res.json({ donation });
  } catch (err) {
    console.error('Failed to confirm donation:', err);
    res.status(500).json({ error: "Failed to confirm donation" });
  }
});

// GET /api/donations/aggregate?period=daily|weekly|monthly&from=&to=
router.get('/aggregate', async (req, res) => {
  const { period, from, to } = req.query;

  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return res.status(400).json({ error: 'Invalid period. Use daily, weekly, or monthly.' });
  }

  try {
    let query = '';
    let params = [];

    if (period === 'daily') {
      query = `
        SELECT merchant_id, charity_id, date_trunc('day', created_at) AS period,
               SUM(amount_cents)::text AS total_cents, COUNT(*)::text AS count
        FROM donations
        GROUP BY merchant_id, charity_id, period
        ORDER BY merchant_id, period
      `;
    } else if (period === 'weekly') {
      query = `
        SELECT merchant_id, charity_id, date_trunc('week', created_at) AS period,
               SUM(amount_cents)::text AS total_cents, COUNT(*)::text AS count
        FROM donations
        ${from ? `WHERE created_at >= $1` : ''}
        GROUP BY merchant_id, charity_id, period
        ORDER BY merchant_id, period
      `;
      if (from) params.push(from);
    } else if (period === 'monthly') {
      query = `
        SELECT merchant_id, charity_id, date_trunc('month', created_at) AS period,
               SUM(amount_cents)::text AS total_cents, COUNT(*)::text AS count
        FROM donations
        ${from && to ? `WHERE created_at BETWEEN $1 AND $2` : ''}
        GROUP BY merchant_id, charity_id, period
        ORDER BY merchant_id, period
      `;
      if (from && to) params.push(from, to);
    }

    const result = await db.query(query, params);
    res.json({ aggregated: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to aggregate donations' });
  }
});

module.exports = router;
