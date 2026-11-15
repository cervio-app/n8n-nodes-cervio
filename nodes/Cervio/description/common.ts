import type { INodeProperties } from 'n8n-workflow';

/** Parameters shared by several resources: entity, form, record and match field. They come first, so they keep their place above each operation's own parameters. */
export const commonFields: INodeProperties[] = [
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
				operation: ['startWorkflow', 'getWorkflowRun', 'notifySelf', 'notifyUsers'],
			},
		},
		description: 'The kind of record to work with. Only entities the token can read are listed.',
	},
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
			'The form whose fields are offered below. Cervio accepts only fields that are on this form. N:M fields are handled by Link Records and Unlink Records.',
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
		description: 'ID of the record, e.g. {{ $json.id }} from a previous Cervio node.',
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
		description: 'A field with unique values (e.g. a code or an email) used to find the record.',
	},
];
