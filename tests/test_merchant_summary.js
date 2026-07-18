const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:4000/api';

async function fetchSummary(merchantId, params = '') {
  const res = await fetch(
    `${BASE_URL}/merchant/${merchantId}/donations/summary${params}`
  );
  return res.json();
}

async function runTests() {
  console.log('\n➡️ Merchant 1 – Monthly Summary');
  console.log(await fetchSummary(1));

  console.log('\n➡️ Merchant 1 – Daily Summary');
  console.log(await fetchSummary(1, '?period=daily'));

  console.log('\n➡️ Merchant 2 – Monthly Summary');
  console.log(await fetchSummary(2));

  console.log('\n➡️ Merchant 1 – Charity Filter');
  console.log(await fetchSummary(1, '?charity_id=1'));

  console.log('\n➡️ Merchant 1 – Date Range');
  console.log(
    await fetchSummary(
      1,
      '?start_date=2026-01-01&end_date=2026-01-31'
    )
  );

  console.log('\n➡️ Invalid Period Test');
  console.log(await fetchSummary(1, '?period=yearly'));
}

runTests().catch(console.error);
