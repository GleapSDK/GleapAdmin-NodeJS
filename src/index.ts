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

interface PipelineStage {
	id: string;
	name: string;
	color?: string;
}

interface PipelineField {
	fieldId: string;
	label: string;
	type: string;
	currency?: string;
}

interface Pipeline {
	id: string;
	name: string;
	recordType: 'COMPANY' | 'CONTACT';
	stages: PipelineStage[];
	fields: PipelineField[];
	createdAt?: string;
	updatedAt?: string;
}

// Identifies the record an entry belongs to, by YOUR identifiers: pass exactly
// one of `companyId` (company pipelines) or `userId` (contact pipelines).
interface PipelineEntryTarget {
	companyId?: string;
	userId?: string;
}

interface PipelineEntryProperties {
	// A stage `id` from the pipeline's `stages` (see getPipelines()).
	stageId?: string;
	// Field values keyed by `fieldId` (see getPipelines()). Merged into the
	// existing values; `null` clears a field. Primitive values only.
	values?: Record<string, any>;
}

interface PipelineEntry {
	id: string;
	pipelineId: string;
	recordType: 'COMPANY' | 'CONTACT';
	companyId?: string;
	userId?: string;
	stageId: string | null;
	values: Record<string, any>;
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

	/**
	 * Builds the entry route for a target. Entries are addressed by your own
	 * identifiers — the `companyId` you pass to `updateCompany` for company
	 * pipelines, the `userId` you pass to `identify` for contact pipelines —
	 * so exactly one of the two must be set.
	 */
	private pipelineEntryPath(pipelineId: string, target: PipelineEntryTarget): string {
		if (typeof pipelineId !== 'string' || pipelineId.length === 0) {
			throw new TypeError('Please provide a valid pipelineId.');
		}

		const companyId = typeof target?.companyId === 'string' && target.companyId.length > 0 ? target.companyId : null;
		const userId = typeof target?.userId === 'string' && target.userId.length > 0 ? target.userId : null;

		const base = `/admin/pipelines/${encodeURIComponent(pipelineId)}`;
		if (companyId !== null && userId === null) {
			return `${base}/companies/${encodeURIComponent(companyId)}`;
		}
		if (userId !== null && companyId === null) {
			return `${base}/contacts/${encodeURIComponent(userId)}`;
		}

		throw new TypeError('Please provide either a companyId or a userId.');
	}

	/**
	 * Loads the project's pipelines with their stages and fields — everything
	 * needed to pick a `pipelineId`, a `stageId` and valid `values` keys for
	 * the entry calls below. Returns null if the request failed.
	 */
	async getPipelines(): Promise<Pipeline[] | null> {
		try {
			const { statusCode, data } = await httpsRequest({
				hostname: this.apiUrl,
				method: 'GET',
				path: '/admin/pipelines',
				headers: {
					'Api-Token': `${this.apiToken}`,
					'Content-Type': 'application/json',
				},
			});

			if (statusCode < 200 || statusCode >= 300) {
				throw new Error(`Unexpected status code ${statusCode}`);
			}

			return data as Pipeline[];
		} catch (exp) {
			console.log('[Gleap] Failed to load pipelines', exp);
			return null;
		}
	}

	/**
	 * Adds a company or contact to a pipeline. Pass `stageId` to pick the stage
	 * (defaults to the pipeline's first stage) and `values` to set initial
	 * field values. If the record is already on the pipeline, the existing
	 * entry is returned unchanged — adding is idempotent and never a hidden
	 * update; use `updatePipelineEntry` to also change an existing entry.
	 * A genuine add runs the pipeline's automations, exactly like the same
	 * action in the dashboard.
	 *
	 * Returns the entry, or null if the request failed.
	 */
	async addPipelineEntry(
		pipelineId: string,
		entry: PipelineEntryTarget & PipelineEntryProperties,
	): Promise<PipelineEntry | null> {
		try {
			const path = this.pipelineEntryPath(pipelineId, entry);

			const body: PipelineEntryProperties = {};
			if (entry?.stageId !== undefined) {
				body.stageId = entry.stageId;
			}
			if (entry?.values !== undefined) {
				body.values = entry.values;
			}

			const { statusCode, data } = await httpsRequest({
				hostname: this.apiUrl,
				method: 'POST',
				path,
				headers: {
					'Api-Token': `${this.apiToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			});

			if (statusCode < 200 || statusCode >= 300) {
				throw new Error(`Unexpected status code ${statusCode}`);
			}

			return data as PipelineEntry;
		} catch (exp) {
			console.log('[Gleap] Failed to add pipeline entry', exp);
			return null;
		}
	}

	/**
	 * Creates or updates a pipeline entry (create-or-update, like
	 * `updateCompany`): if the record is not on the pipeline it is added,
	 * otherwise its entry is updated. Pass `stageId` to place or move the
	 * entry (defaults to the first stage on create) and `values` to set field
	 * values — values are merged, and `null` clears a field. Stage changes and
	 * genuine adds run the pipeline's automations, exactly like the same
	 * action in the dashboard.
	 *
	 * Returns the saved entry, or null if the request failed.
	 */
	async updatePipelineEntry(
		pipelineId: string,
		entry: PipelineEntryTarget & PipelineEntryProperties,
	): Promise<PipelineEntry | null> {
		try {
			const path = this.pipelineEntryPath(pipelineId, entry);

			const body: PipelineEntryProperties = {};
			if (entry?.stageId !== undefined) {
				body.stageId = entry.stageId;
			}
			if (entry?.values !== undefined) {
				body.values = entry.values;
			}

			const { statusCode, data } = await httpsRequest({
				hostname: this.apiUrl,
				method: 'PUT',
				path,
				headers: {
					'Api-Token': `${this.apiToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			});

			if (statusCode < 200 || statusCode >= 300) {
				throw new Error(`Unexpected status code ${statusCode}`);
			}

			return data as PipelineEntry;
		} catch (exp) {
			console.log('[Gleap] Failed to update pipeline entry', exp);
			return null;
		}
	}

	/**
	 * Loads a record's entry on a pipeline. Returns null if the record is not
	 * on the pipeline or the request failed.
	 */
	async getPipelineEntry(pipelineId: string, target: PipelineEntryTarget): Promise<PipelineEntry | null> {
		try {
			const path = this.pipelineEntryPath(pipelineId, target);

			const { statusCode, data } = await httpsRequest({
				hostname: this.apiUrl,
				method: 'GET',
				path,
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

			return data as PipelineEntry;
		} catch (exp) {
			console.log('[Gleap] Failed to load pipeline entry', exp);
			return null;
		}
	}

	/**
	 * Removes a record from a pipeline. Only the pipeline membership is
	 * deleted — the company or contact itself is untouched. Returns true on
	 * success.
	 */
	async removePipelineEntry(pipelineId: string, target: PipelineEntryTarget): Promise<boolean> {
		try {
			const path = this.pipelineEntryPath(pipelineId, target);

			const { statusCode } = await httpsRequest({
				hostname: this.apiUrl,
				method: 'DELETE',
				path,
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
			console.log('[Gleap] Failed to remove pipeline entry', exp);
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
