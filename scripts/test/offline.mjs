// Loaded into every test process: a connection to anything but this machine throws, so a test that forgets the fake
// Gleap API fails instead of writing to production. The SDK's default endpoint is the live api.gleap.io.
import net from 'node:net';

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

const connect = net.Socket.prototype.connect;

net.Socket.prototype.connect = function (...args) {
  // net normalizes its arguments to [options, callback] before it gets here from http, https and tls.
  const [first, second] = Array.isArray(args[0]) ? args[0] : args;
  const options = typeof first === 'object' && first !== null ? first : { port: first, host: second };
  const host = options.host ?? 'localhost';
  if (typeof options.path !== 'string' && !LOOPBACK.has(host)) {
    throw new Error(`Tests stay offline: refused a connection to ${host}. Fake the Gleap API (src/__tests__/support/fakeGleapApi.ts).`);
  }
  return connect.apply(this, args);
};
