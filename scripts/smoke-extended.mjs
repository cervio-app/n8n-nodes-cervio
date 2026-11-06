#!/usr/bin/env node
/**
 * Extended REST smoke for Wave A/B ops. Skips when CERVIO_PAT is unset.
 * Soft-deletes the record it creates unless CERVIO_SMOKE_KEEP=1.
 * Wave B routes (upsert/resolve/…) may 404/405 until the tenant app is deployed;
 * those steps are then skipped with a warning.
 */
const BASE_RAW = (process.env.CERVIO_BASE_URL || '').trim();
if (!BASE_RAW) {
	console.error('Set CERVIO_BASE_URL=https://YOUR_TENANT.cervio.app');
	process.exit(1);
}
const BASE = BASE_RAW.replace(/\/+$/, '');
const PAT = process.env.CERVIO_PAT || '';
const ENTITY_ID =
	process.env.CERVIO_SMOKE_ENTITY_ID ||
	'be2f3bf2-effd-4d71-a4b0-dbbb69584224'; // TESTMCP on dev

if (!PAT.startsWith('cpat_')) {
	console.log('SKIP smoke-extended: set CERVIO_PAT=cpat_…');
	process.exit(0);
}

async function api(method, path, body, { allowStatuses = [] } = {}) {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${PAT}`,
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	let json;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = { raw: text };
	}
	if (!res.ok && !allowStatuses.includes(res.status)) {
		const err = new Error(
			`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`,
		);
		err.status = res.status;
		err.body = json;
		throw err;
	}
	return { status: res.status, json };
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

async function main() {
	console.log(`Smoke extended → ${BASE}`);
	await api('GET', '/api/v1/me');

	const forms = await api('GET', `/api/v1/admin/entities/${ENTITY_ID}/forms`);
	const form =
		forms.json.forms?.find((f) => f.name === 'default') || forms.json.forms?.[0];
	assert(form?.name, 'need form default on smoke entity');

	const stamp = Date.now();
	const nome = `n8n-smoke-ext-${stamp}`;
	let recordId;
	try {
		const created = await api('POST', `/api/v1/entities/${ENTITY_ID}/records`, {
			form_name: form.name,
			data: {
				nome,
				data_inizio: '2026-11-05',
				stato: 'In corso',
				budget: 1,
			},
		});
		recordId = created.json.id;
		assert(recordId, 'create id');
		console.log('created:', recordId);

		const got = await api(
			'GET',
			`/api/v1/entities/${ENTITY_ID}/records/${recordId}`,
		);
		assert(got.json.record?.id === recordId, 'get record id');

		const validated = await api(
			'POST',
			`/api/v1/entities/${ENTITY_ID}/forms/${encodeURIComponent(form.name)}/validate-draft`,
			{ data: { nome: 'draft-check', data_inizio: '2026-11-05' }, record_id: recordId },
		);
		assert(typeof validated.json.ok === 'boolean', 'validate-draft ok boolean');

		const listed = await api(
			'GET',
			`/api/v1/entities/${ENTITY_ID}/records?limit=5&offset=0`,
		);
		assert(Array.isArray(listed.json.records), 'list records array');

		const upserted = await api(
			'POST',
			`/api/v1/entities/${ENTITY_ID}/records/upsert`,
			{
				form_name: form.name,
				match_field: 'nome',
				data: {
					nome,
					data_inizio: '2026-11-05',
					stato: 'In corso',
					budget: 2,
				},
			},
			{ allowStatuses: [404, 405] },
		);
		if (upserted.status === 404 || upserted.status === 405) {
			console.log(
				`WARN upsert not available on this deploy (${upserted.status}) — deploy Wave B routes`,
			);
		} else {
			assert(upserted.json.id === recordId, 'upsert should update same id');
			assert(
				upserted.json.action === 'updated',
				`upsert action expected updated, got ${upserted.json.action}`,
			);
			console.log('upsert:', upserted.json.action);
		}

		const resolved = await api(
			'POST',
			`/api/v1/entities/${ENTITY_ID}/resolve`,
			{ match_field: 'nome', values: [nome] },
			{ allowStatuses: [404, 405] },
		);
		if (resolved.status === 404 || resolved.status === 405) {
			console.log(
				`WARN resolve not available on this deploy (${resolved.status}) — deploy Wave B routes`,
			);
		} else {
			assert(Array.isArray(resolved.json.results), 'resolve results');
			assert(
				resolved.json.results.some((r) => r.record_id === recordId),
				'resolve should find created nome',
			);
			console.log('resolve: ok');
		}

		const docs = await api(
			'GET',
			`/api/v1/entities/${ENTITY_ID}/records/${recordId}/documents`,
		);
		assert(Array.isArray(docs.json.documents), 'list documents array');

		const workflows = await api('GET', '/api/v1/admin/workflows');
		assert(Array.isArray(workflows.json.workflows), 'admin workflows list');

		const extraDelete = process.env.CERVIO_SMOKE_DELETE_ID?.trim();
		if (extraDelete) {
			const del = await api(
				'DELETE',
				`/api/v1/entities/${ENTITY_ID}/records/${extraDelete}`,
			);
			assert(del.json.ok === true, 'delete ok');
			console.log('extra delete:', extraDelete);
		}
	} finally {
		if (recordId && process.env.CERVIO_SMOKE_KEEP !== '1') {
			try {
				const delSelf = await api(
					'DELETE',
					`/api/v1/entities/${ENTITY_ID}/records/${recordId}`,
				);
				assert(delSelf.json.ok === true, 'self delete ok');
				console.log('cleaned up:', recordId);
			} catch (e) {
				console.error('cleanup failed:', e.message || e);
			}
		} else if (recordId) {
			console.log('keep record (CERVIO_SMOKE_KEEP=1):', recordId);
		}
	}

	console.log('SMOKE EXTENDED OK', { form: form.name });
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
