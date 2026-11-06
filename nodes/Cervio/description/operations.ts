import type { INodeProperties } from 'n8n-workflow';

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
		{ name: 'Notification', value: 'notification' },
	],
	default: 'record',
};

const operationBase = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options' as const,
	noDataExpression: true,
	displayOptions: {
		show: {
			resource: [] as string[],
		},
	},
};

export const operationPropertiesByResource: INodeProperties[] = [
	{
		...operationBase,
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
	{
		...operationBase,
		displayOptions: {
			show: {
				resource: ['notification'],
			},
		},
		options: [
			{
				name: 'Send to Me',
				value: 'notifySelf',
				description:
					'Create an in-app notification for the PAT owner (POST /api/v1/me/notifications)',
				action: 'Notify the authenticated user',
			},
			{
				name: 'Notify Users',
				value: 'notifyUsers',
				description:
					'Notify up to 50 organization members (admin; POST /api/v1/notifications)',
				action: 'Notify organization users',
			},
		],
		default: 'notifySelf',
	},
];
