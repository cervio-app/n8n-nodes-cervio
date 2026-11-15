/**
 * Test data on the Cervio tenant, all named after the run id so it is easy to
 * find (and to remove with `npm run e2e -- --cleanup <run id>`):
 *
 *   Companies ─┐ (N:1)          People ──(N:M, link fields: year*, hours)── Projects
 *   Acme/Beta/Gamma └─ company_id on People; People has email (unique, any case),
 *   status (written by the test workflow) and documents enabled.
 *   A Cervio workflow on People (manual start → set status) and a Word template.
 */
import { uuidIn } from './cervio.mjs';
import { docxWithText } from './docx.mjs';

export async function createFixture(cervio, runId, ownerId) {
	const key = runId.replace(/[^a-z0-9]/gi, '').toLowerCase();
	const label = (name) => `n8n e2e ${runId} ${name}`;
	const fx = { runId, key };

	async function entity(name, title, fields, displayKey) {
		const id = uuidIn(
			await cervio.mcp('create_entity_scaffold', {
				name: `n8n_e2e_${key}_${name}`,
				label: label(title),
				fields,
			}),
		);
		await cervio.mcp('update_entity', {
			entity_id: id,
			record_display_key_expression: `{{${displayKey}}}`,
		});
		return id;
	}

	async function addToForm(entityId, fieldNames) {
		await cervio.mcp('patch_form_layout', {
			entity_id: entityId,
			name: 'default',
			ops: fieldNames.map((field) => ({ op: 'add_node', node: { type: 'field', field } })),
		});
	}

	fx.companies = await entity(
		'companies',
		'Companies',
		[{ name: 'name', label: 'Name', field_type: 'text' }],
		'name',
	);
	fx.projects = await entity(
		'projects',
		'Projects',
		[{ name: 'title', label: 'Title', field_type: 'text' }],
		'title',
	);
	fx.people = await entity(
		'people',
		'People',
		[
			{ name: 'name', label: 'Name', field_type: 'text' },
			{ name: 'email', label: 'Email', field_type: 'text' },
			{ name: 'status', label: 'Status', field_type: 'text' },
		],
		'name',
	);
	await cervio.mcp('create_field', {
		entity_id: fx.people,
		name: 'company_id',
		label: 'Company',
		field_type: 'relation',
		relation_entity_id: fx.companies,
	});
	await addToForm(fx.people, ['company_id']);
	await cervio.mcp('update_entity', {
		entity_id: fx.people,
		document_management_enabled: true,
		uniqueness_rules: [
			{
				name: 'Unique email',
				field_names: ['email'],
				ignore_case: true,
				error_message: 'Email already used (e2e)',
			},
		],
	});

	// Document generation needs an explicit permission, even for administrators.
	await cervio.mcp('upsert_entity_permission', {
		entity_id: fx.people,
		principal_type: 'user',
		principal_id: ownerId,
		merge: true,
		doc_can_create: true,
		doc_can_read: true,
		doc_can_update: true,
		doc_can_generate: true,
	});

	const nm = await cervio.mcp('create_many_to_many', {
		from_entity_id: fx.people,
		to_entity_id: fx.projects,
		from_field_name: 'projects',
		from_field_label: 'Projects',
		to_field_name: 'people',
		to_field_label: 'People',
		junction_name: `n8n_e2e_${key}_assignments`,
		junction_label: label('Assignments'),
	});
	fx.junction = nm.match(/junction ([0-9a-f-]{36})/)[1];
	fx.junctionPersonField = `n8n_e2e_${key}_people_id`;
	for (const f of [
		{ name: 'year', label: 'Year', field_type: 'number', is_required: true },
		{ name: 'hours', label: 'Hours', field_type: 'number' },
	]) {
		await cervio.mcp('create_field', { entity_id: fx.junction, ...f });
	}
	await addToForm(fx.junction, ['year', 'hours']);

	fx.companyIds = {};
	for (const name of ['Acme', 'Beta', 'Gamma']) {
		fx.companyIds[name] = (await cervio.createRecord(fx.companies, { name })).id;
	}
	fx.projectId = (await cervio.createRecord(fx.projects, { title: `Project ${runId}` })).id;

	// Cervio workflow: manual start on a person → status = data.reason.
	const definition = {
		version: 1,
		nodes: [
			{
				id: 'manual-1',
				type: 'manualTrigger',
				position: { x: 0, y: 0 },
				data: {
					type: 'manualTrigger',
					label: 'Manual',
					outputKey: 'manual',
					allowedRoleNames: ['system_admin'],
				},
			},
			{
				id: 'record-1',
				type: 'recordOps',
				position: { x: 220, y: 0 },
				data: {
					type: 'recordOps',
					label: 'Set status',
					outputKey: 'set_status',
					recordOps: [
						{
							id: 'patch-1',
							type: 'record.patch',
							recordId: '{{$record.id}}',
							onConflict: 'overwrite',
							fields: [{ id: 'f1', key: 'status', value: '{{$trigger.data.reason}}' }],
						},
					],
				},
			},
			{
				id: 'end-1',
				type: 'end',
				position: { x: 440, y: 0 },
				data: { type: 'end', label: 'End', outputKey: 'end' },
			},
		],
		edges: [
			{ id: 'e1', source: 'manual-1', target: 'record-1' },
			{ id: 'e2', source: 'record-1', target: 'end-1' },
		],
		variables: [],
	};
	fx.workflowId = uuidIn(
		await cervio.mcp('create_workflow', {
			name: label('Set status'),
			entity_id: fx.people,
			is_active: true,
			definition,
			trigger_config: {
				schema_version: 1,
				triggers: [
					{
						id: 'manual',
						type: 'manual',
						enabled: true,
						node_id: 'manual-1',
						allowed_role_names: ['system_admin'],
					},
				],
			},
		}),
	);
	const published = await cervio.mcp('publish_workflow', { workflow_id: fx.workflowId });
	if (/ok"?\s*:\s*false|violation/i.test(published))
		throw new Error(`Workflow not published: ${published}`);

	// Word template on People with {{name}}.
	const template = await cervio.mcp('create_document_template', {
		entity_id: fx.people,
		name: label('Badge'),
		file_name: 'badge.docx',
		content_base64: docxWithText('Badge for {{name}}').toString('base64'),
	});
	fx.templateId = uuidIn(template);
	const fields = await cervio.mcp('list_fields', { entity_id: fx.people });
	// list_fields answers one line per field: "• <id>  <name> - <label> [type]".
	const nameFieldId = fields.match(/([0-9a-f-]{36})\s+name\s+-/)?.[1];
	if (!nameFieldId) throw new Error(`Field "name" not found on People: ${fields.slice(0, 200)}`);
	await cervio.mcp('map_template_field', {
		template_id: fx.templateId,
		placeholder_key: 'name',
		field_id: nameFieldId,
	});

	return fx;
}

/** Removes the run's records and deactivates its entities and workflow (Cervio keeps deactivated ones). */
export async function removeFixture(cervio, fx) {
	const done = [];
	for (const entityId of [fx.junction, fx.people, fx.projects, fx.companies].filter(Boolean)) {
		for (const r of await cervio.listRecords(entityId)) await cervio.deleteRecord(entityId, r.id);
		await cervio.mcp('delete_entity', { entity_id: entityId });
		done.push(entityId);
	}
	if (fx.workflowId) {
		await cervio
			.mcp('update_workflow', { workflow_id: fx.workflowId, is_active: false })
			.catch(() => undefined);
	}
	return done;
}
