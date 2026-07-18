console.log("✅ Micro-donation script loaded");

(function () {
  // Unlike the old manually-pasted <script> tag, this asset is served from
  // Shopify's CDN, not our backend, so the origin can't be derived from the
  // script's own src - it's hardcoded instead.
  const BACKEND_ORIGIN = "https://micro-donation-plugin-production.up.railway.app";

  function formatCents(cents) {
    return (cents / 100).toFixed(2);
  }

  // 1️⃣ Detect cart subtotal
  const subtotalEl = document.querySelector(".cart__subtotal, .cart-subtotal, [data-cart-subtotal]");
  if (!subtotalEl) {
    console.warn("⚠️ Micro-donation: Could not find cart subtotal element");
    return;
  }

  const subtotalText = subtotalEl.textContent.replace(/[^\d.]/g, "");
  const subtotalCents = Math.round(parseFloat(subtotalText) * 100);

  // 2️⃣ Calculate round-up
  const nextDollarCents = Math.ceil(subtotalCents / 100) * 100;
  const roundUpCents = nextDollarCents - subtotalCents;

  if (roundUpCents === 0) {
    console.log("Micro-donation: Cart is already a whole dollar, no donation needed");
    return;
  }

  // 3️⃣ Get Shopify cart token (used as order_id)
  let orderId = null;
  try {
    orderId = Shopify?.cart?.token || window.Shopify?.cart?.token || "ORDER_JS_DYNAMIC";
  } catch (err) {
    console.warn("Could not get Shopify cart token, using fallback");
    orderId = "ORDER_JS_DYNAMIC";
  }

  // 4️⃣ Shop domain identifies the merchant - the backend resolves the
  // numeric merchant id and their configured default charity from this.
  const shopDomain = window.Shopify?.shop || window.location.hostname;

  // 5️⃣ Inject donation UI
  const donationContainer = document.createElement("div");
  donationContainer.style.padding = "12px";
  donationContainer.style.border = "1px solid #eee";
  donationContainer.style.marginTop = "10px";
  donationContainer.style.borderRadius = "6px";
  donationContainer.style.background = "#f9f9f9";
  donationContainer.style.fontSize = "14px";

  donationContainer.innerHTML = `
    <div id="donationPrompt">
      <label>
        <input type="checkbox" id="roundUpDonationCheckbox" checked />
        Round up $${formatCents(roundUpCents)} to donate?
      </label>
      <button id="roundUpDonationButton" style="
        margin-left: 10px;
        padding: 4px 8px;
        border-radius: 4px;
        border: none;
        background: #007bff;
        color: white;
        cursor: pointer;
      ">
        Add Donation
      </button>
    </div>
    <div id="donationPaymentForm" style="display:none; margin-top:10px;">
      <div id="donationPaymentElement"></div>
      <button id="confirmDonationButton" style="
        margin-top: 8px;
        padding: 6px 10px;
        border-radius: 4px;
        border: none;
        background: #007bff;
        color: white;
        cursor: pointer;
      ">
        Confirm $${formatCents(roundUpCents)} Donation
      </button>
    </div>
    <span id="donationStatus" style="margin-left:10px;"></span>
  `;

  subtotalEl.parentNode.insertBefore(donationContainer, subtotalEl.nextSibling);

  const promptEl = document.getElementById("donationPrompt");
  const button = document.getElementById("roundUpDonationButton");
  const checkbox = document.getElementById("roundUpDonationCheckbox");
  const statusSpan = document.getElementById("donationStatus");
  const paymentForm = document.getElementById("donationPaymentForm");
  const confirmButton = document.getElementById("confirmDonationButton");

  let stripe;
  let elements;
  let donationId;

  // 6️⃣ Handle donation click: create the donation + PaymentIntent, then
  // mount a real Stripe Payment Element for the customer to pay with.
  button.addEventListener("click", async () => {
    if (!checkbox.checked) {
      statusSpan.textContent = "Donation skipped.";
      return;
    }

    button.disabled = true;
    statusSpan.textContent = "Processing...";

    const payload = {
      shop_domain: shopDomain,
      order_id: orderId,
      amount_cents: roundUpCents
    };

    try {
      const [configRes, donationRes] = await Promise.all([
        fetch(`${BACKEND_ORIGIN}/api/config`),
        fetch(`${BACKEND_ORIGIN}/api/donations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      ]);

      const config = await configRes.json();
      const data = await donationRes.json();

      if (!donationRes.ok) {
        throw new Error(data.error || "Failed to start donation");
      }

      if (data.donation.status === "completed") {
        statusSpan.textContent = "✅ You've already donated for this order!";
        promptEl.style.display = "none";
        return;
      }
      if (!data.payment_intent_client_secret) {
        throw new Error("Missing client secret from backend");
      }

      donationId = data.donation.id;
      stripe = Stripe(config.stripePublishableKey);
      elements = stripe.elements({ clientSecret: data.payment_intent_client_secret });
      const paymentElement = elements.create("payment");
      paymentElement.mount("#donationPaymentElement");

      promptEl.style.display = "none";
      paymentForm.style.display = "block";
      statusSpan.textContent = "";
    } catch (err) {
      console.error(err);
      statusSpan.textContent = `❌ ${err.message || "Error starting donation"}`;
      button.disabled = false;
    }
  });

  // 7️⃣ Confirm the donation with whatever card details the customer entered
  confirmButton.addEventListener("click", async () => {
    confirmButton.disabled = true;
    statusSpan.textContent = "Processing...";

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required"
      });

      if (error) {
        console.error(error);
        statusSpan.textContent = `❌ ${error.message || "Donation payment failed"}`;
        confirmButton.disabled = false;
      } else if (paymentIntent.status === "succeeded") {
        // Webhook delivery for finalizing the donation server-side has
        // proven unreliable, so tell the backend directly rather than
        // waiting on it.
        try {
          await fetch(`${BACKEND_ORIGIN}/api/donations/${donationId}/confirm`, { method: "POST" });
        } catch (confirmErr) {
          console.warn("Payment succeeded but failed to notify backend:", confirmErr);
        }
        statusSpan.textContent = `✅ Donated $${formatCents(roundUpCents)}!`;
        paymentForm.style.display = "none";
      } else {
        statusSpan.textContent = `⚠️ Donation status: ${paymentIntent.status}`;
        confirmButton.disabled = false;
      }
    } catch (err) {
      console.error(err);
      statusSpan.textContent = "❌ Error processing donation";
      confirmButton.disabled = false;
    }
  });
})();
