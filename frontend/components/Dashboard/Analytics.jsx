import React, { useEffect, useState } from "react";
import { fetchDonationAnalytics } from "../../utils/api";

function Analytics() {
  const [totalDonations, setTotalDonations] = useState(0);
  const [donationCount, setDonationCount] = useState(0);

  useEffect(() => {
    async function getAnalytics() {
      try {
        const data = await fetchDonationAnalytics();
        setTotalDonations(data.totalAmount);
        setDonationCount(data.totalCount);
      } catch (error) {
        console.error(error);
      }
    }
    getAnalytics();
  }, []);

  return (
    <div className="dashboard-analytics">
      <h2>Donation Analytics</h2>
      <p>Total Donations: {totalDonations.toFixed(2)</p>
      <p>Number of Donations: {donationCount}</p>
    </div>
  );
}

export default Analytics;