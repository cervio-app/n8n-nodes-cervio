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
				description: 'Create a record from the fields of a form',
				action: 'Create a record',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Change the fields you set on a record; the others keep their value',
				action: 'Update a record',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a record by ID, with the fields you are allowed to see',
				action: 'Get a record',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a record',
				action: 'Delete a record',
			},
			{
				name: 'List View',
				value: 'listView',
				description: 'Get the records of a view, with its filters and columns',
				action: 'List a view',
			},
			{
				name: 'List',
				value: 'listRecords',
				description: 'Get the records of an entity, optionally filtered (admins only)',
				action: 'List entity records',
			},
			{
				name: 'Validate Draft',
				value: 'validateDraft',
				description: 'Check values against the form rules without saving',
				action: 'Validate form draft',
			},
			{
				name: 'Create or Update',
				value: 'upsert',
				description: 'Update the record matching a unique field, or create it',
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
				description: 'Find the records a relation field can point to',
				action: 'Search relation candidates',
			},
			{
				name: 'Resolve Key',
				value: 'resolveRelation',
				description: 'Turn values of a unique field into record IDs',
				action: 'Resolve natural keys',
			},
			{
				name: 'Link Records',
				value: 'linkRecords',
				description: 'Link two records through an N:M field, with optional link fields',
				action: 'Link N:M records',
			},
			{
				name: 'Unlink Records',
				value: 'unlinkRecords',
				description: 'Remove one N:M link by its link row ID',
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
				description: 'List the documents attached to a record',
				action: 'List documents',
			},
			{
				name: 'Upload',
				value: 'uploadDocument',
				description: 'Attach a file from the input item to a record',
				action: 'Upload document',
			},
			{
				name: 'Open',
				value: 'openDocument',
				description: 'Get a temporary download link for a document',
				action: 'Open document',
			},
			{
				name: 'Generate from Template',
				value: 'generateDocument',
				description: 'Create a document from a template (admins only)',
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
				description: 'Start a Cervio workflow on a record',
				action: 'Start workflow',
			},
			{
				name: 'Get Run Status',
				value: 'getWorkflowRun',
				description: 'Get the status of a workflow run (admins only)',
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
				description: 'Send an in-app notification to the owner of the token',
				action: 'Notify the authenticated user',
			},
			{
				name: 'Notify Users',
				value: 'notifyUsers',
				description:
					'Send an in-app notification to up to 50 users of the organization (admins only)',
				action: 'Notify organization users',
			},
		],
		default: 'notifySelf',
	},
];
