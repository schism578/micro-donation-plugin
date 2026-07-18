const express = require("express");
const router = express.Router();
const db = require("../services/db");
const requireSessionToken = require("../middleware/requireSessionToken");

router.get("/settings", requireSessionToken, async (req, res) => {
  const settings = await db.getMerchantSettings(req.merchant.id);
  res.json(settings);
});

router.post("/settings", requireSessionToken, async (req, res) => {
  const { defaultCharityId } = req.body;
  const updated = await db.updateMerchantSettings(defaultCharityId, req.merchant.id);
  res.json(updated);
});

module.exports = router;
