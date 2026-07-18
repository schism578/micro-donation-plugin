const axios = require('axios');
const crypto = require('crypto');

// NOTE: verify this is still a supported Shopify API version before relying
// on it in production - Shopify sunsets versions roughly a year after release.
const API_VERSION = '2025-04';

// No Admin API scopes needed yet: the core round-up flow is driven by the
// storefront widget posting directly to /api/donations, not by reading
// order data. Add scopes here if/when a feature actually needs them.
const SCOPES = '';

// customers/data_request, customers/redact, and shop/redact are NOT
// registered here - Shopify rejects them via this API ("could not find the
// webhook topic"). They're mandatory compliance webhooks configured once,
// app-wide, in the Partner Dashboard (App setup -> Compliance webhooks),
// not per-shop subscriptions. orders/create is also intentionally omitted:
// it requires Shopify's protected-customer-data approval and isn't needed
// for the core donation flow.
const WEBHOOK_TOPICS = [
  { topic: 'app/uninstalled', path: '/api/webhooks/app/uninstalled' }
];

function isValidShopDomain(shop) {
  return typeof shop === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

function buildInstallUrl(shop, state) {
  const redirectUri = `${process.env.HOST}/auth/callback`;
  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_API_KEY,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

// Verifies the HMAC Shopify attaches to OAuth redirect query strings.
function verifyOAuthHmac(query) {
  const { hmac, signature, ...rest } = query;
  if (!hmac) return false;

  const message = Object.keys(rest)
    .sort()
    .map(key => `${key}=${Array.isArray(rest[key]) ? rest[key].join(',') : rest[key]}`)
    .join('&');

  const generatedHash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  const a = Buffer.from(generatedHash, 'utf8');
  const b = Buffer.from(hmac, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Verifies the HMAC Shopify attaches to webhook deliveries (X-Shopify-Hmac-Sha256),
// computed over the raw request body.
function verifyWebhookHmac(rawBody, hmacHeader) {
  if (!hmacHeader) return false;

  const generatedHash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(rawBody)
    .digest('base64');

  const a = Buffer.from(generatedHash, 'utf8');
  const b = Buffer.from(hmacHeader, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function exchangeCodeForToken(shop, code) {
  const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
    client_id: process.env.SHOPIFY_API_KEY,
    client_secret: process.env.SHOPIFY_API_SECRET,
    code
  });
  return response.data.access_token;
}

async function registerWebhooks(shop, accessToken) {
  let existingTopics = new Set();
  try {
    const res = await axios.get(
      `https://${shop}/admin/api/${API_VERSION}/webhooks.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );
    existingTopics = new Set(res.data.webhooks.map(w => w.topic));
  } catch (err) {
    console.error(`Failed to list existing webhooks for ${shop}:`, err.response?.data || err.message);
  }

  for (const { topic, path } of WEBHOOK_TOPICS) {
    if (existingTopics.has(topic)) continue;

    try {
      await axios.post(
        `https://${shop}/admin/api/${API_VERSION}/webhooks.json`,
        { webhook: { topic, address: `${process.env.HOST}${path}`, format: 'json' } },
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
    } catch (err) {
      console.error(`Failed to register webhook "${topic}" for ${shop}:`, err.response?.data || err.message);
    }
  }
}

module.exports = {
  isValidShopDomain,
  buildInstallUrl,
  verifyOAuthHmac,
  verifyWebhookHmac,
  exchangeCodeForToken,
  registerWebhooks
};
