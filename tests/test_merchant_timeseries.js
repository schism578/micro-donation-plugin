const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:4000/api';

async function fetchSeries(merchantId, params = '') {
  const res = await fetch(
    `${BASE_URL}/merchant/${merchantId}/donations/timeseries${params}`
  );
  return res.json();
}

async function runTests() {
  console.log('\n➡️ Merchant 1 – Daily Timeseries');
  console.log(await fetchSeries(1));

  console.log('\n➡️ Merchant 1 – Weekly Timeseries');
  console.log(await fetchSeries(1, '?period=weekly'));

  console.log('\n➡️ Merchant 1 – Monthly Timeseries');
  console.log(await fetchSeries(1, '?period=monthly'));

  console.log('\n➡️ Merchant 2 – Date Range');
  console.log(
    await fetchSeries(
      2,
      '?start_date=2026-01-01&end_date=2026-01-31'
    )
  );

  console.log('\n➡️ Merchant 1 – Charity Filter');
  console.log(await fetchSeries(1, '?charity_id=1'));

  console.log('\n➡️ Invalid Period Test');
  console.log(await fetchSeries(1, '?period=yearly'));
}

runTests().catch(console.error);
