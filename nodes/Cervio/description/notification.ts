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
		description: 'Up to 200 characters.',
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
		description: 'Optional text, up to 2000 characters.',
	},
	{
		displayName: 'Link',
		name: 'notificationHref',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['notifySelf', 'notifyUsers'],
			},
		},
		description: 'Optional page of the Cervio app to open, e.g. /my-tasks (up to 500 characters).',
	},
	{
		displayName: 'Category',
		name: 'notificationCategory',
		description: 'Where the notification is filed in Cervio.',
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
		description:
			'Optional label that groups notifications from the same source (up to 100 characters).',
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
		description:
			'Optional key: a notification with a key already sent to a user is not sent again (up to 200 characters).',
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
						description: 'User ID in Cervio',
					},
				],
			},
		],
		description: 'Users to notify, up to 50. IDs of users outside the organization are ignored.',
	},
];
