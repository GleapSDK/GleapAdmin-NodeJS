import { httpsPost } from "./http.js";

export default {
	apiToken: "",
	apiUrl: "https://api.gleap.io",
	trackingCache: {},

	track: function (userId, event, data = {}) {
		if (typeof userId !== 'string' || userId.length === 0 || typeof event !== 'string' || event.length === 0) {
			throw new TypeError(`Please provide a valid userId and event name.`);
		}

		if (this.trackingCache[userId] === undefined) {
			this.trackingCache[userId] = [];
		}

		this.trackingCache[userId].push({
			userId,
			event,
			data
		});
	},

	identify: async function (userId, properties) {
		if (typeof userId !== 'string' || userId.length === 0) {
			throw new TypeError(`Please provide a valid userId.`);
		}

		if (typeof properties !== 'object') {
			throw new TypeError(`Please provide a valid user properties object.`);
		}

		const res = await httpsPost({
			hostname: this.apiUrl,
			path: `/admin/identify`,
			headers: {
				'Api-Token': `Bearer ${this.apiToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				userId,
				...properties,
			})
		});
	},

	sendEvents: async function () {
		if (this.trackingCache) {
			for (let userId in this.trackingCache) {
				const events = this.trackingCache[userId];
				const res = await httpsPost({
					hostname: this.apiUrl,
					path: `/admin/track`,
					headers: {
						'Api-Token': `Bearer ${this.apiToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(events)
				});
			}
		}
	},

	init: function (apiToken) {
		this.apiToken = apiToken;
	}
}