import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	ResourceMapperFields,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	countViewRecords,
	createRecord,
	deleteRecord,
	flattenRecordRow,
	generateRecordDocument,
	getRecord,
	getWorkflowRunStatus,
	getWriteSchema,
	linkThroughRecords,
	listEntities,
	listEntityRecords,
	listForms,
	listRecordDocuments,
	listViewRecords,
	listViews,
	listWorkflows,
	MAX_PAGE_LIMIT,
	MAX_PAGES,
	openRecordDocument,
	RELATION_DROPDOWN_LIMIT,
	RELATION_SEARCH_MAX_LIMIT,
	resolveNaturalKeys,
	searchRelationOptions,
	startWorkflowRun,
	unlinkThroughRecords,
	updateRecord,
	uploadRecordDocument,
	upsertRecord,
	validateDraft,
} from './GenericFunctions';
import {
	formLabelWithRole,
	pickCompiledFieldValues,
	writeSchemaToMapperFields,
	type WriteDiscoverySchema,
} from './writeSchemaMapper';

export class Cervio implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Cervio',
		name: 'cervio',
		icon: { light: 'file:cervio.mono.light.svg', dark: 'file:cervio.mono.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Records, documents, N:M relations, upsert/resolve, and workflows over REST /api/v1. Guided forms for create/update; admin list for entity records.',
		defaults: {
			name: 'Cervio',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'cervioApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Create Record',
						value: 'create',
						description: 'Create a record using the form fields',
						action: 'Create a record',
					},
					{
						name: 'Update Record',
						value: 'update',
						description:
							'Update a record by id; only mapped form fields are sent',
						action: 'Update a record',
					},
					{
						name: 'List View',
						value: 'listView',
						description:
							'Read records from a view (filters and columns come from the view)',
						action: 'List a view',
					},
					{
						name: 'Search Relation',
						value: 'searchRelation',
						description:
							'List/search candidates for a relation field (relation-options, up to 100)',
						action: 'Search relation candidates',
					},
					{
						name: 'Get Record',
						value: 'get',
						description: 'GET a record by id (fields masked by ACL)',
						action: 'Get a record',
					},
					{
						name: 'Delete Record',
						value: 'delete',
						description: 'Soft-delete the record',
						action: 'Delete a record',
					},
					{
						name: 'List Records',
						value: 'listRecords',
						description:
							'List entity records (system_admin; filters eq.field=value)',
						action: 'List entity records',
					},
					{
						name: 'Validate Draft',
						value: 'validateDraft',
						description: 'Dry-run form formulas and validation',
						action: 'Validate form draft',
					},
					{
						name: 'Upsert Record',
						value: 'upsert',
						description: 'Upsert by natural key (match_field)',
						action: 'Upsert record',
					},
					{
						name: 'List Documents',
						value: 'listDocuments',
						description: 'Metadata for documents linked to the record',
						action: 'List documents',
					},
					{
						name: 'Upload Document',
						value: 'uploadDocument',
						description: 'Multipart upload onto the record',
						action: 'Upload document',
					},
					{
						name: 'Open Document',
						value: 'openDocument',
						description: 'Signed URL for the original file',
						action: 'Open document',
					},
					{
						name: 'Generate from Template',
						value: 'generateDocument',
						description: 'Render a template into a document (admin)',
						action: 'Generate document from template',
					},
					{
						name: 'Link Records',
						value: 'linkRecords',
						description: 'N:M link (through field on the form)',
						action: 'Link N:M records',
					},
					{
						name: 'Unlink Records',
						value: 'unlinkRecords',
						description: 'Unlink N:M',
						action: 'Unlink N:M records',
					},
					{
						name: 'Resolve Key',
						value: 'resolveRelation',
						description: 'Natural-key values → record UUIDs',
						action: 'Resolve natural keys',
					},
					{
						name: 'Start Workflow',
						value: 'startWorkflow',
						description: 'Manually start a workflow on a record',
						action: 'Start workflow',
					},
					{
						name: 'Get Run Status',
						value: 'getWorkflowRun',
						description: 'Workflow run status (admin)',
						action: 'Get workflow run status',
					},
				],
				default: 'create',
			},

			// --- Shared: entity ---
			{
				displayName: 'Entity',
				name: 'entityId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getEntities',
				},
				required: true,
				default: '',
				displayOptions: {
					hide: {
						operation: ['startWorkflow', 'getWorkflowRun'],
					},
				},
				description: 'Only entities this token can read.',
			},

			// --- Create / Update: form + fields ---
			{
				displayName: 'Form',
				name: 'formName',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getForms',
					loadOptionsDependsOn: ['entityId'],
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: [
							'create',
							'update',
							'searchRelation',
							'validateDraft',
							'upsert',
							'linkRecords',
							'unlinkRecords',
						],
					},
				},
				description:
					'Fields below are from this form, not every entity field. Cervio rejects fields that are not on this form. N:M through links are omitted — create on the junction.',
			},
			{
				displayName: 'Relation Field',
				name: 'relationFieldName',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getRelationFields',
					loadOptionsDependsOn: ['entityId', 'formName'],
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['searchRelation'],
					},
				},
				description:
					'Relation field on the form (including multi-select). Does not include N:M through fields.',
			},
			{
				displayName: 'Search',
				name: 'relationQuery',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['searchRelation'],
					},
				},
				description:
					'Free text passed to relation-options?q=. Empty = first results.',
			},
			{
				displayName: 'Limit',
				name: 'relationLimit',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
				default: 50,
				displayOptions: {
					show: {
						operation: ['searchRelation'],
					},
				},
				description: 'From 1 to 100 (Cervio API cap).',
			},
			{
				displayName: 'Record ID',
				name: 'recordId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: [
							'update',
							'get',
							'delete',
							'listDocuments',
							'uploadDocument',
							'openDocument',
							'generateDocument',
							'linkRecords',
							'unlinkRecords',
						],
					},
				},
				description:
					'Record id from List view, e.g. {{ $json.id }}. Not a form field.',
			},
			{
				displayName: 'Through Field (N:M)',
				name: 'throughFieldName',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getThroughFields',
					loadOptionsDependsOn: ['entityId', 'formName'],
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['linkRecords', 'unlinkRecords'],
					},
				},
				description: 'N:M link field (through storage) on the form.',
			},
			{
				displayName: 'Far Record ID',
				name: 'farRecordId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['linkRecords', 'unlinkRecords'],
					},
				},
				description: 'UUID of the other end of the N:M link.',
			},
			{
				displayName: 'Match Field',
				name: 'matchField',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getMatchFields',
					loadOptionsDependsOn: ['entityId', 'formName'],
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['upsert', 'resolveRelation'],
					},
				},
				description: 'Unique scalar field for upsert or resolve.',
			},
			{
				displayName: 'Values to Resolve',
				name: 'resolveValues',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['resolveRelation'],
					},
				},
				description:
					'JSON array ["a","b"] or comma-separated values. Optional field_name under Options.',
			},
			{
				displayName: 'Resolve Options',
				name: 'resolveOptions',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: {
					show: {
						operation: ['resolveRelation'],
					},
				},
				options: [
					{
						displayName: 'Relation Field Name',
						name: 'fieldName',
						type: 'string',
						default: '',
						description:
							'If set, resolve against the relation field target instead of the current entity.',
					},
				],
			},
			{
				displayName: 'Filters',
				name: 'listRecordsFilters',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: {
					show: {
						operation: ['listRecords'],
					},
				},
				placeholder: 'Add filter',
				description: 'Each filter → filter[field]=eq.value (AND).',
				options: [
					{
						displayName: 'Filter',
						name: 'filter',
						values: [
							{
								displayName: 'Field',
								name: 'field',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Limit',
				name: 'listRecordsLimit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 500 },
				default: 50,
				displayOptions: {
					show: {
						operation: ['listRecords'],
					},
				},
			},
			{
				displayName: 'Offset',
				name: 'listRecordsOffset',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				displayOptions: {
					show: {
						operation: ['listRecords'],
					},
				},
			},
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['openDocument'],
					},
				},
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['generateDocument'],
					},
				},
				description: 'Document template UUID (no public REST catalog yet).',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						operation: ['uploadDocument'],
					},
				},
				description: 'Binary field on the n8n item to upload as the file.',
			},
			{
				displayName: 'Upload Options',
				name: 'uploadOptions',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: {
					show: {
						operation: ['uploadDocument'],
					},
				},
				options: [
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
					},
					{
						displayName: 'File Name',
						name: 'fileName',
						type: 'string',
						default: '',
						description: 'Default: name from the binary or upload.bin',
					},
				],
			},
			{
				displayName: 'Validate Draft Options',
				name: 'validateDraftOptions',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: {
					show: {
						operation: ['validateDraft'],
					},
				},
				options: [
					{
						displayName: 'Existing Record ID',
						name: 'recordId',
						type: 'string',
						default: '',
						description: 'Optional: merge with already saved data.',
					},
				],
			},
			{
				displayName: 'Workflow',
				name: 'workflowId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getWorkflows',
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['startWorkflow', 'getWorkflowRun'],
					},
				},
			},
			{
				displayName: 'Record ID (entity_data_id)',
				name: 'entityDataId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['startWorkflow'],
					},
				},
				description: 'UUID of the record to start the workflow on.',
			},
			{
				displayName: 'Additional Data',
				name: 'workflowData',
				type: 'json',
				default: '{}',
				displayOptions: {
					show: {
						operation: ['startWorkflow'],
					},
				},
				description: 'Optional payload passed to the manual trigger.',
			},
			{
				displayName: 'Run ID',
				name: 'runId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['getWorkflowRun'],
					},
				},
				description: 'invocation_id returned by Start Workflow.',
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'resourceMapper',
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				noDataExpression: true,
				required: true,
				displayOptions: {
					show: {
						operation: ['create'],
					},
				},
				typeOptions: {
					loadOptionsDependsOn: ['entityId', 'formName'],
					resourceMapper: {
						resourceMapperMethod: 'getFormFieldsCreate',
						mode: 'add',
						fieldWords: {
							singular: 'field',
							plural: 'fields',
						},
						addAllFields: true,
						multiKeyMatch: false,
					},
				},
				description:
					'Computed Cervio fields are omitted — the server fills them. Use “Add all fields” to start from the full form.',
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'resourceMapper',
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				noDataExpression: true,
				required: true,
				displayOptions: {
					show: {
						operation: ['update'],
					},
				},
				typeOptions: {
					loadOptionsDependsOn: ['entityId', 'formName'],
					resourceMapper: {
						resourceMapperMethod: 'getFormFieldsUpdate',
						mode: 'update',
						fieldWords: {
							singular: 'field',
							plural: 'fields',
						},
						addAllFields: true,
						multiKeyMatch: false,
					},
				},
				description:
					'Leave a field empty to leave it unchanged. At least one field must be set. PATCH merges; other values stay.',
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'resourceMapper',
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				noDataExpression: true,
				required: true,
				displayOptions: {
					show: {
						operation: ['validateDraft', 'upsert'],
					},
				},
				typeOptions: {
					loadOptionsDependsOn: ['entityId', 'formName'],
					resourceMapper: {
						resourceMapperMethod: 'getFormFieldsCreate',
						mode: 'add',
						fieldWords: {
							singular: 'field',
							plural: 'fields',
						},
						addAllFields: true,
						multiKeyMatch: false,
					},
				},
				description: 'Same form as Create Record.',
			},
			{
				displayName: 'Additional Fields',
				name: 'updateOptions',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: {
					show: {
						operation: ['update'],
					},
				},
				options: [
					{
						displayName: 'Expected Updated At',
						name: 'expectedUpdatedAt',
						type: 'string',
						default: '',
						description:
							'If someone else changed the record, Cervio returns 409. Usually leave empty.',
					},
					{
						displayName: 'Multi-Value Mode',
						name: 'multiValueModes',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						placeholder: 'Add field',
						description:
							'For multi_select relation fields: add | replace (API default) | remove. The field must be present in Fields.',
						options: [
							{
								displayName: 'Field',
								name: 'entry',
								values: [
									{
										displayName: 'Field Name',
										name: 'field',
										type: 'string',
										default: '',
										description: 'field_name on the form (e.g. document_controllers)',
									},
									{
										displayName: 'Mode',
										name: 'mode',
										type: 'options',
										options: [
											{ name: 'Replace', value: 'replace' },
											{ name: 'Add', value: 'add' },
											{ name: 'Remove', value: 'remove' },
										],
										default: 'replace',
									},
								],
							},
						],
					},
				],
			},

			// --- List view ---
			{
				displayName: 'View',
				name: 'viewId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getViews',
					loadOptionsDependsOn: ['entityId'],
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description:
					'This view already carries its filters and columns. Pick another view for a different row set.',
			},
			{
				displayName: 'How Many Rows',
				name: 'pageMode',
				type: 'options',
				options: [
					{
						name: 'First Page',
						value: 'first',
						description: 'A single page, up to the chosen limit',
					},
					{
						name: 'All Pages',
						value: 'all',
						description:
							'The node follows next_cursor automatically (max 10 pages)',
					},
				],
				default: 'first',
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description:
					'First page: 1–500. The response does not include the total. All pages: stops after 5000 rows and flags that the view is longer.',
			},
			{
				displayName: 'Limit Per Page',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 500,
				},
				default: 50,
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description: 'From 1 to 500. The response does not include the total.',
			},
			{
				displayName: 'Option Lists',
				name: 'optionsMode',
				type: 'options',
				options: [
					{ name: 'Stored Value Only (recommended for Update)', value: 'slugs' },
					{ name: 'Label and ID', value: 'both' },
					{ name: 'Label Only', value: 'labels' },
				],
				default: 'slugs',
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description:
					'Default slugs: ready for Update. “Label and ID” yields {id,label} objects; Update extracts .id when needed.',
			},
			{
				displayName: 'Relations',
				name: 'relationsMode',
				type: 'options',
				options: [
					{ name: 'UUID Only (recommended for Update)', value: 'uuids' },
					{ name: 'Label and ID', value: 'both' },
					{ name: 'Label Only', value: 'labels' },
				],
				default: 'uuids',
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description:
					'Default uuids: ready for Update. View lookup columns stay labels (not UUIDs): use Search Relation or GET outside the node.',
			},
			{
				displayName: 'Label Locale',
				name: 'locale',
				type: 'options',
				options: [
					{ name: 'Profile Locale', value: '' },
					{ name: 'Italian', value: 'it' },
					{ name: 'English', value: 'en' },
					{ name: 'Deutsch', value: 'de' },
					{ name: 'Français', value: 'fr' },
					{ name: 'Español', value: 'es' },
				],
				default: '',
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description:
					'Applies to option-list labels, not field names.',
			},
			{
				displayName: 'Include Total Count',
				name: 'includeCount',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				description:
					'One extra request. Enable only if you need the number.',
			},
			{
				displayName: 'Additional Fields',
				name: 'listOptions',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: {
					show: {
						operation: ['listView'],
					},
				},
				options: [
					{
						displayName: 'Continue From Cursor',
						name: 'cursor',
						type: 'string',
						default: '',
						description:
							'Paste next_cursor from a previous run. Empty = start from the first row.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getEntities(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const entities = await listEntities.call(this);
				return entities
					.map((e) => ({
						name: e.label || e.name || e.id,
						value: e.id,
					}))
					.sort((a, b) => a.name.localeCompare(b.name, 'en'));
			},

			async getForms(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const entityId = this.getNodeParameter('entityId') as string;
				if (!entityId) return [];
				const forms = await listForms.call(this, entityId);
				const sorted = forms.slice().sort((a, b) => {
					const score = (f: typeof a) =>
						(f.is_default_view ? 0 : 2) + (f.is_default ? 0 : 1);
					const d = score(a) - score(b);
					if (d !== 0) return d;
					return (a.label || a.name).localeCompare(b.label || b.name, 'it');
				});
				return sorted.map((f) => ({
					name: formLabelWithRole(f),
					value: f.name,
				}));
			},

			async getViews(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const entityId = this.getNodeParameter('entityId') as string;
				if (!entityId) return [];
				const views = await listViews.call(this, entityId);
				return views
					.slice()
					.sort((a, b) => {
						if (a.is_default && !b.is_default) return -1;
						if (!a.is_default && b.is_default) return 1;
						return (a.label || a.name).localeCompare(b.label || b.name, 'it');
					})
					.map((v) => ({
						name: v.is_default
							? `${v.label || v.name} (default)`
							: v.label || v.name,
						value: v.id,
					}));
			},

			async getRelationFields(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const entityId = this.getNodeParameter('entityId') as string;
				const formName = this.getNodeParameter('formName') as string;
				if (!entityId || !formName) return [];
				const schema = (await getWriteSchema.call(
					this,
					entityId,
					formName,
				)) as WriteDiscoverySchema;
				const seen = new Set<string>();
				const out: INodePropertyOptions[] = [];
				for (const field of schema.fields.slice().sort((a, b) => a.order - b.order)) {
					if (field.input.mode !== 'relation') continue;
					if (field.input.storage === 'through') continue;
					if (seen.has(field.name)) continue;
					seen.add(field.name);
					const multi = field.input.multi_select ? ' (multi)' : '';
					out.push({
						name: `${field.label || field.name}${multi}`,
						value: field.name,
					});
				}
				return out;
			},

			async getThroughFields(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const entityId = this.getNodeParameter('entityId') as string;
				const formName = this.getNodeParameter('formName') as string;
				if (!entityId || !formName) return [];
				const schema = (await getWriteSchema.call(
					this,
					entityId,
					formName,
				)) as WriteDiscoverySchema;
				const out: INodePropertyOptions[] = [];
				for (const field of schema.fields.slice().sort((a, b) => a.order - b.order)) {
					if (field.input.mode !== 'relation') continue;
					if (field.input.storage !== 'through') continue;
					out.push({
						name: field.label || field.name,
						value: field.name,
					});
				}
				return out;
			},

			async getMatchFields(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const entityId = this.getNodeParameter('entityId') as string;
				if (!entityId) return [];
				const formParam = (this.getNodeParameter('formName') as string) || '';
				let formName = formParam.trim();
				if (!formName) {
					const forms = await listForms.call(this, entityId);
					if (forms.length === 0) return [];
					formName = forms[0]!.name;
				}
				const schema = (await getWriteSchema.call(
					this,
					entityId,
					formName,
				)) as WriteDiscoverySchema;
				const scalars = new Set<string>();
				const out: INodePropertyOptions[] = [];
				for (const field of schema.fields) {
					if (field.input.mode === 'relation') continue;
					if (field.readonly || field.server_filled === 'computed') continue;
					if (scalars.has(field.name)) continue;
					scalars.add(field.name);
					out.push({
						name: field.label || field.name,
						value: field.name,
					});
				}
				out.sort((a, b) => a.name.localeCompare(b.name, 'en'));
				return out;
			},

			async getWorkflows(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const workflows = await listWorkflows.call(this);
				return workflows
					.map((w) => ({
						name: w.name || w.id,
						value: w.id,
					}))
					.sort((a, b) => a.name.localeCompare(b.name, 'en'));
			},
		},

		resourceMapping: {
			async getFormFieldsCreate(
				this: ILoadOptionsFunctions,
			): Promise<ResourceMapperFields> {
				return buildMapperFields.call(this, 'create');
			},

			async getFormFieldsUpdate(
				this: ILoadOptionsFunctions,
			): Promise<ResourceMapperFields> {
				return buildMapperFields.call(this, 'update');
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		if (operation === 'searchRelation') {
			const entityId = this.getNodeParameter('entityId', 0) as string;
			const formName = this.getNodeParameter('formName', 0) as string;
			const fieldName = this.getNodeParameter(
				'relationFieldName',
				0,
			) as string;
			const q = (this.getNodeParameter('relationQuery', 0, '') as string) || '';
			const limit = Math.min(
				RELATION_SEARCH_MAX_LIMIT,
				Math.max(
					1,
					Number(this.getNodeParameter('relationLimit', 0, 50)) || 50,
				),
			);
			if (!fieldName?.trim()) {
				throw new NodeOperationError(
					this.getNode(),
					'Relation field is required.',
				);
			}
			const records = await searchRelationOptions.call(
				this,
				entityId,
				formName,
				fieldName.trim(),
				limit,
				q,
			);
			for (const record of records) {
				returnData.push({
					json: {
						id: record.id,
						label: record.label,
						field: fieldName.trim(),
					},
				});
			}
			return [returnData];
		}

		if (operation === 'listView') {
			const viewId = this.getNodeParameter('viewId', 0) as string;
			const pageMode = this.getNodeParameter('pageMode', 0) as string;
			const limit = Math.min(
				MAX_PAGE_LIMIT,
				Math.max(1, Number(this.getNodeParameter('limit', 0, 50)) || 50),
			);
			const optionsMode = this.getNodeParameter('optionsMode', 0) as string;
			const relationsMode = this.getNodeParameter('relationsMode', 0) as string;
			const locale = (this.getNodeParameter('locale', 0, '') as string) || undefined;
			const includeCount = this.getNodeParameter(
				'includeCount',
				0,
				false,
			) as boolean;
			const listOptions = this.getNodeParameter(
				'listOptions',
				0,
				{},
			) as IDataObject;
			let cursor =
				typeof listOptions.cursor === 'string' && listOptions.cursor.trim()
					? listOptions.cursor.trim()
					: undefined;

			let totalCount: number | undefined;
			if (includeCount) {
				totalCount = await countViewRecords.call(this, viewId);
			}

			const collected: Array<{ id: string; data: Record<string, unknown> }> =
				[];
			let pages = 0;
			let hasMore = false;
			let nextCursor: string | undefined;
			let truncated = false;

			do {
				const qs: IDataObject = {
					limit,
					options: optionsMode,
					relations: relationsMode,
				};
				if (locale) qs.locale = locale;
				if (cursor) qs.cursor = cursor;

				const page = await listViewRecords.call(this, viewId, qs);
				collected.push(...(page.records ?? []));
				pages += 1;
				hasMore = Boolean(page.page?.has_more);
				nextCursor = page.page?.next_cursor;
				cursor = nextCursor;

				if (pageMode !== 'all') break;
				if (!hasMore) break;
				if (pages >= MAX_PAGES) {
					truncated = true;
					break;
				}
			} while (true);

			for (const record of collected) {
				const json: IDataObject = {
					id: record.id,
					...record.data,
				};
				if (totalCount !== undefined) {
					json._view_count = totalCount;
				}
				if (pageMode === 'first' && hasMore && nextCursor) {
					json._next_cursor = nextCursor;
					json._has_more = true;
				}
				if (truncated) {
					json._truncated = true;
					json._next_cursor = nextCursor;
					json._has_more = true;
				}
				returnData.push({ json });
			}

			return [returnData];
		}

		if (operation === 'listRecords') {
			const entityId = this.getNodeParameter('entityId', 0) as string;
			const limit = Math.min(
				MAX_PAGE_LIMIT,
				Math.max(
					1,
					Number(this.getNodeParameter('listRecordsLimit', 0, 50)) || 50,
				),
			);
			const offset = Math.max(
				0,
				Number(this.getNodeParameter('listRecordsOffset', 0, 0)) || 0,
			);
			const qs: IDataObject = { limit, offset };
			const filtersRaw = this.getNodeParameter(
				'listRecordsFilters',
				0,
				{},
			) as IDataObject;
			const filterList = filtersRaw.filter;
			const entries = Array.isArray(filterList)
				? filterList
				: filterList
					? [filterList]
					: [];
			for (const entry of entries) {
				if (!entry || typeof entry !== 'object') continue;
				const field = String((entry as { field?: unknown }).field ?? '').trim();
				const value = String((entry as { value?: unknown }).value ?? '').trim();
				if (!field) continue;
				qs[`filter[${field}]`] = `eq.${value}`;
			}
			const records = await listEntityRecords.call(this, entityId, qs);
			for (const record of records) {
				returnData.push({ json: flattenRecordRow(record) });
			}
			return [returnData];
		}

		const fieldMapperOps = new Set([
			'create',
			'update',
			'upsert',
			'validateDraft',
		]);

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'startWorkflow' || operation === 'getWorkflowRun') {
					const workflowId = this.getNodeParameter('workflowId', i) as string;
					if (operation === 'getWorkflowRun') {
						const runId = (this.getNodeParameter('runId', i) as string)?.trim();
						if (!runId) {
							throw new NodeOperationError(
								this.getNode(),
								'Run ID is required.',
								{ itemIndex: i },
							);
						}
						const status = await getWorkflowRunStatus.call(
							this,
							workflowId,
							runId,
						);
						returnData.push({
							json: status as IDataObject,
							pairedItem: { item: i },
						});
						continue;
					}
					const entityDataId = (
						this.getNodeParameter('entityDataId', i) as string
					)?.trim();
					if (!entityDataId) {
						throw new NodeOperationError(
							this.getNode(),
							'Record ID (entity_data_id) is required.',
							{ itemIndex: i },
						);
					}
					let workflowPayload: IDataObject | undefined;
					const rawData = this.getNodeParameter('workflowData', i, '{}');
					if (typeof rawData === 'string' && rawData.trim()) {
						workflowPayload = JSON.parse(rawData) as IDataObject;
					} else if (rawData && typeof rawData === 'object') {
						workflowPayload = rawData as IDataObject;
					}
					const started = await startWorkflowRun.call(
						this,
						workflowId,
						entityDataId,
						workflowPayload,
					);
					returnData.push({
						json: started as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				const entityId = this.getNodeParameter('entityId', i) as string;

				if (operation === 'get') {
					const recordId = requireRecordId(this, i);
					const record = await getRecord.call(this, entityId, recordId);
					returnData.push({
						json: flattenRecordRow(record),
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'delete') {
					const recordId = requireRecordId(this, i);
					await deleteRecord.call(this, entityId, recordId);
					returnData.push({
						json: { ok: true, id: recordId },
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'listDocuments') {
					const recordId = requireRecordId(this, i);
					const docs = await listRecordDocuments.call(
						this,
						entityId,
						recordId,
					);
					for (const doc of docs) {
						returnData.push({
							json: doc as IDataObject,
							pairedItem: { item: i },
						});
					}
					if (docs.length === 0) {
						returnData.push({
							json: { _empty: true, record_id: recordId },
							pairedItem: { item: i },
						});
					}
					continue;
				}

				if (operation === 'openDocument') {
					const recordId = requireRecordId(this, i);
					const documentId = (
						this.getNodeParameter('documentId', i) as string
					)?.trim();
					if (!documentId) {
						throw new NodeOperationError(
							this.getNode(),
							'Document ID is required.',
							{ itemIndex: i },
						);
					}
					const opened = await openRecordDocument.call(
						this,
						entityId,
						recordId,
						documentId,
					);
					returnData.push({
						json: opened as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'generateDocument') {
					const recordId = requireRecordId(this, i);
					const templateId = (
						this.getNodeParameter('templateId', i) as string
					)?.trim();
					if (!templateId) {
						throw new NodeOperationError(
							this.getNode(),
							'Template ID is required.',
							{ itemIndex: i },
						);
					}
					const generated = await generateRecordDocument.call(
						this,
						entityId,
						recordId,
						templateId,
					);
					returnData.push({
						json: generated as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'uploadDocument') {
					const recordId = requireRecordId(this, i);
					const binaryProperty =
						(this.getNodeParameter('binaryPropertyName', i, 'data') as string) ||
						'data';
					const uploadOptions = this.getNodeParameter(
						'uploadOptions',
						i,
						{},
					) as IDataObject;
					const buffer = await this.helpers.getBinaryDataBuffer(
						i,
						binaryProperty,
					);
					const binaryBag = items[i].binary as
						| Record<string, { fileName?: string; mimeType?: string }>
						| undefined;
					const binaryMeta = binaryBag?.[binaryProperty];
					const fileName =
						(typeof uploadOptions.fileName === 'string' &&
						uploadOptions.fileName.trim()
							? uploadOptions.fileName.trim()
							: binaryMeta?.fileName) || 'upload.bin';
					const form = new FormData();
					const mime =
						binaryMeta?.mimeType && binaryMeta.mimeType.trim()
							? binaryMeta.mimeType
							: 'application/octet-stream';
					form.append(
						'file',
						new Blob([new Uint8Array(buffer)], { type: mime }),
						fileName,
					);
					if (
						typeof uploadOptions.title === 'string' &&
						uploadOptions.title.trim()
					) {
						form.append('title', uploadOptions.title.trim());
					}
					form.append('file_name', fileName);
					const uploaded = await uploadRecordDocument.call(
						this,
						entityId,
						recordId,
						form,
					);
					returnData.push({
						json: uploaded as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'linkRecords' || operation === 'unlinkRecords') {
					const formName = this.getNodeParameter('formName', i) as string;
					const fromRecordId = requireRecordId(this, i);
					const farRecordId = (
						this.getNodeParameter('farRecordId', i) as string
					)?.trim();
					const throughField = (
						this.getNodeParameter('throughFieldName', i) as string
					)?.trim();
					if (!farRecordId || !throughField) {
						throw new NodeOperationError(
							this.getNode(),
							'Through field and far record ID are required.',
							{ itemIndex: i },
						);
					}
					if (operation === 'linkRecords') {
						const linked = await linkThroughRecords.call(
							this,
							entityId,
							formName,
							throughField,
							fromRecordId,
							farRecordId,
						);
						returnData.push({
							json: linked as IDataObject,
							pairedItem: { item: i },
						});
					} else {
						const unlinked = await unlinkThroughRecords.call(
							this,
							entityId,
							formName,
							throughField,
							fromRecordId,
							farRecordId,
						);
						returnData.push({
							json: unlinked as IDataObject,
							pairedItem: { item: i },
						});
					}
					continue;
				}

				if (operation === 'resolveRelation') {
					const matchField = this.getNodeParameter('matchField', i) as string;
					const values = parseResolveValues(
						this,
						this.getNodeParameter('resolveValues', i) as string,
						i,
					);
					const resolveOptions = this.getNodeParameter(
						'resolveOptions',
						i,
						{},
					) as IDataObject;
					const fieldName =
						typeof resolveOptions.fieldName === 'string' &&
						resolveOptions.fieldName.trim()
							? resolveOptions.fieldName.trim()
							: undefined;
					const resolved = await resolveNaturalKeys.call(
						this,
						entityId,
						matchField,
						values,
						fieldName,
					);
					const results = (resolved as { results?: unknown[] }).results ?? [
						resolved,
					];
					for (const row of results) {
						returnData.push({
							json: row as IDataObject,
							pairedItem: { item: i },
						});
					}
					continue;
				}

				if (!fieldMapperOps.has(operation)) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation: ${operation}`,
						{ itemIndex: i },
					);
				}

				const formName = this.getNodeParameter('formName', i) as string;
				const data = readMappedFieldData(this, items, i);

				if (operation === 'create') {
					const result = await createRecord.call(
						this,
						entityId,
						formName,
						data,
					);
					returnData.push({
						json: { id: result.id },
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'validateDraft') {
					const validateOpts = this.getNodeParameter(
						'validateDraftOptions',
						i,
						{},
					) as IDataObject;
					const existingId =
						typeof validateOpts.recordId === 'string' &&
						validateOpts.recordId.trim()
							? validateOpts.recordId.trim()
							: undefined;
					const result = await validateDraft.call(
						this,
						entityId,
						formName,
						data,
						existingId,
					);
					returnData.push({
						json: result as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'upsert') {
					const matchField = this.getNodeParameter('matchField', i) as string;
					if (!matchField?.trim()) {
						throw new NodeOperationError(
							this.getNode(),
							'Match field is required.',
							{ itemIndex: i },
						);
					}
					const result = await upsertRecord.call(
						this,
						entityId,
						formName,
						matchField.trim(),
						data,
					);
					returnData.push({
						json: result as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'update') {
					if (Object.keys(data).length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'Compila almeno un campo da aggiornare.',
							{ itemIndex: i },
						);
					}
					const recordId = requireRecordId(this, i);
					const updateOptions = this.getNodeParameter(
						'updateOptions',
						i,
						{},
					) as IDataObject;
					const expected =
						typeof updateOptions.expectedUpdatedAt === 'string' &&
						updateOptions.expectedUpdatedAt.trim()
							? updateOptions.expectedUpdatedAt.trim()
							: undefined;
					const multiValueModes = parseMultiValueModes(
						updateOptions.multiValueModes,
					);

					const result = await updateRecord.call(
						this,
						entityId,
						recordId,
						formName,
						data,
						expected,
						multiValueModes,
					);
					returnData.push({
						json: { id: result.id },
						pairedItem: { item: i },
					});
					continue;
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

function requireRecordId(ctx: IExecuteFunctions, itemIndex: number): string {
	const recordId = (ctx.getNodeParameter('recordId', itemIndex) as string)?.trim();
	if (!recordId) {
		throw new NodeOperationError(ctx.getNode(), 'Record ID is required.', {
			itemIndex,
		});
	}
	return recordId;
}

function readMappedFieldData(
	ctx: IExecuteFunctions,
	items: INodeExecutionData[],
	itemIndex: number,
): IDataObject {
	const mappingMode = ctx.getNodeParameter(
		'fields.mappingMode',
		itemIndex,
	) as string;
	let rawFields: IDataObject = {};
	if (mappingMode === 'defineBelow') {
		rawFields = ctx.getNodeParameter('fields.value', itemIndex, {}) as IDataObject;
	} else if (mappingMode === 'autoMapInputData') {
		rawFields = { ...items[itemIndex].json } as IDataObject;
		delete rawFields.id;
	}
	return pickCompiledFieldValues(rawFields);
}

function parseResolveValues(
	ctx: IExecuteFunctions,
	raw: string,
	itemIndex: number,
): string[] {
	const trimmed = (raw ?? '').trim();
	if (!trimmed) {
		throw new NodeOperationError(
			ctx.getNode(),
			'Values to resolve are required.',
			{ itemIndex },
		);
	}
	if (trimmed.startsWith('[')) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed) as unknown;
		} catch {
			throw new NodeOperationError(
				ctx.getNode(),
				'Invalid values JSON.',
				{ itemIndex },
			);
		}
		if (!Array.isArray(parsed)) {
			throw new NodeOperationError(
				ctx.getNode(),
				'Values JSON must be an array.',
				{ itemIndex },
			);
		}
		return parsed.map((v) => String(v).trim()).filter(Boolean);
	}
	return trimmed
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

async function buildMapperFields(
	this: ILoadOptionsFunctions,
	mode: 'create' | 'update',
): Promise<ResourceMapperFields> {
	const entityId = this.getNodeParameter('entityId') as string;
	const formName = this.getNodeParameter('formName') as string;
	if (!entityId || !formName) {
		return { fields: [] };
	}

	const schema = (await getWriteSchema.call(
		this,
		entityId,
		formName,
	)) as WriteDiscoverySchema;

	const fields = writeSchemaToMapperFields(schema, mode);

	// Single relations: dropdown when candidates fit under RELATION_DROPDOWN_LIMIT.
	// Multi_select stays array (UUID[]); browse all via “Search Relation”.
	for (const field of fields) {
		const schemaField = schema.fields.find((f) => f.name === field.id);
		if (!schemaField || schemaField.input.mode !== 'relation') continue;

		try {
			const records = await searchRelationOptions.call(
				this,
				entityId,
				formName,
				field.id,
				RELATION_DROPDOWN_LIMIT,
			);
			if (schemaField.input.multi_select) {
				if (records.length > 0 && records.length < RELATION_DROPDOWN_LIMIT) {
					const preview = records
						.slice(0, 8)
						.map((r) => `${r.label} (${r.id})`)
						.join('; ');
					field.description = [
						field.description,
						`Candidate preview: ${preview}${records.length > 8 ? '…' : ''}. Use “Search Relation” to filter.`,
					]
						.filter(Boolean)
						.join(' ');
				} else if (records.length >= RELATION_DROPDOWN_LIMIT) {
					field.description = [
						field.description,
						`≥${RELATION_DROPDOWN_LIMIT} candidates: use “Search Relation” (q + limit up to ${RELATION_SEARCH_MAX_LIMIT}), then UUID[] in Fields.`,
					]
						.filter(Boolean)
						.join(' ');
				}
				continue;
			}

			if (records.length > 0 && records.length < RELATION_DROPDOWN_LIMIT) {
				field.type = 'options';
				field.options = records.map((r) => ({
					name: r.label,
					value: r.id,
				}));
			} else if (records.length >= RELATION_DROPDOWN_LIMIT) {
				field.description = [
					field.description,
					`Too many records for the dropdown (cap ${RELATION_DROPDOWN_LIMIT}): use “Search Relation” or paste the UUID.`,
				]
					.filter(Boolean)
					.join(' ');
			}
		} catch {
			// Keep as free-text UUID / array field.
		}
	}

	return { fields };
}

function parseMultiValueModes(
	raw: unknown,
): Record<string, 'add' | 'replace' | 'remove'> | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const entries = (raw as { entry?: unknown }).entry;
	const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
	const out: Record<string, 'add' | 'replace' | 'remove'> = {};
	for (const item of list) {
		if (!item || typeof item !== 'object') continue;
		const field = String((item as { field?: unknown }).field ?? '').trim();
		const mode = String((item as { mode?: unknown }).mode ?? '').trim();
		if (!field) continue;
		if (mode === 'add' || mode === 'replace' || mode === 'remove') {
			out[field] = mode;
		}
	}
	return Object.keys(out).length > 0 ? out : undefined;
}
