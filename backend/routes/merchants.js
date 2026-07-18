const express = require("express");
const router = express.Router();
const db = require("../services/db");

router.get("/settings", async (req, res) => {
  const settings = await db.getMerchantSettings();
  res.json(settings);
});

router.post("/settings", async (req, res) => {
  const { defaultCharityId } = req.body;
  const updated = await db.updateMerchantSettings(defaultCharityId);
  res.json(updated);
});

module.exports = router;