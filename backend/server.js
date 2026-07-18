require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const donationsRoutes = require('./routes/donations');
const merchantsRoutes = require('./routes/merchants');
const merchantDonationsRoutes = require('./routes/merchantDonations');
const merchantTimeseriesRoutes = require('./routes/merchantTimeseries');
const webhooksRoutes = require('./routes/webhooks');
const authRoutes = require('./routes/auth');
const charitiesRoutes = require('./routes/charities');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Stripe and Shopify webhooks both verify a signature over the raw request
// body, so they must be registered before express.json() parses it below.
app.post(
  '/api/stripe/webhook',
  bodyParser.raw({ type: 'application/json' }),
  require('./routes/stripeWebhook')
);
app.use(
  '/api/webhooks',
  bodyParser.raw({ type: 'application/json' }),
  webhooksRoutes
);

app.use(express.json());

app.use('/auth', authRoutes);
app.use('/api/donations', donationsRoutes);
app.use('/api/merchants', merchantsRoutes);
app.use('/api/merchant', merchantDonationsRoutes);
app.use('/api/merchant', merchantTimeseriesRoutes);
app.use('/api/charities', charitiesRoutes);

app.get('/', (req, res) => {
  res.send('Micro-donation backend running');
});

// Public, non-secret config the storefront widget needs at runtime.
app.get('/api/config', (req, res) => {
  res.json({ stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
