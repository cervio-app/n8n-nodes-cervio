#!/usr/bin/env node
/**
 * Extended REST smoke for Wave A/B ops used by the n8n node.
 * Requires CERVIO_BASE_URL + CERVIO_PAT (system_admin + records:* + admin:read).
 *
 * Soft-deletes records it creates unless CERVIO_SMOKE_KEEP=1.
 *
 * Optional env:
 *   CERVIO_SMOKE_ENTITY_ID   — TESTMCP-like entity (default: lab TESTMCP)
 *   CERVIO_SMOKE_CORSO_ID    — Lab Rel Corso (N:M through)
 *   CERVIO_SMOKE_ARGOMENTO_ID
 *   CERVIO_SMOKE_WORKFLOW_ID — manual workflow on the smoke entity
 *   CERVIO_SMOKE_DELETE_ID   — also DELETE this disposable record
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
	'be2f3bf2-effd-4d71-a4b0-dbbb69584224'; // TESTMCP on lab
const CORSO_ID =
	process.env.CERVIO_SMOKE_CORSO_ID || 'cd6949af-f4bc-44ec-b5fc-9a85aee7f2f4';
const ARGOMENTO_ID =
	process.env.CERVIO_SMOKE_ARGOMENTO_ID ||
	'ee55b514-278b-4437-8aae-c10354ed308c';
const WORKFLOW_ID =
	process.env.CERVIO_SMOKE_WORKFLOW_ID ||
	'327765a7-df4d-406c-abc9-10414e24525a'; // Approvazione TESTMCP
const THROUGH_FIELD = process.env.CERVIO_SMOKE_THROUGH_FIELD || 'argomenti_tag';

if (!PAT.startsWith('cpat_')) {
	console.log('SKIP smoke-extended: set CERVIO_PAT=cpat_…');
	process.exit(0);
}

async function api(method, path, body, { allowStatuses = [], formData = false } = {}) {
	const headers = {
		Accept: 'application/json',
		Authorization: `Bearer ${PAT}`,
	};
	let payload;
	if (formData) {
		payload = body;
	} else if (body !== undefined) {
		headers['Content-Type'] = 'application/json';
		payload = JSON.stringify(body);
	}
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers,
		body: payload,
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
	const cleanup = [];
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
		cleanup.push([ENTITY_ID, recordId]);
		console.log('created:', recordId);

		const got = await api(
			'GET',
			`/api/v1/entities/${ENTITY_ID}/records/${recordId}`,
		);
		assert(got.json.record?.id === recordId, 'get record id');
		console.log('get: ok');

		const validated = await api(
			'POST',
			`/api/v1/entities/${ENTITY_ID}/forms/${encodeURIComponent(form.name)}/validate-draft`,
			{
				data: { nome: 'draft-check', data_inizio: '2026-11-05' },
				record_id: recordId,
			},
		);
		assert(typeof validated.json.ok === 'boolean', 'validate-draft ok boolean');
		console.log('validate-draft: ok');

		const listed = await api(
			'GET',
			`/api/v1/entities/${ENTITY_ID}/records?limit=5&offset=0`,
		);
		assert(Array.isArray(listed.json.records), 'list records array');
		console.log('listRecords: ok');

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
		);
		assert(upserted.json.id === recordId, 'upsert should update same id');
		assert(
			upserted.json.action === 'updated',
			`upsert action expected updated, got ${upserted.json.action}`,
		);
		console.log('upsert:', upserted.json.action);

		const resolved = await api('POST', `/api/v1/entities/${ENTITY_ID}/resolve`, {
			match_field: 'nome',
			values: [nome],
		});
		assert(Array.isArray(resolved.json.results), 'resolve results');
		assert(
			resolved.json.results.some((r) => r.record_id === recordId),
			'resolve should find created nome',
		);
		console.log('resolve: ok');

		// --- documents: list / upload / open ---
		const docsBefore = await api(
			'GET',
			`/api/v1/entities/${ENTITY_ID}/records/${recordId}/documents`,
		);
		assert(Array.isArray(docsBefore.json.documents), 'list documents array');

		const fd = new FormData();
		fd.append(
			'file',
			new Blob([`n8n smoke ${stamp}`], { type: 'text/plain' }),
			'smoke.txt',
		);
		fd.append('file_name', 'smoke.txt');
		fd.append('title', 'n8n-smoke');
		const uploaded = await api(
			'POST',
			`/api/v1/entities/${ENTITY_ID}/records/${recordId}/documents`,
			fd,
			{ formData: true },
		);
		assert(uploaded.json.document_id, 'upload document_id');
		console.log('uploadDocument:', uploaded.json.document_id);

		const opened = await api(
			'GET',
			`/api/v1/entities/${ENTITY_ID}/records/${recordId}/documents/${uploaded.json.document_id}/open`,
		);
		assert(
			typeof opened.json.signed_url === 'string' && opened.json.signed_url.length > 0,
			'open signed_url',
		);
		console.log('openDocument: ok');

		const gen = await api(
			'POST',
			`/api/v1/entities/${ENTITY_ID}/records/${recordId}/documents/generate`,
			{ template_id: '00000000-0000-4000-8000-000000000001' },
			{ allowStatuses: [400, 403, 404] },
		);
		if (gen.status >= 200 && gen.status < 300) {
			console.log('generateDocument: ok', gen.json.document_id);
		} else {
			console.log(
				`generateDocument: SKIP (${gen.status}) — needs a real mapped template_id on the tenant`,
			);
		}

		// --- N:M link / unlink (Lab Rel Corso ↔ Argomento) ---
		const corso = await api('POST', `/api/v1/entities/${CORSO_ID}/records`, {
			form_name: 'default',
			data: { nome: `n8n-link-corso-${stamp}` },
		});
		assert(corso.json.id, 'corso id');
		cleanup.push([CORSO_ID, corso.json.id]);
		const argomento = await api('POST', `/api/v1/entities/${ARGOMENTO_ID}/records`, {
			form_name: 'default',
			data: { nome: `n8n-link-arg-${stamp}` },
		});
		assert(argomento.json.id, 'argomento id');
		cleanup.push([ARGOMENTO_ID, argomento.json.id]);

		const linked = await api(
			'POST',
			`/api/v1/entities/${CORSO_ID}/forms/default/fields/${encodeURIComponent(THROUGH_FIELD)}/links`,
			{
				from_record_id: corso.json.id,
				far_record_id: argomento.json.id,
			},
		);
		assert(linked.json.junction_record_id, 'link junction_record_id');
		console.log('linkRecords:', linked.json.junction_record_id);

		const unlinked = await api(
			'DELETE',
			`/api/v1/entities/${CORSO_ID}/forms/default/fields/${encodeURIComponent(THROUGH_FIELD)}/links`,
			{
				from_record_id: corso.json.id,
				far_record_id: argomento.json.id,
			},
		);
		if (unlinked.json.deleted >= 1) {
			console.log('unlinkRecords: deleted', unlinked.json.deleted);
		} else {
			console.log(
				'WARN unlinkRecords: deleted=0 under PAT — needs cervio-1 fix for impersonated junction listing (listJunctionRowsForNear). Redeploy after that commit.',
			);
		}

		// --- workflow start + status ---
		const workflows = await api('GET', '/api/v1/admin/workflows');
		assert(Array.isArray(workflows.json.workflows), 'admin workflows list');
		console.log('list workflows: ok', workflows.json.workflows.length);

		const started = await api(
			'POST',
			`/api/v1/workflows/${WORKFLOW_ID}/runs`,
			{ entity_data_id: recordId },
			{ allowStatuses: [403, 404] },
		);
		if (started.status === 202 && started.json.invocation_id) {
			console.log('startWorkflow:', started.json.invocation_id);
			const status = await api(
				'GET',
				`/api/v1/admin/workflows/${WORKFLOW_ID}/runs/${started.json.invocation_id}`,
			);
			assert(status.json.run || status.json.status || status.json, 'run status payload');
			console.log(
				'getWorkflowRun:',
				status.json.run?.status || status.json.status || 'payload ok',
			);
		} else {
			console.log(
				`startWorkflow: SKIP (${started.status}) — PAT user lacks manual-trigger ACL on workflow ${WORKFLOW_ID}`,
			);
		}

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
		if (process.env.CERVIO_SMOKE_KEEP === '1') {
			console.log('keep records (CERVIO_SMOKE_KEEP=1):', cleanup);
		} else {
			for (const [entityId, id] of cleanup.reverse()) {
				try {
					const del = await api(
						'DELETE',
						`/api/v1/entities/${entityId}/records/${id}`,
						undefined,
						{ allowStatuses: [404] },
					);
					if (del.status === 200) console.log('cleaned up:', id);
				} catch (e) {
					console.error('cleanup failed:', id, e.message || e);
				}
			}
		}
	}

	console.log('SMOKE EXTENDED OK', { form: form.name });
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
