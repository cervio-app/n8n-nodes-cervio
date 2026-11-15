import type { INodeProperties } from 'n8n-workflow';

/** Workflow resource: Start and Get Run Status. */
export const workflowFields: INodeProperties[] = [
	{
		displayName: 'Workflow',
		name: 'workflowId',
		description: 'The Cervio workflow to start or check.',
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
		displayName: 'Record ID',
		name: 'entityDataId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['startWorkflow'],
			},
		},
		description: 'ID of the record the workflow runs on.',
	},
	{
		displayName: 'Additional Data Mode',
		name: 'workflowDataMode',
		type: 'options',
		options: [
			{
				name: 'Key/Value',
				value: 'keyValue',
				description: 'Add values one by one',
			},
			{
				name: 'JSON',
				value: 'json',
				description: 'Pass a JSON object, up to 64 KiB',
			},
		],
		default: 'keyValue',
		displayOptions: {
			show: {
				operation: ['startWorkflow'],
			},
		},
		description: 'How to pass extra data to the workflow, where it is available as $trigger.data.',
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
		description: 'Extra values for the workflow ($trigger.data).',
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
		description: 'JSON object for the workflow ($trigger.data), up to 64 KiB.',
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
		description: 'The invocation_id returned by Start.',
	},
];
