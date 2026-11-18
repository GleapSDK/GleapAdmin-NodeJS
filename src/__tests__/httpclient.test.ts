import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';

import { request } from '../httpclient';

// The http client over a real socket: a local server stands in for the Gleap API and answers by path.
describe('httpclient request', () => {
	let server: Server;
	let port: number;
	const received: { method?: string; url?: string; body: string }[] = [];

	before(async () => {
		server = createServer((incoming, response) => {
			const chunks: Buffer[] = [];
			incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
			incoming.on('end', () => {
				received.push({ method: incoming.method, url: incoming.url, body: Buffer.concat(chunks).toString('utf8') });
				if (incoming.url === '/json') {
					response.writeHead(404, { 'Content-Type': 'application/json' });
					response.end(JSON.stringify({ message: 'Company not found' }));
					return;
				}
				response.writeHead(200, { 'Content-Type': 'text/plain' });
				response.end('OK');
			});
		});
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		port = (server.address() as AddressInfo).port;
	});

	after(() => {
		server.close();
	});

	test('resolves with the status code and the parsed JSON body, also for an error status', async () => {
		const result = await request({ protocol: 'http:', hostname: '127.0.0.1', port, method: 'GET', path: '/json' });

		assert.deepEqual(result, { statusCode: 404, data: { message: 'Company not found' } });
	});

	test('resolves with the text of a body that is not JSON', async () => {
		const result = await request({ protocol: 'http:', hostname: '127.0.0.1', port, path: '/text', body: '{"a":1}' });

		assert.deepEqual(result, { statusCode: 200, data: 'OK' });
		assert.deepEqual(received[received.length - 1], { method: 'POST', url: '/text', body: '{"a":1}' });
	});

	test('rejects when the server cannot be reached', async () => {
		const closed = createServer();
		await new Promise<void>(resolve => closed.listen(0, '127.0.0.1', resolve));
		const closedPort = (closed.address() as AddressInfo).port;
		await new Promise(resolve => closed.close(resolve));

		await assert.rejects(request({ protocol: 'http:', hostname: '127.0.0.1', port: closedPort, path: '/' }), {
			code: 'ECONNREFUSED',
		});
	});
});
