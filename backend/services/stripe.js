const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

async function createPaymentIntent(amount_cents) {
  return stripe.paymentIntents.create({
    amount: amount_cents,
    currency: 'usd',
    payment_method_types: ['card']
  });
}

// Creates a Stripe Express connected account for a charity. No business
// details are collected here - the charity fills those in themselves via
// the hosted onboarding link (see createOnboardingLink).
async function createExpressAccount() {
  const account = await stripe.accounts.create({
    type: 'express',
    capabilities: {
      transfers: { requested: true }
    }
  });
  return account.id;
}

// Generates a fresh, single-use hosted onboarding link for a charity's
// connected account. Links expire quickly, so callers should mint a new
// one each time rather than reusing one across requests.
async function createOnboardingLink(stripeAccountId, refreshUrl, returnUrl) {
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding'
  });
  return accountLink.url;
}

// Fetches live Connect status directly from Stripe. The account.updated
// webhook is the fast path for keeping this in sync, but its delivery has
// proven unreliable across environments, so callers use this as a
// fallback check rather than trusting the cached DB flag alone.
async function retrieveAccountStatus(stripeAccountId) {
  const account = await stripe.accounts.retrieve(stripeAccountId);
  return {
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled
  };
}

async function retrievePaymentIntentStatus(paymentIntentId) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return paymentIntent.status;
}

module.exports = {
  createPaymentIntent,
  createExpressAccount,
  createOnboardingLink,
  retrieveAccountStatus,
  retrievePaymentIntentStatus
};
