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
			'Fields that Cervio calculates are not listed: it fills them when saving. Use “Add all fields” to start from the whole form.',
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
			'Only the fields you set are changed; the others keep their value. Set at least one field.',
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
		description: 'Same fields as Create.',
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
				displayName: 'Only If Unchanged Since',
				name: 'expectedUpdatedAt',
				type: 'string',
				default: '',
				description:
					'The record’s updated_at as you read it. If the record changed since then, Cervio refuses the update. Usually left empty.',
			},
			{
				displayName: 'Multi-Select Fields',
				name: 'multiValueModes',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				placeholder: 'Add field',
				description:
					'For multi-select relation fields: replace the list (default), add to it, or remove from it. The field must also be set in Fields.',
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
								description: 'Name of the multi-select field, as in Fields.',
							},
							{
								displayName: 'Mode',
								name: 'mode',
								type: 'options',
								options: [
									{ name: 'Replace', value: 'replace', description: 'Replace the current list' },
									{ name: 'Add', value: 'add', description: 'Add to the current list' },
									{ name: 'Remove', value: 'remove', description: 'Remove from the current list' },
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
				description: 'Check the values as changes to this saved record.',
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
		description:
			'Return only records whose field equals the value. With several filters, all must match.',
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
		description: 'Maximum number of records, from 1 to 500.',
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
		description: 'Number of records to skip, to read the next page.',
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
		description: 'The view to read. Its filters, sorting and columns apply.',
	},
	{
		displayName: 'How Many Rows',
		name: 'pageMode',
		type: 'options',
		options: [
			{
				name: 'First Page',
				value: 'first',
				description: 'One page, up to Limit Per Page records',
			},
			{
				name: 'All Pages',
				value: 'all',
				description: 'Follow the pages automatically, up to 10',
			},
		],
		default: 'first',
		displayOptions: {
			show: {
				operation: ['listView'],
			},
		},
		description: 'All Pages reads up to 10 pages and marks the last item when the view has more.',
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
		description: 'Records per page, from 1 to 500.',
	},
	{
		displayName: 'Choice Fields',
		name: 'optionsMode',
		type: 'options',
		options: [
			{ name: 'Stored Value (Ready for Update)', value: 'slugs' },
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
			'How to return choice fields. The stored value can be sent back unchanged with Update.',
	},
	{
		displayName: 'Relation Fields',
		name: 'relationsMode',
		type: 'options',
		options: [
			{ name: 'Record ID (Ready for Update)', value: 'uuids' },
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
			'How to return relation fields. The record ID can be sent back unchanged with Update.',
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
		description: 'Language of the choice labels. Field names are not translated.',
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
			'Add the total number of records in the view to each item (_view_count). Costs one more request.',
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
					'To continue a previous run, paste its _next_cursor. Empty starts from the first record.',
			},
		],
	},
];
