/* eslint-disable no-console */
/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable no-underscore-dangle */
import { httpsPost } from './httpclient';

interface UserProperties {
	name?: string;
	email?: string;
	value?: number;
	phone?: string;
}

interface Event {
	userId: string;
	name: string;
	date: Date;
	data: any;
}

export class GleapAdmin {
	private static _instance = new GleapAdmin();

	apiToken = '';

	apiUrl = 'api.gleap.io';

	initialized = false;

	trackingCache: Event[] = [];

	sendEventsInterval: any = null;

	private constructor() {}

	static get instance() {
		return this._instance;
	}

	trackEvent(userId: string, event: string, data?: any) {
		try {
			if (typeof userId !== 'string' || userId.length === 0 || typeof event !== 'string' || event.length === 0) {
				throw new TypeError('Please provide a valid userId and event name.');
			}

			this.trackingCache.push({
				userId,
				name: event,
				date: new Date(),
				data,
			});
		} catch (exp) {}
	}

	async identify(userId: string, properties: UserProperties) {
		try {
			if (typeof userId !== 'string' || userId.length === 0) {
				throw new TypeError('Please provide a valid userId.');
			}

			if (typeof properties !== 'object') {
				throw new TypeError('Please provide a valid user properties object.');
			}

			await httpsPost({
				hostname: this.apiUrl,
				path: '/admin/identify',
				headers: {
					'Api-Token': `${this.apiToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userId,
					...properties,
				}),
			});

			return true;
		} catch (exp) {
			console.log('[Gleap] Failed to identify user', exp);
			return false;
		}
	}

	async sendEvents() {
		try {
			if (!this.initialized) {
				return;
			}
			if (this.trackingCache && this.trackingCache.length > 0) {
				const data = JSON.stringify({
					events: this.trackingCache,
				});
				this.trackingCache = [];
				await httpsPost({
					hostname: this.apiUrl,
					path: '/admin/track',
					headers: {
						'Api-Token': `${this.apiToken}`,
						'Content-Type': 'application/json',
					},
					body: data,
				});
			}
		} catch (exp) {
			console.log('[Gleap] Error sending events', exp);
		}
	}

	initialize(apiToken: string) {
		this.stop();

		this.apiToken = apiToken;
		this.initialized = true;
		this.sendEventsInterval = setInterval(this.sendEvents.bind(this), 2500);
	}

	stop() {
		this.apiToken = '';
		this.initialized = false;
		this.trackingCache = [];
		if (this.sendEventsInterval) {
			clearInterval(this.sendEventsInterval);
		}
	}
}

export default GleapAdmin.instance;
