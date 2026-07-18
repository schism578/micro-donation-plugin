const db = require("./db");
module.exports = {
  getDonationAnalytics: async () => {
    const donations = await db.getDonations();
    const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
    return { totalAmount, totalCount: donations.length };
  }
};