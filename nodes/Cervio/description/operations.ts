import type { INodeProperties } from 'n8n-workflow';

/** All 18 operations (flat) for node version 1 single dropdown. */
export const operationOptionsFlat: NonNullable<INodeProperties['options']> = [
	{
		name: 'Create',
		value: 'create',
		description: 'Create a record using the form fields',
		action: 'Create a record',
	},
	{
		name: 'Update',
		value: 'update',
		description: 'Update a record by id; only mapped form fields are sent',
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
		description: 'Read records from a view (filters and columns come from the view)',
		action: 'List a view',
	},
	{
		name: 'List',
		value: 'listRecords',
		description: 'List entity records (system_admin; filters eq.field=value)',
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
];

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Record', value: 'record' },
		{ name: 'Relation', value: 'relation' },
		{ name: 'Document', value: 'document' },
		{ name: 'Workflow', value: 'workflow' },
	],
	default: 'record',
	displayOptions: {
		show: {
			'@version': [2],
		},
	},
};

const operationBase = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options' as const,
	noDataExpression: true,
	displayOptions: {
		show: {
			'@version': [2],
			resource: [] as string[],
		},
	},
};

export const operationPropertiesByResource: INodeProperties[] = [
	{
		...operationBase,
		displayOptions: {
			show: {
				'@version': [2],
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
				description: 'Update a record by id; only mapped form fields are sent',
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
				description: 'Read records from a view (filters and columns come from the view)',
				action: 'List a view',
			},
			{
				name: 'List',
				value: 'listRecords',
				description: 'List entity records (system_admin; filters eq.field=value)',
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
		...operationBase,
		displayOptions: {
			show: {
				'@version': [2],
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
		...operationBase,
		displayOptions: {
			show: {
				'@version': [2],
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
		...operationBase,
		displayOptions: {
			show: {
				'@version': [2],
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
];

export const operationPropertyV1: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: {
		show: {
			'@version': [1],
		},
	},
	options: operationOptionsFlat,
	default: 'create',
};
