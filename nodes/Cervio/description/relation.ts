import type { INodeProperties } from 'n8n-workflow';

/** Relation resource: Search, Resolve Key, Link and Unlink Records. */
export const relationFields: INodeProperties[] = [
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
		description: 'Free text passed to relation-options?q=. Empty = first results.',
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
		displayName: 'N:M Field',
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
		description: 'N:M field on the form. Each link is one row of its junction entity.',
	},
	{
		displayName: 'Far Record ID',
		name: 'farRecordId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['linkRecords'],
			},
		},
		description:
			'Record to link on the other side of the N:M field. Linking it again adds another row (e.g. one per year), unless the junction has a uniqueness rule.',
	},
	{
		displayName: 'Junction Fields',
		name: 'junctionFields',
		type: 'resourceMapper',
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		noDataExpression: true,
		displayOptions: {
			show: {
				operation: ['linkRecords'],
			},
		},
		typeOptions: {
			loadOptionsDependsOn: ['entityId', 'formName', 'throughFieldName'],
			resourceMapper: {
				resourceMapperMethod: 'getJunctionFields',
				mode: 'add',
				fieldWords: {
					singular: 'junction field',
					plural: 'junction fields',
				},
				addAllFields: true,
				multiKeyMatch: false,
				supportAutoMap: false,
			},
		},
		description:
			'Other fields of the link row (e.g. year, hours). Required ones must be filled. The two linked records are set by Cervio.',
	},
	{
		displayName: 'Junction Record ID',
		name: 'junctionRecordId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['unlinkRecords'],
			},
		},
		description:
			'ID of the link row to remove, e.g. {{ $json.junction_record_id }} from Link Records, or the ID of a row listed from the junction entity. Other rows with the same far record are kept.',
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
];
