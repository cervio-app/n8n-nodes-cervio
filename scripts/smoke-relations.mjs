#!/usr/bin/env node
/**
 * Relation / multivalue stress against a live Cervio tenant.
 * Requires CERVIO_BASE_URL + CERVIO_PAT + entity UUID env vars (see .env.example).
 * (system_admin with admin:read + records:read + records:write).
 *
 * Covers parent_fk / 1:N / N:M / multi_select shapes you configure via env.
 * Optional CERVIO_SMOKE_ENTITY_ID enables the options=both round-trip probe.
 *
 * Prints LIMITS / GAPS assessment at the end (exit 0 if baseline N:1/1:1/1:N ok).
 */

import { optionalEnv, requireEnv, requireEnvs } from './smoke-env.mjs';

const BASE = requireEnv('CERVIO_BASE_URL').replace(/\/+$/, '');
const PAT = requireEnv('CERVIO_PAT');

const envIds = requireEnvs([
	'CERVIO_SMOKE_CORSO_ID',
	'CERVIO_SMOKE_SEDE_ID',
	'CERVIO_SMOKE_DOCENTE_ID',
	'CERVIO_SMOKE_LEZIONE_ID',
	'CERVIO_SMOKE_ARGOMENTO_ID',
	'CERVIO_SMOKE_ORDINE_ID',
	'CERVIO_SMOKE_CLIENTE_ID',
	'CERVIO_SMOKE_RIGA_ID',
	'CERVIO_SMOKE_ENG_PROJECT_ID',
	'CERVIO_SMOKE_BUSINESS_UNIT_ID',
	'CERVIO_SMOKE_CONTRIBUTOR_ID',
]);

const IDS = {
	corso: envIds.CERVIO_SMOKE_CORSO_ID,
	sede: envIds.CERVIO_SMOKE_SEDE_ID,
	docente: envIds.CERVIO_SMOKE_DOCENTE_ID,
	lezione: envIds.CERVIO_SMOKE_LEZIONE_ID,
	argomento: envIds.CERVIO_SMOKE_ARGOMENTO_ID,
	ordine: envIds.CERVIO_SMOKE_ORDINE_ID,
	cliente: envIds.CERVIO_SMOKE_CLIENTE_ID,
	riga: envIds.CERVIO_SMOKE_RIGA_ID,
	engProject: envIds.CERVIO_SMOKE_ENG_PROJECT_ID,
	businessUnit: envIds.CERVIO_SMOKE_BUSINESS_UNIT_ID,
	contributor: envIds.CERVIO_SMOKE_CONTRIBUTOR_ID,
};

const OPTIONS_PROBE_ENTITY = optionalEnv('CERVIO_SMOKE_ENTITY_ID');

const SEED_PREFIX = 'n8n-stress-sede-';
const DROPDOWN_PROBE_LIMIT = 50;
/** Skip bulk seed when CERVIO_SKIP_SEED50=1 (faster local loops). */
const SKIP_SEED50 = process.env.CERVIO_SKIP_SEED50 === '1';

if (!PAT.startsWith('cpat_')) {
	console.error(
		'CERVIO_PAT must be a Personal Access Token (cpat_…; system_admin with admin:read + records:*).',
	);
	process.exit(1);
}

const findings = {
	ok: [],
	missing: [],
	limits: [],
	opts: [],
	notes: [],
};

async function api(method, path, body, { allowFail = false } = {}) {
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
		if (allowFail) return { ok: false, status: res.status, body: json };
		throw err;
	}
	return allowFail ? { ok: true, status: res.status, body: json } : json;
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function log(step, msg) {
	console.log(`[${step}] ${msg}`);
}

async function defaultViewId(entityId) {
	const views = await api('GET', `/api/v1/admin/entities/${entityId}/views`);
	const view = (views.views || []).find((v) => v.name === 'default');
	assert(view?.id, `default view missing for ${entityId}`);
	return view.id;
}

