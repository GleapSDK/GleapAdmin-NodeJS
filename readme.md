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
GleapAdmin.initialize('secret-api-token');
```

The secret api token can be found within your project settings -> API.

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
  value: 1,
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
  value: 4990,
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

## License

MIT
