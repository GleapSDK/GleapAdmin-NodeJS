import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import GleapAdmin from '../index';
import { fakeGleapApi } from './support/fakeGleapApi';

// The Gleap API is faked at Node's http boundary, so these tests never hit the live API.
const api = fakeGleapApi();
after(() => api.restore());

describe('GleapAdmin companies', () => {
	before(() => {
		GleapAdmin.initialize('test-token');
	});

	after(() => {
		GleapAdmin.stop();
	});

	beforeEach(() => {
		api.reset();
	});

	test('updateCompany PUTs whitelisted attributes to the company endpoint', async () => {
		api.respondWith(200, { companyId: 'acme', name: 'Acme' });

		const company = await GleapAdmin.updateCompany('acme', { name: 'Acme', plan: 'pro', sla: 3600 });

		assert.equal(api.requests.length, 1);
		const arg = api.requests[0];
		assert.equal(arg.method, 'PUT');
		assert.equal(arg.path, '/admin/companies/acme');
		assert.equal(arg.headers['Api-Token'], 'test-token');
		assert.deepEqual(JSON.parse(arg.body ?? ''), { name: 'Acme', plan: 'pro', sla: 3600 });
		assert.deepEqual(company, { companyId: 'acme', name: 'Acme' });
	});

	test('updateCompany url-encodes the companyId', async () => {
		api.respondWith(200, {});

		await GleapAdmin.updateCompany('acme/inc corp', { plan: 'x' });

		assert.equal(api.requests[0].path, '/admin/companies/acme%2Finc%20corp');
	});

	test('updateCompany returns null on a non-2xx response', async () => {
		api.respondWith(500, {});
		assert.equal(await GleapAdmin.updateCompany('acme', { plan: 'x' }), null);
	});

	test('getCompany returns the company on 200', async () => {
		api.respondWith(200, { companyId: 'acme' });

		const company = await GleapAdmin.getCompany('acme');

		assert.equal(api.requests[0].method, 'GET');
		assert.deepEqual(company, { companyId: 'acme' });
	});

	test('getCompany returns null on 404', async () => {
		api.respondWith(404, { message: 'Company not found' });
		assert.equal(await GleapAdmin.getCompany('missing'), null);
	});

	test('deleteCompany returns true on success and false on error', async () => {
		api.respondWith(200, {});
		assert.equal(await GleapAdmin.deleteCompany('acme'), true);
		assert.equal(api.requests[0].method, 'DELETE');

		api.respondWith(500, {});
		assert.equal(await GleapAdmin.deleteCompany('acme'), false);
	});

	test('an empty companyId never issues a request', async () => {
		assert.equal(await GleapAdmin.updateCompany('', { name: 'x' }), null);
		assert.equal(await GleapAdmin.getCompany(''), null);
		assert.equal(await GleapAdmin.deleteCompany(''), false);
		assert.equal(api.requests.length, 0);
	});
});

describe('GleapAdmin identify company association', () => {
	before(() => {
		GleapAdmin.initialize('test-token');
	});

	after(() => {
		GleapAdmin.stop();
	});

	beforeEach(() => {
		api.reset();
	});

	test('identify flattens company { id, name } to companyId / companyName', async () => {
		await GleapAdmin.identify('user-1', {
			name: 'John Doe',
			company: { id: 'acme', name: 'Acme Inc.' },
		});

		const body = JSON.parse(api.requests[0].body ?? '');
		assert.equal(body.companyId, 'acme');
		assert.equal(body.companyName, 'Acme Inc.');
		assert.equal(body.company, undefined);
		assert.equal(body.userId, 'user-1');
		assert.equal(body.name, 'John Doe');
	});

	test('identify omits company fields when no association is given', async () => {
		await GleapAdmin.identify('user-2', { email: 'john@doe.io' });

		const body = JSON.parse(api.requests[0].body ?? '');
		assert.equal(body.companyId, undefined);
		assert.equal(body.companyName, undefined);
	});
});
