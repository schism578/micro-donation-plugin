const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../services/db');
const shopify = require('../services/shopify');

const STATE_COOKIE = 'shopify_oauth_state';

// Step 1: merchant hits /auth?shop=xxx.myshopify.com to begin install
router.get('/', (req, res) => {
  const { shop } = req.query;

  if (!shopify.isValidShopDomain(shop)) {
    return res.status(400).send('Missing or invalid "shop" parameter');
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 5 * 60 * 1000
  });

  res.redirect(shopify.buildInstallUrl(shop, state));
});

// Step 2: Shopify redirects back here after the merchant approves the install
router.get('/callback', async (req, res) => {
  const { shop, hmac, code, state } = req.query;

  if (!shopify.isValidShopDomain(shop) || !hmac || !code) {
    return res.status(400).send('Required parameters missing or invalid');
  }

  if (!state || state !== req.cookies[STATE_COOKIE]) {
    return res.status(403).send('Request origin could not be verified');
  }
  res.clearCookie(STATE_COOKIE);

  if (!shopify.verifyOAuthHmac(req.query)) {
    return res.status(403).send('HMAC validation failed');
  }

  try {
    const accessToken = await shopify.exchangeCodeForToken(shop, code);

    await db.query(
      `INSERT INTO merchants (shop_domain, access_token) VALUES ($1, $2)
       ON CONFLICT (shop_domain) DO UPDATE SET access_token = EXCLUDED.access_token`,
      [shop, accessToken]
    );

    await shopify.registerWebhooks(shop, accessToken);

    res.send('Micro-donation app installed successfully. You can close this window.');
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
    res.status(500).send('Failed to complete installation');
  }
});

module.exports = router;
