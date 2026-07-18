const express = require('express');
const router = express.Router();
const { pool } = require('../services/db');

/**
 * GET /api/merchant/:merchantId/donations/summary
 */
router.get('/:merchantId/donations/summary', async (req, res) => {
  const { merchantId } = req.params;
  const {
    period = 'monthly',
    start_date,
    end_date,
    charity_id
  } = req.query;

  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return res.status(400).json({
      error: 'Invalid period. Use daily, weekly, or monthly.'
    });
  }

  try {
    /* ---------------------------------------
       Build dynamic WHERE clause
    --------------------------------------- */
    const conditions = ['merchant_id = $1'];
    const values = [merchantId];
    let idx = 2;

    if (start_date) {
      conditions.push(`period_start >= $${idx++}`);
      values.push(start_date);
    }

    if (end_date) {
      conditions.push(`period_end <= $${idx++}`);
      values.push(end_date);
    }

    if (charity_id) {
      conditions.push(`charity_id = $${idx++}`);
      values.push(charity_id);
    }

    const whereClause = conditions.join(' AND ');

    /* ---------------------------------------
       Overall totals
    --------------------------------------- */
    const totalsQuery = `
      SELECT
        COALESCE(SUM(total_amount_cents), 0) AS total_cents,
        COALESCE(SUM(donation_count), 0) AS donation_count
      FROM donation_aggregates
      WHERE ${whereClause};
    `;

    const totalsResult = await pool.query(totalsQuery, values);

    /* ---------------------------------------
       Breakdown by charity
    --------------------------------------- */
    const charityQuery = `
      SELECT
        da.charity_id,
        c.name AS charity_name,
        SUM(da.total_amount_cents) AS total_cents,
        SUM(da.donation_count) AS count
      FROM donation_aggregates da
      JOIN charities c ON c.id = da.charity_id
      WHERE ${whereClause}
      GROUP BY da.charity_id, c.name
      ORDER BY total_cents DESC;
    `;

    const charityResult = await pool.query(charityQuery, values);

    res.json({
      merchant_id: Number(merchantId),
      period,
      total_cents: Number(totalsResult.rows[0].total_cents),
      donation_count: Number(totalsResult.rows[0].donation_count),
      by_charity: charityResult.rows.map(row => ({
        charity_id: row.charity_id,
        charity_name: row.charity_name,
        total_cents: Number(row.total_cents),
        count: Number(row.count)
      }))
    });
  } catch (err) {
    console.error('Merchant summary error:', err);
    res.status(500).json({ error: 'Failed to fetch merchant summary' });
  }
});

module.exports = router;
