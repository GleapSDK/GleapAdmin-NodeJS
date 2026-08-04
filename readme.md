# Gleap Admin for NodeJS

This package allows you to track customer events from the server side.

## Installation

```bash
npm install gleap-admin --save
```

## Usage

Import the GleapAdmin package.

```js
import GleapAdmin from 'gleap-admin';
```

### Initialize the SDK

It is required to initialize the GleapAdmin SDK before sending events or other requests.

```js
GleapAdmin.initialize(process.env.GLEAP_API_TOKEN);
```

The secret API token can be found within your project settings -> Secret API token. Keep it in an environment variable; it must never ship to client apps.

### Track an event

```js
GleapAdmin.trackEvent('user-id', 'event-name', {
  someEventData: "yeah!"
});
```

The userId should match the userId you are using to identify your users.

The event data (last param) is optional.

### Identify an user

```js
GleapAdmin.identify('user-id', {
  name: 'XOXO',
  email: 'asdf@asf.de',
  value: 499, // MRR: monthly recurring revenue, major units
  phone: '+4395959595',
  // Optional: associate the user with a company.
  company: {
    id: 'acme-inc',
    name: 'ACME inc.',
  },
});
```

The userId should match the userId you are using to identify your users.

All key-value pairs in the user properties part are optional. The optional
`company` object associates the user with a company — only `company.id` is
required and `company.name` never overwrites a name set via `updateCompany`.

### Companies

Set authoritative company attributes (plan, value, SLA, address, custom data)
from your backend. These are shown in the dashboard and used for company-level
SLAs, and are never overwritten by data sent from your client apps.

```js
// Create or update a company (companyId is your own immutable identifier).
const company = await GleapAdmin.updateCompany('acme-inc', {
  name: 'ACME inc.',
  plan: 'Growth plan',
  value: 4990, // MRR: monthly recurring revenue, major units
  sla: 3600, // Response-time SLA in seconds.
  domain: 'acme.com',
  address: { line1: '1 Infinite Loop', city: 'Cupertino', country: 'US' },
  customData: { tier: 'gold' },
});

// Read a company (returns null if it doesn't exist).
const existing = await GleapAdmin.getCompany('acme-inc');

// Delete a company (its contacts and conversations are kept).
const success = await GleapAdmin.deleteCompany('acme-inc');
```

## Track MRR (customer value)

Gleap uses the `value` field as a customer's MRR: **monthly recurring
revenue, in your billing currency, in major units** (for example `499` or
`49.9`, not cents). It powers revenue-based prioritization in Kai PM,
revenue context on tickets, and company segmentation.

You can set it on two levels:

- **Company** (recommended for B2B):
  `GleapAdmin.updateCompany('acme-inc', { value: 4990 })`. Authoritative and
  shared by every contact of that company.
- **Contact**: `GleapAdmin.identify('user-id', { value: 4990 })` for
  individual users, or when you do not group contacts into companies.

Kai PM scores a company account with the maximum of the company `value` and
its members' contact `value`s, counted once per company — so for team
accounts, setting the company value is enough.

The best place to update it is your billing webhook (subscription created,
updated, canceled), so Gleap always mirrors your billing system:

- [examples/stripe-webhook.js](examples/stripe-webhook.js)
- [examples/paddle-webhook.js](examples/paddle-webhook.js)

Notes:

- `identify` and `updateCompany` send immediately — safe in short-lived
  webhook handlers. `trackEvent` is buffered (flushed every 2.5 seconds), so
  only use it from long-running processes.
- `identify` flattens `customData` into top-level contact attributes;
  `updateCompany` keeps `customData` nested on the company. Put MRR in
  `value`, not in `customData`.
- On cancellation, set `value: 0`.

## License

MIT
