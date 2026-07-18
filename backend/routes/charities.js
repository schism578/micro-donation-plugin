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

// Account Link's return_url target after the rep finishes the form.
// account.updated webhook delivery has proven unreliable, so actively sync
// status here too rather than waiting on it.
router.get('/:id/onboard/complete', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM charities WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Charity not found');
    }

    const charity = result.rows[0];
    const status = await stripeService.retrieveAccountStatus(charity.stripe_account_id);
    await db.query(
      'UPDATE charities SET charges_enabled=$1, payouts_enabled=$2 WHERE id=$3',
      [status.charges_enabled, status.payouts_enabled, charity.id]
    );

    res.send(
      status.payouts_enabled
        ? 'Onboarding complete - this charity can now receive donations.'
        : 'Onboarding submitted, but Stripe has not yet marked this account as ready. Try again shortly.'
    );
  } catch (err) {
    console.error('Failed to sync charity status:', err.response?.data || err.message);
    res.status(500).send('Onboarding submitted, but we could not confirm activation status.');
  }
});

module.exports = router;
