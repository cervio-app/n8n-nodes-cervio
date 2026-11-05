#!/usr/bin/env node
/**
 * Smoke against a live Cervio tenant (default: https://dev.cervio.app).
 * Requires CERVIO_PAT (system_admin with admin:read + records:read + records:write).
 *
 * Flow: me → entities → TESTMCP forms/views → create → list view (paginated) →
 * update stato → verify merge.
 */

const BASE = (process.env.CERVIO_BASE_URL || 'https://dev.cervio.app').replace(
	/\/+$/,
	'',
);
const PAT = process.env.CERVIO_PAT || '';
const ENTITY_ID =
	process.env.CERVIO_SMOKE_ENTITY_ID ||
	'be2f3bf2-effd-4d71-a4b0-dbbb69584224'; // TESTMCP on dev
/** Mirrors nodes/Cervio/GenericFunctions.ts MAX_PAGES */
const MAX_PAGES = 10;

if (!PAT.startsWith('cpat_')) {
	console.error(
		'Set CERVIO_PAT=cpat_… (system_admin with admin:read + records:*).',
	);
	process.exit(1);
}

async function api(method, path, body) {
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
	if (!res.ok) {
		const err = new Error(
			`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`,
		);
		err.status = res.status;
		err.body = json;
		throw err;
	}
	return json;
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function viewRecordsPath(viewId, qs) {
	const params = new URLSearchParams();
	for (const [k, v] of Object.entries(qs)) {
		if (v === undefined || v === null || v === '') continue;
		params.set(k, String(v));
	}
	return `/api/v1/views/${viewId}/records?${params}`;
}

/**
 * Same loop as Cervio.node listView with pageMode=all (limit + next_cursor).
 */
async function listViewAllPages(viewId, { limit = 1, options = 'both', relations = 'both' } = {}) {
	const all = [];
	let cursor;
	let pages = 0;
	let lastHasMore = false;
	let lastNextCursor;

	while (pages < MAX_PAGES) {
		const qs = { limit, options, relations };
		if (cursor) qs.cursor = cursor;
		const page = await api('GET', viewRecordsPath(viewId, qs));
		pages += 1;
		const batch = page.records || [];
		all.push(...batch);
		// REST shape: { records, page: { limit, has_more, next_cursor } }
		lastHasMore = Boolean(page.page?.has_more);
		lastNextCursor = page.page?.next_cursor || null;
		console.log(
			`  page ${pages}: ${batch.length} row(s), has_more=${lastHasMore}, next_cursor=${lastNextCursor ? 'yes' : 'no'}`,
		);
		if (!lastHasMore || !lastNextCursor) break;
		cursor = lastNextCursor;
	}

	return {
		records: all,
		pages,
		has_more: lastHasMore,
		next_cursor: lastNextCursor,
	};
}

async function main() {
	console.log(`Smoke → ${BASE}`);

	const me = await api('GET', '/api/v1/me');
	console.log('me:', me.email, me.organization_id);

	const entities = await api('GET', '/api/v1/entities');
	assert(
		(entities.entities || []).some((e) => e.id === ENTITY_ID),
		'TESTMCP entity not visible to this token',
	);

	const forms = await api('GET', `/api/v1/admin/entities/${ENTITY_ID}/forms`);
	const form = (forms.forms || []).find((f) => f.name === 'default');
	assert(form, 'form default missing');

	const views = await api('GET', `/api/v1/admin/entities/${ENTITY_ID}/views`);
	const view = (views.views || []).find((v) => v.name === 'default');
	assert(view?.id, 'view default missing');

	const schema = await api(
		'GET',
		`/api/v1/entities/${ENTITY_ID}/forms/default/write-schema`,
	);
	assert(
		(schema.fields || []).some((f) => f.name === 'stato'),
		'write-schema missing stato',
	);

	const stamp = Date.now();
	const createdIds = [];
	const nomes = [];
	// Enough rows that limit=1 must yield at least 2 pages for our batch
	for (let i = 0; i < 3; i++) {
		const nome = `n8n-smoke-${stamp}-${i}`;
		nomes.push(nome);
		const created = await api('POST', `/api/v1/entities/${ENTITY_ID}/records`, {
			form_name: 'default',
			data: {
				nome,
				data_inizio: '2026-11-05',
				stato: 'In corso',
				budget: 40 + i,
			},
		});
		assert(created.id, 'create returned no id');
		createdIds.push(created.id);
		console.log('created:', created.id, nome);
	}

	console.log('pagination simulation (pageMode=first, limit=1):');
	const firstPage = await api(
		'GET',
		viewRecordsPath(view.id, {
			limit: 1,
			options: 'both',
			relations: 'both',
		}),
	);
	assert((firstPage.records || []).length === 1, 'first page should return 1 row');
	assert(
		firstPage.page?.has_more === true,
		'expected page.has_more=true with limit=1 and ≥3 rows',
	);
	assert(firstPage.page?.next_cursor, 'expected page.next_cursor for page 2');
	console.log(
		`  page 1: id=${firstPage.records[0].id}, has_more=true, next_cursor=yes`,
	);

	const secondPage = await api(
		'GET',
		viewRecordsPath(view.id, {
			limit: 1,
			cursor: firstPage.page.next_cursor,
			options: 'both',
			relations: 'both',
		}),
	);
	assert((secondPage.records || []).length === 1, 'second page should return 1 row');
	assert(
		secondPage.records[0].id !== firstPage.records[0].id,
		'page 2 must not repeat page 1 id',
	);
	console.log(
		`  page 2: id=${secondPage.records[0].id}, has_more=${Boolean(secondPage.page?.has_more)}`,
	);

	console.log('pagination simulation (pageMode=all, limit=1, max 10 pages):');
	const allPages = await listViewAllPages(view.id, { limit: 1 });
	assert(allPages.pages >= 2, `expected ≥2 pages, got ${allPages.pages}`);
	for (const id of createdIds) {
		assert(
			allPages.records.some((r) => r.id === id),
			`created record ${id} missing from all-pages gather`,
		);
	}
	console.log(
		`  gathered ${allPages.records.length} row(s) across ${allPages.pages} page(s)`,
	);

	const primaryId = createdIds[0];
	const primaryNome = nomes[0];

	await api('PATCH', `/api/v1/entities/${ENTITY_ID}/records/${primaryId}`, {
		form_name: 'default',
		data: { stato: 'Completato' },
	});

	const after = await api(
		'GET',
		`/api/v1/entities/${ENTITY_ID}/records/${primaryId}`,
	);
	const data = after.record?.data ?? after.data ?? after;
	assert(
		data.stato === 'Completato' || data.stato?.id === 'Completato',
		`stato not updated: ${JSON.stringify(data.stato)}`,
	);
	assert(
		data.nome === primaryNome || data.nome?.label === primaryNome,
		'nome was overwritten on partial update',
	);
	console.log('update merge ok');

	console.log('SMOKE OK');
}

main().catch((e) => {
	console.error(e.message || e);
	process.exit(1);
});
