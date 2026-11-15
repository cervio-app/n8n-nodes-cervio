import type { INodeProperties } from 'n8n-workflow';

/** Notification resource: Send to Me and Notify Users. */
export const notificationFields: INodeProperties[] = [
	{
		displayName: 'Title',
		name: 'notificationTitle',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['notifySelf', 'notifyUsers'],
			},
		},
		description: 'Notification title (max 200 characters).',
	},
	{
		displayName: 'Body',
		name: 'notificationBody',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		displayOptions: {
			show: {
				operation: ['notifySelf', 'notifyUsers'],
			},
		},
		description: 'Optional body text (max 2000 characters).',
	},
	{
		displayName: 'Link (href)',
		name: 'notificationHref',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['notifySelf', 'notifyUsers'],
			},
		},
		description: 'Optional deep link path inside the Cervio app (max 500 characters).',
	},
	{
		displayName: 'Category',
		name: 'notificationCategory',
		type: 'options',
		options: [
			{ name: 'Plugin', value: 'plugin' },
			{ name: 'Task', value: 'task' },
			{ name: 'Workflow', value: 'workflow' },
			{ name: 'System', value: 'system' },
			{ name: 'Entity', value: 'entity' },
		],
		default: 'plugin',
		displayOptions: {
			show: {
				operation: ['notifySelf', 'notifyUsers'],
			},
		},
	},
	{
		displayName: 'Source Type',
		name: 'notificationSourceType',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['notifySelf', 'notifyUsers'],
			},
		},
		description: 'Optional source_type for audit / grouping (max 100 characters).',
	},
	{
		displayName: 'Source ID',
		name: 'notificationSourceId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['notifySelf', 'notifyUsers'],
			},
		},
		description: 'Optional idempotency key per user (max 200 characters).',
	},
	{
		displayName: 'User IDs',
		name: 'notificationUserIds',
		type: 'fixedCollection',
		placeholder: 'Add user',
		typeOptions: { multipleValues: true },
		default: {},
		required: true,
		displayOptions: {
			show: {
				operation: ['notifyUsers'],
			},
		},
		options: [
			{
				displayName: 'User',
				name: 'user',
				values: [
					{
						displayName: 'User ID',
						name: 'id',
						type: 'string',
						default: '',
						description: 'Organization member UUID',
					},
				],
			},
		],
		description:
			'Recipients in this organization (max 50). Outside-org IDs are ignored by the API.',
	},
];
