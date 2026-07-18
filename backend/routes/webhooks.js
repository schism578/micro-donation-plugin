const express = require("express");
const router = express.Router();
const webhookVerify = require("../middleware/webhookVerify");
const db = require("../services/db");

router.post("/app/uninstalled", webhookVerify, async (req, res) => {
  const shopDomain = req.body.myshopify_domain || req.headers["x-shopify-shop-domain"];
  await db.deleteMerchant(shopDomain);
  res.status(200).send("Merchant removed");
});

// -------------------- Mandatory GDPR compliance webhooks --------------------
// Shopify requires every app to expose these, regardless of distribution.

// A customer (via the merchant) requested a copy of the data we hold on them.
// We don't store any customer-identifying data (no name/email) - only
// merchant/charity/order/amount records - so there's nothing to compile here.
router.post("/customers/data_request", webhookVerify, async (req, res) => {
  console.log("GDPR customers/data_request received for shop:", req.headers["x-shopify-shop-domain"]);
  res.status(200).send("Acknowledged");
});

// A customer asked to have their data erased. Same reasoning as above - we
// hold nothing keyed to a customer identity to redact.
router.post("/customers/redact", webhookVerify, async (req, res) => {
  console.log("GDPR customers/redact received for shop:", req.headers["x-shopify-shop-domain"]);
  res.status(200).send("Acknowledged");
});

// Sent ~48h after uninstall as the final mandate to erase shop data.
// app/uninstalled above already deletes the merchant immediately, so this
// is usually a no-op by the time it arrives - deleteMerchant is idempotent.
router.post("/shop/redact", webhookVerify, async (req, res) => {
  const shopDomain = req.body.shop_domain || req.headers["x-shopify-shop-domain"];
  await db.deleteMerchant(shopDomain);
  res.status(200).send("Shop data erased");
});

module.exports = router;
