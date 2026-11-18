import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';

import GleapAdmin from '../index';
import { fakeGleapApi } from './support/fakeGleapApi';

// The Gleap API is faked at Node's http boundary, so these tests never hit the live API.
const api = fakeGleapApi();
after(() => api.restore());

// Connection options of the last request the SDK issued.
const lastEndpoint = () => {
	const { protocol, hostname, port } = api.requests[0];
	return { protocol, hostname, port };
};

describe('GleapAdmin apiUrl', () => {
	after(() => {
		GleapAdmin.stop();
	});

	beforeEach(() => {
		api.reset();
		api.respondWith(200, []);
	});

	test('requests go to the public API by default', async () => {
		GleapAdmin.initialize('test-token');

		assert.equal(GleapAdmin.apiUrl, 'https://api.gleap.io');

		await GleapAdmin.getPipelines();
		assert.deepEqual(lastEndpoint(), { protocol: 'https:', hostname: 'api.gleap.io', port: undefined });
	});

	test('an http api url with a port is used as given', async () => {
		GleapAdmin.initialize('test-token', { apiUrl: 'http://internal-host:9000' });

		assert.equal(GleapAdmin.apiUrl, 'http://internal-host:9000');

		await GleapAdmin.getPipelines();
		assert.deepEqual(lastEndpoint(), { protocol: 'http:', hostname: 'internal-host', port: '9000' });
	});

	test('a bare hostname means the public HTTPS API', () => {
		GleapAdmin.initialize('test-token', { apiUrl: 'api.eu.gleap.io' });

		assert.equal(GleapAdmin.apiUrl, 'https://api.eu.gleap.io');
	});

	test('a trailing slash and a path are not part of the endpoint', () => {
		GleapAdmin.initialize('test-token', { apiUrl: 'https://api.gleap.io/' });
		assert.equal(GleapAdmin.apiUrl, 'https://api.gleap.io');

		GleapAdmin.apiUrl = 'http://internal-host:9000/admin';
		assert.equal(GleapAdmin.apiUrl, 'http://internal-host:9000');
	});

	test('re-initializing without an api url returns to the public API', () => {
		GleapAdmin.initialize('test-token', { apiUrl: 'http://internal-host:9000' });
		GleapAdmin.initialize('test-token');

		assert.equal(GleapAdmin.apiUrl, 'https://api.gleap.io');
	});

	test('an empty api url falls back to the public API', () => {
		GleapAdmin.initialize('test-token', { apiUrl: '  ' });

		assert.equal(GleapAdmin.apiUrl, 'https://api.gleap.io');
	});
});

describe('GleapAdmin apiUrl fallback', () => {
	after(() => {
		GleapAdmin.stop();
	});

	test('an unparsable api url falls back to the public API instead of throwing', () => {
		GleapAdmin.initialize('test-token', { apiUrl: 'http://' });

		assert.equal(GleapAdmin.apiUrl, 'https://api.gleap.io');
	});

	test('a protocol the SDK cannot speak falls back to the public API', () => {
		GleapAdmin.initialize('test-token', { apiUrl: 'ftp://files.gleap.io' });

		assert.equal(GleapAdmin.apiUrl, 'https://api.gleap.io');
	});

	test('a host that looks like a scheme keeps its port', () => {
		GleapAdmin.initialize('test-token', { apiUrl: 'internal-host:9000' });

		assert.equal(GleapAdmin.apiUrl, 'https://internal-host:9000');
	});
});
