import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, mock, test } from 'node:test';

import GleapAdmin from '../index';
import { fakeGleapApi } from './support/fakeGleapApi';

// trackEvent only buffers; the interval that initialize starts sends the buffer every 2.5 seconds. The interval is a
// fake clock here, and the Gleap API is faked at Node's http boundary.
const api = fakeGleapApi();
after(() => api.restore());

const FLUSH_MS = 2500;

describe('GleapAdmin event tracking', () => {
	beforeEach(() => {
		api.reset();
		mock.timers.enable({ apis: ['setInterval'] });
	});

	afterEach(() => {
		GleapAdmin.stop();
		mock.timers.reset();
	});

	test('sends the buffered events in one batch when the interval fires', () => {
		GleapAdmin.initialize('test-token');
		GleapAdmin.trackEvent('user-1', 'Subscription started', { value: 1200 });
		GleapAdmin.trackEvent('user-1', 'Feature used');

		mock.timers.tick(FLUSH_MS);

		assert.equal(api.requests.length, 1);
		const sent = api.requests[0];
		assert.equal(sent.method, 'POST');
		assert.equal(sent.path, '/admin/track');
		assert.equal(sent.headers['Api-Token'], 'test-token');
		const { events } = JSON.parse(sent.body ?? '');
		assert.deepEqual(
			events.map(({ userId, name, data }: any) => ({ userId, name, data })),
			[
				{ userId: 'user-1', name: 'Subscription started', data: { value: 1200 } },
				{ userId: 'user-1', name: 'Feature used', data: undefined },
			],
		);
		assert.ok(events.every(({ date }: any) => !Number.isNaN(Date.parse(date))));
		assert.equal(GleapAdmin.trackingCache.length, 0);
	});

	test('sends nothing before the interval fires, and nothing when the buffer is empty', () => {
		GleapAdmin.initialize('test-token');
		GleapAdmin.trackEvent('user-1', 'Feature used');

		mock.timers.tick(FLUSH_MS - 1);
		assert.equal(api.requests.length, 0);

		mock.timers.tick(1);
		mock.timers.tick(FLUSH_MS);
		assert.equal(api.requests.length, 1);
	});

	test('ignores an event without a userId or a name, without throwing', () => {
		GleapAdmin.initialize('test-token');

		GleapAdmin.trackEvent('', 'Feature used');
		GleapAdmin.trackEvent('user-1', '');
		GleapAdmin.trackEvent(undefined as any, undefined as any);

		assert.equal(GleapAdmin.trackingCache.length, 0);
	});

	test('stop drops the buffer and sends nothing afterwards', () => {
		GleapAdmin.initialize('test-token');
		GleapAdmin.trackEvent('user-1', 'Feature used');

		GleapAdmin.stop();
		mock.timers.tick(FLUSH_MS * 2);

		assert.equal(GleapAdmin.trackingCache.length, 0);
		assert.equal(api.requests.length, 0);
	});
});
