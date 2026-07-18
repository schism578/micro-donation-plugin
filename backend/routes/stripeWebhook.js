const db = require('../services/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Stripe may require separate webhook endpoints (each with its own signing
// secret) for "your account" events vs "connected accounts" events - if
// STRIPE_WEBHOOK_SECRET_CONNECT is set, try both secrets before rejecting.
const WEBHOOK_SECRETS = [
  process.env.STRIPE_WEBHOOK_SECRET,
  process.env.STRIPE_WEBHOOK_SECRET_CONNECT
].filter(Boolean);

module.exports = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  let lastError;

  for (const secret of WEBHOOK_SECRETS) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!event) {
    console.error("Webhook signature verification failed:", lastError?.message);
    return res.status(400).send(`Webhook Error: ${lastError?.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const donationId = paymentIntent.metadata.donation_id;

    try {
      await db.completeDonation(donationId);
      console.log(`✅ Donation ${donationId} marked as completed (via webhook)`);
    } catch (err) {
      console.error("Error updating donation status:", err);
    }
  }

  if (event.type === 'account.updated' || event.type?.endsWith('account.updated')) {
    // Thin events only carry an id reference, not the full object, so
    // re-fetch the account from Stripe directly rather than assuming the
    // payload shape - this works for both snapshot and thin delivery.
    const accountId =
      event.data?.object?.id || event.account || event.data?.id || event.related_object?.id;

    if (!accountId) {
      console.warn("account.updated event received but no account id found:", JSON.stringify(event));
    } else {
      try {
        const account = await stripe.accounts.retrieve(accountId);
        await db.query(
          `UPDATE charities SET charges_enabled=$1, payouts_enabled=$2 WHERE stripe_account_id=$3`,
          [account.charges_enabled, account.payouts_enabled, account.id]
        );
        console.log(
          `Charity account ${account.id} synced: charges_enabled=${account.charges_enabled}, payouts_enabled=${account.payouts_enabled}`
        );
      } catch (err) {
        console.error("Error syncing charity Connect status:", err);
      }
    }
  }

  res.json({ received: true });
};