async function listEntityRecords(entityId, { limit = 50 } = {}) {
	const res = await api(
		'GET',
		`/api/v1/entities/${entityId}/records?limit=${limit}`,
	);
	return res.records || res.data || [];
}

async function countApprox(entityId) {
	try {
		const res = await api(
			'GET',
			`/api/v1/entities/${entityId}/records/count`,
		);
		if (typeof res.count === 'number') return res.count;
	} catch {
		/* fall through */
	}
	const rows = await listEntityRecords(entityId, { limit: 200 });
	return rows.length;
}

async function relationOptions(entityId, formName, fieldName, limit = 50) {
	return api(
		'GET',
		`/api/v1/entities/${entityId}/forms/${encodeURIComponent(formName)}/fields/${encodeURIComponent(fieldName)}/relation-options?limit=${limit}`,
	);
}

async function ensureFixture(entityId, formName, matchField, data) {
	const rows = await listEntityRecords(entityId, { limit: 100 });
	const found = rows.find((r) => {
		const d = r.data || r;
		return d[matchField] === data[matchField];
	});
	if (found) return found.id || found.record?.id;
	const created = await api('POST', `/api/v1/entities/${entityId}/records`, {
		form_name: formName,
		data,
	});
	return created.id;
}

async function main() {
	const stamp = Date.now();
	console.log(`Relation smoke → ${BASE}`);

	const me = await api('GET', '/api/v1/me');
	log('me', `${me.email || '(pat)'} org=${me.organization_id}`);

	// --- write-schema mapper surface ---
	const schema = await api(
		'GET',
		`/api/v1/entities/${IDS.corso}/forms/default/write-schema`,
	);
	const fields = schema.fields || [];
	const byName = {};
	for (const f of fields) {
		byName[f.name] = (byName[f.name] || 0) + 1;
	}
	const throughFields = fields.filter(
		(f) => f.input?.storage === 'through' || f.storage === 'through',
	);
	const sedeDup = byName.sede_id || 0;
	log(
		'schema',
		`corso fields=${fields.length} sede_id×${sedeDup} through=${throughFields.map((f) => f.name).join(',') || 'none'}`,
	);
	if (sedeDup > 1) {
		findings.opts.push({
			prio: 'P1',
			id: 'dedup-sede_id',
			title: 'write-schema repeats sede_id (far-edit demo) → duplicate mapper columns',
			detail: `Near-entity write-schema has sede_id ×${sedeDup}. writeSchemaToMapperFields does not dedupe by name.`,
		});
	}
	for (const f of throughFields) {
		findings.ok.push(
			`write-schema marks ${f.name} as through (node correctly omits it when storage=through)`,
		);
	}
	findings.missing.push({
		prio: 'P0',
		id: 'nm-link',
		title: 'N:M through not writable from the node (nor public REST link_records)',
		detail:
			'Fields argomenti_tag / argomenti_livello: write_note link_records MCP. Node omits through; no link/unlink op.',
	});

	// --- fixtures sede / docente ---
	const sedeId = await ensureFixture(IDS.sede, 'default', 'nome', {
		nome: 'n8n-smoke-sede',
		citta: 'Test',
	});
	const tutorId = await ensureFixture(IDS.docente, 'default', 'nome', {
		nome: 'n8n-smoke-docente',
		email: 'n8n-smoke@example.com',
	});
	log('fixture', `sede=${sedeId} tutor=${tutorId}`);

	const optsSede = await relationOptions(
		IDS.corso,
		'default',
		'sede_id',
		DROPDOWN_PROBE_LIMIT,
	);
	const sedeOpts = optsSede.records || [];
	log('relation-options', `sede_id → ${sedeOpts.length} (limit ${DROPDOWN_PROBE_LIMIT})`);
	if (sedeOpts.length > 0 && sedeOpts.length < 50) {
		findings.ok.push(
			`N:1 sede_id: relation-options <50 → node promotes to dropdown (${sedeOpts.length} candidates before seed)`,
		);
	}

	// --- create corso N:1 + 1:1 ---
	const corsoNome = `n8n-rel-${stamp}`;
	const corso = await api('POST', `/api/v1/entities/${IDS.corso}/records`, {
		form_name: 'default',
		data: {
			nome: corsoNome,
			codice: `NR-${stamp}`,
			sede_id: sedeId,
			tutor_id: tutorId,
		},
	});
	assert(corso.id, 'corso create no id');
	log('create-corso', corso.id);
	findings.ok.push('Create Corso with sede_id (N:1) + tutor_id (1:1) OK');

	// --- create lezione 1:N child ---
	const lezione = await api(
		'POST',
		`/api/v1/entities/${IDS.lezione}/records`,
		{
			form_name: 'default',
			data: {
				titolo: `Lezione n8n ${stamp}`,
				data: '2026-11-05',
				ore: 2,
				corso_id: corso.id,
			},
		},
	);
	assert(lezione.id, 'lezione create no id');
	log('create-lezione', lezione.id);
	findings.ok.push(
		'1:N: create on child lezione with corso_id OK (parent lessons window is not a writable array)',
	);
	findings.missing.push({
		prio: 'P1',
		id: 'nested-child',
		title: 'No nested child create from the parent',
		detail:
			'For 1:N you need a second Create node on the child entity with the FK. No “add child under parent” op.',
	});

	// --- partial update ---
	const docenti = await listEntityRecords(IDS.docente, { limit: 10 });
	const otherTutor = docenti.find((r) => (r.id || r.record?.id) !== tutorId);
	if (otherTutor) {
		const tid = otherTutor.id || otherTutor.record?.id;
		await api('PATCH', `/api/v1/entities/${IDS.corso}/records/${corso.id}`, {
			form_name: 'default',
			data: { tutor_id: tid },
		});
		const after = await api(
			'GET',
			`/api/v1/entities/${IDS.corso}/records/${corso.id}`,
		);
		const data = after.record?.data ?? after.data ?? after;
		const got =
			typeof data.tutor_id === 'string'
				? data.tutor_id
				: data.tutor_id?.id;
		assert(got === tid, `tutor not updated: ${JSON.stringify(data.tutor_id)}`);
		findings.ok.push('Partial PATCH tutor_id (merge) OK');
	}

	// --- N:M negative ---
	const argRows = await listEntityRecords(IDS.argomento, { limit: 3 });
	const argId = argRows[0]?.id || argRows[0]?.record?.id;
	assert(argId, 'need at least one Argomento');
	const nmTry = await api(
		'PATCH',
		`/api/v1/entities/${IDS.corso}/records/${corso.id}`,
		{ form_name: 'default', data: { argomenti_tag: [argId] } },
		{ allowFail: true },
	);
	log(
		'nm-write',
		nmTry.ok
			? `accepted (unexpected) status=${nmTry.status}`
			: `rejected ${nmTry.status}: ${JSON.stringify(nmTry.body).slice(0, 180)}`,
	);
	if (nmTry.ok) {
		const afterNm = await api(
			'GET',
			`/api/v1/entities/${IDS.corso}/records/${corso.id}`,
		);
		const dNm = afterNm.record?.data ?? afterNm.data ?? afterNm;
		const tagVal = dNm.argomenti_tag;
		log('nm-verify', `argomenti_tag after PATCH=${JSON.stringify(tagVal)}`);
		if (tagVal == null || (Array.isArray(tagVal) && tagVal.length === 0)) {
			findings.notes.push(
				'PATCH argomenti_tag[uuid] → 200 but value not persisted (ignored). Node still does not expose through.',
			);
		} else {
			findings.notes.push(
				`PATCH argomenti_tag persisted ${JSON.stringify(tagVal)} — unexpected vs write_note through.`,
			);
		}
	} else {
		findings.ok.push(
			`N:M write argomenti_tag rejected/error ${nmTry.status} (aligned with write_note through)`,
		);
	}

	// --- list view shapes + round-trip (options + view column reality) ---
	const corsoViewId = await defaultViewId(IDS.corso);
	const corsoPage = await api(
		'GET',
		`/api/v1/views/${corsoViewId}/records?limit=5&options=both&relations=both`,
	);
	const corsoRow = (corsoPage.records || []).find((r) => r.id === corso.id);
	const corsoKeys = Object.keys(corsoRow?.data || {});
	log('list-corso-view', `columns in row: ${corsoKeys.join(',') || '(none)'}`);
	findings.limits.push({
		prio: 'P1',
		id: 'view-columns-only',
		title: 'List view exposes only view columns, not every form field',
		detail:
			`Near-entity default view shows (${corsoKeys.join(', ') || 'empty'}): parent_fk may be absent. Guided Update needs a view with parent_fk or GET record (not in the node).`,
	});

	// Optional: options=both → {id,label} round-trip probe (same entity as smoke.mjs)
	if (OPTIONS_PROBE_ENTITY) {
		const tmView = await defaultViewId(OPTIONS_PROBE_ENTITY);
		const tmList = await api(
			'GET',
			`/api/v1/views/${tmView}/records?limit=1&options=both&relations=both`,
		);
		const tmRow = (tmList.records || [])[0];
		const statoBoth = tmRow?.data?.stato;
		log('list-options-probe', `stato both=${JSON.stringify(statoBoth)}`);
		if (statoBoth && typeof statoBoth === 'object' && statoBoth.id) {
			const badStato = await api(
				'PATCH',
				`/api/v1/entities/${OPTIONS_PROBE_ENTITY}/records/${tmRow.id}`,
				{ form_name: 'default', data: { stato: statoBoth } },
				{ allowFail: true },
			);
			log(
				'roundtrip-options-both',
				badStato.ok
					? 'PATCH stato={id,label} accepted'
					: `PATCH stato={id,label} → ${badStato.status}`,
			);
			findings.opts.push({
				prio: 'P0',
				id: 'list-both-roundtrip',
				title:
					'Default options/relations=both → objects do not round-trip for Update',
				detail: `stato both=${JSON.stringify(statoBoth)}; PATCH object → ${badStato.ok ? 'accepted' : badStato.status}. Quick win: default listView options=slugs + relations=uuids, or coerce .id on update.`,
			});
			const goodStato = await api(
				'PATCH',
				`/api/v1/entities/${OPTIONS_PROBE_ENTITY}/records/${tmRow.id}`,
				{ form_name: 'default', data: { stato: statoBoth.id } },
				{ allowFail: true },
			);
			if (goodStato.ok) {
				findings.ok.push('PATCH stato with slug extracted from both.id OK');
			}
		}
	} else {
		log(
			'list-options-probe',
			'SKIP (set CERVIO_SMOKE_ENTITY_ID for options=both round-trip)',
		);
	}

	// --- Order / line (parent_fk + child) ---
	const clienteId = await ensureFixture(IDS.cliente, 'default', 'codice', {
		codice: `n8n-cli-${stamp}`,
		nome: `Cliente n8n ${stamp}`,
	});
	const ordine = await api(
		'POST',
		`/api/v1/entities/${IDS.ordine}/records`,
		{
			form_name: 'default',
			data: {
				codice: `ORD-${stamp}`,
				titolo: `Ordine n8n ${stamp}`,
				cliente_id: clienteId,
			},
		},
	);
	assert(ordine.id, 'ordine create failed');
	const riga = await api('POST', `/api/v1/entities/${IDS.riga}/records`, {
		form_name: 'default',
		data: {
			titolo: `Riga n8n ${stamp}`,
			qty: 3,
			ordine_id: ordine.id,
		},
	});
	assert(riga.id, 'riga create failed');
	log('man-rel', `ordine=${ordine.id} riga=${riga.id}`);
	findings.ok.push(
		'Order: link cliente_id + child riga with ordine_id OK',
	);

	// --- multi_select parent_fk ---
	const bus = await listEntityRecords(IDS.businessUnit, { limit: 1 });
	const busId = bus[0]?.id || bus[0]?.record?.id;
	const contribs = await listEntityRecords(IDS.contributor, { limit: 3 });
	const cIds = contribs
		.map((r) => r.id || r.record?.id)
		.filter(Boolean)
		.slice(0, 2);
	assert(busId && cIds.length >= 1, 'need business unit + contributor');

	const eng = await api(
		'POST',
		`/api/v1/entities/${IDS.engProject}/records`,
		{
			form_name: 'default',
			data: {
				project_name: `n8n-multi-${stamp}`,
				business_unit: busId,
				document_controllers: cIds,
				project_status: 'OPEN',
			},
		},
	);
	assert(eng.id, 'eng project create failed');
	log('eng-create', `${eng.id} controllers=${cIds.join(',')}`);
	findings.ok.push(
		'Create eng project with document_controllers UUID[] (replace default) OK via REST',
	);

	// Eng Projects view: lookup columns — labels not UUIDs even with relations=uuids
	const engViewId = await defaultViewId(IDS.engProject);
	const engBoth = await api(
		'GET',
		`/api/v1/views/${engViewId}/records?limit=10&relations=both&options=both`,
	);
	const engRow = (engBoth.records || []).find((r) => r.id === eng.id);
	const engUuids = await api(
		'GET',
		`/api/v1/views/${engViewId}/records?limit=10&relations=uuids&options=slugs`,
	);
	const engRowU = (engUuids.records || []).find((r) => r.id === eng.id);
	log(
		'list-eng',
		`both.dc_display=${JSON.stringify(engRow?.data?.document_controllers_display_name)} uuids.dc_display=${JSON.stringify(engRowU?.data?.document_controllers_display_name)} status_slugs=${JSON.stringify(engRowU?.data?.project_status)}`,
	);
	if (Array.isArray(engRowU?.data?.document_controllers_display_name)) {
		findings.opts.push({
			prio: 'P0',
			id: 'list-lookup-not-writable',
			title: 'Views with lookups: relations=uuids does not return writable UUIDs',
			detail:
				'Eng Projects default uses lookup document_controllers_display_name (names). List→Update multi_select impossible without GET record or a raw parent_fk column.',
		});
	}
	if (
		engRowU?.data?.project_status &&
		typeof engRowU.data.project_status === 'string'
	) {
		findings.ok.push(
			'options=slugs on fixed_list → string suitable for PATCH (project_status)',
		);
	}

	const addMode = await api(
		'PATCH',
		`/api/v1/entities/${IDS.engProject}/records/${eng.id}`,
		{
			form_name: 'default',
			data: {
				document_controllers: cIds.length > 1 ? [cIds[1]] : cIds,
			},
			multi_value_modes: { document_controllers: 'add' },
		},
		{ allowFail: true },
	);
	log(
		'multi_value_modes',
		addMode.ok
			? `add OK ${addMode.status}`
			: `add → ${addMode.status} ${JSON.stringify(addMode.body).slice(0, 120)}`,
	);
	if (addMode.ok) {
		findings.missing.push({
			prio: 'P0',
			id: 'multi_value_modes',
			title: 'Node does not expose multi_value_modes (add/replace/remove)',
			detail:
				'REST supports multi_value_modes on parent_fk multi_select. Mapper exposes an array but no modes → implicit replace only.',
		});
		findings.ok.push('REST multi_value_modes=add works (gap only on the node side)');
	} else {
		findings.notes.push(
			`multi_value_modes add not ok: ${addMode.status} — check contract`,
		);
	}

	const engSchema = await api(
		'GET',
		`/api/v1/entities/${IDS.engProject}/forms/default/write-schema`,
	);
	const dc = (engSchema.fields || []).find(
		(f) => f.name === 'document_controllers',
	);
	if (dc?.input?.multi_select) {
		findings.limits.push({
			prio: 'P1',
			id: 'multi-no-dropdown',
			title: 'multi_select relation: no dropdown (array type, paste UUID[])',
			detail:
				'buildMapperFields skips enrichment when multi_select. Weak UX for small contributor lists.',
		});
	}

	// --- dropdown threshold 50 seats ---
	if (!SKIP_SEED50) {
		let n = await countApprox(IDS.sede);
		log('seed50', `sede count≈${n}, target≥50`);
		const toCreate = Math.max(0, 50 - n);
		for (let i = 0; i < toCreate; i++) {
			await api('POST', `/api/v1/entities/${IDS.sede}/records`, {
				form_name: 'default',
				data: {
					nome: `${SEED_PREFIX}${stamp}-${i}`,
					citta: 'Seed',
				},
			});
			if ((i + 1) % 10 === 0) log('seed50', `created ${i + 1}/${toCreate}`);
		}
		n = await countApprox(IDS.sede);
		const afterOpts = await relationOptions(
			IDS.corso,
			'default',
			'sede_id',
			DROPDOWN_PROBE_LIMIT,
		);
		const nOpts = (afterOpts.records || []).length;
		log('seed50', `count≈${n} relation-options(limit=50)=${nOpts}`);
		if (nOpts >= 50) {
			findings.limits.push({
				prio: 'P1',
				id: 'dropdown-50',
				title: 'Relation dropdown threshold = 50 (API allows up to 100; no search q= in node)',
				detail:
					`With ≥50 seats relation-options returns ${nOpts}. Node: dropdown only if <50, otherwise “paste UUID”. Improve: raise to 100 and/or interactive search.`,
			});
			findings.ok.push(
				'≥50 candidates behaviour confirmed (no dropdown in the node)',
			);
		} else {
			findings.notes.push(
				`After seed, options=${nOpts} <50 — countApprox may undercount; check view/ACL`,
			);
		}
	} else {
		findings.notes.push('CERVIO_SKIP_SEED50=1 — threshold 50 not re-exercised');
	}

	// --- other known limits (static, from code) ---
	findings.limits.push({
		prio: 'P2',
		id: 'max-pages',
		title: 'listView pageMode=all: max 10 pages × 500 = 5000 rows',
		detail: 'MAX_PAGES/MAX_PAGE_LIMIT in GenericFunctions.ts — fine for typical automation; document truncation.',
	});
	findings.missing.push({
		prio: 'P1',
		id: 'relation-search',
		title: 'No interactive relation search in n8n',
		detail:
			'relation-options is design-time first page. For large directories paste UUID or raise limit/search.',
	});
	findings.missing.push({
		prio: 'P2',
		id: 'admin-forms-views',
		title: 'LoadOptions forms/views via /api/v1/admin/…',
		detail:
			'Non-system_admin token: entity/form/view dropdowns are fragile even if assigned write-schema would work.',
	});
	findings.opts.push({
		prio: 'P1',
		id: 'through-help',
		title: 'Help text: through fields omitted / create child on the other entity',
		detail:
			'User does not see argomenti_tag and does not know why. Notice in node description or README.',
	});

	printAssessment();
	console.log('SMOKE RELATIONS OK');
}

function printAssessment() {
	console.log('\n========== ASSESSMENT ==========');
	console.log('\n## OK / confirmed');
	for (const x of findings.ok) console.log(`- ${x}`);

	console.log('\n## Gaps');
	for (const x of findings.missing) {
		console.log(`- [${x.prio}] ${x.id}: ${x.title}`);
		console.log(`  ${x.detail}`);
	}

	console.log('\n## Improvable limits');
	for (const x of findings.limits) {
		console.log(`- [${x.prio}] ${x.id}: ${x.title}`);
		console.log(`  ${x.detail}`);
	}

	console.log('\n## Optimizations');
	for (const x of findings.opts) {
		console.log(`- [${x.prio}] ${x.id}: ${x.title}`);
		console.log(`  ${x.detail}`);
	}

	if (findings.notes.length) {
		console.log('\n## Notes');
		for (const x of findings.notes) console.log(`- ${x}`);
	}
	console.log('================================\n');
}

main().catch((e) => {
	console.error(e.message || e);
	process.exit(1);
});
