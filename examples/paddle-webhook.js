// Sync customer MRR from Paddle (Billing API) to Gleap on subscription changes.
//
// Setup: npm install express gleap-admin
// Run:   GLEAP_API_TOKEN=... node examples/paddle-webhook.js
//
// Verify the Paddle-Signature header in production:
// https://developer.paddle.com/webhooks/signature-verification
const express = require('express');
const GleapAdmin = require('gleap-admin').default;

GleapAdmin.initialize(process.env.GLEAP_API_TOKEN);

// Gleap's `value` field is the customer's MRR: monthly recurring revenue in
// your billing currency, major units. Paddle amounts arrive as strings in
// minor units (cents); yearly cycles count divided by 12.
const monthlyValueFromSubscription = (subscription) => {
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return 0;
  }
  let cents = 0;
  for (const item of subscription.items ?? []) {
    if (item.status !== 'active' && item.status !== 'trialing') continue;
    const unit = Number(item.price?.unit_price?.amount ?? 0);
    const perCycle = unit * (item.quantity ?? 1);
    const interval = item.price?.billing_cycle?.interval;
    const frequency = item.price?.billing_cycle?.frequency ?? 1;
    if (interval === 'month') cents += perCycle / frequency;
    if (interval === 'year') cents += perCycle / (12 * frequency);
  }
  return Math.round(cents) / 100;
};

const app = express();

app.post('/webhooks/paddle', express.json(), async (req, res) => {
  const event = req.body;

  if (
    event.event_type === 'subscription.created' ||
    event.event_type === 'subscription.updated' ||
    event.event_type === 'subscription.canceled'
  ) {
    const subscription = event.data;
    const mrr =
      event.event_type === 'subscription.canceled'
        ? 0
        : monthlyValueFromSubscription(subscription);

    // Use YOUR OWN company id: the same id your app passes to
    // Gleap.identify / GleapAdmin.identify as `company.id`. Carrying it in
    // the Paddle subscription's custom_data is a good pattern.
    const companyId =
      subscription.custom_data?.companyId ?? subscription.customer_id;
    await GleapAdmin.updateCompany(companyId, { value: mrr });
  }

  res.json({ received: true });
});

app.listen(4242, () => console.log('Listening on :4242'));
