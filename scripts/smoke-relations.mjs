#!/usr/bin/env node
/**
 * Relation / multivalue stress against a live Cervio tenant.
 * Requires CERVIO_PAT (system_admin with admin:read + records:read + records:write).
 *
 * Targets (dev defaults):
 *   Lab Rel Corso / Sede / Docente / Lezione / Argomento
 *   Man Rel Ordine / Cliente / Riga
 *   Engineering Projects (multi_select parent_fk)
 *
 * Prints LIMITS / GAPS assessment at the end (exit 0 if baseline N:1/1:1/1:N ok).
 */

const BASE = (process.env.CERVIO_BASE_URL || 'https://dev.cervio.app').replace(
	/\/+$/,
	'',
);
const PAT = process.env.CERVIO_PAT || '';

const IDS = {
	corso: 'cd6949af-f4bc-44ec-b5fc-9a85aee7f2f4',
	sede: 'f267f42e-6d09-4b4a-a5c4-64333835a63c',
	docente: '3d2ad017-445f-4777-881f-48787e949a0e',
	lezione: 'dae40a29-10ea-40ff-913b-eef75242657d',
	argomento: 'ee55b514-278b-4437-8aae-c10354ed308c',
	ordine: '0b0be4a0-56e0-43e0-a55c-58be68e9e981',
	cliente: 'd3fc5ea8-84f0-4522-a9df-421d0b651dca',
	riga: '79d47bd8-3cd7-43e7-ae4b-da251fb35c7d',
	engProject: 'be28d780-1987-4208-a201-84fa966ec856',
	businessUnit: 'aa7e4d20-bf0f-4aee-a64e-6b82575eefa1',
	contributor: 'c42876f3-4931-45fe-8d61-7c54846f3c18',
};

const SEED_PREFIX = 'n8n-stress-sede-';
const DROPDOWN_PROBE_LIMIT = 50;
/** Skip bulk seed when CERVIO_SKIP_SEED50=1 (faster local loops). */
const SKIP_SEED50 = process.env.CERVIO_SKIP_SEED50 === '1';

