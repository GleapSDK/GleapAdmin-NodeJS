import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';

import { post } from '../httpclient';
import GleapAdmin from '../index';
import { fakeGleapApi } from './support/fakeGleapApi';

describe('GleapAdmin', () => {
	// The Gleap API is faked at Node's http boundary, so identify never reaches the live API.
	let api: ReturnType<typeof fakeGleapApi>;

	before(() => {
		api = fakeGleapApi();
		GleapAdmin.initialize('test-token');
	});

	after(() => {
		GleapAdmin.stop();
		api.restore();
	});

	test('initialize SDK', () => {
		assert.equal(GleapAdmin.apiToken, 'test-token');
		assert.equal(GleapAdmin.initialized, true);
	});

	test('identify user', () => {
		return GleapAdmin.identify('XOXO', {
			name: 'John Doe',
			email: 'john@doe.io',
			value: 100,
			phone: '+491234533333',
		}).then(success => {
			assert.equal(success, true);
		});
	});

	test('track event', () => {
		GleapAdmin.trackEvent('XOXO', 'test-event');
		assert.equal(GleapAdmin.trackingCache.length, 1);

		GleapAdmin.trackEvent('XOXO', 'test-event-2');
		assert.equal(GleapAdmin.trackingCache.length, 2);
	});

	test('stop', () => {
		GleapAdmin.stop();
		assert.equal(GleapAdmin.trackingCache.length, 0);
		assert.equal(GleapAdmin.apiToken, '');
		assert.equal(GleapAdmin.initialized, false);
	});
});

describe('HttpHelper', () => {
	// A local server that answers like the public echo API this test once called: the posted user back, with an id.
	let server: Server;
	let port: number;

	before(async () => {
		server = createServer((request, response) => {
			const chunks: Buffer[] = [];
			request.on('data', (chunk: Buffer) => chunks.push(chunk));
			request.on('end', () => {
				response.writeHead(201, { 'Content-Type': 'application/json' });
				response.end(JSON.stringify({ id: 1, ...JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
			});
		});
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		port = (server.address() as AddressInfo).port;
	});

	after(() => {
		server.close();
	});

	test('httpRequest', () => {
		return post({
			protocol: 'http:',
			hostname: '127.0.0.1',
			port,
			headers: {
				'Content-Type': 'application/json',
			},
			path: '/users/add',
			body: JSON.stringify({
				firstName: 'John',
				lastName: 'Ovi',
				age: 250,
			}),
		}).then((response: any) => {
			assert.notEqual(response, undefined);
			assert.equal(response.firstName, 'John');
		});
	});
});
