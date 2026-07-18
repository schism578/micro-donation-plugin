const express = require('express');
const router = express.Router();
const db = require('../services/db');
const stripeService = require('../services/stripe');

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, payouts_enabled FROM charities ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch charities:', err);
    res.status(500).json({ error: 'Failed to fetch charities' });
  }
});

// Creates a charity record plus its Stripe Express connected account, and
// returns a hosted onboarding link the charity needs to complete before it
// can receive donations.
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing required field: name' });
  }

  try {
    const stripeAccountId = await stripeService.createExpressAccount();

    const result = await db.query(
      'INSERT INTO charities (name, stripe_account_id) VALUES ($1, $2) RETURNING *',
      [name, stripeAccountId]
    );
    const charity = result.rows[0];

    const onboardingUrl = await stripeService.createOnboardingLink(
      stripeAccountId,
      `${process.env.HOST}/api/charities/${charity.id}/onboard/refresh`,
      `${process.env.HOST}/api/charities/${charity.id}/onboard/complete`
    );

    res.json({ charity, onboarding_url: onboardingUrl });
  } catch (err) {
    console.error('Failed to create charity:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create charity' });
  }
});

// Mints a fresh onboarding link and redirects - useful to resume/restart
// onboarding since Account Links expire quickly and are single-use.
router.get('/:id/onboard', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM charities WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Charity not found');
    }

    const charity = result.rows[0];
    const onboardingUrl = await stripeService.createOnboardingLink(
      charity.stripe_account_id,
      `${process.env.HOST}/api/charities/${charity.id}/onboard/refresh`,
      `${process.env.HOST}/api/charities/${charity.id}/onboard/complete`
    );

    res.redirect(onboardingUrl);
  } catch (err) {
    console.error('Failed to create onboarding link:', err.response?.data || err.message);
    res.status(500).send('Failed to start onboarding');
  }
});

// Account Link's refresh_url target: the link expired before they finished,
// so just mint a new one.
router.get('/:id/onboard/refresh', (req, res) => {
  res.redirect(`/api/charities/${req.params.id}/onboard`);
});

// Account Link's return_url target after the rep finishes the form. This
// only means they went through the flow, not that Stripe has approved the
// account - real confirmation comes via the account.updated webhook.
router.get('/:id/onboard/complete', (req, res) => {
  res.send('Onboarding submitted. Stripe will confirm activation shortly.');
});

module.exports = router;
