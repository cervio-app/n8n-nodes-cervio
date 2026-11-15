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
		description: 'The relation field whose possible records you want. N:M fields are not listed.',
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
		description: 'Text to search for. Empty returns the first records.',
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
		description: 'Maximum number of records, from 1 to 100.',
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
		description:
			'The N:M field. Each link is a row of its own, with an ID and optional link fields.',
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
		displayName: 'Link Fields',
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
			'Other fields of the link, e.g. year or hours. Required ones must be filled. Cervio sets the two linked records itself.',
	},
	{
		displayName: 'Link ID',
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
			'ID of the link to remove, e.g. {{ $json.junction_record_id }} from Link Records. Other links to the same record are kept.',
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
		description: 'Values to look up, as a JSON array ["A1","B2"] or separated by commas.',
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
				displayName: 'Through Relation Field',
				name: 'fieldName',
				type: 'string',
				default: '',
				description:
					'Look the values up in the entity this relation field points to, instead of this entity.',
			},
		],
	},
];
