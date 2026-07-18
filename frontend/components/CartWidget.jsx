import React, { useState, useEffect } from "react";
import { calculateRoundUp } from "../utils/currency";
import { createDonation } from "../utils/api";

function CartWidget() {
  const [cartTotal, setCartTotal] = useState(0);
  const [roundUpAmount, setRoundUpAmount] = useState(0);
  const [optIn, setOptIn] = useState(true);

  useEffect(() => {
    async function fetchCart() {
      const total = 37.48;
      setCartTotal(total);
      setRoundUpAmount(calculateRoundUp(total));
    }
    fetchCart();
  }, []);

  const handleDonate = async () => {
    if (!optIn) return;
    await createDonation({ amount: roundUpAmount, orderId: "TEST_ORDER_001" });
    alert(`Thank you for donating $${roundUpAmount.toFixed(2)}!`);
  };

  return (
    <div className="cart-widget">
      <p>Cart Total: {cartTotal.toFixed(2)</p>
      <p>Round-Up Donation: {roundUpAmount.toFixed(2)</p>
      <label>
        <input type="checkbox" checked={optIn} onChange={() => setOptIn(!optIn)} />
        Opt-in to donate
      </label>
      <button onClick={handleDonate}>Donate Now</button>
    </div>
  );
}

export default CartWidget;