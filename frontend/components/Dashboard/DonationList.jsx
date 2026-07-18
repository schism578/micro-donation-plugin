import React, { useEffect, useState } from "react";

function DonationList() {
  const [donations, setDonations] = useState([]);

  useEffect(() => {
    async function fetchDonations() {
      try {
        const response = await fetch("/api/donations");
        const data = await response.json();
        setDonations(data);
      } catch (error) {
        console.error(error);
      }
    }
    fetchDonations();
  }, []);

  return (
    <div className="dashboard-donation-list">
      <h2>Recent Donations</h2>
      <table>
        <thead>
          <tr><th>Order ID</th><th>Amount</th><th>Status</th><th>Date</th></tr>
        </thead>
        <tbody>
          {donations.map(d => (
            <tr key={d.id}>
              <td>{d.order_id}</td>
              <td>{d.amount.toFixed(2)</td>
              <td>{d.status}</td>
              <td>{new Date(d.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DonationList;