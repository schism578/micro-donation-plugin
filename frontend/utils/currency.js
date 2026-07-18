export function calculateRoundUp(amount) {
  const nextWholeDollar = Math.ceil(amount);
  return nextWholeDollar - amount;
}