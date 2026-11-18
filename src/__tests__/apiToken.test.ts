import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';

import GleapAdmin from '../index';
import { fakeGleapApi } from './support/fakeGleapApi';

// The secret API token gives full access to a customer's Gleap project. It travels only in the Api-Token header and
// never shows up in a path or in what the SDK logs.
const TOKEN = 'secret-token-0123456789';

const everyCall = () => [
	GleapAdmin.identify('user-1', { name: 'John Doe', customData: { plan: 'pro' } }),
	GleapAdmin.updateCompany('acme', { plan: 'pro' }),
	GleapAdmin.getCompany('acme'),
	GleapAdmin.deleteCompany('acme'),
	GleapAdmin.getPipelines(),
	GleapAdmin.addPipelineEntry('p1', { companyId: 'acme' }),
	GleapAdmin.updatePipelineEntry('p1', { userId: 'user-1', stageId: 's1' }),
	GleapAdmin.getPipelineEntry('p1', { companyId: 'acme' }),
	GleapAdmin.removePipelineEntry('p1', { companyId: 'acme' }),
];

const logged = () => {
	const lines: string[] = [];
	for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
		mock.method(console, level, (...args: unknown[]) => {
			lines.push(
				args.map(arg => (arg instanceof Error ? `${arg.stack} ${JSON.stringify(arg)}` : JSON.stringify(arg))).join(' '),
			);
		});
	}
	return lines;
};

describe('the API token, against the faked Gleap API', () => {
	let api: ReturnType<typeof fakeGleapApi>;

	before(() => {
		api = fakeGleapApi();
		GleapAdmin.initialize(TOKEN);
	});

	beforeEach(() => api.reset());

	after(() => {
		GleapAdmin.stop();
		mock.restoreAll();
	});

	test('every request carries it in the Api-Token header and never in the path', async () => {
		await Promise.all(everyCall());

		assert.equal(api.requests.length, 9);
		for (const sent of api.requests) {
			assert.equal(sent.headers['Api-Token'], TOKEN, sent.path);
			assert.ok(!sent.path.includes(TOKEN), sent.path);
			assert.ok(!(sent.body ?? '').includes(TOKEN), sent.path);
		}
	});

	test('a failed request logs no token', async () => {
		const lines = logged();
		api.respondWith(500, { message: 'Internal error' });

		await Promise.all(everyCall());

		assert.ok(lines.length >= 8, `expected the failures to be logged, got ${lines.length}`);
		assert.ok(
			lines.every(line => !line.includes(TOKEN)),
			lines.join('\n'),
		);
	});
});

describe('the API token, when the Gleap API cannot be reached', () => {
	let closedPort: number;

	before(async () => {
		const closed = createServer();
		await new Promise<void>(resolve => closed.listen(0, '127.0.0.1', resolve));
		closedPort = (closed.address() as AddressInfo).port;
		await new Promise(resolve => closed.close(resolve));
	});

	afterEach(() => {
		GleapAdmin.stop();
		mock.restoreAll();
	});

	test('a connection error logs no token', async () => {
		GleapAdmin.initialize(TOKEN, { apiUrl: `http://127.0.0.1:${closedPort}` });
		const lines = logged();

		const results = await Promise.all(everyCall());

		assert.deepEqual(results, [false, null, null, false, null, null, null, null, false]);
		assert.ok(lines.length >= 9, `expected the failures to be logged, got ${lines.length}`);
		assert.ok(
			lines.every(line => !line.includes(TOKEN)),
			lines.join('\n'),
		);
	});
});
