import assert from 'node:assert/strict';
import { after, describe, mock, test } from 'node:test';

import GleapAdmin from '../index';

// scripts/test/offline.mjs, loaded into every test process, refuses connections that would leave this machine. Without
// it, a test that forgets the fake would send its request to the live Gleap API.
describe('the test run', () => {
	after(() => {
		GleapAdmin.stop();
		mock.restoreAll();
	});

	test('refuses a request to the public Gleap API before it leaves this machine', async () => {
		const lines: string[] = [];
		mock.method(console, 'log', (...args: unknown[]) => lines.push(args.map(String).join(' ')));
		GleapAdmin.initialize('test-token');

		assert.equal(await GleapAdmin.getPipelines(), null);
		assert.ok(
			lines.some(line => line.includes('Tests stay offline: refused a connection to api.gleap.io')),
			lines.join('\n'),
		);
	});
});
