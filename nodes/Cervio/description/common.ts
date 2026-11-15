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
		description: 'Only entities this token can read.',
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
			'Fields below are from this form, not every entity field. Cervio rejects fields that are not on this form. N:M fields are not in Fields: use Link Records / Unlink Records.',
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
		description: 'Record id from List view, e.g. {{ $json.id }}. Not a form field.',
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
];
