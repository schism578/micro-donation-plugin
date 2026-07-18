/**
 * Calculates the round-up donation amount in cents.
 * @param {number} total - Cart total in dollars (e.g. 23.42)
 * @returns {number} donation amount in cents
 */
function calculateRoundUp(total) {
  if (typeof total !== 'number' || total < 0) {
    throw new Error('Invalid cart total');
  }

  const dollars = Math.floor(total);
  const nextDollar = dollars + 1;

  if (total === dollars) {
    return 0;
  }

  const roundUpAmount = nextDollar - total;

  return Math.round(roundUpAmount * 100);
}

module.exports = {
  calculateRoundUp
};
