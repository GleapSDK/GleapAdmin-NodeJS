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
});
```

The userId should match the userId you are using to identify your users.

All key-value pairs in the user properties part are optional.

## License

MIT
