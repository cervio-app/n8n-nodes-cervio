import type { INodeProperties } from 'n8n-workflow';

/** Document resource: Open, Generate from Template and Upload. */
export const documentFields: INodeProperties[] = [
	{
		displayName: 'Document ID',
		name: 'documentId',
		description: 'ID of the document, from Document → List.',
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
		description: 'ID of the document template in Cervio.',
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		displayOptions: {
			show: {
				operation: ['uploadDocument'],
			},
		},
		description: 'Name of the binary field of the input item that holds the file.',
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
				description: 'Document title shown in Cervio.',
				type: 'string',
				default: '',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				description: 'Default: the name of the input file, or upload.bin.',
			},
		],
	},
];
