import type { INodeProperties } from 'n8n-workflow';

/** Workflow resource: Start and Get Run Status. */
export const workflowFields: INodeProperties[] = [
	{
		displayName: 'Workflow',
		name: 'workflowId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getWorkflows',
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['startWorkflow', 'getWorkflowRun'],
			},
		},
	},
	{
		displayName: 'Record ID (entity_data_id)',
		name: 'entityDataId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['startWorkflow'],
			},
		},
		description: 'UUID of the record to start the workflow on.',
	},
	{
		displayName: 'Additional Data Mode',
		name: 'workflowDataMode',
		type: 'options',
		options: [
			{
				name: 'Key/Value',
				value: 'keyValue',
				description: 'Add fields one by one (name + value)',
			},
			{
				name: 'JSON',
				value: 'json',
				description: 'Pass a JSON object as $trigger.data (max 64 KiB)',
			},
		],
		default: 'keyValue',
		displayOptions: {
			show: {
				operation: ['startWorkflow'],
			},
		},
		description:
			'How to send optional start payload. Cervio accepts a free JSON object on POST /api/v1/workflows/:id/runs.',
	},
	{
		displayName: 'Additional Data',
		name: 'workflowData',
		type: 'fixedCollection',
		placeholder: 'Add field',
		typeOptions: { multipleValues: true },
		default: {},
		displayOptions: {
			show: {
				operation: ['startWorkflow'],
				workflowDataMode: ['keyValue'],
			},
		},
		options: [
			{
				displayName: 'Values',
				name: 'values',
				values: [
					{ displayName: 'Name', name: 'name', type: 'string', default: '' },
					{ displayName: 'Value', name: 'value', type: 'string', default: '' },
				],
			},
		],
		description: 'Optional key/value payload for the manual trigger.',
	},
	{
		displayName: 'Additional Data (JSON)',
		name: 'workflowDataJson',
		type: 'json',
		required: true,
		default: '{}',
		displayOptions: {
			show: {
				operation: ['startWorkflow'],
				workflowDataMode: ['json'],
			},
		},
		description:
			'JSON object passed as start `data` (becomes $trigger.data). Must be an object, not an array. Max 64 KiB.',
	},
	{
		displayName: 'Run ID',
		name: 'runId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['getWorkflowRun'],
			},
		},
		description: 'invocation_id returned by Start Workflow.',
	},
];
