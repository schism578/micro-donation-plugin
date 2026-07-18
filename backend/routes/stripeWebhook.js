const db = require('../services/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const donationId = paymentIntent.metadata.donation_id;

    try {
      const result = await db.query(
        `UPDATE donations SET status='completed' WHERE id=$1
         RETURNING merchant_id, charity_id, amount_cents, created_at`,
        [donationId]
      );

      if (result.rows.length > 0) {
        const { merchant_id, charity_id, amount_cents, created_at } = result.rows[0];
        await db.recordCompletedDonationAggregate(merchant_id, charity_id, amount_cents, created_at);
      }

      console.log(`✅ Donation ${donationId} marked as completed`);
    } catch (err) {
      console.error("Error updating donation status:", err);
    }
  }

  if (event.type === 'account.updated') {
    const account = event.data.object;

    try {
      await db.query(
        `UPDATE charities SET charges_enabled=$1, payouts_enabled=$2 WHERE stripe_account_id=$3`,
        [account.charges_enabled, account.payouts_enabled, account.id]
      );
      console.log(
        `Charity account ${account.id} updated: charges_enabled=${account.charges_enabled}, payouts_enabled=${account.payouts_enabled}`
      );
    } catch (err) {
      console.error("Error updating charity Connect status:", err);
    }
  }

  res.json({ received: true });
};
