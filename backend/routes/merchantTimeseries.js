const express = require('express');
const router = express.Router();
const { pool } = require('../services/db');

const BUCKET_UNIT = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month'
};

/**
 * GET /api/merchant/:merchantId/donations/timeseries
 */
router.get('/:merchantId/donations/timeseries', async (req, res) => {
  const { merchantId } = req.params;
  const {
    period = 'daily',
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
       WHERE clause builder
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
       Timeseries query - bucket the stored
       daily aggregates up to the requested
       granularity
    --------------------------------------- */
    const query = `
      SELECT
        date_trunc('${BUCKET_UNIT[period]}', period_start) AS bucket,
        SUM(total_amount_cents) AS total_cents,
        SUM(donation_count) AS donation_count
      FROM donation_aggregates
      WHERE ${whereClause}
      GROUP BY bucket
      ORDER BY bucket ASC;
    `;

    const { rows } = await pool.query(query, values);

    res.json({
      merchant_id: Number(merchantId),
      period,
      series: rows.map(row => ({
        date: row.bucket,
        total_cents: Number(row.total_cents),
        donation_count: Number(row.donation_count)
      }))
    });
  } catch (err) {
    console.error('Timeseries error:', err);
    res.status(500).json({ error: 'Failed to fetch timeseries data' });
  }
});

module.exports = router;
