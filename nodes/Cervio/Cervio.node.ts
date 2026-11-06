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
			'Records, documents, N:M relations, upsert/resolve, and workflows over REST /api/v1. Guided forms for create/update; admin list for entity records.',
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
