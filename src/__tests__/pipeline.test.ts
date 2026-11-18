import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import GleapAdmin from '../index';
import { fakeGleapApi } from './support/fakeGleapApi';

// The Gleap API is faked at Node's http boundary, so these tests never hit the live API.
const api = fakeGleapApi();
after(() => api.restore());

describe('GleapAdmin pipelines', () => {
	before(() => {
		GleapAdmin.initialize('test-token');
	});

	after(() => {
		GleapAdmin.stop();
	});

	beforeEach(() => {
		api.reset();
	});

	test('getPipelines GETs the pipeline list', async () => {
		const pipelines = [{ id: 'p1', name: 'Onboarding', recordType: 'COMPANY', stages: [], fields: [] }];
		api.respondWith(200, pipelines);

		const result = await GleapAdmin.getPipelines();

		assert.equal(api.requests.length, 1);
		const arg = api.requests[0];
		assert.equal(arg.method, 'GET');
		assert.equal(arg.path, '/admin/pipelines');
		assert.equal(arg.headers['Api-Token'], 'test-token');
		assert.deepEqual(result, pipelines);
	});

	test('getPipelines returns null on a non-2xx response', async () => {
		api.respondWith(500, {});
		assert.equal(await GleapAdmin.getPipelines(), null);
	});

	test('addPipelineEntry POSTs to the company entry route', async () => {
		const entry = { id: 'e1', pipelineId: 'p1', companyId: 'acme', stageId: 's1', values: {} };
		api.respondWith(201, entry);

		const result = await GleapAdmin.addPipelineEntry('p1', { companyId: 'acme', stageId: 's1' });

		const arg = api.requests[0];
		assert.equal(arg.method, 'POST');
		assert.equal(arg.path, '/admin/pipelines/p1/companies/acme');
		assert.deepEqual(JSON.parse(arg.body ?? ''), { stageId: 's1' });
		assert.deepEqual(result, entry);
	});

	test('addPipelineEntry routes a userId target to the contact entry route', async () => {
		api.respondWith(201, {});

		await GleapAdmin.addPipelineEntry('p1', { userId: 'user-1', values: { plan: 'pro' } });

		const arg = api.requests[0];
		assert.equal(arg.method, 'POST');
		assert.equal(arg.path, '/admin/pipelines/p1/contacts/user-1');
		assert.deepEqual(JSON.parse(arg.body ?? ''), { values: { plan: 'pro' } });
	});

	test('addPipelineEntry returns null on a non-2xx response', async () => {
		api.respondWith(404, { message: 'Company not found' });
		assert.equal(await GleapAdmin.addPipelineEntry('p1', { companyId: 'missing' }), null);
	});

	test('updatePipelineEntry PUTs to the company entry route', async () => {
		const entry = { id: 'e1', pipelineId: 'p1', companyId: 'acme', stageId: 's2', values: { mrr: 499 } };
		api.respondWith(200, entry);

		const result = await GleapAdmin.updatePipelineEntry('p1', {
			companyId: 'acme',
			stageId: 's2',
			values: { mrr: 499 },
		});

		const arg = api.requests[0];
		assert.equal(arg.method, 'PUT');
		assert.equal(arg.path, '/admin/pipelines/p1/companies/acme');
		assert.deepEqual(JSON.parse(arg.body ?? ''), { stageId: 's2', values: { mrr: 499 } });
		assert.deepEqual(result, entry);
	});

	test('updatePipelineEntry routes a userId target to the contact entry route', async () => {
		api.respondWith(200, {});

		await GleapAdmin.updatePipelineEntry('p1', { userId: 'user-1', stageId: 's1' });

		const arg = api.requests[0];
		assert.equal(arg.path, '/admin/pipelines/p1/contacts/user-1');
		assert.deepEqual(JSON.parse(arg.body ?? ''), { stageId: 's1' });
	});

	test('updatePipelineEntry url-encodes the pipelineId and target id', async () => {
		api.respondWith(200, {});

		await GleapAdmin.updatePipelineEntry('p 1', { companyId: 'acme/inc' });

		assert.equal(api.requests[0].path, '/admin/pipelines/p%201/companies/acme%2Finc');
	});

	test('updatePipelineEntry omits unset stageId/values from the body', async () => {
		api.respondWith(200, {});

		await GleapAdmin.updatePipelineEntry('p1', { companyId: 'acme' });

		assert.deepEqual(JSON.parse(api.requests[0].body ?? ''), {});
	});

	test('updatePipelineEntry returns null on a non-2xx response', async () => {
		api.respondWith(400, { message: 'Unknown stage' });
		assert.equal(await GleapAdmin.updatePipelineEntry('p1', { companyId: 'acme', stageId: 'nope' }), null);
	});

	test('getPipelineEntry returns the entry on 200 and null on 404', async () => {
		api.respondWith(200, { id: 'e1' });
		assert.deepEqual(await GleapAdmin.getPipelineEntry('p1', { companyId: 'acme' }), { id: 'e1' });
		assert.equal(api.requests[0].method, 'GET');

		api.respondWith(404, { message: 'Record is not on this pipeline' });
		assert.equal(await GleapAdmin.getPipelineEntry('p1', { companyId: 'acme' }), null);
	});

	test('removePipelineEntry returns true on success and false on error', async () => {
		api.respondWith(200, {});
		assert.equal(await GleapAdmin.removePipelineEntry('p1', { userId: 'user-1' }), true);
		const arg = api.requests[0];
		assert.equal(arg.method, 'DELETE');
		assert.equal(arg.path, '/admin/pipelines/p1/contacts/user-1');

		api.respondWith(500, {});
		assert.equal(await GleapAdmin.removePipelineEntry('p1', { userId: 'user-1' }), false);
	});

	test('an invalid target never issues a request', async () => {
		// Neither companyId nor userId.
		assert.equal(await GleapAdmin.addPipelineEntry('p1', {}), null);
		assert.equal(await GleapAdmin.updatePipelineEntry('p1', {}), null);
		// Both at once is ambiguous.
		assert.equal(await GleapAdmin.updatePipelineEntry('p1', { companyId: 'acme', userId: 'user-1' }), null);
		// Missing pipelineId.
		assert.equal(await GleapAdmin.addPipelineEntry('', { companyId: 'acme' }), null);
		assert.equal(await GleapAdmin.getPipelineEntry('', { companyId: 'acme' }), null);
		assert.equal(await GleapAdmin.removePipelineEntry('', { userId: 'user-1' }), false);
		assert.equal(api.requests.length, 0);
	});
});
