export async function createDonation({ amount, orderId }) {
  const response = await fetch("/api/donations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, orderId }),
  });
  return await response.json();
}

export async function fetchDonationAnalytics() {
  const response = await fetch("/api/analytics");
  return await response.json();
}