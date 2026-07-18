const fetch = require('node-fetch');

const API_URL = 'http://localhost:4000/api';
const merchants = [1, 2, 3];
const charity_id = 1;

// Helper to generate random test donations
function generateRandomDonation(merchant_id, orderNum) {
  const amount_cents = Math.floor(Math.random() * 200) + 50; // $0.50–$2.50
  return {
    merchant_id,
    charity_id,
    order_id: `TEST_${merchant_id}_${orderNum}`,
    amount_cents,
  };
}

// Create test donations
async function createTestDonations() {
  console.log('➡️ Creating random test donations...');
  const allDonations = [];

  for (const merchant_id of merchants) {
    for (let i = 1; i <= 3; i++) {
      const donation = generateRandomDonation(merchant_id, i);
      try {
        const res = await fetch(`${API_URL}/donations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(donation),
        });

        const data = await res.json();

        if (res.ok) {
          if (data.message) {
            console.log(`⚠️ Donation updated for existing order: ${donation.order_id}`);
          } else {
            console.log(`✅ Donation created for order: ${donation.order_id}`);
          }
          allDonations.push(data.donation);
        } else {
          console.log(`❌ Failed to create donation for order ${donation.order_id}:`, data.error);
        }
      } catch (err) {
        console.error(`Error creating donation for order ${donation.order_id}:`, err);
      }
    }
  }

  console.log('-----------------------------------\n');
  return allDonations;
}

// Fetch aggregation for a given period
async function fetchAggregation(period, fromDate, toDate) {
  try {
    let url = `${API_URL}/donations/aggregate?period=${period}`;
    if (fromDate) url += `&from=${fromDate}`;
    if (toDate) url += `&to=${toDate}`;

    const res = await fetch(url);
    const data = await res.json();

    if (res.ok) {
      console.log(`➡️ ${period.charAt(0).toUpperCase() + period.slice(1)} aggregation${fromDate ? ` from ${fromDate}` : ''}${toDate ? ` to ${toDate}` : ''}:`);
      data.aggregated.forEach(row => {
        console.log(`- Merchant ${row.merchant_id}, Charity ${row.charity_id}, Period ${row.period}, Total $${(row.total_cents/100).toFixed(2)}, Count ${row.count}`);
      });
    } else {
      console.log(`❌ Failed to fetch ${period} aggregation:`, data.error);
    }
    console.log('-----------------------------------\n');
  } catch (err) {
    console.error(`Error fetching ${period} aggregation:`, err);
  }
}

// Run the test
async function runAggregationTests() {
  await createTestDonations();

  // Daily aggregation (all time)
  await fetchAggregation('daily');

  // Weekly aggregation (from a given date)
  await fetchAggregation('weekly', '2025-12-26');

  // Monthly aggregation (specific month)
  await fetchAggregation('monthly', '2026-01-01', '2026-01-31');

  // Invalid period test
  await fetchAggregation('yearly');
}

runAggregationTests();
