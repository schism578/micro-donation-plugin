const { verifyWebhookHmac } = require('../services/shopify');

// Expects req.body to still be the raw Buffer (mounted before express.json())
// so the HMAC can be verified over the exact bytes Shopify signed.
module.exports = (req, res, next) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];

  if (!verifyWebhookHmac(req.body, hmacHeader)) {
    return res.status(401).send('Webhook HMAC verification failed');
  }

  req.body = JSON.parse(req.body.toString('utf8'));
  next();
};
