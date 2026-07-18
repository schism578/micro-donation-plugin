const { verifySessionToken } = require('../services/shopify');
const db = require('../services/db');

// Authenticates embedded admin requests via the Shopify session token
// (sent as "Authorization: Bearer <token>" by App Bridge), and attaches the
// resolved merchant row to req.merchant. This is what prevents one merchant
// from reading or changing another merchant's settings.
module.exports = async (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing session token' });
  }

  let shopDomain;
  try {
    shopDomain = verifySessionToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid session token' });
  }

  const merchant = await db.getMerchantByShopDomain(shopDomain);
  if (!merchant) {
    return res.status(401).json({ error: 'Unknown shop' });
  }

  req.merchant = merchant;
  next();
};
