import { httpsPost, httpsRequest } from './httpclient';

interface UserProperties {
	name?: string;
	email?: string;
	value?: number;
	phone?: string;
	customData?: object;
	// Associates the user with a company. Only the company `id` is required; the
	// optional `name` is a fallback label that never overwrites a name you set
	// authoritatively via `updateCompany`.
	company?: {
		id: string;
		name?: string;
	};
}

interface CompanyAddress {
	line1?: string;
	line2?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	country?: string;
}

// Authoritative company attributes settable from your backend via
// `updateCompany`. `companyId` is not part of this object — it is the immutable
// key passed separately.
interface CompanyProperties {
	name?: string;
	plan?: string;
	domain?: string;
	value?: number;
	sla?: number; // Response-time SLA in seconds.
	address?: CompanyAddress;
	customData?: object;
}

interface Company {
	companyId: string;
	name?: string;
	plan?: string;
	domain?: string;
	value?: number;
	sla?: number;
	address?: CompanyAddress;
	customData?: Record<string, any>;
	createdAt?: string;
	updatedAt?: string;
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
		} catch {
			// Tracking is best-effort; never throw from the caller's flow.
		}
	}

	async identify(userId: string, properties: UserProperties) {
		try {
			if (typeof userId !== 'string' || userId.length === 0) {
				throw new TypeError('Please provide a valid userId.');
			}

			if (typeof properties !== 'object') {
				throw new TypeError('Please provide a valid user properties object.');
			}

			let dataToSend: any = {
				...properties,
			};

			// Flatten the optional company association into the flat
			// companyId / companyName fields the identify endpoint expects.
			if (properties.company) {
				delete dataToSend.company;
				if (properties.company.id) {
					dataToSend.companyId = properties.company.id;
				}
				if (properties.company.name) {
					dataToSend.companyName = properties.company.name;
				}
			}

			if (properties.customData) {
				delete dataToSend.customData;

				dataToSend = {
					...dataToSend,
					...properties.customData,
				};
			}

			await httpsPost({
				hostname: this.apiUrl,
				path: '/admin/identify',
				headers: {
					'Api-Token': `${this.apiToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					...dataToSend,
					userId,
				}),
			});

			return true;
		} catch (exp) {
			console.log('[Gleap] Failed to identify user', exp);
			return false;
		}
	}

	/**
	 * Creates or updates a company and sets the provided attributes
	 * authoritatively. Attributes you set here (name, plan, value, SLA,
	 * address, custom data) are never overwritten by the fallback data sent
	 * from the client / identify calls. `companyId` is your own immutable
	 * identifier for the company and cannot be changed afterwards.
	 *
	 * Returns the saved company, or null if the request failed.
	 */
	async updateCompany(companyId: string, properties: CompanyProperties = {}): Promise<Company | null> {
		try {
			if (typeof companyId !== 'string' || companyId.length === 0) {
				throw new TypeError('Please provide a valid companyId.');
			}

			if (typeof properties !== 'object' || properties === null) {
				throw new TypeError('Please provide a valid company properties object.');
			}

			const { statusCode, data } = await httpsRequest({
				hostname: this.apiUrl,
				method: 'PUT',
				path: `/admin/companies/${encodeURIComponent(companyId)}`,
				headers: {
					'Api-Token': `${this.apiToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(properties),
			});

			if (statusCode < 200 || statusCode >= 300) {
				throw new Error(`Unexpected status code ${statusCode}`);
			}

			return data as Company;
		} catch (exp) {
			console.log('[Gleap] Failed to update company', exp);
			return null;
		}
	}

	/**
	 * Loads a company by its id. Returns the company, or null if it does not
	 * exist or the request failed.
	 */
	async getCompany(companyId: string): Promise<Company | null> {
		try {
			if (typeof companyId !== 'string' || companyId.length === 0) {
				throw new TypeError('Please provide a valid companyId.');
			}

			const { statusCode, data } = await httpsRequest({
				hostname: this.apiUrl,
				method: 'GET',
				path: `/admin/companies/${encodeURIComponent(companyId)}`,
				headers: {
					'Api-Token': `${this.apiToken}`,
					'Content-Type': 'application/json',
				},
			});

			if (statusCode === 404) {
				return null;
			}

			if (statusCode < 200 || statusCode >= 300) {
				throw new Error(`Unexpected status code ${statusCode}`);
			}

			return data as Company;
		} catch (exp) {
			console.log('[Gleap] Failed to load company', exp);
			return null;
		}
	}

	/**
	 * Permanently deletes a company. This does not delete its members
	 * (contacts) or their conversations. Returns true on success.
	 */
	async deleteCompany(companyId: string): Promise<boolean> {
		try {
			if (typeof companyId !== 'string' || companyId.length === 0) {
				throw new TypeError('Please provide a valid companyId.');
			}

			const { statusCode } = await httpsRequest({
				hostname: this.apiUrl,
				method: 'DELETE',
				path: `/admin/companies/${encodeURIComponent(companyId)}`,
				headers: {
					'Api-Token': `${this.apiToken}`,
					'Content-Type': 'application/json',
				},
			});

			if (statusCode < 200 || statusCode >= 300) {
				throw new Error(`Unexpected status code ${statusCode}`);
			}

			return true;
		} catch (exp) {
			console.log('[Gleap] Failed to delete company', exp);
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
