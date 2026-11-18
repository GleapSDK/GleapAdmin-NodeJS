// The Gleap API, faked at Node's http boundary: while installed, http.request and https.request record what the SDK
// sends and answer with the response set by respondWith. The SDK's own code, httpclient.ts included, runs unchanged
// and nothing reaches the network.
import { EventEmitter } from 'node:events';
import http from 'node:http';
import https from 'node:https';
import { PassThrough } from 'node:stream';
import { mock } from 'node:test';

export type SentRequest = {
	protocol: string;
	hostname: string;
	port: string | undefined;
	method: string;
	path: string;
	headers: Record<string, string>;
	body: string | undefined;
};

type Answer = { statusCode: number; data: unknown };

const OK: Answer = { statusCode: 200, data: {} };

export const fakeGleapApi = () => {
	const requests: SentRequest[] = [];
	let answer = OK;

	const fakeRequest = (options: any, onResponse: (response: PassThrough & { statusCode: number }) => void) => {
		const chunks: Buffer[] = [];
		const request = Object.assign(new EventEmitter(), {
			write: (chunk: string | Buffer) => chunks.push(Buffer.from(chunk)) > 0,
			end: () => {
				const { protocol, hostname, port, method, path, headers } = options;
				const body = chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : undefined;
				requests.push({ protocol, hostname, port, method, path, headers, body });
				const response = Object.assign(new PassThrough(), { statusCode: answer.statusCode });
				const payload = JSON.stringify(answer.data);
				setImmediate(() => {
					onResponse(response);
					response.end(payload);
				});
			},
		});
		return request;
	};

	mock.method(http, 'request', fakeRequest);
	mock.method(https, 'request', fakeRequest);

	return {
		requests,
		respondWith: (statusCode: number, data: unknown) => {
			answer = { statusCode, data };
		},
		reset: () => {
			requests.length = 0;
			answer = OK;
		},
		restore: () => mock.restoreAll(),
	};
};
