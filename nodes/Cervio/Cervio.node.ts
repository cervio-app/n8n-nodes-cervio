import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { cervioProperties } from './description';
import { executeCervio } from './execute';
import { cervioMethods } from './methods';

export class Cervio implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Cervio',
		name: 'cervio',
		icon: { light: 'file:cervio.mono.light.svg', dark: 'file:cervio.mono.dark.svg' },
		group: ['transform'],
		version: 2,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description:
			'Cervio tenant over REST /api/v1: records, documents, relations, workflows, and notifications. Guided forms for create/update. For full MCP tools on an AI Agent, use n8n MCP Client Tool → https://<tenant>/api/mcp with a Bearer PAT.',
		defaults: {
			name: 'Cervio',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'cervioApi',
				required: true,
			},
		],
		properties: cervioProperties,
	};

	methods = cervioMethods;

	async execute(this: IExecuteFunctions) {
		return executeCervio.call(this);
	}
}
