import type { INodeProperties } from 'n8n-workflow';

/** Document resource: Open, Generate from Template and Upload. */
export const documentFields: INodeProperties[] = [
	{
		displayName: 'Document ID',
		name: 'documentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['openDocument'],
			},
		},
	},
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['generateDocument'],
			},
		},
		description: 'Document template UUID (no public REST catalog yet).',
	},
	{
		displayName: 'Binary Property',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		displayOptions: {
			show: {
				operation: ['uploadDocument'],
			},
		},
		description: 'Binary field on the n8n item to upload as the file.',
	},
	{
		displayName: 'Upload Options',
		name: 'uploadOptions',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: {
			show: {
				operation: ['uploadDocument'],
			},
		},
		options: [
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				description: 'Default: name from the binary or upload.bin',
			},
		],
	},
];
