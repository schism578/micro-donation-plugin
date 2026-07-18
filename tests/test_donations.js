const fetch = require('node-fetch');

const testDonations = [
  { merchant_id: 1, charity_id: 1, order_id: 'ORDER1001', amount_cents: 45 },
  { merchant_id: 1, charity_id: 1, order_id: 'ORDER1002', amount_cents: 78 },
  { merchant_id: 2, charity_id: 1, order_id: 'ORDER2001', amount_cents: 32 },
  { merchant_id: 2, charity_id: 1, order_id: 'ORDER2002', amount_cents: 32 },
  { merchant_id: 3, charity_id: 1, order_id: 'ORDER3001', amount_cents: 99 },
];

const API_URL = 'http://localhost:4000/api/donations';

async function runTests() {
  for (const donation of testDonations) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donation),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.message) {
          console.log(`⚠️ Donation updated for existing order: ${donation.order_id}`);
        } else {
          console.log(`✅ Donation created for order: ${donation.order_id}`);
        }
        console.log('Donation object:', data.donation);
        console.log('PaymentIntent client_secret:', data.payment_intent_client_secret);
      } else {
        console.log(`❌ Failed for order ${donation.order_id}:`, data.error);
      }

      console.log('-----------------------------------');
    } catch (err) {
      console.error(`Error testing order ${donation.order_id}:`, err);
    }
  }
}

runTests();
