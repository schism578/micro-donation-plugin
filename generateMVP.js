const fs = require("fs");
const path = require("path");

// Helper function to create folder + file
function createStructure(basePath, obj) {
  for (const key in obj) {
    const fullPath = path.join(basePath, key);
    if (typeof obj[key] === "object") {
      fs.mkdirSync(fullPath, { recursive: true });
      createStructure(fullPath, obj[key]);
    } else {
      fs.writeFileSync(fullPath, obj[key], "utf8");
    }
  }
}

// MVP File Contents
const mvp = {
  frontend: {
    "index.jsx": `import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
ReactDOM.render(<App />, document.getElementById("root"));`,

    "App.jsx": `import React from "react";
import { AppProvider } from "@shopify/polaris";
import CartWidget from "./components/CartWidget";
import Dashboard from "./components/Dashboard/Analytics";
import "@shopify/polaris/build/esm/styles.css";

function App() {
  return (
    <AppProvider>
      <div>
        <h1>Micro-Donation Cart Plugin</h1>
        <CartWidget />
        <Dashboard />
      </div>
    </AppProvider>
  );
}
export default App;`,

    components: {
      "CartWidget.jsx": `import React, { useState, useEffect } from "react";
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
    alert(\`Thank you for donating $\${roundUpAmount.toFixed(2)}!\`);
  };

  return (
    <div className="cart-widget">
      <p>Cart Total: ${"{cartTotal.toFixed(2)"}</p>
      <p>Round-Up Donation: ${"{roundUpAmount.toFixed(2)"}</p>
      <label>
        <input type="checkbox" checked={optIn} onChange={() => setOptIn(!optIn)} />
        Opt-in to donate
      </label>
      <button onClick={handleDonate}>Donate Now</button>
    </div>
  );
}

export default CartWidget;`,

      Dashboard: {
        "Analytics.jsx": `import React, { useEffect, useState } from "react";
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
      <p>Total Donations: ${"{totalDonations.toFixed(2)"}</p>
      <p>Number of Donations: ${"{donationCount}"}</p>
    </div>
  );
}

export default Analytics;`,

        "DonationList.jsx": `import React, { useEffect, useState } from "react";

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
              <td>${"{d.amount.toFixed(2)"}</td>
              <td>{d.status}</td>
              <td>{new Date(d.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DonationList;`,

        "Settings.jsx": `import React, { useEffect, useState } from "react";

function Settings() {
  const [charity, setCharity] = useState("");

  useEffect(() => {
    async function fetchSettings() {
      const response = await fetch("/api/merchants/settings");
      const data = await response.json();
      setCharity(data.defaultCharity || "");
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      await fetch("/api/merchants/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultCharity: charity }),
      });
      alert("Settings saved!");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="dashboard-settings">
      <h2>Merchant Settings</h2>
      <label>
        Default Charity:
        <input type="text" value={charity} onChange={e => setCharity(e.target.value)} />
      </label>
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

export default Settings;`
      }
    },

    utils: {
      "currency.js": `export function calculateRoundUp(amount) {
  const nextWholeDollar = Math.ceil(amount);
  return nextWholeDollar - amount;
}`,

      "api.js": `export async function createDonation({ amount, orderId }) {
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
}`
    }
  },

  backend: {
    "server.js": `const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const donationRoutes = require("./routes/donations");
const merchantRoutes = require("./routes/merchants");
const webhookRoutes = require("./routes/webhooks");
const stripeRoutes = require("./routes/stripe");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use("/api/donations", donationRoutes);
app.use("/api/merchants", merchantRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/stripe", stripeRoutes);

const analyticsService = require("./services/analytics");
app.get("/api/analytics", async (req, res) => {
  try {
    const analytics = await analyticsService.getDonationAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error(error);
    res.status(500).json({ totalAmount: 0, totalCount: 0 });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(\`Backend running on port \${PORT}\`));`,

    routes: {
      "donations.js": `const express = require("express");
const router = express.Router();
const db = require("../services/db");

router.post("/", async (req, res) => {
  const { amount, orderId } = req.body;
  try {
    const result = await db.createDonation(orderId, amount);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create donation" });
  }
});

router.get("/", async (req, res) => {
  const donations = await db.getDonations();
  res.json(donations);
});

module.exports = router;`,

      "merchants.js": `const express = require("express");
const router = express.Router();
const db = require("../services/db");

router.get("/settings", async (req, res) => {
  const settings = await db.getMerchantSettings();
  res.json(settings);
});

router.post("/settings", async (req, res) => {
  const { defaultCharity } = req.body;
  const updated = await db.updateMerchantSettings(defaultCharity);
  res.json(updated);
});

module.exports = router;`,

      "webhooks.js": `const express = require("express");
const router = express.Router();
const webhookVerify = require("../middleware/webhookVerify");
const db = require("../services/db");

router.post("/orders/create", webhookVerify, async (req, res) => {
  const order = req.body;
  await db.createDonation(order.id, 0);
  res.status(200).send("Webhook received");
});

router.post("/app/uninstalled", webhookVerify, async (req, res) => {
  const shopDomain = req.body.myshopify_domain;
  await db.deleteMerchant(shopDomain);
  res.status(200).send("Merchant removed");
});

module.exports = router;`,

      "stripe.js": `const express = require("express");
const router = express.Router();
const stripeService = require("../services/stripe");

router.post("/payout", async (req, res) => {
  const { donationId } = req.body;
  const result = await stripeService.sendPayout(donationId);
  res.json(result);
});

module.exports = router;`
    },

    services: {
      "db.js": `const { Pool } = require("pg");

// Configure PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "micro_donation_app",
  password: process.env.DB_PASSWORD || "password",
  port: process.env.DB_PORT || 5432,
});

// -------------------- Donations --------------------

async function createDonation(orderId, amount, merchantId = 1, customerId = null, charityId = 1) {
  const query = ``
    INSERT INTO donations (order_id, amount, merchant_id, customer_id, charity_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  ``;
  const values = [orderId, amount, merchantId, customerId, charityId];
  const res = await pool.query(query, values);
  return res.rows[0];
}

async function getDonations() {
  const res = await pool.query(``
    SELECT d.*, c.name as charity_name, m.shop_domain
    FROM donations d
    JOIN charities c ON d.charity_id = c.id
    JOIN merchants m ON d.merchant_id = m.id
    ORDER BY d.created_at DESC;
  ``);
  return res.rows;
}

// -------------------- Merchant Settings --------------------

async function getMerchantSettings(merchantId = 1) {
  const res = await pool.query(``
    SELECT default_charity AS "defaultCharity"
    FROM merchants
    WHERE id = $1;
  ``, [merchantId]);

  if (res.rows.length === 0) return { defaultCharity: null };
  return res.rows[0];
}

async function updateMerchantSettings(defaultCharity, merchantId = 1) {
  await pool.query(``
    UPDATE merchants
    SET default_charity = $1, updated_at = NOW()
    WHERE id = $2;
  ``, [defaultCharity, merchantId]);

  return getMerchantSettings(merchantId);
}

// -------------------- Delete Merchant --------------------

async function deleteMerchant(shopDomain) {
  await pool.query(``DELETE FROM merchants WHERE shop_domain = $1;``, [shopDomain]);
  await pool.query(``DELETE FROM donations WHERE merchant_id NOT IN (SELECT id FROM merchants);``);
}

// -------------------- Exports --------------------

module.exports = {
  createDonation,
  getDonations,
  getMerchantSettings,
  updateMerchantSettings,
  deleteMerchant,
  pool, // raw queries if needed
};`,
      
"analytics.js": `const db = require("./db");
module.exports = {
  getDonationAnalytics: async () => {
    const donations = await db.getDonations();
    const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
    return { totalAmount, totalCount: donations.length };
  }
};`
    },

    middleware: {
      "auth.js": `module.exports = (req,res,next)=>{const token=req.headers["x-shopify-access-token"];if(!token)return res.status(401).json({error:"Unauthorized"});next();}`,
      "webhookVerify.js": `module.exports = (req,res,next)=>{next();}` // Simplified for MVP
    }
  }
};

// Run creation
createStructure(process.cwd(), mvp);
console.log("MVP project structure with code created!");
