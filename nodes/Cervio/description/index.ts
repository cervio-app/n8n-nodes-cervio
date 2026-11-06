import type { INodeProperties } from 'n8n-workflow';

export const cervioProperties: INodeProperties[] = [
						{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Record',
						value: 'record',
					},
					{
						name: 'Relation',
						value: 'relation',
					},
					{
						name: 'Document',
						value: 'document',
					},
					{
						name: 'Workflow',
						value: 'workflow',
					},
				],
				default: 'record',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['record'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a record using the form fields',
						action: 'Create a record',
					},
					{
						name: 'Update',
						value: 'update',
						description:
							'Update a record by id; only mapped form fields are sent',
						action: 'Update a record',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'GET a record by id (fields masked by ACL)',
						action: 'Get a record',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Soft-delete the record',
						action: 'Delete a record',
					},
					{
						name: 'List View',
						value: 'listView',
						description:
							'Read records from a view (filters and columns come from the view)',
						action: 'List a view',
					},
					{
						name: 'List',
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
						name: 'Create or Update',
						value: 'upsert',
						description: 'Upsert by natural key (match_field)',
						action: 'Create or update a record',
					},
				],
				default: 'create',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['relation'],
					},
				},
				options: [
					{
						name: 'Search',
						value: 'searchRelation',
						description:
							'List/search candidates for a relation field (relation-options, up to 100)',
						action: 'Search relation candidates',
					},
					{
						name: 'Resolve Key',
						value: 'resolveRelation',
						description: 'Natural-key values → record UUIDs',
						action: 'Resolve natural keys',
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
				],
				default: 'searchRelation',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['document'],
					},
				},
				options: [
					{
						name: 'List',
						value: 'listDocuments',
						description: 'Metadata for documents linked to the record',
						action: 'List documents',
					},
					{
						name: 'Upload',
						value: 'uploadDocument',
						description: 'Multipart upload onto the record',
						action: 'Upload document',
					},
					{
						name: 'Open',
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
				],
				default: 'listDocuments',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['workflow'],
					},
				},
				options: [
					{
						name: 'Start',
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
				default: 'startWorkflow',
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
];
