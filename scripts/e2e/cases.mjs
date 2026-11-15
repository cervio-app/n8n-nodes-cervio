/**
 * The end-to-end cases. Each group runs real n8n workflows with the Cervio node
 * against the tenant, then checks the result through Cervio's REST API too.
 * docs/e2e.md lists them with what to look at in Cervio.
 */
import { check, equal, output } from './harness.mjs';

const BLOCKED = /link-local|cloud-metadata/;

export async function runCases({ suite, n8n, cervio, credential, fx, config, owner }) {
	const { test } = suite;
	const node = (name, parameters, extra = {}) => ({
		name,
		type: n8n.nodeType,
		credentials: { cervioApi: credential },
		parameters,
		...extra,
	});
	const start = { name: 'Start', type: 'n8n-nodes-base.manualTrigger', parameters: {} };
	const code = (name, jsCode) => ({
		name,
		type: 'n8n-nodes-base.code',
		typeVersion: 2,
		parameters: { jsCode },
	});
	const fields = (value) => ({
		mappingMode: 'defineBelow',
		value,
		matchingColumns: [],
		schema: [],
	});
	const once = { executeOnce: true };
	const tolerant = { executeOnce: true, onError: 'continueRegularOutput' };
	const people = { resource: 'record', entityId: fx.people, formName: 'default' };
	const email = (who) => `${who}-${fx.key}@example.com`;
	const tag = `[${fx.runId}]`;

	// ---------------------------------------------------------------- A. Credential
	await test(
		'A1',
		'Test credential: valid token',
		'Admin → API: the token shows a recent "last used"',
		async () => {
			const r = await n8n.testCredential(credential, {
				baseUrl: config.baseUrl,
				apiKey: config.token,
			});
			equal(r.status, 'OK', 'status');
		},
	);
	await test('A2', 'Test credential: wrong token gets a clear message', '-', async () => {
		const r = await n8n.testCredential(credential, {
			baseUrl: config.baseUrl,
			apiKey: 'cpat_wrong',
		});
		check(r.status === 'Error' && /rejected the token/.test(r.message), r.message);
	});
	await test('A3', 'Test credential: cloud metadata address is never called', '-', async () => {
		const r = await n8n.testCredential(credential, {
			baseUrl: 'http://169.254.169.254',
			apiKey: 'x',
		});
		check(r.status === 'Error' && BLOCKED.test(r.message), r.message);
	});
	await test(
		'A4',
		'Test credential: IPv6 form of the metadata address is blocked',
		'-',
		async () => {
			const r = await n8n.testCredential(credential, {
				baseUrl: 'http://[::ffff:169.254.169.254]',
				apiKey: 'x',
			});
			check(r.status === 'Error' && BLOCKED.test(r.message), r.message);
		},
	);

	// ---------------------------------------------------------------- B. Editor
	const opts = (method, params) => n8n.loadOptions(credential, method, params);
	await test(
		'B1',
		'Entity list shows the test entities',
		'Entities "n8n e2e <run> …" exist',
		async () => {
			const values = (await opts('getEntities', {})).map((o) => o.value);
			for (const id of [fx.people, fx.companies, fx.projects])
				check(values.includes(id), `missing ${id}`);
		},
	);
	await test('B2', 'Form list of People', '-', async () => {
		equal(
			(await opts('getForms', { entityId: fx.people })).map((o) => o.value),
			['default'],
			'forms',
		);
	});
	await test('B3', 'View list of People', '-', async () => {
		const views = await opts('getViews', { entityId: fx.people });
		check(views.length > 0, 'no views');
		fx.viewId = views[0].value;
	});
	await test('B4', 'Relation fields: Company, not the N:M field', '-', async () => {
		equal(
			(await opts('getRelationFields', { entityId: fx.people, formName: 'default' })).map(
				(o) => o.value,
			),
			['company_id'],
			'fields',
		);
	});
	await test('B5', 'N:M fields: Projects only', '-', async () => {
		equal(
			(await opts('getThroughFields', { entityId: fx.people, formName: 'default' })).map(
				(o) => o.value,
			),
			['projects'],
			'fields',
		);
	});
	await test('B6', 'Match fields: plain fields only', '-', async () => {
		equal(
			(await opts('getMatchFields', { entityId: fx.people, formName: 'default' }))
				.map((o) => o.value)
				.sort(),
			['email', 'name', 'status'],
			'fields',
		);
	});
	await test(
		'B7',
		'Workflow list shows the test workflow',
		'Workflows: "n8n e2e <run> Set status"',
		async () => {
			check(
				(await opts('getWorkflows', {})).some((o) => o.value === fx.workflowId),
				'missing workflow',
			);
		},
	);
	await test(
		'B8',
		'Create fields: Company is a list of the 3 companies, N:M field hidden',
		'-',
		async () => {
			const cols = await n8n.mapperFields(credential, 'getFormFieldsCreate', {
				entityId: fx.people,
				formName: 'default',
			});
			const company = cols.find((c) => c.id === 'company_id');
			equal(
				company?.options?.map((o) => o.name).sort(),
				['Acme', 'Beta', 'Gamma'],
				'company options',
			);
			check(!cols.some((c) => c.id === 'projects'), 'N:M field listed');
		},
	);
	await test('B9', 'Link fields: Year (required) and Hours, no record keys', '-', async () => {
		const cols = await n8n.mapperFields(credential, 'getJunctionFields', {
			resource: 'relation',
			operation: 'linkRecords',
			entityId: fx.people,
			formName: 'default',
			throughFieldName: 'projects',
		});
		equal(
			cols.map((c) => [c.id, c.type, c.required]),
			[
				['year', 'number', true],
				['hours', 'number', false],
			],
			'columns',
		);
	});

	// ---------------------------------------------------------------- C. Records, relations, notifications
	const input = [
		{ name: `Ada ${tag}`, email: email('ada'), company_id: fx.companyIds.Acme },
		{ name: `Bruno ${tag}`, email: email('bruno'), company_id: fx.companyIds.Beta },
		{ name: `Carla ${tag}`, email: email('carla'), company_id: fx.companyIds.Acme },
	];
	const records = await n8n.run(`Cervio e2e ${fx.runId} records`, [
		start,
		code('People data', `return ${JSON.stringify(input.map((json) => ({ json })))};`),
		node('Create people', {
			...people,
			operation: 'create',
			fields: { mappingMode: 'autoMapInputData', value: null, matchingColumns: [], schema: [] },
		}),
		node('Get person', { ...people, operation: 'get', recordId: '={{ $json.id }}' }),
		node('Update person', {
			...people,
			operation: 'update',
			recordId: "={{ $('Create people').item.json.id }}",
			fields: fields({ name: "={{ $('People data').item.json.name + ' (updated)' }}" }),
		}),
		node(
			'Stale update',
			{
				...people,
				operation: 'update',
				recordId: "={{ $('Create people').first().json.id }}",
				fields: fields({ name: 'Should not be saved' }),
				updateOptions: { expectedUpdatedAt: '2000-01-01T00:00:00Z' },
			},
			tolerant,
		),
		node(
			'Validate draft',
			{
				...people,
				operation: 'validateDraft',
				fields: fields({ name: 'Draft', email: 'draft@example.com' }),
			},
			once,
		),
		node(
			'Upsert new',
			{
				...people,
				operation: 'upsert',
				matchField: 'email',
				fields: fields({ email: email('dave'), name: `Dave ${tag}` }),
			},
			once,
		),
		node(
			'Upsert again',
			{
				...people,
				operation: 'upsert',
				matchField: 'email',
				fields: fields({ email: email('dave'), name: `Dave ${tag} (upserted)` }),
			},
			once,
		),
		node(
			'Duplicate email',
			{
				...people,
				operation: 'create',
				fields: fields({ name: 'Copy', email: email('ada').toUpperCase() }),
			},
			tolerant,
		),
		node(
			'List view first page',
			{
				resource: 'record',
				operation: 'listView',
				entityId: fx.people,
				viewId: fx.viewId,
				pageMode: 'first',
				limit: 2,
				optionsMode: 'slugs',
				relationsMode: 'uuids',
				includeCount: true,
			},
			once,
		),
		node(
			'List view all pages',
			{
				resource: 'record',
				operation: 'listView',
				entityId: fx.people,
				viewId: fx.viewId,
				pageMode: 'all',
				limit: 1,
				optionsMode: 'slugs',
				relationsMode: 'uuids',
			},
			once,
		),
		node(
			'List Acme people',
			{
				resource: 'record',
				operation: 'listRecords',
				entityId: fx.people,
				listRecordsFilters: { filter: [{ field: 'company_id', value: fx.companyIds.Acme }] },
			},
			once,
		),
		node(
			'Search companies',
			{
				resource: 'relation',
				operation: 'searchRelation',
				entityId: fx.people,
				formName: 'default',
				relationFieldName: 'company_id',
				relationQuery: 'Bet',
				relationLimit: 10,
			},
			once,
		),
		node(
			'Resolve emails',
			{
				resource: 'relation',
				operation: 'resolveRelation',
				entityId: fx.people,
				matchField: 'email',
				resolveValues: `${email('ada')}, ${email('bruno')}`,
			},
			once,
		),
		node('Invalid record ID', { ...people, operation: 'get', recordId: '../admin' }, tolerant),
		node(
			'Send to me',
			{
				resource: 'notification',
				operation: 'notifySelf',
				notificationTitle: `n8n e2e ${fx.runId}: Send to Me`,
				notificationBody: 'Test notification from the n8n node end-to-end run. Safe to ignore.',
			},
			once,
		),
		node(
			'Notify users',
			{
				resource: 'notification',
				operation: 'notifyUsers',
				notificationTitle: `n8n e2e ${fx.runId}: Notify Users`,
				notificationUserIds: { user: [{ id: owner.user_id }] },
			},
			once,
		),
		node(
			'Delete person',
			{ ...people, operation: 'delete', recordId: "={{ $('Create people').all()[2].json.id }}" },
			once,
		),
	]);
	const created = (records.nodes['Create people']?.items ?? []).map((i) => i.json.id);
	const [ada, bruno, carla] = created;
	fx.people_ids = { ada, bruno, carla };

	await test(
		'C1',
		'Create: 3 input items → 3 people, each paired with its item',
		'People: Ada, Bruno, Carla (+ Dave) with the run tag',
		async () => {
			const items = output(records, 'Create people');
			equal(
				items.map((i) => i.item),
				[0, 1, 2],
				'paired items',
			);
			check(created.every(Boolean), 'missing ids');
		},
	);
	await test('C2', 'Get: returns the saved fields, company as record ID', '-', async () => {
		const items = output(records, 'Get person');
		equal(
			items.map((i) => [i.json.email, i.json.company_id]),
			input.map((p) => [p.email, p.company_id]),
			'fields',
		);
	});
	await test(
		'C3',
		'Update: changes only the field set',
		'Ada/Bruno/Carla names end with "(updated)"',
		async () => {
			output(records, 'Update person');
			const saved = (await cervio.getRecord(fx.people, ada)).json.record;
			equal(
				[saved.data.name, saved.data.email],
				[`${input[0].name} (updated)`, input[0].email],
				'saved',
			);
		},
	);
	await test(
		'C4',
		'Update with an old "Only If Unchanged Since" is refused',
		'Ada was not renamed "Should not be saved"',
		async () => {
			const [item] = output(records, 'Stale update');
			check(item.json.error, 'no error');
			const saved = (await cervio.getRecord(fx.people, ada)).json.record;
			check(saved.data.name !== 'Should not be saved', 'stale update was saved');
			return item.json.error;
		},
	);
	await test(
		'C5',
		'Validate Draft: checks values without saving',
		'No "Draft" person exists',
		async () => {
			const [item] = output(records, 'Validate draft');
			equal(item.json.ok, true, 'ok');
			equal((await cervio.listRecords(fx.people, { name: 'Draft' })).length, 0, 'saved drafts');
		},
	);
	await test(
		'C6',
		'Create or Update: creates, then updates the same record',
		'One Dave, named "… (upserted)"',
		async () => {
			const [first] = output(records, 'Upsert new');
			const [second] = output(records, 'Upsert again');
			equal(
				[first.json.action, second.json.action, second.json.id === first.json.id],
				['created', 'updated', true],
				'upsert',
			);
			equal((await cervio.listRecords(fx.people, { email: email('dave') })).length, 1, 'Daves');
		},
	);
	await test(
		'C7',
		'Unique email (any case): duplicate refused with the rule message',
		'No "Copy" person exists',
		async () => {
			const [item] = output(records, 'Duplicate email');
			check(/Email already used \(e2e\)/.test(item.json.error ?? ''), `error: ${item.json.error}`);
			return item.json.error;
		},
	);
	await test('C8', 'List View, first page: page size, next cursor and total', '-', async () => {
		const items = output(records, 'List view first page');
		equal(items.length, 2, 'items');
		check(items[1].json._has_more === true && items[1].json._next_cursor, 'no next page marker');
		equal(items[0].json._view_count, 4, 'total');
	});
	await test('C9', 'List View, all pages: follows the pages to the end', '-', async () => {
		equal(output(records, 'List view all pages').length, 4, 'items');
	});
	await test('C10', 'List with a filter: only Acme people', '-', async () => {
		const names = output(records, 'List Acme people')
			.map((i) => i.json.name)
			.sort();
		equal(names, [`${input[0].name} (updated)`, `${input[2].name} (updated)`], 'names');
	});
	await test('C11', 'Search: finds Beta by text', '-', async () => {
		equal(
			output(records, 'Search companies').map((i) => [i.json.id, i.json.label]),
			[[fx.companyIds.Beta, 'Beta']],
			'results',
		);
	});
	await test('C12', 'Resolve Key: emails → record IDs', '-', async () => {
		const items = output(records, 'Resolve emails').map((i) => i.json.record_id);
		equal(items, [ada, bruno], 'record ids');
	});
	await test('C13', 'A record ID that is not a UUID is refused before any call', '-', async () => {
		const [item] = output(records, 'Invalid record ID');
		check(/must be a UUID/.test(item.json.error ?? ''), `error: ${item.json.error}`);
	});
	await test(
		'C14',
		'Send to Me: in-app notification for the token owner',
		`Bell: "n8n e2e ${fx.runId}: Send to Me"`,
		async () => {
			check(output(records, 'Send to me')[0].json.ok, 'not ok');
		},
	);
	await test(
		'C15',
		'Notify Users: notification to a chosen user',
		`Bell: "n8n e2e ${fx.runId}: Notify Users"`,
		async () => {
			check(output(records, 'Notify users')[0].json, 'no result');
		},
	);
	await test('C16', 'Delete: the record is gone', 'Carla is not in the People list', async () => {
		output(records, 'Delete person');
		const after = await cervio.getRecord(fx.people, carla);
		check(after.status === 404 || !after.json.record, `still readable (HTTP ${after.status})`);
	});

	// ---------------------------------------------------------------- D. N:M links
	const link = {
		resource: 'relation',
		operation: 'linkRecords',
		entityId: fx.people,
		formName: 'default',
		throughFieldName: 'projects',
		recordId: ada,
		farRecordId: fx.projectId,
	};
	const unlink = (row) => ({
		resource: 'relation',
		operation: 'unlinkRecords',
		entityId: fx.people,
		formName: 'default',
		throughFieldName: 'projects',
		recordId: ada,
		junctionRecordId: `={{ $('${row}').first().json.junction_record_id }}`,
	});
	const links = await n8n.run(`Cervio e2e ${fx.runId} links`, [
		start,
		node('Link 2026', { ...link, junctionFields: fields({ year: 2026, hours: 120 }) }),
		node('Link 2027', { ...link, junctionFields: fields({ year: 2027 }) }),
		node('Link without year', { ...link, junctionFields: fields({ hours: 5 }) }, tolerant),
		node('Unlink 2026', unlink('Link 2026'), once),
		node('Unlink 2026 again', unlink('Link 2026'), once),
	]);
	await test(
		'D1',
		'Link: creates a link row with its fields',
		'Ada → Projects: row 2026 is gone (D4), row 2027 remains',
		async () => {
			const [item] = output(links, 'Link 2026');
			equal(
				[item.json.record_id, item.json.far_record_id, item.json.data],
				[ada, fx.projectId, { year: 2026, hours: 120 }],
				'link',
			);
		},
	);
	await test('D2', 'Link the same project again: a second, separate row', '-', async () => {
		const first = output(links, 'Link 2026')[0].json.junction_record_id;
		const second = output(links, 'Link 2027')[0].json.junction_record_id;
		check(first && second && first !== second, 'same row');
	});
	await test('D3', 'Link without a required link field: Cervio’s message', '-', async () => {
		const [item] = output(links, 'Link without year');
		equal(item.json.error, 'Missing required junction fields: year', 'error');
	});
	await test(
		'D4',
		'Unlink: removes only that row',
		'Ada has one project row, year 2027',
		async () => {
			equal(output(links, 'Unlink 2026')[0].json.deleted, 1, 'deleted');
			const rows = await cervio.listRecords(fx.junction, { [fx.junctionPersonField]: ada });
			equal(
				rows.map((r) => (r.data ?? r).year),
				[2027],
				'remaining rows',
			);
		},
	);
	await test('D5', 'Unlink again: nothing to remove, safe to retry', '-', async () => {
		equal(output(links, 'Unlink 2026 again')[0].json.deleted, 0, 'deleted');
	});

	// ---------------------------------------------------------------- E. Documents
	const doc = { resource: 'document', entityId: fx.people, recordId: ada };
	const content = `Hello from the n8n node e2e run ${fx.runId}`;
	const documents = await n8n.run(`Cervio e2e ${fx.runId} documents`, [
		start,
		node('Documents before', { ...doc, operation: 'listDocuments' }, { alwaysOutputData: true }),
		code(
			'File',
			`const data = await this.helpers.prepareBinaryData(Buffer.from(${JSON.stringify(content)}), 'e2e.txt', 'text/plain'); return [{ json: {}, binary: { data } }];`,
		),
		node('Upload', {
			...doc,
			operation: 'uploadDocument',
			binaryPropertyName: 'data',
			uploadOptions: { title: `n8n e2e ${fx.runId}` },
		}),
		node('Documents after upload', { ...doc, operation: 'listDocuments' }),
		node(
			'Open',
			{
				...doc,
				operation: 'openDocument',
				documentId: "={{ $('Upload').first().json.document_id }}",
			},
			once,
		),
		node('Generate', { ...doc, operation: 'generateDocument', templateId: fx.templateId }, once),
		node('Documents at the end', { ...doc, operation: 'listDocuments' }, once),
	]);
	await test('E1', 'List documents of a record without any: no items', '-', async () => {
		const items = output(documents, 'Documents before');
		check(
			items.every((i) => Object.keys(i.json).length === 0),
			`unexpected: ${JSON.stringify(items)}`,
		);
	});
	await test(
		'E2',
		'Upload: attaches the input file',
		`Ada → Documents: "n8n e2e ${fx.runId}" (e2e.txt)`,
		async () => {
			check(output(documents, 'Upload')[0].json.document_id, 'no document id');
		},
	);
	await test('E3', 'List documents: shows the upload', '-', async () => {
		const titles = output(documents, 'Documents after upload').map((i) => i.json.name);
		equal(titles, [`n8n e2e ${fx.runId}`], 'documents');
	});
	await test('E4', 'Open: the download link returns the same file', '-', async () => {
		const url = output(documents, 'Open')[0].json.signed_url;
		check(url, 'no link');
		equal(await (await fetch(url)).text(), content, 'content');
	});
	await test(
		'E5',
		'Generate from Template: a filled Word document',
		'Ada → Documents: a generated "Badge" document',
		async () => {
			check(output(documents, 'Generate')[0].json, 'no result');
			equal(output(documents, 'Documents at the end').length, 2, 'documents');
		},
	);

	// ---------------------------------------------------------------- F. Cervio workflows
	const reason = `set by n8n e2e ${fx.runId}`;
	const started = await n8n.run(`Cervio e2e ${fx.runId} workflow start`, [
		start,
		node('Start workflow', {
			resource: 'workflow',
			operation: 'startWorkflow',
			workflowId: fx.workflowId,
			entityDataId: bruno,
			workflowDataMode: 'json',
			workflowDataJson: JSON.stringify({ reason }),
		}),
	]);
	let invocation;
	await test(
		'F1',
		'Start: starts a Cervio workflow on a record, with data',
		`Workflows → "Set status" → runs: one run on Bruno`,
		async () => {
			invocation = output(started, 'Start workflow')[0].json.invocation_id;
			check(invocation, 'no invocation id');
		},
	);
	await test(
		'F2',
		'The workflow ran: it wrote the data into the record',
		`Bruno → Status: "${reason}"`,
		async () => {
			for (let i = 0; i < 45; i++) {
				const status = (await cervio.getRecord(fx.people, bruno)).json.record?.data?.status;
				if (status === reason) return `after ~${i * 2}s`;
				await new Promise((r) => setTimeout(r, 2000));
			}
			throw new Error(
				invocation
					? 'status not set after 90s: is the workflow worker running on this tenant?'
					: 'the workflow was not started (see F1)',
			);
		},
	);
	await test('F3', 'Get Run Status: reports the run', '-', async () => {
		check(invocation, 'no run to check');
		const status = await n8n.run(`Cervio e2e ${fx.runId} workflow status`, [
			start,
			node('Run status', {
				resource: 'workflow',
				operation: 'getWorkflowRun',
				workflowId: fx.workflowId,
				runId: invocation,
			}),
		]);
		const [item] = output(status, 'Run status');
		check(Object.keys(item.json).length > 0, 'empty status');
		return JSON.stringify(item.json).slice(0, 120);
	});
}