if (!PAT.startsWith('cpat_')) {
	console.error(
		'Set CERVIO_PAT=cpat_… (system_admin with admin:read + records:*).',
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
			title: 'write-schema ripete sede_id (far-edit demo) → colonne mapper duplicate',
			detail: `Lab Rel Corso default ha sede_id ×${sedeDup}. writeSchemaToMapperFields non deduplica per name.`,
		});
	}
	for (const f of throughFields) {
		findings.ok.push(
			`write-schema marca ${f.name} as through (nodo lo omette correttamente se storage=through)`,
		);
	}
	findings.missing.push({
		prio: 'P0',
		id: 'nm-link',
		title: 'N:M through non scrivibile dal nodo (né REST link_records pubblico)',
		detail:
			'Campi argomenti_tag / argomenti_livello: write_note link_records MCP. Nodo omette through; nessun op link/unlink.',
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
			`N:1 sede_id: relation-options <50 → nodo promuove a tendina (${sedeOpts.length} candidati prima dello seed)`,
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
	findings.ok.push('Create Corso con sede_id (N:1) + tutor_id (1:1) OK');

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
		'1:N: create sul figlio Lab Rel Lezione con corso_id OK (finestra lezioni sul padre non è array scrivibile)',
	);
	findings.missing.push({
		prio: 'P1',
		id: 'nested-child',
		title: 'Nessun create figlio annidato dal padre',
		detail:
			'Per 1:N serve un secondo nodo Create sull’entity figlia con FK. Nessuna op “add child under parent”.',
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
		findings.ok.push('PATCH parziale tutor_id (merge) OK');
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
				'PATCH argomenti_tag[uuid] → 200 ma valore non persistito (ignored). Nodo comunque non espone through.',
			);
		} else {
			findings.notes.push(
				`PATCH argomenti_tag ha persistito ${JSON.stringify(tagVal)} — inatteso vs write_note through.`,
			);
		}
	} else {
		findings.ok.push(
			`N:M write argomenti_tag rifiutata/errore ${nmTry.status} (allineato a write_note through)`,
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
		title: 'List view espone solo colonne della vista, non tutti i campi della maschera',
		detail:
			`Lab Rel Corso default mostra solo through (${corsoKeys.join(', ') || 'vuoto'}): sede_id/tutor_id assenti. Per Update guidato serve vista con parent_fk o GET record (non nel nodo).`,
	});

	// TESTMCP: options=both → {id,label} round-trip trap (entity already used by smoke.mjs)
	const testmcp = 'be2f3bf2-effd-4d71-a4b0-dbbb69584224';
	const tmView = await defaultViewId(testmcp);
	const tmList = await api(
		'GET',
		`/api/v1/views/${tmView}/records?limit=1&options=both&relations=both`,
	);
	const tmRow = (tmList.records || [])[0];
	const statoBoth = tmRow?.data?.stato;
	log('list-testmcp', `stato both=${JSON.stringify(statoBoth)}`);
	if (statoBoth && typeof statoBoth === 'object' && statoBoth.id) {
		const badStato = await api(
			'PATCH',
			`/api/v1/entities/${testmcp}/records/${tmRow.id}`,
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
			title: 'Default options/relations=both → oggetti non round-trip per Update',
			detail: `TESTMCP stato both=${JSON.stringify(statoBoth)}; PATCH oggetto → ${badStato.ok ? 'accepted' : badStato.status}. Quick win: default listView options=slugs + relations=uuids, o coercizione .id in update.`,
		});
		const goodStato = await api(
			'PATCH',
			`/api/v1/entities/${testmcp}/records/${tmRow.id}`,
			{ form_name: 'default', data: { stato: statoBoth.id } },
			{ allowFail: true },
		);
		if (goodStato.ok) {
			findings.ok.push('PATCH stato con slug estratto da both.id OK');
		}
	}

	// --- Man Rel Ordine ---
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
		'Man Rel Ordine: Collegamento cliente_id + figlio riga con ordine_id OK',
	);

	// --- Engineering Projects multi_select ---
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
		'Create Engineering Project con document_controllers UUID[] (replace default) OK via REST',
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
			title: 'Viste con lookup: relations=uuids non restituisce UUID scrivibili',
			detail:
				'Eng Projects default usa lookup document_controllers_display_name (nomi). List→Update multi_select impossibile senza GET record o colonna parent_fk grezza.',
		});
	}
	if (
		engRowU?.data?.project_status &&
		typeof engRowU.data.project_status === 'string'
	) {
		findings.ok.push(
			'options=slugs su fixed_list → stringa adatta al PATCH (project_status)',
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
			title: 'Nodo non espone multi_value_modes (add/replace/remove)',
			detail:
				'REST supporta multi_value_modes su parent_fk multi_select. Mapper espone array ma senza modes → solo replace implicito.',
		});
		findings.ok.push('REST multi_value_modes=add funziona (gap solo lato nodo)');
	} else {
		findings.notes.push(
			`multi_value_modes add non ok: ${addMode.status} — verificare contratto`,
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
			title: 'multi_select relation: nessuna tendina (type array, paste UUID[])',
			detail:
				'buildMapperFields salta enrichment se multi_select. UX debole per liste piccole di contributor.',
		});
	}

	// --- soglia 50 sedi ---
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
				title: 'Soglia tendina relation = 50 (API consente fino a 100; no search q= in nodo)',
				detail:
					`Con ≥50 sedi relation-options restituisce ${nOpts}. Nodo: tendina solo se <50, altrimenti “incolla UUID”. Migliorabile: alzare a 100 e/o search interattiva.`,
			});
			findings.ok.push(
				'Comportamento ≥50 candidati confermato (niente tendina nel nodo)',
			);
		} else {
			findings.notes.push(
				`Dopo seed, options=${nOpts} <50 — countApprox può sottostimare; verificare vista/ACL`,
			);
		}
	} else {
		findings.notes.push('CERVIO_SKIP_SEED50=1 — soglia 50 non riesercitata');
	}

	// --- other known limits (static, from code) ---
	findings.limits.push({
		prio: 'P2',
		id: 'max-pages',
		title: 'listView pageMode=all: max 10 pagine × 500 = 5000 righe',
		detail: 'MAX_PAGES/MAX_PAGE_LIMIT in GenericFunctions.ts — ok per automation tipiche; documentare truncazione.',
	});
	findings.missing.push({
		prio: 'P1',
		id: 'relation-search',
		title: 'Nessuna search relation interattiva in n8n',
		detail:
			'relation-options è design-time first page. Per anagrafiche grandi serve paste UUID o alzare/ricercare.',
	});
	findings.missing.push({
		prio: 'P2',
		id: 'admin-forms-views',
		title: 'LoadOptions forms/views via /api/v1/admin/…',
		detail:
			'Token non system_admin: tendine entity/form/view fragili anche se write-schema assegnato funzionerebbe.',
	});
	findings.opts.push({
		prio: 'P1',
		id: 'through-help',
		title: 'Help text: campi through omessi / crea figlio sull’altra entity',
		detail:
			'Utente non vede argomenti_tag e non sa perché. Notice in description del nodo o README.',
	});

	printAssessment();
	console.log('SMOKE RELATIONS OK');
}

function printAssessment() {
	console.log('\n========== ASSESSMENT ==========');
	console.log('\n## OK / confermati');
	for (const x of findings.ok) console.log(`- ${x}`);

	console.log('\n## Mancanze');
	for (const x of findings.missing) {
		console.log(`- [${x.prio}] ${x.id}: ${x.title}`);
		console.log(`  ${x.detail}`);
	}

	console.log('\n## Limiti migliorabili');
	for (const x of findings.limits) {
		console.log(`- [${x.prio}] ${x.id}: ${x.title}`);
		console.log(`  ${x.detail}`);
	}

	console.log('\n## Ottimizzazioni');
	for (const x of findings.opts) {
		console.log(`- [${x.prio}] ${x.id}: ${x.title}`);
		console.log(`  ${x.detail}`);
	}

	if (findings.notes.length) {
		console.log('\n## Note');
		for (const x of findings.notes) console.log(`- ${x}`);
	}
	console.log('================================\n');
}

main().catch((e) => {
	console.error(e.message || e);
	process.exit(1);
});
