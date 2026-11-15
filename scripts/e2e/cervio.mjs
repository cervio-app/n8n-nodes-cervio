/**
 * Minimal Cervio client for the e2e run: REST /api/v1 to check results
 * independently of the node, and the Cervio MCP endpoint to build fixtures.
 */
export function cervioClient({ baseUrl, token }) {
	const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

	async function rest(method, path, body) {
		const res = await fetch(`${baseUrl}${path}`, {
			method,
			headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
			body: body ? JSON.stringify(body) : undefined,
		});
		const text = await res.text();
		let json;
		try {
			json = text ? JSON.parse(text) : {};
		} catch {
			json = { raw: text };
		}
		return { status: res.status, json };
	}

	let rpcId = 0;
	async function mcp(name, args) {
		const res = await fetch(`${baseUrl}/api/mcp`, {
			method: 'POST',
			headers: {
				...headers,
				'Content-Type': 'application/json',
				Accept: 'application/json, text/event-stream',
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: ++rpcId,
				method: 'tools/call',
				params: { name, arguments: args },
			}),
		});
		const text = await res.text();
		const payload = text.includes('data:')
			? text
					.split('\n')
					.filter((l) => l.startsWith('data:'))
					.map((l) => l.slice(5))
					.join('')
			: text;
		let json;
		try {
			json = JSON.parse(payload);
		} catch {
			throw new Error(`MCP ${name}: HTTP ${res.status} ${text.slice(0, 200)}`);
		}
		const message =
			json.result?.content?.map((c) => c.text).join('\n') ?? json.error?.message ?? '';
		if (json.result?.isError || json.error) throw new Error(`MCP ${name}: ${message}`);
		return message;
	}

	return {
		rest,
		mcp,
		me: async () => (await rest('GET', '/api/v1/me')).json,
		getRecord: async (entityId, recordId) =>
			rest('GET', `/api/v1/entities/${entityId}/records/${recordId}`),
		listRecords: async (entityId, filters = {}) => {
			const qs = new URLSearchParams({ limit: '500' });
			for (const [k, v] of Object.entries(filters)) qs.set(`filter[${k}]`, `eq.${v}`);
			return (await rest('GET', `/api/v1/entities/${entityId}/records?${qs}`)).json.records ?? [];
		},
		createRecord: async (entityId, data) =>
			(await rest('POST', `/api/v1/entities/${entityId}/records`, { form_name: 'default', data }))
				.json,
		deleteRecord: async (entityId, recordId) =>
			rest('DELETE', `/api/v1/entities/${entityId}/records/${recordId}`),
	};
}

/** First UUID in a text (MCP tools answer in prose). */
export function uuidIn(text) {
	return text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
}
