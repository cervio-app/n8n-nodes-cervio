import type { INodeProperties } from 'n8n-workflow';

/** Record resource: field mappers (create, update, upsert, validate), update options, List and List View. */
export const recordFields: INodeProperties[] = [
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
				description: 'If someone else changed the record, Cervio returns 409. Usually leave empty.',
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
				description: 'The node follows next_cursor automatically (max 10 pages)',
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
		description: 'Applies to option-list labels, not field names.',
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
		description: 'One extra request. Enable only if you need the number.',
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
				description: 'Paste next_cursor from a previous run. Empty = start from the first row.',
			},
		],
	},
];
