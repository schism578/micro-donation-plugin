const db = require('./db');
const stripeService = require('./stripe');

// Safety net for donations that never got marked completed. The primary
// path is the storefront widget calling POST /api/donations/:id/confirm
// right after a successful client-side payment; Stripe's own webhook is a
// secondary path. Both can fail to reach us (closed tab, dropped network,
// unreliable webhook delivery), which would otherwise leave a donation
// stuck "pending" forever even though Stripe actually charged the card and
// transferred the money to the charity. This sweep catches those.
async function reconcilePendingDonations() {
  const stale = await db.getStalePendingDonations();
  if (stale.length === 0) return { checked: 0, completed: 0 };

  let completed = 0;
  for (const donation of stale) {
    try {
      const status = await stripeService.retrievePaymentIntentStatus(donation.stripe_payment_intent_id);
      if (status === 'succeeded') {
        const result = await db.completeDonation(donation.id);
        if (result) {
          completed++;
          console.log(`Reconciliation: donation ${donation.id} was stuck pending but Stripe shows it succeeded - marked completed`);
        }
      }
    } catch (err) {
      console.error(`Reconciliation: failed to check donation ${donation.id}:`, err.message);
    }
  }

  return { checked: stale.length, completed };
}

module.exports = { reconcilePendingDonations };
