// Sync customer MRR from Stripe to Gleap on every subscription change.
//
// Setup: npm install express stripe gleap-admin
// Run:   GLEAP_API_TOKEN=... STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... node examples/stripe-webhook.js
//
// The Gleap secret API token lives in your Gleap project settings under
// "Secret API token". Keep it in an environment variable, never in code.
const express = require('express');
const Stripe = require('stripe');
const GleapAdmin = require('gleap-admin').default;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
GleapAdmin.initialize(process.env.GLEAP_API_TOKEN);

// Gleap's `value` field is the customer's MRR: monthly recurring revenue in
// your billing currency, major units (e.g. 49.9, not cents). Yearly prices
// count divided by 12; canceled subscriptions report 0.
const monthlyValueFromSubscription = (subscription) => {
  let cents = 0;
  for (const item of subscription.items.data) {
    const price = item.price;
    if (!price || !price.recurring || price.unit_amount == null) continue;
    const perCycle = price.unit_amount * (item.quantity ?? 1);
    if (price.recurring.interval === 'month') {
      cents += perCycle / (price.recurring.interval_count ?? 1);
    } else if (price.recurring.interval === 'year') {
      cents += perCycle / (12 * (price.recurring.interval_count ?? 1));
    }
  }
  return Math.round(cents) / 100;
};

const app = express();

app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook error: ${err.message}`);
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object;
      const mrr =
        event.type === 'customer.subscription.deleted'
          ? 0
          : monthlyValueFromSubscription(subscription);

      // Use YOUR OWN company id here: the same id your app passes to
      // Gleap.identify / GleapAdmin.identify as `company.id`. If you
      // identify companies by their Stripe customer id, this works as-is.
      await GleapAdmin.updateCompany(subscription.customer, { value: mrr });
    }

    res.json({ received: true });
  }
);

app.listen(4242, () => console.log('Listening on :4242'));
